import Foundation
import SwiftUI

protocol SleeperProtocol {
    func sleep(nanoseconds: UInt64) async throws
}

struct DefaultSleeper: SleeperProtocol {
    func sleep(nanoseconds: UInt64) async throws {
        try await Task.sleep(nanoseconds: nanoseconds)
    }
}

@MainActor
class TaskDetailViewModel: ObservableObject {
    @Published var task: ArchonTask?
    @Published var events: [TaskEvent] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let apiClient: APIClientProtocol
    private let taskId: String
    private let pollingInterval: TimeInterval
    private let sleeper: SleeperProtocol
    private var pollingTask: Task<Void, Never>?
    private var processedEventIds = Set<String>()
    
    private var currentTaskToken = UUID()
    
    init(taskId: String, apiClient: APIClientProtocol = AuthenticatedAPIClient(), pollingInterval: TimeInterval = 3.0, sleeper: SleeperProtocol = DefaultSleeper()) {
        self.taskId = taskId
        self.apiClient = apiClient
        self.pollingInterval = pollingInterval
        self.sleeper = sleeper
    }
    
    func startPolling() {
        guard pollingTask == nil else { return }
        
        isLoading = true
        errorMessage = nil
        
        let token = UUID()
        currentTaskToken = token
        
        pollingTask = Task { [weak self] in
            var consecutiveFailures = 0
            
            while !Task.isCancelled {
                guard let self = self, self.currentTaskToken == token else { break }
                
                let success = await self.fetchTaskDetails()
                
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
                if let status = self.task?.status, status == .completed || status == .failed || status == .cancelled || status == .blocked {
                    break
                }
                
                let sleepDuration = success ? self.pollingInterval : min(self.pollingInterval * pow(2.0, Double(consecutiveFailures)), 30.0)
                try? await self.sleeper.sleep(nanoseconds: UInt64(sleepDuration * 1_000_000_000))
            }
            if let self = self, self.currentTaskToken == token {
                self.isLoading = false
                self.pollingTask = nil
            }
        }
    }
    
    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
        currentTaskToken = UUID()
    }
    
    private func fetchTaskDetails() async -> Bool {
        var partialSuccess = false
        
        // 1. Fetch Task Status
        do {
            let fetchedTask = try await apiClient.getTaskDetails(id: taskId)
            if Task.isCancelled { return true }
            self.task = fetchedTask
            partialSuccess = true
        } catch {
            // Task fetch failed, but we will still try events if partialSuccess wasn't true?
            // Actually, if task fetch fails, it's a failure for this cycle.
        }
        
        // 2. Fetch Events
        do {
            let fetchedEvents = try await apiClient.getTaskEvents(id: taskId)
            if Task.isCancelled { return true }
            
            // Deduplicate and append events, preserving sequence order
            let sortedNewEvents = fetchedEvents.sorted(by: { $0.sequence < $1.sequence })
            for event in sortedNewEvents {
                if !processedEventIds.contains(event.id) {
                    processedEventIds.insert(event.id)
                    events.append(event)
                }
            }
            // Sort UI representation (ascending/oldest first for live timeline)
            self.events.sort(by: { $0.sequence < $1.sequence })
            
            return true
        } catch {
            return partialSuccess
        }
    }
    
    func cancelTask() async {
        do {
            try await apiClient.cancelTask(id: taskId)
            _ = await fetchTaskDetails()
        } catch {
            self.errorMessage = "Failed to cancel task: \(error.displayMessage)"
        }
    }
    
    deinit {
        pollingTask?.cancel()
    }
}
