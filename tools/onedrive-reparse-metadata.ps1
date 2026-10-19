#requires -Version 5.1
# Reads exact filesystem metadata only; never opens file contents or follows junctions.
# Input: JSON array of absolute paths on stdin. Output: JSON array of {path, tag, attributes} for reparse points only.
# 10-19: 경로마다 파일을 열지 않고 부모 폴더를 한 번 나열해 같은 속성·reparse 태그(FindFirstFile 자료)를 읽는다.
# 부하가 클 때 경로 수만 개를 하나씩 여는 확인이 몇 분씩 걸렸다. 나열에서 못 찾거나 나열이 실패한 경로는
# 예전처럼 그 경로 하나를 GetAttributes·FindFirstFileW로 확인한다. Cloud 자리표시자도 숨기지 않고 보이게 한다.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [Text.UTF8Encoding]::new()
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
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
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true, ExactSpelling=true)]
  private static extern IntPtr FindFirstFileExW(string name, int infoLevel, out FindData data, int searchOp, IntPtr filter, int flags);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true, ExactSpelling=true)]
  private static extern bool FindNextFileW(IntPtr handle, out FindData data);
  [DllImport("kernel32.dll")] private static extern bool FindClose(IntPtr handle);
  [DllImport("ntdll.dll")] private static extern sbyte RtlSetProcessPlaceholderCompatibilityMode(sbyte mode);
  const uint ReparsePoint = 0x400;
  static readonly IntPtr Invalid = new IntPtr(-1);
  public static int Listed, Fallbacks;
  public static uint ReadTag(string name) {
    FindData data;
    IntPtr handle = FindFirstFileW(name, out data);
    if (handle == Invalid) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try { return data.ReparseTag; } finally { FindClose(handle); }
  }
  // 폴더 항목 전체의 속성·태그. 끝까지 읽지 못하면 null을 돌려 경로별 확인으로 넘긴다.
  static Dictionary<string, uint[]> List(string directory) {
    FindData data;
    IntPtr handle = FindFirstFileExW(Path.Combine(directory, "*"), 1, out data, 0, IntPtr.Zero, 2);
    if (handle == Invalid) return null;
    Dictionary<string, uint[]> entries = new Dictionary<string, uint[]>(StringComparer.OrdinalIgnoreCase);
    try {
      while (true) {
        if (data.Name != "." && data.Name != "..") entries[data.Name] = new uint[] { data.Attributes, data.ReparseTag };
        if (!FindNextFileW(handle, out data)) return Marshal.GetLastWin32Error() == 18 ? entries : null;
      }
    } finally { FindClose(handle); }
  }
  static void Quote(StringBuilder output, string value) {
    output.Append('"');
    foreach (char c in value) {
      if (c == '"' || c == '\\') output.Append('\\').Append(c);
      else if (c < ' ') output.Append("\\u").Append(((int)c).ToString("x4"));
      else output.Append(c);
    }
    output.Append('"');
  }
  static void Row(StringBuilder output, ref bool first, string itemPath, string tag, uint attributes) {
    if (!first) output.Append(',');
    first = false;
    output.Append("{\"path\":");
    Quote(output, itemPath);
    output.Append(",\"tag\":").Append(tag);
    if (tag != "null") output.Append(",\"attributes\":").Append(((int)attributes).ToString());
    output.Append('}');
  }
  public static string Scan(string[] paths) {
    // 2 = PHCM_EXPOSE_PLACEHOLDERS. 실패하면(옛 Windows) 나열을 쓰지 않고 경로별로 확인한다.
    bool exposed;
    try { exposed = RtlSetProcessPlaceholderCompatibilityMode(2) >= 0; } catch { exposed = false; }
    Dictionary<string, Dictionary<string, uint[]>> listings = new Dictionary<string, Dictionary<string, uint[]>>(StringComparer.OrdinalIgnoreCase);
    StringBuilder output = new StringBuilder("[");
    bool first = true;
    foreach (string itemPath in paths) {
      if (string.IsNullOrEmpty(itemPath)) continue;
      string parent = exposed ? Path.GetDirectoryName(itemPath) : null, name = Path.GetFileName(itemPath);
      Dictionary<string, uint[]> entries = null;
      if (!string.IsNullOrEmpty(parent) && !string.IsNullOrEmpty(name)) {
        if (!listings.TryGetValue(parent, out entries)) { entries = List(parent); listings[parent] = entries; if (entries != null) Listed++; }
      }
      uint[] entry;
      if (entries != null && entries.TryGetValue(name, out entry)) {
        if ((entry[0] & ReparsePoint) != 0) Row(output, ref first, itemPath, entry[1].ToString(), entry[0]);
        continue;
      }
      Fallbacks++;
      FileAttributes attributes;
      // 없는 경로는 링크가 아니다. 다른 오류는 예전 GetAttributes처럼 전체 확인을 멈춘다.
      try { attributes = File.GetAttributes(itemPath); }
      catch (FileNotFoundException) { continue; }
      catch (DirectoryNotFoundException) { continue; }
      if ((attributes & FileAttributes.ReparsePoint) == 0) continue;
      string tag;
      try { tag = ReadTag(itemPath).ToString(); } catch { tag = "null"; }
      Row(output, ref first, itemPath, tag, (uint)attributes);
    }
    return output.Append(']').ToString();
  }
}
'@
$items = @(ConvertFrom-Json ([Console]::In.ReadToEnd()))
[Console]::Out.Write([SynkReparseMetadata]::Scan([string[]]$items))
if ($env:SYNK_REPARSE_STATS) { [Console]::Error.Write('listed=' + [SynkReparseMetadata]::Listed + ' fallbacks=' + [SynkReparseMetadata]::Fallbacks) }
