import SwiftUI

struct IDEView: View {
    @StateObject private var ideManager = IDEManager()
    
    var body: some View {
        NavigationSplitView {
            FileExplorerView()
        } content: {
            // Main content splits between Code Editor and Live Preview
            GeometryReader { geo in
                VStack(spacing: 0) {
                    CodeEditorView()
                        .frame(height: geo.size.height * 0.6)
                    
                    Divider()
                        .background(Color.teal)
                        .frame(height: 2)
                    
                    // Simple live preview rendering the currently selected file (if it's HTML)
                    // In a real app, this would bundle the whole workspace
                    PreviewPaneView(htmlContent: ideManager.selectedFile?.name.hasSuffix(".html") == true ? (ideManager.selectedFile?.content ?? "") : "<html><body style='font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #111; color: #666;'>Select an HTML file to preview</body></html>")
                }
            }
        } detail: {
            AgentChatView()
        }
        .environmentObject(ideManager)
    }
}
