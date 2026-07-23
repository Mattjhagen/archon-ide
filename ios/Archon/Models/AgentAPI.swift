import Foundation

struct ProviderMetadata: Codable, Identifiable {
    let id: String
    let name: String
    let models: [ModelMetadata]
    /// Whether the server has credentials configured for this provider.
    /// iOS never supplies provider keys, so only configured providers
    /// can run tasks started from this app.
    let configured: Bool?
    let requiresKey: Bool?
}

struct ModelMetadata: Codable {
    let id: String
    let name: String
}

enum ReasoningEffort: String, Codable {
    case low
    case medium
    case high
}

struct ArchonTask: Codable, Identifiable {
    let id: String
    let title: String
    let status: TaskStatus
    let provider: String
    let model: String
    let reasoningEffort: ReasoningEffort
    let currentStep: Int
    let maxSteps: Int
    let creditsUsed: Int
    let creditLimit: Int
    let createdAt: Date
    let updatedAt: Date
}

/// Body for POST /agent/tasks. Encoded with snake_case keys.
/// Deliberately has NO api_key field — provider credentials never
/// originate from this app.
struct CreateTaskRequest: Encodable {
    let title: String
    let request: String
    let provider: String
    let model: String
    let reasoningEffort: ReasoningEffort
    let workspacePath: String
}

struct APIError: Codable, LocalizedError {
    let message: String
    let code: Int?
    
    var errorDescription: String? {
        if let code = code {
            return "\(message) (HTTP \(code))"
        }
        return message
    }
}
