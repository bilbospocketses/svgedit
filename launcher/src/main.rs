mod browser;
mod config;
mod hooks;
mod log;
mod paths;
mod single_instance;
mod spawn;
mod supervisor;
#[cfg(windows)] mod job_object;
#[cfg(windows)] mod install_acl;

fn main() {
    println!("svgedit launcher (0b scaffold)");
}
