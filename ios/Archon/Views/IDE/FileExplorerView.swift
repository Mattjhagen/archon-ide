import SwiftUI

struct FileExplorerView: View {
    @EnvironmentObject var ideManager: IDEManager
    
    var body: some View {
        List(ideManager.fileTree, children: \.children) { node in
            HStack {
                Image(systemName: node.type == .folder ? "folder.fill" : "doc.text")
                    .foregroundStyle(node.type == .folder ? .teal : .secondary)
                Text(node.name)
            }
            .onTapGesture {
                if node.type == .file {
                    ideManager.selectFile(node)
                }
            }
        }
        .navigationTitle("Explorer")
    }
}
