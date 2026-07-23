import Foundation
import Supabase

// This bridges our secure Keychain implementation to the Supabase Auth protocol
struct SupabaseKeychainStorage: AuthLocalStorage {
    private let store = KeychainSessionStore()
    
    func store(key: String, value: Data) throws {
        try store.store(key: key, value: value)
    }
    
    func retrieve(key: String) throws -> Data? {
        return try store.retrieve(key: key)
    }
    
    func remove(key: String) throws {
        try store.remove(key: key)
    }
}

// Global Supabase Client Instance
let supabase = SupabaseClient(
    supabaseURL: Environment.current.supabaseURL,
    supabaseKey: Environment.current.supabaseAnonKey,
    options: SupabaseClientOptions(
        auth: AuthOptions(
            storage: SupabaseKeychainStorage()
        )
    )
)
