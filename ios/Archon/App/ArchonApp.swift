import SwiftUI

@main
struct ArchonApp: App {
    @StateObject private var authManager = AuthManager.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if authManager.isAuthenticated {
                    TaskInboxView()
                } else {
                    WelcomeScreen()
                }
            }
            .animation(.default, value: authManager.isAuthenticated)
            // Ensure child views can access the auth manager environment
            .environmentObject(authManager)
        }
    }
}

struct ContentView: View {
    @StateObject private var authManager = AuthManager.shared
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Welcome to the Task Inbox")
                .font(.title)
                .foregroundStyle(.teal)
            
            Button("Sign Out") {
                authManager.signOut()
            }
            .buttonStyle(.bordered)
        }
    }
}
