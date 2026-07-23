import SwiftUI

struct IDEView: View {
    @StateObject private var ideManager = IDEManager()
    @SwiftUI.Environment(\.horizontalSizeClass) private var hSizeClass

    @State private var showExplorerSheet = false
    @State private var showAgentSheet = false
    @State private var showPreviewCover = false
    @State private var agentDetent: PresentationDetent = .medium

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

    // MARK: - iPad: three-column split (unchanged layout)

    private var splitLayout: some View {
        NavigationSplitView {
            FileExplorerView()
                .navigationSplitViewColumnWidth(min: 200, ideal: 260, max: 340)
                .toolbarBackground(IDETheme.surface, for: .navigationBar)
        } content: {
            splitEditorColumn
                .navigationSplitViewColumnWidth(min: 360, ideal: 640, max: .infinity)
        } detail: {
            AgentChatView()
                .navigationSplitViewColumnWidth(min: 300, ideal: 380, max: 480)
        }
        .navigationSplitViewStyle(.balanced)
        .background(IDETheme.base)
    }

    /// iPad only: editor above an inline HTML preview.
    private var splitEditorColumn: some View {
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

    // MARK: - iPhone: full-screen editor + adaptive sheets

    private var compactLayout: some View {
        NavigationStack {
            // Editor owns the whole screen; preview is an explicit
            // destination rather than a split that steals height.
            CodeEditorView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(IDETheme.base)
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
                        HStack(spacing: 0) {
                            if isPreviewableFileSelected {
                                Button {
                                    showPreviewCover = true
                                } label: {
                                    Image(systemName: "play.rectangle")
                                }
                                .accessibilityLabel("Preview HTML")
                                .ideTouchTarget()
                            }

                            Button {
                                showAgentSheet = true
                            } label: {
                                Image(systemName: "sparkles")
                            }
                            .accessibilityLabel("Show agent panel")
                            .ideTouchTarget()
                        }
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
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            .preferredColorScheme(.dark)
            .tint(IDETheme.accent)
        }
        .sheet(isPresented: $showAgentSheet) {
            // Adaptive detents: .medium scales with the device instead
            // of a fixed height, and collapses gracefully in landscape.
            AgentChatView()
                .presentationDetents([.medium, .large], selection: $agentDetent)
                .presentationDragIndicator(.visible)
                .presentationBackgroundInteraction(.enabled(upThrough: .medium))
                .presentationContentInteraction(.scrolls)
                .presentationCornerRadius(20)
                .preferredColorScheme(.dark)
                .tint(IDETheme.accent)
        }
        .fullScreenCover(isPresented: $showPreviewCover) {
            NavigationStack {
                PreviewPaneView(htmlContent: ideManager.selectedFile?.content ?? "")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .ignoresSafeArea(edges: .bottom)
                    .navigationTitle(ideManager.selectedFile?.name ?? "Preview")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbarBackground(IDETheme.surface, for: .navigationBar)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Done") { showPreviewCover = false }
                                .ideTouchTarget()
                        }
                    }
                    .accessibilityLabel("Live HTML preview")
            }
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

    private var isPreviewableFileSelected: Bool {
        ideManager.selectedFile?.name.hasSuffix(".html") == true
    }
}

// MARK: - Previews
// Device size (SE vs Pro Max) is selected in the canvas / simulator;
// these traits cover orientation and type-size variations.

#Preview("iPhone portrait") {
    IDEView()
}

#Preview("iPhone landscape", traits: .landscapeLeft) {
    IDEView()
}

#Preview("Dynamic Type accessibility") {
    IDEView()
        .environment(\.dynamicTypeSize, .accessibility3)
}

#Preview("iPad split") {
    IDEView()
        .environment(\.horizontalSizeClass, .regular)
}
