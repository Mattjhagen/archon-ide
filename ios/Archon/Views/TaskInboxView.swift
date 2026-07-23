import SwiftUI

@MainActor
class TaskInboxViewModel: ObservableObject {
    @Published var activeTasks: [ArchonTask] = []
    @Published var needsAttentionTasks: [ArchonTask] = []
    @Published var recentTasks: [ArchonTask] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let apiClient: APIClientProtocol
    
    init(apiClient: APIClientProtocol = AuthenticatedAPIClient()) {
        self.apiClient = apiClient
    }
    
    func fetchTasks() async {
        isLoading = true
        errorMessage = nil
        do {
            let tasks = try await apiClient.fetchTasks()
            
            self.activeTasks = tasks.filter { $0.status == .planning || $0.status == .running || $0.status == .verifying || $0.status == .queued || $0.status == .cancelling }
            self.needsAttentionTasks = tasks.filter { $0.status == .blocked || $0.status == .failed }
            self.recentTasks = tasks.filter { $0.status == .completed || $0.status == .cancelled }
            
        } catch {
            self.errorMessage = "Failed to load tasks: \(error.localizedDescription)"
        }
        isLoading = false
    }
}

struct TaskInboxView: View {
    @StateObject private var viewModel = TaskInboxViewModel()
    
    var body: some View {
        NavigationStack {
            List {
                if let error = viewModel.errorMessage {
                    Text(error)
                        .foregroundStyle(.red)
                        .listRowBackground(Color.clear)
                }
                
                if !viewModel.activeTasks.isEmpty {
                    Section("Active") {
                        ForEach(viewModel.activeTasks) { task in
                            NavigationLink(destination: TaskDetailView(taskId: task.id)) {
                                TaskRowView(task: task)
                            }
                        }
                    }
                }
                
                if !viewModel.needsAttentionTasks.isEmpty {
                    Section("Needs Attention") {
                        ForEach(viewModel.needsAttentionTasks) { task in
                            NavigationLink(destination: TaskDetailView(taskId: task.id)) {
                                TaskRowView(task: task)
                            }
                        }
                    }
                }
                
                if !viewModel.recentTasks.isEmpty {
                    Section("Recent") {
                        ForEach(viewModel.recentTasks) { task in
                            NavigationLink(destination: TaskDetailView(taskId: task.id)) {
                                TaskRowView(task: task)
                            }
                        }
                    }
                }
                
                if viewModel.activeTasks.isEmpty && viewModel.needsAttentionTasks.isEmpty && viewModel.recentTasks.isEmpty && !viewModel.isLoading {
                    Text("No tasks found. Create one to get started.")
                        .foregroundStyle(.secondary)
                        .listRowBackground(Color.clear)
                }
            }
            .navigationTitle("Inbox")
            .refreshable {
                await viewModel.fetchTasks()
            }
            .task {
                await viewModel.fetchTasks()
            }
            .overlay {
                if viewModel.isLoading && viewModel.activeTasks.isEmpty {
                    ProgressView("Loading tasks...")
                }
            }
        }
    }
}
