import SwiftUI

struct CodeEditorView: View {
    @EnvironmentObject var ideManager: IDEManager
    
    var body: some View {
        if let selectedFile = ideManager.selectedFile {
            VStack(spacing: 0) {
                // Tab bar
                HStack {
                    Text(selectedFile.name)
                        .font(.caption.bold())
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Color(uiColor: .secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    Spacer()
                }
                .padding(8)
                .background(Color(uiColor: .systemBackground))
                
                Divider()
                
                // Editor
                TextEditor(text: Binding(
                    get: { selectedFile.content ?? "" },
                    set: { ideManager.updateFileContent(id: selectedFile.id, newContent: $0) }
                ))
                .font(.system(.body, design: .monospaced))
                .scrollContentBackground(.hidden)
                .background(Color(uiColor: .systemBackground))
            }
        } else {
            VStack(spacing: 16) {
                Image(systemName: "apple.terminal")
                    .font(.system(size: 48))
                    .foregroundStyle(.tertiary)
                Text("Select a file to edit")
                    .font(.headline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(uiColor: .systemGroupedBackground))
        }
    }
}
