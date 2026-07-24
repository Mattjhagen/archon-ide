use actix_web::{body::to_bytes, web, HttpMessage, HttpRequest, HttpResponse};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::AppState;

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ReasoningEffort {
    Low,
    Medium,
    High,
}

impl Default for ReasoningEffort {
    fn default() -> Self {
        Self::Medium
    }
}

impl ReasoningEffort {
    fn multiplier(self) -> usize {
        match self {
            Self::Low => 1,
            Self::Medium => 2,
            Self::High => 4,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
        }
    }
}

#[derive(Deserialize, Clone)]
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
    #[serde(default)]
    pub fallback_models: Vec<FallbackModel>,
}

#[derive(Deserialize, Clone)]
pub struct FallbackModel {
    pub provider: String,
    pub model: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AiJobStatus {
    Queued,
    Running,
    Completed,
    Failed,
    TimedOut,
}

#[derive(Clone, Serialize)]
pub struct AiJob {
    pub id: Uuid,
    #[serde(skip_serializing)]
    pub user_id: String,
    pub status: AiJobStatus,
    pub response: Option<serde_json::Value>,
    pub error: Option<String>,
    pub logs: Vec<AiJobLog>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Clone, Serialize)]
pub struct AiJobLog {
    pub id: Uuid,
    pub sequence: usize,
    pub created_at: DateTime<Utc>,
    pub kind: String,
    pub summary: String,
}

const DEFAULT_AI_JOB_TIMEOUT_SECONDS: u64 = 900;
const MAX_AI_JOB_TIMEOUT_SECONDS: u64 = 1800;

pub async fn create_job(
    request: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<ChatReq>,
) -> HttpResponse {
    let Some(user) = request.extensions().get::<AuthUser>().cloned() else {
        return HttpResponse::Unauthorized()
            .json(serde_json::json!({"error": "authentication required"}));
    };

    let timeout_seconds = std::env::var("AI_JOB_TIMEOUT_SECONDS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(DEFAULT_AI_JOB_TIMEOUT_SECONDS)
        .clamp(60, MAX_AI_JOB_TIMEOUT_SECONDS);

    let now = Utc::now();
    let job = AiJob {
        id: Uuid::new_v4(),
        user_id: user.id,
        status: AiJobStatus::Queued,
        response: None,
        error: None,
        logs: vec![AiJobLog {
            id: Uuid::new_v4(),
            sequence: 1,
            created_at: now,
            kind: "planning".to_string(),
            summary: "Build queued on Archon Cloud".to_string(),
        }],
        created_at: now,
        updated_at: now,
        expires_at: now + ChronoDuration::seconds(timeout_seconds as i64),
    };
    let job_id = job.id;
    state.ai_jobs.write().await.insert(job_id, job.clone());

    let jobs = state.ai_jobs.clone();
    let chat_request = body.into_inner();
    actix_web::rt::spawn(async move {
        if let Some(stored) = jobs.write().await.get_mut(&job_id) {
            stored.status = AiJobStatus::Running;
            stored.updated_at = Utc::now();
            push_job_log(stored, "message", "Background build started");
        }

        let result = tokio::time::timeout(Duration::from_secs(timeout_seconds), async {
            let mut attempts = vec![(
                chat_request.provider.clone(),
                chat_request.model.clone(),
            )];
            attempts.extend(
                chat_request
                    .fallback_models
                    .iter()
                    .map(|fallback| (Some(fallback.provider.clone()), Some(fallback.model.clone()))),
            );

            for (index, (provider, model)) in attempts.iter().enumerate() {
                if let Some(stored) = jobs.write().await.get_mut(&job_id) {
                    let provider_label = provider.as_deref().unwrap_or("automatic");
                    let model_label = model.as_deref().unwrap_or("default");
                    let summary = if index == 0 {
                        format!("Starting {provider_label} · {model_label}")
                    } else {
                        format!(
                            "Credit limit reached — handing off to {provider_label} · {model_label}"
                        )
                    };
                    push_job_log(
                        stored,
                        if index == 0 { "model_call" } else { "message" },
                        &summary,
                    );
                }

                let mut attempt = chat_request.clone();
                attempt.provider = provider.clone();
                attempt.model = model.clone();
                attempt.fallback_models.clear();

                let response = chat(web::Json(attempt)).await;
                let status = response.status();
                let bytes = to_bytes(response.into_body())
                    .await
                    .map_err(|_| "Could not read the AI response".to_string())?;
                let payload = serde_json::from_slice::<serde_json::Value>(&bytes)
                    .unwrap_or_else(|_| serde_json::json!({
                        "error": String::from_utf8_lossy(&bytes)
                    }));

                if status.is_success() {
                    return Ok(payload);
                }

                let error = provider_error_message(&payload);
                if !is_credit_limit_message(&error) || index == attempts.len() - 1 {
                    return Err(error);
                }
            }

            Err("No configured AI model could continue the build.".to_string())
        })
        .await;

        let mut all_jobs = jobs.write().await;
        let Some(stored) = all_jobs.get_mut(&job_id) else { return };
        stored.updated_at = Utc::now();

        match result {
            Err(_) => {
                stored.status = AiJobStatus::TimedOut;
                stored.error = Some(format!(
                    "Build exceeded the {} minute time limit",
                    timeout_seconds / 60
                ));
                push_job_log(stored, "error", "Build timed out");
            }
            Ok(Ok(payload)) => {
                stored.status = AiJobStatus::Completed;
                stored.response = Some(payload);
                push_job_log(stored, "completion", "Build completed");
            }
            Ok(Err(error)) => {
                stored.status = AiJobStatus::Failed;
                push_job_log(stored, "error", &format!("Build failed: {error}"));
                stored.error = Some(error);
            }
        }
    });

    HttpResponse::Accepted().json(job)
}

fn push_job_log(job: &mut AiJob, kind: &str, summary: &str) {
    job.logs.push(AiJobLog {
        id: Uuid::new_v4(),
        sequence: job.logs.len() + 1,
        created_at: Utc::now(),
        kind: kind.to_string(),
        summary: summary.to_string(),
    });
}

fn provider_error_message(payload: &serde_json::Value) -> String {
    let error = payload.get("error").unwrap_or(payload);
    error
        .as_str()
        .map(str::to_owned)
        .or_else(|| error.get("message").and_then(|value| value.as_str()).map(str::to_owned))
        .or_else(|| error.get("detail").and_then(|value| value.as_str()).map(str::to_owned))
        .or_else(|| payload.get("detail").and_then(|value| value.as_str()).map(str::to_owned))
        .unwrap_or_else(|| error.to_string())
}

fn is_credit_limit_message(message: &str) -> bool {
    let message = message.to_lowercase();
    [
        "credit",
        "quota",
        "billing",
        "payment required",
        "insufficient_quota",
        "insufficient funds",
        "usage limit",
        "spending limit",
        "rate limit",
    ]
    .iter()
    .any(|signal| message.contains(signal))
}

pub async fn get_job(
    request: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let Some(user) = request.extensions().get::<AuthUser>().cloned() else {
        return HttpResponse::Unauthorized()
            .json(serde_json::json!({"error": "authentication required"}));
    };

    let jobs = state.ai_jobs.read().await;
    match jobs.get(&path.into_inner()) {
        Some(job) if job.user_id == user.id => HttpResponse::Ok().json(job),
        _ => HttpResponse::NotFound().json(serde_json::json!({"error": "job not found"})),
    }
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

fn chat_response(
    content: String,
    model: &str,
    provider: &str,
    input: usize,
    output: usize,
    effort: ReasoningEffort,
) -> HttpResponse {
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
            ModelInfo {
                id: "gpt-5.6-sol".to_string(),
                name: "GPT-5.6 Sol".to_string(),
            },
            ModelInfo {
                id: "gpt-5.6-terra".to_string(),
                name: "GPT-5.6 Terra".to_string(),
            },
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
            ModelInfo {
                id: "claude-sonnet-4-20250514".to_string(),
                name: "Claude Sonnet 4".to_string(),
            },
            ModelInfo {
                id: "claude-haiku-4-20250414".to_string(),
                name: "Claude Haiku 4".to_string(),
            },
        ],
        requires_key: true,
        configured: !anthropic_key.is_empty(),
    });

    let gemini_key = std::env::var("GEMINI_API_KEY").unwrap_or_default();
    providers.push(ProviderInfo {
        id: "gemini".to_string(),
        name: "Google Gemini".to_string(),
        models: vec![
            ModelInfo {
                id: "gemini-3-pro-preview".to_string(),
                name: "Gemini 3 Pro".to_string(),
            },
            ModelInfo {
                id: "gemini-3-flash-preview".to_string(),
                name: "Gemini 3 Flash".to_string(),
            },
        ],
        requires_key: true,
        configured: !gemini_key.is_empty(),
    });

    // Ollama
    let ollama_url =
        std::env::var("OLLAMA_BASE_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
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
            ModelInfo {
                id: "llama3.2".to_string(),
                name: "Llama 3.2".to_string(),
            },
            ModelInfo {
                id: "codellama".to_string(),
                name: "CodeLlama".to_string(),
            },
            ModelInfo {
                id: "deepseek-coder".to_string(),
                name: "DeepSeek Coder".to_string(),
            },
        ],
        requires_key: false,
        configured: ollama_available,
    });

    let opencode_url = std::env::var("OPENCODE_BASE_URL").unwrap_or_default();
    let opencode_password = std::env::var("OPENCODE_SERVER_PASSWORD").unwrap_or_default();
    providers.push(ProviderInfo {
        id: "opencode_local".to_string(),
        name: "OpenCode (Home Server)".to_string(),
        models: vec![
            ModelInfo {
                id: "opencode/big-pickle".to_string(),
                name: "Big Pickle".to_string(),
            },
            ModelInfo {
                id: "ollama/qwen2.5-coder:7b".to_string(),
                name: "Qwen 2.5 Coder 7B (Local)".to_string(),
            },
        ],
        requires_key: false,
        configured: !opencode_url.is_empty() && !opencode_password.is_empty(),
    });

    // Mock (always available)
    providers.push(ProviderInfo {
        id: "mock".to_string(),
        name: "Mock (Demo)".to_string(),
        models: vec![ModelInfo {
            id: "mock-responses".to_string(),
            name: "Mock Responses".to_string(),
        }],
        requires_key: false,
        configured: true,
    });

    HttpResponse::Ok().json(providers)
}

pub async fn chat(body: web::Json<ChatReq>) -> HttpResponse {
    let provider = body.provider.as_deref().unwrap_or("mock");
    let model = body.model.as_deref().unwrap_or("mock-responses");
    let max_tokens = body.max_tokens.unwrap_or(2048);
    let temperature = body.temperature.unwrap_or(0.7);
    let effort = body.reasoning_effort;

    match provider {
        "openai" => {
            chat_openai(
                &body.messages,
                model,
                max_tokens,
                body.api_key.as_deref(),
                effort,
            )
            .await
        }
        "anthropic" => {
            chat_anthropic(
                &body.messages,
                model,
                max_tokens,
                temperature,
                body.api_key.as_deref(),
                effort,
            )
            .await
        }
        "gemini" => {
            chat_gemini(
                &body.messages,
                model,
                max_tokens,
                temperature,
                body.api_key.as_deref(),
                effort,
            )
            .await
        }
        "ollama" => chat_ollama(&body.messages, model, max_tokens, temperature, effort).await,
        "opencode_local" => chat_opencode(&body.messages, model, effort).await,
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
    let api_key = match request_key
        .map(str::to_owned)
        .or_else(|| std::env::var("OPENAI_API_KEY").ok())
    {
        Some(k) if !k.is_empty() => k,
        _ => return HttpResponse::BadRequest().json(
            serde_json::json!({"error": "Add your OpenAI API key in Settings to use this model."}),
        ),
    };

    let base_url = std::env::var("OPENAI_BASE_URL")
        .unwrap_or_else(|_| "https://api.openai.com/v1".to_string());

    let client = Client::new();
    let input: Vec<serde_json::Value> = messages.iter().map(|m| {
        serde_json::json!({"role": m.role, "content": [{"type": "input_text", "text": m.content}]})
    }).collect();

    let resp = client
        .post(format!("{}/responses", base_url))
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
                        let content = val["output"]
                            .as_array()
                            .into_iter()
                            .flatten()
                            .flat_map(|item| item["content"].as_array().into_iter().flatten())
                            .filter_map(|part| part["text"].as_str())
                            .collect::<Vec<_>>()
                            .join("\n");
                        let usage = &val["usage"];
                        chat_response(
                            content,
                            model,
                            "openai",
                            usage["input_tokens"].as_u64().unwrap_or(0) as usize,
                            usage["output_tokens"].as_u64().unwrap_or(0) as usize,
                            effort,
                        )
                    } else {
                        HttpResponse::BadGateway()
                            .json(serde_json::json!({"error": "Invalid response from provider"}))
                    }
                }
                Err(e) => {
                    HttpResponse::BadGateway().json(serde_json::json!({"error": e.to_string()}))
                }
            }
        }
        Err(e) => HttpResponse::BadGateway().json(serde_json::json!({"error": e.to_string()})),
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

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await;

    match resp {
        Ok(r) => match r.text().await {
            Ok(text) => {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                    let content = val["content"]
                        .as_array()
                        .into_iter()
                        .flatten()
                        .filter_map(|block| block["text"].as_str())
                        .collect::<Vec<_>>()
                        .join("\n");
                    let input_tokens = val["usage"]["input_tokens"].as_u64().unwrap_or(0) as usize;
                    let output_tokens =
                        val["usage"]["output_tokens"].as_u64().unwrap_or(0) as usize;

                    chat_response(
                        content,
                        model,
                        "anthropic",
                        input_tokens,
                        output_tokens,
                        effort,
                    )
                } else {
                    HttpResponse::BadGateway()
                        .json(serde_json::json!({"error": "Invalid response"}))
                }
            }
            Err(e) => HttpResponse::BadGateway().json(serde_json::json!({"error": e.to_string()})),
        },
        Err(e) => HttpResponse::BadGateway().json(serde_json::json!({"error": e.to_string()})),
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
    let api_key = match request_key
        .map(str::to_owned)
        .or_else(|| std::env::var("GEMINI_API_KEY").ok())
    {
        Some(k) if !k.is_empty() => k,
        _ => return HttpResponse::BadRequest().json(
            serde_json::json!({"error": "Add your Gemini API key in Settings to use this model."}),
        ),
    };

    let contents: Vec<serde_json::Value> = messages
        .iter()
        .filter(|m| m.role != "system")
        .map(|m| {
            serde_json::json!({
                "role": if m.role == "assistant" { "model" } else { "user" },
                "parts": [{ "text": m.content }]
            })
        })
        .collect();
    let system = messages
        .iter()
        .filter(|m| m.role == "system")
        .map(|m| m.content.as_str())
        .collect::<Vec<_>>()
        .join("\n");

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
        .post(format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
            model
        ))
        .header("x-goog-api-key", api_key)
        .json(&payload)
        .send()
        .await;

    match result {
        Ok(r) => match r.json::<serde_json::Value>().await {
            Ok(val) => {
                if val.get("error").is_some() {
                    return HttpResponse::BadGateway().json(&val);
                }
                let content = val["candidates"][0]["content"]["parts"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|part| part["text"].as_str())
                    .collect::<Vec<_>>()
                    .join("\n");
                let usage = &val["usageMetadata"];
                chat_response(
                    content,
                    model,
                    "gemini",
                    usage["promptTokenCount"].as_u64().unwrap_or(0) as usize,
                    usage["candidatesTokenCount"].as_u64().unwrap_or(0) as usize,
                    effort,
                )
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
    let base_url =
        std::env::var("OLLAMA_BASE_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());

    let client = Client::new();
    let msgs: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| serde_json::json!({"role": m.role, "content": m.content}))
        .collect();

    let resp = client
        .post(format!("{}/api/chat", base_url))
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
        Ok(r) => match r.text().await {
            Ok(text) => {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                    let content = val["message"]["content"].as_str().unwrap_or("").to_string();
                    let prompt_tokens = val["prompt_eval_count"].as_u64().unwrap_or(0) as usize;
                    let eval_count = val["eval_count"].as_u64().unwrap_or(0) as usize;

                    chat_response(content, model, "ollama", prompt_tokens, eval_count, effort)
                } else {
                    HttpResponse::BadGateway()
                        .json(serde_json::json!({"error": "Invalid response"}))
                }
            }
            Err(e) => HttpResponse::BadGateway().json(serde_json::json!({"error": e.to_string()})),
        },
        Err(e) => HttpResponse::BadGateway().json(serde_json::json!({"error": e.to_string()})),
    }
}

async fn chat_opencode(
    messages: &[ChatMessage],
    model: &str,
    effort: ReasoningEffort,
) -> HttpResponse {
    let base_url = match std::env::var("OPENCODE_BASE_URL") {
        Ok(value) if !value.is_empty() => value.trim_end_matches('/').to_string(),
        _ => {
            return HttpResponse::ServiceUnavailable()
                .json(serde_json::json!({"error": "The home OpenCode server is not configured."}))
        }
    };
    let password = match std::env::var("OPENCODE_SERVER_PASSWORD") {
        Ok(value) if !value.is_empty() => value,
        _ => return HttpResponse::ServiceUnavailable().json(
            serde_json::json!({"error": "The home OpenCode server password is not configured."}),
        ),
    };
    let Some((provider_id, model_id)) = model.split_once('/') else {
        return HttpResponse::BadRequest()
            .json(serde_json::json!({"error": "Invalid OpenCode model selection."}));
    };

    let client = match Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(300))
        .build()
    {
        Ok(client) => client,
        Err(error) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": error.to_string()}))
        }
    };

    let session_response = client
        .post(format!("{base_url}/session"))
        .basic_auth("opencode", Some(&password))
        .json(&serde_json::json!({"title": "Archon mobile request"}))
        .send()
        .await;
    let session_response = match session_response {
        Ok(response) if response.status().is_success() => response,
        Ok(response) => {
            let status = response.status();
            let detail = response.text().await.unwrap_or_default();
            return HttpResponse::BadGateway().json(serde_json::json!({
                "error": format!("OpenCode could not create a session ({status})."),
                "detail": detail
            }));
        }
        Err(error) => {
            return HttpResponse::BadGateway().json(serde_json::json!({
                "error": "The home OpenCode server could not be reached.",
                "detail": error.to_string()
            }))
        }
    };
    let session: serde_json::Value = match session_response.json().await {
        Ok(value) => value,
        Err(error) => return HttpResponse::BadGateway().json(
            serde_json::json!({"error": format!("OpenCode returned an invalid session: {error}")}),
        ),
    };
    let Some(session_id) = session["id"].as_str() else {
        return HttpResponse::BadGateway()
            .json(serde_json::json!({"error": "OpenCode did not return a session ID."}));
    };

    let last_user_index = messages.iter().rposition(|message| message.role == "user");
    let prompt = last_user_index
        .and_then(|index| messages.get(index))
        .map(|message| message.content.clone())
        .unwrap_or_else(|| {
            messages
                .iter()
                .map(|message| message.content.as_str())
                .collect::<Vec<_>>()
                .join("\n")
        });
    let context = messages
        .iter()
        .enumerate()
        .filter(|(index, _)| Some(*index) != last_user_index)
        .map(|(_, message)| format!("{}: {}", message.role, message.content))
        .collect::<Vec<_>>()
        .join("\n\n");

    let build_mode = should_use_build_mode(&prompt);
    let agent = if build_mode { "build" } else { "plan" };
    let mut request = serde_json::json!({
        "agent": agent,
        "model": {
            "providerID": provider_id,
            "modelID": model_id
        },
        "tools": {
            "invalid": false,
            "question": false,
            "bash": build_mode,
            "read": build_mode,
            "glob": build_mode,
            "grep": build_mode,
            "edit": build_mode,
            "write": build_mode,
            "task": false,
            "webfetch": false,
            "todowrite": build_mode,
            "websearch": false,
            "skill": false,
            "apply_patch": build_mode
        },
        "parts": [{
            "type": "text",
            "text": prompt
        }]
    });
    let mode_instruction = if build_mode {
        "You are already in build mode and the user has approved execution. Implement the request now, use the available file tools, and verify the result. Never claim you are in plan mode. Ignore any earlier assistant statement that said execution still needs confirmation. Make reasonable implementation decisions yourself; ask only when a missing secret or an irreversible choice makes progress impossible."
    } else {
        "The user explicitly requested planning. Work in read-only plan mode, produce a concise implementation plan, and ask only when a decision is genuinely required."
    };
    request["system"] = serde_json::json!(if context.is_empty() {
        mode_instruction.to_string()
    } else {
        format!(
            "{mode_instruction}\n\nContinue with this relevant conversation memory:\n\n{context}"
        )
    });

    let response = client
        .post(format!("{base_url}/session/{session_id}/message"))
        .basic_auth("opencode", Some(&password))
        .json(&request)
        .send()
        .await;
    let response = match response {
        Ok(response) if response.status().is_success() => response,
        Ok(response) => {
            let status = response.status();
            let detail = response.text().await.unwrap_or_default();
            return HttpResponse::BadGateway().json(serde_json::json!({
                "error": format!("OpenCode rejected the message ({status})."),
                "detail": detail
            }));
        }
        Err(error) => {
            return HttpResponse::BadGateway().json(serde_json::json!({
                "error": "OpenCode did not complete the request.",
                "detail": error.to_string()
            }))
        }
    };
    let value: serde_json::Value = match response.json().await {
        Ok(value) => value,
        Err(error) => return HttpResponse::BadGateway().json(
            serde_json::json!({"error": format!("OpenCode returned an invalid response: {error}")}),
        ),
    };
    if let Some(error) = value["info"]["error"].as_object() {
        return HttpResponse::BadGateway().json(serde_json::json!({
            "error": "The selected OpenCode model failed.",
            "detail": error
        }));
    }

    let content = value["parts"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|part| part["type"].as_str() == Some("text"))
        .filter_map(|part| part["text"].as_str())
        .collect::<Vec<_>>()
        .join("\n");
    if content.trim().is_empty() {
        return HttpResponse::BadGateway()
            .json(serde_json::json!({"error": "OpenCode completed without returning any text."}));
    }

    let input_tokens = value["info"]["tokens"]["input"].as_u64().unwrap_or(0) as usize;
    let output_tokens = value["info"]["tokens"]["output"].as_u64().unwrap_or(0) as usize;
    chat_response(
        content,
        model,
        "opencode_local",
        input_tokens,
        output_tokens,
        effort,
    )
}

fn should_use_build_mode(prompt: &str) -> bool {
    let normalized = prompt
        .to_lowercase()
        .replace(['’', '\''], "")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    let build_approvals = [
        "build it",
        "build this",
        "start building",
        "implement it",
        "implement this",
        "go ahead",
        "proceed",
        "execute the plan",
        "exit plan mode",
        "make the changes",
        "apply the changes",
        "create the files",
        "ship it",
    ]
    .iter()
    .any(|phrase| normalized.contains(phrase));

    if build_approvals {
        return true;
    }

    let explicit_plan_requests = [
        "plan ",
        "make a plan",
        "planning only",
        "do not build",
        "dont build",
        "read only",
        "review ",
        "brainstorm",
        "compare ",
        "show me options",
        "what are my options",
        "which framework",
        "what framework",
        "recommend an approach",
    ];

    !explicit_plan_requests
        .iter()
        .any(|phrase| normalized.contains(phrase))
}

async fn chat_mock(messages: &[ChatMessage], model: &str, effort: ReasoningEffort) -> HttpResponse {
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

pub async fn complete(body: web::Json<CompleteReq>) -> HttpResponse {
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

#[cfg(test)]
mod mode_tests {
    use super::should_use_build_mode;

    #[test]
    fn approval_language_switches_to_build_mode() {
        for prompt in [
            "Build it",
            "Go ahead and implement this",
            "Proceed with the plan",
            "Exit plan mode and build",
        ] {
            assert!(should_use_build_mode(prompt), "{prompt}");
        }
    }

    #[test]
    fn planning_language_remains_in_plan_mode() {
        for prompt in [
            "Plan a weather dashboard",
            "What framework should I use?",
            "Review these requirements",
            "Do not build anything yet, show me options",
        ] {
            assert!(!should_use_build_mode(prompt), "{prompt}");
        }
    }

    #[test]
    fn normal_builder_requests_execute_without_extra_confirmation() {
        for prompt in [
            "A weather dashboard with animated icons",
            "Add authentication",
            "Fix the navigation bug",
            "Make the cards more polished",
        ] {
            assert!(should_use_build_mode(prompt), "{prompt}");
        }
    }
}
