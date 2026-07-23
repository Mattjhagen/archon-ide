import SwiftUI

struct EventTimelineView: View {
    let events: [TaskEvent]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Activity")
                .font(.headline)
                .padding(.bottom, 16)
            
            if events.isEmpty {
                Text("No activity yet.")
                    .foregroundStyle(.secondary)
                    .font(.subheadline)
            } else {
                ForEach(Array(events.enumerated()), id: \.element.id) { index, event in
                    timelineRow(event: event, isLast: index == events.count - 1)
                }
            }
        }
    }
    
    @ViewBuilder
    private func timelineRow(event: TaskEvent, isLast: Bool) -> some View {
        HStack(alignment: .top, spacing: 16) {
            // Timeline line and dot
            VStack {
                Circle()
                    .fill(Color.teal)
                    .frame(width: 10, height: 10)
                    .padding(.top, 6)
                
                if !isLast {
                    Rectangle()
                        .fill(Color.teal.opacity(0.3))
                        .frame(width: 2)
                }
            }
            
            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text(event.content)
                    .font(.subheadline)
                
                Text(event.timestamp, style: .relative)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, 24)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(event.content). \(event.timestamp.formatted(date: .abbreviated, time: .shortened)).")
    }
}
