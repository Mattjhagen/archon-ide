use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::workspace::domain::Workspace;

pub struct WorkspaceStore {
    workspaces: RwLock<HashMap<Uuid, Workspace>>,
}

impl WorkspaceStore {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            workspaces: RwLock::new(HashMap::new()),
        })
    }

    pub async fn create(&self, workspace: Workspace) -> Workspace {
        let id = workspace.id;
        self.workspaces.write().await.insert(id, workspace.clone());
        workspace
    }

    pub async fn get_for_user(&self, id: Uuid, user_id: &str) -> Option<Workspace> {
        let workspaces = self.workspaces.read().await;
        let ws = workspaces.get(&id)?;
        if ws.owner_id != user_id {
            return None;
        }
        Some(ws.clone())
    }

    pub async fn list_for_user(&self, user_id: &str) -> Vec<Workspace> {
        let workspaces = self.workspaces.read().await;
        let mut result: Vec<Workspace> = workspaces
            .values()
            .filter(|w| w.owner_id == user_id)
            .cloned()
            .collect();
        result.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        result
    }
}
