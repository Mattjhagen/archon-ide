use actix_web::{web, HttpResponse};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ChatReq {
    pub messages: Vec<ChatMessage>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub _stream: Option<bool>,
}

#[derive(Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct ChatResponse {
    pub content: String,
    pub model: String,
    pub provider: String,
    pub tokens_used: TokenUsage,
}

#[derive(Serialize)]
pub struct TokenUsage {
    pub input: usize,
    pub output: usize,
}

#[derive(Serialize)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub models: Vec<ModelInfo>,
    pub requires_key: bool,
    pub configured: bool,
}

#[derive(Serialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
}

pub async fn list_providers() -> HttpResponse {
    let mut providers = vec![];

    // OpenAI-compatible
    let openai_key = std::env::var("OPENAI_API_KEY").unwrap_or_default();
    providers.push(ProviderInfo {
        id: "openai".to_string(),
        name: "OpenAI".to_string(),
        models: vec![
            ModelInfo { id: "gpt-4o".to_string(), name: "GPT-4o".to_string() },
            ModelInfo { id: "gpt-4o-mini".to_string(), name: "GPT-4o Mini".to_string() },
            ModelInfo { id: "gpt-4-turbo".to_string(), name: "GPT-4 Turbo".to_string() },
        ],
        requires_key: true,
        configured: !openai_key.is_empty(),
    });

    // Anthropic
    let anthropic_key = std::env::var("ANTHROPIC_API_KEY").unwrap_or_default();
    providers.push(ProviderInfo {
        id: "anthropic".to_string(),
        name: "Anthropic".to_string(),
        models: vec![
            ModelInfo { id: "claude-sonnet-4-20250514".to_string(), name: "Claude Sonnet 4".to_string() },
            ModelInfo { id: "claude-haiku-4-20250414".to_string(), name: "Claude Haiku 4".to_string() },
        ],
        requires_key: true,
        configured: !anthropic_key.is_empty(),
    });

    // Ollama
    let ollama_url = std::env::var("OLLAMA_BASE_URL")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());
    let ollama_available = Client::new()
        .get(format!("{}/api/tags", ollama_url))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false);

    providers.push(ProviderInfo {
        id: "ollama".to_string(),
        name: "Ollama (Local)".to_string(),
        models: vec![
            ModelInfo { id: "llama3.2".to_string(), name: "Llama 3.2".to_string() },
            ModelInfo { id: "codellama".to_string(), name: "CodeLlama".to_string() },
            ModelInfo { id: "deepseek-coder".to_string(), name: "DeepSeek Coder".to_string() },
        ],
        requires_key: false,
        configured: ollama_available,
    });

    // Mock (always available)
    providers.push(ProviderInfo {
        id: "mock".to_string(),
        name: "Mock (Demo)".to_string(),
        models: vec![
            ModelInfo { id: "mock-responses".to_string(), name: "Mock Responses".to_string() },
        ],
        requires_key: false,
        configured: true,
    });

    HttpResponse::Ok().json(providers)
}

pub async fn chat(
    body: web::Json<ChatReq>,
) -> HttpResponse {
    let provider = body.provider.as_deref().unwrap_or("mock");
    let model = body.model.as_deref().unwrap_or("mock-responses");
    let max_tokens = body.max_tokens.unwrap_or(2048);
    let temperature = body.temperature.unwrap_or(0.7);

    match provider {
        "openai" => chat_openai(&body.messages, model, max_tokens, temperature).await,
        "anthropic" => chat_anthropic(&body.messages, model, max_tokens, temperature).await,
        "ollama" => chat_ollama(&body.messages, model, max_tokens, temperature).await,
        _ => chat_mock(&body.messages, model).await,
    }
}

async fn chat_openai(
    messages: &[ChatMessage],
    model: &str,
    max_tokens: u32,
    temperature: f32,
) -> HttpResponse {
    let api_key = match std::env::var("OPENAI_API_KEY") {
        Ok(k) if !k.is_empty() => k,
        _ => return chat_mock(messages, model).await,
    };

    let base_url = std::env::var("OPENAI_BASE_URL")
        .unwrap_or_else(|_| "https://api.openai.com/v1".to_string());

    let client = Client::new();
    let msgs: Vec<serde_json::Value> = messages.iter().map(|m| {
        serde_json::json!({"role": m.role, "content": m.content})
    }).collect();

    let resp = client.post(format!("{}/chat/completions", base_url))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": model,
            "messages": msgs,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }))
        .send()
        .await;

    match resp {
        Ok(r) => {
            let _status = r.status();
            match r.text().await {
                Ok(text) => {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                        let content = val["choices"][0]["message"]["content"]
                            .as_str().unwrap_or("").to_string();
                        let usage = &val["usage"];
                        HttpResponse::Ok().json(ChatResponse {
                            content,
                            model: model.to_string(),
                            provider: "openai".to_string(),
                            tokens_used: TokenUsage {
                                input: usage["prompt_tokens"].as_u64().unwrap_or(0) as usize,
                                output: usage["completion_tokens"].as_u64().unwrap_or(0) as usize,
                            },
                        })
                    } else {
                        HttpResponse::BadGateway()
                            .json(serde_json::json!({"error": "Invalid response from provider"}))
                    }
                }
                Err(e) => HttpResponse::BadGateway()
                    .json(serde_json::json!({"error": e.to_string()})),
            }
        }
        Err(e) => HttpResponse::BadGateway()
            .json(serde_json::json!({"error": e.to_string()})),
    }
}

async fn chat_anthropic(
    messages: &[ChatMessage],
    model: &str,
    max_tokens: u32,
    temperature: f32,
) -> HttpResponse {
    let api_key = match std::env::var("ANTHROPIC_API_KEY") {
        Ok(k) if !k.is_empty() => k,
        _ => return chat_mock(messages, model).await,
    };

    let client = Client::new();
    let mut system_msg = String::new();
    let mut user_msgs = Vec::new();

    for m in messages {
        if m.role == "system" {
            system_msg = m.content.clone();
        } else {
            user_msgs.push(serde_json::json!({
                "role": m.role,
                "content": m.content
            }));
        }
    }

    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": user_msgs,
    });

    if !system_msg.is_empty() {
        body["system"] = serde_json::json!(system_msg);
    }

    let resp = client.post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await;

    match resp {
        Ok(r) => {
            match r.text().await {
                Ok(text) => {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                        let content = val["content"][0]["text"]
                            .as_str().unwrap_or("").to_string();
                        let input_tokens = val["usage"]["input_tokens"]
                            .as_u64().unwrap_or(0) as usize;
                        let output_tokens = val["usage"]["output_tokens"]
                            .as_u64().unwrap_or(0) as usize;

                        HttpResponse::Ok().json(ChatResponse {
                            content,
                            model: model.to_string(),
                            provider: "anthropic".to_string(),
                            tokens_used: TokenUsage {
                                input: input_tokens,
                                output: output_tokens,
                            },
                        })
                    } else {
                        HttpResponse::BadGateway()
                            .json(serde_json::json!({"error": "Invalid response"}))
                    }
                }
                Err(e) => HttpResponse::BadGateway()
                    .json(serde_json::json!({"error": e.to_string()})),
            }
        }
        Err(e) => HttpResponse::BadGateway()
            .json(serde_json::json!({"error": e.to_string()})),
    }
}

async fn chat_ollama(
    messages: &[ChatMessage],
    model: &str,
    max_tokens: u32,
    temperature: f32,
) -> HttpResponse {
    let base_url = std::env::var("OLLAMA_BASE_URL")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());

    let client = Client::new();
    let msgs: Vec<serde_json::Value> = messages.iter().map(|m| {
        serde_json::json!({"role": m.role, "content": m.content})
    }).collect();

    let resp = client.post(format!("{}/api/chat", base_url))
        .json(&serde_json::json!({
            "model": model,
            "messages": msgs,
            "options": {
                "num_predict": max_tokens,
                "temperature": temperature,
            },
            "stream": false,
        }))
        .send()
        .await;

    match resp {
        Ok(r) => {
            match r.text().await {
                Ok(text) => {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                        let content = val["message"]["content"]
                            .as_str().unwrap_or("").to_string();
                        let prompt_tokens = val["prompt_eval_count"]
                            .as_u64().unwrap_or(0) as usize;
                        let eval_count = val["eval_count"]
                            .as_u64().unwrap_or(0) as usize;

                        HttpResponse::Ok().json(ChatResponse {
                            content,
                            model: model.to_string(),
                            provider: "ollama".to_string(),
                            tokens_used: TokenUsage {
                                input: prompt_tokens,
                                output: eval_count,
                            },
                        })
                    } else {
                        HttpResponse::BadGateway()
                            .json(serde_json::json!({"error": "Invalid response"}))
                    }
                }
                Err(e) => HttpResponse::BadGateway()
                    .json(serde_json::json!({"error": e.to_string()})),
            }
        }
        Err(e) => HttpResponse::BadGateway()
            .json(serde_json::json!({"error": e.to_string()})),
    }
}

async fn chat_mock(
    messages: &[ChatMessage],
    model: &str,
) -> HttpResponse {
    let last_msg = messages.last().map(|m| m.content.as_str()).unwrap_or("");

    let response = if last_msg.to_lowercase().contains("explain") {
        format!(
            "## Code Explanation\n\nThis code implements the following:\n\n\
            1. **Data Flow**: The data enters through the input handler and is processed \
            through the transformation pipeline.\n\n\
            2. **Error Handling**: Errors are caught and propagated with context.\n\n\
            3. **Key Pattern**: Uses the observer pattern for reactive updates.\n\n\
            ```typescript\n\
            // Example usage\n\
            const result = await processData(input);\n\
            console.log(result);\n\
            ```\n\n\
            **Potential improvements:**\n\
            - Consider adding retry logic for transient failures\n\
            - The error messages could be more descriptive\n\
            - Type safety could be improved with generics"
        )
    } else if last_msg.to_lowercase().contains("fix") || last_msg.to_lowercase().contains("bug") {
        format!(
            "## Suggested Fix\n\n\
            I found the issue. Here's the corrected code:\n\n\
            ```typescript\n\
            // Before (buggy)\n\
            // const data = items.map(i => i.value);\n\n\
            // After (fixed)\n\
            const data = items\n\
              .filter(i => i.value !== undefined)\n\
              .map(i => i.value!);\n\
            ```\n\n\
            **What changed:**\n\
            - Added filter to exclude undefined values\n\
            - Used non-null assertion after filtering"
        )
    } else if last_msg.to_lowercase().contains("write") || last_msg.to_lowercase().contains("create") {
        format!(
            "## Generated Code\n\n\
            ```typescript\n\
            interface Config {{\n\
              host: string;\n\
              port: number;\n\
              debug: boolean;\n\
            }}\n\n\
            function loadConfig(path: string): Config {{\n\
              const raw = Deno.readTextFileSync(path);\n\
              const config = JSON.parse(raw) as Partial<Config>;\n\
              return {{\n\
                host: config.host ?? 'localhost',\n\
                port: config.port ?? 3000,\n\
                debug: config.debug ?? false,\n\
              }};\n\
            }}\n\
            ```\n\n\
            This creates a type-safe config loader with defaults."
        )
    } else {
        format!(
            "I understand your question about: *\"{}\"*\n\n\
            Here's my analysis:\n\n\
            1. **Context**: Based on the code you've shared, this appears to be part of \
            a larger system handling data processing.\n\n\
            2. **Recommendation**: I'd suggest breaking this into smaller, testable functions.\n\n\
            3. **Next Steps**:\n\
               - Add unit tests for the core logic\n\
               - Consider adding input validation\n\
               - Document the expected behavior\n\n\
            Would you like me to elaborate on any of these points?",
            last_msg.chars().take(100).collect::<String>()
        )
    };

    let input_tokens = messages.iter().map(|m| m.content.len() / 4).sum::<usize>();
    let output_tokens = response.len() / 4;

    HttpResponse::Ok().json(ChatResponse {
        content: response,
        model: model.to_string(),
        provider: "mock".to_string(),
        tokens_used: TokenUsage {
            input: input_tokens,
            output: output_tokens,
        },
    })
}

#[derive(Deserialize)]
pub struct CompleteReq {
    pub file_path: String,
    pub content: String,
    pub cursor_line: usize,
    pub cursor_char: usize,
    pub language: Option<String>,
}

pub async fn complete(
    body: web::Json<CompleteReq>,
) -> HttpResponse {
    // For the prototype, return a simple completion
    let lines: Vec<&str> = body.content.lines().collect();
    let current_line = body.cursor_line.saturating_sub(1);
    let line = lines.get(current_line).unwrap_or(&"");

    let completion = if line.trim().ends_with('{') || line.trim().ends_with(':') {
        "    \n"
    } else if line.trim().ends_with("=>") {
        " {\n\n    }"
    } else {
        ""
    };

    HttpResponse::Ok().json(serde_json::json!({
        "completion": completion,
        "model": "local",
        "provider": "builtin",
    }))
}
