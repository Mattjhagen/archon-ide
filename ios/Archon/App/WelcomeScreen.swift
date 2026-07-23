import SwiftUI

struct WelcomeScreen: View {
    @StateObject private var authManager = AuthManager.shared
    
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
            
            // First-run explanation (Product Truth)
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
                authManager.signInWithGitHub()
            }) {
                HStack {
                    Image(systemName: "chevron.right.circle.fill")
                    Text("Continue with GitHub")
                }
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 44) // 44pt minimum hit target
            }
            .buttonStyle(.borderedProminent)
            .tint(.teal)
            .padding(.horizontal, 32)
            .padding(.bottom, 48)
        }
        // Support Dynamic Type and Reduced Motion
        .dynamicTypeSize(.xSmall ... .accessibility3)
        .animation(.easeInOut, value: authManager.isSessionExpired)
    }
}

#Preview {
    WelcomeScreen()
}
