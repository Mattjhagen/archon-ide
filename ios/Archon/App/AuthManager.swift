import Foundation
import Supabase
import AuthenticationServices

@MainActor
class AuthManager: NSObject, ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var isSessionExpired: Bool = false
    @Published var authError: String? = nil
    
    static let shared = AuthManager()
    
    private var authStateTask: Task<Void, Never>?
    private var webAuthSession: ASWebAuthenticationSession?
    
    private override init() {
        super.init()
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
    
    func startOAuthFlow() {
        Task {
            do {
                self.authError = nil
                let response = try await supabase.auth.getOAuthSignInURL(
                    provider: OAuthProvider.github,
                    redirectTo: URL(string: "archon://auth/callback")
                )
                
                webAuthSession = ASWebAuthenticationSession(url: response, callbackURLScheme: "archon") { [weak self] callbackURL, error in
                    guard let self = self else { return }
                    if let error = error {
                        if (error as NSError).code != ASWebAuthenticationSessionError.canceledLogin.rawValue {
                            DispatchQueue.main.async { self.authError = error.localizedDescription }
                        }
                        return
                    }
                    guard let callbackURL = callbackURL else { return }
                    
                    Task {
                        do {
                            try await supabase.auth.session(from: callbackURL)
                        } catch {
                            self.authError = error.localizedDescription
                        }
                    }
                }
                
                webAuthSession?.presentationContextProvider = self
                webAuthSession?.start()
                
            } catch {
                self.authError = error.localizedDescription
            }
        }
    }
    
    func signOut() async throws {
        try await supabase.auth.signOut()
    }
    
    deinit {
        authStateTask?.cancel()
    }
}

extension AuthManager: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        // Return the active window scene
        let scenes = UIApplication.shared.connectedScenes
        let windowScene = scenes.first as? UIWindowScene
        return windowScene?.windows.first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}
