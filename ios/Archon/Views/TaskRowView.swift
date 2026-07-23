import SwiftUI

struct TaskRowView: View {
    let task: ArchonTask
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(task.title)
                    .font(.headline)
                    .lineLimit(1)
                Spacer()
                statusBadge
            }
            
            HStack(spacing: 12) {
                Label("\(task.currentStep)/\(task.maxSteps) steps", systemImage: "arrow.triangle.branch")
                Label("\(task.creditsUsed) cr", systemImage: "bolt.fill")
                Spacer()
                Text(task.updatedAt, style: .relative)
                    .foregroundStyle(.secondary)
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(task.title). Status: \(task.status.rawValue). \(task.currentStep) out of \(task.maxSteps) steps. \(task.creditsUsed) credits used.")
    }
    
    @ViewBuilder
    private var statusBadge: some View {
        Text(task.status.rawValue.capitalized)
            .font(.caption2.bold())
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(badgeColor.opacity(0.2))
            .foregroundStyle(badgeColor)
            .clipShape(Capsule())
    }
    
    private var badgeColor: Color {
        switch task.status {
        case .completed: return .green
        case .running, .verifying, .planning: return .teal
        case .failed, .blocked: return .red
        case .queued: return .orange
        case .cancelling, .cancelled: return .gray
        }
    }
}
