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
