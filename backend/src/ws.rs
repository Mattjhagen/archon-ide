use actix_web::{web, HttpRequest, HttpResponse};
use actix_ws::Message;
use futures::StreamExt;
use serde::{Deserialize, Serialize};

pub async fn ws_handler(
    req: HttpRequest,
    body: web::Payload,
) -> HttpResponse {
    let (response, mut session, mut msg_stream) = match actix_ws::handle(&req, body) {
        Ok(result) => result,
        Err(_e) => return HttpResponse::InternalServerError().finish(),
    };

    actix_web::rt::spawn(async move {
        while let Some(Ok(msg)) = msg_stream.next().await {
            match msg {
                Message::Ping(bytes) => {
                    if session.pong(&bytes).await.is_err() {
                        return;
                    }
                }
                Message::Text(text) => {
                    if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text) {
                        let response = handle_ws_message(ws_msg).await;
                        if let Ok(resp_json) = serde_json::to_string(&response) {
                            if session.text(resp_json).await.is_err() {
                                return;
                            }
                        }
                    }
                }
                Message::Close(_) => {
                    break;
                }
                _ => {}
            }
        }
    });

    response
}

#[derive(Deserialize)]
struct WsMessage {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(default)]
    id: String,
    _payload: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct WsResponse {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(default)]
    id: String,
    payload: serde_json::Value,
}

async fn handle_ws_message(msg: WsMessage) -> WsResponse {
    match msg.msg_type.as_str() {
        "ping" => WsResponse {
            msg_type: "pong".to_string(),
            id: msg.id,
            payload: serde_json::json!({"ok": true}),
        },
        "subscribe_terminal" => {
            // Terminal output would be streamed via separate mechanism
            WsResponse {
                msg_type: "subscribed".to_string(),
                id: msg.id,
                payload: serde_json::json!({"channel": "terminal"}),
            }
        }
        _ => WsResponse {
            msg_type: "error".to_string(),
            id: msg.id,
            payload: serde_json::json!({"error": "Unknown message type"}),
        },
    }
}
