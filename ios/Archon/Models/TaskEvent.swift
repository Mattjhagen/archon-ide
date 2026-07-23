import Foundation

struct TaskEvent: Codable, Identifiable {
    let id: String
    let taskId: String
    let sequence: Int
    let timestamp: Date
    let type: EventType
    let content: String
    let metadata: [String: String]?
    
    enum CodingKeys: String, CodingKey {
        case id
        case taskId
        case sequence
        case timestamp = "createdAt"
        case type = "kind"
        case content = "summary"
        case metadata
    }
    
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
