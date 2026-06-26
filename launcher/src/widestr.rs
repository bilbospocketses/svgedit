//! Win32 wide-string helper.
//!
//! Converts a `&str` to a NUL-terminated UTF-16 buffer for the `*W` Windows
//! APIs that take a `PCWSTR`. Extracted from the byte-identical copies that
//! lived in `install_acl` and `single_instance`.

use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;

/// Encode `s` as a NUL-terminated UTF-16 `Vec<u16>` suitable for `PCWSTR`.
pub fn to_wide(s: &str) -> Vec<u16> {
    OsStr::new(s)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}
