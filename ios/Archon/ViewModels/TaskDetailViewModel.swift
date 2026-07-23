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
    private let pollingInterval: TimeInterval
    private var pollingTask: Task<Void, Never>?
    private var processedEventIds = Set<String>()
    
    init(taskId: String, apiClient: APIClientProtocol = AuthenticatedAPIClient(), pollingInterval: TimeInterval = 3.0) {
        self.taskId = taskId
        self.apiClient = apiClient
        self.pollingInterval = pollingInterval
    }
    
    func startPolling() {
        guard pollingTask == nil else { return }
        
        isLoading = true
        errorMessage = nil
        
        pollingTask = Task {
            var consecutiveFailures = 0
            
            while !Task.isCancelled {
                let success = await fetchTaskDetails()
                
                if success {
                    consecutiveFailures = 0
                    self.errorMessage = nil
                } else {
                    consecutiveFailures += 1
                }
                
                if consecutiveFailures >= 3 {
                    self.errorMessage = "Lost connection to agent. Retrying in background..."
                }
                
                // If task is in a terminal state, stop polling
                if let status = task?.status, status == .completed || status == .failed || status == .cancelled || status == .blocked {
                    break
                }
                
                let sleepDuration = success ? pollingInterval : min(pollingInterval * pow(2.0, Double(consecutiveFailures)), 30.0)
                try? await Task.sleep(nanoseconds: UInt64(sleepDuration * 1_000_000_000))
            }
            self.isLoading = false
            self.pollingTask = nil
        }
    }
    
    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }
    
    private func fetchTaskDetails() async -> Bool {
        do {
            async let fetchedTask = apiClient.getTaskDetails(id: taskId)
            async let fetchedEvents = apiClient.getTaskEvents(id: taskId)
            
            let (newTask, newEvents) = try await (fetchedTask, fetchedEvents)
            
            if Task.isCancelled { return true }
            
            self.task = newTask
            
            // Deduplicate and append events, preserving sequence order
            let sortedNewEvents = newEvents.sorted(by: { $0.sequence < $1.sequence })
            for event in sortedNewEvents {
                if !processedEventIds.contains(event.id) {
                    processedEventIds.insert(event.id)
                    events.append(event)
                }
            }
            // Sort UI representation (newest first)
            self.events.sort(by: { $0.sequence > $1.sequence })
            
            return true
        } catch {
            return false
        }
    }
    
    func cancelTask() async {
        do {
            try await apiClient.cancelTask(id: taskId)
            _ = await fetchTaskDetails()
        } catch {
            self.errorMessage = "Failed to cancel task: \(error.localizedDescription)"
        }
    }
    
    deinit {
        pollingTask?.cancel()
    }
}
