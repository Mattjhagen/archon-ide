import Foundation

enum Environment {
    case development
    case staging
    case production
    
    static var current: Environment {
        // Force production while testing the real instance in the simulator
        return .production
    }
    
    var supabaseURL: URL {
        switch self {
        case .development: return URL(string: "http://localhost:54321")!
        case .staging: return URL(string: "https://staging.relayapp.pro")!
        case .production: return URL(string: "https://sbbkmdnyzzidywjkdhye.supabase.co")!
        }
    }
    
    var supabaseAnonKey: String {
        return Bundle.main.infoDictionary?["SUPABASE_ANON_KEY"] as? String ?? "MOCK_KEY"
    }
    
    var apiBaseURL: URL {
        URL(string: "https://app.relayapp.pro/api")!
    }
}
