import SwiftUI

struct CodeEditorView: View {
    @EnvironmentObject var ideManager: IDEManager

    var body: some View {
        if let selectedFile = ideManager.selectedFile {
            VStack(spacing: 0) {
                tabBar
                Divider().overlay(IDETheme.borderFaint)

                // UIKit-backed syntax editor; line-number gutter is drawn by
                // CodeTextView and scrolls with the text automatically.
                // The binding targets this file's node in the tree — each tab
                // reads and writes its own content.
                SyntaxEditorView(text: Binding(
                    get: {
                        ideManager.openFiles.first { $0.id == selectedFile.id }?.content
                            ?? selectedFile.content
                            ?? ""
                    },
                    set: { ideManager.updateFileContent(id: selectedFile.id, newContent: $0) }
                ), language: determineLanguage(filename: selectedFile.name))
            }
        } else {
            VStack(spacing: 16) {
                Image(systemName: "apple.terminal")
                    .font(.system(size: 48))
                    .foregroundStyle(IDETheme.textMuted)
                Text("Select a file to edit")
                    .font(.headline)
                    .fontDesign(.rounded)
                    .foregroundStyle(IDETheme.textSub)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(IDETheme.base)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("No file selected. Open the file explorer to choose a file.")
        }
    }

    // MARK: Tab bar

    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 4) {
                ForEach(ideManager.openFiles) { file in
                    editorTab(for: file)
                }
            }
            .padding(.horizontal, 8)
        }
        .frame(minHeight: 44)
        .background(IDETheme.surface)
    }

    private func editorTab(for file: FileNode) -> some View {
        let isActive = ideManager.selectedFile?.id == file.id
        return HStack(spacing: 6) {
            Image(systemName: file.iconName)
                .font(.caption2)
                .foregroundStyle(file.iconColor)

            Text(file.name)
                .font(.caption.bold())
                .fontDesign(.rounded)
                .foregroundStyle(isActive ? IDETheme.text : IDETheme.textSub)
                .lineLimit(1)

            Button {
                ideManager.closeFile(id: file.id)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .heavy))
                    .foregroundStyle(IDETheme.textMuted)
                    .frame(width: 24, height: 24)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("Close \(file.name)")
        }
        .padding(.leading, 12)
        .padding(.trailing, 4)
        .frame(minHeight: 36)
        .background(isActive ? IDETheme.elevated : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(alignment: .bottom) {
            if isActive {
                Rectangle()
                    .fill(IDETheme.accent)
                    .frame(height: 2)
                    .padding(.horizontal, 8)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            ideManager.selectFile(file)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(file.name), tab\(isActive ? ", selected" : "")")
        .accessibilityAddTraits(isActive ? [.isSelected] : [])
    }

    private func determineLanguage(filename: String) -> SyntaxEditorView.Language {
        if filename.hasSuffix(".swift") { return .swift }
        if filename.hasSuffix(".js") || filename.hasSuffix(".ts") { return .javascript }
        if filename.hasSuffix(".html") { return .html }
        return .swift
    }
}
