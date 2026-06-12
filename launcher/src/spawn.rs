use anyhow::{bail, Context, Result};
use std::path::{Path, PathBuf};
use std::process::{Child, Command};

#[cfg(windows)]
pub const NODE_BIN: &str = "node.exe";
#[cfg(not(windows))]
pub const NODE_BIN: &str = "node";

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Resolve the Node binary: `<deps>/node/bin/<bin>` -> `<deps>/node/<bin>` ->
/// `<exe_dir>/seed/node/bin/<bin>` -> `<exe_dir>/seed/node/<bin>` -> error.
pub fn resolve_node_with(deps_path: Option<&str>, exe_dir: &Path) -> Result<PathBuf> {
    if let Some(deps) = deps_path {
        let c = Path::new(deps).join("node").join("bin").join(NODE_BIN);
        if c.exists() { return Ok(c); }
        let c = Path::new(deps).join("node").join(NODE_BIN);
        if c.exists() { return Ok(c); }
    }
    let seed = exe_dir.join("seed").join("node").join("bin").join(NODE_BIN);
    if seed.exists() { return Ok(seed); }
    let seed = exe_dir.join("seed").join("node").join(NODE_BIN);
    if seed.exists() { return Ok(seed); }
    bail!("Node not found. Set SVGEDIT_DEPS_PATH or place a Node binary at {:?}", seed)
}

/// svgedit's server entry is `<exe_dir>/dist/server/index.js`.
pub fn resolve_server_entry_with(exe_dir: &Path) -> Result<PathBuf> {
    let entry = exe_dir.join("dist").join("server").join("index.js");
    if entry.exists() { Ok(entry) } else { bail!("Server entry not found at {:?}", entry) }
}

/// Spawn the Node server with a hidden console (Windows). The child reads
/// `SVGEDIT_DATA_ROOT`; it picks + persists its own port. No DEPS_PATH (svgedit
/// has no DependencyManager) and no browser env (browser-open is launcher-side).
pub fn spawn_server(deps_path: &Path, data_root: &Path) -> Result<Child> {
    let exe = std::env::current_exe()?;
    let work_dir = exe.parent().context("exe has no parent dir")?.to_path_buf();
    let deps_str = deps_path.to_str().context("deps_path is not valid UTF-8")?;
    let node = resolve_node_with(Some(deps_str), &work_dir)?;
    let entry = resolve_server_entry_with(&work_dir)?;

    let mut cmd = Command::new(&node);
    cmd.arg(&entry)
        .current_dir(&work_dir)
        .env("SVGEDIT_DATA_ROOT", data_root);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let child = cmd
        .spawn()
        .with_context(|| format!("failed to spawn {:?} {:?}", node, entry))?;

    #[cfg(windows)]
    if let Err(e) = crate::job_object::adopt(&child) {
        crate::log::error(&format!("could not adopt Node child into Job Object: {e:#}"));
    }

    Ok(child)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn touch(path: &Path) {
        if let Some(parent) = path.parent() { fs::create_dir_all(parent).unwrap(); }
        fs::write(path, b"stub").unwrap();
    }

    #[test]
    fn resolve_node_uses_deps_path_when_present() {
        let dir = tempdir().unwrap();
        let deps = dir.path().join("deps");
        let node = deps.join("node").join(NODE_BIN);
        touch(&node);
        let exe_dir = dir.path().join("exe");
        fs::create_dir_all(&exe_dir).unwrap();
        assert_eq!(resolve_node_with(Some(deps.to_str().unwrap()), &exe_dir).unwrap(), node);
    }

    #[test]
    fn resolve_node_prefers_bin_subdirectory() {
        let dir = tempdir().unwrap();
        let deps = dir.path().join("deps");
        let bin_node = deps.join("node").join("bin").join(NODE_BIN);
        let flat_node = deps.join("node").join(NODE_BIN);
        touch(&bin_node);
        touch(&flat_node);
        let exe_dir = dir.path().join("exe");
        fs::create_dir_all(&exe_dir).unwrap();
        assert_eq!(resolve_node_with(Some(deps.to_str().unwrap()), &exe_dir).unwrap(), bin_node);
    }

    #[test]
    fn resolve_node_falls_back_to_seed() {
        let dir = tempdir().unwrap();
        let exe_dir = dir.path().join("exe");
        let seed = exe_dir.join("seed").join("node").join(NODE_BIN);
        touch(&seed);
        assert_eq!(resolve_node_with(None, &exe_dir).unwrap(), seed);
    }

    #[test]
    fn resolve_node_errors_when_missing() {
        let dir = tempdir().unwrap();
        let exe_dir = dir.path().join("exe");
        fs::create_dir_all(&exe_dir).unwrap();
        assert!(resolve_node_with(None, &exe_dir).unwrap_err().to_string().contains("Node not found"));
    }

    #[test]
    fn resolve_server_entry_finds_dist_server_index_js() {
        let dir = tempdir().unwrap();
        let exe_dir = dir.path().join("exe");
        let entry = exe_dir.join("dist").join("server").join("index.js");
        touch(&entry);
        assert_eq!(resolve_server_entry_with(&exe_dir).unwrap(), entry);
    }

    #[test]
    fn resolve_server_entry_errors_when_missing() {
        let dir = tempdir().unwrap();
        let exe_dir = dir.path().join("exe");
        fs::create_dir_all(&exe_dir).unwrap();
        assert!(resolve_server_entry_with(&exe_dir).unwrap_err().to_string().contains("Server entry not found"));
    }
}
