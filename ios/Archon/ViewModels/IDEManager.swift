import Foundation
import Combine

@MainActor
class IDEManager: ObservableObject {
    @Published var fileTree: [FileNode] = []
    @Published var selectedFile: FileNode?
    @Published var openFiles: [FileNode] = []
    
    // Agent Chat State
    @Published var agentMessages: [TaskEvent] = []
    
    init() {
        self.fileTree = FileNode.mock()
    }
    
    func selectFile(_ file: FileNode) {
        guard file.type == .file else { return }
        
        if !openFiles.contains(where: { $0.id == file.id }) {
            openFiles.append(file)
        }
        selectedFile = file
    }
    
    func updateFileContent(id: UUID, newContent: String) {
        // Recursive function to update content in the tree
        func update(nodes: inout [FileNode]) -> Bool {
            for i in 0..<nodes.count {
                if nodes[i].id == id {
                    nodes[i].content = newContent
                    return true
                }
                if nodes[i].children != nil {
                    var children = nodes[i].children!
                    if update(nodes: &children) {
                        nodes[i].children = children
                        return true
                    }
                }
            }
            return false
        }
        
        var newTree = fileTree
        if update(nodes: &newTree) {
            fileTree = newTree
        }
        
        // Update selected file if it's the one currently open
        if selectedFile?.id == id {
            selectedFile?.content = newContent
        }
        
        // Update open files array
        if let index = openFiles.firstIndex(where: { $0.id == id }) {
            openFiles[index].content = newContent
        }
    }
}
