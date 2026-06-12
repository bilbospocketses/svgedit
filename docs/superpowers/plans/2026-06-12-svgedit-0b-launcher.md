# 0b Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build svgedit's statically-linked, cross-platform Rust launcher crate (`launcher/`) that serves as Velopack's `--mainExe` — handling Velopack hooks, the Windows PerMachine ACL grant, hidden spawn + crash-supervision + single-instance, and launcher-side browser-open around the 0a Node server.

**Architecture:** A faithful, reduced port of `ws-scrcpy-web`'s launcher crate, stripped to the 0b core (services and the in-app updater are deferred). One `bin` crate with `#[cfg]`-gated platform modules; pure-logic modules are TDD'd with `cargo test`, platform-API modules are ported near-verbatim from the sibling. The launcher spawns `node dist/server/index.js` with `SVGEDIT_DATA_ROOT` set, supervises it, and opens the browser once the server's `/healthz` is live.

**Tech Stack:** Rust (edition 2021), `velopack 1.0`, `windows 0.58` (Win32), `rustix` (Linux flock), `ctrlc`, `serde`/`serde_json`, `anyhow`, `winresource` (build-dep), `tempfile` (dev-dep). Targets: `x86_64-pc-windows-msvc` (+crt-static) and `x86_64-unknown-linux-musl` (static).

**Spec:** `docs/superpowers/specs/2026-06-12-svgedit-0b-launcher-design.md`
**Sibling template (read per-task to port from):** `C:/Users/jscha/source/repos/ws-scrcpy-web/launcher/`

---

## Refinements to the spec (discovered while reading the sibling source)

These tighten the spec; the intent (faithful core port, launcher-side browser, services + updater deferred) is unchanged.

1. **`uac_requester.rs` is NOT in 0b.** It implements the `--request-uac` → `--elevate-and-run` re-launch used by *service* install (→ #27). The 0b ACL grant self-elevates its own `icacls` inside `install_acl.rs` via `ShellExecuteExW(verb="runas")`. Dropped.
2. **ACL "one-shot marker" → writability probe.** `install_acl::ensure_writable` writes a sentinel file to the install root; if that succeeds it's already writable and returns without a UAC prompt. This is self-healing (re-grants if a later step strips the DACL) and is the sibling's proven approach.
3. **Two support modules named:** `config.rs` (inlined `data_root_for_*` + `read_web_port`, since svgedit has no `common` crate) and `log.rs` (file logging the spec's many "log" verbs imply).
4. **`spawn_server` has no `open_browser` param.** Browser-open is fully launcher-side: the supervisor spawns a `browser::open_when_ready` thread on first spawn only.

---

## File structure

```text
launcher/
  Cargo.toml              # bin crate `svgedit`; pinned dep versions (no workspace); release profile
  .cargo/config.toml      # msvc +crt-static
  build.rs                # winresource: embed version always; icon if launcher/assets/svgedit.ico exists
  assets/
    svgedit.ico           # (optional) branded icon; build.rs embeds it when present
  src/
    main.rs               # mod decls + main(): hook guard -> VelopackApp.run -> single-instance -> [win] ACL -> supervise -> [win] job release
    config.rs             # data_root_for_windows/linux, data_root_from_env() -> Result<PathBuf>, read_web_port()
    paths.rs              # Paths { install_root, data_root, deps_path } + compute()/from_env()
    log.rs                # init/info/warn/error + rotate_by_rename_if_large
    spawn.rs              # resolve_node_with / resolve_server_entry_with (dist/server/index.js) / spawn_server
    supervisor.rs         # run(): ctrlc handler + reduced crash-restart loop + first-spawn browser thread
    single_instance.rs    # acquire()/current_mutex_name()/InstanceGuard ([win] mutex, [nix] flock)
    browser.rs            # wait_until_healthy(port) + open(url) + open_when_ready(data_root)
    hooks.rs              # parse_hook_flag/HookKind/handle_velopack_hook + on_install/on_uninstall (reduced)
    job_object.rs         # [win] adopt()/release() (KILL_ON_JOB_CLOSE + clear)
    install_acl.rs        # [win] is_writable()/ensure_writable() (sentinel probe + elevated icacls)
```

**Cross-module API contract (locked here for type-consistency across tasks):**

```text
config::data_root_from_env() -> anyhow::Result<PathBuf>
config::read_web_port(data_root: &Path) -> Option<u16>
paths::Paths { install_root: PathBuf, data_root: PathBuf, deps_path: PathBuf }
paths::Paths::from_env() -> anyhow::Result<Paths>
log::init(name: &str);  log::info(&str);  log::warn(&str);  log::error(&str)
log::rotate_by_rename_if_large(path: &Path, max_bytes: u64)
spawn::spawn_server(deps_path: &Path, data_root: &Path) -> anyhow::Result<std::process::Child>
supervisor::run() -> anyhow::Result<i32>
single_instance::current_mutex_name() -> String
single_instance::acquire(name: &str) -> anyhow::Result<Option<InstanceGuard>>
browser::open_when_ready(data_root: PathBuf)          // spawned in a thread, swallows errors
hooks::handle_velopack_hook(args: &[String]) -> Option<i32>
job_object::adopt(child: &std::process::Child) -> anyhow::Result<()>   // [win]
job_object::release() -> anyhow::Result<bool>                          // [win]
install_acl::ensure_writable(install_root: &Path) -> anyhow::Result<()> // [win]
```

> **Note on warnings:** modules land before `main()` wires them (Task 12), so intermediate `cargo build` runs may emit `dead_code` warnings. They are warnings, not errors; `cargo test` stays green. The CI gate (`clippy -D warnings`, Task 13) runs *after* Task 12 wires everything, by which point nothing is dead.

---

## Task 1: Scaffold the crate (compiles + empty test run green)

**Files:**
- Create: `launcher/Cargo.toml`
- Create: `launcher/.cargo/config.toml`
- Create: `launcher/build.rs`
- Create: `launcher/src/main.rs`
- Create: `launcher/.gitignore`

- [ ] **Step 1: Write `launcher/Cargo.toml`**

```toml
[package]
name = "svgedit"
version = "0.0.0"
edition = "2021"
license = "GPL-3.0-only"
repository = "https://github.com/bilbospocketses/svgedit"
publish = false

[[bin]]
name = "svgedit"
path = "src/main.rs"

[dependencies]
anyhow = "1.0"
ctrlc = "3.4"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
velopack = "1.0"

[target.'cfg(windows)'.dependencies]
windows = { version = "0.58", features = [
    "Win32_Foundation",
    "Win32_Security",
    "Win32_Storage_FileSystem",
    "Win32_System_Console",
    "Win32_System_JobObjects",
    "Win32_System_Threading",
    "Win32_UI_Shell",
    "Win32_UI_WindowsAndMessaging",
] }

[target.'cfg(unix)'.dependencies]
rustix = { version = "1", features = ["fs"] }

[build-dependencies]
winresource = "0.1"

[dev-dependencies]
tempfile = "3.10"

[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
strip = true
panic = "abort"
```

- [ ] **Step 2: Write `launcher/.cargo/config.toml`** (Windows static CRT — without this, release #1 dies `VCRUNTIME140.dll not found`)

```toml
# Statically link the MSVC C runtime so the launcher has no dependency on the
# Visual C++ Redistributable (absent on fresh Win11). Verified via dumpbin.
[target.'cfg(target_env = "msvc")']
rustflags = ["-C", "target-feature=+crt-static"]
```

- [ ] **Step 3: Write `launcher/build.rs`** (embed version always; icon only if present, so a missing icon never breaks the build)

```rust
// Embed version metadata into the launcher .exe (and the app icon when
// launcher/assets/svgedit.ico exists). No-op on non-Windows targets.
fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return;
    }
    let mut res = winresource::WindowsResource::new();
    if std::path::Path::new("assets/svgedit.ico").exists() {
        res.set_icon("assets/svgedit.ico");
    }
    res.compile()
        .expect("failed to embed Windows resources into svgedit.exe");
}
```

- [ ] **Step 4: Write a minimal `launcher/src/main.rs`** (real `main()` arrives in Task 12)

```rust
fn main() {
    println!("svgedit launcher (0b scaffold)");
}
```

- [ ] **Step 5: Write `launcher/.gitignore`**

```text
/target
```

- [ ] **Step 6: Verify it builds and tests run**

Run: `cargo test --manifest-path launcher/Cargo.toml`
Expected: compiles; `test result: ok. 0 passed` (no tests yet).

- [ ] **Step 7: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add launcher/Cargo.toml launcher/.cargo/config.toml launcher/build.rs launcher/src/main.rs launcher/.gitignore
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(launcher): scaffold static-linked Rust crate"
```

---

## Task 2: `config.rs` — data-root resolution + config.json port read

**Files:**
- Create: `launcher/src/config.rs`
- Modify: `launcher/src/main.rs` (add `mod config;`)

Port the data-root resolvers verbatim from `ws-scrcpy-web/common/src/config.rs`, rebranded `svgedit`, plus a minimal `read_web_port` matching svgedit's 0a `config.json` shape (`{ "webPort": number }`).

- [ ] **Step 1: Add `mod config;` to `launcher/src/main.rs`** (top of file, above `fn main`)

```rust
mod config;
```

- [ ] **Step 2: Write the failing tests** — append to `launcher/src/config.rs`

```rust
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
            PathBuf::from("/home/u").join(".local").join("share").join("svgedit")
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cargo test --manifest-path launcher/Cargo.toml config::`
Expected: FAIL — `cannot find function data_root_for_windows`.

- [ ] **Step 4: Write the implementation** — prepend to `launcher/src/config.rs` (above the test module)

```rust
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
        Some(h) => PathBuf::from(h).join(".local").join("share").join("svgedit"),
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
        if dr == PathBuf::from("svgedit") {
            anyhow::bail!("could not resolve data root: none of SVGEDIT_DATA_ROOT, XDG_DATA_HOME, HOME set");
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
    serde_json::from_str::<FlatConfig>(&text).ok().and_then(|c| c.web_port)
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cargo test --manifest-path launcher/Cargo.toml config::`
Expected: PASS — 6 tests.

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add launcher/src/config.rs launcher/src/main.rs
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(launcher): data-root resolution + config.json port read"
```

---

## Task 3: `paths.rs` — install/data/deps resolution

**Files:**
- Create: `launcher/src/paths.rs`
- Modify: `launcher/src/main.rs` (add `mod paths;`)

Port `ws-scrcpy-web/launcher/src/paths.rs`, **dropping `restart_marker` and `old_node`** (updater fields), routing `data_root` through `crate::config`, and reading the `SVGEDIT_DEPS_PATH` override.

- [ ] **Step 1: Add `mod paths;` to `main.rs`.**

- [ ] **Step 2: Write the failing tests** — append to `launcher/src/paths.rs`

```rust
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
```

- [ ] **Step 3: Run to verify fail** — `cargo test --manifest-path launcher/Cargo.toml paths::` → FAIL (`Paths` undefined).

- [ ] **Step 4: Write the implementation** — prepend to `launcher/src/paths.rs`

```rust
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
```

- [ ] **Step 5: Run to verify pass** — `cargo test --manifest-path launcher/Cargo.toml paths::` → PASS.

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add launcher/src/paths.rs launcher/src/main.rs
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(launcher): install/data/deps path resolution"
```

---

## Task 4: `log.rs` — file logging + rotate-by-rename

**Files:**
- Create: `launcher/src/log.rs`
- Modify: `launcher/src/main.rs` (add `mod log;`)

Port `ws-scrcpy-web/launcher/src/log.rs`, rebranded, writing to `<data_root>/logs/svgedit-launcher.log`.

- [ ] **Step 1: Add `mod log;` to `main.rs`.**

- [ ] **Step 2: Write the failing tests** — append to `launcher/src/log.rs`

```rust
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
```

- [ ] **Step 3: Run to verify fail** — `cargo test --manifest-path launcher/Cargo.toml log::` → FAIL.

- [ ] **Step 4: Write the implementation** — prepend to `launcher/src/log.rs`

```rust
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
```

- [ ] **Step 5: Run to verify pass** — `cargo test --manifest-path launcher/Cargo.toml log::` → PASS.

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add launcher/src/log.rs launcher/src/main.rs
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(launcher): file logging with rename rotation"
```

---

## Task 5: `spawn.rs` — Node resolution + hidden server spawn

**Files:**
- Create: `launcher/src/spawn.rs`
- Modify: `launcher/src/main.rs` (add `mod spawn;`)

Port `ws-scrcpy-web/launcher/src/spawn.rs`. **svgedit deltas:** server entry is `dist/server/index.js` (sibling: `dist/index.js`); child env is `SVGEDIT_DATA_ROOT` only — **no `DEPS_PATH`, no browser env** (browser-open is launcher-side); job-object adopt stays (Windows).

- [ ] **Step 1: Add `mod spawn;` to `main.rs`.**

- [ ] **Step 2: Write the failing tests** — append to `launcher/src/spawn.rs` (ported from the sibling; note the `dist/server/index.js` entry)

```rust
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
```

- [ ] **Step 3: Run to verify fail** — `cargo test --manifest-path launcher/Cargo.toml spawn::` → FAIL.

- [ ] **Step 4: Write the implementation** — prepend to `launcher/src/spawn.rs`

```rust
use anyhow::{bail, Context, Result};
use std::path::{Path, PathBuf};
use std::process::{Child, Command};

#[cfg(windows)]
pub const NODE_BIN: &str = "node.exe";
#[cfg(not(windows))]
pub const NODE_BIN: &str = "node";

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Resolve the Node binary: `<deps>/node/bin/<bin>` → `<deps>/node/<bin>` →
/// `<exe_dir>/seed/node/bin/<bin>` → `<exe_dir>/seed/node/<bin>` → error.
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
```

> `crate::job_object::adopt` is added in Task 9. Until then, comment the `#[cfg(windows)]` adopt block or land Task 9 first. (Recommended order: do Task 9 before Task 5's `spawn_server` build on Windows; the pure resolver tests in this task don't need it.)

- [ ] **Step 5: Run to verify pass** — `cargo test --manifest-path launcher/Cargo.toml spawn::` → PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add launcher/src/spawn.rs launcher/src/main.rs
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(launcher): node resolution + hidden server spawn"
```

---

## Task 6: `hooks.rs` — Velopack lifecycle hooks (reduced)

**Files:**
- Create: `launcher/src/hooks.rs`
- Modify: `launcher/src/main.rs` (add `mod hooks;`)

Port `ws-scrcpy-web/launcher/src/hooks.rs` parse/dispatch **verbatim**; reduce handlers — install/updated create data dirs + log, uninstall preserves user data, obsolete/unknown return 0. **Strip** all ACL/servy/tray/service teardown (the sibling's install ACL is handled separately by `install_acl.rs`, the rest is deferred).

- [ ] **Step 1: Add `mod hooks;` to `main.rs`.**

- [ ] **Step 2: Write the failing tests** — append to `launcher/src/hooks.rs`

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn v(args: &[&str]) -> Vec<String> { args.iter().map(|s| s.to_string()).collect() }

    #[test]
    fn parse_returns_none_for_unrelated_args() {
        assert!(parse_hook_flag(&v(&["svgedit", "--foo"])).is_none());
    }

    #[test]
    fn parse_recognizes_each_known_flag() {
        assert!(matches!(parse_hook_flag(&v(&["--veloapp-install"])), Some(HookKind::Install)));
        assert!(matches!(parse_hook_flag(&v(&["--veloapp-updated"])), Some(HookKind::Updated)));
        assert!(matches!(parse_hook_flag(&v(&["--veloapp-uninstall"])), Some(HookKind::Uninstall)));
        assert!(matches!(parse_hook_flag(&v(&["--veloapp-obsolete"])), Some(HookKind::Obsolete)));
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
        // uninstall must NOT delete user data in 0b
        assert_eq!(on_uninstall(&data_root), 0);
        assert!(data_root.exists());
    }
}
```

- [ ] **Step 3: Run to verify fail** — `cargo test --manifest-path launcher/Cargo.toml hooks::` → FAIL.

- [ ] **Step 4: Write the implementation** — prepend to `launcher/src/hooks.rs`

```rust
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
    let data_root = crate::config::data_root_from_env().unwrap_or_else(|_| std::path::PathBuf::from("."));
    let code = match kind {
        HookKind::Install | HookKind::Updated => on_install(&data_root),
        HookKind::Uninstall => on_uninstall(&data_root),
        HookKind::Obsolete => on_obsolete(),
        HookKind::Unknown(f) => on_unknown(&f),
    };
    Some(code)
}
```

- [ ] **Step 5: Run to verify pass** — `cargo test --manifest-path launcher/Cargo.toml hooks::` → PASS.

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add launcher/src/hooks.rs launcher/src/main.rs
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(launcher): reduced velopack hook handling"
```

---

## Task 7: `single_instance.rs` — named mutex / lockfile

**Files:**
- Create: `launcher/src/single_instance.rs`
- Modify: `launcher/src/main.rs` (add `mod single_instance;`)

Port `ws-scrcpy-web/launcher/src/single_instance.rs`, rebranded `svgedit`. Windows named mutex (`Local\svgedit-SingleInstance-User`); Linux `flock` on `$XDG_RUNTIME_DIR/svgedit.lock` (fallback `<data_root>/control/instance.lock`).

- [ ] **Step 1: Add `mod single_instance;` to `main.rs`.**

- [ ] **Step 2: Write the failing tests** — append to `launcher/src/single_instance.rs`

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(windows)]
    fn windows_second_acquire_is_denied_while_first_held() {
        let name = r"Local\svgedit-test-si-windows";
        let g1 = acquire(name).unwrap();
        assert!(g1.is_some(), "first acquire should win");
        let g2 = acquire(name).unwrap();
        assert!(g2.is_none(), "second acquire should be denied while first held");
        drop(g1);
        let g3 = acquire(name).unwrap();
        assert!(g3.is_some(), "after release, acquire should win again");
    }

    #[test]
    #[cfg(unix)]
    fn linux_second_acquire_is_denied_while_first_held() {
        let dir = tempfile::tempdir().unwrap();
        let lock = dir.path().join("instance.lock");
        let g1 = acquire_at(&lock).unwrap();
        assert!(g1.is_some());
        let g2 = acquire_at(&lock).unwrap();
        assert!(g2.is_none());
        drop(g1);
        let g3 = acquire_at(&lock).unwrap();
        assert!(g3.is_some());
    }

    #[test]
    fn mutex_name_is_branded_and_privilege_suffixed() {
        let n = current_mutex_name();
        assert!(n.contains("svgedit-SingleInstance"));
        assert!(n.ends_with("User") || n.ends_with("Admin"));
    }
}
```

- [ ] **Step 3: Run to verify fail** — `cargo test --manifest-path launcher/Cargo.toml single_instance::` → FAIL.

- [ ] **Step 4: Write the implementation.** Port from the sibling (the verbatim cores below); keep one common public surface.

```rust
use anyhow::Result;

const MUTEX_BASE: &str = r"Local\svgedit-SingleInstance";

pub fn current_mutex_name() -> String {
    let suffix = if is_elevated() { "Admin" } else { "User" };
    format!("{MUTEX_BASE}-{suffix}")
}

#[cfg(windows)]
mod imp {
    use super::*;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{CloseHandle, GetLastError, ERROR_ALREADY_EXISTS, HANDLE};
    use windows::Win32::System::Threading::CreateMutexW;

    pub struct InstanceGuard { handle: HANDLE }
    impl Drop for InstanceGuard {
        fn drop(&mut self) { unsafe { let _ = CloseHandle(self.handle); } }
    }

    fn to_wide(s: &str) -> Vec<u16> { s.encode_utf16().chain(std::iter::once(0)).collect() }

    pub fn acquire(name: &str) -> Result<Option<InstanceGuard>> {
        let wide = to_wide(name);
        let handle = unsafe { CreateMutexW(None, false, PCWSTR::from_raw(wide.as_ptr()))? };
        let already = unsafe { GetLastError() } == ERROR_ALREADY_EXISTS;
        if already {
            unsafe { let _ = CloseHandle(handle); }
            return Ok(None);
        }
        Ok(Some(InstanceGuard { handle }))
    }

    pub fn is_elevated() -> bool {
        use windows::Win32::Foundation::HANDLE;
        use windows::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
        use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
        unsafe {
            let mut token = HANDLE::default();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
                return false;
            }
            let mut elevation = TOKEN_ELEVATION::default();
            let mut size = 0u32;
            let ok = GetTokenInformation(
                token,
                TokenElevation,
                Some(&mut elevation as *mut _ as *mut _),
                std::mem::size_of::<TOKEN_ELEVATION>() as u32,
                &mut size,
            ).is_ok();
            let _ = CloseHandle(token);
            ok && elevation.TokenIsElevated != 0
        }
    }
}

#[cfg(unix)]
mod imp {
    use super::*;
    use rustix::fs::{flock, FlockOperation};
    use std::fs::{File, OpenOptions};
    use std::path::{Path, PathBuf};

    pub struct InstanceGuard { _file: File }

    pub fn is_elevated() -> bool { rustix::process::getuid().is_root() }

    pub fn lock_path() -> PathBuf {
        if let Ok(x) = std::env::var("XDG_RUNTIME_DIR") {
            if !x.is_empty() { return PathBuf::from(x).join("svgedit.lock"); }
        }
        let data_root = crate::config::data_root_from_env().unwrap_or_else(|_| PathBuf::from("/tmp"));
        data_root.join("control").join("instance.lock")
    }

    pub fn acquire_at(path: &Path) -> Result<Option<InstanceGuard>> {
        if let Some(parent) = path.parent() { let _ = std::fs::create_dir_all(parent); }
        let file = OpenOptions::new().create(true).write(true).truncate(false).open(path)?;
        match flock(&file, FlockOperation::NonBlockingLockExclusive) {
            Ok(()) => Ok(Some(InstanceGuard { _file: file })),
            Err(e) if e == rustix::io::Errno::WOULDBLOCK => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn acquire(_name: &str) -> Result<Option<InstanceGuard>> { acquire_at(&lock_path()) }
}

pub use imp::{acquire, is_elevated, InstanceGuard};
#[cfg(unix)]
pub use imp::acquire_at;
```

> `rustix::process::getuid` needs the `process` feature only on the `getuid().is_root()` path. If the `fs`-only feature set doesn't expose it, gate `is_elevated()` on Linux to `false` for 0b (single non-elevated instance is the common case) or add `features = ["fs", "process"]` to the `[target.'cfg(unix)']` dep. Prefer adding the feature.

- [ ] **Step 5: Run to verify pass** — `cargo test --manifest-path launcher/Cargo.toml single_instance::` → PASS (the Windows mutex test runs on the msvc arm, the Linux flock test on the musl arm; `mutex_name` runs on both).

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add launcher/src/single_instance.rs launcher/src/main.rs
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(launcher): single-instance mutex/lockfile guard"
```

---

## Task 8: `browser.rs` — health poll + launcher-side browser-open

**Files:**
- Create: `launcher/src/browser.rs`
- Modify: `launcher/src/main.rs` (add `mod browser;`)

This is svgedit-specific (the sibling delegates to Node). `wait_until_healthy` does a minimal HTTP `GET /healthz` over `TcpStream` (no HTTP-client dep); `open` shells the OS opener; `open_when_ready` ties them together for the supervisor's first-spawn thread.

- [ ] **Step 1: Add `mod browser;` to `main.rs`.**

- [ ] **Step 2: Write the failing tests** — append to `launcher/src/browser.rs`

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    #[test]
    fn url_for_port_builds_localhost_url() {
        assert_eq!(url_for_port(8137), "http://localhost:8137/");
    }

    #[test]
    fn healthy_when_server_returns_200() {
        // Stand up a one-shot listener that answers /healthz with 200.
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let handle = std::thread::spawn(move || {
            if let Ok((mut sock, _)) = listener.accept() {
                let mut buf = [0u8; 256];
                let _ = sock.read(&mut buf);
                let _ = sock.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok");
            }
        });
        assert!(check_healthz(port));
        handle.join().unwrap();
    }

    #[test]
    fn unhealthy_when_nothing_listening() {
        // Port 1 is privileged and never bound in CI; connect fails fast.
        assert!(!check_healthz(1));
    }
}
```

- [ ] **Step 3: Run to verify fail** — `cargo test --manifest-path launcher/Cargo.toml browser::` → FAIL.

- [ ] **Step 4: Write the implementation** — prepend to `launcher/src/browser.rs`

```rust
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::time::Duration;

pub fn url_for_port(port: u16) -> String {
    format!("http://localhost:{port}/")
}

/// One `GET /healthz` over a TCP socket; true iff the status line is `200`.
pub fn check_healthz(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(300)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));
    if stream
        .write_all(b"GET /healthz HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n")
        .is_err()
    {
        return false;
    }
    let mut buf = Vec::new();
    let mut chunk = [0u8; 256];
    // Read just enough to see the status line.
    while let Ok(n) = stream.read(&mut chunk) {
        if n == 0 { break; }
        buf.extend_from_slice(&chunk[..n]);
        if buf.len() >= 64 || buf.windows(4).any(|w| w == b"\r\n\r\n") { break; }
    }
    let head = String::from_utf8_lossy(&buf);
    head.starts_with("HTTP/1.") && head.split_whitespace().nth(1) == Some("200")
}

#[cfg(windows)]
pub fn open(url: &str) {
    use windows::core::{PCWSTR, w};
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
    let wide: Vec<u16> = url.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        ShellExecuteW(None, w!("open"), PCWSTR::from_raw(wide.as_ptr()), PCWSTR::null(), PCWSTR::null(), SW_SHOWNORMAL);
    }
}

#[cfg(not(windows))]
pub fn open(url: &str) {
    let _ = std::process::Command::new("xdg-open").arg(url).spawn();
}

/// Read the bound port from config.json, wait for /healthz, then open the browser
/// once. Designed to run in its own thread; all errors are swallowed + logged.
pub fn open_when_ready(data_root: PathBuf) {
    // Poll config.json for the port the server bound (it persists before listen).
    let mut port = None;
    for _ in 0..150 {
        if let Some(p) = crate::config::read_web_port(&data_root) { port = Some(p); break; }
        std::thread::sleep(Duration::from_millis(100));
    }
    let Some(port) = port else {
        crate::log::error("browser: server never wrote a webPort to config.json; not opening");
        return;
    };
    for _ in 0..300 {
        if check_healthz(port) {
            crate::log::info(&format!("browser: server healthy on {port}; opening"));
            open(&url_for_port(port));
            return;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    crate::log::error(&format!("browser: server on {port} never became healthy; not opening"));
}
```

- [ ] **Step 5: Run to verify pass** — `cargo test --manifest-path launcher/Cargo.toml browser::` → PASS.

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add launcher/src/browser.rs launcher/src/main.rs
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(launcher): launcher-side health poll + browser open"
```

---

## Task 9 `[win]`: `job_object.rs` — KILL_ON_JOB_CLOSE + release

**Files:**
- Create: `launcher/src/job_object.rs`
- Modify: `launcher/src/main.rs` (add `#[cfg(windows)] mod job_object;`)

Port `ws-scrcpy-web/launcher/src/job_object.rs` verbatim (no svgedit-specific strings). A process-global job; child joins it; `release()` clears `KILL_ON_JOB_CLOSE` before a graceful exit (Gotcha 8).

- [ ] **Step 1: Add to `main.rs`:** `#[cfg(windows)] mod job_object;`

- [ ] **Step 2: Write the failing test** — append to `launcher/src/job_object.rs`

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    #[test]
    fn release_after_adopt_is_idempotent() {
        let child = Command::new("cmd").args(["/c", "exit", "0"]).spawn().unwrap();
        adopt(&child).unwrap();
        assert_eq!(release().unwrap(), true);
        assert_eq!(release().unwrap(), true); // idempotent
    }
}
```

- [ ] **Step 3: Run to verify fail** (Windows) — `cargo test --manifest-path launcher/Cargo.toml job_object::` → FAIL.

- [ ] **Step 4: Write the implementation** (verbatim from the sibling; transcribe `ws-scrcpy-web/launcher/src/job_object.rs`). Core shape:

```rust
use anyhow::{Context, Result};
use std::process::Child;
use std::sync::OnceLock;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};
use windows::Win32::System::Threading::{OpenProcess, PROCESS_SET_QUOTA, PROCESS_TERMINATE};

struct JobHandle(HANDLE);
unsafe impl Send for JobHandle {}
unsafe impl Sync for JobHandle {}
static JOB: OnceLock<Option<JobHandle>> = OnceLock::new();

/// Adopt `child` into a process-global job with KILL_ON_JOB_CLOSE so the child
/// (and its descendants) die when the launcher exits.
pub fn adopt(child: &Child) -> Result<()> {
    let job = unsafe {
        let job = CreateJobObjectW(None, PCWSTR::null()).context("CreateJobObjectW failed")?;
        let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const _,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        ).context("SetInformationJobObject(kill-on-close) failed")?;
        job
    };
    let pid = child.id();
    unsafe {
        let proc = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, false, pid)
            .context("OpenProcess(child) failed")?;
        let r = AssignProcessToJobObject(job, proc);
        let _ = CloseHandle(proc);
        r.context("AssignProcessToJobObject failed")?;
    }
    let _ = JOB.set(Some(JobHandle(job)));
    Ok(())
}

/// Clear KILL_ON_JOB_CLOSE so a graceful launcher exit does NOT reap job members
/// mid-operation (Gotcha 8 — load-bearing once Update.exe joins the job). Returns
/// false if no job was ever adopted.
pub fn release() -> Result<bool> {
    let Some(Some(job)) = JOB.get() else { return Ok(false) };
    let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
    info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT(0);
    unsafe {
        SetInformationJobObject(
            job.0,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const _,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        ).context("SetInformationJobObject(release) failed")?;
    }
    Ok(true)
}
```

> Reconcile the exact `windows 0.58` symbol paths against the sibling file while transcribing (e.g. `PROCESS_SET_QUOTA`/`PROCESS_TERMINATE` import path). The sibling compiles green on `0.58` — match it.

- [ ] **Step 5: Run to verify pass** (Windows) — PASS.

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add launcher/src/job_object.rs launcher/src/main.rs
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(launcher): job object kill-on-close + release"
```

---

## Task 10 `[win]`: `install_acl.rs` — writability probe + elevated icacls

**Files:**
- Create: `launcher/src/install_acl.rs`
- Modify: `launcher/src/main.rs` (add `#[cfg(windows)] mod install_acl;`)

Port `ws-scrcpy-web/launcher/src/install_acl.rs`, sentinel renamed `.svgedit-write-test`. `ensure_writable` probes writability; if not writable, runs an elevated `icacls "<install_root>" /grant *S-1-5-11:(OI)(CI)M /T /C /Q` via `ShellExecuteExW(verb="runas")` and waits for its exit code.

- [ ] **Step 1: Add to `main.rs`:** `#[cfg(windows)] mod install_acl;`

- [ ] **Step 2: Write the failing tests** — append to `launcher/src/install_acl.rs`

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn is_writable_true_for_user_tempdir_and_cleans_sentinel() {
        let dir = tempdir().unwrap();
        assert!(is_writable(dir.path()));
        assert!(!dir.path().join(SENTINEL).exists(), "sentinel cleaned up");
    }

    #[test]
    fn is_writable_false_for_nonexistent_path() {
        assert!(!is_writable(std::path::Path::new("Z:/no/such/svgedit-acl-test")));
    }

    #[test]
    fn icacls_args_have_exact_grant_string() {
        let args = icacls_args(std::path::Path::new("C:\\Program Files\\svgedit"));
        assert_eq!(
            args,
            "\"C:\\Program Files\\svgedit\" /grant *S-1-5-11:(OI)(CI)M /T /C /Q"
        );
    }
}
```

> The third test asserts the privileged command **by value** (verification-trust: validate destructive/privileged commands by their constructed string, never by running them).

- [ ] **Step 3: Run to verify fail** (Windows) — FAIL.

- [ ] **Step 4: Write the implementation** (transcribe from the sibling; the load-bearing pieces below).

```rust
use anyhow::{bail, Result};
use std::path::Path;

const SENTINEL: &str = ".svgedit-write-test";
const AUTH_USERS_SID: &str = "*S-1-5-11";

pub fn is_writable(path: &Path) -> bool {
    let probe = path.join(SENTINEL);
    match std::fs::write(&probe, b"") {
        Ok(()) => { let _ = std::fs::remove_file(&probe); true }
        Err(_) => false,
    }
}

/// The exact icacls argument string (asserted in tests; passed to elevated icacls).
pub fn icacls_args(install_root: &Path) -> String {
    format!("\"{}\" /grant {}:(OI)(CI)M /T /C /Q", install_root.display(), AUTH_USERS_SID)
}

/// Grant Authenticated Users:Modify on the install root if it is not already
/// writable. One UAC prompt per install; no-op when already writable.
pub fn ensure_writable(install_root: &Path) -> Result<()> {
    if is_writable(install_root) {
        return Ok(());
    }
    crate::log::info("install_acl: install root not writable; requesting elevated icacls grant");
    let code = run_elevated_icacls(install_root)?;
    if code != 0 {
        bail!("elevated icacls exited with code {code}");
    }
    if !is_writable(install_root) {
        bail!("install root still not writable after icacls grant");
    }
    Ok(())
}

#[cfg(windows)]
fn run_elevated_icacls(install_root: &Path) -> Result<u32> {
    use windows::core::{PCWSTR, w};
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{GetExitCodeProcess, WaitForSingleObject, INFINITE};
    use windows::Win32::UI::Shell::{ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW};
    use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;

    let params = icacls_args(install_root);
    let wide_params: Vec<u16> = params.encode_utf16().chain(std::iter::once(0)).collect();
    let mut info = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_NOCLOSEPROCESS,
        lpVerb: w!("runas"),
        lpFile: w!("icacls"),
        lpParameters: PCWSTR::from_raw(wide_params.as_ptr()),
        nShow: SW_HIDE.0,
        ..Default::default()
    };
    unsafe {
        ShellExecuteExW(&mut info)?;
        WaitForSingleObject(info.hProcess, INFINITE);
        let mut code = 0u32;
        GetExitCodeProcess(info.hProcess, &mut code)?;
        let _ = CloseHandle(info.hProcess);
        Ok(code)
    }
}
```

- [ ] **Step 5: Run to verify pass** (Windows) — the three pure tests PASS. (`ensure_writable`'s elevation path is exercised only by the VM smoke; the probe + arg-string are unit-covered.)

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add launcher/src/install_acl.rs launcher/src/main.rs
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(launcher): PerMachine ACL writability probe + grant"
```

---

## Task 11: `supervisor.rs` — reduced crash-restart loop + signals

**Files:**
- Create: `launcher/src/supervisor.rs`
- Modify: `launcher/src/main.rs` (add `mod supervisor;`)

Port `ws-scrcpy-web/launcher/src/supervisor.rs`'s `ctrlc` wiring + `wait_with_signal` verbatim; **delete** the exit-75 / `.restart` / service-uninstall machinery. Restart on any unexpected (non-zero) exit, capped at 5 restarts per 60s. Spawn `browser::open_when_ready` once, on first spawn.

- [ ] **Step 1: Add `mod supervisor;` to `main.rs`.**

- [ ] **Step 2: Write the failing tests** — append to `launcher/src/supervisor.rs`

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    #[test]
    fn clean_exit_does_not_restart() {
        assert!(!should_restart(0));
    }

    #[test]
    fn nonzero_exit_restarts() {
        assert!(should_restart(1));
        assert!(should_restart(134));
    }

    #[test]
    fn restart_cap_trips_after_five_in_window() {
        let mut t = RestartTracker::new();
        let now = Instant::now();
        for _ in 0..5 { assert!(t.allow(now)); }
        assert!(!t.allow(now), "6th restart in-window is denied");
    }

    #[test]
    fn restart_cap_resets_after_window() {
        let mut t = RestartTracker::new();
        let start = Instant::now();
        for _ in 0..5 { assert!(t.allow(start)); }
        let later = start + Duration::from_secs(61);
        assert!(t.allow(later), "window elapsed → counter resets");
    }
}
```

- [ ] **Step 3: Run to verify fail** — `cargo test --manifest-path launcher/Cargo.toml supervisor::` → FAIL.

- [ ] **Step 4: Write the implementation** — prepend to `launcher/src/supervisor.rs`

```rust
use anyhow::Result;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

const RESTART_DELAY: Duration = Duration::from_secs(2);
const POLL_INTERVAL: Duration = Duration::from_millis(100);
const MAX_RESTARTS: u32 = 5;
const RESTART_WINDOW: Duration = Duration::from_secs(60);

/// 0b policy: restart the server on any unexpected (non-zero) exit.
pub fn should_restart(exit_code: i32) -> bool {
    exit_code != 0
}

pub struct RestartTracker { count: u32, window_start: Option<Instant> }

impl RestartTracker {
    pub fn new() -> Self { Self { count: 0, window_start: None } }

    /// Record a restart attempt at `now`; return false once the cap is hit
    /// within the rolling window.
    pub fn allow(&mut self, now: Instant) -> bool {
        match self.window_start {
            Some(start) if now.duration_since(start) <= RESTART_WINDOW => {}
            _ => { self.window_start = Some(now); self.count = 0; }
        }
        if self.count >= MAX_RESTARTS { return false; }
        self.count += 1;
        true
    }
}

fn wait_with_signal(child: &mut std::process::Child, stop: &Arc<AtomicBool>) -> Result<std::process::ExitStatus> {
    loop {
        if stop.load(Ordering::SeqCst) {
            crate::log::info(&format!("supervisor: stopping child pid {}", child.id()));
            let _ = child.kill();
            return Ok(child.wait()?);
        }
        if let Some(status) = child.try_wait()? {
            return Ok(status);
        }
        std::thread::sleep(POLL_INTERVAL);
    }
}

/// Spawn + supervise the Node server until a clean exit or a stop signal.
pub fn run() -> Result<i32> {
    let paths = crate::paths::Paths::from_env()?;

    let stop = Arc::new(AtomicBool::new(false));
    let stop_handler = stop.clone();
    if let Err(e) = ctrlc::set_handler(move || stop_handler.store(true, Ordering::SeqCst)) {
        crate::log::error(&format!("supervisor: could not install Ctrl+C handler: {e}"));
    }

    let mut tracker = RestartTracker::new();
    let mut first_spawn = true;

    loop {
        let mut child = crate::spawn::spawn_server(&paths.deps_path, &paths.data_root)?;
        crate::log::info(&format!("supervisor: server started (pid {})", child.id()));

        if first_spawn {
            let data_root = paths.data_root.clone();
            std::thread::spawn(move || crate::browser::open_when_ready(data_root));
            first_spawn = false;
        }

        let status = wait_with_signal(&mut child, &stop)?;
        let code = status.code().unwrap_or(1);
        crate::log::info(&format!("supervisor: server exited with code {code}"));

        if stop.load(Ordering::SeqCst) {
            crate::log::info("supervisor: stop signal; not restarting");
            return Ok(code);
        }
        if !should_restart(code) {
            crate::log::info("supervisor: clean exit; not restarting");
            return Ok(code);
        }
        if !tracker.allow(Instant::now()) {
            crate::log::error("supervisor: restart cap exceeded (5 in 60s); giving up");
            return Ok(code);
        }
        crate::log::warn(&format!("supervisor: unexpected exit {code}; restarting after delay"));
        std::thread::sleep(RESTART_DELAY);
    }
}
```

- [ ] **Step 5: Run to verify pass** — `cargo test --manifest-path launcher/Cargo.toml supervisor::` → PASS.

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add launcher/src/supervisor.rs launcher/src/main.rs
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(launcher): reduced crash-restart supervisor + signals"
```

---

## Task 12: `main.rs` — wire the launch flow

**Files:**
- Modify: `launcher/src/main.rs` (replace the scaffold `main()`)

- [ ] **Step 1: Replace `launcher/src/main.rs`** with the full module list + wired `main()`

```rust
mod browser;
mod config;
mod hooks;
mod log;
mod paths;
mod single_instance;
mod spawn;
mod supervisor;

#[cfg(windows)]
mod install_acl;
#[cfg(windows)]
mod job_object;

fn main() {
    log::init("svgedit-launcher");
    let args: Vec<String> = std::env::args().collect();

    // 1. Velopack hook flags (incl. the undocumented --veloapp-obsolete catch-all)
    //    are handled BEFORE VelopackApp::run() and exit immediately.
    if let Some(code) = hooks::handle_velopack_hook(&args) {
        std::process::exit(code);
    }

    // 2. Velopack handshake — auto-apply OFF (no UAC/restart loop; updates apply
    //    only on explicit user action once the updater lands).
    velopack::VelopackApp::build().set_auto_apply_on_startup(false).run();

    // 3. Single-instance: a 2nd launch opens the browser to the running port + exits.
    let _guard = match single_instance::acquire(&single_instance::current_mutex_name()) {
        Ok(Some(g)) => Some(g),
        Ok(None) => {
            log::info("another svgedit launcher is already running; opening browser + exiting");
            if let Ok(dr) = config::data_root_from_env() {
                if let Some(port) = config::read_web_port(&dr) {
                    browser::open(&browser::url_for_port(port));
                }
            }
            std::process::exit(0);
        }
        Err(e) => { log::error(&format!("single-instance check failed (continuing): {e:#}")); None }
    };

    // 4. [Windows] first-run PerMachine ACL grant on the install root.
    #[cfg(windows)]
    if let Ok(p) = paths::Paths::from_env() {
        if let Err(e) = install_acl::ensure_writable(&p.install_root) {
            log::error(&format!("ACL grant failed (server still works off PROGRAMDATA): {e:#}"));
        }
    }

    // 5. Spawn + supervise the server (blocks until clean exit / signal).
    let code = match supervisor::run() {
        Ok(c) => c,
        Err(e) => { log::error(&format!("supervisor failed: {e:#}")); 1 }
    };

    // 6. [Windows] clear job kill-on-close before graceful exit (Gotcha 8).
    #[cfg(windows)]
    match job_object::release() {
        Ok(_) => {}
        Err(e) => log::error(&format!("job_object release failed (exiting anyway): {e:#}")),
    }

    std::process::exit(code);
}
```

- [ ] **Step 2: Build for the host + run the full suite**

Run: `cargo test --manifest-path launcher/Cargo.toml`
Expected: all module tests PASS; the crate builds with `main()` wired (no `dead_code` warnings remain).

- [ ] **Step 3: Lint clean**

Run: `cargo clippy --manifest-path launcher/Cargo.toml --all-targets -- -D warnings` then `cargo fmt --manifest-path launcher/Cargo.toml --check`
Expected: no warnings, formatted. Fix anything reported.

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add launcher/src/main.rs
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(launcher): wire main launch flow"
```

---

## Task 13: CI — build + test the launcher on both targets

**Files:**
- Create: `.github/workflows/launcher.yml`

- [ ] **Step 1: Write `.github/workflows/launcher.yml`**

```yaml
name: launcher

on:
  push:
    paths:
      - 'launcher/**'
      - '.github/workflows/launcher.yml'
  pull_request:
    paths:
      - 'launcher/**'
      - '.github/workflows/launcher.yml'

permissions:
  contents: read

jobs:
  build-and-test:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: windows-latest
            target: x86_64-pc-windows-msvc
          - os: ubuntu-latest
            target: x86_64-unknown-linux-musl
    runs-on: ${{ matrix.os }}
    defaults:
      run:
        working-directory: launcher
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}
          components: clippy, rustfmt
      - name: Install musl linker
        if: matrix.target == 'x86_64-unknown-linux-musl'
        run: sudo apt-get update && sudo apt-get install -y musl-tools
      - run: cargo fmt --check
      - run: cargo clippy --all-targets --target ${{ matrix.target }} -- -D warnings
      - run: cargo test --target ${{ matrix.target }}
      - run: cargo build --release --target ${{ matrix.target }}
      - name: Verify Linux binary is static
        if: matrix.target == 'x86_64-unknown-linux-musl'
        run: |
          BIN=target/x86_64-unknown-linux-musl/release/svgedit
          file "$BIN"
          ldd "$BIN" || true   # ldd exits nonzero on a fully-static binary — that is the goal
```

> Pin the action SHAs to match the repo's existing convention before merge (see other workflows in `.github/workflows/`). `dtolnay/rust-toolchain@stable` and `actions/checkout@v4` are shown by tag for readability.

- [ ] **Step 2: Validate the workflow locally** (syntax + the build it gates)

Run (host arm only): `cargo build --release --manifest-path launcher/Cargo.toml`
Expected: release build succeeds on the dev host (Windows → confirms `+crt-static` config is picked up).

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add .github/workflows/launcher.yml
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "ci: build + test launcher on msvc and musl targets"
```

---

## Task 14: Repo wiring — npm script, gitignore, docs, CHANGELOG

**Files:**
- Modify: `package.json` (add `build:launcher`)
- Modify: `.gitignore` (ignore `launcher/target/`)
- Modify: `AGENTS.md` (launcher build note)
- Modify: `README.md` (launcher build note)
- Modify: `CHANGELOG.md` (`## [Unreleased]` entry)

- [ ] **Step 1: Add the npm script** to `package.json` `scripts` (kept OUT of `build` so JS contributors need no Rust toolchain)

```json
    "build:launcher": "cargo build --release --manifest-path launcher/Cargo.toml",
```

- [ ] **Step 2: Append to root `.gitignore`**

```text
# Rust launcher build output
/launcher/target
```

- [ ] **Step 3: Add a launcher note to `AGENTS.md`** (under Quick commands)

```markdown
## Launcher (0b)

The `launcher/` crate is svgedit's Velopack `--mainExe` (Rust). It is built
separately from the JS app (`npm run build:launcher` → `cargo build --release
--manifest-path launcher/Cargo.toml`) and is NOT part of `npm run build`, so the
editor build needs no Rust toolchain. Tests: `cargo test --manifest-path
launcher/Cargo.toml`. Static-linked: Windows `+crt-static` (`.cargo/config.toml`),
Linux `x86_64-unknown-linux-musl`. Packaging (`vpk pack`, seed-Node bundling) is
a later #7 milestone.
```

- [ ] **Step 4: Add a one-line build note to `README.md`** (near the existing build commands)

```markdown
- `npm run build:launcher` — build the native Velopack launcher (`launcher/`, Rust). Optional; not needed for the web app.
```

- [ ] **Step 5: Add the CHANGELOG entry** under `## [Unreleased]` (Keep a Changelog; no version bump)

```markdown
### Added (0b launcher -- 2026-06-12)

- New `launcher/` Rust crate: svgedit's statically-linked, cross-platform Velopack `--mainExe`. Handles Velopack hooks, hidden spawn + crash-supervision + single-instance, the Windows PerMachine ACL grant, and launcher-side browser-open around the 0a Node server.
- `npm run build:launcher` builds it (`cargo build --release`); a `launcher` CI job gates it on the msvc + musl targets. Packaging (`vpk pack`, seed-Node bundling) and the in-app updater remain deferred to later #7 milestones.
```

- [ ] **Step 6: Verify the JS lint still passes** (CHANGELOG/README/AGENTS markdown is enforced)

Run: `npm run lint:md`
Expected: PASS (fix any line-length/format issues in the edited markdown).

- [ ] **Step 7: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add package.json .gitignore AGENTS.md README.md CHANGELOG.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "chore(launcher): npm build script, gitignore, docs, changelog"
```

---

## Task 15: Dev integration smoke (documented runbook)

**Files:**
- Create: `launcher/docs/dev-smoke.md`

This is a manual runbook (NOT a CI gate — it needs a real `node` + a built `dist/`). It proves the end-to-end launch path on the dev host before the packaging milestone's authoritative VM smoke.

- [ ] **Step 1: Write `launcher/docs/dev-smoke.md`**

````markdown
# 0b launcher — dev integration smoke

Proves: launcher → spawns node → 0a server → `/healthz` ok → browser opens once.
This is a manual dev check. The authoritative install smoke is the Win11/Fedora
VM pass at the packaging milestone (still **OWED** after 0b).

## Setup

1. Build the web app: `npm run build` (produces `dist/server/` + `dist/editor/`).
2. Build the launcher: `npm run build:launcher`.
3. Stage a layout the launcher expects (it resolves `node` + `dist/` relative to
   its own exe dir, with `current/` as the exe dir and install root its parent):

   ```text
   smoke/
     current/
       svgedit(.exe)          # copy from launcher/target/release/
       dist/  -> copy of the repo's dist/
       seed/node/node(.exe)   # copy your local node binary here
   ```

   On Windows PowerShell:
   ```powershell
   $S = "smoke/current"
   New-Item -ItemType Directory -Force "$S/seed/node" | Out-Null
   Copy-Item launcher/target/release/svgedit.exe "$S/"
   Copy-Item -Recurse dist "$S/dist"
   Copy-Item (Get-Command node).Source "$S/seed/node/node.exe"
   $env:SVGEDIT_DATA_ROOT = (Resolve-Path .).Path + "/smoke/data"
   & "$S/svgedit.exe"
   ```

## Expected

- A hidden node process starts (no console window flashes).
- `smoke/data/config.json` appears with a `webPort` (8100 or a shifted port).
- The default browser opens to `http://localhost:<port>/` showing the editor.
- `smoke/data/logs/svgedit-launcher.log` shows: server started → server healthy → opening.
- Launching `svgedit.exe` a second time opens a browser tab and exits (no 2nd server).
- Ctrl+C / closing the launcher stops the node child (no orphan in Task Manager).
````

- [ ] **Step 2: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add launcher/docs/dev-smoke.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs(launcher): dev integration smoke runbook"
```

---

## Self-review

**Spec coverage** — every spec section maps to a task: crate + static-link (T1), Velopack lifecycle/hooks + auto-apply-off (T6, T12), spawn contract + `SVGEDIT_DATA_ROOT`/no-`DEPS_PATH`/`dist/server/index.js` (T5), supervision + single-instance (T7, T11), job object (T9), PerMachine ACL grant (T10), paths/data-root (T2, T3), browser-open launcher-side (T8), build/static-link (T1), CI (T13), npm/docs/changelog (T14), unit tests throughout + dev smoke (T15) + VM-smoke-OWED (noted T15). Locator: default auto-locate, no module needed (spec §locator) — correctly absent.

**Type consistency** — the API contract block is the single source of truth; signatures used in `main.rs`/`supervisor.rs` match their defining tasks (`spawn_server(deps_path, data_root)`, `supervisor::run() -> Result<i32>`, `config::read_web_port -> Option<u16>`, `single_instance::acquire(&str) -> Result<Option<InstanceGuard>>`, `install_acl::ensure_writable(&Path)`, `job_object::release() -> Result<bool>`).

**Placeholder scan** — no `TBD`/`implement later`. The two "reconcile exact symbol path against the sibling while transcribing" notes (T9 windows imports, T7 rustix feature) are faithful-port transcription pointers with the verbatim code shown, not vague gaps.

**Known build-order coupling** — `spawn.rs` (T5) references `job_object::adopt` (T9) on Windows; do T9 before building T5's `spawn_server` on the msvc arm (the T5 resolver tests are independent and pass first). Called out in T5.

**Carried-forward debt** — the authoritative install **VM smoke is OWED** (Win11 Hyper-V + Fedora), closed at the packaging milestone; the launcher icon (`launcher/assets/svgedit.ico`) is optional in 0b (build.rs embeds it only if present) and finalized at packaging.
