import SwiftUI

struct AgentChatView: View {
    @EnvironmentObject var ideManager: IDEManager
    @State private var inputText = ""

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Archon")
                    .font(.headline)
                    .fontDesign(.rounded)
                    .foregroundStyle(IDETheme.text)
                Spacer()
            }
            .padding()
            .background(IDETheme.surface)

            Divider().overlay(IDETheme.borderFaint)

            // Messages
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("How can I help you build this app?")
                        .font(.callout)
                        .fontDesign(.rounded)
                        .foregroundStyle(IDETheme.text)
                        .padding(12)
                        .background(IDETheme.accentDim)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .padding(.horizontal)
                        .padding(.top, 16)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(IDETheme.base)

            Divider().overlay(IDETheme.borderFaint)

            // Input
            HStack(spacing: 8) {
                TextField("Ask Archon...", text: $inputText)
                    .font(.callout)
                    .fontDesign(.rounded)
                    .foregroundStyle(IDETheme.text)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(IDETheme.elevated)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                Button(action: {
                    inputText = ""
                }) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundStyle(IDETheme.accent)
                }
                .accessibilityLabel("Send message")
                .ideTouchTarget()
            }
            .padding()
            .background(IDETheme.surface)
        }
        .background(IDETheme.base)
    }
}
