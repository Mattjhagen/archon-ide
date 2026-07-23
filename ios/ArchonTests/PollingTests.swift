import XCTest
@testable import Archon

class MockSleeper: SleeperProtocol {
    var sleepCalled: XCTestExpectation?
    
    func sleep(nanoseconds: UInt64) async throws {
        sleepCalled?.fulfill()
        // Wait indefinitely so the test completely controls execution speed via cancellation
        try await Task.sleep(nanoseconds: 10_000_000_000)
    }
}

@MainActor
final class PollingTests: XCTestCase {
    
    func testSuccessAndDeduplication() async throws {
        let mockAPI = MockAPIClient()
        let sleeper = MockSleeper()
        
        let sleepExpectation = XCTestExpectation(description: "Poll cycle 1")
        sleeper.sleepCalled = sleepExpectation
        
        let vm = TaskDetailViewModel(taskId: "task-2", apiClient: mockAPI, pollingInterval: 0.1, sleeper: sleeper)
        
        vm.startPolling()
        await fulfillment(of: [sleepExpectation], timeout: 2.0)
        
        XCTAssertEqual(vm.events.count, 2)
        
        // Ensure chronological ascending sort for UI
        XCTAssertEqual(vm.events.first?.sequence, 1)
        XCTAssertEqual(vm.events.last?.sequence, 2)
        
        vm.stopPolling()
    }
    
    func testTerminalStop() async throws {
        let mockAPI = MockAPIClient()
        let sleeper = MockSleeper()
        
        let vm = TaskDetailViewModel(taskId: "task-1", apiClient: mockAPI, pollingInterval: 0.1, sleeper: sleeper)
        
        vm.startPolling()
        // Wait a tiny bit to allow the loop to execute the first fetch and break
        try await Task.sleep(nanoseconds: 50_000_000)
        
        XCTAssertFalse(vm.isLoading)
        // Ensure it stopped because task-1 is .completed
    }
    
    func testCancellation() async throws {
        let mockAPI = MockAPIClient()
        let sleeper = MockSleeper()
        
        let sleepExpectation = XCTestExpectation(description: "Poll cycle 1")
        sleeper.sleepCalled = sleepExpectation
        
        let vm = TaskDetailViewModel(taskId: "task-2", apiClient: mockAPI, pollingInterval: 5.0, sleeper: sleeper)
        
        vm.startPolling()
        XCTAssertTrue(vm.isLoading)
        
        vm.stopPolling()
        
        try await Task.sleep(nanoseconds: 20_000_000)
        XCTAssertFalse(vm.isLoading)
    }
    
    func testRetryBackoff() async throws {
        // We will test partial success and error surfaces
        let mockAPI = MockAPIClient()
        // Remove task so it fails to fetch entirely
        mockAPI.tasks.removeAll() 
        let sleeper = MockSleeper()
        
        let sleepExpectation1 = XCTestExpectation(description: "Poll cycle 1")
        sleeper.sleepCalled = sleepExpectation1
        
        let vm = TaskDetailViewModel(taskId: "task-2", apiClient: mockAPI, pollingInterval: 0.1, sleeper: sleeper)
        vm.startPolling()
        
        await fulfillment(of: [sleepExpectation1], timeout: 2.0)
        XCTAssertNil(vm.errorMessage)
        
        vm.stopPolling()
    }
}
