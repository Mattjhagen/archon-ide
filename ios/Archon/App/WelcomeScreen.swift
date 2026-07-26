import SwiftUI
import AuthenticationServices

struct WelcomeScreen: View {
    @StateObject private var authManager = AuthManager.shared
    @State private var isAuthenticating = false
    @State private var authError: String?
    
    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            
            // Branding
            VStack(spacing: 8) {
                Image(systemName: "sparkles")
                    .font(.system(size: 48))
                    .foregroundStyle(.teal)
                    .accessibilityHidden(true)
                
                Text("Archon Companion")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundStyle(.primary)
                    .accessibilityAddTraits(.isHeader)
            }
            
            Spacer()
            
            if authManager.isSessionExpired {
                Text("Your session has expired. Please sign in again.")
                    .font(.callout)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .accessibilityLabel("Session expired. Please sign in again.")
            }
            
            if let error = authError {
                Text(error)
                    .font(.callout)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }
            
            // First-run explanation
            VStack(spacing: 12) {
                Text("GitHub sign-in securely authenticates your identity.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                
                Text("It does **not** grant access to your repositories until you explicitly connect a workspace later.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("GitHub sign-in securely authenticates your identity. It does not grant access to your repositories until you explicitly connect a workspace later.")
            
            // Sign in Button
            Button(action: {
                startOAuth()
            }) {
                HStack {
                    if isAuthenticating {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "chevron.right.circle.fill")
                    }
                    Text(isAuthenticating ? "Signing in..." : "Continue with GitHub")
                }
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(.teal)
            .padding(.horizontal, 32)
            .padding(.bottom, 48)
            .disabled(isAuthenticating)
        }
        // Support Dynamic Type and Reduced Motion
        .dynamicTypeSize(.xSmall ... .accessibility3)
        .animation(.easeInOut, value: authManager.isSessionExpired)
    }
    
    private func startOAuth() {
        #if DEBUG
        // Mock sign-in for simulator/preview testing
        authManager.signInWithGitHubMock()
        #else
        // Real OAuth via ASWebAuthenticationSession
        isAuthenticating = true
        authError = nil
        
        let config = AuthManager.oauthConfig
        guard let authURL = URL(string: "\(config.authorizeURL)?client_id=\(config.clientID)&redirect_uri=\(config.redirectURI)&response_type=code&scope=read:user") else {
            authError = "Invalid OAuth configuration."
            isAuthenticating = false
            return
        }
        
        let session = ASWebAuthenticationSession(url: authURL, callbackURLScheme: config.callbackScheme) { callbackURL, error in
            isAuthenticating = false
            
            if let error = error {
                if (error as NSError).code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                    return // User cancelled, don't show error
                }
                authError = "Authentication failed: \(error.localizedDescription)"
                return
            }
            
            guard let callbackURL = callbackURL,
                  let code = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?
                      .queryItems?.first(where: { $0.name == "code" })?.value else {
                authError = "No authorization code received."
                return
            }
            
            // Exchange code for token
            Task {
                await exchangeCodeForToken(code)
            }
        }
        
        session.prefersEphemeralWebBrowserSession = true
        session.start()
        #endif
    }
    
    private func exchangeCodeForToken(_ code: String) async {
        // TODO: Implement Supabase token exchange
        // POST to https://<supabase-url>/auth/v1/token?grant_type=authorization_code
        // with the authorization code
        authError = "Token exchange not yet implemented. Use mock sign-in in DEBUG."
    }
}

#Preview {
    WelcomeScreen()
}
