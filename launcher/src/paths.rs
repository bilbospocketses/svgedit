use anyhow::{Context, Result};
use std::path::{Path, PathBuf};

pub struct Paths {
    pub install_root: PathBuf,
    pub data_root: PathBuf,
    pub deps_path: PathBuf,
}

impl Paths {
    /// `deps_override` and `programdata_override` are injected so tests don't
    /// touch process env or real ProgramData. On non-Windows the programdata
    /// arg is ignored and data_root resolves via SVGEDIT_DATA_ROOT/XDG/HOME.
    pub fn compute(
        exe_dir: &Path,
        deps_override: Option<&str>,
        programdata_override: Option<&str>,
    ) -> Result<Self> {
        let install_root = exe_dir
            .parent()
            .context("exe_dir has no parent (cannot derive install_root)")?
            .to_path_buf();

        let data_root = if cfg!(windows) {
            crate::config::data_root_for_windows(programdata_override)
        } else {
            let dr = std::env::var("SVGEDIT_DATA_ROOT").ok();
            let xdg = std::env::var("XDG_DATA_HOME").ok();
            let home = std::env::var("HOME").ok();
            crate::config::data_root_for_linux(dr.as_deref(), xdg.as_deref(), home.as_deref())
        };

        let deps_path = match deps_override {
            Some(p) => PathBuf::from(p),
            None => data_root.join("dependencies"),
        };

        Ok(Self { install_root, data_root, deps_path })
    }

    pub fn from_env() -> Result<Self> {
        let exe = std::env::current_exe().context("could not determine current exe path")?;
        let exe_dir = exe.parent().context("exe has no parent dir")?.to_path_buf();
        let deps_override = std::env::var("SVGEDIT_DEPS_PATH").ok();
        let programdata = std::env::var("PROGRAMDATA").ok();
        Self::compute(&exe_dir, deps_override.as_deref(), programdata.as_deref())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn install_root_is_parent_of_exe_dir() {
        let dir = tempdir().unwrap();
        let install_root = dir.path();
        let exe_dir = install_root.join("current");
        std::fs::create_dir_all(&exe_dir).unwrap();
        let p = Paths::compute(&exe_dir, None, Some(dir.path().join("PD").to_str().unwrap())).unwrap();
        assert_eq!(p.install_root, install_root);
    }

    #[test]
    fn deps_path_defaults_under_data_root_and_respects_override() {
        let dir = tempdir().unwrap();
        let exe_dir = dir.path().join("current");
        std::fs::create_dir_all(&exe_dir).unwrap();
        let pd = dir.path().join("PD");

        let default = Paths::compute(&exe_dir, None, Some(pd.to_str().unwrap())).unwrap();
        assert_eq!(default.deps_path, default.data_root.join("dependencies"));

        let custom = dir.path().join("custom-deps");
        let overridden =
            Paths::compute(&exe_dir, Some(custom.to_str().unwrap()), Some(pd.to_str().unwrap())).unwrap();
        assert_eq!(overridden.deps_path, custom);
    }
}
