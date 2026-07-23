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

