// Install-root ACL grant for the running user (Windows-only).
//
// On a PerMachine (Program Files) install, the MSI component-permission step
// resets the explicit DACL on the install root to inherited-only after our
// Velopack install hook runs.  The result: the Velopack updater can't write
// its state, falls back to LocalAppData, and the elevated Update.exe swap
// silently dies.
//
// Solution: defer the grant to first non-hook launcher start.  If the install
// root isn't user-writable, ShellExecuteEx an elevated icacls invocation
// (one-time UAC prompt).  Once granted, all subsequent launches skip the
// elevation entirely.

use anyhow::{bail, Context, Result};
use std::path::Path;

const SENTINEL: &str = ".svgedit-write-test";
const AUTH_USERS_SID: &str = "*S-1-5-11";

/// Test whether the running user can write to `path`.
///
/// Creates and immediately removes a sentinel file.  Returns `false` if the
/// path does not exist or if the write is denied.
pub fn is_writable(path: &Path) -> bool {
    let probe = path.join(SENTINEL);
    match std::fs::write(&probe, b"") {
        Ok(()) => {
            let _ = std::fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

/// Build the exact icacls argument string used by `run_elevated_icacls`.
///
/// Kept as a public function so it can be asserted in tests and reused by
/// callers that want to log or audit the command before elevation.
pub fn icacls_args(install_root: &Path) -> String {
    format!(
        "\"{}\" /grant {}:(OI)(CI)M /T /C /Q",
        install_root.display(),
        AUTH_USERS_SID
    )
}

/// Ensure the install root has `Authenticated Users:Modify (OI)(CI)` so the
/// Velopack updater can swap `current\` without elevation.
///
/// If `install_root` is already writable to the running user, returns `Ok(())`
/// without prompting.  Otherwise fires one UAC-elevated icacls invocation.
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
fn to_wide(s: &str) -> Vec<u16> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    OsStr::new(s)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

#[cfg(windows)]
fn run_elevated_icacls(install_root: &Path) -> Result<i32> {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{GetExitCodeProcess, WaitForSingleObject, INFINITE};
    use windows::Win32::UI::Shell::{ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW};

    let parameters = icacls_args(install_root);

    let verb = to_wide("runas");
    let file = to_wide("icacls.exe");
    let params = to_wide(&parameters);

    let mut info = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_NOCLOSEPROCESS,
        lpVerb: PCWSTR(verb.as_ptr()),
        lpFile: PCWSTR(file.as_ptr()),
        lpParameters: PCWSTR(params.as_ptr()),
        nShow: 0, // SW_HIDE — don't flash an icacls console window
        ..Default::default()
    };

    unsafe {
        ShellExecuteExW(&mut info)
            .context("ShellExecuteExW failed (UAC declined or admin not available?)")?;
    }

    if info.hProcess.is_invalid() {
        bail!("ShellExecuteExW returned no process handle");
    }

    let proc = info.hProcess;
    unsafe {
        WaitForSingleObject(proc, INFINITE);
        let mut code: u32 = 1;
        let result = GetExitCodeProcess(proc, &mut code);
        let _ = CloseHandle(proc);
        result.context("GetExitCodeProcess failed")?;
        Ok(code as i32)
    }
}

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
        assert!(!is_writable(std::path::Path::new(
            "Z:/no/such/svgedit-acl-test"
        )));
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
