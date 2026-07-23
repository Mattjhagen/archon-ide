use actix_web::{web, HttpResponse};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ReasoningEffort {
    Low,
    Medium,
    High,
}

impl Default for ReasoningEffort {
    fn default() -> Self { Self::Medium }
}

impl ReasoningEffort {
    fn multiplier(self) -> usize {
        match self { Self::Low => 1, Self::Medium => 2, Self::High => 4 }
    }

    fn as_str(self) -> &'static str {
        match self { Self::Low => "low", Self::Medium => "medium", Self::High => "high" }
    }
}

#[derive(Deserialize)]
pub struct ChatReq {
    pub messages: Vec<ChatMessage>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub _stream: Option<bool>,
    pub api_key: Option<String>,
    #[serde(default)]
    pub reasoning_effort: ReasoningEffort,
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
    pub reasoning_effort: ReasoningEffort,
    pub credit_units: usize,
}

fn chat_response(content: String, model: &str, provider: &str, input: usize, output: usize, effort: ReasoningEffort) -> HttpResponse {
    let billable_blocks = (input + output).max(1).div_ceil(1000);
    HttpResponse::Ok().json(ChatResponse {
        content,
        model: model.to_string(),
        provider: provider.to_string(),
        tokens_used: TokenUsage { input, output },
        reasoning_effort: effort,
        credit_units: billable_blocks * effort.multiplier(),
    })
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
            ModelInfo { id: "gpt-5.6-sol".to_string(), name: "GPT-5.6 Sol".to_string() },
            ModelInfo { id: "gpt-5.6-terra".to_string(), name: "GPT-5.6 Terra".to_string() },
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

    let gemini_key = std::env::var("GEMINI_API_KEY").unwrap_or_default();
    providers.push(ProviderInfo {
        id: "gemini".to_string(),
        name: "Google Gemini".to_string(),
        models: vec![
            ModelInfo { id: "gemini-3-pro-preview".to_string(), name: "Gemini 3 Pro".to_string() },
            ModelInfo { id: "gemini-3-flash-preview".to_string(), name: "Gemini 3 Flash".to_string() },
        ],
        requires_key: true,
        configured: !gemini_key.is_empty(),
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
    let effort = body.reasoning_effort;

    match provider {
        "openai" => chat_openai(&body.messages, model, max_tokens, body.api_key.as_deref(), effort).await,
        "anthropic" => chat_anthropic(&body.messages, model, max_tokens, temperature, body.api_key.as_deref(), effort).await,
        "gemini" => chat_gemini(&body.messages, model, max_tokens, temperature, body.api_key.as_deref(), effort).await,
        "ollama" => chat_ollama(&body.messages, model, max_tokens, temperature, effort).await,
        "mock" => chat_mock(&body.messages, model, effort).await,
        _ => HttpResponse::BadRequest().json(serde_json::json!({"error": "Unknown AI provider"})),
    }
}

async fn chat_openai(
    messages: &[ChatMessage],
    model: &str,
    max_tokens: u32,
    request_key: Option<&str>,
    effort: ReasoningEffort,
) -> HttpResponse {
    let api_key = match request_key.map(str::to_owned).or_else(|| std::env::var("OPENAI_API_KEY").ok()) {
        Some(k) if !k.is_empty() => k,
        _ => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Add your OpenAI API key in Settings to use this model."})),
    };

    let base_url = std::env::var("OPENAI_BASE_URL")
        .unwrap_or_else(|_| "https://api.openai.com/v1".to_string());

    let client = Client::new();
    let input: Vec<serde_json::Value> = messages.iter().map(|m| {
        serde_json::json!({"role": m.role, "content": [{"type": "input_text", "text": m.content}]})
    }).collect();

    let resp = client.post(format!("{}/responses", base_url))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": model,
            "input": input,
            "max_output_tokens": max_tokens,
            "reasoning": { "effort": effort.as_str(), "context": "all_turns" },
        }))
        .send()
        .await;

    match resp {
        Ok(r) => {
            let _status = r.status();
            match r.text().await {
                Ok(text) => {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                        if val.get("error").is_some() {
                            return HttpResponse::BadGateway().json(&val);
                        }
                        let content = val["output"].as_array().into_iter().flatten()
                            .flat_map(|item| item["content"].as_array().into_iter().flatten())
                            .filter_map(|part| part["text"].as_str())
                            .collect::<Vec<_>>().join("\n");
                        let usage = &val["usage"];
                        chat_response(content, model, "openai",
                            usage["input_tokens"].as_u64().unwrap_or(0) as usize,
                            usage["output_tokens"].as_u64().unwrap_or(0) as usize, effort)
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
    request_key: Option<&str>,
    effort: ReasoningEffort,
) -> HttpResponse {
    let api_key = match request_key.map(str::to_owned).or_else(|| std::env::var("ANTHROPIC_API_KEY").ok()) {
        Some(k) if !k.is_empty() => k,
        _ => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Add your Anthropic API key in Settings to use this model."})),
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
        "thinking": { "type": "adaptive" },
        "output_config": { "effort": effort.as_str() },
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
                        let content = val["content"].as_array().into_iter().flatten()
                            .filter_map(|block| block["text"].as_str())
                            .collect::<Vec<_>>().join("\n");
                        let input_tokens = val["usage"]["input_tokens"]
                            .as_u64().unwrap_or(0) as usize;
                        let output_tokens = val["usage"]["output_tokens"]
                            .as_u64().unwrap_or(0) as usize;

                        chat_response(content, model, "anthropic", input_tokens, output_tokens, effort)
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

async fn chat_gemini(
    messages: &[ChatMessage],
    model: &str,
    max_tokens: u32,
    temperature: f32,
    request_key: Option<&str>,
    effort: ReasoningEffort,
) -> HttpResponse {
    let api_key = match request_key.map(str::to_owned).or_else(|| std::env::var("GEMINI_API_KEY").ok()) {
        Some(k) if !k.is_empty() => k,
        _ => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Add your Gemini API key in Settings to use this model."})),
    };

    let contents: Vec<serde_json::Value> = messages.iter()
        .filter(|m| m.role != "system")
        .map(|m| serde_json::json!({
            "role": if m.role == "assistant" { "model" } else { "user" },
            "parts": [{ "text": m.content }]
        }))
        .collect();
    let system = messages.iter().filter(|m| m.role == "system")
        .map(|m| m.content.as_str()).collect::<Vec<_>>().join("\n");

    let mut payload = serde_json::json!({
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": temperature,
            "thinkingConfig": { "thinkingLevel": effort.as_str() }
        }
    });
    if !system.is_empty() {
        payload["systemInstruction"] = serde_json::json!({ "parts": [{ "text": system }] });
    }

    let result = Client::new()
        .post(format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent", model))
        .header("x-goog-api-key", api_key)
        .json(&payload)
        .send().await;

    match result {
        Ok(r) => match r.json::<serde_json::Value>().await {
            Ok(val) => {
                if val.get("error").is_some() {
                    return HttpResponse::BadGateway().json(&val);
                }
                let content = val["candidates"][0]["content"]["parts"].as_array().into_iter().flatten()
                    .filter_map(|part| part["text"].as_str()).collect::<Vec<_>>().join("\n");
                let usage = &val["usageMetadata"];
                chat_response(content, model, "gemini",
                    usage["promptTokenCount"].as_u64().unwrap_or(0) as usize,
                    usage["candidatesTokenCount"].as_u64().unwrap_or(0) as usize,
                    effort)
            }
            Err(e) => HttpResponse::BadGateway().json(serde_json::json!({"error": e.to_string()})),
        },
        Err(e) => HttpResponse::BadGateway().json(serde_json::json!({"error": e.to_string()})),
    }
}

async fn chat_ollama(
    messages: &[ChatMessage],
    model: &str,
    max_tokens: u32,
    temperature: f32,
    effort: ReasoningEffort,
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

                        chat_response(content, model, "ollama", prompt_tokens, eval_count, effort)
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
    effort: ReasoningEffort,
) -> HttpResponse {
    let response = "## Demo mode\n\nI haven't read your repository, so I won't invent a summary, diagnosis, or code change.\n\nTo get a useful answer:\n1. Select OpenAI, Anthropic, Gemini, or Ollama in Settings and add a key when required.\n2. Open or connect a workspace.\n3. Use **Agent Tasks** for repository investigation, edits, and verification; use **Chat** for focused questions about an open file.\n\nA real Archon task reports the files it inspected, actions it took, verification it ran, and any genuine blocker.".to_string();

    let input_tokens = messages.iter().map(|m| m.content.len() / 4).sum::<usize>();
    let output_tokens = response.len() / 4;

    chat_response(response, model, "mock", input_tokens, output_tokens, effort)
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
