import Foundation

enum FileType: String, Codable {
    case file
    case folder
}

struct FileNode: Identifiable, Hashable, Codable {
    let id: UUID
    var name: String
    let type: FileType
    var children: [FileNode]?
    var content: String?
    
    init(id: UUID = UUID(), name: String, type: FileType, children: [FileNode]? = nil, content: String? = nil) {
        self.id = id
        self.name = name
        self.type = type
        self.children = children
        self.content = content
    }
    
    
    private static var saveURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("workspace.json")
    }
    
    static func save(_ nodes: [FileNode]) {
        if let data = try? JSONEncoder().encode(nodes) {
            try? data.write(to: saveURL)
        }
    }
    
    static func load() -> [FileNode] {
        if let data = try? Data(contentsOf: saveURL),
           let nodes = try? JSONDecoder().decode([FileNode].self, from: data) {
            return nodes
        }
        return mock()
    }
    
    static func mock() -> [FileNode] {
        return [
            FileNode(name: "src", type: .folder, children: [
                FileNode(name: "main.swift", type: .file, content: "print(\"Hello World\")\n"),
                FileNode(name: "utils.swift", type: .file, content: "func add(a: Int, b: Int) -> Int {\n    return a + b\n}\n")
            ]),
            FileNode(name: "README.md", type: .file, content: "# Archon Project\nWelcome to your new cloud IDE project.")
        ]
    }
}
