import Foundation

struct TaskEvent: Codable, Identifiable {
    let id: String
    let taskId: String
    let sequence: Int
    let timestamp: Date
    let type: EventType
    let content: String
    let metadata: [String: AnyCodable]?
    
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
        case modelCall = "model_call"
        case toolCall = "tool_call"
        case toolResult = "tool_result"
        case verification
        case completion
        case blocker
        case error
        case fileEdit = "file_edit"
        
        var displayCategory: String {
            switch self {
            case .planning: return "Planning"
            case .modelCall: return "Thinking"
            case .toolCall: return "Using Tool"
            case .toolResult: return "Tool Output"
            case .verification: return "Verifying"
            case .completion: return "Finished"
            case .blocker: return "Blocked"
            case .error: return "Error"
            case .fileEdit: return "Editing File"
            }
        }
    }
}
