use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkspaceStatus {
    Pending,
    Provisioning,
    Running,
    Stopped,
    Error,
    Deleting,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Workspace {
    pub id: Uuid,
    pub owner_id: String,
    pub name: String,
    pub status: WorkspaceStatus,
    /// The physical path on the server where this workspace is provisioned.
    /// This is strictly internal and NEVER serialized to the client.
    #[serde(skip)]
    pub server_path: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Workspace {
    pub fn new(owner_id: String, name: String, server_path: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            owner_id,
            name,
            status: WorkspaceStatus::Running, // Assume Running for in-memory mock
            server_path,
            created_at: now,
            updated_at: now,
        }
    }
}
