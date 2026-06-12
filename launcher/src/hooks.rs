use std::path::Path;

const FLAG_PREFIX: &str = "--veloapp-";
const FLAG_INSTALL: &str = "--veloapp-install";
const FLAG_UPDATED: &str = "--veloapp-updated";
const FLAG_UNINSTALL: &str = "--veloapp-uninstall";
const FLAG_OBSOLETE: &str = "--veloapp-obsolete";

#[derive(Debug)]
pub enum HookKind {
    Install,
    Updated,
    Uninstall,
    Obsolete,
    Unknown(String),
}

pub fn parse_hook_flag(args: &[String]) -> Option<HookKind> {
    let mut unknown: Option<String> = None;
    for a in args {
        match a.as_str() {
            FLAG_INSTALL => return Some(HookKind::Install),
            FLAG_UPDATED => return Some(HookKind::Updated),
            FLAG_UNINSTALL => return Some(HookKind::Uninstall),
            FLAG_OBSOLETE => return Some(HookKind::Obsolete),
            other if other.starts_with(FLAG_PREFIX) && unknown.is_none() => {
                unknown = Some(other.to_string());
            }
            _ => {}
        }
    }
    unknown.map(HookKind::Unknown)
}

fn on_install(data_root: &Path) -> i32 {
    if let Err(e) = std::fs::create_dir_all(data_root.join("logs")) {
        crate::log::error(&format!("hook install: could not create data dirs: {e}"));
    }
    crate::log::info("hook: install complete");
    0
}

fn on_uninstall(_data_root: &Path) -> i32 {
    // 0b preserves user data (config.json, logs). Service/deps teardown is #27.
    crate::log::info("hook: uninstall (user data preserved)");
    0
}

fn on_obsolete() -> i32 {
    crate::log::info("hook: obsolete old binary; exiting 0 before swap");
    0
}

fn on_unknown(flag: &str) -> i32 {
    crate::log::error(&format!(
        "hook: unknown velopack flag {flag:?} — exiting 0 to avoid an Update.exe respawn loop"
    ));
    0
}

/// Returns `Some(exit_code)` when a Velopack hook flag is present (the caller
/// then exits with that code, BEFORE `VelopackApp::run()`); `None` for a normal launch.
pub fn handle_velopack_hook(args: &[String]) -> Option<i32> {
    let kind = parse_hook_flag(args)?;
    let data_root =
        crate::config::data_root_from_env().unwrap_or_else(|_| std::path::PathBuf::from("."));
    let code = match kind {
        HookKind::Install | HookKind::Updated => on_install(&data_root),
        HookKind::Uninstall => on_uninstall(&data_root),
        HookKind::Obsolete => on_obsolete(),
        HookKind::Unknown(f) => on_unknown(&f),
    };
    Some(code)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v(args: &[&str]) -> Vec<String> {
        args.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn parse_returns_none_for_unrelated_args() {
        assert!(parse_hook_flag(&v(&["svgedit", "--foo"])).is_none());
    }

    #[test]
    fn parse_recognizes_each_known_flag() {
        assert!(matches!(
            parse_hook_flag(&v(&["--veloapp-install"])),
            Some(HookKind::Install)
        ));
        assert!(matches!(
            parse_hook_flag(&v(&["--veloapp-updated"])),
            Some(HookKind::Updated)
        ));
        assert!(matches!(
            parse_hook_flag(&v(&["--veloapp-uninstall"])),
            Some(HookKind::Uninstall)
        ));
        assert!(matches!(
            parse_hook_flag(&v(&["--veloapp-obsolete"])),
            Some(HookKind::Obsolete)
        ));
    }

    #[test]
    fn parse_known_flag_wins_over_unknown() {
        assert!(matches!(
            parse_hook_flag(&v(&["--veloapp-frobnicate", "--veloapp-install"])),
            Some(HookKind::Install)
        ));
    }

    #[test]
    fn parse_first_unknown_veloapp_flag_is_captured() {
        match parse_hook_flag(&v(&["--veloapp-frobnicate"])) {
            Some(HookKind::Unknown(f)) => assert_eq!(f, "--veloapp-frobnicate"),
            other => panic!("expected Unknown, got {other:?}"),
        }
    }

    #[test]
    fn obsolete_and_unknown_handlers_return_zero() {
        assert_eq!(on_obsolete(), 0);
        assert_eq!(on_unknown("--veloapp-x"), 0);
    }

    #[test]
    fn install_creates_data_dirs_and_uninstall_preserves_them() {
        let dir = tempfile::tempdir().unwrap();
        let data_root = dir.path().join("data");
        assert_eq!(on_install(&data_root), 0);
        assert!(data_root.join("logs").exists());
        assert_eq!(on_uninstall(&data_root), 0);
        assert!(data_root.exists());
    }
}
