#![allow(dead_code)]
//! Test host for 「새 PC로 옮겨 오기」: one JSON line in (`{"id":1,"method":"files.place","args":[…]}`), one JSON line out
//! (`{"id":1,"ok":true,"value":…}` or `{"id":1,"ok":false,"code":"…"}`), through the same Rust modules the window app
//! gives the worker. `reinstall.user` and `reinstall.elevate` are refused here: tests never install anything.
#[path = "../../src-tauri/src/platform.rs"] mod platform;
#[path = "../../src-tauri/src/files.rs"] mod files;
#[path = "../../src-tauri/src/folders.rs"] mod folders;
#[path = "../../src-tauri/src/reinstall.rs"] mod reinstall;
use serde_json::{json, Value};
use std::io::{BufRead, Write};

fn call(method: &str, args: &[Value]) -> Result<Value, String> {
    if matches!(method, "reinstall.user" | "reinstall.elevate") { return Err("TEST_HOST_NO_INSTALL".into()); }
    files::host(method, args).or_else(|| folders::host(method, args)).or_else(|| reinstall::host(method, args)).unwrap_or_else(|| Err("HOST_METHOD".into()))
}
/// The window app's frame limits (src-tauri/src/protocol.rs): what the worker sends (MAX_RESPONSE) and what goes back to
/// it (MAX_REQUEST — a bigger one stops the worker). The test host refuses both, so a test meets them as the app would
/// (카본 끝판 E9).
const FROM_WORKER: usize = 2 * 1024 * 1024;
const TO_WORKER: usize = 131072;
fn main() {
    let stdin = std::io::stdin(); let mut out = std::io::stdout();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        let request: Value = match serde_json::from_str(&line) { Ok(v) => v, Err(_) => break };
        let args = request["args"].as_array().cloned().unwrap_or_default();
        let reply = if line.len() + 1 > FROM_WORKER { json!({"id":request["id"],"ok":false,"code":"HOST_FRAME_TOO_LARGE"}) } else {
            match call(request["method"].as_str().unwrap_or(""), &args) {
                Ok(value) => json!({"id":request["id"],"ok":true,"value":value}),
                Err(code) => json!({"id":request["id"],"ok":false,"code":code}),
            }
        };
        let mut text = reply.to_string();
        if text.len() + 1 > TO_WORKER { text = json!({"id":request["id"],"ok":false,"code":"HOST_ANSWER_TOO_LARGE"}).to_string(); }
        if writeln!(out, "{text}").and_then(|_| out.flush()).is_err() { break; }
    }
}
