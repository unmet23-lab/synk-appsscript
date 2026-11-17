//! 공간 비우기 1판 — 훑기와 보고서 (STAGE1_DESIGN.md 4.15 · SPACE_DESIGN.md). 아무것도 지우지 않는다.
//!
//! 하루 한 번, 그날 처음 도는 회차 끝에 회차 실행기가 부른다(`daily`). 엔진 잠금을 놓은 뒤 읽기만 하고, 낮은 CPU · 디스크
//! 우선순위(스레드 배경 모드)로 하루 5분을 넘기지 않는다. 다 못 훑으면 걸어갈 폴더 목록(`space/lap.json`)을 남겨 다음 날
//! 이어서 훑는다. 연결점(정션 · 링크)은 따라가지도 세지도 않고, 이 PC에 내용이 없는 클라우드 자리표 파일도 세지 않는다.
//! `git`은 `--no-optional-locks`로만 불러 색인 잠금을 만들지 않는다.
//!
//! 보고서 `solio/space.json`(1MB · 후보 1,000개 상한)은 드라이브마다 크기 · 남은 공간 · 지난 14일 증가 속도 · 「이대로면 며칠
//! 뒤 시작선」, 「지난 7일 늘어난 것」 다섯 줄, 후보 목록(번호 · 등급 · 크기 · 까닭 낱말 · 사람이 읽는 이름 · 경로)을 담는다.
//! 후보와 「지난 7일」은 한 바퀴를 다 훑은 값끼리만 견준다(날짜가 섞인 값을 내지 않는다). 드라이브의 쓴 양은 훑기와 상관없는
//! 한 시점 값이라 날마다 적은 값으로 증가 속도를 셈한다.
//!
//! 1판의 등급은 비울 수 있는 갈래(`auto` 가 등급 · `suggest` 제안 · `view` 보기만)를 훑기에서 읽기만으로 볼 수 있는 조건까지
//! 따져 정한 것이다. 열린 파일 · 쓰는 프로세스 · 예약 작업 · 경로 참조는 비우기 직전에 다시 보는 것이라(SPACE_DESIGN.md 5.1)
//! 비우는 판(가 등급 자동)과 함께 넣는다. 그래서 작업 사본은 1판에서 `auto`가 되지 않는다.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::{HashMap, HashSet}, fs, os::windows::fs::MetadataExt, path::{Path, PathBuf}, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};

/// 하루 훑기 상한(4.15).
pub const BUDGET: Duration = Duration::from_secs(300);
const DIR: &str = "space";
const FORMAT: u32 = 1;
pub const REPORT_MAX: usize = 1_048_576;
pub const CANDIDATES_MAX: usize = 1000;
/// 크기를 남기는 폴더의 깊이(드라이브 뿌리에서). 「지난 7일 늘어난 것」은 이 깊이 안에서 찾는다.
const DEPTH: u8 = 4;
/// 다 훑은 바퀴의 기록에 남기는 폴더의 크기 하한.
const KEEP_FOLDER: u64 = 64 << 20;
const DAY_MS: u64 = 86_400_000;
const LAPS_KEPT: usize = 20;
const GIT_TIMEOUT: Duration = Duration::from_secs(20);

const REPARSE: u32 = 0x400;
const OFFLINE: u32 = 0x1000;
const RECALL_ON_OPEN: u32 = 0x40000;
const RECALL_ON_DATA_ACCESS: u32 = 0x400000;
/// 드라이브 뿌리에서 들어가지 않는 시스템 폴더(관리자 몫 — Windows 정리 기능에 맡긴다, SPACE_DESIGN.md 6장).
const SYSTEM_DIRS: [&str; 16] = ["windows", "program files", "program files (x86)", "programdata", "system volume information", "recovery", "$winreagent",
    "$sysreset", "config.msi", "perflogs", "msocache", "$windows.~bt", "$windows.~ws", "$getcurrent", "onedrivetemp", "$recycle.bin"];

/// 훑을 자리와 알아볼 자리. 회차는 `Places::from_env`, 시험은 직접 만든다.
#[derive(Debug, Clone)]
pub struct Places {
    /// 걸어갈 뿌리(보통은 고정 드라이브 뿌리 `C:\` …). 드라이브 뿌리면 깊이 0이다.
    pub roots: Vec<PathBuf>,
    pub temp: Option<PathBuf>,
    pub local: Option<PathBuf>,
    pub profile: Option<PathBuf>,
    pub cloud_drives: Vec<PathBuf>,
    /// 이 계정의 SID(휴지통 자리).
    pub sid: Option<String>,
    pub big_file: u64,
    pub candidate_min: u64,
    /// 시험에서만: 하루에 읽을 폴더 수 상한(시간 대신).
    pub max_dirs: Option<u64>,
}
impl Places {
    pub fn from_env(sid: Option<String>) -> Self {
        let var = |name: &str| std::env::var_os(name).map(PathBuf::from).filter(|p| p.is_absolute());
        Self { roots: fixed_drives(), temp: var("TEMP").map(|t| long_path(&t)), local: var("LOCALAPPDATA"), profile: var("USERPROFILE"),
            cloud_drives: ["OneDrive", "OneDriveCommercial", "OneDriveConsumer"].iter().filter_map(|n| var(n)).collect(), sid, big_file: 1 << 30, candidate_min: 100 << 20, max_dirs: None }
    }
    /// 정해진 자리의 갈래: (자리, 갈래). 이름 꼴로는 알 수 없는 캐시 · 모델 · 기록 자리다.
    fn known(&self) -> Vec<(String, &'static str)> {
        let mut out = Vec::new();
        let mut put = |base: &Option<PathBuf>, rel: &str, kind: &'static str| if let Some(b) = base { out.push((key(&b.join(rel)), kind)); };
        put(&self.local, "npm-cache", "npm-cache"); put(&self.local, r"pip\Cache", "pip-cache"); put(&self.local, r"uv\cache", "uv-cache");
        put(&self.local, r"Yarn\Cache", "yarn-cache"); put(&self.local, r"pnpm\store", "pnpm-store");
        put(&self.profile, r".cargo\registry", "cargo-cache"); put(&self.profile, r".nuget\packages", "nuget-cache"); put(&self.profile, r".gradle\caches", "gradle-cache");
        put(&self.profile, r".cache\huggingface", "models"); put(&self.profile, r".ollama\models", "models");
        put(&self.profile, r".claude\projects", "ai-history"); put(&self.profile, r".codex\sessions", "ai-history");
        for d in &self.cloud_drives { out.push((key(d), "cloud-drive")); }
        out
    }
}

/// 이 PC의 고정 드라이브 뿌리(네트워크 · 이동식 드라이브는 넣지 않는다).
pub fn fixed_drives() -> Vec<PathBuf> {
    use windows_sys::Win32::Storage::FileSystem::{GetDriveTypeW, GetLogicalDrives};
    let mask = unsafe { GetLogicalDrives() };
    (0..26u32).filter(|i| mask & (1 << i) != 0).map(|i| format!("{}:\\", (b'A' + i as u8) as char)).filter(|root| {
        let wide: Vec<u16> = root.encode_utf16().chain([0]).collect();
        unsafe { GetDriveTypeW(wide.as_ptr()) == 3 } // DRIVE_FIXED
    }).map(PathBuf::from).collect()
}
/// 드라이브 하나의 크기와 남은 공간(바이트).
pub fn drive_space(root: &Path) -> Option<(u64, u64)> {
    use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;
    let wide: Vec<u16> = root.as_os_str().to_string_lossy().encode_utf16().chain([0]).collect();
    let (mut free_caller, mut total, mut free) = (0u64, 0u64, 0u64);
    (unsafe { GetDiskFreeSpaceExW(wide.as_ptr(), &mut free_caller, &mut total, &mut free) } != 0).then_some((total, free_caller))
}
/// NTFS의 마지막 접근 시각 갱신이 꺼져 있는지(`fsutil behavior query disablelastaccess`와 같은 레지스트리 값). 모르면 None.
pub fn last_access_off() -> Option<bool> {
    use windows_sys::Win32::System::Registry::{RegGetValueW, HKEY_LOCAL_MACHINE, RRF_RT_REG_DWORD};
    let sub: Vec<u16> = r"SYSTEM\CurrentControlSet\Control\FileSystem".encode_utf16().chain([0]).collect();
    let name: Vec<u16> = "NtfsDisableLastAccessUpdate".encode_utf16().chain([0]).collect();
    let (mut value, mut size) = (0u32, 4u32);
    let ok = unsafe { RegGetValueW(HKEY_LOCAL_MACHINE, sub.as_ptr(), name.as_ptr(), RRF_RT_REG_DWORD, std::ptr::null_mut(), &mut value as *mut u32 as _, &mut size) } == 0;
    ok.then_some(value & 1 == 1)
}

fn key(path: &Path) -> String { path.to_string_lossy().trim_start_matches(r"\\?\").trim_end_matches('\\').to_lowercase() }
fn epoch_ms() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0) }
fn ms_of(t: std::io::Result<SystemTime>) -> u64 { t.ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis() as u64).unwrap_or(0) }

/// 크기를 모으는 자리 하나: 깊이 안의 폴더이거나 후보다.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
struct Acc {
    path: String,
    bytes: u64,
    files: u64,
    /// 안의 파일 가운데 가장 늦게 고친 시각(ms).
    newest: u64,
    /// 후보의 갈래. 없으면 깊이 안의 폴더다.
    #[serde(default, skip_serializing_if = "Option::is_none")] kind: Option<String>,
    /// 빌드 산출물 옆의 잠금 파일이 있는지 · 그 프로젝트 폴더의 바로 아래 항목 가운데 가장 늦게 고친 시각 · git이 무시하는지.
    #[serde(default, skip_serializing_if = "Option::is_none")] lock: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")] project_newest: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")] git: Option<String>,
    /// 이 후보를 감싼 가장 가까운 후보(임시 폴더 모음 포함)의 번호. 겹친 크기는 바퀴 끝에서, 이 후보가 남을 때만 감싼 쪽에서 뺀다.
    #[serde(default, skip_serializing_if = "Option::is_none")] parent: Option<u32>,
    /// 임시 폴더 안에서 이틀 넘게 그대로인 파일의 크기와 수(감싼 쪽이 임시 폴더 모음이면 이만큼 뺀다).
    #[serde(default, skip_serializing_if = "is_zero")] old_bytes: u64,
    #[serde(default, skip_serializing_if = "is_zero")] old_files: u64,
    /// 빌드 산출물이 든 프로젝트 폴더 전체에서 가장 늦게 고친 시각을 재는 모음(폴더 크기도 후보도 아니다).
    #[serde(default, skip_serializing_if = "std::ops::Not::not")] track: bool,
    /// 빌드 산출물: 그 프로젝트를 재는 모음의 번호.
    #[serde(default, skip_serializing_if = "Option::is_none")] project: Option<u32>,
}
fn is_zero(v: &u64) -> bool { *v == 0 }
/// 아직 읽지 않은 폴더 하나와, 그 안의 파일이 더해질 자리들.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Pending { path: String, depth: u8, keys: Vec<u32>, #[serde(default)] in_git: bool, #[serde(default)] inside: bool, #[serde(default)] temp: bool }
/// 진행 중인 한 바퀴.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct Lap { v: u32, started: u64, days: u32, stack: Vec<Pending>, accs: Vec<Acc>, #[serde(default)] temp_old: Option<u32>, dirs: u64, files: u64, skipped: u64 }
/// 다 훑은 한 바퀴의 기록.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
struct Finished { v: u32, started: u64, finished: u64, days: u32, folders: HashMap<String, u64>, candidates: Vec<Candidate> }
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
struct Candidate { grade: String, kind: String, bytes: u64, reason: String, name: String, path: String }

fn read_json<T: for<'a> Deserialize<'a>>(file: &Path, max: u64) -> Option<T> {
    let meta = fs::symlink_metadata(file).ok()?;
    if meta.file_attributes() & REPARSE != 0 || !meta.is_file() || meta.len() > max { return None; }
    serde_json::from_slice(&fs::read(file).ok()?).ok()
}
fn write_json(file: &Path, value: &impl Serialize) -> Result<(), String> {
    let tmp = file.with_extension(format!("{}.tmp", std::process::id()));
    fs::write(&tmp, serde_json::to_vec(value).map_err(|_| "SPACE_JSON")?).map_err(|_| "SPACE_WRITE")?;
    replace(&tmp, file)
}
/// 임시 파일을 바꿔 넣는다. Windows에서 막 쓴 파일을 다른 프로그램(백신, 색인)이 잠깐 쥐면 실패하므로 잠깐씩 다시 한다.
fn replace(tmp: &Path, file: &Path) -> Result<(), String> {
    for attempt in 0..20u64 {
        match fs::rename(tmp, file) {
            Ok(()) => return Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied && attempt < 19 => std::thread::sleep(Duration::from_millis(25 * (attempt + 1))),
            Err(_) => break,
        }
    }
    let _ = fs::remove_file(tmp);
    Err("SPACE_WRITE".into())
}
/// 상태 폴더 안의 우리 폴더: 실제 폴더이고 연결점이 아니어야 한다.
fn own_dir(dir: &Path) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|_| "SPACE_DIR")?;
    let meta = fs::symlink_metadata(dir).map_err(|_| "SPACE_DIR")?;
    if meta.file_attributes() & REPARSE != 0 || !meta.is_dir() { return Err("SPACE_DIR".into()); }
    Ok(())
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct State { v: u32, day: String }

/// 오늘 아직 훑지 않았는지. `today`는 현지 날짜 `YYYY-MM-DD`.
pub fn due(root: &Path, today: &str) -> bool {
    read_json::<State>(&root.join(DIR).join("state.json"), 4096).is_none_or(|s| s.day != today)
}

/// 하루 한 번의 훑기. 회차 기록의 `space` 칸을 돌려준다(걸린 시간 · CPU 시간 · 다 훑었는지 · 보고서를 썼는지).
/// 실패해도 회차의 백업 결과는 바뀌지 않는다.
pub fn daily(root: &Path, places: &Places, today: &str, budget: Duration, now: u64) -> Value {
    let clock = Instant::now();
    let cpu = process_cpu_ms();
    background(true);
    let result = scan_day(root, places, today, budget, now, clock);
    background(false);
    let mut out = match result {
        Ok(v) => v,
        Err(code) => json!({"error": code}),
    };
    out["ms"] = json!(clock.elapsed().as_millis() as u64);
    if let (Some(a), Some(b)) = (cpu, process_cpu_ms()) { out["cpuMs"] = json!(b.saturating_sub(a)); }
    out
}

fn scan_day(root: &Path, places: &Places, today: &str, budget: Duration, now: u64, clock: Instant) -> Result<Value, String> {
    let dir = root.join(DIR);
    own_dir(&dir)?;
    own_dir(&dir.join("laps"))?;
    // 먼저 오늘 날짜를 적는다. 훑다가 죽어도 같은 날 다시 하지 않는다(하루 한 번).
    write_json(&dir.join("state.json"), &State { v: FORMAT, day: today.into() })?;
    let mut lap = match read_json::<Lap>(&dir.join("lap.json"), 64 << 20).filter(|l| l.v == FORMAT) {
        // 어제 남긴 자리는 그사이 연결점으로 바뀌었을 수 있다: 뿌리 아래 마디가 하나라도 연결점이면 그 자리는 버린다.
        Some(mut l) => { l.stack.retain(|p| plain_below_root(&places.roots, Path::new(&p.path))); l }
        None => start_lap(places, now),
    };
    lap.days += 1;
    let deadline = clock + budget;
    let mut saved = Instant::now();
    let mut finished = false;
    let known = places.known();
    let mut read = 0u64;
    loop {
        if clock.elapsed() >= budget || places.max_dirs.is_some_and(|m| read >= m) { break; }
        let Some(next) = lap.stack.pop() else { finished = true; break; };
        visit(&mut lap, next, places, &known, now, deadline);
        read += 1;
        // 1분마다 남겨, 회차가 끊겨도 그날 훑은 것을 잃지 않게 한다.
        if saved.elapsed() >= Duration::from_secs(60) { write_json(&dir.join("lap.json"), &lap)?; saved = Instant::now(); }
    }
    let record = json!({"finished": finished, "lapDays": lap.days, "dirs": lap.dirs, "files": lap.files, "skipped": lap.skipped});
    if finished {
        let done = finish(&lap, places, now);
        write_json(&dir.join("laps").join(format!("{}.json", done.finished)), &done)?;
        let _ = fs::remove_file(dir.join("lap.json"));
        trim_laps(&dir.join("laps"));
    } else {
        write_json(&dir.join("lap.json"), &lap)?;
    }
    let drives = sample_drives(&dir, places, today, now)?;
    let report = report(root, &dir, &drives, if finished { None } else { Some(&lap) }, now)?;
    let mut record = record;
    record["report"] = json!(report);
    Ok(record)
}

/// 뿌리 아래의 마디가 모두 연결점이 아닌 보통 폴더인지. 어느 뿌리 아래도 아니면 거짓.
fn plain_below_root(roots: &[PathBuf], path: &Path) -> bool {
    let wanted = key(path);
    let Some(root) = roots.iter().find(|r| { let k = key(r); wanted == k || wanted.starts_with(&format!("{}\\", k.trim_end_matches('\\'))) }) else { return false };
    let Ok(rest) = path.strip_prefix(root) else { return false };
    let mut at = root.clone();
    for part in rest.components() {
        at.push(part);
        match fs::symlink_metadata(&at) { Ok(m) if m.is_dir() && m.file_attributes() & REPARSE == 0 => {}, _ => return false }
    }
    true
}

/// 이 자리를 감싼 가장 가까운 후보. 열쇠 가운데 후보를, 없으면 임시 폴더 모음을 고른다.
fn nearest(keys: &[u32], accs: &[Acc], temp: Option<u32>) -> Option<u32> {
    keys.iter().rev().copied().find(|k| accs.get(*k as usize).is_some_and(|a| a.kind.is_some())).or(temp)
}
/// 짧은(8.3) 경로를 긴 이름으로(환경 변수 TEMP는 짧은 꼴로 올 때가 있다). 바꾸지 못하면 그대로.
fn long_path(p: &Path) -> PathBuf {
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    use windows_sys::Win32::Storage::FileSystem::GetLongPathNameW;
    let wide: Vec<u16> = p.as_os_str().encode_wide().chain(Some(0)).collect();
    let mut buf = vec![0u16; 1024];
    let n = unsafe { GetLongPathNameW(wide.as_ptr(), buf.as_mut_ptr(), buf.len() as u32) } as usize;
    if n == 0 || n >= buf.len() { return p.to_path_buf(); }
    PathBuf::from(std::ffi::OsString::from_wide(&buf[..n]))
}

fn start_lap(places: &Places, now: u64) -> Lap {
    let mut stack: Vec<Pending> = places.roots.iter().map(|r| {
        let depth = if r.parent().is_none() { 0 } else { r.components().count().saturating_sub(1) as u8 };
        Pending { path: r.to_string_lossy().into_owned(), depth, keys: Vec::new(), in_git: false, inside: false, temp: false }
    }).collect();
    stack.reverse(); // 앞의 뿌리부터
    Lap { v: FORMAT, started: now, stack, ..Lap::default() }
}

/// 이름으로 알아보는 빌드 산출물과 그 잠금 파일(SPACE_DESIGN.md 4장).
fn artifact(name: &str, siblings: &HashSet<String>) -> Option<(&'static str, bool)> {
    let has = |list: &[&str]| list.iter().any(|f| siblings.contains(*f));
    match name {
        "node_modules" => Some(("node_modules", has(&["package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock"]))),
        "target" if siblings.contains("cargo.toml") => Some(("target", siblings.contains("cargo.lock"))),
        ".venv" | "venv" if has(&["pyproject.toml", "requirements.txt", "setup.py", "uv.lock", "poetry.lock", "pipfile", "pipfile.lock", "pdm.lock"]) =>
            Some(("venv", has(&["uv.lock", "poetry.lock", "pipfile.lock", "pdm.lock"]))),
        "__pycache__" => Some(("pycache", true)),
        _ => None,
    }
}

fn visit(lap: &mut Lap, p: Pending, places: &Places, known: &[(String, &'static str)], now: u64, deadline: Instant) {
    // 쌓아 둔 뒤 연결점으로 바뀐 폴더는 읽지 않는다.
    if !fs::symlink_metadata(&p.path).is_ok_and(|m| m.is_dir() && m.file_attributes() & REPARSE == 0) { lap.skipped += 1; return; }
    let Ok(read) = fs::read_dir(&p.path) else { lap.skipped += 1; return };
    let list: Vec<(String, fs::Metadata)> = read.filter_map(|e| e.ok()).filter_map(|e| Some((e.file_name().to_string_lossy().into_owned(), e.metadata().ok()?))).collect();
    let here = PathBuf::from(&p.path);
    let names: HashSet<String> = list.iter().map(|(n, _)| n.to_lowercase()).collect();
    let mut keys = p.keys.clone();
    let here_key = key(&here);
    let is_temp = places.temp.as_ref().is_some_and(|t| key(t) == here_key);
    if is_temp && lap.temp_old.is_none() {
        lap.accs.push(Acc { path: p.path.clone(), kind: Some("temp".into()), ..Acc::default() });
        lap.temp_old = Some((lap.accs.len() - 1) as u32);
    }
    let in_temp = p.temp || is_temp;
    let temp_ctx = if in_temp { lap.temp_old } else { None };
    let git_entry = list.iter().find(|(n, _)| n.eq_ignore_ascii_case(".git"));
    let in_git = p.in_git || git_entry.is_some();
    // `.git`이 파일이면 git이 등록한 작업 사본이다: 그 폴더 전체가 후보 하나다. 연결점 · 클라우드 자리표 · 큰 파일인 `.git`은
    // 읽지 않는다(카본 끝판 CB6).
    let plain_git_file = |m: &fs::Metadata| m.is_file() && m.file_attributes() & (REPARSE | OFFLINE | RECALL_ON_OPEN | RECALL_ON_DATA_ACCESS) == 0 && m.len() <= 4096;
    if !p.inside && git_entry.is_some_and(|(_, m)| plain_git_file(m)) {
        let ai = key(&here).split('\\').any(|part| part == ".claude" || part == ".codex");
        let newest = list.iter().map(|(_, m)| ms_of(m.modified())).max().unwrap_or(0);
        let git = if ai { "ai-app".to_string() } else { worktree_state(&here, deadline) };
        let parent = nearest(&keys, &lap.accs, temp_ctx);
        lap.accs.push(Acc { path: p.path.clone(), kind: Some("worktree".into()), project_newest: Some(newest), git: Some(git), parent, ..Acc::default() });
        keys.push((lap.accs.len() - 1) as u32);
    }
    // 빌드 산출물이 든 프로젝트: 그 폴더 전체에서 가장 늦게 고친 시각을 잰다(바로 아래 항목만 보면 깊은 곳의 고침을 놓친다 — 카본 끝판 CB4).
    let names_lower: Vec<String> = list.iter().filter(|(_, m)| m.is_dir() && m.file_attributes() & REPARSE == 0).map(|(n, _)| n.to_lowercase()).collect();
    let track = if !p.inside && names_lower.iter().any(|n| artifact(n, &names).is_some()) {
        lap.accs.push(Acc { path: p.path.clone(), track: true, ..Acc::default() });
        let t = (lap.accs.len() - 1) as u32; keys.push(t); Some(t)
    } else { None };
    let project_newest = list.iter().map(|(_, m)| ms_of(m.modified())).max().unwrap_or(0);
    let mut children = Vec::new();
    for (name, meta) in &list {
        let attrs = meta.file_attributes();
        if attrs & REPARSE != 0 { continue; } // 정션 · 링크 · 클라우드 자리표 폴더는 따라가지도 세지도 않는다
        let lower = name.to_lowercase();
        if meta.is_dir() {
            let child = here.join(name);
            if p.depth == 0 && SYSTEM_DIRS.contains(&lower.as_str()) {
                // 휴지통은 이 계정의 자리만 본다(따로 켠 손님만 비운다 — 1판은 보기만).
                if lower == "$recycle.bin" { if let Some(sid) = &places.sid { children.push((child.join(sid), Some(("trash", None)))); } }
                continue;
            }
            let kind: Option<(&'static str, Option<bool>)> = if p.inside { None }
                else if let Some((k, lock)) = artifact(&lower, &names) { Some((k, Some(lock))) }
                else if in_git && matches!(lower.as_str(), ".tmp" | "tmp" | "temp") { Some(("project-temp", None)) }
                else if is_temp && lower.starts_with("playwright_chromiumdev_profile-") { Some(("temp-profile", None)) }
                else { let k = key(&child); known.iter().find(|(path, _)| *path == k).map(|(_, kind)| (*kind, None)) };
            children.push((child, kind));
        } else {
            if attrs & (OFFLINE | RECALL_ON_OPEN | RECALL_ON_DATA_ACCESS) != 0 { continue; } // 이 PC에 내용이 없는 파일
            let size = meta.len();
            let modified = ms_of(meta.modified());
            // 파일은 그 자리를 감싼 모든 모음에 센다. 겹친 후보는 바퀴 끝에서 정리한다(finish).
            let old = in_temp && now.saturating_sub(modified) > 2 * DAY_MS;
            for k in &keys {
                if let Some(a) = lap.accs.get_mut(*k as usize) {
                    a.bytes += size; a.files += 1; a.newest = a.newest.max(modified);
                    if old && a.kind.is_some() { a.old_bytes += size; a.old_files += 1; }
                }
            }
            // Windows 임시 폴더: 이틀 넘게 그대로인 파일.
            if old { if let Some(a) = lap.temp_old.and_then(|i| lap.accs.get_mut(i as usize)) { a.bytes += size; a.files += 1; a.newest = a.newest.max(modified); } }
            lap.files += 1;
            let big = if size >= places.big_file && !p.inside {
                let accessed = ms_of(meta.accessed()).max(modified);
                if lower.ends_with(".vhdx") || lower.ends_with(".vhd") { Some("vm-disk") } else if now.saturating_sub(accessed) > 90 * DAY_MS { Some("big-old-file") } else { None }
            } else { None };
            if let Some(kind) = big {
                let parent = nearest(&keys, &lap.accs, temp_ctx);
                lap.accs.push(Acc { path: here.join(name).to_string_lossy().into_owned(), bytes: size, files: 1, newest: modified, kind: Some(kind.into()), parent,
                    old_bytes: if old { size } else { 0 }, old_files: u64::from(old), ..Acc::default() });
            }
        }
    }
    for (child, kind) in children.into_iter().rev() {
        let depth = p.depth.saturating_add(1);
        let mut child_keys = keys.clone();
        if depth <= DEPTH {
            lap.accs.push(Acc { path: child.to_string_lossy().into_owned(), ..Acc::default() });
            child_keys.push((lap.accs.len() - 1) as u32);
        }
        let mut inside = p.inside;
        if let Some((k, lock)) = kind {
            // 빌드 산출물은 git이 무시하는 것만 다시 만드는 것으로 본다. git 밖이면 확인할 수 없다(None).
            let git = if lock.is_some() && in_git { Some(ignored(&here, child.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(), deadline)) } else { None };
            let parent = nearest(&child_keys, &lap.accs, temp_ctx);
            lap.accs.push(Acc { path: child.to_string_lossy().into_owned(), kind: Some(k.into()), lock, project_newest: lock.map(|_| project_newest), git, parent,
                project: if lock.is_some() { track } else { None }, ..Acc::default() });
            child_keys.push((lap.accs.len() - 1) as u32);
            inside = true; // 후보 안에서는 새 후보를 만들지 않는다(겹쳐 세지 않게)
        }
        lap.dirs += 1;
        lap.stack.push(Pending { path: child.to_string_lossy().into_owned(), depth, keys: child_keys, in_git, inside, temp: in_temp });
    }
}

/// 드라이브 문자와 뿌리(`C:\\`)로 시작하는 길을 git처럼 마디마다 밟는다. 들어가는 마디마다 그 자리에서 연결점 없는 보통 폴더인지 보고,
/// `..`는 밟은 뒤에 한 칸 올라간다(뿌리 위로는 못 간다). 모두 지나면 그 길, 아니면 None(카본 다시 검수 -g A1).
fn local_plain_dir(path: &Path) -> Option<PathBuf> {
    use std::path::{Component, Prefix};
    let mut parts = path.components();
    let (Some(Component::Prefix(p)), Some(Component::RootDir)) = (parts.next(), parts.next()) else { return None };
    if !matches!(p.kind(), Prefix::Disk(_)) { return None; }
    let mut at = PathBuf::from(p.as_os_str()); at.push(Component::RootDir);
    let mut depth = 0usize;
    for c in parts {
        match c {
            Component::Normal(name) => {
                at.push(name); depth += 1;
                if !fs::symlink_metadata(&at).is_ok_and(|m| m.is_dir() && m.file_attributes() & REPARSE == 0) { return None; }
            }
            Component::ParentDir => { if depth == 0 { return None; } at.pop(); depth -= 1; }
            Component::CurDir => {}
            _ => return None,
        }
    }
    Some(at)
}
/// `git`을 낮은 우선순위로, 색인 잠금 없이(`--no-optional-locks`) 부른다. 20초와 그날 남은 시간 가운데 짧은 쪽을 넘기면 끝낸다.
/// 출력은 도는 동안 따로 읽어 비운다(출력이 파이프를 채우면 git이 멈추므로). 앞 64KB만 남긴다. 실패하면 None.
fn git(dir: &Path, args: &[&str], deadline: Instant) -> Option<(i32, String)> {
    use std::io::Read;
    use std::os::windows::process::CommandExt;
    use std::process::{Command, Stdio};
    let limit = GIT_TIMEOUT.min(deadline.saturating_duration_since(Instant::now()));
    if limit < Duration::from_secs(1) { return None; }
    let mut child = Command::new("git").arg("--no-optional-locks").arg("-C").arg(dir).args(args).env("GIT_OPTIONAL_LOCKS", "0").env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null())
        .creation_flags(0x0800_0000 | 0x0000_4000) // CREATE_NO_WINDOW | BELOW_NORMAL_PRIORITY_CLASS
        .spawn().ok()?;
    let mut stdout = child.stdout.take()?;
    let (send, got) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let (mut keep, mut buf) = (Vec::new(), [0u8; 8192]);
        loop {
            match stdout.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => { let room = 65536usize.saturating_sub(keep.len()); keep.extend_from_slice(&buf[..n.min(room)]); }
            }
        }
        let _ = send.send(String::from_utf8_lossy(&keep).into_owned());
    });
    let started = Instant::now();
    loop {
        match child.try_wait() {
            // 끝난 뒤 출력이 2초 안에 다 오지 않으면(손자 프로세스가 파이프를 쥠) 모름으로 본다 — 빈 출력을 「깨끗함」으로 읽지 않게.
            Ok(Some(status)) => return got.recv_timeout(Duration::from_secs(2)).ok().map(|out| (status.code().unwrap_or(-1), out)),
            Ok(None) if started.elapsed() < limit => std::thread::sleep(Duration::from_millis(20)),
            _ => { let _ = child.kill(); let _ = child.wait(); return None; }
        }
    }
}
/// 작업 사본의 상태 낱말: 커밋하지 않은 변경 · 원격에 없는 커밋 · 가지 없이 떠 있는 HEAD · 잠금 · 깨끗함 · 모름.
fn worktree_state(dir: &Path, deadline: Instant) -> String {
    // 잠금: `.git` 파일이 가리키는 git 폴더의 index.lock 또는 locked.
    let Some(gitdir) = fs::read_to_string(dir.join(".git")).ok().and_then(|t| t.trim().strip_prefix("gitdir:").map(|g| PathBuf::from(g.trim().replace('/', "\\")))) else { return "unknown".into() };
    let gitdir = if gitdir.is_absolute() { gitdir } else { dir.join(gitdir) };
    // git 폴더가 이 PC 드라이브의 보통 폴더가 아니면(네트워크 · 연결점이 낀 길 · 없음) git을 부르지 않는다(카본 다시 검수 A2).
    let Some(gitdir) = local_plain_dir(&gitdir) else { return "unknown".into() };
    if gitdir.join("index.lock").exists() || gitdir.join("locked").exists() { return "locked".into(); }
    match git(dir, &["status", "--porcelain=v1", "--untracked-files=normal", "--ignore-submodules=all"], deadline) {
        Some((0, out)) if !out.trim().is_empty() => return "changes".into(),
        Some((0, _)) => {}
        _ => return "unknown".into(),
    }
    match git(dir, &["symbolic-ref", "-q", "HEAD"], deadline) { Some((0, _)) => {}, Some((1, _)) => return "detached".into(), _ => return "unknown".into() }
    match git(dir, &["rev-list", "--count", "HEAD", "--not", "--remotes"], deadline) {
        Some((0, out)) if out.trim() == "0" => "clean".into(),
        Some((0, _)) => "unpushed".into(),
        _ => "unknown".into(),
    }
}
/// git이 그 이름을 무시하는지(무시하고 추적하지 않는 폴더만 다시 만드는 것으로 본다).
fn ignored(parent: &Path, name: String, deadline: Instant) -> String {
    match git(parent, &["check-ignore", "-q", &name], deadline) { Some((0, _)) => "ignored".into(), Some((1, _)) => "not-ignored".into(), _ => "unknown".into() }
}

/// 다 훑은 바퀴: 깊이 안의 큰 폴더와 등급을 매긴 후보.
fn finish(lap: &Lap, places: &Places, now: u64) -> Finished {
    let mut folders = HashMap::new();
    for a in lap.accs.iter().filter(|a| a.kind.is_none() && !a.track) { if a.bytes >= KEEP_FOLDER { folders.insert(a.path.clone(), a.bytes); } }
    // 안쪽 후보부터(만든 차례의 거꾸로) 등급을 매기고, 남는 후보만 감싼 후보에서 뺀다. 그래서 한 파일은 남는 후보 하나에만 들고,
    // 작아서 빠진 안쪽 후보의 크기는 감싼 쪽에 그대로 남는다(카본 끝판 CB3).
    let mut eff = lap.accs.clone();
    let mut candidates = Vec::new();
    for i in (0..eff.len()).rev() {
        let Some(kind) = eff[i].kind.clone() else { continue };
        let mut a = eff[i].clone();
        // 최근 판단은 깊은 곳까지: 빌드 산출물은 그 프로젝트 전체, 작업 사본은 그 안 전체에서 가장 늦게 고친 시각(카본 끝판 CB4).
        if let Some(t) = a.project.and_then(|t| lap.accs.get(t as usize)) { a.project_newest = Some(a.project_newest.unwrap_or(0).max(t.newest)); }
        if kind == "worktree" { a.project_newest = Some(a.project_newest.unwrap_or(0).max(a.newest)); }
        if a.bytes < places.candidate_min { continue; }
        let Some(c) = grade(&a, &kind, now) else { continue };
        candidates.push(c);
        // 감싼 후보 모두에서 뺀다(바로 위만 빼면 세 겹부터 겹쳐 센다 — GPT 다시 검수 -e GA1). 이 후보의 크기는 이미 남은 안쪽
        // 후보를 뺀 것이고, 그 안쪽 후보들도 스스로 모든 위에서 빠졌으므로 두 번 빼지 않는다.
        let mut up = a.parent.map(|p| p as usize).filter(|p| *p < i);
        while let Some(p) = up {
            let into_temp = eff[p].kind.as_deref() == Some("temp");
            let (bytes, files) = if into_temp { (a.old_bytes, a.old_files) } else { (a.bytes, a.files) };
            let q = &mut eff[p];
            q.bytes = q.bytes.saturating_sub(bytes); q.files = q.files.saturating_sub(files);
            q.old_bytes = q.old_bytes.saturating_sub(a.old_bytes); q.old_files = q.old_files.saturating_sub(a.old_files);
            up = q.parent.map(|x| x as usize).filter(|x| *x < p);
        }
    }
    candidates.sort_by(|a, b| rank(&a.grade).cmp(&rank(&b.grade)).then(b.bytes.cmp(&a.bytes)).then(a.path.cmp(&b.path)));
    Finished { v: FORMAT, started: lap.started, finished: now, days: lap.days, folders, candidates }
}
fn rank(grade: &str) -> u8 { match grade { "auto" => 0, "suggest" => 1, _ => 2 } }
fn last_part(path: &str) -> String { path.rsplit('\\').find(|p| !p.is_empty()).unwrap_or(path).to_string() }
fn parent_part(path: &str) -> String { let mut parts = path.rsplit('\\').filter(|p| !p.is_empty()); parts.next(); parts.next().unwrap_or("").to_string() }

/// 후보 하나의 등급과 까닭(SPACE_DESIGN.md 4장 표). 1판에서 볼 수 없는 조건이 든 갈래는 한 칸 낮춘다.
fn grade(a: &Acc, kind: &str, now: u64) -> Option<Candidate> {
    let idle = |at: u64, days: u64| now.saturating_sub(at) > days * DAY_MS;
    let (grade, reason, name) = match kind {
        "node_modules" | "target" | "venv" | "pycache" => {
            let label = match kind { "node_modules" => "Node 패키지 폴더", "target" => "Rust 빌드 폴더", "venv" => "Python 가상 환경", _ => "Python 임시 파일" };
            let name = format!("{label} · {}", parent_part(&a.path));
            if a.lock == Some(false) { ("suggest", "no-lock", name) }
            else if a.git.as_deref() == Some("not-ignored") { ("view", "tracked", name) }
            else if a.git.is_none() { ("suggest", "not-in-git", name) }
            else if a.git.as_deref() == Some("unknown") { ("suggest", "unchecked", name) }
            else if kind != "pycache" && !a.project_newest.is_some_and(|t| idle(t, 14)) { ("suggest", "recent", name) }
            else { ("auto", "rebuildable", name) }
        }
        "worktree" => {
            let name = format!("작업 사본 · {}", last_part(&a.path));
            match a.git.as_deref() {
                Some("ai-app") => ("view", "ai-app-copy", format!("AI 앱 작업 사본 · {}", last_part(&a.path))),
                Some("clean") if a.project_newest.is_some_and(|t| idle(t, 3)) => ("suggest", "worktree-clean", name),
                Some("clean") => ("view", "recent", name),
                Some("changes") => ("view", "uncommitted", name),
                Some("unpushed") => ("view", "unpushed", name),
                Some("detached") => ("view", "detached", name),
                Some("locked") => ("view", "locked", name),
                _ => ("view", "unchecked", name),
            }
        }
        "temp" => ("auto", "old-temp", "Windows 임시 파일 · 이틀 넘게 그대로인 것".to_string()),
        "temp-profile" if now.saturating_sub(a.newest) > 3 * 3_600_000 => ("auto", "old-temp-profile", format!("브라우저 자동화 임시 프로필 · {}", last_part(&a.path))),
        "temp-profile" => return None,
        "project-temp" => ("suggest", "project-temp", format!("프로젝트 임시 폴더 · {}", parent_part(&a.path))),
        "pip-cache" | "uv-cache" | "yarn-cache" | "pnpm-store" => ("auto", "cache-official", format!("다시 받을 수 있는 패키지 · {}", cache_label(kind))),
        "npm-cache" | "cargo-cache" | "nuget-cache" | "gradle-cache" => ("suggest", "cache", format!("다시 받을 수 있는 패키지 · {}", cache_label(kind))),
        "models" => ("view", "models", format!("AI 모델 · {}", last_part(&a.path))),
        "ai-history" => ("view", "ai-history", format!("AI 대화 기록 · {}", parent_part(&a.path))),
        "cloud-drive" => ("view", "cloud-drive", format!("클라우드 드라이브 · {}", last_part(&a.path))),
        "trash" => ("view", "trash", "휴지통".to_string()),
        "vm-disk" => ("view", "vm-disk", format!("가상 디스크 · {}", last_part(&a.path))),
        "big-old-file" => ("view", "big-old-file", format!("오래 열지 않은 큰 파일 · {}", last_part(&a.path))),
        _ => return None,
    };
    Some(Candidate { grade: grade.into(), kind: kind.into(), bytes: a.bytes, reason: reason.into(), name, path: a.path.clone() })
}
fn cache_label(kind: &str) -> &'static str {
    match kind { "pip-cache" => "pip", "uv-cache" => "uv", "yarn-cache" => "Yarn", "pnpm-store" => "pnpm", "npm-cache" => "npm", "cargo-cache" => "Cargo", "nuget-cache" => "NuGet", _ => "Gradle" }
}

fn trim_laps(dir: &Path) {
    let mut list: Vec<(u64, PathBuf)> = fs::read_dir(dir).into_iter().flatten().filter_map(|e| e.ok())
        .filter_map(|e| { let name = e.file_name().to_string_lossy().into_owned(); name.strip_suffix(".json")?.parse::<u64>().ok().map(|n| (n, e.path())) }).collect();
    list.sort();
    while list.len() > LAPS_KEPT { let (_, p) = list.remove(0); let _ = fs::remove_file(p); }
}
fn laps(dir: &Path) -> Vec<Finished> {
    let mut list: Vec<Finished> = fs::read_dir(dir.join("laps")).into_iter().flatten().filter_map(|e| e.ok())
        .filter(|e| e.file_name().to_string_lossy().ends_with(".json")).filter_map(|e| read_json::<Finished>(&e.path(), 32 << 20)).filter(|l| l.v == FORMAT).collect();
    list.sort_by_key(|l| l.finished);
    list
}

/// 드라이브마다 오늘의 크기와 쓴 양을 적고(지난 30일), 지금 값을 돌려준다.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct Samples { v: u32, days: std::collections::BTreeMap<String, HashMap<String, (u64, u64)>> }
fn sample_drives(dir: &Path, places: &Places, today: &str, _now: u64) -> Result<HashMap<String, (u64, u64, Option<f64>)>, String> {
    let file = dir.join("drives.json");
    let mut samples = read_json::<Samples>(&file, 1 << 20).filter(|s| s.v == FORMAT).unwrap_or(Samples { v: FORMAT, ..Samples::default() });
    let mut now_values = HashMap::new();
    for root in places.roots.iter().filter(|r| r.parent().is_none()) {
        let letter = root.to_string_lossy().chars().next().map(|c| c.to_ascii_uppercase().to_string()).unwrap_or_default();
        if let Some((size, free)) = drive_space(root) { now_values.insert(letter, (size, free)); }
    }
    samples.days.insert(today.into(), now_values.clone());
    while samples.days.len() > 30 { let first = samples.days.keys().next().cloned().unwrap_or_default(); samples.days.remove(&first); }
    write_json(&file, &samples)?;
    Ok(now_values.into_iter().map(|(d, (size, free))| { let g = growth(&samples, &d, today); (d, (size, free, g)) }).collect())
}
/// 지난 14일 안의 가장 이른 날과 오늘의 쓴 양으로 셈한 하루 증가(바이트). 하루 넘게 떨어진 두 날이 없으면 None.
fn growth(samples: &Samples, drive: &str, today: &str) -> Option<f64> {
    let day_no = |d: &str| -> Option<i64> { let y: i64 = d.get(0..4)?.parse().ok()?; let m: i64 = d.get(5..7)?.parse().ok()?; let dd: i64 = d.get(8..10)?.parse().ok()?; Some(days_from_civil(y, m, dd)) };
    let t = day_no(today)?;
    let (latest_size, latest_free) = *samples.days.get(today)?.get(drive)?;
    let used_now = latest_size.saturating_sub(latest_free) as f64;
    let (first_day, first) = samples.days.iter().filter_map(|(d, v)| Some((day_no(d)?, v.get(drive)?))).filter(|(d, _)| t - d <= 14 && t - d >= 1).min_by_key(|(d, _)| *d)?;
    let used_then = first.0.saturating_sub(first.1) as f64;
    Some((used_now - used_then) / (t - first_day) as f64)
}
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400); let yoe = y - era * 400;
    let doy = (153 * (m + if m > 2 { -3 } else { 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// 기본 시작선(GB): 드라이브 크기의 15%와 150GB 가운데 작은 쪽(SPACE_DESIGN.md 6장). 엔진의 solio.cjs와 같은 셈이다.
pub fn default_start_line(size: u64) -> u64 { ((size as f64 * 0.15).min(150.0 * (1u64 << 30) as f64) / (1u64 << 30) as f64).floor().max(1.0) as u64 }
fn start_lines(root: &Path) -> HashMap<String, u64> {
    read_json::<Value>(&root.join("space-settings.json"), 65536).and_then(|v| v["startLines"].as_object().cloned()).map(|m| m.into_iter()
        .filter(|(d, gb)| d.len() == 1 && d.chars().all(|c| c.is_ascii_uppercase()) && gb.as_u64().is_some_and(|g| g >= 1)).map(|(d, gb)| (d, gb.as_u64().unwrap_or(1))).collect()).unwrap_or_default()
}
/// 「이대로면 며칠 뒤 시작선」: 이미 아래면 0, 늘지 않으면 None.
pub fn days_to_line(free: u64, line_bytes: u64, per_day: Option<f64>) -> Option<u64> {
    if free <= line_bytes { return Some(0); }
    let g = per_day?;
    (g > 0.0).then(|| ((free - line_bytes) as f64 / g).floor() as u64)
}

/// 「지난 7일 늘어난 것」: 두 바퀴 사이에 가장 많이 는 자리 다섯. 한 자식이 늘어난 양의 80% 이상을 차지하면 그 자식으로 내려간다.
fn grew(old: &HashMap<String, u64>, new: &HashMap<String, u64>) -> Vec<(String, i64, u64)> {
    let lower: HashMap<String, &String> = new.keys().map(|k| (k.to_lowercase(), k)).collect();
    let g = |p: &str| new.get(p).copied().unwrap_or(0) as i64 - old.get(p).copied().unwrap_or(0) as i64;
    let parent_of = |p: &str| p.rsplit_once('\\').map(|(a, _)| a.to_lowercase());
    let mut children: HashMap<String, Vec<&String>> = HashMap::new();
    for k in new.keys() { if let Some(par) = parent_of(k) { if lower.contains_key(&par) { children.entry(par).or_default().push(k); } } }
    // 늘어난 폴더를 모두 본다. 한 자식이 늘어난 양의 80% 넘게를 차지하면 그 자식이 대신한다(내려간다). 위 폴더가 줄었어도
    // 그 아래에서 늘어난 폴더는 남는다(카본 끝판 CB5). 큰 것부터 다섯, 이미 고른 것의 위 · 아래 폴더는 다시 고르지 않는다.
    let mut grown: Vec<(String, i64)> = new.keys().map(|k| (k.clone(), g(k))).filter(|(_, x)| *x > 0)
        .filter(|(k, x)| !children.get(&k.to_lowercase()).is_some_and(|list| list.iter().any(|c| { let cx = g(c); cx > 0 && cx as f64 >= *x as f64 * 0.8 })))
        .collect();
    grown.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    let related = |a: &str, b: &str| { let (a, b) = (a.to_lowercase(), b.to_lowercase()); a == b || a.starts_with(&format!("{b}\\")) || b.starts_with(&format!("{a}\\")) };
    let mut picked: Vec<(String, i64, u64)> = Vec::new();
    for (k, x) in grown {
        if picked.iter().any(|(p, ..)| related(p, &k)) { continue; }
        picked.push((k.clone(), x, new.get(&k).copied().unwrap_or(0)));
        if picked.len() == 5 { break; }
    }
    picked
}

fn iso(ms: u64) -> String {
    let (secs, rem_ms) = (ms / 1000, ms % 1000);
    let (z, rem) = ((secs / 86400) as i64 + 719_468, secs % 86400);
    let era = z.div_euclid(146_097); let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1; let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!("{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{rem_ms:03}Z", rem / 3600, rem % 3600 / 60, rem % 60)
}

/// `solio/space.json`을 쓴다. 후보와 「지난 7일」은 다 훑은 바퀴에서만 낸다. 1MB · 후보 1,000개를 넘지 않는다.
fn report(root: &Path, dir: &Path, drives: &HashMap<String, (u64, u64, Option<f64>)>, scanning: Option<&Lap>, now: u64) -> Result<bool, String> {
    let all = laps(dir);
    let latest = all.last();
    let lines = start_lines(root);
    let mut drive_list: Vec<Value> = drives.iter().map(|(d, (size, free, per_day))| {
        let (line, source) = lines.get(d).map(|g| (*g, "set")).unwrap_or((default_start_line(*size), "default"));
        let line_bytes = line.saturating_mul(1 << 30);
        json!({"drive": d, "size": size, "free": free, "growthPerDay": per_day.map(|g| g.round() as i64), "startLineGb": line, "startLine": source,
            "daysToStartLine": days_to_line(*free, line_bytes, *per_day)})
    }).collect();
    drive_list.sort_by(|a, b| a["drive"].as_str().cmp(&b["drive"].as_str()));
    // 「지난 7일」: 가장 새 바퀴와, 그보다 7일 이상 앞서 끝난 바퀴 가운데 가장 새 것.
    let grew_list: Vec<Value> = latest.and_then(|l| all.iter().rev().find(|o| o.finished + 7 * DAY_MS <= l.finished).map(|o| (o, l)))
        .map(|(o, l)| grew(&o.folders, &l.folders).into_iter().map(|(path, amount, bytes)| json!({"path": path, "name": last_part(&path), "grew": amount, "bytes": bytes})).collect())
        .unwrap_or_default();
    let grew_since = latest.and_then(|l| all.iter().rev().find(|o| o.finished + 7 * DAY_MS <= l.finished)).map(|o| iso(o.finished));
    let candidates: Vec<&Candidate> = latest.map(|l| l.candidates.iter().take(CANDIDATES_MAX).collect()).unwrap_or_default();
    let id = format!("space-{now}-{:08x}", random32());
    let mut value = json!({
        "v": FORMAT, "report": id, "createdAt": iso(now),
        "lap": latest.map(|l| json!({"startedAt": iso(l.started), "finishedAt": iso(l.finished), "days": l.days})),
        "scanning": scanning.map(|l| json!({"startedAt": iso(l.started), "days": l.days})),
        "lastAccess": match last_access_off() { Some(true) => json!("off"), Some(false) => json!("on"), None => Value::Null },
        "drives": drive_list, "grewSince": grew_since, "grew": grew_list,
        "candidates": candidates.iter().enumerate().map(|(i, c)| json!({"n": i + 1, "grade": c.grade, "kind": c.kind, "bytes": c.bytes, "reason": c.reason, "name": c.name, "path": c.path})).collect::<Vec<_>>(),
    });
    // 1MB 상한: 넘으면 뒤의 후보부터 덜어 낸다.
    let mut text = serde_json::to_vec(&value).map_err(|_| "SPACE_JSON")?;
    while text.len() > REPORT_MAX {
        let Some(list) = value["candidates"].as_array_mut() else { break };
        if list.is_empty() { return Err("SPACE_REPORT_SIZE".into()); }
        let cut = (list.len() / 10).max(1);
        list.truncate(list.len() - cut);
        text = serde_json::to_vec(&value).map_err(|_| "SPACE_JSON")?;
    }
    let solio = root.join("solio");
    own_dir(&solio)?;
    let tmp = solio.join(format!("space.{}.tmp", std::process::id()));
    fs::write(&tmp, &text).map_err(|_| "SPACE_WRITE")?;
    replace(&tmp, &solio.join("space.json"))?;
    Ok(true)
}
/// 보고서 번호의 꼬리: 비밀이 아니고 겹치지만 않으면 된다(RandomState는 프로세스마다 운영체제의 난수로 씨를 받는다).
fn random32() -> u32 { use std::hash::BuildHasher; std::collections::hash_map::RandomState::new().hash_one((epoch_ms(), std::process::id())) as u32 }

/// 이 스레드를 배경 모드로(낮은 CPU · 디스크 · 메모리 우선순위) 두거나 되돌린다.
fn background(on: bool) {
    use windows_sys::Win32::System::Threading::{GetCurrentThread, SetThreadPriority, THREAD_MODE_BACKGROUND_BEGIN, THREAD_MODE_BACKGROUND_END};
    unsafe { SetThreadPriority(GetCurrentThread(), if on { THREAD_MODE_BACKGROUND_BEGIN } else { THREAD_MODE_BACKGROUND_END }); }
}
fn process_cpu_ms() -> Option<u64> {
    use windows_sys::Win32::{Foundation::FILETIME, System::Threading::{GetCurrentProcess, GetProcessTimes}};
    let zero = FILETIME { dwLowDateTime: 0, dwHighDateTime: 0 };
    let (mut a, mut b, mut k, mut u) = (zero, zero, zero, zero);
    if unsafe { GetProcessTimes(GetCurrentProcess(), &mut a, &mut b, &mut k, &mut u) } == 0 { return None; }
    let t = |f: FILETIME| ((f.dwHighDateTime as u64) << 32 | f.dwLowDateTime as u64) / 10_000;
    Some(t(k) + t(u))
}


#[cfg(test)] mod tests {
    use super::*;
    fn tree(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("swb-space-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir); fs::create_dir_all(&dir).unwrap(); dir
    }
    fn file(path: &Path, size: usize, age_days: u64) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, vec![7u8; size]).unwrap();
        let f = fs::OpenOptions::new().write(true).open(path).unwrap();
        let at = SystemTime::now() - Duration::from_secs(age_days * 86_400);
        f.set_times(fs::FileTimes::new().set_modified(at).set_accessed(at)).unwrap();
    }
    fn places(root: &Path, temp: &Path) -> Places {
        Places { roots: vec![root.to_path_buf()], temp: Some(temp.to_path_buf()), local: None, profile: None, cloud_drives: vec![], sid: None, big_file: 50_000, candidate_min: 1_000, max_dirs: Some(4) }
    }
    #[test] fn a_lap_goes_on_the_next_day_and_reports_candidates_without_following_links() {
        let base = tree("lap");
        let (data, state, temp, elsewhere) = (base.join("data"), base.join("state"), base.join("data").join("Temp"), base.join("elsewhere"));
        fs::create_dir_all(&state).unwrap();
        // An idle project with a lock file: node_modules is rebuildable once git ignores it — here it is not in git: suggest.
        file(&data.join("proj").join("package-lock.json"), 10, 30);
        for i in 0..30 { file(&data.join("proj").join("node_modules").join(format!("pkg{i}")).join("index.js"), 1_000, 30); }
        // No lock file: suggest, never rebuildable.
        file(&data.join("loose").join("node_modules").join("a.js"), 5_000, 30);
        // Windows temp: old files count, new ones do not.
        file(&temp.join("old").join("a.bin"), 3_000, 5); file(&temp.join("new.bin"), 3_000, 0);
        // A big file not opened for months.
        file(&data.join("video.mov"), 60_000, 200);
        // A git worktree (a .git file) with its own node_modules: the worktree does not also count what node_modules counts.
        file(&data.join("wt").join("package-lock.json"), 10, 30);
        fs::write(data.join("wt").join(".git"), "gitdir: C:/nowhere/.git/worktrees/wt").unwrap();
        file(&data.join("wt").join("src").join("a.txt"), 2_000, 30);
        file(&data.join("wt").join("node_modules").join("x.js"), 4_000, 30);
        // A worktree inside the temp folder: its old file is in the worktree, not also in 「old temp files」.
        fs::create_dir_all(temp.join("wt2")).unwrap();
        fs::write(temp.join("wt2").join(".git"), "gitdir: C:/nowhere/.git/worktrees/wt2").unwrap();
        file(&temp.join("wt2").join("old.txt"), 3_000, 5);
        // A browser profile in temp too small to stand alone: its old file stays in 「old temp files」.
        file(&temp.join("playwright_chromiumdev_profile-ab").join("f"), 500, 5);
        // A junction to elsewhere is neither followed nor counted.
        file(&elsewhere.join("secret.bin"), 90_000, 300);
        assert!(std::process::Command::new("cmd").arg("/c").arg("mklink").arg("/J").arg(data.join("link")).arg(&elsewhere).output().unwrap().status.success());
        let p = places(&data, &temp);
        // Four folders a day: the lap needs several days and goes on where it stopped.
        let mut days = 0;
        for day in 1..=28u32 {
            let today = format!("2026-12-{day:02}");
            assert!(due(&state, &today));
            let r = daily(&state, &p, &today, BUDGET, epoch_ms());
            assert!(r.get("error").is_none(), "{r}");
            assert!(!due(&state, &today), "once a day");
            days = day;
            if r["finished"] == true { assert_eq!(r["lapDays"], day); break; }
            let partial: Value = serde_json::from_slice(&fs::read(state.join("solio").join("space.json")).unwrap()).unwrap();
            assert!(partial["candidates"].as_array().unwrap().is_empty() && partial["scanning"]["days"] == day, "no candidates from a lap not finished");
        }
        assert!(days > 1, "the lap took more than one day");
        let report: Value = serde_json::from_slice(&fs::read(state.join("solio").join("space.json")).unwrap()).unwrap();
        let text = report.to_string();
        assert!(!text.contains("secret.bin") && !text.contains("elsewhere"), "the junction was not followed: {text}");
        let c = |kind: &str| report["candidates"].as_array().unwrap().iter().filter(|c| c["kind"] == kind).cloned().collect::<Vec<_>>();
        let nm = c("node_modules");
        assert_eq!(nm.len(), 3, "{text}");
        let wt: Vec<Value> = c("worktree").into_iter().filter(|w| w["path"].as_str().unwrap().ends_with("wt")).collect();
        let inner = nm.iter().find(|c| c["path"].as_str().unwrap().contains("wt")).unwrap();
        assert_eq!(inner["bytes"], 4_000);
        assert!(wt.len() == 1 && wt[0]["bytes"].as_u64().unwrap() < 4_000 + 2_000 && wt[0]["bytes"].as_u64().unwrap() >= 2_000, "no byte is in two candidates: {text}");
        let proj = nm.iter().find(|c| c["path"].as_str().unwrap().contains("proj")).unwrap();
        assert_eq!((proj["grade"].as_str(), proj["reason"].as_str(), proj["bytes"].as_u64()), (Some("suggest"), Some("not-in-git"), Some(30_000)));
        let loose = nm.iter().find(|c| c["path"].as_str().unwrap().contains("loose")).unwrap();
        assert_eq!((loose["grade"].as_str(), loose["reason"].as_str()), (Some("suggest"), Some("no-lock")));
        let temp_c = c("temp");
        assert_eq!((temp_c[0]["grade"].as_str(), temp_c[0]["bytes"].as_u64()), (Some("auto"), Some(3_500)), "the old temp file and the small old profile, not the worktree's file");
        assert!(c("worktree").iter().any(|w| w["path"].as_str().unwrap().ends_with("wt2") && w["bytes"].as_u64().unwrap() >= 3_000), "the worktree in temp keeps its file: {text}");
        assert_eq!(c("big-old-file")[0]["bytes"], 60_000);
        let n: Vec<u64> = report["candidates"].as_array().unwrap().iter().map(|c| c["n"].as_u64().unwrap()).collect();
        assert_eq!(n, (1..=n.len() as u64).collect::<Vec<_>>(), "numbered from 1");
        assert!(report["report"].as_str().unwrap().starts_with("space-") && report["lap"]["days"].as_u64().unwrap() > 1);
        assert!(report["scanning"].is_null() && report["grew"].as_array().unwrap().is_empty() && report["grewSince"].is_null());
        assert!(!state.join("space").join("lap.json").exists(), "a finished lap leaves no walk behind");
        let _ = fs::remove_dir_all(&base);
    }
    #[test] fn growth_goes_down_to_where_it_grew() {
        let old: HashMap<String, u64> = [(r"C:\Users", 100), (r"C:\Users\a", 90), (r"C:\Users\a\Videos", 10), (r"C:\Users\a\Docs", 80), (r"C:\Tools", 50)].iter().map(|(k, v)| (k.to_string(), *v)).collect();
        let new: HashMap<String, u64> = [(r"C:\Users", 300), (r"C:\Users\a", 290), (r"C:\Users\a\Videos", 205), (r"C:\Users\a\Docs", 85), (r"C:\Tools", 40), (r"C:\New", 70)].iter().map(|(k, v)| (k.to_string(), *v)).collect();
        let g = grew(&old, &new);
        assert_eq!(g[0], (r"C:\Users\a\Videos".to_string(), 195, 205), "most of the growth is in one child: go down to it");
        assert_eq!(g[1], (r"C:\New".to_string(), 70, 70));
        assert!(!g.iter().any(|(p, ..)| p == r"C:\Tools"), "shrunk");
        // A folder that shrank overall still shows what grew under it.
        let m = |list: &[(&str, u64)]| list.iter().map(|(k, v)| (k.to_string(), *v)).collect::<HashMap<String, u64>>();
        let old2 = m(&[(r"C:\Users", 1000), (r"C:\Users\a", 1000), (r"C:\Users\a\AppData", 100), (r"C:\Users\a\Downloads", 800), (r"C:\Users\a\Docs", 100)]);
        let new2 = m(&[(r"C:\Users", 995), (r"C:\Users\a", 995), (r"C:\Users\a\AppData", 350), (r"C:\Users\a\Downloads", 500), (r"C:\Users\a\Docs", 145)]);
        let g2: Vec<(String, i64)> = grew(&old2, &new2).into_iter().map(|(p, x, _)| (p, x)).collect();
        assert_eq!(g2, vec![(r"C:\Users\a\AppData".to_string(), 250), (r"C:\Users\a\Docs".to_string(), 45)]);
    }
    #[test] fn predictions_and_start_lines() {
        let gb = 1u64 << 30;
        assert_eq!(default_start_line(1000 * gb), 150, "15% of 1000 GB is more than 150 GB");
        assert_eq!(default_start_line(500 * gb), 75);
        assert_eq!(days_to_line(100 * gb, 150 * gb, Some(1e9)), Some(0), "already below");
        assert_eq!(days_to_line(160 * gb, 150 * gb, None), None);
        assert_eq!(days_to_line(160 * gb, 150 * gb, Some(-5.0)), None, "shrinking: no date");
        assert_eq!(days_to_line(160 * gb, 150 * gb, Some(gb as f64)), Some(10));
        let mut s = Samples { v: FORMAT, ..Samples::default() };
        s.days.insert("2026-11-01".into(), [("C".to_string(), (1000, 600))].into_iter().collect());
        s.days.insert("2026-11-10".into(), [("C".to_string(), (1000, 500))].into_iter().collect());
        s.days.insert("2026-11-15".into(), [("C".to_string(), (1000, 450))].into_iter().collect());
        assert_eq!(growth(&s, "C", "2026-11-15"), Some(150.0 / 14.0), "the earliest day within 14 days");
        assert_eq!(growth(&s, "C", "2026-11-01"), None, "one day only");
        assert_eq!(days_from_civil(1970, 1, 1), 0);
    }
    #[test] fn a_folder_that_became_a_junction_is_not_read() {
        let base = tree("swap");
        let (root, elsewhere) = (base.join("root"), base.join("elsewhere"));
        file(&root.join("a").join("b").join("x.bin"), 10, 0);
        file(&elsewhere.join("secret.bin"), 10, 0);
        assert!(std::process::Command::new("cmd").arg("/c").arg("mklink").arg("/J").arg(root.join("j")).arg(&elsewhere).output().unwrap().status.success());
        let roots = vec![root.clone()];
        assert!(plain_below_root(&roots, &root.join("a").join("b")));
        assert!(!plain_below_root(&roots, &root.join("j")) && !plain_below_root(&roots, &root.join("j").join("x")), "a junction on the way");
        assert!(!plain_below_root(&roots, &elsewhere), "not under a root");
        // A folder put on the stack that is a junction now: skipped, nothing in it counted.
        let p = places(&root, &base.join("no-temp"));
        let mut lap = Lap { v: FORMAT, ..Lap::default() };
        visit(&mut lap, Pending { path: root.join("j").to_string_lossy().into_owned(), depth: 1, keys: vec![], in_git: false, inside: false, temp: false }, &p, &[], epoch_ms(), Instant::now() + BUDGET);
        assert_eq!((lap.skipped, lap.files), (1, 0));
        // A git folder is used only on a local drive with no junction on the way.
        assert_eq!(local_plain_dir(&root.join("a").join("b").join("..")), Some(root.join("a")));
        assert_eq!(local_plain_dir(&root.join("j").join("x")), None, "a junction on the way");
        assert_eq!(local_plain_dir(Path::new(r"\\server\share\repo\.git")), None, "a network path");
        assert_eq!(local_plain_dir(&PathBuf::from("//server/share/repo/.git".replace('/', "\\"))), None, "written with slashes");
        assert_eq!(local_plain_dir(&root.join("j").join("..").join("a")), None, "a junction stepped through before going back up");
        assert_eq!(local_plain_dir(Path::new(r"C:..\x")), None, "a drive-relative path");
        // git gets no time once the day's time is used up.
        assert!(git(&base, &["--version"], Instant::now()).is_none());
        assert!(git(&base, &["--version"], Instant::now() + BUDGET).is_some_and(|(code, out)| code == 0 && out.starts_with("git version")));
        let _ = fs::remove_dir_all(&base);
    }
    #[test] fn overlaps_are_settled_when_the_lap_ends_and_recency_looks_deep() {
        let now = 100 * DAY_MS; let old = now - 30 * DAY_MS;
        let p = Places { roots: vec![], temp: None, local: None, profile: None, cloud_drives: vec![], sid: None, big_file: 50_000, candidate_min: 1_000, max_dirs: None };
        let acc = |path: &str, kind: Option<&str>, bytes: u64, newest: u64| Acc { path: path.into(), bytes, files: 1, newest, kind: kind.map(String::from), ..Acc::default() };
        let lap = Lap { v: FORMAT, accs: vec![
            acc(r"C:\t", Some("temp"), 5_000, old),
            Acc { parent: Some(0), old_bytes: 500, old_files: 1, ..acc(r"C:\t\playwright_chromiumdev_profile-a", Some("temp-profile"), 500, old) },
            Acc { parent: Some(0), old_bytes: 3_000, old_files: 1, ..acc(r"C:\t\playwright_chromiumdev_profile-b", Some("temp-profile"), 3_000, old) },
            Acc { git: Some("clean".into()), project_newest: Some(old), ..acc(r"C:\w", Some("worktree"), 9_000, now) },
            Acc { track: true, ..acc(r"C:\w", None, KEEP_FOLDER + 1, now) },
            Acc { parent: Some(3), project: Some(4), lock: Some(true), git: Some("ignored".into()), project_newest: Some(old), ..acc(r"C:\w\node_modules", Some("node_modules"), 4_000, old) },
            Acc { track: true, ..acc(r"C:\q", None, KEEP_FOLDER + 1, old) },
            Acc { project: Some(6), lock: Some(true), git: Some("ignored".into()), project_newest: Some(old), ..acc(r"C:\q\target", Some("target"), 6_000, old) },
        ], ..Lap::default() };
        let done = finish(&lap, &p, now);
        let by = |path: &str| done.candidates.iter().find(|c| c.path == path).cloned();
        assert_eq!(by(r"C:\t").unwrap().bytes, 2_000, "the kept profile leaves temp; the small one stays in it");
        assert!(by(r"C:\t\playwright_chromiumdev_profile-a").is_none());
        assert_eq!(by(r"C:\w").unwrap().bytes, 5_000, "node_modules is its own candidate");
        assert_eq!(by(r"C:\w").unwrap().reason, "recent", "a file changed today deep inside the worktree");
        assert_eq!(by(r"C:\w\node_modules").unwrap().reason, "recent", "the project was touched today deep inside");
        assert_eq!(by(r"C:\q\target").unwrap().reason, "rebuildable", "an idle project");
        assert!(done.folders.is_empty(), "trackers are not folders");
        // Three deep: temp ⊃ worktree ⊃ node_modules, every file old. Each byte is in one candidate.
        let three = Lap { v: FORMAT, accs: vec![
            acc(r"C:\t", Some("temp"), 500_000, old),
            Acc { parent: Some(0), old_bytes: 400_000, old_files: 4, git: Some("changes".into()), ..acc(r"C:\t\w", Some("worktree"), 400_000, old) },
            Acc { parent: Some(1), old_bytes: 300_000, old_files: 3, lock: Some(false), ..acc(r"C:\t\w\node_modules", Some("node_modules"), 300_000, old) },
        ], ..Lap::default() };
        let done3 = finish(&three, &p, now);
        let sizes: Vec<(String, u64)> = done3.candidates.iter().map(|c| (c.path.clone(), c.bytes)).collect();
        for (path, bytes) in [(r"C:\t", 100_000), (r"C:\t\w", 100_000), (r"C:\t\w\node_modules", 300_000)] {
            assert!(sizes.contains(&(path.to_string(), bytes)), "{path} {bytes}: {sizes:?}");
        }
        assert_eq!(long_path(Path::new(r"C:\Windows")), PathBuf::from(r"C:\Windows"));
    }
    #[test] fn grades_follow_the_table() {
        let now = 100 * DAY_MS;
        let a = |kind: &str, lock: Option<bool>, git: Option<&str>, idle_days: u64| Acc { path: r"C:\p\x".into(), bytes: 5, kind: Some(kind.into()), lock, git: git.map(String::from), project_newest: Some(now - idle_days * DAY_MS), ..Acc::default() };
        let g = |acc: Acc| { let c = grade(&acc, acc.kind.clone().unwrap().as_str(), now).unwrap(); (c.grade, c.reason) };
        assert_eq!(g(a("node_modules", Some(true), Some("ignored"), 20)), ("auto".into(), "rebuildable".into()));
        assert_eq!(g(a("node_modules", Some(true), Some("ignored"), 3)), ("suggest".into(), "recent".into()));
        assert_eq!(g(a("node_modules", Some(true), Some("not-ignored"), 20)), ("view".into(), "tracked".into()));
        assert_eq!(g(a("target", Some(false), Some("ignored"), 20)), ("suggest".into(), "no-lock".into()));
        assert_eq!(g(a("worktree", None, Some("clean"), 5)), ("suggest".into(), "worktree-clean".into()), "never auto in the first version");
        assert_eq!(g(a("worktree", None, Some("changes"), 50)), ("view".into(), "uncommitted".into()));
        assert_eq!(g(a("worktree", None, Some("ai-app"), 50)), ("view".into(), "ai-app-copy".into()));
        assert_eq!(g(a("npm-cache", None, None, 0)), ("suggest".into(), "cache".into()));
        assert_eq!(g(a("pip-cache", None, None, 0)), ("auto".into(), "cache-official".into()));
    }
    #[test] fn the_report_keeps_to_its_limits() {
        let base = tree("cap");
        let dir = base.join(DIR); fs::create_dir_all(dir.join("laps")).unwrap();
        let many: Vec<Candidate> = (0..1500).map(|i| Candidate { grade: "view".into(), kind: "big-old-file".into(), bytes: 1, reason: "big-old-file".into(), name: "x".repeat(400), path: format!(r"C:\{}\{i}", "y".repeat(400)) }).collect();
        write_json(&dir.join("laps").join("5.json"), &Finished { v: FORMAT, started: 1, finished: 5, days: 1, folders: HashMap::new(), candidates: many }).unwrap();
        assert!(report(&base, &dir, &HashMap::new(), None, 10).unwrap());
        let bytes = fs::read(base.join("solio").join("space.json")).unwrap();
        let v: Value = serde_json::from_slice(&bytes).unwrap();
        assert!(bytes.len() <= REPORT_MAX && v["candidates"].as_array().unwrap().len() <= CANDIDATES_MAX && !v["candidates"].as_array().unwrap().is_empty());
        assert!(v["report"].as_str().is_some_and(|id| id.starts_with("space-10-")) && v["createdAt"].is_string());
        let _ = fs::remove_dir_all(&base);
    }
}
