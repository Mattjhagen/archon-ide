import XCTest
@testable import Archon

final class AuthManagerTests: XCTestCase {
    var authManager: AuthManager!
    var mockStore: MockSessionStore!

    override func setUp() {
        super.setUp()
        mockStore = MockSessionStore()
        authManager = AuthManager(sessionStore: mockStore)
    }

    override func tearDown() {
        authManager = nil
        mockStore = nil
        super.tearDown()
    }

    func testNoTokenState() {
        // When no token is in the store, auth should be false
        XCTAssertFalse(authManager.isAuthenticated)
        XCTAssertFalse(authManager.isSessionExpired)
    }

    func testSessionRestore() {
        // Given a token is saved in the store
        mockStore.saveToken("valid_token")
        
        // When auth manager is initialized
        let restoredManager = AuthManager(sessionStore: mockStore)
        
        // Then it should be authenticated
        XCTAssertTrue(restoredManager.isAuthenticated)
    }

    func testDeepLinkCallback() {
        // Given an incoming OAuth redirect URL
        let url = URL(string: "archon://auth/callback#access_token=super_secret_token&expires_in=3600")!
        
        // When handled
        authManager.handleSupabaseDeepLink(url: url)
        
        // Then the token should be saved and state updated
        let expectation = XCTestExpectation(description: "Auth state updates on main thread")
        DispatchQueue.main.async {
            XCTAssertTrue(self.authManager.isAuthenticated)
            XCTAssertEqual(self.mockStore.getToken(), "super_secret_token")
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 1.0)
    }

    func testSignOutClearing() {
        // Given an authenticated state
        mockStore.saveToken("valid_token")
        authManager.checkSession()
        XCTAssertTrue(authManager.isAuthenticated)
        
        // When signed out
        authManager.signOut()
        
        // Then token is cleared and state is false
        let expectation = XCTestExpectation(description: "Sign out clears state on main thread")
        DispatchQueue.main.async {
            XCTAssertFalse(self.authManager.isAuthenticated)
            XCTAssertNil(self.mockStore.getToken())
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 1.0)
    }

    func testSessionExpiry() {
        // Given an authenticated state
        mockStore.saveToken("valid_token")
        authManager.checkSession()
        
        // When forced to expire
        authManager.forceSessionExpiry()
        
        let expectation = XCTestExpectation(description: "Session expires on main thread")
        DispatchQueue.main.async {
            XCTAssertTrue(self.authManager.isSessionExpired)
            XCTAssertFalse(self.authManager.isAuthenticated)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 1.0)
    }
}
