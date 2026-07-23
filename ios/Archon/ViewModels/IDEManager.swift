import Foundation
import Combine

@MainActor
class IDEManager: ObservableObject {
    @Published var fileTree: [FileNode] = []
    @Published var selectedFile: FileNode?
    @Published var openFiles: [FileNode] = []
    
    private var appliedEditEventIds = Set<String>()
    
    // Agent Chat State
    @Published var agentMessages: [TaskEvent] = [] {
        didSet {
            processNewAgentEvents()
        }
    }
    
    init() {
        self.fileTree = FileNode.load()
    }
    
    func selectFile(_ file: FileNode) {
        guard file.type == .file else { return }

        if !openFiles.contains(where: { $0.id == file.id }) {
            openFiles.append(file)
        }
        selectedFile = file
    }

    func closeFile(id: UUID) {
        openFiles.removeAll { $0.id == id }
        if selectedFile?.id == id {
            selectedFile = openFiles.last
        }
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
            FileNode.save(fileTree)
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
    
    private func processNewAgentEvents() {
        for event in agentMessages {
            if event.type == .fileEdit && !appliedEditEventIds.contains(event.id) {
                appliedEditEventIds.insert(event.id)
                applyFileEdit(event)
            }
        }
    }
    
    private func applyFileEdit(_ event: TaskEvent) {
        guard let metadata = event.metadata,
              let pathValue = metadata["path"]?.value as? String,
              let contentValue = metadata["content"]?.value as? String else { return }
        
        let fileName = (pathValue as NSString).lastPathComponent
        
        var foundId: UUID? = nil
        func search(nodes: [FileNode]) {
            for node in nodes {
                if node.name == fileName {
                    foundId = node.id
                    return
                }
                if let children = node.children {
                    search(nodes: children)
                }
            }
        }
        search(nodes: fileTree)
        
        if let id = foundId {
            updateFileContent(id: id, newContent: contentValue)
        } else {
            let newFile = FileNode(name: fileName, type: .file, content: contentValue)
            fileTree.append(newFile)
            FileNode.save(fileTree)
            
            // Auto-select if nothing is open
            if selectedFile == nil {
                selectFile(newFile)
            }
        }
    }
}
