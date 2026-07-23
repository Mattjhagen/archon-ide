import Foundation
import Combine

class AuthManager: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var isSessionExpired: Bool = false
    
    static let shared = AuthManager()
    
    private let tokenKey = "supabase_access_token"
    
    private init() {
        checkSession()
    }
    
    func checkSession() {
        // Simulated Keychain access (UserDefaults for mock environment)
        if let token = UserDefaults.standard.string(forKey: tokenKey), !token.isEmpty {
            isAuthenticated = true
        } else {
            isAuthenticated = false
        }
    }
    
    func signInWithGitHub() {
        // This simulates a deep-link OAuth callback from Supabase
        // In a real app, ASWebAuthenticationSession would be used here.
        let fakeToken = "mock_github_oauth_token_12345"
        UserDefaults.standard.set(fakeToken, forKey: tokenKey)
        
        DispatchQueue.main.async {
            self.isAuthenticated = true
            self.isSessionExpired = false
        }
    }
    
    func signOut() {
        UserDefaults.standard.removeObject(forKey: tokenKey)
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
