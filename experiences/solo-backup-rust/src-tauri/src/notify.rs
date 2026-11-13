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
/// The screens a notification may open (2.2). 「끊기」 · 「되돌리기」 stay a press away on the screen.
pub const TOPICS: [&str; 8] = ["status", "folders", "changes", "devices", "restore", "space", "signin", "update"];
/// Problems shown once ever rather than once a day.
const ONCE: [&str; 1] = ["first-backup"];
const PROBLEMS: [&str; 2] = ["first-backup", "stale"];
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
/// A clock behind the last backup cannot count three days, so that one is told as it is.
pub fn stale(cause: &str) -> Notice {
    let (title, body) = match cause {
        "metered" => ("사흘 넘게 백업하지 못했습니다", "데이터 요금제 회선이라 클라우드 백업을 쉬고 있습니다. 다른 회선에 연결되면 이어집니다."),
        "battery" => ("사흘 넘게 백업하지 못했습니다", "배터리로 쓰는 동안 클라우드 백업을 쉬고 있습니다. 전원을 연결하면 이어집니다."),
        "clock" => ("PC 시계가 맞지 않아 백업을 멈췄습니다", "시계를 맞추면 이어집니다. 시계를 확인해 주세요."),
        _ => ("사흘 넘게 백업하지 못했습니다", "무엇이 막혔는지 확인해 주세요."),
    };
    Notice { problem: "stale", topic: "status", title, body, action: Some("확인하기") }
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
        let done = if ONCE.contains(&notice.problem) { once.iter().any(|p| p == notice.problem) } else { days.get(notice.problem).and_then(Value::as_str) == Some(today) };
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
    deliver_waiting(root, found, judged, today, show, 100)
}
/// Waits up to `tries` × 50 ms for the lock; held longer, nothing is shown and the next run tries again.
fn deliver_waiting(root: &Path, found: &[Notice], judged: &[&str], today: &str, show: impl Fn(&Notice) -> Result<(), String>, tries: u32) -> Vec<Value> {
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
    let (due, mut ledger) = plan(&before, found, judged, today);
    let mut records = Vec::new();
    for notice in &due {
        match show(notice) {
            Ok(()) => { mark(&mut ledger, notice.problem, today); records.push(json!({"problem": notice.problem, "shown": true})); }
            Err(code) => records.push(json!({"problem": notice.problem, "shown": false, "error": code})),
        }
    }
    // Unchanged, the file is left alone: an hourly run does not rewrite it for nothing.
    if ledger != before { if let Err(code) = write(root, &ledger) { records.push(json!({"ledger": code})); } }
    records
}

#[cfg(test)] mod tests {
    use super::*;
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
    #[test] fn one_ledger_update_at_a_time() {
        let root = std::env::temp_dir().join(format!("swb-notify-lock-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let other = crate::platform::try_lock(&root, crate::platform::NOTIFY_LOCK).unwrap().expect("the lock");
        let shown = std::cell::Cell::new(0);
        let busy = deliver_waiting(&root, &[first_backup()], &[], "2026-11-13", |_| { shown.set(shown.get() + 1); Ok(()) }, 3);
        assert_eq!((busy, shown.get()), (vec![json!({"ledger": "NOTIFY_BUSY"})], 0), "nothing shown or written while another holds it");
        assert_eq!(read(&root), Value::Null);
        drop(other);
        assert_eq!(deliver(&root, &[first_backup()], &[], "2026-11-13", |_| Ok(())), [json!({"problem": "first-backup", "shown": true})]);
        fs::remove_dir_all(&root).unwrap();
    }
}
