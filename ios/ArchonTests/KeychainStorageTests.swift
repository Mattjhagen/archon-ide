import XCTest
@testable import Archon

final class KeychainStorageTests: XCTestCase {
    var storage: SupabaseKeychainStorage!

    override func setUp() {
        super.setUp()
        storage = SupabaseKeychainStorage()
        // Clean up before test
        try? storage.remove(key: "test_key")
    }

    override func tearDown() {
        // Clean up after test
        try? storage.remove(key: "test_key")
        storage = nil
        super.tearDown()
    }

    func testStoreAndRetrieve() throws {
        let testData = "super_secret_refresh_token".data(using: .utf8)!
        
        try storage.store(key: "test_key", value: testData)
        
        let retrievedData = try storage.retrieve(key: "test_key")
        XCTAssertNotNil(retrievedData)
        
        let retrievedString = String(data: retrievedData!, encoding: .utf8)
        XCTAssertEqual(retrievedString, "super_secret_refresh_token")
    }

    func testRemove() throws {
        let testData = "token_to_delete".data(using: .utf8)!
        
        try storage.store(key: "test_key", value: testData)
        try storage.remove(key: "test_key")
        
        let retrievedData = try storage.retrieve(key: "test_key")
        XCTAssertNil(retrievedData)
    }
}
