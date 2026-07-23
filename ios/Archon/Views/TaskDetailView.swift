import SwiftUI

struct TaskDetailView: View {
    @StateObject private var viewModel: TaskDetailViewModel
    
    init(taskId: String) {
        _viewModel = StateObject(wrappedValue: TaskDetailViewModel(taskId: taskId))
    }
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if let error = viewModel.errorMessage {
                    Text(error)
                        .foregroundStyle(.red)
                        .padding()
                        .background(Color.red.opacity(0.1))
                        .cornerRadius(8)
                }
                
                if let task = viewModel.task {
                    headerSection(task: task)
                    
                    Divider()
                    
                    EventTimelineView(events: viewModel.events)
                } else if viewModel.isLoading {
                    ProgressView("Loading task details...")
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 40)
                }
            }
            .padding()
        }
        .navigationTitle("Task Details")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let status = viewModel.task?.status, status == .running || status == .planning {
                ToolbarItem(placement: .destructiveAction) {
                    Button(role: .destructive, action: {
                        Task { await viewModel.cancelTask() }
                    }) {
                        Text("Cancel Task")
                    }
                }
            }
        }
        .onAppear {
            viewModel.startPolling()
        }
        .onDisappear {
            viewModel.stopPolling()
        }
    }
    
    @ViewBuilder
    private func headerSection(task: ArchonTask) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(task.title)
                .font(.title2.bold())
            
            Text(task.description)
                .font(.body)
                .foregroundStyle(.secondary)
            
            HStack(spacing: 16) {
                Label("\(task.currentStep)/\(task.maxSteps)", systemImage: "arrow.triangle.branch")
                Label("\(task.creditsUsed) cr", systemImage: "bolt.fill")
                Text(task.status.rawValue.capitalized)
                    .font(.caption.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.teal.opacity(0.2))
                    .foregroundStyle(.teal)
                    .clipShape(Capsule())
            }
            .font(.subheadline)
            .padding(.top, 8)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(task.title). Status: \(task.status.rawValue). \(task.currentStep) out of \(task.maxSteps) steps.")
    }
}
