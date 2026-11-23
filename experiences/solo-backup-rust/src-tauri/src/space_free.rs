//! 공간 비우기 2판 — 원클릭 누름의 「비우기」와 미리 보기 (SPACE_DESIGN.md 12장).
//!
//! 엔진 잠금을 쥔 요청 회차에서 워커가 `space.free`로 부른다. 보고서(`solio/space.json`)는 후보의 경로만 주고, 종류와 등급은
//! 디스크에서 다시 센다(12.2). 비우는 것은 셋뿐이다: Windows 임시 맨 위 항목, 브라우저 자동화 임시 프로필, 빌드 산출물
//! (node_modules · target · .venv · __pycache__). 백업 폴더와 겹치는 자리, git 작업 사본 안, 연결점 너머는 건드리지 않는다.
//! 후보 하나씩 적기 → 떼어 내기(이름 바꾸기) → 다시 보기 → 지우기 → 적기를 끝까지 하고 다음으로 간다(12.3). 미리 보기는 같은
//! 확인을 하되 이름을 바꾸지 않는다. 경로는 장부(`space/freed.jsonl`)와 그 목록 파일에만 있다. 워커가 넘긴 백업 폴더 목록은
//! 확인에만 쓰고 어디에도 적지 않는다.
use crate::space::{self, Places, DAY_MS, REPARSE};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::os::windows::fs::MetadataExt;
use std::path::{Component, Path, PathBuf};
use std::time::{Duration, Instant, UNIX_EPOCH};

/// 시험 표식(12.1): 이 파일이 있는 PC에서만 2판을 연다.
pub const GATE: &str = "2판-시험";
const LEDGER: &str = "freed.jsonl";
const LISTS: &str = "freed";
/// 누름 하나의 비우기 상한과, 시작한 지우기가 넘어설 수 있는 몫(12.3-3 · 4).
const PRESS: Duration = Duration::from_secs(150);
const OVERRUN: Duration = Duration::from_secs(60);
/// 후보 하나의 확인(걷기 빼고)과 git 최상위 폴더 하나의 걷기(12.2).
const CHECK: Duration = Duration::from_secs(15);
const WALK: Duration = Duration::from_secs(30);
/// 지우는 속도의 어림(파일/초). 낮게 잡아 상한 안에 끝나지 않을 후보를 미룬다.
const DELETE_RATE: u64 = 1000;
const TEMP_AGE: u64 = 2 * DAY_MS;
const PROFILE_AGE: u64 = 3 * 3_600_000;
const IDLE: u64 = 14 * DAY_MS;
const BIG_FILE: u64 = 1 << 30;
const GB: u64 = 1 << 30;
const PROFILE_PREFIX: &str = "playwright_chromiumdev_profile-";
const BUILD_NAMES: [&str; 5] = ["node_modules", "target", ".venv", "venv", "__pycache__"];
const MARK: &str = ".swb-free-";
/// 작업 폴더를 읽지 못했을 때 그 누름의 빌드 산출물을 쉬게 하는 실행기 · 셸 · 빌드 도구(12.2 프로세스 줄, 다시 확인 N3).
const RUNNERS: [&str; 26] = ["node.exe", "python.exe", "pythonw.exe", "py.exe", "pyw.exe", "cargo.exe", "rustc.exe", "cmd.exe", "powershell.exe", "pwsh.exe",
    "wsl.exe", "wslhost.exe", "bash.exe", "sh.exe", "zsh.exe", "mintty.exe", "windowsterminal.exe", "openconsole.exe", "java.exe", "javaw.exe", "dotnet.exe",
    "deno.exe", "bun.exe", "uv.exe", "git.exe", "npm.exe"];

/// 워커가 넘기는 것: 보고서 번호, 후보 번호, 엔진의 백업 폴더, 미리 보기인지.
#[derive(Debug, Clone)]
pub struct Ask { pub report: String, pub items: Vec<u32>, pub folders: Vec<String>, pub preview: bool }

#[derive(Debug, Default, Clone, PartialEq)]
pub struct Tally { pub freed: u64, pub items: u32, pub kept: u32, pub busy: u32 }
impl Tally { fn value(&self, preview: bool) -> Value { json!({"preview": preview, "freed": self.freed, "items": self.items, "kept": self.kept, "busy": self.busy}) } }

/// 시험 표식이 이 상태 폴더에 있는지(보통 파일, 연결점 아님).
pub fn gate_open(root: &Path) -> bool {
    fs::symlink_metadata(root.join(space::DIR).join(GATE)).is_ok_and(|m| m.is_file() && m.file_attributes() & REPARSE == 0)
}

/// `space.free`. 답은 `{preview, freed, items, kept, busy}` — 수만 있다.
pub fn free(root: &Path, places: &Places, ask: &Ask) -> Result<Value, String> {
    free_with(root, places, ask, &System)
}

/// 확인에 쓰는 바깥 세계(프로세스 · 경로를 부르는 곳). 시험은 따로 준다.
pub trait World {
    fn processes(&self) -> Result<Procs, String>;
    fn references(&self, places: &Places) -> Result<Refs, String>;
}
pub struct System;
impl World for System {
    fn processes(&self) -> Result<Procs, String> { procs::snapshot() }
    fn references(&self, places: &Places) -> Result<Refs, String> { refs::collect(places) }
}

pub fn free_with(root: &Path, places: &Places, ask: &Ask, world: &dyn World) -> Result<Value, String> {
    let started = Instant::now();
    if !gate_open(root) { return Err("SPACE_FREE_OFF".into()); }
    let dir = root.join(space::DIR);
    space::own_dir(&dir)?;
    space::own_dir(&dir.join(LISTS))?;
    let report: Value = space::read_json(&root.join("solio").join("space.json"), space::REPORT_MAX as u64).ok_or("SPACE_FREE_REPORT")?;
    if report["report"].as_str() != Some(ask.report.as_str()) { return Err("SPACE_FREE_REPORT".into()); }
    let mut ledger = Ledger::open(&dir)?;
    let at = space::epoch_ms();
    let wanted: HashSet<u32> = ask.items.iter().copied().collect();
    let mut picks: Vec<(u32, String)> = report["candidates"].as_array().into_iter().flatten()
        .filter_map(|c| Some((c["n"].as_u64()? as u32, c["path"].as_str()?.to_string()))).filter(|(n, _)| wanted.contains(n)).collect();
    // 시간 초과로 남긴 적이 있는 후보는 뒤로(12.2 시간).
    let slow = ledger.slow();
    picks.sort_by_key(|(_, p)| slow.contains(&space::key(Path::new(p))));
    let mut run = Press { root, places, ask, world, at, started, ledger: &mut ledger, tally: Tally::default(), procs: None, refs: None, idle: HashMap::new(), why: HashMap::new(), temp_list: Vec::new(),
        seen: HashSet::new(), drives: HashMap::new() };
    let procs = match world.processes() {
        Ok(p) => p,
        Err(_) => {
            // 프로세스 목록을 얻지 못하면 그 누름에서는 아무것도 비우지 않는다(12.2).
            run.tally.kept = picks.len() as u32;
            run.ledger.line(json!({"at": space::iso(at), "report": ask.report, "preview": ask.preview, "stage": "rested", "why": "processes", "n": picks.len()}));
            return Ok(run.tally.value(ask.preview));
        }
    };
    run.procs = Some(procs);
    for (n, path) in picks {
        run.one(n, Path::new(&path));
    }
    run.finish_temp();
    if !run.why.is_empty() {
        let why = std::mem::take(&mut run.why);
        run.ledger.line(json!({"at": space::iso(at), "report": ask.report, "preview": ask.preview, "stage": "kept", "why": why}));
    }
    Ok(run.tally.value(ask.preview))
}

struct Press<'a> {
    root: &'a Path, places: &'a Places, ask: &'a Ask, world: &'a dyn World, at: u64, started: Instant, ledger: &'a mut Ledger, tally: Tally,
    procs: Option<Procs>, refs: Option<Result<Refs, String>>, idle: HashMap<String, Idle>, why: HashMap<&'static str, u32>, temp_list: Vec<(String, u64)>,
    /// 이 누름에서 이미 다룬 임시 항목. %TEMP% 후보와 자동화 프로필 후보가 같은 항목을 두 번 세지 않게 한다(카본 끝판 B2).
    seen: HashSet<String>,
    /// 드라이브마다 (누름에서 처음 볼 때 시작선 아래였는지, 목표선, 미리 보기에서 셈한 크기)(카본 끝판 B1).
    drives: HashMap<String, (bool, u64, u64)>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum Idle { Yes, Recent, Slow, Unreadable }

enum Kind { Temp, Profile, Build(&'static str) }

impl Press<'_> {
    fn keep(&mut self, why: &'static str) {
        self.tally.kept += 1; *self.why.entry(why).or_default() += 1;
        // 프로세스가 쓰고 있어 남긴 것도 「쓰는 중이라 남긴 수」로 센다(12.4 busy, 카본 끝판 B7). 이름 바꾸기 거절은 take_and_delete의 Busy가 센다.
        if why == "running" { self.tally.busy += 1; }
    }
    fn over(&self) -> bool { self.started.elapsed() >= PRESS }

    fn one(&mut self, n: u32, path: &Path) {
        // %TEMP%를 훑다가 이미 다룬 자동화 프로필은 다시 세지 않는다(카본 끝판 B2).
        if self.seen.contains(&space::key(path)) { return; }
        if self.over() { return self.keep("later"); }
        let Some(kind) = self.kind_of(path) else { return self.keep("kind") };
        if let Some(why) = self.common(path) { return self.keep(why); }
        match kind {
            Kind::Temp => self.temp_sweep(path),
            Kind::Profile => { if let (_, Some("recent")) = self.temp_item(path, PROFILE_AGE) { self.keep("recent"); } }
            Kind::Build(k) => self.build(n, path, k),
        }
    }

    /// 종류를 디스크에서 다시 센다(12.2 머리, 설계 검토 D7). 보고서의 종류는 믿지 않는다.
    fn kind_of(&self, path: &Path) -> Option<Kind> {
        let temp = self.places.temp.as_ref().map(|t| space::key(t));
        let k = space::key(path);
        if temp.as_deref() == Some(k.as_str()) { return Some(Kind::Temp); }
        let name = path.file_name()?.to_string_lossy().to_lowercase();
        let parent = path.parent()?;
        if temp.as_deref() == Some(space::key(parent).as_str()) && name.starts_with(PROFILE_PREFIX) { return Some(Kind::Profile); }
        if !BUILD_NAMES.contains(&name.as_str()) { return None; }
        let siblings: HashSet<String> = fs::read_dir(parent).ok()?.filter_map(|e| e.ok()).map(|e| e.file_name().to_string_lossy().to_lowercase()).collect();
        match space::artifact(&name, &siblings) { Some((k, true)) => Some(Kind::Build(k)), _ => None }
    }

    /// 모두에 거는 확인(12.2 「모두」): 고정 드라이브, 뿌리부터 연결점 없는 보통 폴더, 후보 자체도 연결점 아님, 백업 폴더와 겹치지 않음.
    fn common(&self, path: &Path) -> Option<&'static str> {
        if !path.is_absolute() || !space::plain_below_root(&self.places.roots, path) { return Some("place"); }
        let k = space::key(path);
        let overlaps = |f: &String| { let f = space::key(Path::new(f)); !f.is_empty() && (f == k || inside(&k, &f) || inside(&f, &k)) };
        if self.ask.folders.iter().any(overlaps) { return Some("backup"); }
        None
    }

    // ── Windows 임시 ────────────────────────────────────────────

    fn temp_sweep(&mut self, temp: &Path) {
        let Ok(list) = fs::read_dir(temp) else { return self.keep("unreadable") };
        let mut items: Vec<PathBuf> = list.filter_map(|e| e.ok()).map(|e| e.path()).collect();
        items.sort();
        let mut any = false;
        for item in items {
            if self.over() { self.keep("later"); break; }
            let name = item.file_name().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
            if name.contains(MARK) { continue; } // 다른 누름이 떼어 낸 것 — 이어 지우기(resume)의 몫
            let age = if name.starts_with(PROFILE_PREFIX) { PROFILE_AGE } else { TEMP_AGE };
            let (freed, _) = self.temp_item(&item, age);
            any |= freed;
        }
        let _ = any;
    }

    /// %TEMP% 맨 위 항목 하나. (비웠거나 비울 것인지, 남긴 까닭)
    fn temp_item(&mut self, item: &Path, age: u64) -> (bool, Option<&'static str>) {
        if !self.seen.insert(space::key(item)) { return (false, None); }
        let why = self.temp_check(item, age);
        if let Some(w) = why { if w != "recent" { self.keep(w); } return (false, Some(w)); }
        let name = item.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        let path_text = item.to_string_lossy().into_owned();
        let (bytes, files) = match count(item, (Instant::now() + WALK).min(self.started + PRESS)) { Some(c) => c, None => { self.keep("slow"); return (false, Some("slow")); } };
        // 빌드 산출물과 같이 지우는 시간을 어림한다(12.3-4, 카본 끝판 B9).
        let estimate = Duration::from_secs(files / DELETE_RATE + 1);
        if estimate > PRESS { self.keep("too-big"); return (false, Some("too-big")); }
        if self.started.elapsed() + estimate > PRESS { self.keep("later"); return (false, Some("later")); }
        if self.ask.preview {
            self.tally.items += 1; self.tally.freed += bytes; self.temp_list.push((path_text, bytes));
            return (true, None);
        }
        match self.take_and_delete(item, &name, "temp", bytes, files, item) {
            Taken::Freed(b) => { self.tally.items += 1; self.tally.freed += b; self.temp_list.push((path_text, b)); (true, None) }
            Taken::Busy => { self.tally.busy += 1; self.keep("busy"); (false, Some("busy")) }
            Taken::Stopped => { self.keep("stopped"); (false, Some("stopped")) }
            Taken::NoLedger => { self.keep("ledger"); (false, Some("ledger")) }
        }
    }

    fn temp_check(&self, item: &Path, age: u64) -> Option<&'static str> {
        let Ok(meta) = fs::symlink_metadata(item) else { return Some("unreadable") };
        if meta.file_attributes() & REPARSE != 0 { return Some("link"); }
        let name = item.file_name().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
        if self.procs.as_ref().is_some_and(|p| p.mentions(&name)) { return Some("running"); }
        // 안쪽 모든 항목의 고친 시각 · 만든 시각과 항목 자체의 시각 가운데 가장 늦은 것(지킴이 tree_age, 설계 검토 D2).
        let deadline = Instant::now() + CHECK;
        let mut newest = times(&meta);
        if meta.is_dir() {
            let mut stack = vec![item.to_path_buf()];
            while let Some(d) = stack.pop() {
                if Instant::now() >= deadline { return Some("slow"); }
                let Ok(list) = fs::read_dir(&d) else { return Some("unreadable") };
                for e in list {
                    let Ok(e) = e else { return Some("unreadable") };
                    let Ok(m) = e.metadata() else { return Some("unreadable") };
                    let n = e.file_name().to_string_lossy().to_lowercase();
                    if n == ".git" { return Some("git"); }
                    newest = newest.max(times(&m));
                    if m.file_attributes() & REPARSE != 0 { continue; }
                    if m.is_dir() { stack.push(e.path()); } else if m.len() >= BIG_FILE { return Some("big"); }
                }
            }
        } else if meta.len() >= BIG_FILE { return Some("big"); }
        if self.at.saturating_sub(newest) <= age { return Some("recent"); }
        None
    }

    fn finish_temp(&mut self) {
        if self.temp_list.is_empty() { return; }
        let list = std::mem::take(&mut self.temp_list);
        let name = format!("{}-temp{}.txt", self.at, if self.ask.preview { "-preview" } else { "" });
        let text: String = list.iter().map(|(p, b)| format!("{b}\t{p}\n")).collect();
        let _ = fs::write(self.root.join(space::DIR).join(LISTS).join(&name), text);
        self.ledger.line(json!({"at": space::iso(self.at), "report": self.ask.report, "preview": self.ask.preview, "kind": "temp",
            "stage": if self.ask.preview { "would" } else { "freed" }, "n": list.len(), "bytes": list.iter().map(|(_, b)| b).sum::<u64>(), "list": format!("{LISTS}/{name}"), "how": "저절로 다시 생김"}));
    }

    // ── 빌드 산출물 ─────────────────────────────────────────────

    fn build(&mut self, n: u32, path: &Path, kind: &'static str) {
        let check_by = Instant::now() + CHECK;
        if self.procs.as_ref().is_none_or(|p| p.blocked) { return self.keep("processes"); }
        let parent = path.parent().unwrap_or(path).to_path_buf();
        let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        // git 최상위 폴더(다시 확인 D3): 작업 사본(.git이 파일)이면 남긴다(D18).
        let Some(top) = git_top(&parent, check_by) else { return self.keep("not-in-git") };
        if !space::plain_below_root(&self.places.roots, &top) { return self.keep("place"); }
        match fs::symlink_metadata(top.join(".git")) { Ok(m) if m.is_dir() && m.file_attributes() & REPARSE == 0 => {}, Ok(_) => return self.keep("worktree"), Err(_) => return self.keep("not-in-git") }
        match space::git(&parent, &["check-ignore", "-q", &name], check_by) { Some((0, _)) => {}, Some((1, _)) => return self.keep("tracked"), _ => return self.keep("unchecked") }
        let rel = relative(path, &top).unwrap_or_default();
        if rel.is_empty() { return self.keep("place"); }
        match space::git(&top, &["ls-files", "-z", "--", &rel], check_by) { Some((0, out)) if out.is_empty() => {}, Some((0, _)) => return self.keep("tracked"), _ => return self.keep("unchecked") }
        let top_key = space::key(&top);
        if self.procs.as_ref().is_some_and(|p| p.touches(&top_key) == Touch::InUse) { return self.keep("running"); }
        if self.refs.is_none() { self.refs = Some(self.world.references(self.places)); }
        match self.refs.as_ref() { Some(Ok(r)) => if r.mentions(&top_key, self.places) { return self.keep("referenced") }, _ => return self.keep("refs") }
        let idle = match self.idle.get(&top_key) { Some(i) => *i, None => { let i = idle_walk(&top, self.at); self.idle.insert(top_key.clone(), i); i } };
        match idle { Idle::Yes => {}, Idle::Recent => return self.keep("recent"), Idle::Slow => { self.slow_line(path); return self.keep("slow") }, Idle::Unreadable => return self.keep("unreadable") }
        if Instant::now() >= check_by { self.slow_line(path); return self.keep("slow"); }
        // 모자란 드라이브에서, 목표선까지만(원칙 3 · 6장).
        let Some(drive) = drive_root(path) else { return self.keep("place") };
        let Some((size, free)) = space::drive_space(&drive) else { return self.keep("place") };
        let letter = drive.to_string_lossy().chars().next().map(|c| c.to_ascii_uppercase().to_string()).unwrap_or_default();
        // 시작선 아래인지는 그 누름에서 그 드라이브를 처음 볼 때 한 번 정한다. 비우는 동안 시작선을 넘어도 목표선까지 간다(6장, 카본 끝판 B1).
        let root = self.root;
        let &mut (below, target, would) = self.drives.entry(letter.clone()).or_insert_with(|| {
            let start = space::start_lines(root).get(&letter).copied().unwrap_or_else(|| space::default_start_line(size)).saturating_mul(GB);
            (free < start, start.saturating_add((size / 10).min(100 * GB)), 0)
        });
        // 미리 보기는 지우지 않으므로 남은 공간에 이 드라이브에서 셈한 크기를 더해 목표선과 견준다.
        let counted = if self.ask.preview { free.saturating_add(would) } else { free };
        if !below || counted >= target { return self.keep("space-ok"); }
        let Some((bytes, files)) = count(path, Instant::now() + WALK) else { self.slow_line(path); return self.keep("slow") };
        let estimate = Duration::from_secs(files / DELETE_RATE + 1);
        if estimate > PRESS { return self.keep("too-big"); }
        if self.started.elapsed() + estimate > PRESS { return self.keep("later"); }
        let how = match kind { "node_modules" => "npm ci (또는 잠금 파일에 맞는 pnpm · yarn 설치)", "target" => "cargo build", "venv" => "uv sync 또는 pip install -r", _ => "저절로 다시 생김" };
        if self.ask.preview {
            self.tally.items += 1; self.tally.freed += bytes;
            if let Some(d) = self.drives.get_mut(&letter) { d.2 = d.2.saturating_add(bytes); }
            self.ledger.line(json!({"at": space::iso(self.at), "report": self.ask.report, "n": n, "preview": true, "kind": kind, "stage": "would", "path": path.to_string_lossy(), "bytes": bytes, "files": files, "how": how}));
            return;
        }
        let top_for_check = top.clone();
        match self.take_and_delete(path, &name, kind, bytes, files, &top_for_check) {
            Taken::Freed(b) => { self.tally.items += 1; self.tally.freed += b; }
            Taken::Busy => { self.tally.busy += 1; self.keep("busy"); }
            Taken::Stopped => self.keep("stopped"),
            Taken::NoLedger => self.keep("ledger"),
        }
    }

    fn slow_line(&mut self, path: &Path) {
        self.ledger.line(json!({"at": space::iso(self.at), "report": self.ask.report, "preview": self.ask.preview, "stage": "slow", "path": path.to_string_lossy()}));
    }

    // ── 떼어 내기와 지우기 ──────────────────────────────────────

    /// 적기 → 떼어 내기 → 다시 보기 → 지우기 → 적기(12.3). `watch`는 다시 볼 때 프로세스가 쓰면 안 되는 자리(빌드 산출물은 git 최상위 폴더).
    fn take_and_delete(&mut self, path: &Path, name: &str, kind: &str, bytes: u64, files: u64, watch: &Path) -> Taken {
        let Some(id) = file_id(path) else { return Taken::Busy };
        let taken = path.with_file_name(format!("{name}{MARK}{:08x}", space::random32()));
        let drive = drive_root(path);
        let before = drive.as_deref().and_then(space::drive_space).map(|(_, f)| f);
        // 장부에 「떼어 낼 것」을 먼저 적지 못하면 떼어 내지 않는다. 끊겼을 때 이을 길이 없어진다(12.3-1, 카본 끝판 B8).
        if !self.ledger.line(json!({"at": space::iso(self.at), "report": self.ask.report, "preview": false, "kind": kind, "stage": "staged", "path": path.to_string_lossy(), "as": taken.to_string_lossy(), "id": id, "bytes": bytes, "files": files})) {
            return Taken::NoLedger;
        }
        if !move_plain(path, &taken) {
            self.ledger.line(json!({"at": space::iso(self.at), "stage": "closed", "path": path.to_string_lossy(), "as": taken.to_string_lossy(), "why": "busy"}));
            return Taken::Busy;
        }
        // 떼어 낸 뒤 그 자리를 쓰는 프로세스가 생겼으면 되돌린다.
        let watch_key = space::key(watch);
        let taken_key = space::key(&taken);
        let again = self.world.processes();
        let used = match &again { Ok(p) => p.touches(&watch_key) == Touch::InUse || p.touches(&taken_key) == Touch::InUse, Err(_) => true };
        if used {
            let back = move_plain(&taken, path);
            self.ledger.line(json!({"at": space::iso(self.at), "stage": if back { "returned" } else { "stuck" }, "path": path.to_string_lossy(), "as": taken.to_string_lossy()}));
            return Taken::Busy;
        }
        let (gone, deleted, done) = delete_tree(&taken, self.started + PRESS + OVERRUN);
        let after = drive.as_deref().and_then(space::drive_space).map(|(_, f)| f);
        self.ledger.line(json!({"at": space::iso(self.at), "kind": kind, "stage": if done { "freed" } else { "stopped" }, "path": path.to_string_lossy(), "as": taken.to_string_lossy(),
            "bytes": gone, "files": deleted, "freeBefore": before, "freeAfter": after, "how": how_of(kind)}));
        if done { Taken::Freed(gone) } else { Taken::Stopped }
    }
}

enum Taken { Freed(u64), Busy, Stopped, NoLedger }

fn how_of(kind: &str) -> &'static str {
    match kind { "node_modules" => "npm ci (또는 잠금 파일에 맞는 pnpm · yarn 설치)", "target" => "cargo build", "venv" => "uv sync 또는 pip install -r", _ => "저절로 다시 생김" }
}

/// 회차가 끊겨 장부에 「떼어 냄」만 남은 것을 잇는다(12.3-6). 장부를 믿지 않고 디스크에서 다시 본다.
pub fn resume(root: &Path, places: &Places, folders: &[String]) -> Result<Value, String> {
    if !gate_open(root) { return Ok(json!({"freed": 0, "items": 0})); }
    let dir = root.join(space::DIR);
    space::own_dir(&dir)?;
    let mut ledger = Ledger::open(&dir)?;
    let open = ledger.open_staged();
    let deadline = Instant::now() + PRESS;
    let (mut freed, mut items, mut odd) = (0u64, 0u32, 0u32);
    for s in open {
        if Instant::now() >= deadline { break; }
        let (path, taken) = (PathBuf::from(&s.path), PathBuf::from(&s.taken));
        // 떼어 내기 전에 끊겼으면 원래 이름 그대로다: 그 줄을 닫는다.
        if !taken.exists() {
            ledger.line(json!({"at": space::iso(space::epoch_ms()), "stage": "closed", "path": s.path, "as": s.taken, "why": "not-taken"}));
            continue;
        }
        // 쓰는 프로세스가 생겨 못 되돌린 것은 지우지 않는다. 원래 자리가 비어 있으면 되돌린다.
        if s.stuck {
            let back = !path.exists() && taken_shape(&s, &path, &taken, places) && move_plain(&taken, &path);
            if back || !s.checked { ledger.line(json!({"at": space::iso(space::epoch_ms()), "stage": if back { "returned" } else { "check" }, "path": s.path, "as": s.taken, "resumed": true})); }
            if !back { odd += 1; }
            continue;
        }
        let ok = resume_ok(&s, &path, &taken, places, folders);
        if !ok { odd += 1; if !s.checked { ledger.line(json!({"at": space::iso(space::epoch_ms()), "stage": "check", "path": s.path, "as": s.taken})); } continue; }
        let (gone, deleted, done) = delete_tree(&taken, deadline + OVERRUN);
        freed += gone; if done { items += 1; }
        ledger.line(json!({"at": space::iso(space::epoch_ms()), "kind": s.kind, "stage": if done { "freed" } else { "stopped" }, "path": s.path, "as": s.taken, "bytes": gone, "files": deleted, "resumed": true}));
    }
    Ok(json!({"freed": freed, "items": items, "check": odd}))
}

/// 떼어 낸 이름이 정해진 꼴이고, 부모 자리가 원래 경로와 같고, 뿌리부터 연결점이 없고, 파일 번호가 장부와 같다(12.3-6).
fn taken_shape(s: &Staged, path: &Path, taken: &Path, places: &Places) -> bool {
    let (Some(name), Some(taken_name)) = (path.file_name().map(|n| n.to_string_lossy().into_owned()), taken.file_name().map(|n| n.to_string_lossy().into_owned())) else { return false };
    let Some(tail) = taken_name.strip_prefix(&format!("{name}{MARK}")) else { return false };
    if tail.len() != 8 || !tail.bytes().all(|b| b.is_ascii_hexdigit()) || path.parent() != taken.parent() { return false; }
    space::plain_below_root(&places.roots, taken) && file_id(taken).as_deref() == Some(s.id.as_str())
}

fn resume_ok(s: &Staged, path: &Path, taken: &Path, places: &Places, folders: &[String]) -> bool {
    let Some(name) = path.file_name().map(|n| n.to_string_lossy().into_owned()) else { return false };
    if !taken_shape(s, path, taken, places) { return false; }
    let k = space::key(taken);
    let o = space::key(path);
    if folders.iter().any(|f| { let f = space::key(Path::new(f)); !f.is_empty() && (f == k || f == o || inside(&k, &f) || inside(&o, &f) || inside(&f, &k) || inside(&f, &o)) }) { return false; }
    let temp = places.temp.as_ref().map(|t| space::key(t));
    let parent = path.parent().map(space::key);
    if parent.is_some() && parent == temp { return true; }
    // 빌드 산출물: 이름과 잠금 파일을 디스크에서 다시 본다.
    let lower = name.to_lowercase();
    let siblings: HashSet<String> = path.parent().and_then(|p| fs::read_dir(p).ok()).into_iter().flatten().filter_map(|e| e.ok()).map(|e| e.file_name().to_string_lossy().to_lowercase()).collect();
    BUILD_NAMES.contains(&lower.as_str()) && matches!(space::artifact(&lower, &siblings), Some((_, true)))
}

// ── 장부 ─────────────────────────────────────────────────────

struct Ledger { file: PathBuf }
#[derive(Debug, Clone)]
/// `stuck`: 떼어 낸 뒤 그 자리를 쓰는 프로세스가 생겼는데 되돌리지 못했다. 잇기는 지우지 않고 되돌리기만 한다.
/// `checked`: 잇기가 디스크와 맞지 않아 「check」를 이미 적었다(회차마다 다시 적지 않는다).
struct Staged { path: String, taken: String, id: String, kind: String, stuck: bool, checked: bool }
impl Ledger {
    fn open(dir: &Path) -> Result<Self, String> {
        let file = dir.join(LEDGER);
        if let Ok(m) = fs::symlink_metadata(&file) { if m.file_attributes() & REPARSE != 0 || !m.is_file() { return Err("SPACE_FREE_LEDGER".into()); } }
        Ok(Ledger { file })
    }
    /// 한 줄 더한다. 쓰지 못해도 비우기를 멈추지 않는다(장부를 먼저 쓰는 「떼어 낼 것」 줄만은 take_and_delete가 확인한다).
    fn line(&mut self, value: Value) -> bool {
        let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&self.file) else { return false };
        let mut text = value.to_string(); text.push('\n');
        f.write_all(text.as_bytes()).is_ok()
    }
    fn rows(&self) -> Vec<Value> {
        // 시험 동안은 돌려 쓰지 않는다(12.3-7). 64MB를 넘으면 읽지 않고 빈 것으로 본다.
        let Ok(m) = fs::metadata(&self.file) else { return Vec::new() };
        if m.len() > 64 << 20 { return Vec::new(); }
        fs::read_to_string(&self.file).unwrap_or_default().lines().filter_map(|l| serde_json::from_str(l).ok()).collect()
    }
    fn slow(&self) -> HashSet<String> {
        self.rows().iter().filter(|r| r["stage"] == "slow").filter_map(|r| r["path"].as_str().map(|p| space::key(Path::new(p)))).collect()
    }
    /// 「떼어 낼 것」만 있고 닫히지 않은 줄.
    fn open_staged(&self) -> Vec<Staged> {
        let mut open: Vec<Staged> = Vec::new();
        for r in self.rows() {
            let (Some(path), Some(taken)) = (r["path"].as_str(), r["as"].as_str()) else { continue };
            match r["stage"].as_str() {
                Some("staged") => if let Some(id) = r["id"].as_str() { open.push(Staged { path: path.into(), taken: taken.into(), id: id.into(), kind: r["kind"].as_str().unwrap_or("").into(), stuck: false, checked: false }) },
                Some("stuck") => open.iter_mut().filter(|s| s.taken == taken).for_each(|s| s.stuck = true),
                Some("check") => open.iter_mut().filter(|s| s.taken == taken).for_each(|s| s.checked = true),
                Some("freed" | "closed" | "returned") => open.retain(|s| s.taken != taken),
                _ => {}
            }
        }
        open
    }
}

// ── 파일 · 폴더 ──────────────────────────────────────────────

fn inside(child: &str, parent: &str) -> bool { child.len() > parent.len() && child.starts_with(parent) && child.as_bytes()[parent.len()] == b'\\' }

fn ms(t: std::io::Result<std::time::SystemTime>) -> u64 { t.ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis() as u64).unwrap_or(0) }
/// 고친 시각과 만든 시각 가운데 늦은 것. 방금 푼 묶음은 파일 시각이 옛날이라 만든 시각을 함께 본다(설계 검토 D2).
fn times(m: &fs::Metadata) -> u64 { ms(m.modified()).max(ms(m.created())) }

fn drive_root(path: &Path) -> Option<PathBuf> {
    match path.components().next() { Some(Component::Prefix(p)) => Some(PathBuf::from(format!("{}\\", p.as_os_str().to_string_lossy()))), _ => None }
}

/// 후보 폴더의 크기와 파일 수(연결점은 세지도 따라가지도 않는다). 시간을 넘기거나 못 읽으면 None.
fn count(path: &Path, deadline: Instant) -> Option<(u64, u64)> {
    let meta = fs::symlink_metadata(path).ok()?;
    if meta.file_attributes() & REPARSE != 0 { return None; }
    if !meta.is_dir() { return Some((meta.len(), 1)); }
    let (mut bytes, mut files) = (0u64, 0u64);
    let mut stack = vec![path.to_path_buf()];
    while let Some(d) = stack.pop() {
        if Instant::now() >= deadline { return None; }
        for e in fs::read_dir(&d).ok()? {
            let e = e.ok()?;
            let m = e.metadata().ok()?;
            if m.file_attributes() & REPARSE != 0 { files += 1; continue; }
            if m.is_dir() { stack.push(e.path()); } else { bytes += m.len(); files += 1; }
        }
    }
    Some((bytes, files))
}

/// git 최상위 폴더 전체에서 14일 안에 고치거나 만든 것이 있는지(12.2). 빌드 산출물 폴더 안과 `.git`의 깊은 곳에는 들어가지 않는다.
fn idle_walk(top: &Path, now: u64) -> Idle {
    let deadline = Instant::now() + WALK;
    let recent = |m: &fs::Metadata| now.saturating_sub(times(m)) <= IDLE;
    let Ok(meta) = fs::symlink_metadata(top) else { return Idle::Unreadable };
    if recent(&meta) { return Idle::Recent; }
    let mut stack = vec![top.to_path_buf()];
    while let Some(d) = stack.pop() {
        if Instant::now() >= deadline { return Idle::Slow; }
        let Ok(list) = fs::read_dir(&d) else { return Idle::Unreadable };
        let names: HashSet<String> = fs::read_dir(&d).map(|l| l.filter_map(|e| e.ok()).map(|e| e.file_name().to_string_lossy().to_lowercase()).collect()).unwrap_or_default();
        for e in list {
            let Ok(e) = e else { return Idle::Unreadable };
            let Ok(m) = e.metadata() else { return Idle::Unreadable };
            if recent(&m) { return Idle::Recent; }
            if m.file_attributes() & REPARSE != 0 || !m.is_dir() { continue; }
            let n = e.file_name().to_string_lossy().to_lowercase();
            if n == ".git" {
                // `.git`은 맨 위 항목(HEAD · index · refs …)의 시각만 본다.
                if let Ok(top_items) = fs::read_dir(e.path()) { for t in top_items.filter_map(|t| t.ok()) { if t.metadata().is_ok_and(|m| recent(&m)) { return Idle::Recent; } } }
                continue;
            }
            if space::artifact(&n, &names).is_some() { continue; }
            stack.push(e.path());
        }
    }
    Idle::Yes
}

fn git_top(dir: &Path, deadline: Instant) -> Option<PathBuf> {
    let (code, out) = space::git(dir, &["rev-parse", "--show-toplevel"], deadline)?;
    let line = out.lines().next()?.trim();
    (code == 0 && !line.is_empty()).then(|| PathBuf::from(line.replace('/', "\\")))
}

/// `path`가 `top` 안이면 top 아래의 상대 경로(`/` 구분). 대소문자와 짧은 이름(8.3)이 달라도 같은 자리로 본다(카본 끝판 B11).
fn relative(path: &Path, top: &Path) -> Option<String> {
    let long = |p: &Path| fs::canonicalize(p).ok().map(|c| { let t = c.to_string_lossy().into_owned(); t.strip_prefix(r"\\?\").map(str::to_string).unwrap_or(t) });
    let (p, t) = (long(path).unwrap_or_else(|| path.to_string_lossy().into_owned()), long(top).unwrap_or_else(|| top.to_string_lossy().into_owned()));
    let t = t.trim_end_matches('\\');
    let head = p.get(..t.len())?;
    if !head.eq_ignore_ascii_case(t) && head.to_lowercase() != t.to_lowercase() { return None; }
    let rest = p.get(t.len()..)?.strip_prefix('\\')?;
    (!rest.is_empty()).then(|| rest.replace('\\', "/"))
}

fn verbatim(p: &Path) -> Vec<u16> {
    let text = p.to_string_lossy();
    let full = if text.starts_with(r"\\?\") { text.into_owned() } else { format!(r"\\?\{text}") };
    full.encode_utf16().chain([0]).collect()
}

/// 이름을 바꾼다. 이미 있는 이름은 덮지 않는다(MoveFileExW, 덮기 없음).
fn move_plain(from: &Path, to: &Path) -> bool {
    use windows_sys::Win32::Storage::FileSystem::MoveFileExW;
    let (a, b) = (verbatim(from), verbatim(to));
    unsafe { MoveFileExW(a.as_ptr(), b.as_ptr(), 0) != 0 }
}

/// 볼륨 일련번호와 파일 번호(이름을 바꿔도 같다). 연결점을 따라가지 않는다.
fn file_id(p: &Path) -> Option<String> {
    use std::os::windows::{fs::OpenOptionsExt, io::AsRawHandle};
    use windows_sys::Win32::Storage::FileSystem::{GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION, FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT};
    let f = fs::OpenOptions::new().access_mode(0x80).share_mode(7).custom_flags(FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT).open(p).ok()?;
    let mut info: BY_HANDLE_FILE_INFORMATION = unsafe { std::mem::zeroed() };
    if unsafe { GetFileInformationByHandle(f.as_raw_handle() as _, &mut info) } == 0 { return None; }
    Some(format!("{:08x}:{:08x}{:08x}", info.dwVolumeSerialNumber, info.nFileIndexHigh, info.nFileIndexLow))
}

/// 떼어 낸 폴더(또는 파일)를 지운다. 연결점과 링크는 그 링크만 지우고 너머로 가지 않는다. (지운 크기, 지운 수, 다 지웠는지)
fn delete_tree(path: &Path, deadline: Instant) -> (u64, u64, bool) {
    let (mut bytes, mut files, mut failed) = (0u64, 0u64, 0u64);
    let Ok(meta) = fs::symlink_metadata(path) else { return (0, 0, true) };
    // 읽기 전용 표시가 있는 폴더 · 링크는 RemoveDirectoryW가 거절하므로 표시를 풀고 한 번 더 한다(카본 끝판 B3).
    let writable = |p: &Path| { if let Ok(m) = fs::symlink_metadata(p) { if m.permissions().readonly() { let mut pm = m.permissions(); pm.set_readonly(false); let _ = fs::set_permissions(p, pm); } } };
    let rmdir = |p: &Path| fs::remove_dir(p).or_else(|_| { writable(p); fs::remove_dir(p) });
    let unlink = |p: &Path, m: &fs::Metadata| if m.file_attributes() & 0x10 != 0 { rmdir(p) } else { fs::remove_file(p).or_else(|_| { writable(p); fs::remove_file(p) }) };
    if meta.file_attributes() & REPARSE != 0 { let ok = unlink(path, &meta).is_ok(); return (0, u64::from(ok), ok); }
    if !meta.is_dir() {
        if meta.permissions().readonly() { let mut pm = meta.permissions(); pm.set_readonly(false); let _ = fs::set_permissions(path, pm); }
        let ok = fs::remove_file(path).is_ok();
        return (if ok { meta.len() } else { 0 }, u64::from(ok), ok);
    }
    let mut stack = vec![(path.to_path_buf(), false)];
    while let Some((d, visited)) = stack.pop() {
        if Instant::now() >= deadline { return (bytes, files, false); }
        if visited { if rmdir(&d).is_err() { failed += 1; } continue; }
        stack.push((d.clone(), true));
        let Ok(list) = fs::read_dir(&d) else { failed += 1; continue };
        for e in list {
            let Ok(e) = e else { failed += 1; continue };
            let Ok(m) = e.metadata() else { failed += 1; continue };
            let p = e.path();
            if m.file_attributes() & REPARSE != 0 { if unlink(&p, &m).is_ok() { files += 1 } else { failed += 1 } }
            else if m.is_dir() { stack.push((p, false)); }
            else {
                if m.permissions().readonly() { let mut pm = m.permissions(); pm.set_readonly(false); let _ = fs::set_permissions(&p, pm); }
                match fs::remove_file(&p) { Ok(()) => { files += 1; bytes += m.len(); }, Err(_) => failed += 1 }
            }
        }
    }
    (bytes, files, failed == 0 && fs::symlink_metadata(path).is_err())
}

// ── 프로세스 ─────────────────────────────────────────────────

#[derive(Debug, Clone, Default)]
pub struct Proc { pub image: Option<String>, pub cwd: Option<String>, pub cmd: Option<String> }
#[derive(Debug, Clone, Default)]
pub struct Procs { pub list: Vec<Proc>, pub blocked: bool }
#[derive(Debug, Clone, Copy, PartialEq)]
enum Touch { Free, InUse }

fn norm(text: &str) -> String { text.to_lowercase().replace('/', "\\") }

impl Procs {
    /// 읽은 프로세스 목록에서 못 읽은 것의 판정까지 정한다(12.2 프로세스 줄, 다시 확인 N3).
    pub fn judge(list: Vec<Proc>) -> Self {
        let blocked = list.iter().any(|p| (p.cwd.is_none() || p.cmd.is_none()) && p.image.as_deref().is_none_or(|i| RUNNERS.contains(&i.rsplit('\\').next().unwrap_or(i))));
        Procs { list, blocked }
    }
    /// 명령줄에 그 이름이 든 프로세스가 있는지(임시 항목 · 자동화 프로필의 주인).
    fn mentions(&self, name: &str) -> bool { !name.is_empty() && self.list.iter().any(|p| p.cmd.as_deref().is_some_and(|c| c.contains(name))) }
    /// 그 자리(소문자 key) 안을 실행 파일 · 작업 폴더 · 명령줄의 경로로 쓰는 프로세스가 있는지. 명령줄의 상대 경로는 작업 폴더에 붙여 푼다(N1).
    fn touches(&self, dir: &str) -> Touch {
        let hit = |p: &str| { let k = clean(p); k == dir || inside(&k, dir) };
        for p in &self.list {
            if p.image.as_deref().is_some_and(hit) || p.cwd.as_deref().is_some_and(hit) { return Touch::InUse; }
            if let Some(cmd) = p.cmd.as_deref() {
                if norm(cmd).contains(dir) { return Touch::InUse; }
                let base = p.cwd.as_deref().unwrap_or("");
                for t in tokens(cmd) {
                    let resolved = if t.len() > 1 && t.as_bytes()[1] == b':' || t.starts_with("\\\\") { t.clone() } else if !base.is_empty() { format!("{}\\{}", base.trim_end_matches('\\'), t) } else { continue };
                    if hit(&resolved) { return Touch::InUse; }
                }
            }
        }
        Touch::Free
    }
}

/// 명령줄의 낱말(따옴표를 풀고 `=` 뒤도 본다). 옵션(`-`로 시작)만 뺀다: `pnpm -C my-app`의 `my-app`처럼 구분자가 없는
/// 상대 경로도 작업 폴더에 붙여 본다(카본 끝판 B4). 경로가 아닌 낱말은 붙여도 그 자리가 아니므로 남길 뿐이다.
fn tokens(cmd: &str) -> Vec<String> {
    let (mut out, mut cur, mut quoted) = (Vec::new(), String::new(), false);
    for ch in cmd.chars() {
        match ch { '"' => quoted = !quoted, c if c.is_whitespace() && !quoted => { if !cur.is_empty() { out.push(std::mem::take(&mut cur)); } }, c => cur.push(c) }
    }
    if !cur.is_empty() { out.push(cur); }
    out.into_iter().flat_map(|t| t.split('=').map(str::to_string).collect::<Vec<_>>()).filter(|t| !t.is_empty() && !t.starts_with('-')).collect()
}

/// `a\b\..\c` 같은 길을 푼 소문자 key.
fn clean(p: &str) -> String {
    let norm = norm(p);
    let rest = norm.strip_prefix(r"\\?\").unwrap_or(&norm);
    let mut parts: Vec<&str> = Vec::new();
    for part in rest.split('\\') {
        match part { "" | "." => {}, ".." => { if parts.len() > 1 { parts.pop(); } }, x => parts.push(x) }
    }
    parts.join("\\")
}

mod procs {
    use super::{norm, Proc, Procs};
    use std::mem::{size_of, zeroed, MaybeUninit};
    use windows_sys::Wdk::System::Threading::{NtQueryInformationProcess, ProcessBasicInformation, ProcessWow64Information};
    use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, HANDLE, ERROR_INVALID_PARAMETER};
    use windows_sys::Win32::Security::{EqualSid, GetTokenInformation, TokenUser, TOKEN_QUERY, TOKEN_USER};
    use windows_sys::Win32::System::Diagnostics::Debug::ReadProcessMemory;
    use windows_sys::Win32::System::RemoteDesktop::{WTSEnumerateProcessesExW, WTSFreeMemoryExW, WTSTypeProcessInfoLevel1, WTS_PROCESS_INFO_EXW};
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, GetExitCodeProcess, IsWow64Process, OpenProcess, OpenProcessToken, QueryFullProcessImageNameW,
        PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_VM_READ};

    /// PROCESS_BASIC_INFORMATION(windows-sys에서는 Win32_System_Kernel 기능 뒤에 있어 같은 꼴로 둔다).
    #[repr(C)]
    struct Pbi { exit: i32, peb: usize, affinity: usize, priority: i32, pid: usize, parent: usize }

    struct Handle(HANDLE);
    impl Drop for Handle { fn drop(&mut self) { unsafe { CloseHandle(self.0); } } }

    /// 이 사용자의 프로세스를 모두 읽는다(실행 파일, 작업 폴더, 명령줄). 목록 자체를 얻지 못하면 Err.
    pub fn snapshot() -> Result<Procs, String> {
        let me = user_sid().ok_or("PROC_SID")?;
        let (mut level, mut ptr, mut n) = (1u32, std::ptr::null_mut::<u16>(), 0u32);
        if unsafe { WTSEnumerateProcessesExW(std::ptr::null_mut(), &mut level, 0xFFFF_FFFE, &mut ptr, &mut n) } == 0 || ptr.is_null() { return Err("PROC_LIST".into()); }
        let rows = unsafe { std::slice::from_raw_parts(ptr as *const WTS_PROCESS_INFO_EXW, n as usize) };
        let mut list = Vec::new();
        for r in rows {
            if r.pUserSid.is_null() || unsafe { EqualSid(r.pUserSid, me.as_ptr() as _) } == 0 || r.ProcessId == 0 { continue; }
            if let Some(p) = read(r.ProcessId) { list.push(p); }
        }
        unsafe { WTSFreeMemoryExW(WTSTypeProcessInfoLevel1, ptr as _, n); }
        Ok(Procs::judge(list))
    }

    fn user_sid() -> Option<Vec<u8>> {
        unsafe {
            let mut token: HANDLE = std::ptr::null_mut();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 { return None; }
            let token = Handle(token);
            let mut need = 0u32;
            GetTokenInformation(token.0, TokenUser, std::ptr::null_mut(), 0, &mut need);
            let mut buf = vec![0u8; need as usize];
            if GetTokenInformation(token.0, TokenUser, buf.as_mut_ptr() as _, need, &mut need) == 0 { return None; }
            let user = &*(buf.as_ptr() as *const TOKEN_USER);
            let len = windows_sys::Win32::Security::GetLengthSid(user.User.Sid) as usize;
            Some(std::slice::from_raw_parts(user.User.Sid as *const u8, len).to_vec())
        }
    }

    /// 한 프로세스. 사라졌으면 None, 못 읽은 칸은 None으로 둔다.
    fn read(pid: u32) -> Option<Proc> {
        unsafe {
            let mut h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ, 0, pid);
            let mut deep = true;
            if h.is_null() {
                if GetLastError() == ERROR_INVALID_PARAMETER { return None; }
                h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
                deep = false;
                if h.is_null() { return if GetLastError() == ERROR_INVALID_PARAMETER { None } else { Some(Proc::default()) }; }
            }
            let h = Handle(h);
            let image = image(h.0);
            let (cwd, cmd) = if deep { params(h.0).map(|(a, b)| (Some(a), Some(b))).unwrap_or((None, None)) } else { (None, None) };
            if cwd.is_none() {
                let mut code = 0u32;
                if GetExitCodeProcess(h.0, &mut code) != 0 && code != 259 { return None; } // STILL_ACTIVE가 아니면 끝난 프로세스
            }
            Some(Proc { image, cwd, cmd })
        }
    }

    unsafe fn image(h: HANDLE) -> Option<String> {
        let mut buf = vec![0u16; 32768];
        let mut len = buf.len() as u32;
        (QueryFullProcessImageNameW(h, 0, buf.as_mut_ptr(), &mut len) != 0).then(|| norm(&String::from_utf16_lossy(&buf[..len as usize])))
    }

    unsafe fn get<T: Copy>(h: HANDLE, addr: usize) -> Option<T> {
        let mut v = MaybeUninit::<T>::uninit();
        let mut n = 0usize;
        (addr != 0 && ReadProcessMemory(h, addr as _, v.as_mut_ptr() as _, size_of::<T>(), &mut n) != 0 && n == size_of::<T>()).then(|| v.assume_init())
    }
    unsafe fn wide(h: HANDLE, addr: usize, bytes: usize) -> Option<String> {
        if bytes == 0 { return Some(String::new()); }
        if bytes > 65534 || addr == 0 { return None; }
        let mut buf = vec![0u16; bytes / 2];
        let mut n = 0usize;
        (ReadProcessMemory(h, addr as _, buf.as_mut_ptr() as _, bytes, &mut n) != 0 && n == bytes).then(|| norm(&String::from_utf16_lossy(&buf)))
    }

    /// 작업 폴더와 명령줄(PEB의 RTL_USER_PROCESS_PARAMETERS). 32비트 프로세스는 32비트 PEB를 읽는다.
    unsafe fn params(h: HANDLE) -> Option<(String, String)> {
        let mut wow = 0i32;
        if IsWow64Process(h, &mut wow) == 0 { return None; }
        if wow != 0 {
            let mut peb32 = 0usize;
            if NtQueryInformationProcess(h, ProcessWow64Information, &mut peb32 as *mut usize as _, size_of::<usize>() as u32, std::ptr::null_mut()) != 0 || peb32 == 0 { return None; }
            let pp = get::<u32>(h, peb32 + 0x10)? as usize;
            let cwd = wide(h, get::<u32>(h, pp + 0x28)? as usize, get::<u16>(h, pp + 0x24)? as usize)?;
            let cmd = wide(h, get::<u32>(h, pp + 0x44)? as usize, get::<u16>(h, pp + 0x40)? as usize)?;
            return Some((cwd.trim_end_matches('\\').to_string(), cmd));
        }
        let mut pbi: Pbi = zeroed();
        if NtQueryInformationProcess(h, ProcessBasicInformation, &mut pbi as *mut _ as _, size_of::<Pbi>() as u32, std::ptr::null_mut()) != 0 { return None; }
        let pp = get::<usize>(h, pbi.peb + 0x20)?;
        let cwd = wide(h, get::<usize>(h, pp + 0x40)?, get::<u16>(h, pp + 0x38)? as usize)?;
        let cmd = wide(h, get::<usize>(h, pp + 0x78)?, get::<u16>(h, pp + 0x70)? as usize)?;
        Some((cwd.trim_end_matches('\\').to_string(), cmd))
    }
}

// ── 경로를 부르는 곳 ─────────────────────────────────────────

/// PATH · 시작 프로그램 · 예약 작업과 그 스크립트 · AI 도구 MCP 설정에서 모은 글(소문자, `/`는 `\`로).
#[derive(Debug, Clone, Default)]
pub struct Refs { pub text: String }
impl Refs {
    fn mentions(&self, top: &str, places: &Places) -> bool {
        if self.text.contains(top) { return true; }
        // %USERPROFILE%\… · ~\… 꼴로 적힌 것도 본다.
        if let Some(home) = places.profile.as_ref().map(|p| space::key(p)) {
            if let Some(rest) = top.strip_prefix(&home) {
                return ["%userprofile%", "$env:userprofile", "~", "${env:userprofile}", "$home"].iter().any(|h| self.text.contains(&format!("{h}{rest}")));
            }
        }
        false
    }
}

mod refs {
    use super::{norm, Refs};
    use crate::space::Places;
    use serde_json::Value;
    use std::fs;
    use std::path::{Path, PathBuf};

    const SCRIPTS: [&str; 9] = [".cmd", ".bat", ".ps1", ".psm1", ".vbs", ".js", ".cjs", ".mjs", ".py"];
    const MAX_SCRIPT: u64 = 1 << 20;
    const MAX_CONFIG: u64 = 16 << 20;

    pub fn collect(places: &Places) -> Result<Refs, String> {
        let mut text = String::new();
        let mut add = |t: &str| { text.push_str(&norm(t)); text.push('\n'); };
        // PATH(사용자 · 시스템 · 이 프로세스)
        for (hive, sub) in [(true, r"Environment"), (false, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment")] {
            if let Some(v) = reg::string(hive, sub, "Path") { add(&v); }
        }
        if let Ok(p) = std::env::var("PATH") { add(&p); }
        // 시작 프로그램: Run · RunOnce
        for hive in [true, false] {
            for sub in [r"Software\Microsoft\Windows\CurrentVersion\Run", r"Software\Microsoft\Windows\CurrentVersion\RunOnce"] {
                for v in reg::values(hive, sub).map_err(|_| "REFS_RUN")? { add(&v); }
            }
        }
        // 시작 폴더의 바로 가기(이진 파일이라 UTF-16과 바이트 두 꼴로 읽는다)
        let startup = [std::env::var_os("APPDATA").map(|a| PathBuf::from(a).join(r"Microsoft\Windows\Start Menu\Programs\Startup")),
            std::env::var_os("ProgramData").map(|a| PathBuf::from(a).join(r"Microsoft\Windows\Start Menu\Programs\StartUp"))];
        for dir in startup.into_iter().flatten() {
            let Ok(list) = fs::read_dir(&dir) else { if dir.exists() { return Err("REFS_STARTUP".into()); } continue };
            for e in list.filter_map(|e| e.ok()) {
                let p = e.path();
                if p.is_dir() { continue; }
                let bytes = read_capped(&p, MAX_SCRIPT).ok_or("REFS_STARTUP")?;
                add(&binary_text(&bytes));
            }
        }
        // 예약 작업: 작업 XML 전부와, 그 작업이 부르는 스크립트의 본문
        for xml in backup_native::schedule::task_texts()? {
            add(&xml);
            for script in scripts_of(&xml) {
                let p = Path::new(&script);
                if !p.is_file() { continue; }
                let bytes = read_capped(p, MAX_SCRIPT).ok_or("REFS_TASK_SCRIPT")?;
                add(&String::from_utf8_lossy(&bytes));
            }
        }
        // 알려진 AI 도구 설정의 MCP 서버 칸
        let home = places.profile.clone();
        let appdata = std::env::var_os("APPDATA").map(PathBuf::from);
        let json_files: Vec<(Option<PathBuf>, &[&str])> = vec![
            (home.as_ref().map(|h| h.join(".claude.json")), &["mcpServers"]),
            (appdata.as_ref().map(|a| a.join(r"Claude\claude_desktop_config.json")), &["mcpServers"]),
            (home.as_ref().map(|h| h.join(r".cursor\mcp.json")), &["mcpServers"]),
            (appdata.as_ref().map(|a| a.join(r"Code\User\mcp.json")), &["servers", "mcpServers"]),
            (appdata.as_ref().map(|a| a.join(r"Code\User\settings.json")), &["mcp", "mcpServers"]),
            (home.as_ref().map(|h| h.join(r".gemini\settings.json")), &["mcpServers"]),
        ];
        for (file, keys) in json_files {
            let Some(file) = file else { continue };
            if !file.exists() { continue; }
            let bytes = read_capped(&file, MAX_CONFIG).ok_or("REFS_AI_CONFIG")?;
            let raw = String::from_utf8_lossy(&bytes);
            match serde_json::from_str::<Value>(raw.trim_start_matches('\u{feff}')) {
                Ok(v) => { let mut found = Vec::new(); under(&v, keys, false, &mut found); for s in found { add(&s); } }
                // 주석이 든 설정(JSONC) 따위는 글 전체를 쓴다 — 더 많이 남길 뿐이다.
                Err(_) => add(&raw.replace("\\\\", "\\")),
            }
        }
        if let Some(toml) = home.as_ref().map(|h| h.join(r".codex\config.toml")).filter(|p| p.exists()) {
            let bytes = read_capped(&toml, MAX_CONFIG).ok_or("REFS_AI_CONFIG")?;
            let mut on = false;
            for line in String::from_utf8_lossy(&bytes).lines() {
                let t = line.trim();
                if t.starts_with('[') { on = t.trim_start_matches('[').starts_with("mcp_servers"); }
                if on { add(&t.replace("\\\\", "\\")); }
            }
        }
        Ok(Refs { text })
    }

    fn read_capped(p: &Path, max: u64) -> Option<Vec<u8>> {
        let m = fs::metadata(p).ok()?;
        if m.len() > max { return None; }
        fs::read(p).ok()
    }
    /// 바로 가기 같은 이진 파일에서 글을 꺼낸다: UTF-16 꼴과 바이트 꼴을 함께.
    pub(super) fn binary_text(bytes: &[u8]) -> String {
        // .lnk의 글 칸은 덧붙임 없이 이어져 홀수 바이트에서 시작할 수 있다. 짝수 · 홀수 자리 둘 다 UTF-16으로 읽는다(카본 끝판 B6).
        let mut s = String::new();
        for skip in [0usize, 1] {
            let wide: Vec<u16> = bytes.get(skip..).unwrap_or_default().chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
            s.push_str(&String::from_utf16_lossy(&wide));
            s.push('\n');
        }
        s.push_str(&String::from_utf8_lossy(bytes));
        s
    }
    /// 이름이 `keys` 가운데 하나인 칸 아래의 모든 글.
    fn under(v: &Value, keys: &[&str], inside: bool, out: &mut Vec<String>) {
        match v {
            Value::String(s) if inside => out.push(s.clone()),
            Value::Array(a) => for x in a { under(x, keys, inside, out) },
            Value::Object(o) => for (k, x) in o { under(x, keys, inside || keys.contains(&k.as_str()), out) },
            _ => {}
        }
    }
    /// 작업 XML의 `<Command>` · `<Arguments>`에서 스크립트 파일처럼 보이는 경로.
    pub(super) fn scripts_of(xml: &str) -> Vec<String> {
        let mut out = Vec::new();
        let tag_value = |tag: &str| -> Option<String> {
            let (open, close) = (format!("<{tag}>"), format!("</{tag}>"));
            let a = xml.find(&open)? + open.len();
            let b = xml[a..].find(&close)?;
            Some(expand(xml[a..a + b].replace("&quot;", "\"").replace("&amp;", "&").trim().trim_matches('"')))
        };
        let work = tag_value("WorkingDirectory").filter(|w| !w.is_empty());
        for tag in ["Command", "Arguments"] {
            let (open, close) = (format!("<{tag}>"), format!("</{tag}>"));
            let mut rest = xml;
            while let Some(a) = rest.find(&open) {
                let after = &rest[a + open.len()..];
                let Some(b) = after.find(&close) else { break };
                let value = after[..b].replace("&quot;", "\"").replace("&amp;", "&");
                for t in super::tokens(&expand(&value)).into_iter().chain(std::iter::once(expand(value.trim().trim_matches('"')))) {
                    let t = t.trim_matches('"').replace('/', "\\");
                    if !SCRIPTS.iter().any(|x| t.to_lowercase().ends_with(x)) { continue; }
                    let absolute = t.len() > 1 && t.as_bytes()[1] == b':' || t.starts_with("\\\\");
                    match (&work, absolute) { (Some(w), false) => out.push(format!("{}\\{}", w.trim_end_matches('\\'), t)), _ => out.push(t) }
                }
                rest = &after[b + close.len()..];
            }
        }
        out.sort(); out.dedup();
        out
    }
    fn expand(text: &str) -> String {
        use windows_sys::Win32::System::Environment::ExpandEnvironmentStringsW;
        let wide: Vec<u16> = text.encode_utf16().chain([0]).collect();
        let mut buf = vec![0u16; 32768];
        let n = unsafe { ExpandEnvironmentStringsW(wide.as_ptr(), buf.as_mut_ptr(), buf.len() as u32) } as usize;
        if n == 0 || n > buf.len() { return text.to_string(); }
        String::from_utf16_lossy(&buf[..n.saturating_sub(1)])
    }

    mod reg {
        use windows_sys::Win32::System::Registry::{RegCloseKey, RegEnumValueW, RegGetValueW, RegOpenKeyExW, HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, RRF_RT_REG_SZ, REG_EXPAND_SZ, REG_SZ};
        fn w(s: &str) -> Vec<u16> { s.encode_utf16().chain([0]).collect() }
        fn hive(user: bool) -> HKEY { if user { HKEY_CURRENT_USER } else { HKEY_LOCAL_MACHINE } }
        /// 문자열 값 하나(확장 문자열은 펼친다). 없으면 None.
        pub fn string(user: bool, sub: &str, name: &str) -> Option<String> {
            let (sub, name) = (w(sub), w(name));
            let mut size = 0u32;
            unsafe {
                // RRF_RT_REG_SZ는 확장 문자열(REG_EXPAND_SZ)도 펼쳐서 준다.
                if RegGetValueW(hive(user), sub.as_ptr(), name.as_ptr(), RRF_RT_REG_SZ, std::ptr::null_mut(), std::ptr::null_mut(), &mut size) != 0 { return None; }
                let mut buf = vec![0u16; size as usize / 2 + 1];
                if RegGetValueW(hive(user), sub.as_ptr(), name.as_ptr(), RRF_RT_REG_SZ, std::ptr::null_mut(), buf.as_mut_ptr() as _, &mut size) != 0 { return None; }
                Some(String::from_utf16_lossy(&buf[..(size as usize / 2).saturating_sub(1)]))
            }
        }
        /// 키 아래 문자열 값 모두. 키가 없으면 빈 목록, 열 수 없으면 Err.
        pub fn values(user: bool, sub: &str) -> Result<Vec<String>, ()> {
            let sub = w(sub);
            let mut key: HKEY = std::ptr::null_mut();
            unsafe {
                match RegOpenKeyExW(hive(user), sub.as_ptr(), 0, KEY_READ, &mut key) { 0 => {}, 2 => return Ok(Vec::new()), _ => return Err(()) }
                let mut out = Vec::new();
                for i in 0.. {
                    let (mut name, mut name_len) = (vec![0u16; 16384], 16384u32);
                    let (mut data, mut data_len, mut kind) = (vec![0u8; 65536], 65536u32, 0u32);
                    let mut r = RegEnumValueW(key, i, name.as_mut_ptr(), &mut name_len, std::ptr::null_mut(), &mut kind, data.as_mut_ptr(), &mut data_len);
                    if r == 234 { // ERROR_MORE_DATA: 필요한 크기로 한 번 더
                        data = vec![0u8; data_len as usize + 2]; name_len = 16384;
                        r = RegEnumValueW(key, i, name.as_mut_ptr(), &mut name_len, std::ptr::null_mut(), &mut kind, data.as_mut_ptr(), &mut data_len);
                    }
                    if r == 259 { break; } // ERROR_NO_MORE_ITEMS
                    if r != 0 { RegCloseKey(key); return Err(()); }
                    if kind == REG_SZ || kind == REG_EXPAND_SZ {
                        let wide: Vec<u16> = data[..data_len as usize].chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
                        out.push(String::from_utf16_lossy(&wide).trim_end_matches('\0').to_string());
                    }
                }
                RegCloseKey(key);
                Ok(out)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Fake { procs: Result<Procs, String>, refs: Result<Refs, String> }
    impl World for Fake {
        fn processes(&self) -> Result<Procs, String> { self.procs.clone() }
        fn references(&self, _: &Places) -> Result<Refs, String> { self.refs.clone() }
    }
    fn quiet() -> Fake { Fake { procs: Ok(Procs::default()), refs: Ok(Refs::default()) } }

    fn tree(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("swb-free-test-{name}-{}-{:08x}", std::process::id(), space::random32()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }
    fn old(path: &Path, days: u64) {
        let t = std::time::SystemTime::now() - Duration::from_secs(days * 86_400);
        use std::os::windows::fs::{FileTimesExt, OpenOptionsExt};
        let f = fs::OpenOptions::new().access_mode(0x100).custom_flags(0x0200_0000 | 0x0020_0000).open(path).unwrap(); // 연결점은 따라가지 않고 그 자체의 시각을
        f.set_times(fs::FileTimes::new().set_modified(t).set_accessed(t).set_created(t)).unwrap();
    }
    fn write_old(path: &Path, size: usize, days: u64) { fs::create_dir_all(path.parent().unwrap()).unwrap(); fs::write(path, vec![7u8; size]).unwrap(); old(path, days); }
    fn places(root: &Path, temp: &Path) -> Places {
        let mut p = Places::from_env(None);
        p.roots = vec![root.to_path_buf()]; p.temp = Some(temp.to_path_buf()); p.profile = None; p.local = None; p.cloud_drives.clear();
        p
    }
    fn report(state: &Path, cands: &[(u32, &Path, &str)]) {
        fs::create_dir_all(state.join("solio")).unwrap();
        let list: Vec<Value> = cands.iter().map(|(n, p, k)| json!({"n": n, "grade": "auto", "kind": k, "bytes": 1, "reason": "x", "name": "x", "path": p.to_string_lossy()})).collect();
        fs::write(state.join("solio").join("space.json"), json!({"v": 1, "report": "space-1-aaaaaaaa", "candidates": list}).to_string()).unwrap();
    }
    fn gate(state: &Path) { fs::create_dir_all(state.join("space")).unwrap(); fs::write(state.join("space").join(GATE), "").unwrap(); }
    fn ask(items: &[u32], preview: bool) -> Ask { Ask { report: "space-1-aaaaaaaa".into(), items: items.to_vec(), folders: vec![], preview } }

    #[test] fn without_the_gate_nothing_opens() {
        let (root, state) = (tree("root"), tree("state"));
        let temp = root.join("temp"); fs::create_dir_all(&temp).unwrap();
        report(&state, &[(1, &temp, "temp")]);
        assert_eq!(free_with(&state, &places(&root, &temp), &ask(&[1], false), &quiet()).unwrap_err(), "SPACE_FREE_OFF");
    }

    #[test] fn old_temp_items_go_and_young_busy_git_big_or_mentioned_ones_stay() {
        let (root, state) = (tree("root"), tree("state"));
        let temp = root.join("temp");
        // 지울 것의 이름은 겹치지 않게: 이 이름이 든 명령줄(이 시험을 부른 셸 따위)이 떠 있으면 「쓰는 중」으로 남는다.
        let (a, f) = (format!("old-a-{:08x}", space::random32()), format!("old-file-{:08x}.tmp", space::random32()));
        write_old(&temp.join(&a).join("f.bin"), 3000, 5);
        old(&temp.join(&a), 5);
        write_old(&temp.join(&f), 500, 5);
        write_old(&temp.join("young").join("f"), 100, 0);
        write_old(&temp.join("repo").join(".git").join("HEAD"), 10, 9);
        old(&temp.join("repo").join(".git"), 9); old(&temp.join("repo"), 9);
        write_old(&temp.join("named-by-a-process").join("f"), 10, 9);
        old(&temp.join("named-by-a-process"), 9);
        // 고친 시각은 옛날이지만 방금 만든(푼) 파일은 만든 시각으로 젊다(D2)
        fs::create_dir_all(temp.join("unpacked")).unwrap();
        fs::write(temp.join("unpacked").join("f"), b"x").unwrap();
        { let f = fs::OpenOptions::new().write(true).open(temp.join("unpacked").join("f")).unwrap(); let t = std::time::SystemTime::now() - Duration::from_secs(9 * 86_400); f.set_times(fs::FileTimes::new().set_modified(t)).unwrap(); }
        { use std::os::windows::fs::OpenOptionsExt; let f = fs::OpenOptions::new().access_mode(0x100).custom_flags(0x0200_0000).open(temp.join("unpacked")).unwrap(); let t = std::time::SystemTime::now() - Duration::from_secs(9 * 86_400); f.set_times(fs::FileTimes::new().set_modified(t)).unwrap(); }
        gate(&state);
        report(&state, &[(1, &temp, "temp")]);
        let procs = Procs::judge(vec![Proc { image: Some(r"c:\x\tool.exe".into()), cwd: Some(r"c:\x".into()), cmd: Some(r"tool.exe --dir named-by-a-process".into()) }]);
        let world = Fake { procs: Ok(procs), refs: Ok(Refs::default()) };
        let p = places(&root, &temp);
        // 미리 보기는 세기만 하고 지우지 않는다
        let v = free_with(&state, &p, &ask(&[1], true), &world).unwrap();
        assert_eq!((v["preview"].as_bool(), v["items"].as_u64(), v["freed"].as_u64()), (Some(true), Some(2), Some(3500)), "{v}");
        assert!(temp.join(&a).exists() && temp.join(&f).exists());
        let v = free_with(&state, &p, &ask(&[1], false), &world).unwrap();
        assert_eq!((v["items"].as_u64(), v["freed"].as_u64()), (Some(2), Some(3500)), "{v}");
        assert!(!temp.join(&a).exists() && !temp.join(&f).exists());
        for kept in ["young", "repo", "named-by-a-process", "unpacked"] { assert!(temp.join(kept).exists(), "{kept} stays"); }
        let ledger = fs::read_to_string(state.join("space").join(LEDGER)).unwrap();
        assert!(ledger.contains("\"stage\":\"freed\"") && ledger.contains("\"kind\":\"temp\""), "{ledger}");
        let _ = fs::remove_dir_all(&root); let _ = fs::remove_dir_all(&state);
    }

    #[test] fn a_temp_item_behind_a_link_is_left_and_a_link_inside_is_cut_not_followed() {
        let (root, state) = (tree("root"), tree("state"));
        let temp = root.join("temp");
        let precious = root.join("precious"); write_old(&precious.join("keep.txt"), 10, 30);
        let holder = temp.join(format!("holder-{:08x}", space::random32()));
        write_old(&holder.join("f"), 10, 9);
        let junction = holder.join("to-precious");
        let ok = std::process::Command::new("cmd").args(["/c", "mklink", "/J"]).arg(&junction).arg(&precious).output().unwrap().status.success();
        assert!(ok, "mklink /J");
        // 링크를 만든 순간도 그 항목의 시각이다(지킴이 tree_age). 오래된 링크로 만든다.
        old(&junction, 9);
        old(&holder, 9);
        gate(&state);
        report(&state, &[(1, &temp, "temp")]);
        let v = free_with(&state, &places(&root, &temp), &ask(&[1], false), &quiet()).unwrap();
        assert_eq!(v["items"].as_u64(), Some(1), "{v}");
        assert!(!holder.exists());
        assert!(precious.join("keep.txt").exists(), "the junction's target is never followed");
        let _ = fs::remove_dir_all(&root); let _ = fs::remove_dir_all(&state);
    }

    #[test] fn a_folder_in_use_is_not_taken() {
        let (root, state) = (tree("root"), tree("state"));
        let temp = root.join("temp");
        write_old(&temp.join("open-inside").join("deep").join("f.bin"), 100, 9);
        old(&temp.join("open-inside").join("deep"), 9); old(&temp.join("open-inside"), 9);
        gate(&state);
        report(&state, &[(1, &temp, "temp")]);
        // 안쪽 파일을 연 채로는 Windows가 이름 바꾸기를 거절한다(지킴이 10-29 확인)
        let _held = fs::File::open(temp.join("open-inside").join("deep").join("f.bin")).unwrap();
        let v = free_with(&state, &places(&root, &temp), &ask(&[1], false), &quiet()).unwrap();
        assert_eq!((v["items"].as_u64(), v["busy"].as_u64()), (Some(0), Some(1)), "{v}");
        assert!(temp.join("open-inside").join("deep").join("f.bin").exists());
        drop(_held);
        let _ = fs::remove_dir_all(&root); let _ = fs::remove_dir_all(&state);
    }

    #[test] fn backup_folders_and_reported_kinds_are_not_trusted() {
        let (root, state) = (tree("root"), tree("state"));
        let temp = root.join("temp");
        write_old(&temp.join("a").join("f"), 10, 9); old(&temp.join("a"), 9);
        let docs = root.join("docs"); write_old(&docs.join("notes.txt"), 10, 90);
        gate(&state);
        // 보고서가 문서 폴더를 「임시」라고 적어도 디스크로는 임시가 아니다(D7)
        report(&state, &[(1, &temp, "temp"), (2, &docs, "temp")]);
        let mut a = ask(&[1, 2], false);
        a.folders = vec![temp.to_string_lossy().into_owned()];
        let v = free_with(&state, &places(&root, &temp), &a, &quiet()).unwrap();
        assert_eq!((v["items"].as_u64(), v["kept"].as_u64()), (Some(0), Some(2)), "{v}");
        assert!(temp.join("a").exists() && docs.join("notes.txt").exists());
        let _ = fs::remove_dir_all(&root); let _ = fs::remove_dir_all(&state);
    }

    #[test] fn without_a_process_list_nothing_goes() {
        let (root, state) = (tree("root"), tree("state"));
        let temp = root.join("temp");
        write_old(&temp.join("a").join("f"), 10, 9); old(&temp.join("a"), 9);
        gate(&state);
        report(&state, &[(1, &temp, "temp")]);
        let world = Fake { procs: Err("PROC_LIST".into()), refs: Ok(Refs::default()) };
        let v = free_with(&state, &places(&root, &temp), &ask(&[1], false), &world).unwrap();
        assert_eq!((v["items"].as_u64(), v["kept"].as_u64()), (Some(0), Some(1)));
        assert!(temp.join("a").exists());
        let _ = fs::remove_dir_all(&root); let _ = fs::remove_dir_all(&state);
    }

    fn git(dir: &Path, args: &[&str]) { assert!(std::process::Command::new("git").arg("-C").arg(dir).args(args).output().unwrap().status.success(), "git {args:?}"); }
    /// 오래 쉰 git 저장소 하나와 그 안의 node_modules(잠금 파일 있음, 무시됨).
    fn idle_repo(root: &Path, name: &str) -> (PathBuf, PathBuf) {
        let repo = root.join(name);
        fs::create_dir_all(&repo).unwrap();
        git(&repo, &["init", "-q"]);
        fs::write(repo.join(".gitignore"), "node_modules/\n").unwrap();
        fs::write(repo.join("package-lock.json"), "{}").unwrap();
        fs::write(repo.join("package.json"), "{}").unwrap();
        let nm = repo.join("node_modules");
        write_old(&nm.join("pkg").join("index.js"), 2000, 30);
        // 저장소 안 모든 것의 시각을 30일 전으로
        let mut stack = vec![repo.clone()];
        let mut all = Vec::new();
        while let Some(d) = stack.pop() { for e in fs::read_dir(&d).unwrap().flatten() { let p = e.path(); if p.is_dir() { stack.push(p.clone()); } all.push(p); } }
        for p in all.iter().rev() { old(p, 30); }
        old(&repo, 30);
        (repo, nm)
    }
    fn low_disk(state: &Path) {
        // 시작선을 아주 높게 잡아 이 드라이브가 늘 「모자람」이 되게 한다.
        fs::write(state.join("space-settings.json"), json!({"startLines": {"C": 1_000_000, "D": 1_000_000}}).to_string()).unwrap();
    }

    #[test] fn an_idle_projects_node_modules_goes_and_stays_when_used_referenced_recent_or_a_worktree() {
        let (root, state) = (tree("root"), tree("state"));
        let temp = root.join("temp"); fs::create_dir_all(&temp).unwrap();
        gate(&state); low_disk(&state);
        let (repo, nm) = idle_repo(&root, "idle");
        let (used, used_nm) = idle_repo(&root, "used");
        let (refd, refd_nm) = idle_repo(&root, "referenced");
        let (_recent, recent_nm) = idle_repo(&root, "recent");
        fs::write(root.join("recent").join("README.md"), "new").unwrap();
        report(&state, &[(1, &nm, "node_modules"), (2, &used_nm, "node_modules"), (3, &refd_nm, "node_modules"), (4, &recent_nm, "node_modules")]);
        // 모노레포 뿌리에서 도는 개발 서버(작업 폴더가 그 저장소, 명령줄은 상대 경로) — N1 · D3
        let procs = Procs::judge(vec![Proc { image: Some(r"c:\program files\nodejs\node.exe".into()), cwd: Some(space::key(&used)), cmd: Some(r"node .\node_modules\vite\bin\vite.js".into()) }]);
        let refs = Refs { text: format!("mcp server {}\\bin\\server.js\n", space::key(&refd)) };
        let world = Fake { procs: Ok(procs), refs: Ok(refs) };
        let p = places(&root, &temp);
        let v = free_with(&state, &p, &ask(&[1, 2, 3, 4], false), &world).unwrap();
        assert_eq!(v["items"].as_u64(), Some(1), "{v}");
        assert_eq!(v["busy"].as_u64(), Some(1), "the one a running process uses counts as 「쓰는 중이라 남김」(카본 끝판 B7): {v}");
        assert!(!nm.exists(), "the idle one goes");
        assert!(repo.join("package-lock.json").exists() && repo.join(".git").exists(), "only node_modules");
        for kept in [&used_nm, &refd_nm, &recent_nm] { assert!(kept.exists(), "{kept:?} stays"); }
        let ledger = fs::read_to_string(state.join("space").join(LEDGER)).unwrap();
        assert!(ledger.contains("\"running\"") && ledger.contains("\"referenced\"") && ledger.contains("\"recent\""), "{ledger}");
        let _ = fs::remove_dir_all(&root); let _ = fs::remove_dir_all(&state);
    }

    #[test] fn an_unreadable_runner_or_unreadable_references_rest_build_artifacts() {
        let (root, state) = (tree("root"), tree("state"));
        let temp = root.join("temp"); fs::create_dir_all(&temp).unwrap();
        gate(&state); low_disk(&state);
        let (_repo, nm) = idle_repo(&root, "idle");
        report(&state, &[(1, &nm, "node_modules")]);
        let p = places(&root, &temp);
        // 관리자 권한 터미널: 실행 파일만 읽힘
        let elevated = Procs::judge(vec![Proc { image: Some(r"c:\windows\system32\cmd.exe".into()), cwd: None, cmd: None }]);
        let v = free_with(&state, &p, &ask(&[1], false), &Fake { procs: Ok(elevated), refs: Ok(Refs::default()) }).unwrap();
        assert_eq!(v["items"].as_u64(), Some(0));
        // 관리자 권한이지만 실행기가 아닌 앱은 막지 않는다(N3)
        let tray = Procs::judge(vec![Proc { image: Some(r"c:\program files\tray\tray.exe".into()), cwd: None, cmd: None }]);
        let v = free_with(&state, &p, &ask(&[1], true), &Fake { procs: Ok(tray.clone()), refs: Ok(Refs::default()) }).unwrap();
        assert_eq!(v["items"].as_u64(), Some(1), "{v}");
        let v = free_with(&state, &p, &ask(&[1], false), &Fake { procs: Ok(tray), refs: Err("REFS_RUN".into()) }).unwrap();
        assert_eq!(v["items"].as_u64(), Some(0));
        assert!(nm.exists());
        let _ = fs::remove_dir_all(&root); let _ = fs::remove_dir_all(&state);
    }

    #[test] fn a_worktree_or_a_tracked_folder_stays() {
        let (root, state) = (tree("root"), tree("state"));
        let temp = root.join("temp"); fs::create_dir_all(&temp).unwrap();
        gate(&state); low_disk(&state);
        let (repo, _) = idle_repo(&root, "main");
        git(&repo, &["-c", "user.email=t@t", "-c", "user.name=t", "add", "-A"]);
        git(&repo, &["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "x"]);
        git(&repo, &["worktree", "add", "-q", "--detach", &root.join("wt").to_string_lossy()]);
        let wt_nm = root.join("wt").join("node_modules");
        write_old(&wt_nm.join("x.js"), 10, 30);
        report(&state, &[(1, &wt_nm, "node_modules")]);
        let v = free_with(&state, &places(&root, &temp), &ask(&[1], false), &quiet()).unwrap();
        assert_eq!(v["items"].as_u64(), Some(0), "{v}");
        assert!(wt_nm.exists());
        let _ = fs::remove_dir_all(&root); let _ = fs::remove_dir_all(&state);
    }

    #[test] fn a_stopped_take_is_resumed_only_when_the_disk_still_agrees() {
        let (root, state) = (tree("root"), tree("state"));
        let temp = root.join("temp");
        let item = temp.join(format!("left-{:08x}", space::random32()));
        write_old(&item.join("f"), 50, 9);
        gate(&state);
        let taken = temp.join(format!("{}{MARK}0123abcd", item.file_name().unwrap().to_string_lossy()));
        fs::rename(&item, &taken).unwrap();
        let id = file_id(&taken).unwrap();
        let mut l = Ledger::open(&state.join("space")).unwrap();
        l.line(json!({"stage": "staged", "kind": "temp", "path": item.to_string_lossy(), "as": taken.to_string_lossy(), "id": id}));
        // 위조된 줄: 정해진 꼴이 아닌 이름
        let docs = root.join("docs"); write_old(&docs.join("notes.txt"), 10, 9);
        l.line(json!({"stage": "staged", "kind": "temp", "path": root.join("d").to_string_lossy(), "as": docs.to_string_lossy(), "id": file_id(&docs).unwrap()}));
        let v = resume(&state, &places(&root, &temp), &[]).unwrap();
        assert_eq!((v["items"].as_u64(), v["check"].as_u64()), (Some(1), Some(1)), "{v}");
        assert!(!taken.exists() && docs.join("notes.txt").exists());
        // 맞지 않는 줄은 한 번만 적는다(매시 회차마다 장부가 늘지 않는다)
        let checks = |state: &Path| Ledger::open(&state.join("space")).unwrap().rows().iter().filter(|r| r["stage"] == "check").count();
        assert_eq!(checks(&state), 1);
        let v = resume(&state, &places(&root, &temp), &[]).unwrap();
        assert_eq!((v["check"].as_u64(), checks(&state)), (Some(1), 1), "{v}");
        let _ = fs::remove_dir_all(&root); let _ = fs::remove_dir_all(&state);
    }

    #[test] fn a_take_that_a_process_started_using_is_returned_not_deleted() {
        let (root, state) = (tree("root"), tree("state"));
        let temp = root.join("temp");
        let item = temp.join(format!("held-{:08x}", space::random32()));
        write_old(&item.join("f"), 50, 9);
        gate(&state);
        let taken = temp.join(format!("{}{MARK}89abcdef", item.file_name().unwrap().to_string_lossy()));
        fs::rename(&item, &taken).unwrap();
        let id = file_id(&taken).unwrap();
        let mut l = Ledger::open(&state.join("space")).unwrap();
        l.line(json!({"stage": "staged", "kind": "temp", "path": item.to_string_lossy(), "as": taken.to_string_lossy(), "id": id}));
        l.line(json!({"stage": "stuck", "path": item.to_string_lossy(), "as": taken.to_string_lossy()}));
        let v = resume(&state, &places(&root, &temp), &[]).unwrap();
        assert_eq!(v["items"].as_u64(), Some(0), "{v}");
        assert!(item.join("f").exists() && !taken.exists(), "the stuck take goes back to its own name");
        assert!(Ledger::open(&state.join("space")).unwrap().open_staged().is_empty(), "and the line is closed");
        // 꼴이 맞지 않는 줄(위조 · 다른 자리)은 되돌리기로도 옮기지 않는다(카본 끝판 B10)
        let docs = root.join("docs"); write_old(&docs.join("notes.txt"), 10, 9);
        let mut l = Ledger::open(&state.join("space")).unwrap();
        let elsewhere = temp.join("elsewhere");
        l.line(json!({"stage": "staged", "kind": "temp", "path": elsewhere.to_string_lossy(), "as": docs.to_string_lossy(), "id": file_id(&docs).unwrap()}));
        l.line(json!({"stage": "stuck", "path": elsewhere.to_string_lossy(), "as": docs.to_string_lossy()}));
        let v = resume(&state, &places(&root, &temp), &[]).unwrap();
        assert_eq!(v["check"].as_u64(), Some(1), "{v}");
        assert!(docs.join("notes.txt").exists() && !elsewhere.exists());
        let _ = fs::remove_dir_all(&root); let _ = fs::remove_dir_all(&state);
    }

    #[test] fn command_line_paths_are_resolved_against_the_working_folder() {
        let p = Procs::judge(vec![Proc { image: Some(r"c:\node\node.exe".into()), cwd: Some(r"c:\users\me".into()), cmd: Some(r#"node "dev\app\server.js" --x=..\me\dev\other"#.into()) }]);
        assert_eq!(p.touches(r"c:\users\me\dev\app"), Touch::InUse);
        assert_eq!(p.touches(r"c:\users\me\dev\other"), Touch::InUse);
        assert_eq!(p.touches(r"c:\users\me\dev\third"), Touch::Free, "a home working folder alone does not make every repo below it busy (N1)");
        assert!(!p.blocked);
    }

    #[test] fn task_scripts_are_found_in_commands_and_arguments() {
        let xml = r#"<Exec><Command>C:\tools\run.cmd</Command><Arguments>-File "C:\x\job.ps1" --y</Arguments></Exec>"#;
        assert_eq!(refs::scripts_of(xml), vec![r"C:\tools\run.cmd".to_string(), r"C:\x\job.ps1".to_string()]);
        // `/` 구분과 작업 폴더에 붙은 상대 경로(카본 끝판 B5)
        let xml = r#"<Exec><Command>node</Command><Arguments>C:/tools/job.mjs --prod</Arguments><WorkingDirectory>C:\scheduler\</WorkingDirectory></Exec><Exec><Command>py</Command><Arguments>run.py</Arguments></Exec>"#;
        assert_eq!(refs::scripts_of(xml), vec![r"C:\scheduler\run.py".to_string(), r"C:\tools\job.mjs".to_string()]);
    }

    #[test] fn a_shortcuts_text_is_read_at_odd_and_even_offsets() {
        let wide: Vec<u8> = r"C:\dev\shop".encode_utf16().flat_map(u16::to_le_bytes).collect();
        for pad in [0usize, 1] {
            let mut bytes = vec![0u8; pad]; bytes.extend(&wide);
            assert!(refs::binary_text(&bytes).contains(r"C:\dev\shop"), "pad {pad}");
        }
    }

    #[test] fn a_bare_folder_name_in_a_command_line_is_resolved_against_the_working_folder() {
        let procs = Procs::judge(vec![Proc { image: Some(r"c:\program files\nodejs\node.exe".into()), cwd: Some(r"c:\dev".into()), cmd: Some(r"pnpm -C my-app dev".into()) },
            Proc { image: Some(r"c:\x\uv.exe".into()), cwd: Some(r"c:\work".into()), cmd: Some(r"uv --directory=api run app.py".into()) },
            Proc { image: Some(r"c:\x\tool.exe".into()), cwd: Some(r"c:\x".into()), cmd: Some(r"tool.exe C:/Repos/Site/build.mjs".into()) }]);
        assert!(procs.touches(r"c:\dev\my-app") == Touch::InUse, "pnpm -C my-app (카본 끝판 B4)");
        assert!(procs.touches(r"c:\work\api") == Touch::InUse, "--directory=api");
        assert!(procs.touches(r"c:\repos\site") == Touch::InUse, "a forward-slash path in another case");
        assert!(procs.touches(r"c:\dev\other") == Touch::Free);
    }

    #[test] fn the_path_below_the_git_top_ignores_case() {
        let root = tree("rel");
        fs::create_dir_all(root.join("Repo").join("node_modules")).unwrap();
        assert_eq!(relative(&root.join("REPO").join("node_modules"), &root.join("repo")).as_deref(), Some("node_modules"), "카본 끝판 B11");
        assert_eq!(relative(&root.join("Repo"), &root.join("Repo")), None);
        assert_eq!(relative(&root.join("Repo2"), &root.join("Repo")), None);
        let _ = fs::remove_dir_all(&root);
    }

    #[test] fn a_profile_under_temp_is_counted_once_and_a_read_only_folder_still_goes() {
        let (root, state) = (tree("root"), tree("state"));
        let temp = root.join("temp");
        let prof = temp.join(format!("{PROFILE_PREFIX}{:08x}", space::random32()));
        write_old(&prof.join("Default").join("x"), 400, 3);
        old(&prof.join("Default"), 3); old(&prof, 3);
        // 읽기 전용 표시가 있는 폴더(desktop.ini를 품은 폴더 따위)도 지운다(카본 끝판 B3)
        let ro = temp.join(format!("ro-{:08x}", space::random32()));
        write_old(&ro.join("inner").join("f"), 100, 5);
        for d in [ro.join("inner"), ro.clone()] { let mut pm = fs::metadata(&d).unwrap().permissions(); pm.set_readonly(true); fs::set_permissions(&d, pm).unwrap(); old(&d, 5); }
        gate(&state);
        report(&state, &[(1, &temp, "temp"), (2, &prof, "temp-profile")]);
        let p = places(&root, &temp);
        let v = free_with(&state, &p, &ask(&[1, 2], true), &quiet()).unwrap();
        assert_eq!((v["items"].as_u64(), v["freed"].as_u64()), (Some(2), Some(500)), "the profile once, not twice (카본 끝판 B2): {v}");
        let v = free_with(&state, &p, &ask(&[1, 2], false), &quiet()).unwrap();
        assert_eq!((v["items"].as_u64(), v["freed"].as_u64(), v["kept"].as_u64()), (Some(2), Some(500), Some(0)), "{v}");
        assert!(!prof.exists() && !ro.exists(), "both go, the read-only one too");
        let _ = fs::remove_dir_all(&root); let _ = fs::remove_dir_all(&state);
    }

    /// 이 PC에서 재 보기: `cargo test --bin WorkBackupRun probe_this_pc -- --ignored --nocapture`. 경로는 찍지 않는다.
    #[test] #[ignore] fn probe_this_pc() {
        let t = Instant::now();
        let p = procs::snapshot().expect("process list");
        let unread: Vec<String> = p.list.iter().filter(|x| x.cwd.is_none() || x.cmd.is_none()).map(|x| x.image.as_deref().map(|i| i.rsplit('\\').next().unwrap_or("").to_string()).unwrap_or_else(|| "?".into())).collect();
        println!("processes {} · unreadable {} {:?} · blocked {} · {} ms", p.list.len(), unread.len(), unread, p.blocked, t.elapsed().as_millis());
        let t = Instant::now();
        match refs::collect(&Places::from_env(None)) { Ok(r) => println!("references ok · {} chars · {} ms", r.text.len(), t.elapsed().as_millis()), Err(e) => println!("references FAILED {e} · {} ms", t.elapsed().as_millis()) }
    }

    #[test] fn this_pcs_processes_can_be_read() {
        let p = procs::snapshot().expect("process list");
        let me = std::env::current_exe().unwrap();
        assert!(p.list.iter().any(|x| x.image.as_deref() == Some(norm(&me.to_string_lossy()).as_str()) && x.cwd.is_some() && x.cmd.is_some()), "this test process is read whole");
    }
}
