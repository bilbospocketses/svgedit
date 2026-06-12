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
    while let Ok(n) = stream.read(&mut chunk) {
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
        if buf.len() >= 64 || buf.windows(4).any(|w| w == b"\r\n\r\n") {
            break;
        }
    }
    let head = String::from_utf8_lossy(&buf);
    head.starts_with("HTTP/1.") && head.split_whitespace().nth(1) == Some("200")
}

#[cfg(windows)]
pub fn open(url: &str) {
    use windows::core::{w, PCWSTR};
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
    let wide: Vec<u16> = url.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        ShellExecuteW(
            None,
            w!("open"),
            PCWSTR::from_raw(wide.as_ptr()),
            PCWSTR::null(),
            PCWSTR::null(),
            SW_SHOWNORMAL,
        );
    }
}

#[cfg(not(windows))]
pub fn open(url: &str) {
    let _ = std::process::Command::new("xdg-open").arg(url).spawn();
}

/// Read the bound port from config.json, wait for /healthz, then open the browser
/// once. Designed to run in its own thread; all errors are swallowed + logged.
pub fn open_when_ready(data_root: PathBuf) {
    let mut port = None;
    for _ in 0..150 {
        if let Some(p) = crate::config::read_web_port(&data_root) {
            port = Some(p);
            break;
        }
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
    crate::log::error(&format!(
        "browser: server on {port} never became healthy; not opening"
    ));
}

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
        assert!(!check_healthz(1));
    }
}
