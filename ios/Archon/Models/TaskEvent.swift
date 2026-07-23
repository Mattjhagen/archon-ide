import Foundation

struct TaskEvent: Codable, Identifiable {
    let id: String
    let taskId: String
    let timestamp: Date
    let type: EventType
    let content: String
    let metadata: [String: String]?
    
    enum EventType: String, Codable {
        case planning
        case modelCall
        case toolCall
        case toolResult
        case verification
        case completion
        case blocker
        case error
    }
}
