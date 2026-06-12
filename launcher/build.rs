// Embed version metadata into the launcher .exe (and the app icon when
// launcher/assets/svgedit.ico exists). No-op on non-Windows targets.
fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=assets/svgedit.ico");
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
