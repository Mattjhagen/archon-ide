import Foundation
import SwiftUI

@MainActor
class TaskDetailViewModel: ObservableObject {
    @Published var task: ArchonTask?
    @Published var events: [TaskEvent] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let apiClient: APIClientProtocol
    private let taskId: String
    private var pollingTask: Task<Void, Never>?
    
    init(taskId: String, apiClient: APIClientProtocol = AuthenticatedAPIClient()) {
        self.taskId = taskId
        self.apiClient = apiClient
    }
    
    func startPolling() {
        isLoading = true
        pollingTask?.cancel()
        
        pollingTask = Task {
            while !Task.isCancelled {
                await fetchTaskDetails()
                
                // If task is in a terminal state, stop polling
                if let status = task?.status, status == .completed || status == .failed || status == .cancelled {
                    break
                }
                
                // Poll every 3 seconds
                try? await Task.sleep(nanoseconds: 3_000_000_000)
            }
        }
    }
    
    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }
    
    private func fetchTaskDetails() async {
        do {
            async let fetchedTask = apiClient.getTaskDetails(id: taskId)
            async let fetchedEvents = apiClient.getTaskEvents(id: taskId)
            
            let (newTask, newEvents) = try await (fetchedTask, fetchedEvents)
            
            self.task = newTask
            self.events = newEvents.sorted(by: { $0.timestamp > $1.timestamp }) // Newest first
            self.errorMessage = nil
        } catch {
            self.errorMessage = "Failed to sync task: \(error.localizedDescription)"
        }
        self.isLoading = false
    }
    
    func cancelTask() async {
        do {
            try await apiClient.cancelTask(id: taskId)
            await fetchTaskDetails()
        } catch {
            self.errorMessage = "Failed to cancel task: \(error.localizedDescription)"
        }
    }
    
    deinit {
        pollingTask?.cancel()
    }
}
