import SwiftUI

struct IDEView: View {
    @StateObject private var ideManager = IDEManager()
    
    var body: some View {
        NavigationSplitView {
            FileExplorerView()
        } content: {
            CodeEditorView()
        } detail: {
            AgentChatView()
        }
        .environmentObject(ideManager)
    }
}
