import SwiftUI

@main
struct ArchonApp: App {
    @StateObject private var authManager = AuthManager.shared
    
    var body: some Scene {
        WindowGroup {
            if authManager.isAuthenticated {
                ContentView()
            } else {
                WelcomeScreen()
            }
        }
        .onOpenURL { url in
            authManager.handleSupabaseDeepLink(url: url)
        }
    }
}

struct ContentView: View {
    @StateObject private var authManager = AuthManager.shared
    
    var body: some View {
        TabView {
            Tab("Inbox", systemImage: "tray") {
                NavigationStack {
                    TaskInboxView()
                        .toolbar {
                            ToolbarItem(placement: .topBarTrailing) {
                                Menu {
                                    Button("Sign Out", role: .destructive) {
                                        authManager.signOut()
                                    }
                                } label: {
                                    Image(systemName: "person.circle")
                                }
                            }
                        }
                }
            }
            
            Tab("Settings", systemImage: "gearshape") {
                NavigationStack {
                    SettingsView()
                }
            }
        }
    }
}

struct SettingsView: View {
    @StateObject private var authManager = AuthManager.shared
    @AppStorage("selectedProvider") private var selectedProvider = "openai"
    @AppStorage("selectedModel") private var selectedModel = "gpt-4o"
    
    let providers = ["openai", "anthropic", "gemini", "ollama"]
    let models = ["gpt-4o", "claude-sonnet-4", "gemini-3-pro", "llama3.2"]
    
    var body: some View {
        Form {
            Section("AI Provider") {
                Picker("Provider", selection: $selectedProvider) {
                    ForEach(providers, id: \.self) { provider in
                        Text(provider.capitalized).tag(provider)
                    }
                }
                .pickerStyle(.menu)
                
                Picker("Model", selection: $selectedModel) {
                    ForEach(models, id: \.self) { model in
                        Text(model).tag(model)
                    }
                }
                .pickerStyle(.menu)
            }
            
            Section("Account") {
                Button("Sign Out", role: .destructive) {
                    authManager.signOut()
                }
            }
        }
        .navigationTitle("Settings")
    }
}
