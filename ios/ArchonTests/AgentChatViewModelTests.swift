import XCTest
import Combine
@testable import Archon

// MARK: - Test doubles (no network, no real-time delays)

/// Fully controllable API double. Unlike MockAPIClient (demo data for
/// previews), this starts empty so each test states its own fixtures.
final class SpyAPIClient: APIClientProtocol {
    var providers: [ProviderMetadata] = []
    var tasks: [ArchonTask] = []
    var eventsByTaskId: [String: [TaskEvent]] = [:]
    var createTaskError: APIError?
    var plainCreateTaskError: Error?

    private(set) var createdRequests: [CreateTaskRequest] = []
    private(set) var taskDetailFetchCount = 0
    var onEventsFetched: (() -> Void)?

    func fetchTasks() async throws -> [ArchonTask] { tasks }

    func getTaskDetails(id: String) async throws -> ArchonTask {
        taskDetailFetchCount += 1
        guard let task = tasks.first(where: { $0.id == id }) else {
            throw APIError(message: "task not found", code: 404)
        }
        return task
    }

    func getTaskEvents(id: String) async throws -> [TaskEvent] {
        defer { onEventsFetched?() }
        return eventsByTaskId[id] ?? []
    }

    func cancelTask(id: String) async throws {}

    func fetchProviders() async throws -> [ProviderMetadata] { providers }

    func createTask(_ request: CreateTaskRequest) async throws -> ArchonTask {
        if let error = createTaskError { throw error }
        if let error = plainCreateTaskError { throw error }
        createdRequests.append(request)
        let task = ArchonTask(
            id: "spy-task-\(createdRequests.count)",
            title: request.title,
            status: .queued,
            provider: request.provider,
            model: request.model,
            reasoningEffort: request.reasoningEffort,
            currentStep: 0,
            maxSteps: 40,
            creditsUsed: 0,
            creditLimit: 500,
            createdAt: Date(),
            updatedAt: Date()
        )
        tasks.append(task)
        return task
    }
}

/// Sleeper that never actually elapses: it counts calls and then
/// suspends on an effectively-infinite, cancellation-aware sleep.
/// Tests control execution entirely through expectations and yields.
final class HangSleeper: SleeperProtocol {
    private(set) var sleepCount = 0

    func sleep(nanoseconds: UInt64) async throws {
        sleepCount += 1
        try await Task.sleep(nanoseconds: 3_600_000_000_000)
    }
}

// MARK: - Fixtures

private func provider(id: String, configured: Bool?) -> ProviderMetadata {
    ProviderMetadata(
        id: id,
        name: id,
        models: [ModelMetadata(id: "\(id)-model", name: "\(id) model")],
        configured: configured,
        requiresKey: true
    )
}

private func terminalTask(id: String, status: TaskStatus) -> ArchonTask {
    ArchonTask(
        id: id, title: "t", status: status, provider: "p", model: "m",
        reasoningEffort: .medium, currentStep: 1, maxSteps: 1,
        creditsUsed: 1, creditLimit: 10, createdAt: Date(), updatedAt: Date()
    )
}

// MARK: - Tests

@MainActor
final class AgentChatViewModelTests: XCTestCase {

    // D-1: only server-configured providers are usable/selectable.
    func testUsableProvidersFilterToConfiguredOnly() async {
        let spy = SpyAPIClient()
        spy.providers = [
            provider(id: "configured", configured: true),
            provider(id: "unconfigured", configured: false),
            provider(id: "unknown", configured: nil),
        ]
        let vm = AgentChatViewModel(apiClient: spy, sleeper: HangSleeper())

        await vm.loadInitialState()

        XCTAssertEqual(vm.usableProviders.map(\.id), ["configured"])
        XCTAssertEqual(vm.selectedProviderId, "configured")
        XCTAssertEqual(vm.selectedModelId, "configured-model")
    }

    // D-2: the task-creation payload can never carry a provider key.
    func testCreateTaskPayloadHasNoAPIKey() async throws {
        let request = CreateTaskRequest(
            title: "t", request: "r", provider: "p", model: "m",
            reasoningEffort: .medium, workspacePath: "/srv/ws"
        )

        // Struct level: no property that even resembles a credential.
        let labels = Mirror(reflecting: request).children.compactMap(\.label)
        XCTAssertFalse(
            labels.contains { $0.lowercased().contains("key") || $0.lowercased().contains("secret") },
            "CreateTaskRequest must not carry credential fields"
        )

        // Wire level: exactly the expected snake_case keys, nothing more.
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let json = try XCTUnwrap(
            try JSONSerialization.jsonObject(with: encoder.encode(request)) as? [String: Any]
        )
        XCTAssertEqual(
            Set(json.keys),
            ["title", "request", "provider", "model", "reasoning_effort", "workspace_path"]
        )
        XCTAssertNil(json["api_key"])

        // End to end: send() forwards through the client unchanged.
        let spy = SpyAPIClient()
        spy.providers = [provider(id: "p", configured: true)]
        let vm = AgentChatViewModel(apiClient: spy, sleeper: HangSleeper())
        await vm.loadInitialState()
        await vm.send(request: "do the thing", workspacePath: "/srv/ws")
        XCTAssertEqual(spy.createdRequests.count, 1)
        vm.stop()
    }

    // D-3: backend error bodies surface verbatim with their HTTP code.
    func testBackendErrorBodyIsDisplayed() async {
        let spy = SpyAPIClient()
        spy.providers = [provider(id: "p", configured: true)]
        spy.createTaskError = APIError(message: "workspace_path is required", code: 400)
        let vm = AgentChatViewModel(apiClient: spy, sleeper: HangSleeper())

        await vm.loadInitialState()
        await vm.send(request: "do the thing", workspacePath: "/srv/ws")

        XCTAssertEqual(vm.errorMessage, "workspace_path is required (HTTP 400)")
        XCTAssertTrue(spy.createdRequests.isEmpty)
    }

    // Raw Swift error type names (e.g. "Archon.APIError error 1")
    // must never reach the user, even for errors we don't recognize.
    func testRawSwiftErrorNamesNeverSurface() async {
        enum BareError: Error { case boom }

        let spy = SpyAPIClient()
        spy.providers = [provider(id: "p", configured: true)]
        spy.plainCreateTaskError = BareError.boom
        let vm = AgentChatViewModel(apiClient: spy, sleeper: HangSleeper())

        await vm.loadInitialState()
        await vm.send(request: "do the thing", workspacePath: "/srv/ws")

        let message = vm.errorMessage ?? ""
        XCTAssertFalse(message.isEmpty)
        XCTAssertFalse(message.contains("BareError"))
        XCTAssertFalse(message.contains("Archon."))
        XCTAssertFalse(message.contains("error 1"))
        XCTAssertEqual(message, "Something went wrong. Please try again.")
    }

    // D-4: a terminal task state ends polling after a single fetch —
    // the loop must break before it ever reaches the sleeper.
    func testTerminalTaskStateStopsPolling() async {
        for status in [TaskStatus.completed, .failed, .cancelled, .blocked] {
            let spy = SpyAPIClient()
            spy.tasks = [terminalTask(id: "done", status: status)]
            let sleeper = HangSleeper()
            let vm = TaskDetailViewModel(taskId: "done", apiClient: spy, sleeper: sleeper)

            let fetched = expectation(description: "events fetched for \(status)")
            spy.onEventsFetched = { fetched.fulfill() }

            vm.startPolling()
            await fulfillment(of: [fetched], timeout: 2.0)
            for _ in 0..<25 { await Task.yield() }

            XCTAssertEqual(sleeper.sleepCount, 0, "\(status): loop slept instead of stopping")
            XCTAssertEqual(spy.taskDetailFetchCount, 1, "\(status): polled again after terminal state")
            XCTAssertFalse(vm.isLoading, "\(status): still marked loading")
        }
    }

    // D-5: the UI never invents assistant/progress messages — every
    // event shown comes from the backend, and the backend returned none.
    func testNoFabricatedMessagesAppear() async {
        let spy = SpyAPIClient()
        spy.providers = [provider(id: "p", configured: true)]
        let vm = AgentChatViewModel(apiClient: spy, sleeper: HangSleeper())

        await vm.loadInitialState()
        XCTAssertTrue(vm.events.isEmpty)
        XCTAssertNil(vm.task)

        let fetched = expectation(description: "first poll after creation")
        spy.onEventsFetched = { fetched.fulfill() }

        await vm.send(request: "Build the feature", workspacePath: "/srv/ws")
        await fulfillment(of: [fetched], timeout: 2.0)
        for _ in 0..<25 { await Task.yield() }

        // The backend has emitted no events, so the chat must show none —
        // no synthetic greeting, no fake "thinking" placeholder.
        XCTAssertTrue(vm.events.isEmpty)
        // Task state mirrors exactly what the backend returned.
        XCTAssertEqual(vm.task?.status, .queued)
        vm.stop()
    }
}
