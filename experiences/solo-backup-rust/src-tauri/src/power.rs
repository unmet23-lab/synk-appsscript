//! Conditions a scheduled run checks before cloud work (STAGE1_DESIGN.md 4.2 「쉼 판단」):
//! on battery below 30%, Windows battery saver, or a metered connection the run
//! skips cloud upload · check · proof. A run the person started is never skipped.
use serde::Serialize;
use windows_sys::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Conditions { pub on_battery: Option<bool>, pub percent: Option<u8>, pub saver: bool, pub metered: Option<bool> }

pub fn read() -> Conditions {
    let mut s: SYSTEM_POWER_STATUS = unsafe { std::mem::zeroed() };
    let (on_battery, percent, saver) = if unsafe { GetSystemPowerStatus(&mut s) } == 0 { (None, None, false) } else {
        (match s.ACLineStatus { 0 => Some(true), 1 => Some(false), _ => None },
         if s.BatteryLifePercent <= 100 { Some(s.BatteryLifePercent) } else { None },
         // SystemStatusFlag bit 0 = battery saver on (Windows 10 and later).
         s.SystemStatusFlag & 1 == 1)
    };
    Conditions { on_battery, percent, saver, metered: metered() }
}

/// Windows' own idea of a costly connection: anything but Unrestricted, or roaming,
/// or over the data limit (phone hotspots are usually marked this way). Unknown or
/// offline gives None and does not skip.
fn metered() -> Option<bool> {
    // windows-core joins the process MTA itself when COM is not initialized yet.
    use windows::Networking::Connectivity::{NetworkCostType, NetworkInformation};
    let profile = NetworkInformation::GetInternetConnectionProfile().ok()?;
    let cost = profile.GetConnectionCost().ok()?;
    let kind = cost.NetworkCostType().ok()?;
    if kind == NetworkCostType::Unknown { return None; }
    Some(kind != NetworkCostType::Unrestricted || cost.Roaming().unwrap_or(false) || cost.OverDataLimit().unwrap_or(false))
}

pub fn skip_reason(c: &Conditions) -> Option<&'static str> {
    if c.saver { return Some("saver"); }
    if c.on_battery == Some(true) && c.percent.is_some_and(|p| p < 30) { return Some("battery"); }
    if c.metered == Some(true) { return Some("metered"); }
    None
}

#[cfg(test)] mod tests {
    use super::*;
    fn c(on_battery: Option<bool>, percent: Option<u8>, saver: bool, metered: Option<bool>) -> Conditions { Conditions { on_battery, percent, saver, metered } }
    #[test] fn skip_rules() {
        assert_eq!(skip_reason(&c(Some(false), Some(10), false, Some(false))), None, "plugged in at 10% still runs");
        assert_eq!(skip_reason(&c(Some(true), Some(29), false, None)), Some("battery"));
        assert_eq!(skip_reason(&c(Some(true), Some(30), false, None)), None, "30% or more on battery still runs");
        assert_eq!(skip_reason(&c(Some(true), None, false, None)), None, "unknown charge does not skip");
        assert_eq!(skip_reason(&c(Some(false), Some(90), true, None)), Some("saver"));
        assert_eq!(skip_reason(&c(Some(false), Some(90), false, Some(true))), Some("metered"));
        assert_eq!(skip_reason(&c(None, None, false, None)), None);
    }
    #[test] fn reads_without_panicking() { let _ = read(); }
}
