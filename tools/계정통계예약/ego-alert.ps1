#requires -Version 7
# Closes the ego alert "Profile error occurred" and nothing else. While that message box is open, ego accepts no script
# (docs field note, 2026-11-17). It has a single OK button and nothing to choose, so closing it changes no setting.
# A window is touched only when all of these hold: it belongs to the ego process, it is a visible native message box (#32770),
# its title is exactly the alert title, and it has exactly one button whose text is OK (or the Korean OK).
# Windows PowerShell 5.1 could not press this button (2026-11-24), so version 7 is required.
# Prints one word: none | closed | still_open | unexpected
[CmdletBinding()]
param([ValidatePattern('^[A-Za-z0-9_-]{1,40}$')][string]$ProcessName = 'ego')

$ErrorActionPreference = 'Stop'
$title = 'Profile error occurred'
$labels = @('OK', (-join [char[]](0xD655, 0xC778)))
$owners = @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
if ($owners.Count -eq 0) { 'none'; exit 0 }

Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class SynkEgoAlert {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr p, EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("oleacc.dll")] public static extern int AccessibleObjectFromWindow(IntPtr h, uint id, ref Guid iid, [MarshalAs(UnmanagedType.IDispatch)] out object o);
  public static string Text(IntPtr h) { var s = new StringBuilder(512); GetWindowText(h, s, 512); return s.ToString(); }
  public static string Cls(IntPtr h) { var s = new StringBuilder(256); GetClassName(h, s, 256); return s.ToString(); }
  public static List<IntPtr> Alerts(int[] owners, string title) {
    var set = new HashSet<uint>(); foreach (var o in owners) set.Add((uint)o);
    var r = new List<IntPtr>();
    EnumWindows((h, l) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (set.Contains(pid) && IsWindowVisible(h) && Cls(h) == "#32770" && Text(h) == title) r.Add(h);
      return true;
    }, IntPtr.Zero);
    return r;
  }
  public static List<IntPtr> Buttons(IntPtr p) {
    var r = new List<IntPtr>();
    EnumChildWindows(p, (h, l) => { if (Cls(h) == "Button" && IsWindowVisible(h)) r.Add(h); return true; }, IntPtr.Zero);
    return r;
  }
}
'@

$result = 'none'
foreach ($alert in @([SynkEgoAlert]::Alerts([int[]]$owners, $title)) | Select-Object -First 5) {
    $buttons = @([SynkEgoAlert]::Buttons($alert))
    if ($buttons.Count -ne 1 -or $labels -notcontains [SynkEgoAlert]::Text($buttons[0])) { $result = 'unexpected'; break }
    $iid = [Guid]'618736E0-3C3D-11CF-810C-00AA00389B71'
    $object = $null
    # OBJID_CLIENT. UI Automation offers no invoke pattern on this button and BM_CLICK did nothing (2026-11-18).
    $status = [SynkEgoAlert]::AccessibleObjectFromWindow($buttons[0], [uint32]4294967292, [ref]$iid, [ref]$object)
    if ($status -ne 0 -or $null -eq $object) { $result = 'still_open'; break }
    $object.accDoDefaultAction(0)
    $until = (Get-Date).AddSeconds(5)
    while ([SynkEgoAlert]::IsWindow($alert) -and [SynkEgoAlert]::IsWindowVisible($alert) -and (Get-Date) -lt $until) { Start-Sleep -Milliseconds 100 }
    if ([SynkEgoAlert]::IsWindow($alert) -and [SynkEgoAlert]::IsWindowVisible($alert)) { $result = 'still_open'; break }
    $result = 'closed'
}
$result
