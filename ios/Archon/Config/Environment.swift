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
