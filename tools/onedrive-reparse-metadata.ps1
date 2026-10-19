#requires -Version 5.1
# Reads exact filesystem metadata only; never opens file contents or follows junctions.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [Text.UTF8Encoding]::new()
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class SynkReparseMetadata {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct FindData {
    public uint Attributes;
    public System.Runtime.InteropServices.ComTypes.FILETIME Creation, Access, Write;
    public uint SizeHigh, SizeLow, ReparseTag, Reserved;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=260)] public string Name;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=14)] public string ShortName;
  }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true, ExactSpelling=true)]
  private static extern IntPtr FindFirstFileW(string name, out FindData data);
  [DllImport("kernel32.dll")] private static extern bool FindClose(IntPtr handle);
  public static uint ReadTag(string name) {
    FindData data;
    IntPtr handle = FindFirstFileW(name, out data);
    if (handle == new IntPtr(-1)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try { return data.ReparseTag; } finally { FindClose(handle); }
  }
}
'@
$items = ConvertFrom-Json ([Console]::In.ReadToEnd())
$rows = @(foreach ($itemPath in $items) {
  if ([IO.File]::Exists($itemPath) -or [IO.Directory]::Exists($itemPath)) {
    if (([IO.File]::GetAttributes($itemPath) -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      try { @{ path=$itemPath; tag=[SynkReparseMetadata]::ReadTag($itemPath); attributes=[int][IO.File]::GetAttributes($itemPath) } }
      catch { @{ path=$itemPath; tag=$null } }
    }
  }
})
ConvertTo-Json -Compress -InputObject $rows
