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
                Spacer()
            }
            .padding()
            .background(Color(uiColor: .secondarySystemBackground))
            
            Divider()
            
            // Messages
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("How can I help you build this app?")
                        .padding(12)
                        .background(Color.teal.opacity(0.2))
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .padding(.horizontal)
                        .padding(.top, 16)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            
            Divider()
            
            // Input
            HStack {
                TextField("Ask Archon...", text: $inputText)
                    .textFieldStyle(.roundedBorder)
                
                Button(action: {
                    inputText = ""
                }) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.teal)
                }
            }
            .padding()
            .background(Color(uiColor: .systemBackground))
        }
    }
}
