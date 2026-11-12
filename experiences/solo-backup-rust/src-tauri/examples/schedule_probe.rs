//! T2 probe (STAGE1_DESIGN.md 4.2 · 8): register the four run tasks for the user who
//! runs this probe, read them back, remove them, and write what happened as JSON.
//! Used by the CI workflow `workbackup-schedule-t2.yml` as an administrator and as a
//! standard user, with and without the product folder. Never shipped (an example).
//!   schedule_probe <absolute run exe path> <out.json>
use backup_native::schedule;
use serde_json::json;
use std::path::PathBuf;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    // --keep leaves the tasks registered (to check that the next registration moves them).
    let keep = args.len() == 3 && args[2] == "--keep";
    if args.len() != 2 && !keep { eprintln!("usage: schedule_probe <run exe> <out.json> [--keep]"); std::process::exit(64); }
    let (exe, out) = (PathBuf::from(&args[0]), PathBuf::from(&args[1]));
    let user = std::env::var("USERNAME").unwrap_or_default();
    let sid = schedule::current_sid();
    // Who really runs this probe comes from the token, not from USERNAME (a process
    // started with other credentials can inherit the parent's environment).
    let mut result = json!({ "envUser": schedule::user_label(&user), "sid": sid.as_ref().ok(), "admin": is_admin(), "elevated": is_elevated() });
    if let Ok(sid) = &sid {
        let placed = schedule::register(&exe, &user, sid, &schedule::local_now());
        result["register"] = match &placed { Ok(p) => json!({ "ok": true, "folder": p.folder, "tasks": p.tasks }), Err(e) => json!({ "ok": false, "error": e }) };
        result["registeredAfter"] = json!(schedule::registered(&exe, &user, sid).map_err(|e| e.to_string()));
        result["locations"] = json!(schedule::locations(&user, sid).map_err(|e| e.to_string()));
        result["principal"] = json!(schedule::principal_of(&user, sid));
        if !keep {
            result["remove"] = json!(schedule::remove(&user, sid).map(|_| true).map_err(|e| e.to_string()));
            result["registeredAfterRemove"] = json!(schedule::registered(&exe, &user, sid).map_err(|e| e.to_string()));
        }
    }
    std::fs::write(&out, serde_json::to_vec_pretty(&result).unwrap()).expect("write result");
    println!("{result}");
}

/// Member of BUILTIN\Administrators in the current token (false for a filtered token).
fn is_admin() -> bool {
    use windows_sys::Win32::Security::{CheckTokenMembership, CreateWellKnownSid, WinBuiltinAdministratorsSid};
    let mut sid = [0u8; 68];
    let mut size = sid.len() as u32;
    unsafe {
        if CreateWellKnownSid(WinBuiltinAdministratorsSid, std::ptr::null_mut(), sid.as_mut_ptr() as *mut _, &mut size) == 0 { return false; }
        let mut member = 0;
        CheckTokenMembership(std::ptr::null_mut(), sid.as_mut_ptr() as *mut _, &mut member) != 0 && member != 0
    }
}
fn is_elevated() -> bool {
    use windows_sys::Win32::{Foundation::{CloseHandle, HANDLE}, Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY}, System::Threading::{GetCurrentProcess, OpenProcessToken}};
    unsafe {
        let mut token: HANDLE = std::ptr::null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 { return false; }
        let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
        let mut size = 0u32;
        let ok = GetTokenInformation(token, TokenElevation, &mut elevation as *mut _ as *mut _, std::mem::size_of::<TOKEN_ELEVATION>() as u32, &mut size) != 0;
        CloseHandle(token);
        ok && elevation.TokenIsElevated != 0
    }
}
