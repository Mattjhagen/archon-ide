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
    
    var apiBaseURL: URL {
        switch self {
        case .development:
            return URL(string: "http://localhost:3000/api")!
        case .staging:
            return URL(string: "https://staging.relayapp.pro/api")!
        case .production:
            return URL(string: "https://app.relayapp.pro/api")!
        }
    }
}
