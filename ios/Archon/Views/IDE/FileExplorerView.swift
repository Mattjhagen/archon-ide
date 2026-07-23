import SwiftUI

struct FileExplorerView: View {
    @EnvironmentObject var ideManager: IDEManager

    var body: some View {
        List(ideManager.fileTree, children: \.children, selection: $ideManager.selectedFile) { node in
            NavigationLink(value: node) {
                HStack(spacing: 10) {
                    Image(systemName: node.iconName)
                        .font(.subheadline)
                        .foregroundStyle(node.iconColor)
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
                .accessibilityElement(children: .combine)
                .accessibilityLabel(
                    node.type == .folder ? "Folder, \(node.name)" : "File, \(node.name)"
                )
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
