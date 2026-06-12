use anyhow::Result;
use serde::Deserialize;
use std::path::{Path, PathBuf};

/// `<PROGRAMDATA>\svgedit` (fallback `C:\ProgramData\svgedit`).
pub fn data_root_for_windows(programdata: Option<&str>) -> PathBuf {
    let pd = programdata
        .filter(|s| !s.is_empty())
        .unwrap_or("C:\\ProgramData");
    PathBuf::from(pd).join("svgedit")
}

/// `SVGEDIT_DATA_ROOT` override > `$XDG_DATA_HOME/svgedit` > `$HOME/.local/share/svgedit`.
pub fn data_root_for_linux(
    data_root: Option<&str>,
    xdg_data_home: Option<&str>,
    home: Option<&str>,
) -> PathBuf {
    if let Some(dr) = data_root.filter(|s| !s.is_empty()) {
        return PathBuf::from(dr);
    }
    if let Some(xdg) = xdg_data_home.filter(|s| !s.is_empty()) {
        return PathBuf::from(xdg).join("svgedit");
    }
    let home = home.filter(|s| !s.is_empty());
    match home {
        Some(h) => PathBuf::from(h)
            .join(".local")
            .join("share")
            .join("svgedit"),
        None => PathBuf::from("svgedit"), // last-resort relative; callers set the env in prod
    }
}

/// Resolve the writable state root from process env. Honors `SVGEDIT_DATA_ROOT`
/// on both platforms; otherwise Windows uses `%PROGRAMDATA%`, Linux uses XDG/HOME.
pub fn data_root_from_env() -> Result<PathBuf> {
    let override_dr = std::env::var("SVGEDIT_DATA_ROOT").ok();
    if cfg!(windows) {
        let pd = std::env::var("PROGRAMDATA").ok();
        if let Some(dr) = override_dr.filter(|s| !s.is_empty()) {
            return Ok(PathBuf::from(dr));
        }
        Ok(data_root_for_windows(pd.as_deref()))
    } else {
        let xdg = std::env::var("XDG_DATA_HOME").ok();
        let home = std::env::var("HOME").ok();
        let dr = data_root_for_linux(override_dr.as_deref(), xdg.as_deref(), home.as_deref());
        if dr == std::path::Path::new("svgedit") {
            anyhow::bail!(
                "could not resolve data root: none of SVGEDIT_DATA_ROOT, XDG_DATA_HOME, HOME set"
            );
        }
        Ok(dr)
    }
}

#[derive(Deserialize)]
struct FlatConfig {
    #[serde(rename = "webPort")]
    web_port: Option<u16>,
}

/// Read `webPort` from `<data_root>/config.json`, tolerating a missing or invalid file.
/// The 0a server persists the bound port here before it begins listening.
pub fn read_web_port(data_root: &Path) -> Option<u16> {
    let text = std::fs::read_to_string(data_root.join("config.json")).ok()?;
    serde_json::from_str::<FlatConfig>(&text)
        .ok()
        .and_then(|c| c.web_port)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn windows_data_root_uses_programdata_override() {
        let p = data_root_for_windows(Some("D:\\PD"));
        assert_eq!(p, PathBuf::from("D:\\PD").join("svgedit"));
    }

    #[test]
    fn windows_data_root_falls_back_to_c_programdata() {
        let p = data_root_for_windows(None);
        assert_eq!(p, PathBuf::from("C:\\ProgramData").join("svgedit"));
    }

    #[test]
    fn linux_data_root_prefers_explicit_override() {
        let p = data_root_for_linux(Some("/srv/data"), Some("/x"), Some("/home/u"));
        assert_eq!(p, PathBuf::from("/srv/data"));
    }

    #[test]
    fn linux_data_root_uses_xdg_then_home() {
        assert_eq!(
            data_root_for_linux(None, Some("/x/.local/share"), Some("/home/u")),
            PathBuf::from("/x/.local/share").join("svgedit")
        );
        assert_eq!(
            data_root_for_linux(None, None, Some("/home/u")),
            PathBuf::from("/home/u")
                .join(".local")
                .join("share")
                .join("svgedit")
        );
    }

    #[test]
    fn read_web_port_extracts_value() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("config.json"), r#"{"webPort":8137}"#).unwrap();
        assert_eq!(read_web_port(dir.path()), Some(8137));
    }

    #[test]
    fn read_web_port_tolerates_missing_or_garbage() {
        let dir = tempdir().unwrap();
        assert_eq!(read_web_port(dir.path()), None); // no file
        fs::write(dir.path().join("config.json"), "not json").unwrap();
        assert_eq!(read_web_port(dir.path()), None);
    }
}
