import XCTest
@testable import Archon

class MockSleeper: SleeperProtocol {
    func sleep(nanoseconds: UInt64) async throws {
        // Instant return for tests, no actual sleep blocking
        // We still yield to allow tasks to context switch
        await Task.yield()
    }
}

@MainActor
final class PollingTests: XCTestCase {
    
    func testSuccessAndDeduplication() async throws {
        let mockAPI = MockAPIClient()
        let vm = TaskDetailViewModel(taskId: "task-2", apiClient: mockAPI, pollingInterval: 0.1, sleeper: MockSleeper())
        
        vm.startPolling()
        
        // Wait a tiny bit of real time to let the loop spin at least once
        try await Task.sleep(nanoseconds: 50_000_000)
        
        XCTAssertEqual(vm.events.count, 2)
        XCTAssertFalse(vm.events.isEmpty)
        
        // Add duplicate event and a new one
        let newEvent = TaskEvent(id: "evt-3", taskId: "task-2", sequence: 3, timestamp: Date(), type: .modelCall, content: "New", metadata: nil)
        mockAPI.events["task-2"]?.append(contentsOf: [mockAPI.events["task-2"]![0], newEvent])
        
        try await Task.sleep(nanoseconds: 50_000_000)
        
        XCTAssertEqual(vm.events.count, 3, "Should have exactly 3 events, deduplicating the repeated evt-1")
        
        vm.stopPolling()
    }
    
    func testTerminalStop() async throws {
        let mockAPI = MockAPIClient()
        // Task-1 is already .completed
        let vm = TaskDetailViewModel(taskId: "task-1", apiClient: mockAPI, pollingInterval: 0.1, sleeper: MockSleeper())
        
        vm.startPolling()
        try await Task.sleep(nanoseconds: 50_000_000)
        
        // Because it was .completed, the polling task should have broken out of the loop and nilled out
        XCTAssertFalse(vm.isLoading)
    }
    
    func testCancellation() async throws {
        let mockAPI = MockAPIClient()
        let vm = TaskDetailViewModel(taskId: "task-2", apiClient: mockAPI, pollingInterval: 5.0, sleeper: MockSleeper())
        
        vm.startPolling()
        XCTAssertTrue(vm.isLoading)
        
        vm.stopPolling()
        
        // Let event loop run
        try await Task.sleep(nanoseconds: 20_000_000)
        XCTAssertFalse(vm.isLoading)
    }
}
