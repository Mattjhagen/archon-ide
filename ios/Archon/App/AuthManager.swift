import Foundation
import Combine
import AuthenticationServices

class AuthManager: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var isSessionExpired: Bool = false
    
    static let shared = AuthManager()
    private let sessionStore: SessionStore
    
    // Inject session store for testability (defaults to Keychain for production)
    init(sessionStore: SessionStore = KeychainSessionStore()) {
        self.sessionStore = sessionStore
        checkSession()
    }
    
    func checkSession() {
        if let token = sessionStore.getToken(), !token.isEmpty {
            isAuthenticated = true
        } else {
            isAuthenticated = false
        }
    }
    
    func handleSupabaseDeepLink(url: URL) {
        // Deep link handler for Supabase OAuth redirect (e.g. archon://auth/callback#access_token=...)
        guard let fragment = url.fragment else { return }
        
        let queryItems = fragment.split(separator: "&").map { String($0) }
        var token: String? = nil
        
        for item in queryItems {
            let pair = item.split(separator: "=")
            if pair.count == 2, pair[0] == "access_token" {
                token = String(pair[1])
                break
            }
        }
        
        if let accessToken = token {
            sessionStore.saveToken(accessToken)
            DispatchQueue.main.async {
                self.isAuthenticated = true
                self.isSessionExpired = false
            }
        }
    }
    
    func signInWithGitHubMock() {
        // Mock method strictly for simulator preview testing if real OAuth is unavailable
        #if DEBUG
        sessionStore.saveToken("mock_github_oauth_token_12345")
        DispatchQueue.main.async {
            self.isAuthenticated = true
            self.isSessionExpired = false
        }
        #endif
    }
    
    func signOut() {
        sessionStore.deleteToken()
        DispatchQueue.main.async {
            self.isAuthenticated = false
        }
    }
    
    func forceSessionExpiry() {
        DispatchQueue.main.async {
            self.isSessionExpired = true
            self.isAuthenticated = false
        }
    }
}
