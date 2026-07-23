// Agent task runtime module.
//
// Submodules:
//   domain         — AgentTask, AgentEvent, TaskStatus state machine
//   repository     — in-memory TaskStore with per-user access enforcement
//   workspace      — WorkspacePolicy: path containment validation
//   model_adapter  — provider-agnostic model call interface
//   runner         — background task execution loop
//   routes         — HTTP handlers for the agent task API

pub mod domain;
pub mod memory;
pub mod model_adapter;
pub mod repository;
pub mod routes;
pub mod runner;
pub mod workspace;
