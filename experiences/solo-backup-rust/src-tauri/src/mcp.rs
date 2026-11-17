//! AI 도구에서 솔리오 쓰기 — MCP 보기 도구 (STAGE1_DESIGN.md 4.16). `WorkBackupRun.exe --mcp`가 표준 입출력으로 MCP 서버가
//! 된다(한 줄에 JSON-RPC 메시지 하나). 인터넷 쪽으로는 열지 않는다.
//!
//! - 도구는 셋이다. `protection_status`(상태 파일 그대로 — 이름이 없어 동의 전에도 답한다), `space_report`(공간 보고서 — 경로가
//!   있어 동의가 든다), `find_restorable`(이름 일부로 가장 새 확인된 판 안의 파일 찾기 — 동의가 든다). 셋 다 읽기만 한다.
//! - 동의는 엔진 창의 설정 서랍 「AI 도구」가 도구마다 켜고 끈다(`mcp/consent.json`). 동의 전에는 창을 열지 않고 그 서랍을
//!   안내하는 글만 돌려준다. 손님이 고른 가리는 낱말이 든 경로는 결과에서 빼고 뺀 수도 알리지 않으며, 찾는 낱말에 그 낱말이
//!   들면 찾지 않는다.
//! - 엔진 잠금을 쥐지 않는다. 회차가 도는 중이면(진행 파일) 기다리지 않고 「잠시 뒤에」를 돌려준다. 찾기는 읽기 전용 워커
//!   (worker/mcp.cjs, restic은 읽기 명령만 `--no-lock`)가 하고, 이 서버는 워커의 짧은 허용 목록(`WORKER_METHODS`)만 부른다.
//!   찾기는 한 시간에 10번(이 PC의 MCP 프로세스를 모두 합쳐), 한 번에 60초까지다. 종량 회선과 쉬는 회선에서는 찾지 않는다.
//! - 표준 입력이 닫힐 때까지 남고, 5분 동안 요청이 없으면 워커만 내린다. 설치 · 업데이트 표식(`.installing`)이 보이면 바로
//!   끝난다(요청마다, 그리고 1분마다 본다).
//! - 기록 `mcp.jsonl`에는 호출마다 도구 이름 · 결과 수 · 걸린 ms만 남긴다. 찾은 낱말과 경로는 남기지 않는다.
use backup_native::{platform, power, protocol, runlog, secret, worker::Worker};
use fs2::FileExt;
use serde_json::{json, Map, Value};
use std::{fs, io::{BufReader, Read, Seek, Write}, path::{Path, PathBuf}, sync::{Arc, Mutex}, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};

/// 이 서버가 아는 MCP 판(새 것부터). 클라이언트가 고른 판이 이 안에 있으면 그것으로, 아니면 맨 앞 판으로 답한다.
const PROTOCOLS: [&str; 4] = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const LINE_MAX: usize = 1 << 20;
const FINDS_PER_HOUR: usize = 10;
const FIND_LIMIT: Duration = Duration::from_secs(60);
const IDLE: Duration = Duration::from_secs(300);
const RESULTS: usize = 50;
/// 워커에서 부르는 메서드의 짧은 허용 목록(worker/mcp.cjs METHODS와 같다). methods.json의 `allowedReadOnly`는 「복구 전용
/// 연결에서 부를 수 있다」는 뜻이고 되살리기 같은 바꾸는 메서드도 들어 있어, AI 쪽 경계로 쓰지 않는다.
pub const WORKER_METHODS: [&str; 2] = ["getState", "findFiles"];
pub fn allowed(method: &str) -> bool { WORKER_METHODS.contains(&method) }
pub const TOOLS: [&str; 3] = ["protection_status", "space_report", "find_restorable"];
/// 동의가 드는 도구.
const CONSENTED: [&str; 2] = ["space_report", "find_restorable"];
const LOG_LIMIT: u64 = 262_144;

const NEED_CONSENT: &str = "이 도구는 아직 꺼져 있습니다. 업무 백업 엔진 창의 설정 서랍 「AI 도구」에서 이 도구를 켜 주세요. 켜기 전에는 파일 이름과 폴더 이름을 AI 도구에 보내지 않습니다.";
const BUSY: &str = "지금 백업 중이라 잠시 뒤에 다시 해 주세요.";
const RESTING: &str = "지금은 내려받기를 쉬는 회선입니다. 데이터 요금제 회선이나 쉬도록 고른 Wi-Fi에서는 백업 안을 찾지 않습니다.";
const TOO_MANY: &str = "백업 안 찾기는 한 시간에 10번까지입니다. 잠시 뒤에 다시 해 주세요.";
const TOO_LONG: &str = "찾기가 60초 안에 끝나지 않았습니다. 더 긴 낱말로 다시 찾아 주세요.";

fn epoch_ms() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0) }

/// 상태 폴더 안의 작은 JSON 파일을 연결점을 따라가지 않고 읽는다.
fn read_small(file: &Path, max: u64) -> Option<Value> {
    use std::os::windows::fs::MetadataExt;
    let meta = fs::symlink_metadata(file).ok()?;
    if meta.file_attributes() & 0x400 != 0 || !meta.is_file() || meta.len() > max { return None; }
    serde_json::from_slice(&fs::read(file).ok()?).ok()
}

/// 동의와 가리는 낱말(`mcp/consent.json` — 엔진 창의 「AI 도구」가 쓴다). 없거나 깨졌으면 모두 꺼짐.
#[derive(Debug, Default, Clone, PartialEq)]
pub struct Consent { pub tools: Vec<String>, pub masks: Vec<String> }
pub fn consent(root: &Path) -> Consent {
    let Some(v) = read_small(&root.join("mcp").join("consent.json"), 16_384) else { return Consent::default() };
    if v["v"] != 1 { return Consent::default(); }
    let tools = CONSENTED.iter().filter(|t| v["tools"][**t] == true).map(|t| t.to_string()).collect();
    let masks = v["masks"].as_array().into_iter().flatten().filter_map(|m| m.as_str()).map(|m| m.trim().to_lowercase()).filter(|m| !m.is_empty() && m.chars().count() <= 40).take(20).collect();
    Consent { tools, masks }
}
fn masked(masks: &[String], text: &str) -> bool { let t = text.to_lowercase(); masks.iter().any(|m| t.contains(m.as_str())) }

/// 한 시간에 10번: 이 PC의 MCP 프로세스가 함께 세는 `mcp/finds.json`을 잠그고 셈한다. 자리가 있으면 지금을 적고 true.
pub fn take_find(root: &Path, now: u64) -> bool {
    let dir = root.join("mcp");
    if fs::create_dir_all(&dir).is_err() { return false; }
    let Ok(mut file) = fs::OpenOptions::new().read(true).write(true).create(true).truncate(false).open(dir.join("finds.json")) else { return false };
    if file.lock_exclusive().is_err() { return false; }
    let mut text = String::new();
    let _ = Read::by_ref(&mut file).take(16_384).read_to_string(&mut text);
    let mut times: Vec<u64> = serde_json::from_str::<Value>(&text).ok().and_then(|v| v["at"].as_array().cloned()).unwrap_or_default()
        .iter().filter_map(Value::as_u64).filter(|t| *t <= now && now - t < 3_600_000).collect();
    let ok = times.len() < FINDS_PER_HOUR;
    if ok { times.push(now); }
    let body = serde_json::to_vec(&json!({"v": 1, "at": times})).unwrap_or_default();
    let written = file.set_len(0).is_ok() && file.rewind().is_ok() && file.write_all(&body).is_ok();
    let _ = FileExt::unlock(&file);
    ok && written
}

/// 이 서버를 띄운 프로그램의 경로(부모 프로세스). 설정 서랍이 도구 이름 옆에 보인다.
fn parent_exe() -> Option<String> {
    use windows_sys::Win32::{Foundation::CloseHandle, System::Threading::{GetCurrentProcess, OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION}};
    #[repr(C)] struct Basic { exit_status: i32, peb: usize, affinity: usize, base_priority: i32, unique_pid: usize, parent_pid: usize }
    #[link(name = "ntdll")]
    extern "system" { fn NtQueryInformationProcess(handle: *mut core::ffi::c_void, class: u32, info: *mut core::ffi::c_void, len: u32, ret: *mut u32) -> i32; }
    let mut info = Basic { exit_status: 0, peb: 0, affinity: 0, base_priority: 0, unique_pid: 0, parent_pid: 0 };
    let mut len = 0u32;
    let status = unsafe { NtQueryInformationProcess(GetCurrentProcess(), 0, &mut info as *mut Basic as _, std::mem::size_of::<Basic>() as u32, &mut len) };
    if status != 0 || info.parent_pid == 0 { return None; }
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, info.parent_pid as u32);
        if handle.is_null() { return None; }
        let mut buf = [0u16; 1024]; let mut size = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut size) != 0;
        CloseHandle(handle);
        ok.then(|| String::from_utf16_lossy(&buf[..size as usize]))
    }
}
/// 도구 이름이나 판처럼 상대가 스스로 알린 글: 제어 문자를 빼고 64자까지.
fn label(v: &Value) -> Option<String> { v.as_str().map(|s| s.chars().filter(|c| !c.is_control()).take(64).collect::<String>()).filter(|s| !s.trim().is_empty()) }
/// `mcp/clients.json`: MCP 연결이 알려 온 도구 이름과 처음 · 마지막으로 본 때, 띄운 프로그램(20개까지).
fn remember_client(root: &Path, info: &Value, now: u64) {
    let Some(name) = label(&info["name"]) else { return };
    let dir = root.join("mcp");
    if fs::create_dir_all(&dir).is_err() { return; }
    let Ok(mut file) = fs::OpenOptions::new().read(true).write(true).create(true).truncate(false).open(dir.join("clients.json")) else { return };
    if file.lock_exclusive().is_err() { return; }
    let mut text = String::new();
    let _ = Read::by_ref(&mut file).take(65_536).read_to_string(&mut text);
    let mut list: Vec<Value> = serde_json::from_str::<Value>(&text).ok().and_then(|v| v["clients"].as_array().cloned()).unwrap_or_default();
    let exe = parent_exe();
    match list.iter_mut().find(|c| c["name"] == name.as_str() && c["exe"] == json!(exe)) {
        Some(c) => { c["lastSeen"] = json!(now); c["version"] = json!(label(&info["version"])); }
        None => list.push(json!({"name": name, "version": label(&info["version"]), "exe": exe, "firstSeen": now, "lastSeen": now})),
    }
    list.sort_by_key(|c| std::cmp::Reverse(c["lastSeen"].as_u64().unwrap_or(0)));
    list.truncate(20);
    let body = serde_json::to_vec(&json!({"v": 1, "clients": list})).unwrap_or_default();
    let _ = file.set_len(0).and_then(|_| file.rewind()).and_then(|_| file.write_all(&body));
    let _ = FileExt::unlock(&file);
}
/// `mcp.jsonl`: 도구 이름 · 결과 수 · ms만(256KB에서 `mcp.1.jsonl`로 넘긴다).
fn log(root: &Path, tool: &str, count: usize, ms: u64) {
    let path = root.join("mcp.jsonl");
    if fs::metadata(&path).is_ok_and(|m| m.len() >= LOG_LIMIT) { let _ = fs::rename(&path, root.join("mcp.1.jsonl")); }
    let line = format!("{}\n", json!({"v": 1, "at": epoch_ms(), "tool": tool, "count": count, "ms": ms}));
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&path) { let _ = f.write_all(line.as_bytes()); }
}

pub fn tools() -> Value {
    let empty = json!({"type": "object", "properties": {}, "additionalProperties": false});
    let read_only = json!({"readOnlyHint": true, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false});
    json!({"tools": [
        {"name": "protection_status", "title": "업무 백업 보호 상태",
         "description": "SYNK 솔리오 업무 백업이 이 PC를 지키고 있는지 알려 줍니다: 보호 상태 낱말(safe · starting · attention · paused · off · not-set-up · moved · restore-only), 마지막으로 백업을 확인한 시각, 되살리기 증명, 주의할 주제, 지금 도는 작업, 다음 회차 예정 시각. 파일 이름이나 경로는 들어 있지 않습니다.",
         "inputSchema": empty, "annotations": read_only},
        {"name": "space_report", "title": "디스크 공간 보고서",
         "description": "하루 한 번 백업 회차 끝에 만드는 디스크 공간 분석입니다: 드라이브마다 남은 공간과 증가 속도, 「이대로면 며칠 뒤 정한 선 아래」, 지난 7일 가장 많이 늘어난 자리, 비울 수 있는 후보(등급 auto · suggest · view, 크기, 까닭, 경로). 아무것도 지우지 않습니다. 엔진 창 설정 서랍 「AI 도구」에서 켜야 답합니다.",
         "inputSchema": empty, "annotations": read_only},
        {"name": "find_restorable", "title": "백업 안 파일 찾기",
         "description": "이름 일부로 가장 새로 확인된 백업 판 안의 파일을 찾아 판 시각, 크기, 원래 경로를 50개까지 돌려줍니다. 지금 판에 없는 파일(예: 어제 지운 파일)은 아직 찾지 못합니다. 되살리기는 엔진 창에서 합니다. 한 시간에 10번, 한 번에 60초까지이고, 데이터 요금제 회선이나 쉬도록 고른 Wi-Fi에서는 찾지 않습니다. 엔진 창 설정 서랍 「AI 도구」에서 켜야 답합니다.",
         "inputSchema": {"type": "object", "properties": {"query": {"type": "string", "minLength": 1, "maxLength": 100, "description": "찾을 파일 이름의 일부(대소문자 구분 없음)"}}, "required": ["query"], "additionalProperties": false},
         "annotations": read_only},
    ]})
}

/// 한 도구 호출의 결과: 글, 구조화된 값, 결과 수(기록용), 실패인지.
struct Answer { text: String, value: Option<Value>, count: usize, error: bool }
impl Answer {
    fn value(value: Value, count: usize) -> Self { Self { text: serde_json::to_string_pretty(&value).unwrap_or_default(), value: Some(value), count, error: false } }
    fn say(text: &str) -> Self { Self { text: text.into(), value: None, count: 0, error: true } }
    fn into_result(self) -> Value {
        let mut r = json!({"content": [{"type": "text", "text": self.text}], "isError": self.error});
        if let Some(v) = self.value { r["structuredContent"] = v; }
        r
    }
}

pub struct Server {
    root: PathBuf, resources: PathBuf, exe_dir: PathBuf, test: bool,
    worker: Mutex<Option<Arc<Worker>>>, last: Mutex<Instant>,
    runtime: tokio::runtime::Runtime,
}
impl Server {
    pub fn new(root: PathBuf, resources: PathBuf, exe_dir: PathBuf, test: bool) -> Result<Self, String> {
        let runtime = tokio::runtime::Builder::new_current_thread().enable_time().build().map_err(|_| "RUNTIME")?;
        Ok(Self { root, resources, exe_dir, test, worker: Mutex::new(None), last: Mutex::new(Instant::now()), runtime })
    }
    /// 한 줄의 메시지에 대한 답(알림이면 None).
    pub fn handle(&self, bytes: &[u8]) -> Option<Value> {
        let Ok(msg) = serde_json::from_slice::<Value>(bytes) else { return Some(json!({"jsonrpc": "2.0", "id": null, "error": {"code": -32700, "message": "Parse error"}})) };
        let id = msg.get("id").cloned();
        let method = msg["method"].as_str();
        if !msg.is_object() || msg["jsonrpc"] != "2.0" || method.is_none() || id.as_ref().is_some_and(|i| !(i.is_string() || i.is_i64() || i.is_u64())) {
            // 답이 오면 안 되는 것(상대의 답 · 알림)은 버린다.
            if msg.is_object() && method.is_none() && (msg.get("result").is_some() || msg.get("error").is_some()) { return None; }
            return Some(json!({"jsonrpc": "2.0", "id": id.unwrap_or(Value::Null), "error": {"code": -32600, "message": "Invalid Request"}}));
        }
        let id = id?; // 알림(notifications/initialized 따위)
        let result = match method.unwrap_or("") {
            "initialize" => Ok(self.initialize(&msg["params"])),
            "ping" => Ok(json!({})),
            "tools/list" => Ok(tools()),
            "tools/call" => self.call(&msg["params"]),
            _ => Err((-32601, "Method not found")),
        };
        Some(match result {
            Ok(r) => json!({"jsonrpc": "2.0", "id": id, "result": r}),
            Err((code, message)) => json!({"jsonrpc": "2.0", "id": id, "error": {"code": code, "message": message}}),
        })
    }
    fn initialize(&self, params: &Value) -> Value {
        let asked = params["protocolVersion"].as_str().unwrap_or("");
        let version = PROTOCOLS.iter().find(|v| **v == asked).copied().unwrap_or(PROTOCOLS[0]);
        if !self.test { remember_client(&self.root, &params["clientInfo"], epoch_ms()); }
        json!({"protocolVersion": version, "capabilities": {"tools": {"listChanged": false}},
            "serverInfo": {"name": "synk-solio-backup", "title": "SYNK 솔리오 업무 백업", "version": env!("CARGO_PKG_VERSION")},
            "instructions": "SYNK 솔리오 업무 백업의 보기 도구입니다. 백업 상태, 디스크 공간 보고서, 백업 안 파일 찾기만 하고 아무것도 바꾸거나 지우지 않습니다. 되살리기와 공간 비우기는 사람이 엔진 창에서 합니다."})
    }
    fn call(&self, params: &Value) -> Result<Value, (i32, &'static str)> {
        if platform::installing(&self.exe_dir) { std::process::exit(0); }
        *self.last.lock().unwrap() = Instant::now();
        let name = params["name"].as_str().unwrap_or("");
        if !TOOLS.contains(&name) { return Err((-32602, "Unknown tool")); }
        let args = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
        if !args.is_object() { return Err((-32602, "Invalid arguments")); }
        let started = Instant::now();
        let answer = match name {
            "protection_status" => self.status(&args),
            "space_report" => self.space(&args),
            _ => self.find(&args),
        };
        log(&self.root, name, answer.count, started.elapsed().as_millis() as u64);
        *self.last.lock().unwrap() = Instant::now();
        Ok(answer.into_result())
    }
    fn status(&self, args: &Value) -> Answer {
        if !args.as_object().is_some_and(Map::is_empty) { return Answer::say("이 도구는 입력을 받지 않습니다."); }
        match read_small(&self.root.join("solio").join("status.json"), 65_536) {
            Some(v) if v["v"] == 1 => Answer::value(v, 1),
            _ => Answer::say("업무 백업 엔진이 아직 상태를 남기지 않았습니다. 이 PC에서 보호를 시작하지 않았거나 엔진이 아직 한 번도 돌지 않았습니다."),
        }
    }
    fn space(&self, args: &Value) -> Answer {
        if !args.as_object().is_some_and(Map::is_empty) { return Answer::say("이 도구는 입력을 받지 않습니다."); }
        let c = consent(&self.root);
        if !c.tools.iter().any(|t| t == "space_report") { return Answer::say(NEED_CONSENT); }
        let Some(mut v) = read_small(&self.root.join("solio").join("space.json"), 1_048_576).filter(|v| v["v"] == 1) else {
            return Answer::say("공간 보고서가 아직 없습니다. 하루 한 번, 그날 처음 도는 백업 회차 끝에 만듭니다.");
        };
        // 가리는 낱말이 든 자리는 빼고, 뺀 수는 알리지 않는다. 후보의 번호(`n`)는 빠진 자리로 뺀 수가 드러나므로 AI 도구에는
        // 보이지 않는다. 1단계의 AI 도구는 후보를 고르지 않는다(고르는 요청 도구는 2단계에 번호를 서버 안에서 잇는다).
        for list in ["candidates", "grew"] {
            if let Some(items) = v[list].as_array_mut() {
                items.retain(|i| !masked(&c.masks, i["path"].as_str().unwrap_or("")) && !masked(&c.masks, i["name"].as_str().unwrap_or("")));
                for i in items.iter_mut() { if let Some(o) = i.as_object_mut() { o.remove("n"); } }
            }
        }
        let count = v["candidates"].as_array().map_or(0, Vec::len);
        Answer::value(v, count)
    }
    fn find(&self, args: &Value) -> Answer {
        let Some(query) = args["query"].as_str().filter(|q| args.as_object().is_some_and(|o| o.len() == 1) && !q.trim().is_empty() && q.chars().count() <= 100 && !q.chars().any(char::is_control)) else {
            return Answer::say("찾을 파일 이름의 일부(query, 1~100자)를 주세요.");
        };
        let c = consent(&self.root);
        if !c.tools.iter().any(|t| t == "find_restorable") { return Answer::say(NEED_CONSENT); }
        // 가리는 낱말이 든 낱말도 다른 낱말과 같은 확인과 횟수 셈을 거친다. 워커는 같은 판을 열되 그 낱말로 맞춰 보지 않으므로,
        // 답의 꼴과 걸리는 시간이 찾은 것이 없는 답과 같다(가렸다고 알리면 그 낱말을 알아낼 수 있다).
        if !runlog::live(&self.root).is_null() { return Answer::say(BUSY); }
        let conditions = power::read_in(&self.root);
        if conditions.metered == Some(true) || conditions.rest_network == Some(true) { return Answer::say(RESTING); }
        if !take_find(&self.root, epoch_ms()) { return Answer::say(TOO_MANY); }
        let started = Instant::now();
        let worker = match self.worker() { Ok(w) => w, Err(_) => return Answer::say("백업 엔진을 열지 못했습니다. 잠시 뒤에 다시 해 주세요.") };
        let left = FIND_LIMIT.saturating_sub(started.elapsed()).as_millis() as u64;
        let reply = self.ask(&worker, "findFiles", json!([{"query": query, "limit": 200, "masks": c.masks}]), left.max(1));
        let value = match reply {
            Ok(v) if v["ok"] == true => v["value"].clone(),
            Ok(v) if v["code"] == "NO_SNAPSHOT" => return Answer::say("아직 확인을 마친 백업이 없습니다."),
            Ok(_) => return Answer::say("백업 안을 찾지 못했습니다. 잠시 뒤에 다시 해 주세요."),
            Err(code) => {
                // 시간을 넘기거나 워커가 죽었으면 워커를 내린다(restic도 함께 끝난다). 다음 찾기가 새로 띄운다.
                self.drop_worker();
                return Answer::say(if code == "REQUEST_TIMEOUT" { TOO_LONG } else { "백업 안을 찾지 못했습니다. 잠시 뒤에 다시 해 주세요." });
            }
        };
        if value["configured"] == false { return Answer::say("이 PC에서 아직 클라우드 백업을 시작하지 않았습니다."); }
        // 워커가 가린 뒤의 결과와 수를 준다. 여기서 한 번 더 가리고, 더 가린 것이 있으면 「더 있음」을 알리지 않는다.
        let returned = value["results"].as_array().map_or(0, Vec::len);
        let mut results: Vec<Value> = value["results"].as_array().into_iter().flatten()
            .filter(|r| r["path"].as_str().is_some_and(|p| !masked(&c.masks, p)))
            .map(|r| json!({"path": r["path"], "size": r["size"], "modified": r["mtime"]})).collect();
        let more = results.len() > RESULTS || (results.len() == returned && value["total"].as_u64().unwrap_or(0) > returned as u64);
        results.truncate(RESULTS);
        let count = results.len();
        let mut out = json!({"snapshotAt": value["snapshotAt"], "results": results, "more": more});
        if value["cut"] == true { out["note"] = json!("너무 큰 폴더 일부는 찾지 못했습니다. 더 긴 낱말로 찾거나 엔진 창에서 찾아 주세요."); }
        Answer::value(out, count)
    }
    fn worker(&self) -> Result<Arc<Worker>, String> {
        let mut held = self.worker.lock().unwrap();
        if let Some(w) = held.as_ref() { return Ok(w.clone()); }
        let host: Arc<dyn Fn(&str, Value) -> Result<Value, String> + Send + Sync> = Arc::new(|method: &str, args: Value| {
            // 이 워커가 부를 수 있는 것은 저장소 암호 풀기 하나다.
            if method != "secret.decrypt" { return Err("HOST_METHOD".into()); }
            let text = args.as_array().and_then(|a| a.first()).and_then(Value::as_str).ok_or("HOST_REQUEST")?;
            let value = secret::decrypt(text)?;
            Ok(json!(value.as_str()))
        });
        let worker = Worker::start_mode(&self.resources, &self.root, None, self.test, Some("mcp"), host, Arc::new(|_| {}), Arc::new(|_| {}))?;
        self.runtime.block_on(worker.call("$boot", json!([]), 60_000))?;
        *held = Some(worker.clone());
        Ok(worker)
    }
    /// 워커에 묻는 단 하나의 자리: 짧은 허용 목록(`WORKER_METHODS`) 밖의 메서드는 보내지 않는다.
    fn ask(&self, worker: &Worker, method: &str, args: Value, timeout_ms: u64) -> Result<Value, String> {
        if !allowed(method) { return Err("MCP_METHOD".into()); }
        self.runtime.block_on(worker.call(method, args, timeout_ms))
    }
    fn drop_worker(&self) { if let Some(w) = self.worker.lock().unwrap().take() { w.terminate(); } }
    /// 5분 동안 요청이 없으면 워커만 내린다.
    pub fn idle_check(&self) { if self.last.lock().unwrap().elapsed() >= IDLE { self.drop_worker(); } }
}

/// `WorkBackupRun.exe --mcp`: 표준 입력이 닫힐 때까지 한 줄씩 답한다. 끝 부호 0(닫힘 · 설치 표식), 70(상태 폴더 없음).
pub fn serve(test: bool, resources: PathBuf) -> i32 {
    let Some(exe_dir) = std::env::current_exe().ok().and_then(|e| e.parent().map(Path::to_path_buf)) else { return 70 };
    if platform::installing(&exe_dir) { return 0; }
    let Ok(root) = platform::state_dir(test) else { return 70 };
    let Ok(server) = Server::new(root, resources, exe_dir.clone(), test) else { return 70 };
    let server = Arc::new(server);
    let watch = server.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(60));
        if platform::installing(&watch.exe_dir) { std::process::exit(0); }
        watch.idle_check();
    });
    let stdin = std::io::stdin();
    let mut reader = BufReader::new(stdin.lock());
    let mut out = std::io::stdout();
    loop {
        match protocol::read_frame(&mut reader, LINE_MAX) {
            Ok(Some(bytes)) => {
                let bytes = bytes.strip_suffix(b"\r").unwrap_or(&bytes).to_vec();
                if bytes.iter().all(u8::is_ascii_whitespace) { continue; }
                if let Some(reply) = server.handle(&bytes) {
                    let mut line = serde_json::to_vec(&reply).unwrap_or_default(); line.push(b'\n');
                    if out.write_all(&line).and_then(|_| out.flush()).is_err() { break; }
                }
            }
            // 닫힘, 또는 1MB를 넘는 줄(그 뒤는 믿을 수 없다): 끝낸다.
            _ => break,
        }
    }
    server.drop_worker();
    0
}

#[cfg(test)] mod tests {
    use super::*;
    fn dir(name: &str) -> PathBuf { let d = std::env::temp_dir().join(format!("swb-mcp-{name}-{}", std::process::id())); let _ = fs::remove_dir_all(&d); fs::create_dir_all(&d).unwrap(); d }
    fn server(root: &Path) -> Server { Server::new(root.to_path_buf(), root.join("no-resources"), root.join("no-install"), true).unwrap() }
    fn ask(s: &Server, method: &str, params: Value) -> Value { s.handle(json!({"jsonrpc": "2.0", "id": 7, "method": method, "params": params}).to_string().as_bytes()).unwrap() }
    fn call(s: &Server, name: &str, args: Value) -> Value { ask(s, "tools/call", json!({"name": name, "arguments": args}))["result"].clone() }
    #[test] fn speaks_json_rpc_and_lists_three_read_only_tools() {
        let root = dir("rpc"); let s = server(&root);
        let init = ask(&s, "initialize", json!({"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "Claude Code", "version": "2"}}));
        assert_eq!(init["result"]["protocolVersion"], "2025-06-18");
        assert_eq!(init["result"]["capabilities"], json!({"tools": {"listChanged": false}}));
        assert_eq!(ask(&s, "initialize", json!({"protocolVersion": "1999-01-01"}))["result"]["protocolVersion"], PROTOCOLS[0], "an unknown version gets ours");
        assert!(s.handle(br#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#).is_none(), "notifications get no answer");
        assert_eq!(s.handle(b"{not json").unwrap()["error"]["code"], -32700);
        assert_eq!(s.handle(br#"[{"jsonrpc":"2.0","id":1,"method":"ping"}]"#).unwrap()["error"]["code"], -32600, "no batches");
        assert_eq!(ask(&s, "resources/list", json!({}))["error"]["code"], -32601);
        assert_eq!(ask(&s, "ping", json!({}))["result"], json!({}));
        let list = ask(&s, "tools/list", json!({}))["result"]["tools"].clone();
        let names: Vec<&str> = list.as_array().unwrap().iter().map(|t| t["name"].as_str().unwrap()).collect();
        assert_eq!(names, TOOLS);
        assert!(list.as_array().unwrap().iter().all(|t| t["annotations"]["readOnlyHint"] == true && t["annotations"]["destructiveHint"] == false));
        assert_eq!(ask(&s, "tools/call", json!({"name": "delete_everything", "arguments": {}}))["error"]["code"], -32602);
        let _ = fs::remove_dir_all(&root);
    }
    #[test] fn consent_masks_and_logs() {
        let root = dir("consent"); let s = server(&root);
        // Status: no names, so it answers before any consent.
        assert_eq!(call(&s, "protection_status", json!({}))["isError"], true, "nothing written yet");
        fs::create_dir_all(root.join("solio")).unwrap();
        fs::write(root.join("solio").join("status.json"), r#"{"v":1,"state":"safe","attention":[]}"#).unwrap();
        assert_eq!(call(&s, "protection_status", json!({}))["structuredContent"]["state"], "safe");
        // The report and the search need the drawer's consent; without it, no path leaves.
        fs::write(root.join("solio").join("space.json"), r#"{"v":1,"report":"space-1-ab","candidates":[{"n":1,"path":"C:\\Users\\a\\건강검진\\x","name":"x"},{"n":2,"path":"C:\\b\\node_modules","name":"Node 패키지 폴더 · b"}],"grew":[]}"#).unwrap();
        let refused = call(&s, "space_report", json!({}));
        assert_eq!(refused["isError"], true);
        assert!(refused["content"][0]["text"].as_str().unwrap().contains("AI 도구") && !refused.to_string().contains("node_modules"));
        assert_eq!(call(&s, "find_restorable", json!({"query": "보고서"}))["content"][0]["text"], NEED_CONSENT);
        fs::create_dir_all(root.join("mcp")).unwrap();
        fs::write(root.join("mcp").join("consent.json"), r#"{"v":1,"tools":{"space_report":true,"find_restorable":true},"masks":["건강"]}"#).unwrap();
        let report = call(&s, "space_report", json!({}));
        let shown = report["structuredContent"]["candidates"].as_array().unwrap();
        assert_eq!(shown.len(), 1, "the masked path is left out");
        assert!(shown[0].get("n").is_none(), "no number: a gap would tell how many were left out");
        assert!(!report.to_string().contains("건강"), "and nothing tells how many were left out");
        // A query with a masked word goes the same way as any other (here no engine can start, so both are told the same).
        let masked_answer = call(&s, "find_restorable", json!({"query": "내 건강 기록"}));
        let plain_answer = call(&s, "find_restorable", json!({"query": "다른 기록"}));
        assert_eq!(masked_answer, plain_answer);
        assert_eq!(call(&s, "find_restorable", json!({"query": ""}))["isError"], true);
        assert_eq!(call(&s, "find_restorable", json!({"query": "a", "path": "C:\\"}))["isError"], true, "no other inputs");
        assert_eq!(call(&s, "space_report", json!({"x": 1}))["isError"], true);
        // The log has the tool, the count and the time only.
        let log = fs::read_to_string(root.join("mcp.jsonl")).unwrap();
        assert!(!log.contains("건강") && !log.contains("보고서") && !log.contains("node_modules"), "{log}");
        for line in log.lines() {
            let v: Value = serde_json::from_str(line).unwrap();
            let mut keys: Vec<&str> = v.as_object().unwrap().keys().map(String::as_str).collect(); keys.sort();
            assert_eq!(keys, ["at", "count", "ms", "tool", "v"]);
        }
        let _ = fs::remove_dir_all(&root);
    }
    #[test] fn only_the_short_list_reaches_the_worker_and_tools_say_who_called() {
        for m in ["getState", "findFiles"] { assert!(allowed(m)); }
        for m in ["restoreLatest", "restoreSelected", "openFileCatalog", "setAutomatic", "removeSource", "$boot", "$run", "getstate", ""] { assert!(!allowed(m), "{m}"); }
        let root = dir("clients");
        remember_client(&root, &json!({"name": "Claude Code\u{7}", "version": "2.1"}), 5);
        remember_client(&root, &json!({"name": "Claude Code\u{7}", "version": "2.2"}), 9);
        remember_client(&root, &json!({"name": ""}), 9);
        let v: Value = serde_json::from_slice(&fs::read(root.join("mcp").join("clients.json")).unwrap()).unwrap();
        let list = v["clients"].as_array().unwrap();
        assert_eq!(list.len(), 1, "one tool, seen twice; a nameless one is not kept");
        assert_eq!((list[0]["name"].as_str(), list[0]["version"].as_str(), list[0]["firstSeen"].as_u64(), list[0]["lastSeen"].as_u64()), (Some("Claude Code"), Some("2.2"), Some(5), Some(9)));
        assert!(list[0]["exe"].as_str().is_some_and(|e| e.to_lowercase().ends_with(".exe")), "the program that started this one");
        let _ = fs::remove_dir_all(&root);
    }
    #[test] fn finds_are_counted_and_an_engine_that_cannot_start_is_told() {
        let root = dir("busy"); let s = server(&root);
        fs::create_dir_all(root.join("mcp")).unwrap();
        fs::write(root.join("mcp").join("consent.json"), r#"{"v":1,"tools":{"find_restorable":true},"masks":[]}"#).unwrap();
        // Ten an hour, across processes (the file is shared and locked).
        let now = 10 * 3_600_000;
        for i in 0..FINDS_PER_HOUR { assert!(take_find(&root, now + i as u64), "{i}"); }
        assert!(!take_find(&root, now + 100));
        assert!(take_find(&root, now + 3_600_001), "an hour later the first slot is free again");
        // No worker could start here (no resources): the answer says so instead of hanging.
        let started = Instant::now();
        let r = call(&s, "find_restorable", json!({"query": "보고서"}));
        assert_eq!(r["isError"], true);
        assert!(started.elapsed() < Duration::from_secs(30));
        let _ = fs::remove_dir_all(&root);
    }
    #[test] fn consent_file_is_read_strictly() {
        let root = dir("strict");
        assert_eq!(consent(&root), Consent::default());
        fs::create_dir_all(root.join("mcp")).unwrap();
        fs::write(root.join("mcp").join("consent.json"), r#"{"v":2,"tools":{"space_report":true}}"#).unwrap();
        assert!(consent(&root).tools.is_empty(), "another version: all off");
        fs::write(root.join("mcp").join("consent.json"), r#"{"v":1,"tools":{"space_report":"yes","find_restorable":true,"delete":true},"masks":[" 계약 ","", 3]}"#).unwrap();
        assert_eq!(consent(&root), Consent { tools: vec!["find_restorable".into()], masks: vec!["계약".into()] });
        let _ = fs::remove_dir_all(&root);
    }
}
