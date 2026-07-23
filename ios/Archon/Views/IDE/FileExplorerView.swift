import SwiftUI

struct FileExplorerView: View {
    @EnvironmentObject var ideManager: IDEManager

    var body: some View {
        List(ideManager.fileTree, children: \.children, selection: $ideManager.selectedFile) { node in
            NavigationLink(value: node) {
                HStack(spacing: 10) {
                    Image(systemName: node.type == .folder ? "folder.fill" : "doc.text")
                        .font(.subheadline)
                        .foregroundStyle(node.type == .folder ? IDETheme.warning : IDETheme.textSub)
                        .frame(width: 20)
                    Text(node.name)
                        .font(.subheadline)
                        .fontDesign(.rounded)
                        .foregroundStyle(
                            ideManager.selectedFile?.id == node.id
                                ? IDETheme.accent
                                : IDETheme.text
                        )
                        .lineLimit(1)
                }
                .frame(minHeight: 44)
            }
            .disabled(node.type == .folder)
            .listRowBackground(
                ideManager.selectedFile?.id == node.id
                    ? IDETheme.accentDim
                    : Color.clear
            )
        }
        .onChange(of: ideManager.selectedFile) { _, newValue in
            if let file = newValue, file.type == .file {
                if !ideManager.openFiles.contains(where: { $0.id == file.id }) {
                    ideManager.openFiles.append(file)
                }
            }
        }
        .navigationTitle("Explorer")
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        .background(IDETheme.surface)
    }
}
