import Foundation

struct ProviderMetadata: Codable {
    let id: String
    let name: String
    let models: [ModelMetadata]
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
    let creditsLimit: Int
    let createdAt: Date
    let updatedAt: Date
}

struct APIError: Codable, Error {
    let message: String
    let code: Int?
}
