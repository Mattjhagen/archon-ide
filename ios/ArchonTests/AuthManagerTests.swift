import XCTest
@testable import Archon

@MainActor
final class AuthManagerTests: XCTestCase {
    var authManager: AuthManager!

    override func setUp() {
        super.setUp()
        authManager = AuthManager.shared
    }

    override func tearDown() {
        authManager = nil
        super.tearDown()
    }

    func testInitialState() {
        // Initial state should be clear if no session is stored
        XCTAssertFalse(authManager.isAuthenticated)
        XCTAssertFalse(authManager.isSessionExpired)
        XCTAssertNil(authManager.authError)
    }

    func testAuthErrorSurfacing() {
        // Simulating an error during the OAuth callback
        authManager.authError = "Invalid PKCE challenge"
        
        XCTAssertEqual(authManager.authError, "Invalid PKCE challenge")
        XCTAssertFalse(authManager.isAuthenticated)
    }
    
    func testSessionExpiryState() {
        // Simulating an expired session trigger
        authManager.isSessionExpired = true
        
        XCTAssertTrue(authManager.isSessionExpired)
    }
    
    func testActiveWindowAnchor() {
        // Verifying the ASWebAuthenticationPresentationContextProviding implementation
        let anchor = authManager.presentationAnchor(for: .init(url: URL(string: "https://apple.com")!, callbackURLScheme: nil, completionHandler: { _, _ in }))
        XCTAssertNotNil(anchor)
    }
}
