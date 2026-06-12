use std::io::{IsTerminal, Write};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

static BASENAME: OnceLock<String> = OnceLock::new();

pub fn init(name: &str) {
    let _ = BASENAME.set(name.to_string());
}

fn basename() -> &'static str {
    BASENAME.get().map(String::as_str).unwrap_or("svgedit-launcher")
}

fn log_path() -> Option<PathBuf> {
    let filename = format!("{}.log", basename());
    if let Ok(data_root) = crate::config::data_root_from_env() {
        let logs = data_root.join("logs");
        let _ = std::fs::create_dir_all(&logs);
        if logs.exists() {
            return Some(logs.join(&filename));
        }
    }
    let exe = std::env::current_exe().ok()?;
    Some(exe.parent()?.join(&filename))
}

fn dot_one(path: &Path) -> PathBuf {
    let mut s = path.as_os_str().to_owned();
    s.push(".1");
    PathBuf::from(s)
}

/// Rename `path` to `path.1` when it reaches `max_bytes` (single backup).
pub fn rotate_by_rename_if_large(path: &Path, max_bytes: u64) {
    if let Ok(meta) = std::fs::metadata(path) {
        if meta.len() >= max_bytes {
            let backup = dot_one(path);
            let _ = std::fs::remove_file(&backup); // Windows rename won't overwrite
            let _ = std::fs::rename(path, &backup);
        }
    }
}

fn write_line(level: &str, msg: &str) {
    let line = format!("[{level}] {msg}\n");
    if let Some(path) = log_path() {
        rotate_by_rename_if_large(&path, 10 * 1024 * 1024);
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
            let _ = f.write_all(line.as_bytes());
        }
    }
    let mut err = std::io::stderr();
    if err.is_terminal() {
        let _ = err.write_all(line.as_bytes());
    }
}

pub fn info(msg: &str) { write_line("INFO", msg); }
pub fn warn(msg: &str) { write_line("WARN", msg); }
pub fn error(msg: &str) { write_line("ERROR", msg); }

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn rotation_moves_oversized_file_to_dot_one() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("x.log");
        fs::write(&f, vec![0u8; 11]).unwrap();
        rotate_by_rename_if_large(&f, 10);
        assert!(dir.path().join("x.log.1").exists());
        assert!(!f.exists());
    }

    #[test]
    fn rotation_leaves_small_file() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("x.log");
        fs::write(&f, vec![0u8; 5]).unwrap();
        rotate_by_rename_if_large(&f, 10);
        assert!(f.exists());
        assert!(!dir.path().join("x.log.1").exists());
    }
}
