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
                        .fontDesign(.rounded)
                        .foregroundStyle(IDETheme.text)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(IDETheme.elevated)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .overlay(alignment: .bottom) {
                            Rectangle()
                                .fill(IDETheme.accent)
                                .frame(height: 2)
                                .clipShape(RoundedRectangle(cornerRadius: 1))
                        }
                    Spacer()
                }
                .padding(8)
                .background(IDETheme.surface)

                Divider().overlay(IDETheme.borderFaint)

                // Editor (UIKit-backed syntax highlighting with synced gutter)
                SyntaxEditorView(text: Binding(
                    get: { selectedFile.content ?? "" },
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

    private func determineLanguage(filename: String) -> SyntaxEditorView.Language {
        if filename.hasSuffix(".swift") { return .swift }
        if filename.hasSuffix(".js") || filename.hasSuffix(".ts") { return .javascript }
        if filename.hasSuffix(".html") { return .html }
        return .swift
    }
}
