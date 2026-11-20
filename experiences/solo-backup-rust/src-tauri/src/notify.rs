//! Windows notifications (STAGE1_DESIGN.md 4.2 「알림」 · 2.2): a problem and one thing to do,
//! the same problem at most once a day, a once-only notice once ever (`notify.json`), and the
//! record of a problem cleared once a run finds it resolved. A click opens
//! `synk-workbackup:open?topic=<word>`; the window app takes only an exact address from
//! TOPICS, and no topic is a screen that acts on being opened.
use serde_json::{json, Map, Value};
use std::{fs, path::Path};

/// Set on the Start menu shortcut by the installer (4.2 「컴퓨터 전체 설치」).
pub const AUMID: &str = "im.synk.workbackup";
pub const SCHEME: &str = "synk-workbackup";
pub const LEDGER: &str = "notify.json";
/// The screens a notification may open (2.2). 「끊기」 · 「되돌리기」 stay a press away on the screen. `move` is the 「새 PC로
/// 옮겨 오기」 screen SYNK 솔리오 opens (4.13) — opening it only shows it, nothing starts until the person presses on.
pub const TOPICS: [&str; 9] = ["status", "folders", "changes", "devices", "restore", "space", "signin", "update", "move"];
/// Problems shown once ever rather than once a day.
const ONCE: [&str; 1] = ["first-backup"];
/// Problems shown at most once a week rather than once a day.
const WEEKLY: [&str; 1] = ["update-admin"];
const PROBLEMS: [&str; 6] = ["first-backup", "stale", "partial", "missing", "update", "update-admin"];
/// 「사흘 넘게」 (2.2).
pub const STALE_MS: u64 = 72 * 3_600_000;

pub fn open_url(topic: &str) -> String { format!("{SCHEME}:open?topic={topic}") }
/// The topic of an argument that is exactly one of the open addresses.
pub fn topic_of(arg: &str) -> Option<&'static str> { TOPICS.iter().copied().find(|topic| arg == open_url(topic)) }

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Notice { pub problem: &'static str, pub topic: &'static str, pub title: &'static str, pub body: &'static str, pub action: Option<&'static str> }

pub fn first_backup() -> Notice {
    Notice { problem: "first-backup", topic: "status", title: "첫 백업이 끝났습니다", body: "이제 매시간 저절로 지킵니다.", action: None }
}
/// No backup for three days while the PC is on. `cause` is what this run waited on, when it knows.
/// 「몇 파일만 못 지킴」 (2.2). No promise that an earlier backup holds those files — one made since the last complete
/// backup is in none (GPT workbackup-partial GA2); closing the program is the one thing to do.
pub fn partial() -> Notice {
    Notice { problem: "partial", topic: "status", title: "몇 파일을 백업하지 못했습니다", body: "다른 프로그램이 쓰는 중인 파일은 이번 백업에 담기지 않았습니다. 그 프로그램을 닫으면 다음 백업에 담깁니다.", action: None }
}
/// 「폴더를 찾을 수 없음」 (4.2 「사라진 원본 폴더」): the folders that are there go on being backed up and the
/// backups that hold the missing one are kept. True also when none could be found (the run then failed).
pub fn missing() -> Notice {
    Notice { problem: "missing", topic: "folders", title: "백업할 폴더를 찾을 수 없습니다", body: "외장 드라이브라면 다시 연결해 주세요. 찾을 수 있는 폴더는 계속 백업하고, 그 폴더가 든 이전 백업은 지우지 않습니다.", action: Some("확인하기") }
}
/// A clock behind the last backup cannot count three days, so that one is told as it is.
pub fn stale(cause: &str) -> Notice {
    let (title, body) = match cause {
        "metered" => ("사흘 넘게 백업하지 못했습니다", "데이터 요금제 회선이라 클라우드 백업을 쉬고 있습니다. 다른 회선에 연결되면 이어집니다."),
        // 쉬는 회선(4.14): the person chose to rest on this Wi-Fi.
        "network" => ("사흘 넘게 백업하지 못했습니다", "쉬도록 고른 Wi-Fi에 연결되어 있어 클라우드 백업을 쉬고 있습니다. 다른 회선에 연결되면 이어집니다."),
        "battery" => ("사흘 넘게 백업하지 못했습니다", "배터리로 쓰는 동안 클라우드 백업을 쉬고 있습니다. 전원을 연결하면 이어집니다."),
        "clock" => ("PC 시계가 맞지 않아 백업을 멈췄습니다", "시계를 맞추면 이어집니다. 시계를 확인해 주세요."),
        _ => ("사흘 넘게 백업하지 못했습니다", "무엇이 막혔는지 확인해 주세요."),
    };
    Notice { problem: "stale", topic: "status", title, body, action: Some("확인하기") }
}

/// 「업데이트 준비됨」 (2.2 · 4.10): a newer signed version is announced. A click asks once and installs it.
pub fn update_ready() -> Notice {
    Notice { problem: "update", topic: "update", title: "업무 백업 새 판이 나왔습니다", body: "설치할 때 관리자 확인이 한 번 뜨고, 설치하는 동안 자동 백업이 잠시 멈춥니다.", action: Some("설치") }
}
/// The same for an account that cannot approve the administrator prompt itself: once a week, ask the administrator. A
/// click still offers the install, where the administrator types their own password (GPT GA2: the text says so).
pub fn update_ask_admin() -> Notice {
    Notice { problem: "update-admin", topic: "update", title: "업무 백업 새 판이 나왔습니다", body: "설치에는 관리자 계정의 비밀번호가 필요합니다. 관리자에게 부탁해 이 알림을 눌러 설치해 주세요.", action: None }
}

/// Days since 1970-01-01 of a `YYYY-MM-DD` date (the civil calendar), or none for anything else.
fn day_number(date: &str) -> Option<i64> {
    let b = date.as_bytes();
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-' { return None; }
    let num = |s: &str| if s.bytes().all(|c| c.is_ascii_digit()) { s.parse::<i64>().ok() } else { None };
    let (y, m, d) = (num(&date[0..4])?, num(&date[5..7])?, num(&date[8..10])?);
    if !(1..=12).contains(&m) || !(1..=31).contains(&d) { return None; }
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d - 1;
    Some(era * 146_097 + yoe * 365 + yoe / 4 - yoe / 100 + doy - 719_468)
}
/// A weekly problem shown on `last` is done for the seven days from then. A clock set back before it shows it again,
/// as a daily one would.
fn shown_this_week(last: &str, today: &str) -> bool {
    matches!((day_number(last), day_number(today)), (Some(a), Some(b)) if (0..7).contains(&(b - a)))
}

fn escape(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&apos;")
}
/// A click on the notice or its one button opens the topic's screen.
pub fn toast_xml(notice: &Notice) -> String {
    let url = escape(&open_url(notice.topic));
    let action = notice.action.map(|label| format!(r#"<actions><action content="{}" activationType="protocol" arguments="{url}"/></actions>"#, escape(label))).unwrap_or_default();
    format!(r#"<toast launch="{url}" activationType="protocol"><visual><binding template="ToastGeneric"><text>{}</text><text>{}</text></binding></visual>{action}</toast>"#,
        escape(notice.title), escape(notice.body))
}

/// Shows the notice in the signed-in person's session. The tag replaces an earlier notice of the same problem.
pub fn show(notice: &Notice) -> Result<(), String> {
    use windows::{core::HSTRING, Data::Xml::Dom::XmlDocument, UI::Notifications::{ToastNotification, ToastNotificationManager}};
    use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
    // Already initialised in another mode is fine: WinRT activation works in either.
    let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
    let document = XmlDocument::new().map_err(|_| "NOTIFY_XML")?;
    document.LoadXml(&HSTRING::from(toast_xml(notice))).map_err(|_| "NOTIFY_XML")?;
    let toast = ToastNotification::CreateToastNotification(&document).map_err(|_| "NOTIFY_TOAST")?;
    toast.SetTag(&HSTRING::from(notice.problem)).map_err(|_| "NOTIFY_TOAST")?;
    toast.SetGroup(&HSTRING::from("workbackup")).map_err(|_| "NOTIFY_TOAST")?;
    ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(AUMID)).and_then(|notifier| notifier.Show(&toast)).map_err(|_| "NOTIFY_SHOW".into())
}

/// What to show now and the ledger to keep. A problem this run `judged` and did not find is
/// resolved and its record goes; one it could not judge keeps its record. Unknown entries are dropped.
pub fn plan(ledger: &Value, found: &[Notice], judged: &[&str], today: &str) -> (Vec<Notice>, Value) {
    let mut days = Map::new();
    if let Some(all) = ledger["days"].as_object() {
        for (problem, day) in all {
            let resolved = judged.contains(&problem.as_str()) && !found.iter().any(|n| n.problem == problem);
            if PROBLEMS.contains(&problem.as_str()) && !ONCE.contains(&problem.as_str()) && day.as_str().is_some_and(|d| d.len() == 10) && !resolved { days.insert(problem.clone(), day.clone()); }
        }
    }
    let mut once: Vec<Value> = Vec::new();
    for item in ledger["once"].as_array().into_iter().flatten() { if item.as_str().is_some_and(|p| ONCE.contains(&p)) && !once.contains(item) { once.push(item.clone()); } }
    let mut show: Vec<Notice> = Vec::new();
    for notice in found {
        let last = days.get(notice.problem).and_then(Value::as_str);
        let done = if ONCE.contains(&notice.problem) { once.iter().any(|p| p == notice.problem) }
            else if WEEKLY.contains(&notice.problem) { last.is_some_and(|day| shown_this_week(day, today)) }
            else { last == Some(today) };
        if !done && !show.iter().any(|n| n.problem == notice.problem) { show.push(notice.clone()); }
    }
    (show, json!({"v": 1, "days": days, "once": once}))
}
/// Marks a problem as shown today (or for good, once-only).
pub fn mark(ledger: &mut Value, problem: &str, today: &str) {
    if ONCE.contains(&problem) {
        if let Some(once) = ledger["once"].as_array_mut() { if !once.iter().any(|p| p == problem) { once.push(json!(problem)); } }
    } else if let Some(days) = ledger["days"].as_object_mut() { days.insert(problem.into(), json!(today)); }
}

pub fn read(root: &Path) -> Value {
    fs::read(root.join(LEDGER)).ok().filter(|bytes| bytes.len() <= 16_384).and_then(|bytes| serde_json::from_slice(&bytes).ok()).unwrap_or(Value::Null)
}
/// Replaces notify.json in one step (write a sibling, then rename over it).
pub fn write(root: &Path, ledger: &Value) -> Result<(), String> {
    let tmp = root.join(format!("notify.{}.tmp", std::process::id()));
    fs::write(&tmp, serde_json::to_vec(ledger).map_err(|_| "NOTIFY_JSON")?).map_err(|_| "NOTIFY_WRITE")?;
    fs::rename(&tmp, root.join(LEDGER)).map_err(|_| { let _ = fs::remove_file(&tmp); "NOTIFY_WRITE".into() })
}

/// Reads the ledger, shows what is due, marks what was shown and writes the ledger back, all under the
/// ledger's lock: the window app and a run never write over each other's marks (GPT workbackup-notify GB1).
/// Returns one record per notice tried: its problem and `shown`, or the error code.
pub fn deliver(root: &Path, found: &[Notice], judged: &[&str], today: &str, show: impl Fn(&Notice) -> Result<(), String>) -> Vec<Value> {
    deliver_waiting(root, found, judged, || today.to_string(), show, 100)
}
/// The same, with today's date read when it is used: for what is due once the ledger's lock is held, and for each mark
/// right after its notice was shown — one shown past midnight is marked on the day it showed (GPT update-notice GA6 · -c GA5).
pub fn deliver_now(root: &Path, found: &[Notice], judged: &[&str], today: impl Fn() -> String, show: impl Fn(&Notice) -> Result<(), String>) -> Vec<Value> {
    deliver_waiting(root, found, judged, today, show, 100)
}
/// Waits up to `tries` × 50 ms for the lock; held longer, nothing is shown and the next run tries again.
fn deliver_waiting(root: &Path, found: &[Notice], judged: &[&str], today: impl Fn() -> String, show: impl Fn(&Notice) -> Result<(), String>, tries: u32) -> Vec<Value> {
    let mut held = None;
    for attempt in 0..tries {
        match crate::platform::try_lock(root, crate::platform::NOTIFY_LOCK) {
            Ok(Some(lock)) => { held = Some(lock); break; }
            Ok(None) if attempt + 1 < tries => std::thread::sleep(std::time::Duration::from_millis(50)),
            Ok(None) => {}
            Err(code) => return vec![json!({"ledger": code})],
        }
    }
    let Some(_lock) = held else { return vec![json!({"ledger": "NOTIFY_BUSY"})] };
    let before = read(root);
    let (due, mut ledger) = plan(&before, found, judged, &today());
    let mut records = Vec::new();
    for notice in &due {
        match show(notice) {
            Ok(()) => { mark(&mut ledger, notice.problem, &today()); records.push(json!({"problem": notice.problem, "shown": true})); }
            Err(code) => records.push(json!({"problem": notice.problem, "shown": false, "error": code})),
        }
    }
    // Unchanged, the file is left alone: an hourly run does not rewrite it for nothing.
    if ledger != before { if let Err(code) = write(root, &ledger) { records.push(json!({"ledger": code})); } }
    records
}

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn the_update_notice_for_a_standard_account_comes_once_a_week() {
        assert_eq!(day_number("1970-01-01"), Some(0));
        assert_eq!(day_number("2026-03-01").zip(day_number("2026-02-28")).map(|(a, b)| a - b), Some(1));
        assert_eq!(day_number("2024-03-01").zip(day_number("2024-02-28")).map(|(a, b)| a - b), Some(2));
        assert_eq!(day_number("2027-01-01").zip(day_number("2026-12-31")).map(|(a, b)| a - b), Some(1));
        for bad in ["2026-13-01", "2026-1-01", "20261120", "2026-11-2x", ""] { assert_eq!(day_number(bad), None, "{bad}"); }
        let ask = [update_ask_admin()];
        let (show, ledger) = plan(&Value::Null, &ask, &["update", "update-admin"], "2026-11-20");
        assert_eq!(show.len(), 1);
        let mut ledger = ledger; mark(&mut ledger, "update-admin", "2026-11-20");
        for day in ["2026-11-20", "2026-11-23", "2026-11-26"] { assert!(plan(&ledger, &ask, &["update-admin"], day).0.is_empty(), "{day}"); }
        for day in ["2026-11-27", "2026-12-20", "2026-11-19"] { assert_eq!(plan(&ledger, &ask, &["update-admin"], day).0.len(), 1, "{day}"); }
        // The record outlasts the other problems' passes, and an administrator's notice is daily.
        let (_, kept) = plan(&ledger, &[], &["partial", "missing", "stale"], "2026-11-21");
        assert_eq!(kept["days"]["update-admin"], "2026-11-20");
        let ready = [update_ready()];
        let mut daily = plan(&Value::Null, &ready, &["update"], "2026-11-20").1; mark(&mut daily, "update", "2026-11-20");
        assert!(plan(&daily, &ready, &["update"], "2026-11-20").0.is_empty());
        assert_eq!(plan(&daily, &ready, &["update"], "2026-11-21").0.len(), 1);
        // Nothing newer: resolved, and its record goes.
        assert!(plan(&daily, &[], &["update", "update-admin"], "2026-11-21").1["days"].get("update").is_none());
        for notice in [update_ready(), update_ask_admin()] { assert_eq!(topic_of(&open_url(notice.topic)), Some("update")); }
    }
    #[test] fn only_exact_open_addresses_name_a_topic() {
        for topic in TOPICS { assert_eq!(topic_of(&open_url(topic)), Some(topic)); }
        for bad in ["synk-workbackup:open?topic=STATUS", "SYNK-WORKBACKUP:open?topic=status", "synk-workbackup:open?topic=status&x=1",
                    "synk-workbackup:open?topic=status ", " synk-workbackup:open?topic=status", "synk-workbackup:open?topic=st%61tus",
                    "synk-workbackup://open?topic=status", "synk-workbackup:open?topic=", "synk-workbackup:open?topic=disconnect",
                    "synk-workbackup:run?topic=status", "synk-workbackup:open?topic=status#x", "--background", ""] {
            assert_eq!(topic_of(bad), None, "{bad}");
        }
    }
    #[test] fn the_toast_carries_escaped_text_and_opens_its_topic() {
        let notice = Notice { problem: "stale", topic: "status", title: "a<b>&\"c'", body: "x & y", action: Some("확인<") };
        let xml = toast_xml(&notice);
        assert!(xml.starts_with(r#"<toast launch="synk-workbackup:open?topic=status" activationType="protocol">"#), "{xml}");
        assert!(xml.contains("<text>a&lt;b&gt;&amp;&quot;c&apos;</text><text>x &amp; y</text>"));
        assert!(xml.contains(r#"<action content="확인&lt;" activationType="protocol" arguments="synk-workbackup:open?topic=status"/>"#));
        assert!(!toast_xml(&first_backup()).contains("<actions>"), "the first-backup notice has nothing to do");
        assert!(!toast_xml(&partial()).contains("<actions>"), "nor has the partial one");
        for cause in ["metered", "battery", "clock", "", "failed"] { let n = stale(cause); assert_eq!((n.problem, n.topic, n.action), ("stale", "status", Some("확인하기"))); }
    }
    #[test] fn the_same_problem_once_a_day_and_once_only_notices_once_ever() {
        let (day1, day2) = ("2026-11-13", "2026-11-14");
        let (show, mut ledger) = plan(&Value::Null, &[stale(""), first_backup()], &["stale"], day1);
        assert_eq!(show.iter().map(|n| n.problem).collect::<Vec<_>>(), ["stale", "first-backup"]);
        mark(&mut ledger, "stale", day1); mark(&mut ledger, "first-backup", day1);
        let (show, ledger) = plan(&ledger, &[stale("metered"), first_backup()], &["stale"], day1);
        assert!(show.is_empty(), "the same day, and the first backup is for good");
        let (show, mut ledger) = plan(&ledger, &[stale("")], &["stale"], day2);
        assert_eq!(show, [stale("")], "the next day again");
        mark(&mut ledger, "stale", day2);
        // A run that could not judge the problem keeps its record; one that judged it resolved clears it.
        let (_, kept) = plan(&ledger, &[], &[], day2);
        assert_eq!(kept["days"]["stale"], day2);
        let (_, cleared) = plan(&ledger, &[], &["stale"], day2);
        assert!(cleared["days"].get("stale").is_none());
        let (show, _) = plan(&cleared, &[stale("")], &["stale"], day2);
        assert_eq!(show.len(), 1, "back the same day once it had been resolved");
        assert_eq!(cleared["once"], json!(["first-backup"]));
    }
    #[test] fn a_damaged_or_foreign_ledger_is_not_trusted() {
        let ledger = json!({"days": {"stale": "2026-11-13T00", "other": "2026-11-13", "first-backup": "2026-11-13"}, "once": ["stale", 3, "first-backup", "first-backup"], "x": 1});
        let (show, kept) = plan(&ledger, &[stale("")], &[], "2026-11-13");
        assert_eq!(show.len(), 1, "a malformed day is no record");
        assert_eq!(kept, json!({"v": 1, "days": {}, "once": ["first-backup"]}));
        for bad in [json!([]), json!("x"), json!({"days": [], "once": {}})] { let (show, kept) = plan(&bad, &[first_backup()], &[], "2026-11-13"); assert_eq!(show.len(), 1); assert_eq!(kept["once"], json!([])); }
    }
    #[test] fn deliver_marks_only_what_was_shown() {
        let root = std::env::temp_dir().join(format!("swb-notify-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let failed = deliver(&root, &[stale(""), first_backup()], &["stale"], "2026-11-13", |n| if n.problem == "stale" { Err("NOTIFY_SHOW".into()) } else { Ok(()) });
        assert_eq!(failed, [json!({"problem": "stale", "shown": false, "error": "NOTIFY_SHOW"}), json!({"problem": "first-backup", "shown": true})]);
        let again = deliver(&root, &[stale(""), first_backup()], &["stale"], "2026-11-13", |_| Ok(()));
        assert_eq!(again, [json!({"problem": "stale", "shown": true})], "a notice that failed is tried again; the first backup is not");
        assert_eq!(read(&root), json!({"v": 1, "days": {"stale": "2026-11-13"}, "once": ["first-backup"]}));
        assert!(fs::read_dir(&root).unwrap().all(|e| !e.unwrap().file_name().to_string_lossy().ends_with(".tmp")));
        fs::remove_dir_all(&root).unwrap();
    }
    #[test] fn a_notice_shown_past_midnight_is_marked_on_the_day_it_showed() {
        let root = std::env::temp_dir().join(format!("swb-notify-midnight-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root); fs::create_dir_all(&root).unwrap();
        let reads = std::cell::Cell::new(0);
        let day = || { reads.set(reads.get() + 1); if reads.get() == 1 { "2026-11-20".to_string() } else { "2026-11-21".to_string() } };
        let records = deliver_now(&root, &[update_ready()], &["update"], day, |_| Ok(()));
        assert_eq!(records, vec![json!({"problem": "update", "shown": true})]);
        assert_eq!(read(&root)["days"]["update"], "2026-11-21");
        assert!(plan(&read(&root), &[update_ready()], &["update"], "2026-11-21").0.is_empty(), "not again on the day it showed");
        fs::remove_dir_all(&root).unwrap();
    }
    #[test] fn one_ledger_update_at_a_time() {
        let root = std::env::temp_dir().join(format!("swb-notify-lock-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let other = crate::platform::try_lock(&root, crate::platform::NOTIFY_LOCK).unwrap().expect("the lock");
        let shown = std::cell::Cell::new(0);
        let busy = deliver_waiting(&root, &[first_backup()], &[], || "2026-11-13".into(), |_| { shown.set(shown.get() + 1); Ok(()) }, 3);
        assert_eq!((busy, shown.get()), (vec![json!({"ledger": "NOTIFY_BUSY"})], 0), "nothing shown or written while another holds it");
        assert_eq!(read(&root), Value::Null);
        drop(other);
        assert_eq!(deliver(&root, &[first_backup()], &[], "2026-11-13", |_| Ok(())), [json!({"problem": "first-backup", "shown": true})]);
        fs::remove_dir_all(&root).unwrap();
    }
}
