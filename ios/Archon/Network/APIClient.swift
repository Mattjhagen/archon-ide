import Foundation

extension Formatter {
    static let iso8601: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
    static let iso8601withFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

extension JSONDecoder.DateDecodingStrategy {
    static let customISO8601 = custom { decoder throws -> Date in
        let container = try decoder.singleValueContainer()
        let string = try container.decode(String.self)
        if let date = Formatter.iso8601withFractionalSeconds.date(from: string) ?? Formatter.iso8601.date(from: string) {
            return date
        }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid date format: \(string)")
    }
}

protocol APIClientProtocol {
    func fetchTasks() async throws -> [ArchonTask]
    func getTaskDetails(id: String) async throws -> ArchonTask
    func getTaskEvents(id: String) async throws -> [TaskEvent]
    func cancelTask(id: String) async throws
    func fetchProviders() async throws -> [ProviderMetadata]
    func createTask(_ request: CreateTaskRequest) async throws -> ArchonTask
}

class AuthenticatedAPIClient: APIClientProtocol {
    private let urlSession: URLSession
    
    init(urlSession: URLSession = .shared) {
        self.urlSession = urlSession
    }
    
    private func getAuthToken() async throws -> String {
        return try await supabase.auth.session.accessToken
    }
    
    private func performRequest<T: Decodable>(url: URL, method: String, body: Data? = nil, retryCount: Int = 3) async throws -> T {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        let token = try await getAuthToken()
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        var attempt = 0
        while attempt < retryCount {
            let (data, response) = try await urlSession.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError(message: "Invalid response type", code: nil)
            }
            
            if (200...299).contains(httpResponse.statusCode) {
                let decoder = JSONDecoder()
                decoder.keyDecodingStrategy = .convertFromSnakeCase
                decoder.dateDecodingStrategy = .customISO8601
                return try decoder.decode(T.self, from: data)
            } else if method == "GET" && attempt < retryCount - 1 && httpResponse.statusCode >= 500 {
                // Retry only safe GET requests on server errors
                attempt += 1
                try await Task.sleep(nanoseconds: UInt64(pow(2.0, Double(attempt))) * 1_000_000_000)
                continue
            } else {
                // Backend bodies are {"error": ...} or {"message": ...};
                // keep the HTTP status when the body doesn't carry one.
                let decoded = try? JSONDecoder().decode(APIError.self, from: data)
                throw APIError(
                    message: decoded?.message ?? "HTTP error",
                    code: decoded?.code ?? httpResponse.statusCode
                )
            }
        }
        
        throw APIError(message: "Max retries exceeded", code: nil)
    }
    
    func fetchTasks() async throws -> [ArchonTask] {
        let url = Environment.current.apiBaseURL.appendingPathComponent("agent/tasks")
        return try await performRequest(url: url, method: "GET")
    }
    
    func getTaskDetails(id: String) async throws -> ArchonTask {
        let url = Environment.current.apiBaseURL.appendingPathComponent("agent/tasks/\(id)")
        return try await performRequest(url: url, method: "GET")
    }
    
    func getTaskEvents(id: String) async throws -> [TaskEvent] {
        let url = Environment.current.apiBaseURL.appendingPathComponent("agent/tasks/\(id)/events")
        return try await performRequest(url: url, method: "GET")
    }
    
    func fetchProviders() async throws -> [ProviderMetadata] {
        let url = Environment.current.apiBaseURL.appendingPathComponent("ai/providers")
        return try await performRequest(url: url, method: "GET")
    }

    func createTask(_ createRequest: CreateTaskRequest) async throws -> ArchonTask {
        let url = Environment.current.apiBaseURL.appendingPathComponent("agent/tasks")
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let body = try encoder.encode(createRequest)
        // POST is not retried — task creation is not idempotent.
        return try await performRequest(url: url, method: "POST", body: body, retryCount: 1)
    }

    func cancelTask(id: String) async throws {
        let url = Environment.current.apiBaseURL.appendingPathComponent("agent/tasks/\(id)/cancel")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        let token = try await getAuthToken()
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (_, response) = try await urlSession.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw APIError(message: "Failed to cancel task", code: (response as? HTTPURLResponse)?.statusCode)
        }
    }
}
