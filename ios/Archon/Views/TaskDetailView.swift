import SwiftUI

struct TaskDetailView: View {
    let taskId: String
    
    @StateObject private var viewModel: TaskDetailViewModel
    @Environment(\.dismiss) private var dismiss
    
    init(taskId: String, apiClient: APIClientProtocol = MockAPIClient()) {
        self.taskId = taskId
        _viewModel = StateObject(wrappedValue: TaskDetailViewModel(taskId: taskId, apiClient: apiClient))
    }
    
    var body: some View {
        List {
            if let task = viewModel.task {
                // Task header
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text(task.title)
                                .font(.title2.bold())
                            Spacer()
                            statusBadge(for: task.status)
                        }
                        
                        HStack(spacing: 16) {
                            Label(task.provider, systemImage: "cpu")
                            Label(task.model, systemImage: "brain")
                            Label(task.reasoningEffort.rawValue.capitalized, systemImage: "gauge.with.dots.needle.67percent")
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
                
                // Progress
                Section("Progress") {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Steps")
                            Spacer()
                            Text("\(task.currentStep) / \(task.maxSteps)")
                                .monospacedDigit()
                        }
                        ProgressView(value: Double(task.currentStep), total: Double(task.maxSteps))
                            .tint(progressColor(for: task.status))
                        
                        HStack {
                            Text("Credits")
                            Spacer()
                            Text("\(task.creditsUsed) / \(task.creditsLimit)")
                                .monospacedDigit()
                        }
                        ProgressView(value: Double(task.creditsUsed), total: Double(task.creditsLimit))
                            .tint(.purple)
                    }
                    .font(.subheadline)
                }
                
                // Events timeline
                if !viewModel.events.isEmpty {
                    Section("Timeline") {
                        ForEach(viewModel.events) { event in
                            EventRow(event: event)
                        }
                    }
                }
                
                // Actions
                Section {
                    if task.status == .running || task.status == .planning || task.status == .verifying {
                        Button(role: .destructive) {
                            viewModel.cancelTask()
                        } label: {
                            Label("Cancel Task", systemImage: "xmark.circle")
                        }
                    }
                }
            }
            
            if let error = viewModel.errorMessage {
                Section {
                    Text(error)
                        .foregroundStyle(.red)
                }
            }
        }
        .navigationTitle("Task Details")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Done") {
                    dismiss()
                }
            }
        }
        .refreshable {
            await viewModel.loadTask()
        }
        .task {
            await viewModel.loadTask()
        }
        .overlay {
            if viewModel.isLoading && viewModel.task == nil {
                ProgressView("Loading task...")
            }
        }
    }
    
    @ViewBuilder
    private func statusBadge(for status: TaskStatus) -> some View {
        Text(status.rawValue.capitalized)
            .font(.caption2.bold())
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(badgeColor(for: status).opacity(0.2))
            .foregroundStyle(badgeColor(for: status))
            .clipShape(Capsule())
    }
    
    private func badgeColor(for status: TaskStatus) -> Color {
        switch status {
        case .completed: return .green
        case .running, .verifying, .planning: return .teal
        case .failed, .blocked: return .red
        case .queued: return .orange
        case .cancelling, .cancelled: return .gray
        }
    }
    
    private func progressColor(for status: TaskStatus) -> Color {
        switch status {
        case .completed: return .green
        case .running, .verifying, .planning: return .teal
        case .failed, .blocked: return .red
        default: return .orange
        }
    }
}

// MARK: - Event Row

struct EventRow: View {
    let event: TaskEvent
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Image(systemName: eventIcon)
                    .foregroundStyle(eventColor)
                    .frame(width: 16)
                Text(event.type.rawValue.capitalized)
                    .font(.caption.bold())
                Spacer()
                Text(event.timestamp, style: .relative)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            Text(event.content)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            
            if let metadata = event.metadata, !metadata.isEmpty {
                HStack(spacing: 4) {
                    ForEach(Array(metadata.keys.sorted()), id: \.self) { key in
                        if let value = metadata[key] {
                            Text("\(key): \(value)")
                                .font(.caption2)
                                .padding(.horizontal, 4)
                                .padding(.vertical, 2)
                                .background(Color.secondary.opacity(0.1))
                                .clipShape(RoundedRectangle(cornerRadius: 4))
                        }
                    }
                }
            }
        }
        .padding(.vertical, 2)
    }
    
    private var eventIcon: String {
        switch event.type {
        case .planning: return "map"
        case .modelCall: return "brain"
        case .toolCall: return "wrench.and.screwdriver"
        case .toolResult: return "checkmark.circle"
        case .verification: return "shield.checkered"
        case .completion: return "flag.checkered"
        case .blocker: return "exclamationmark.triangle"
        case .error: return "xmark.octagon"
        }
    }
    
    private var eventColor: Color {
        switch event.type {
        case .planning: return .blue
        case .modelCall: return .purple
        case .toolCall: return .orange
        case .toolResult: return .green
        case .verification: return .teal
        case .completion: return .green
        case .blocker: return .yellow
        case .error: return .red
        }
    }
}

// MARK: - ViewModel

@MainActor
class TaskDetailViewModel: ObservableObject {
    @Published var task: ArchonTask?
    @Published var events: [TaskEvent] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let taskId: String
    private let apiClient: APIClientProtocol
    
    init(taskId: String, apiClient: APIClientProtocol) {
        self.taskId = taskId
        self.apiClient = apiClient
    }
    
    func loadTask() async {
        isLoading = true
        errorMessage = nil
        do {
            async let taskResult = apiClient.getTaskDetails(id: taskId)
            async let eventsResult = apiClient.getTaskEvents(id: taskId)
            let (loadedTask, loadedEvents) = try await (taskResult, eventsResult)
            self.task = loadedTask
            self.events = loadedEvents.sorted { $0.timestamp > $1.timestamp }
        } catch {
            self.errorMessage = "Failed to load task details."
        }
        isLoading = false
    }
    
    func cancelTask() {
        Task {
            do {
                try await apiClient.cancelTask(id: taskId)
                await loadTask()
            } catch {
                self.errorMessage = "Failed to cancel task."
            }
        }
    }
}
