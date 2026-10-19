#requires -Version 7.0
# Lists worktree files once per run without opening any file. Input (stdin JSON): {"roots":[...],"skip":"<directory-name regex>"}.
# Output: [{"root","fingerprint","files","md":[relative paths]}] or {"root","error"} per root.
# 10-19: 작업트리 62개마다 git 두 번(본진 HEAD 대비 diff, status)이 부하 속에서 가장 큰 비용이었다. 폴더 나열 자료(크기·수정 시각)로
# 작업트리 전체 지문을 만들어, 지문·HEAD·색인·본진 HEAD가 지난번과 같으면 Node 쪽이 지난번 git 결과를 그대로 쓴다.
# 같은 나열에서 MD 목록도 돌려줘 Node의 폴더 걷기를 대신한다. reparse 항목(링크·junction)은 건너뛴다(Node 걷기와 같다).
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [Text.UTF8Encoding]::new()
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Security.Cryptography;
public static class SynkWorktreeScan {
  static void Quote(StringBuilder output, string value) {
    output.Append('"');
    foreach (char c in value) {
      if (c == '"' || c == '\\') output.Append('\\').Append(c);
      else if (c < ' ') output.Append("\\u").Append(((int)c).ToString("x4"));
      else output.Append(c);
    }
    output.Append('"');
  }
  public static void Scan(string root, Regex skip, StringBuilder output) {
    List<string> files = new List<string>(), md = new List<string>();
    Stack<KeyValuePair<DirectoryInfo, string>> stack = new Stack<KeyValuePair<DirectoryInfo, string>>();
    stack.Push(new KeyValuePair<DirectoryInfo, string>(new DirectoryInfo(root), ""));
    while (stack.Count > 0) {
      KeyValuePair<DirectoryInfo, string> top = stack.Pop();
      foreach (FileSystemInfo entry in top.Key.EnumerateFileSystemInfos()) {
        if ((entry.Attributes & FileAttributes.ReparsePoint) != 0) continue;
        string relative = top.Value.Length == 0 ? entry.Name : top.Value + "/" + entry.Name;
        if ((entry.Attributes & FileAttributes.Directory) != 0) {
          if (!skip.IsMatch(entry.Name)) stack.Push(new KeyValuePair<DirectoryInfo, string>((DirectoryInfo)entry, relative));
          continue;
        }
        files.Add(relative + "\u0000" + ((FileInfo)entry).Length + "\u0000" + entry.LastWriteTimeUtc.Ticks);
        if (relative.EndsWith(".md", StringComparison.OrdinalIgnoreCase)) md.Add(relative);
      }
    }
    files.Sort(StringComparer.Ordinal);
    md.Sort(StringComparer.Ordinal);
    string fingerprint;
    using (SHA256 sha = SHA256.Create()) fingerprint = Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(string.Join("\n", files)))).ToLowerInvariant();
    output.Append("{\"root\":"); Quote(output, root);
    output.Append(",\"fingerprint\":\"").Append(fingerprint).Append("\",\"files\":").Append(files.Count).Append(",\"md\":[");
    for (int i = 0; i < md.Count; i++) { if (i > 0) output.Append(','); Quote(output, md[i]); }
    output.Append("]}");
  }
  public static string ScanAll(string[] roots, string skipPattern) {
    Regex skip = new Regex(skipPattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    StringBuilder output = new StringBuilder("[");
    for (int i = 0; i < roots.Length; i++) {
      if (i > 0) output.Append(',');
      int mark = output.Length;
      try { Scan(roots[i], skip, output); }
      catch (Exception error) {
        output.Length = mark;
        output.Append("{\"root\":"); Quote(output, roots[i]); output.Append(",\"error\":"); Quote(output, error.GetType().Name); output.Append('}');
      }
    }
    return output.Append(']').ToString();
  }
}
'@
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
[Console]::Out.Write([SynkWorktreeScan]::ScanAll([string[]]@($request.roots), [string]$request.skip))
