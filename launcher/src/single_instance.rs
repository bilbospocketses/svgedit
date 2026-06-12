// Single-instance guard for the launcher.
//
// Prevents double-launching the svgedit launcher. A Windows named mutex in
// the Local namespace (suffixed with the process token elevation) is used on
// Windows; an exclusive flock on a lock file is used on unix.
//
// Two mutex names exist so ONE non-elevated and ONE elevated instance can
// legitimately coexist (e.g. admin instance for service work while normal
// instance runs).

const MUTEX_BASE: &str = r"Local\svgedit-SingleInstance";

/// Build the canonical mutex name for THIS process's elevation level.
pub fn current_mutex_name() -> String {
    let suffix = if imp::is_elevated() { "Admin" } else { "User" };
    format!("{MUTEX_BASE}-{suffix}")
}

pub use imp::acquire;
#[cfg(unix)]
#[allow(unused_imports)] // used by the unix test; not by the bin
pub use imp::acquire_at;
#[allow(unused_imports)]
pub use imp::is_elevated;
#[allow(unused_imports)]
pub use imp::InstanceGuard;

#[cfg(windows)]
mod imp {
    use anyhow::Result;
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    fn to_wide(s: &str) -> Vec<u16> {
        OsStr::new(s)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    pub struct InstanceGuard {
        handle: windows::Win32::Foundation::HANDLE,
    }

    impl Drop for InstanceGuard {
        fn drop(&mut self) {
            unsafe {
                let _ = windows::Win32::Foundation::CloseHandle(self.handle);
            }
        }
    }

    pub fn acquire(name: &str) -> Result<Option<InstanceGuard>> {
        use windows::core::PCWSTR;
        use windows::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS};
        use windows::Win32::System::Threading::CreateMutexW;

        let wide = to_wide(name);
        let handle = unsafe { CreateMutexW(None, false, PCWSTR::from_raw(wide.as_ptr()))? };
        let last = unsafe { GetLastError() };
        if last == ERROR_ALREADY_EXISTS {
            unsafe {
                let _ = windows::Win32::Foundation::CloseHandle(handle);
            }
            return Ok(None);
        }
        Ok(Some(InstanceGuard { handle }))
    }

    pub fn is_elevated() -> bool {
        use windows::Win32::Foundation::{CloseHandle, HANDLE};
        use windows::Win32::Security::{
            GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
        };
        use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

        unsafe {
            let mut token: HANDLE = HANDLE::default();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
                return false;
            }
            let mut elevation = TOKEN_ELEVATION::default();
            let mut size = 0u32;
            let ok = GetTokenInformation(
                token,
                TokenElevation,
                Some(&mut elevation as *mut _ as *mut std::ffi::c_void),
                std::mem::size_of::<TOKEN_ELEVATION>() as u32,
                &mut size,
            );
            let _ = CloseHandle(token);
            if ok.is_err() {
                return false;
            }
            elevation.TokenIsElevated != 0
        }
    }
}

#[cfg(not(windows))]
mod imp {
    use anyhow::Result;
    use rustix::fs::{flock, FlockOperation};
    use std::fs::{File, OpenOptions};
    use std::path::{Path, PathBuf};

    pub struct InstanceGuard {
        _file: File,
    }

    pub fn is_elevated() -> bool {
        rustix::process::getuid().is_root()
    }

    pub fn lock_path() -> PathBuf {
        if let Ok(x) = std::env::var("XDG_RUNTIME_DIR") {
            if !x.is_empty() {
                return PathBuf::from(x).join("svgedit.lock");
            }
        }
        let data_root =
            crate::config::data_root_from_env().unwrap_or_else(|_| PathBuf::from("/tmp"));
        data_root.join("control").join("instance.lock")
    }

    pub fn acquire_at(path: &Path) -> Result<Option<InstanceGuard>> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(false)
            .open(path)?;
        match flock(&file, FlockOperation::NonBlockingLockExclusive) {
            Ok(()) => Ok(Some(InstanceGuard { _file: file })),
            Err(e) if e == rustix::io::Errno::WOULDBLOCK => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn acquire(_name: &str) -> Result<Option<InstanceGuard>> {
        acquire_at(&lock_path())
    }
}

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
        assert!(
            g2.is_none(),
            "second acquire should be denied while first held"
        );
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
