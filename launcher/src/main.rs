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
    velopack::VelopackApp::build()
        .set_auto_apply_on_startup(false)
        .run();

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
        Err(e) => {
            log::error(&format!("single-instance check failed (continuing): {e:#}"));
            None
        }
    };

    // 4. [Windows] first-run PerMachine ACL grant on the install root.
    #[cfg(windows)]
    if let Ok(p) = paths::Paths::from_env() {
        if let Err(e) = install_acl::ensure_writable(&p.install_root) {
            log::error(&format!(
                "ACL grant failed (server still works off PROGRAMDATA): {e:#}"
            ));
        }
    }

    // 5. Spawn + supervise the server (blocks until clean exit / signal).
    let code = match supervisor::run() {
        Ok(c) => c,
        Err(e) => {
            log::error(&format!("supervisor failed: {e:#}"));
            1
        }
    };

    // 6. [Windows] clear job kill-on-close before graceful exit (Gotcha 8).
    #[cfg(windows)]
    match job_object::release() {
        Ok(_) => {}
        Err(e) => log::error(&format!(
            "job_object release failed (exiting anyway): {e:#}"
        )),
    }

    std::process::exit(code);
}
