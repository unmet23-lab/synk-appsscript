#![windows_subsystem = "windows"]

use std::collections::BTreeMap;
use std::ffi::OsString;
use std::mem::{size_of, zeroed};
use std::os::windows::ffi::OsStringExt;
use std::path::PathBuf;
use std::process::ExitCode;
use windows_sys::Win32::Foundation::{
    CloseHandle, FILETIME, HANDLE, HWND, INVALID_HANDLE_VALUE, LPARAM,
};
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::System::ProcessStatus::K32EmptyWorkingSet;
use windows_sys::Win32::System::Threading::{
    GetCurrentProcess, GetCurrentProcessId, GetProcessTimes, OpenProcess,
    QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SET_QUOTA,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetClassNameW, GetWindowThreadProcessId, IsWindowVisible,
};

struct Handle(HANDLE);

impl Handle {
    fn from_raw(raw: HANDLE) -> Option<Self> {
        if raw.is_null() || raw == INVALID_HANDLE_VALUE {
            None
        } else {
            Some(Self(raw))
        }
    }
    fn open(pid: u32) -> Option<Self> {
        Self::from_raw(unsafe {
            OpenProcess(
                PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SET_QUOTA,
                0,
                pid,
            )
        })
    }
}
impl Drop for Handle {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0);
        }
    }
}

// Windows owns the handles that GetCurrentProcess() returns.
fn creation_time(process: HANDLE) -> Option<u64> {
    let mut times: [FILETIME; 4] = unsafe { zeroed() };
    let [created, exited, kernel, user] = &mut times;
    if unsafe { GetProcessTimes(process, created, exited, kernel, user) } == 0 {
        return None;
    }
    Some((u64::from(created.dwHighDateTime) << 32) | u64::from(created.dwLowDateTime))
}

fn process_tree() -> Option<Vec<(u32, u32)>> {
    let snapshot = Handle::from_raw(unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) })?;
    let mut entry: PROCESSENTRY32W = unsafe { zeroed() };
    entry.dwSize = size_of::<PROCESSENTRY32W>() as u32;
    if unsafe { Process32FirstW(snapshot.0, &mut entry) } == 0 {
        return None;
    }
    let mut rows = Vec::new();
    loop {
        rows.push((entry.th32ProcessID, entry.th32ParentProcessID));
        if unsafe { Process32NextW(snapshot.0, &mut entry) } == 0 {
            break;
        }
    }
    Some(rows)
}

fn image(process: HANDLE) -> Option<PathBuf> {
    let mut buffer = vec![0u16; 32768];
    let mut count = buffer.len() as u32;
    if unsafe { QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut count) } == 0 {
        return None;
    }
    Some(OsString::from_wide(&buffer[..count as usize]).into())
}

struct WindowState {
    root: u32,
    has_window: bool,
}

unsafe extern "system" fn skip_visible_window(hwnd: HWND, context: LPARAM) -> i32 {
    let state = &mut *(context as *mut WindowState);
    let mut owner = 0;
    GetWindowThreadProcessId(hwnd, &mut owner);
    if owner != state.root {
        return 1;
    }
    let mut class = [0u16; 256];
    let length = GetClassNameW(hwnd, class.as_mut_ptr(), class.len() as i32);
    let name = String::from_utf16_lossy(&class[..length as usize]);
    state.has_window |= name == "Chrome_WidgetWin_1";
    // Windows keeps these input indicator overlays visible after the real app
    // window is hidden, including on Korean input desktops. Dialogs still count.
    i32::from(
        IsWindowVisible(hwnd) == 0
            || matches!(
                name.as_str(),
                "UAC_InputIndicatorOverlayWnd" | "UAC Input Indicator"
            ),
    )
}

fn all_hidden(root: u32, require_platform_window: bool) -> bool {
    let mut state = WindowState {
        root,
        has_window: false,
    };
    // A visible app window stops enumeration. No Platform HWND on this desktop
    // also declines this request.
    unsafe {
        EnumWindows(Some(skip_visible_window), &mut state as *mut _ as LPARAM) != 0
            && (!require_platform_window || state.has_window)
    }
}

fn registered_processes(args: impl Iterator<Item = String>) -> Option<BTreeMap<u32, u64>> {
    let mut result = BTreeMap::new();
    for arg in args {
        let (pid, millis) = arg.split_once(':')?;
        let pid = pid.parse::<u32>().ok()?;
        let millis = millis.parse::<u64>().ok()?;
        if pid == 0 || millis == 0 || result.len() >= 256 || result.insert(pid, millis).is_some() {
            return None;
        }
    }
    (!result.is_empty()).then_some(result)
}

fn registered_at(registered: &BTreeMap<u32, u64>, pid: u32, filetime: u64) -> bool {
    // Electron returns Unix milliseconds. GetProcessTimes uses 100 ns since 1601.
    const UNIX_EPOCH: u64 = 116_444_736_000_000_000;
    let Some(ticks) = filetime.checked_sub(UNIX_EPOCH) else {
        return false;
    };
    registered.get(&pid) == Some(&(ticks / 10_000))
}

fn trim_parent(registered: &BTreeMap<u32, u64>) -> Option<usize> {
    let own_time = creation_time(unsafe { GetCurrentProcess() })?;
    let me = unsafe { GetCurrentProcessId() };
    let rows = process_tree()?;
    let root = rows.iter().find(|(pid, _)| *pid == me)?.1;
    let parent = Handle::open(root)?;
    let born = creation_time(parent.0)?;
    let application = image(parent.0)?;
    let name = application.file_name()?.to_str()?;
    if !(name.eq_ignore_ascii_case("SYNKPlatformPreview.exe")
        || name.eq_ignore_ascii_case("SYNKPlatform.exe"))
        || born >= own_time
        || !registered_at(registered, root, born)
    {
        return None;
    }
    if !all_hidden(root, true) {
        return Some(0);
    }
    let mut trimmed = 0;
    for (pid, owner) in rows {
        if owner != root || pid == me || !registered.contains_key(&pid) {
            continue;
        }
        let Some(process) = Handle::open(pid) else {
            continue;
        };
        let Some(child_born) = creation_time(process.0) else {
            continue;
        };
        // Only existing direct Electron children using this exact Platform image.
        // A recycled PID will have been born after this one-shot helper.
        if child_born < born
            || child_born > own_time
            || !registered_at(registered, pid, child_born)
            || image(process.0).as_ref() != Some(&application)
            || !all_hidden(pid, false)
        {
            continue;
        }
        if !all_hidden(root, true) {
            return Some(0);
        }
        trimmed += usize::from(unsafe { K32EmptyWorkingSet(process.0) } != 0);
    }
    if !all_hidden(root, true) {
        return Some(0);
    }
    trimmed += usize::from(unsafe { K32EmptyWorkingSet(parent.0) } != 0);
    (trimmed > 0).then_some(trimmed)
}

fn main() -> ExitCode {
    let args: Vec<_> = std::env::args().skip(1).collect();
    if args == ["--verify-runtime"] {
        for name in ["vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll"] {
            let wide: Vec<_> = name.encode_utf16().chain([0]).collect();
            if !unsafe { GetModuleHandleW(wide.as_ptr()) }.is_null() {
                return ExitCode::from(4);
            }
        }
        return ExitCode::SUCCESS;
    }
    let Some(registered) = registered_processes(args.into_iter()) else {
        return ExitCode::from(3);
    };
    match trim_parent(&registered) {
        Some(n) if n > 0 => ExitCode::SUCCESS,
        Some(_) => ExitCode::from(2),
        None => ExitCode::from(3),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_matches_registered_pid_and_process_birth() {
        let ids =
            registered_processes(["8:65".to_owned(), "70:91".to_owned()].into_iter()).unwrap();
        assert!(registered_at(&ids, 8, 116_444_736_000_650_007));
        assert!(!registered_at(&ids, 8, 116_444_736_000_660_007));
        assert!(!registered_at(&ids, 9, 116_444_736_000_650_007));
        assert!(!registered_at(&ids, 8, 0));
    }
    #[test]
    fn rejects_empty_invalid_and_repeated_processes() {
        for args in [
            vec![],
            vec!["1"],
            vec!["0:7"],
            vec!["2:0"],
            vec!["8:1", "8:2"],
        ] {
            assert!(registered_processes(args.into_iter().map(str::to_owned)).is_none());
        }
    }
}
