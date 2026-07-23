use actix_web::{body::{EitherBody, MessageBody}, dev::{ServiceRequest, ServiceResponse}, middleware::Next, Error, HttpMessage, HttpResponse};
use serde::Deserialize;

#[derive(Clone, Debug)]
pub struct AuthUser { pub id: String }

#[derive(Deserialize)]
struct SupabaseUser { id: String }

pub async fn require_auth(req: ServiceRequest, next: Next<impl MessageBody>) -> Result<ServiceResponse<EitherBody<impl MessageBody>>, Error> {
    let token = req.headers().get("Authorization").and_then(|value| value.to_str().ok()).and_then(|value| value.strip_prefix("Bearer "));
    let Some(token) = token else {
        return Ok(req.into_response(HttpResponse::Unauthorized().json(serde_json::json!({"error": "Authentication required"}))).map_into_right_body());
    };
    match validate_token(token).await {
        Some(user) => { req.extensions_mut().insert(user); Ok(next.call(req).await?.map_into_left_body()) }
        None => Ok(req.into_response(HttpResponse::Unauthorized().json(serde_json::json!({"error": "Invalid or expired session"}))).map_into_right_body()),
    }
}

async fn validate_token(token: &str) -> Option<AuthUser> {
    let url = std::env::var("SUPABASE_URL").ok()?;
    let publishable_key = std::env::var("SUPABASE_PUBLISHABLE_KEY").ok()?;
    let response = reqwest::Client::new().get(format!("{}/auth/v1/user", url.trim_end_matches('/'))).header("apikey", publishable_key).bearer_auth(token).send().await.ok()?;
    if !response.status().is_success() { return None; }
    let user = response.json::<SupabaseUser>().await.ok()?;
    Some(AuthUser { id: user.id })
}
