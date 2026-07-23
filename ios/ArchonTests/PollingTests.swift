import XCTest
@testable import Archon

@MainActor
final class PollingTests: XCTestCase {
    
    func testSuccessAndDeduplication() async throws {
        let mockAPI = MockAPIClient()
        let vm = TaskDetailViewModel(taskId: "task-2", apiClient: mockAPI, pollingInterval: 0.1)
        
        vm.startPolling()
        
        // Wait for first poll
        try await Task.sleep(nanoseconds: 150_000_000)
        
        XCTAssertEqual(vm.events.count, 2)
        XCTAssertFalse(vm.events.isEmpty)
        
        // Add duplicate event and a new one
        let newEvent = TaskEvent(id: "evt-3", taskId: "task-2", sequence: 3, timestamp: Date(), type: .modelCall, content: "New", metadata: nil)
        mockAPI.events["task-2"]?.append(contentsOf: [mockAPI.events["task-2"]![0], newEvent])
        
        // Wait for second poll
        try await Task.sleep(nanoseconds: 150_000_000)
        
        XCTAssertEqual(vm.events.count, 3, "Should have exactly 3 events, deduplicating the repeated evt-1")
        
        vm.stopPolling()
    }
    
    func testTerminalStop() async throws {
        let mockAPI = MockAPIClient()
        // Task-1 is already .completed
        let vm = TaskDetailViewModel(taskId: "task-1", apiClient: mockAPI, pollingInterval: 0.1)
        
        vm.startPolling()
        try await Task.sleep(nanoseconds: 150_000_000)
        
        // Because it was .completed, the polling task should have broken out of the loop and nilled out
        XCTAssertFalse(vm.isLoading)
    }
    
    func testCancellation() async throws {
        let mockAPI = MockAPIClient()
        let vm = TaskDetailViewModel(taskId: "task-2", apiClient: mockAPI, pollingInterval: 5.0)
        
        vm.startPolling()
        XCTAssertTrue(vm.isLoading)
        
        vm.stopPolling()
        
        // Let event loop run
        try await Task.sleep(nanoseconds: 50_000_000)
        XCTAssertFalse(vm.isLoading)
    }
}
