import SwiftUI

struct IDEView: View {
    @StateObject private var ideManager = IDEManager()
    @SwiftUI.Environment(\.horizontalSizeClass) private var hSizeClass

    @State private var showExplorerSheet = false
    @State private var showAgentSheet = false

    var body: some View {
        Group {
            if hSizeClass == .regular {
                splitLayout
            } else {
                compactLayout
            }
        }
        .environmentObject(ideManager)
        .tint(IDETheme.accent)
        .preferredColorScheme(.dark)
    }

    // MARK: - iPad: three-column split

    private var splitLayout: some View {
        NavigationSplitView {
            FileExplorerView()
                .navigationSplitViewColumnWidth(min: 200, ideal: 260, max: 340)
                .toolbarBackground(IDETheme.surface, for: .navigationBar)
        } content: {
            editorColumn
                .navigationSplitViewColumnWidth(min: 360, ideal: 640, max: .infinity)
        } detail: {
            AgentChatView()
                .navigationSplitViewColumnWidth(min: 300, ideal: 380, max: 480)
        }
        .navigationSplitViewStyle(.balanced)
        .background(IDETheme.base)
    }

    // MARK: - iPhone: stack + sheets

    private var compactLayout: some View {
        NavigationStack {
            editorColumn
                .navigationBarTitleDisplayMode(.inline)
                .toolbarBackground(IDETheme.surface, for: .navigationBar)
                .toolbarBackground(.visible, for: .navigationBar)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            showExplorerSheet = true
                        } label: {
                            Image(systemName: "sidebar.left")
                        }
                        .accessibilityLabel("Show file explorer")
                        .ideTouchTarget()
                    }
                    ToolbarItem(placement: .principal) {
                        compactTitle
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            showAgentSheet = true
                        } label: {
                            Label("Agent", systemImage: "sparkles")
                                .labelStyle(.titleAndIcon)
                                .font(.subheadline.weight(.semibold))
                                .fontDesign(.rounded)
                        }
                        .accessibilityLabel("Show agent panel")
                        .ideTouchTarget()
                    }
                }
        }
        .sheet(isPresented: $showExplorerSheet) {
            NavigationStack {
                FileExplorerView()
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Done") { showExplorerSheet = false }
                        }
                    }
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .preferredColorScheme(.dark)
            .tint(IDETheme.accent)
        }
        .sheet(isPresented: $showAgentSheet) {
            AgentChatView()
                .presentationDetents([.height(380), .large])
                .presentationDragIndicator(.visible)
                .presentationBackgroundInteraction(.enabled(upThrough: .height(380)))
                .presentationCornerRadius(20)
                .preferredColorScheme(.dark)
                .tint(IDETheme.accent)
        }
        .onChange(of: ideManager.selectedFile) { _, newValue in
            // Selecting a file from the explorer sheet should reveal the editor.
            if newValue != nil { showExplorerSheet = false }
        }
    }

    private var compactTitle: some View {
        Text(ideManager.selectedFile?.name ?? "Archon")
            .font(.subheadline.weight(.semibold))
            .fontDesign(.rounded)
            .foregroundStyle(IDETheme.text)
            .lineLimit(1)
            .accessibilityAddTraits(.isHeader)
    }

    // MARK: - Editor column (shared)

    private var editorColumn: some View {
        GeometryReader { geo in
            VStack(spacing: 0) {
                CodeEditorView()
                    .frame(maxHeight: isPreviewableFileSelected
                           ? geo.size.height * 0.6
                           : .infinity)

                if isPreviewableFileSelected {
                    Divider().overlay(IDETheme.border)
                    PreviewPaneView(htmlContent: ideManager.selectedFile?.content ?? "")
                        .accessibilityLabel("Live HTML preview")
                }
            }
        }
        .background(IDETheme.base)
    }

    private var isPreviewableFileSelected: Bool {
        ideManager.selectedFile?.name.hasSuffix(".html") == true
    }
}
