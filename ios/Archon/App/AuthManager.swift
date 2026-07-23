import Foundation
import Supabase
import AuthenticationServices

@MainActor
class AuthManager: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var isSessionExpired: Bool = false
    
    static let shared = AuthManager()
    
    private var authStateTask: Task<Void, Never>?
    
    private init() {
        startListeningToAuthState()
    }
    
    private func startListeningToAuthState() {
        authStateTask = Task {
            for await (event, session) in await supabase.auth.authStateChanges {
                self.isAuthenticated = session != nil
                if event == .tokenRefreshed {
                    self.isSessionExpired = false
                }
            }
        }
    }
    
    func signInWithGitHub() async throws -> URL {
        // Generates the secure OAuth URL containing PKCE challenge
        let response = try await supabase.auth.getOAuthSignInURL(
            provider: OAuthProvider.github,
            redirectTo: URL(string: "archon://auth/callback")
        )
        return response
    }
    
    func handleOAuthCallback(url: URL) async throws {
        // The Supabase SDK handles PKCE state validation, URL decoding, and token exchange natively
        try await supabase.auth.session(from: url)
    }
    
    func signOut() async throws {
        try await supabase.auth.signOut()
    }
    
    deinit {
        authStateTask?.cancel()
    }
}
