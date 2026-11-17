//! Conditions a scheduled run checks before cloud work (STAGE1_DESIGN.md 4.2 「쉼 판단」):
//! on battery below 30%, Windows battery saver, or a metered connection the run
//! skips cloud upload · check · proof. A run the person started is never skipped.
//! 「쉬는 회선」 (4.14): on a Wi-Fi the person chose (`rest-networks.json` in the state folder, written by the window's
//! `setRestNetworks`) the run rests as on a metered connection. The Wi-Fi name is read but never recorded.
use serde::Serialize;
use std::path::Path;
use windows_sys::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Conditions { pub on_battery: Option<bool>, pub percent: Option<u8>, pub saver: bool, pub metered: Option<bool>, pub rest_network: Option<bool> }

/// The conditions, with 「쉬는 회선」 judged from the names kept in `root` (none kept: `rest_network` is false).
/// 쉬는 회선을 고르지 않았으면 Wi-Fi 이름을 읽지 않는다(최신 Windows 11에서는 위치 접근으로 남는다 — 카본 끝판 CB8).
pub fn read_in(root: &Path) -> Conditions {
    let mut c = read();
    let names = rest_names(root);
    c.rest_network = if names.is_empty() { Some(false) } else { rest_network(&names, wifi_name().as_deref()) };
    c
}

pub fn read() -> Conditions {
    let mut s: SYSTEM_POWER_STATUS = unsafe { std::mem::zeroed() };
    let (on_battery, percent, saver) = if unsafe { GetSystemPowerStatus(&mut s) } == 0 { (None, None, false) } else {
        (match s.ACLineStatus { 0 => Some(true), 1 => Some(false), _ => None },
         if s.BatteryLifePercent <= 100 { Some(s.BatteryLifePercent) } else { None },
         // SystemStatusFlag bit 0 = battery saver on (Windows 10 and later).
         s.SystemStatusFlag & 1 == 1)
    };
    Conditions { on_battery, percent, saver, metered: metered(), rest_network: None }
}

/// The Wi-Fi names kept in `rest-networks.json` (`{"v":1,"names":[…]}`, at most 20 of 32 bytes each); none when missing or
/// damaged.
pub fn rest_names(root: &Path) -> Vec<String> {
    let Ok(bytes) = std::fs::read(root.join("rest-networks.json")) else { return Vec::new() };
    if bytes.len() > 4096 { return Vec::new(); }
    let Ok(value) = serde_json::from_slice::<serde_json::Value>(&bytes) else { return Vec::new() };
    value["names"].as_array().map(|all| all.iter().filter_map(|n| n.as_str()).filter(|n| !n.is_empty() && n.len() <= 32).take(20).map(String::from).collect()).unwrap_or_default()
}
/// On a kept Wi-Fi: Some(true). Kept names but the name cannot be read (Windows 11 may ask for location permission): None,
/// which does not rest. No names kept: Some(false).
pub fn rest_network(names: &[String], current: Option<&str>) -> Option<bool> {
    if names.is_empty() { return Some(false); }
    current.map(|c| names.iter().any(|n| n == c))
}
/// The name of the Wi-Fi this PC reaches the internet through, when it does and Windows tells it.
pub fn wifi_name() -> Option<String> {
    use windows::Networking::Connectivity::NetworkInformation;
    let profile = NetworkInformation::GetInternetConnectionProfile().ok()?;
    if !profile.IsWlanConnectionProfile().ok()? { return None; }
    let name = profile.WlanConnectionProfileDetails().ok()?.GetConnectedSsid().ok()?.to_string();
    (!name.is_empty()).then_some(name)
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
    if c.rest_network == Some(true) { return Some("network"); }
    None
}

#[cfg(test)] mod tests {
    use super::*;
    fn c(on_battery: Option<bool>, percent: Option<u8>, saver: bool, metered: Option<bool>) -> Conditions { Conditions { on_battery, percent, saver, metered, rest_network: None } }
    #[test] fn skip_rules() {
        assert_eq!(skip_reason(&c(Some(false), Some(10), false, Some(false))), None, "plugged in at 10% still runs");
        assert_eq!(skip_reason(&c(Some(true), Some(29), false, None)), Some("battery"));
        assert_eq!(skip_reason(&c(Some(true), Some(30), false, None)), None, "30% or more on battery still runs");
        assert_eq!(skip_reason(&c(Some(true), None, false, None)), None, "unknown charge does not skip");
        assert_eq!(skip_reason(&c(Some(false), Some(90), true, None)), Some("saver"));
        assert_eq!(skip_reason(&c(Some(false), Some(90), false, Some(true))), Some("metered"));
        assert_eq!(skip_reason(&c(None, None, false, None)), None);
        let rest = Conditions { rest_network: Some(true), ..c(Some(false), Some(90), false, Some(false)) };
        assert_eq!(skip_reason(&rest), Some("network"), "a Wi-Fi the person chose rests like a metered one");
        assert_eq!(skip_reason(&Conditions { rest_network: None, ..rest.clone() }), None, "an unreadable Wi-Fi name does not rest");
    }
    #[test] fn rest_networks_are_matched_exactly() {
        let names = vec!["휴대폰 핫스팟".to_string(), "Cafe".to_string()];
        assert_eq!(rest_network(&names, Some("Cafe")), Some(true));
        assert_eq!(rest_network(&names, Some("cafe")), Some(false), "exact, as Windows names it");
        assert_eq!(rest_network(&names, None), None, "kept names, name unknown: not judged");
        assert_eq!(rest_network(&[], None), Some(false));
        let dir = std::env::temp_dir().join(format!("swb-rest-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir); std::fs::create_dir_all(&dir).unwrap();
        assert!(rest_names(&dir).is_empty());
        std::fs::write(dir.join("rest-networks.json"), r#"{"v":1,"names":["Cafe","",7,"123456789012345678901234567890123"]}"#).unwrap();
        assert_eq!(rest_names(&dir), vec!["Cafe".to_string()]);
        std::fs::write(dir.join("rest-networks.json"), "not json").unwrap();
        assert!(rest_names(&dir).is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }
    #[test] fn reads_without_panicking() { let _ = read(); }
    #[test] fn no_rest_networks_means_no_wifi_name_read() {
        assert_eq!(read_in(&std::env::temp_dir().join(format!("swb-no-rest-{}", std::process::id()))).rest_network, Some(false));
    }
}
