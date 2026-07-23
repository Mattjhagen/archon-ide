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

/// Backend error envelope. The Rust routes emit `{"error": "..."}`;
/// some layers emit `{"message": "...", "code": ...}`. Decodes both,
/// preferring `message` when both keys are present.
struct APIError: Codable, LocalizedError {
    let message: String
    let code: Int?

    init(message: String, code: Int?) {
        self.message = message
        self.code = code
    }

    private enum CodingKeys: String, CodingKey {
        case message
        case error
        case code
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let value = try container.decodeIfPresent(String.self, forKey: .message) {
            message = value
        } else if let value = try container.decodeIfPresent(String.self, forKey: .error) {
            message = value
        } else {
            throw DecodingError.keyNotFound(
                CodingKeys.message,
                DecodingError.Context(
                    codingPath: decoder.codingPath,
                    debugDescription: "Expected either 'message' or 'error' key"
                )
            )
        }
        code = try container.decodeIfPresent(Int.self, forKey: .code)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(message, forKey: .message)
        try container.encodeIfPresent(code, forKey: .code)
    }

    var errorDescription: String? {
        if let code {
            return "\(message) (HTTP \(code))"
        }
        return message
    }
}
