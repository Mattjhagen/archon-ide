import Foundation

class MockAPIClient: APIClientProtocol {
    var tasks: [ArchonTask] = [
        ArchonTask(id: "task-1", title: "Add dark mode toggle", status: .completed, provider: "Anthropic", model: "claude-3-5-sonnet", reasoningEffort: .medium, currentStep: 15, maxSteps: 15, creditsUsed: 120, creditLimit: 200, createdAt: Date().addingTimeInterval(-86400), updatedAt: Date().addingTimeInterval(-86000)),
        ArchonTask(id: "task-2", title: "Fix accessibility labels", status: .running, provider: "Anthropic", model: "claude-3-5-sonnet", reasoningEffort: .high, currentStep: 5, maxSteps: 40, creditsUsed: 45, creditLimit: 500, createdAt: Date(), updatedAt: Date())
    ]
    
    var events: [String: [TaskEvent]] = [
        "task-2": [
            TaskEvent(id: "evt-1", taskId: "task-2", sequence: 1, timestamp: Date().addingTimeInterval(-60), type: .planning, content: "Planning accessibility updates", metadata: nil),
            TaskEvent(id: "evt-2", taskId: "task-2", sequence: 2, timestamp: Date().addingTimeInterval(-30), type: .toolCall, content: "Searching for missing labels", metadata: ["tool": AnyCodable("grep_search")])
        ]
    ]
    
    func fetchTasks() async throws -> [ArchonTask] {
        return tasks
    }
    
    func getTaskDetails(id: String) async throws -> ArchonTask {
        guard let task = tasks.first(where: { $0.id == id }) else {
            throw APIError(message: "Task not found", code: 404)
        }
        return task
    }
    
    func getTaskEvents(id: String) async throws -> [TaskEvent] {
        return events[id] ?? []
    }
    
    func cancelTask(id: String) async throws {
        if let index = tasks.firstIndex(where: { $0.id == id }) {
            let oldTask = tasks[index]
            tasks[index] = ArchonTask(id: oldTask.id, title: oldTask.title, status: .cancelled, provider: oldTask.provider, model: oldTask.model, reasoningEffort: oldTask.reasoningEffort, currentStep: oldTask.currentStep, maxSteps: oldTask.maxSteps, creditsUsed: oldTask.creditsUsed, creditLimit: oldTask.creditLimit, createdAt: oldTask.createdAt, updatedAt: Date())
        }
    }
}
