import Foundation

enum TaskStatus: String, Codable, CaseIterable {
    case queued
    case planning
    case running
    case verifying
    case completed
    case blocked
    case failed
    case cancelling
    case cancelled
}
