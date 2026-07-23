// =============================================================
// Workspace path containment policy.
//
// Every file/directory operation in the agent runner must call
// `WorkspacePolicy::resolve` before touching the filesystem.  The
// policy rejects:
//
//   - Absolute paths (leading / or Windows drive prefix)
//   - Parent-directory traversal (../ sequences that escape root)
//   - Paths that resolve outside the workspace root
//
// Symlink escape is NOT fully protected here — that requires
// `std::fs::canonicalize` which touches the filesystem and fails on
// paths that don't exist yet.  Full symlink protection requires either
// OS-level sandboxing (future) or a stat-based loop after resolve.
// This limitation is documented below for the implementer.
// =============================================================

use std::path::{Component, Path, PathBuf};

/// Validates and resolves user-supplied relative paths into absolute
/// paths that are guaranteed (modulo symlinks) to be inside the
/// workspace root.
#[derive(Clone, Debug)]
pub struct WorkspacePolicy {
    /// Canonical absolute path to the workspace root.
    pub workspace_root: PathBuf,
}

#[derive(Debug, PartialEq, Eq)]
pub enum PolicyError {
    /// Path starts with an absolute root (/ or a drive prefix).
    AbsolutePath,
    /// A `..` component would escape the workspace root.
    Traversal,
    /// After component-by-component resolution, path is outside workspace.
    OutsideWorkspace,
}

impl std::fmt::Display for PolicyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::AbsolutePath => write!(f, "absolute paths are not permitted"),
            Self::Traversal => write!(f, "path traversal detected"),
            Self::OutsideWorkspace => write!(f, "path resolves outside the workspace"),
        }
    }
}

impl WorkspacePolicy {
    pub fn new(workspace_root: impl Into<PathBuf>) -> Self {
        Self {
            workspace_root: workspace_root.into(),
        }
    }

    /// Resolve a user-supplied path into an absolute path inside the
    /// workspace root.  Does NOT canonicalize (no filesystem access), so
    /// symlinks that point outside the workspace are not caught here.
    ///
    /// # Errors
    ///
    /// Returns `PolicyError` if the path is absolute, contains traversal,
    /// or resolves outside the workspace root.
    pub fn resolve(&self, requested: &str) -> Result<PathBuf, PolicyError> {
        let path = Path::new(requested);

        // Reject absolute paths immediately
        if path.is_absolute() {
            return Err(PolicyError::AbsolutePath);
        }

        let mut resolved = self.workspace_root.clone();

        for component in path.components() {
            match component {
                Component::Normal(part) => {
                    resolved.push(part);
                }
                Component::CurDir => {
                    // "." — skip, stay in place
                }
                Component::ParentDir => {
                    // ".." — move up, but never above workspace root
                    if !resolved.pop() {
                        return Err(PolicyError::Traversal);
                    }
                    if !resolved.starts_with(&self.workspace_root) {
                        return Err(PolicyError::Traversal);
                    }
                }
                Component::RootDir | Component::Prefix(_) => {
                    // These only appear in absolute paths on Windows
                    return Err(PolicyError::AbsolutePath);
                }
            }
        }

        // Belt-and-suspenders: confirm resolved is still inside the root
        if !resolved.starts_with(&self.workspace_root) {
            return Err(PolicyError::OutsideWorkspace);
        }

        Ok(resolved)
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn policy() -> WorkspacePolicy {
        WorkspacePolicy::new(PathBuf::from("/workspace/user-abc"))
    }

    // ── Happy paths ───────────────────────────────────────────────────────────

    #[test]
    fn normal_relative_path() {
        let p = policy().resolve("src/main.rs").unwrap();
        assert_eq!(p, PathBuf::from("/workspace/user-abc/src/main.rs"));
    }

    #[test]
    fn dot_slash_prefix() {
        let p = policy().resolve("./src/lib.rs").unwrap();
        assert_eq!(p, PathBuf::from("/workspace/user-abc/src/lib.rs"));
    }

    #[test]
    fn dot_resolves_to_workspace_root() {
        let p = policy().resolve(".").unwrap();
        assert_eq!(p, PathBuf::from("/workspace/user-abc"));
    }

    #[test]
    fn empty_string_resolves_to_workspace_root() {
        let p = policy().resolve("").unwrap();
        assert_eq!(p, PathBuf::from("/workspace/user-abc"));
    }

    #[test]
    fn parent_within_workspace_is_ok() {
        // src/.. stays inside the workspace
        let p = policy().resolve("src/..").unwrap();
        assert_eq!(p, PathBuf::from("/workspace/user-abc"));
    }

    #[test]
    fn nested_parent_within_workspace_is_ok() {
        let p = policy().resolve("a/b/../c").unwrap();
        assert_eq!(p, PathBuf::from("/workspace/user-abc/a/c"));
    }

    // ── Rejection paths ───────────────────────────────────────────────────────

    #[test]
    fn absolute_path_rejected() {
        let err = policy().resolve("/etc/passwd").unwrap_err();
        assert_eq!(err, PolicyError::AbsolutePath);
    }

    #[test]
    fn simple_traversal_rejected() {
        let err = policy().resolve("../other-user").unwrap_err();
        assert!(
            matches!(err, PolicyError::Traversal | PolicyError::OutsideWorkspace),
            "expected traversal error, got {:?}",
            err
        );
    }

    #[test]
    fn deep_traversal_rejected() {
        let err = policy().resolve("../../etc/shadow").unwrap_err();
        assert!(
            matches!(err, PolicyError::Traversal | PolicyError::OutsideWorkspace),
            "expected traversal error, got {:?}",
            err
        );
    }

    #[test]
    fn interleaved_traversal_rejected() {
        // Disguise: go into a dir, then back up past root
        let err = policy().resolve("src/../../../etc/passwd").unwrap_err();
        assert!(
            matches!(err, PolicyError::Traversal | PolicyError::OutsideWorkspace),
            "expected traversal error, got {:?}",
            err
        );
    }

    #[test]
    fn double_dot_only_rejected() {
        let err = policy().resolve("..").unwrap_err();
        assert!(
            matches!(err, PolicyError::Traversal | PolicyError::OutsideWorkspace),
            "expected traversal error, got {:?}",
            err
        );
    }

    // ── Security notes ────────────────────────────────────────────────────────

    // LIMITATION: symlinks are not resolved; a symlink inside the workspace
    // that points to /etc/passwd would pass this check.  Full protection
    // requires OS-level sandboxing or canonicalize + prefix check after
    // confirming the target exists.  This is documented as a known gap.
    //
    // On Windows, the Component::Prefix(_) arm handles drive prefixes
    // (e.g. "C:\") — they are rejected as absolute paths.
}
