use serde::Deserialize;
use std::{collections::HashMap, io::BufRead, sync::OnceLock};

pub const MAX_REQUEST: usize = 131072;
pub const MAX_RESPONSE: usize = 2 * 1024 * 1024;
pub const MAX_PENDING: usize = 64;
pub const MAX_HOST: usize = 8;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Method { pub mutating: bool, pub timeout_ms: u64, pub dialog: bool, pub allowed_read_only: bool }

pub fn methods() -> &'static HashMap<String, Method> {
    static VALUE: OnceLock<HashMap<String, Method>> = OnceLock::new();
    VALUE.get_or_init(|| serde_json::from_str(include_str!("../../contract/methods.json")).expect("embedded contract"))
}

pub fn request_allowed(name: &str, args: &serde_json::Value) -> bool {
    methods().contains_key(name) && args.is_array() && args.as_array().is_some_and(|v| v.len() <= 2)
        && serde_json::to_vec(args).is_ok_and(|v| v.len() <= 65536)
}

// read_line allocates until newline. Bound *before* allocation, including a peer
// that never sends a newline; never log the rejected payload (it may be secret).
pub fn read_frame(reader: &mut impl BufRead, limit: usize) -> Result<Option<Vec<u8>>, String> {
    let mut frame = Vec::new();
    loop {
        let available = reader.fill_buf().map_err(|_| "PIPE_FAILED")?;
        if available.is_empty() { return if frame.is_empty() { Ok(None) } else { Err("TRUNCATED_FRAME".into()) }; }
        let end = available.iter().position(|b| *b == b'\n');
        let take = end.map_or(available.len(), |i| i+1);
        if frame.len() + take > limit { return Err("PAYLOAD_TOO_LARGE".into()); }
        frame.extend_from_slice(&available[..take]); reader.consume(take);
        if end.is_some() { frame.pop(); return Ok(Some(frame)); }
    }
}

pub fn local_url(url: &url::Url) -> bool {
    ((url.scheme() == "http" || url.scheme() == "https") && url.host_str() == Some("tauri.localhost")
        || url.scheme() == "tauri" && url.host_str() == Some("localhost"))
        && url.port().is_none() && url.username().is_empty() && url.password().is_none()
        && matches!(url.path(), "/" | "/index.html") && url.query().is_none()
}

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn framing_caps_partial_and_large_input() {
        assert_eq!(read_frame(&mut std::io::Cursor::new(b"{}\n{}\n"), 3).unwrap(), Some(b"{}".to_vec()));
        assert!(read_frame(&mut std::io::Cursor::new(b"123456"), 5).is_err());
        assert!(read_frame(&mut std::io::Cursor::new(b"{}"), 5).is_err());
    }
    #[test] fn no_internal_or_unbounded_renderer_requests() {
        assert!(request_allowed("getState", &serde_json::json!([])));
        for method in ["secret.encrypt", "boot", "$shutdown", "spawn", "__proto__"] { assert!(!request_allowed(method, &serde_json::json!([]))); }
        assert!(!request_allowed("getState", &serde_json::json!(["x".repeat(65537)])));
        assert!(!request_allowed("getState", &serde_json::json!({})));
    }
    #[test] fn only_packaged_main_document() {
        assert!(local_url(&url::Url::parse("http://tauri.localhost/index.html").unwrap()));
        for u in ["https://example.com/", "http://tauri.localhost.evil/", "http://tauri.localhost:8080/", "http://tauri.localhost/other.html"] { assert!(!local_url(&url::Url::parse(u).unwrap())); }
    }
}
