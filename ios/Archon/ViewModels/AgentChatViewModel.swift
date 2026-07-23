import Foundation
import Combine

/// Drives AgentChatView from real backend task state.
///
/// Composes TaskDetailViewModel for polling (backoff + event
/// deduplication live there) and adds task discovery, provider
/// selection, and task creation. Every activity indicator shown in
/// the chat UI originates from a backend TaskStatus or TaskEvent —
/// nothing here simulates agent activity.
@MainActor
final class AgentChatViewModel: ObservableObject {

    @Published private(set) var task: ArchonTask?
    @Published private(set) var events: [TaskEvent] = []
    @Published private(set) var providers: [ProviderMetadata] = []
    @Published var selectedProviderId: String?
    @Published var selectedModelId: String?
    @Published private(set) var isLoading = false
    @Published private(set) var isSubmitting = false
    @Published var errorMessage: String?

    private let apiClient: APIClientProtocol
    private var detail: TaskDetailViewModel?
    private var detailSubscriptions = Set<AnyCancellable>()

    init(apiClient: APIClientProtocol = AuthenticatedAPIClient()) {
        self.apiClient = apiClient
    }

    /// Providers the app can actually start tasks with. iOS never
    /// supplies provider keys, so unconfigured providers are excluded.
    var usableProviders: [ProviderMetadata] {
        providers.filter { $0.configured ?? false }
    }

    var selectedProvider: ProviderMetadata? {
        usableProviders.first { $0.id == selectedProviderId }
    }

    var isTaskActive: Bool {
        guard let status = task?.status else { return false }
        switch status {
        case .queued, .planning, .running, .verifying, .cancelling:
            return true
        case .completed, .blocked, .failed, .cancelled:
            return false
        }
    }

    // MARK: Lifecycle

    func loadInitialState() async {
        isLoading = true
        defer { isLoading = false }

        async let providersReq = apiClient.fetchProviders()
        async let tasksReq = apiClient.fetchTasks()

        do {
            let fetched = try await providersReq
            providers = fetched
            if selectedProviderId == nil,
               let first = fetched.first(where: { $0.configured ?? false }) {
                selectedProviderId = first.id
                selectedModelId = first.models.first?.id
            }
        } catch {
            errorMessage = "Could not load providers: \(error.localizedDescription)"
        }

        do {
            let tasks = try await tasksReq
            // Resume the most recently updated task so history is visible;
            // polling stops on its own if it is already terminal.
            if let latest = tasks.max(by: { $0.updatedAt < $1.updatedAt }) {
                attach(taskId: latest.id)
            }
        } catch {
            errorMessage = "Could not load tasks: \(error.localizedDescription)"
        }
    }

    func stop() {
        detail?.stopPolling()
    }

    // MARK: Task creation

    func send(request text: String, workspacePath: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard let providerId = selectedProviderId, let modelId = selectedModelId else {
            errorMessage = "Select a provider and model first."
            return
        }
        let workspace = workspacePath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !workspace.isEmpty else {
            errorMessage = "Set a workspace path before starting a task."
            return
        }

        isSubmitting = true
        defer { isSubmitting = false }

        let title = String(trimmed.split(separator: "\n").first ?? "").prefix(200)
        do {
            let created = try await apiClient.createTask(CreateTaskRequest(
                title: String(title),
                request: trimmed,
                provider: providerId,
                model: modelId,
                reasoningEffort: .medium,
                workspacePath: workspace
            ))
            errorMessage = nil
            attach(taskId: created.id)
        } catch let apiError as APIError {
            errorMessage = apiError.message
        } catch {
            errorMessage = "Could not start task: \(error.localizedDescription)"
        }
    }

    func cancelActiveTask() async {
        await detail?.cancelTask()
    }

    // MARK: Polling composition

    private func attach(taskId: String) {
        detail?.stopPolling()
        detailSubscriptions.removeAll()

        let vm = TaskDetailViewModel(taskId: taskId, apiClient: apiClient)
        detail = vm

        vm.$task
            .sink { [weak self] in self?.task = $0 }
            .store(in: &detailSubscriptions)
        vm.$events
            .sink { [weak self] in self?.events = $0 }
            .store(in: &detailSubscriptions)
        vm.$errorMessage
            .compactMap { $0 }
            .sink { [weak self] in self?.errorMessage = $0 }
            .store(in: &detailSubscriptions)

        vm.startPolling()
    }
}
