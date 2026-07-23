import SwiftUI

struct FileExplorerView: View {
    @EnvironmentObject var ideManager: IDEManager
    
    var body: some View {
        List(ideManager.fileTree, children: \.children, selection: $ideManager.selectedFile) { node in
            NavigationLink(value: node) {
                HStack {
                    Image(systemName: node.type == .folder ? "folder.fill" : "doc.text")
                        .foregroundStyle(node.type == .folder ? .teal : .secondary)
                    Text(node.name)
                        .font(.subheadline)
                }
            }
            .disabled(node.type == .folder)
        }
        .onChange(of: ideManager.selectedFile) { oldValue, newValue in
            if let file = newValue, file.type == .file {
                if !ideManager.openFiles.contains(where: { $0.id == file.id }) {
                    ideManager.openFiles.append(file)
                }
            }
        }
        .navigationTitle("Explorer")
        .listStyle(.sidebar)
    }
}
