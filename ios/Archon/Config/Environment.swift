import Foundation

enum Environment {
    case development
    case staging
    case production
    
    static var current: Environment {
        #if DEBUG
        return .development
        #else
        return .production
        #endif
    }
    
    var supabaseURL: URL {
        switch self {
        case .development: return URL(string: "http://localhost:54321")!
        case .staging: return URL(string: "https://staging.relayapp.pro")!
        case .production: return URL(string: "https://app.relayapp.pro")!
        }
    }
    
    var supabaseAnonKey: String {
        // Read from Xcode environment variables or xcconfig to avoid committing secrets
        return ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"] ?? "MOCK_KEY"
    }
    
    var apiBaseURL: URL {
        supabaseURL.appendingPathComponent("api")
    }
}
