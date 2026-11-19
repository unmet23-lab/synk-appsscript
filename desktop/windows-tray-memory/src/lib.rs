mod node_api;
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::ffi::OsString;
use std::mem::{size_of, zeroed};
use std::os::windows::ffi::OsStringExt;
use std::path::PathBuf;
use windows_sys::Win32::Foundation::{
    CloseHandle, FILETIME, HANDLE, HWND, INVALID_HANDLE_VALUE, LPARAM,
};
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
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

// Holding the verified process handles until the next JS turn also pins their
// identities. Dropping a cancelled batch releases every remaining handle.
struct Batch {
    root: u32,
    targets: Vec<(u32, Handle)>,
    trimmed: usize,
}

const DONE: u32 = 0;
const MORE: u32 = 1;
const SKIPPED: u32 = 2;
const FAILED: u32 = 3;

impl Batch {
    fn prepare(registered: &BTreeMap<u32, u64>) -> Result<Self, u32> {
        let root = unsafe { GetCurrentProcessId() };
        let current = unsafe { GetCurrentProcess() };
        let born = creation_time(current).ok_or(FAILED)?;
        let application = image(current).ok_or(FAILED)?;
        let name = application
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or(FAILED)?;
        if !(name.eq_ignore_ascii_case("SYNKPlatformPreview.exe")
            || name.eq_ignore_ascii_case("SYNKPlatform.exe"))
            || !registered_at(registered, root, born)
        {
            return Err(FAILED);
        }
        if !all_hidden(root, true) {
            return Err(SKIPPED);
        }
        // pop() processes the browser last so its main loop can finish the children first.
        let mut targets = vec![(root, Handle::open(root).ok_or(FAILED)?)];
        for (pid, owner) in process_tree().ok_or(FAILED)? {
            if owner != root || !registered.contains_key(&pid) {
                continue;
            }
            let Some(handle) = Handle::open(pid) else {
                continue;
            };
            let Some(child_born) = creation_time(handle.0) else {
                continue;
            };
            if child_born >= born
                && registered_at(registered, pid, child_born)
                && image(handle.0).as_ref() == Some(&application)
            {
                targets.push((pid, handle));
            }
        }
        Ok(Self {
            root,
            targets,
            trimmed: 0,
        })
    }

    fn step(&mut self) -> u32 {
        let Some((pid, handle)) = self.targets.pop() else {
            return SKIPPED;
        };
        if !all_hidden(self.root, true) {
            return SKIPPED;
        }
        if pid == self.root || all_hidden(pid, false) {
            self.trimmed += usize::from(unsafe { K32EmptyWorkingSet(handle.0) } != 0);
        }
        if !self.targets.is_empty() {
            MORE
        } else if self.trimmed > 0 {
            DONE
        } else {
            FAILED
        }
    }
}

thread_local! {static BATCH: RefCell<Option<Batch>> = const { RefCell::new(None) };}

fn command(input: &str) -> u32 {
    BATCH.with(|current| {
        let Ok(mut batch) = current.try_borrow_mut() else {
            return FAILED;
        };
        if input == "cancel" {
            *batch = None;
            return DONE;
        }
        if input == "next" {
            let status = batch.as_mut().map_or(SKIPPED, Batch::step);
            if status != MORE {
                *batch = None;
            }
            return status;
        }
        *batch = None;
        let Some(registered) = registered_processes(input.split(',').map(str::to_owned)) else {
            return FAILED;
        };
        match Batch::prepare(&registered) {
            Ok(prepared) => {
                *batch = Some(prepared);
                MORE
            }
            Err(status) => status,
        }
    })
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
