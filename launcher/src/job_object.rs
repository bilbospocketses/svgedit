// Windows Job Object that owns the Node child + its descendants.
//
// Pattern: a single process-wide unnamed Job Object with
// JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE. The launcher holds the only handle for
// its full lifetime — when the launcher process exits (graceful or killed),
// the OS closes the last handle, the job destructs, and Windows terminates
// every process in the job.
//
// `release()` clears the KILL_ON_JOB_CLOSE flag before graceful exit so that
// child processes (e.g. an updater spawned as a grandchild) can outlive the
// launcher when it exits normally. Hard-kill paths bypass our cleanup, so the
// safety net stays intact for abnormal termination.

use anyhow::{anyhow, Context, Result};
use std::os::windows::io::AsRawHandle;
use std::process::Child;
use std::sync::OnceLock;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};

struct JobHandle(HANDLE);
// SAFETY: HANDLE is an integer-sized opaque value; the Windows kernel handles
// thread safety on the operations we perform (AssignProcessToJobObject is
// documented as thread-safe).
unsafe impl Send for JobHandle {}
unsafe impl Sync for JobHandle {}

static JOB: OnceLock<Option<JobHandle>> = OnceLock::new();

fn create_job() -> Option<HANDLE> {
    unsafe {
        let job = CreateJobObjectW(None, PCWSTR::null()).ok()?;

        let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

        let res = SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const _,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        if res.is_err() {
            let _ = CloseHandle(job);
            return None;
        }
        Some(job)
    }
}

/// Adopt `child` into a process-global job with KILL_ON_JOB_CLOSE so the
/// child (and its descendants) die when the launcher exits abnormally.
pub fn adopt(child: &Child) -> Result<()> {
    let job_handle = JOB
        .get_or_init(|| create_job().map(JobHandle))
        .as_ref()
        .ok_or_else(|| anyhow!("could not create Job Object"))?
        .0;

    let raw = child.as_raw_handle();
    let proc = HANDLE(raw);
    unsafe {
        AssignProcessToJobObject(job_handle, proc).context("AssignProcessToJobObject failed")?;
    }
    Ok(())
}

/// Clear KILL_ON_JOB_CLOSE so a graceful launcher exit does NOT reap job
/// members mid-operation. Returns `false` if no job was ever adopted.
pub fn release() -> Result<bool> {
    let Some(slot) = JOB.get() else {
        return Ok(false);
    };
    let Some(handle) = slot.as_ref() else {
        return Ok(false);
    };
    let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
    // Explicit zero — no kill-on-close, no other flags.
    info.BasicLimitInformation.LimitFlags = windows::Win32::System::JobObjects::JOB_OBJECT_LIMIT(0);
    unsafe {
        SetInformationJobObject(
            handle.0,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const _,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        )
        .context("SetInformationJobObject(release) failed")?;
    }
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    #[test]
    fn release_after_adopt_is_idempotent() {
        let mut child = Command::new("cmd")
            .args(["/c", "exit", "0"])
            .spawn()
            .unwrap();
        adopt(&child).unwrap();
        assert!(release().unwrap());
        assert!(release().unwrap()); // idempotent
        let _ = child.wait();
    }
}
