import XCTest
@testable import Archon

final class DecodingTests: XCTestCase {
    func testDecodeTaskEventAllKinds() throws {
        let json = """
        [
            {
                "id": "evt-1",
                "task_id": "task-1",
                "sequence": 1,
                "kind": "planning",
                "summary": "Starting plan",
                "created_at": "2024-07-23T12:00:00Z"
            },
            {
                "id": "evt-2",
                "task_id": "task-1",
                "sequence": 2,
                "kind": "model_call",
                "summary": "Calling claude",
                "created_at": "2024-07-23T12:00:01.123Z"
            },
            {
                "id": "evt-3",
                "task_id": "task-1",
                "sequence": 3,
                "kind": "tool_call",
                "summary": "Using grep",
                "created_at": "2024-07-23T12:00:02.456789Z"
            },
            {
                "id": "evt-4",
                "task_id": "task-1",
                "sequence": 4,
                "kind": "tool_result",
                "summary": "Found results",
                "created_at": "2024-07-23T12:00:03.000Z",
                "metadata": {
                    "token_count": 120,
                    "success": true,
                    "ratio": 0.95,
                    "tags": ["search", "fast"],
                    "nested": { "key": "value" }
                }
            },
            {
                "id": "evt-5",
                "task_id": "task-1",
                "sequence": 5,
                "kind": "verification",
                "summary": "Verifying",
                "created_at": "2024-07-23T12:00:04Z"
            },
            {
                "id": "evt-6",
                "task_id": "task-1",
                "sequence": 6,
                "kind": "file_edit",
                "summary": "Editing main.swift",
                "created_at": "2024-07-23T12:00:05Z"
            },
            {
                "id": "evt-7",
                "task_id": "task-1",
                "sequence": 7,
                "kind": "completion",
                "summary": "Done",
                "created_at": "2024-07-23T12:00:06Z"
            },
            {
                "id": "evt-8",
                "task_id": "task-1",
                "sequence": 8,
                "kind": "blocker",
                "summary": "Blocked on user",
                "created_at": "2024-07-23T12:00:07Z"
            },
            {
                "id": "evt-9",
                "task_id": "task-1",
                "sequence": 9,
                "kind": "error",
                "summary": "Error occurred",
                "created_at": "2024-07-23T12:00:08Z"
            }
        ]
        """.data(using: .utf8)!
        
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .customISO8601
        
        let events = try decoder.decode([TaskEvent].self, from: json)
        
        XCTAssertEqual(events.count, 9)
        XCTAssertEqual(events[0].type, .planning)
        XCTAssertEqual(events[1].type, .modelCall)
        XCTAssertEqual(events[2].type, .toolCall)
        XCTAssertEqual(events[3].type, .toolResult)
        XCTAssertEqual(events[4].type, .verification)
        XCTAssertEqual(events[5].type, .fileEdit)
        XCTAssertEqual(events[6].type, .completion)
        XCTAssertEqual(events[7].type, .blocker)
        XCTAssertEqual(events[8].type, .error)
        
        // Verify fractional timestamps
        let cal = Calendar(identifier: .gregorian)
        let evt2Date = events[1].timestamp
        let nano = cal.component(.nanosecond, from: evt2Date)
        XCTAssertTrue(nano > 120_000_000 && nano < 124_000_000) // approx 123ms
        
        // Verify metadata AnyCodable dynamic decoding
        let metadata = events[3].metadata
        XCTAssertNotNil(metadata)
        if let md = metadata {
            XCTAssertEqual(md["token_count"]?.value as? Int, 120)
            XCTAssertEqual(md["success"]?.value as? Bool, true)
            XCTAssertEqual(md["ratio"]?.value as? Double, 0.95)
            let tags = md["tags"]?.value as? [Any]
            XCTAssertEqual(tags?.count, 2)
            XCTAssertEqual(tags?[0] as? String, "search")
            let nested = md["nested"]?.value as? [String: Any]
            XCTAssertEqual(nested?["key"] as? String, "value")
        }
    }
    
    func testDecodeArchonTask() throws {
        let json = """
        {
            "id": "task-123",
            "title": "Make an app",
            "status": "running",
            "provider": "Anthropic",
            "model": "claude-3-5-sonnet",
            "reasoning_effort": "high",
            "current_step": 10,
            "max_steps": 25,
            "credits_used": 150,
            "credit_limit": 500,
            "created_at": "2024-07-23T12:00:00.123Z",
            "updated_at": "2024-07-23T12:01:00Z"
        }
        """.data(using: .utf8)!
        
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .customISO8601
        
        let task = try decoder.decode(ArchonTask.self, from: json)
        
        XCTAssertEqual(task.id, "task-123")
        XCTAssertEqual(task.reasoningEffort, .high)
        XCTAssertEqual(task.creditLimit, 500)
        XCTAssertEqual(task.creditsUsed, 150)
    }
}
