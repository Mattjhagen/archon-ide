import SwiftUI

@main
struct ArchonApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    var body: some View {
        Text("Archon Companion")
            .font(.title)
            .foregroundStyle(.teal)
    }
}
