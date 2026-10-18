param(
  [Parameter(Mandatory=$true)][string]$TaskDir,
  [Parameter(Mandatory=$true)][string]$PlanHash,
  [Parameter(Mandatory=$true)][string]$ValidationHash,
  [Parameter(Mandatory=$true)][string]$GlobalGuard
)
$ErrorActionPreference = 'Stop'
# No path-based replacement occurs after checking a file. These native handles
# deny other writers AND rename/delete while every target is checked and written.
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class SynkExclusive {
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern SafeFileHandle CreateFileW(string p,uint a,uint s,IntPtr sa,uint c,uint f,IntPtr t);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetFileInformationByHandle(SafeFileHandle h,int cls,ref Disposition d,uint n);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetFileInformationByHandle(SafeFileHandle h,out Info i);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern uint GetFinalPathNameByHandleW(SafeFileHandle h,StringBuilder p,uint n,uint flags);
  [StructLayout(LayoutKind.Sequential)] struct Disposition { public byte Delete; }
  [StructLayout(LayoutKind.Sequential)] struct Info { public uint Attr;public System.Runtime.InteropServices.ComTypes.FILETIME C,A,W;public uint Vol,High,Low,Links,IndexHigh,IndexLow; }
  public static void DeleteOnClose(SafeFileHandle h,bool yes) { var d=new Disposition { Delete=(byte)(yes?1:0) };if(!SetFileInformationByHandle(h,4,ref d,1))throw new IOException("DISPOSITION_FAILED"); }
  static SafeFileHandle Open(string p,uint access,uint sharing,uint creation,uint flags) {
    var h=CreateFileW(p,access,sharing,IntPtr.Zero,creation,flags|0x00200000,IntPtr.Zero);
    if(h.IsInvalid)throw new IOException("EXCLUSIVE_HANDLE_UNAVAILABLE",new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()));
    try {
      Info i;if(!GetFileInformationByHandle(h,out i)||(i.Attr&0x400)!=0)throw new IOException("REPARSE_POINT_REJECTED");
      if((access&0x40000000)!=0&&(i.Attr&0x10)==0&&i.Links>1)throw new IOException("HARDLINK_SOURCE_REJECTED");
      var b=new StringBuilder(32768);if(GetFinalPathNameByHandleW(h,b,(uint)b.Capacity,0)==0)throw new IOException("PATH_IDENTITY_FAILED");
      string actual=b.ToString();if(actual.StartsWith(@"\\?\UNC\",StringComparison.OrdinalIgnoreCase))actual=@"\\"+actual.Substring(8);else if(actual.StartsWith(@"\\?\"))actual=actual.Substring(4);
      if(!String.Equals(Path.GetFullPath(p).TrimEnd('\\'),actual.TrimEnd('\\'),StringComparison.OrdinalIgnoreCase))throw new IOException("PATH_IDENTITY_FAILED");
      return h;
    } catch {h.Dispose();throw;}
  }
  public static SafeFileHandle DirectoryGuard(string p) {return Open(p,0x80,3,3,0x02000000);}
  public static FileStream Existing(string p,bool writing) {var h=Open(p,writing?0xC0010000u:0x80000000u,writing?0u:1u,3,0x80000000);try{return new FileStream(h,writing?FileAccess.ReadWrite:FileAccess.Read,4096,false);}catch{h.Dispose();throw;}}
  public static FileStream Reserve(string p) {var h=Open(p,0xC0010000,0,1,0x80000000);try{DeleteOnClose(h,true);return new FileStream(h,FileAccess.ReadWrite,4096,false);}catch{h.Dispose();throw;}}
  public static FileStream Guard(string p) {var h=Open(p,0xC0000000,0,4,0x80000000);try{return new FileStream(h,FileAccess.ReadWrite,4096,false);}catch{h.Dispose();throw;}}
  public static byte[] Bytes(FileStream s) {s.Position=0;using(var m=new MemoryStream()){s.CopyTo(m);return m.ToArray();}}
  public static string Hash(byte[] b) {using(var h=System.Security.Cryptography.SHA256.Create()){return BitConverter.ToString(h.ComputeHash(b)).Replace("-","").ToLowerInvariant();}}
  public static void Write(FileStream s,byte[] b) {s.Position=0;s.Write(b,0,b.Length);s.SetLength(b.Length);s.Flush(true);}
}
'@
$handles = [System.Collections.Generic.List[System.IDisposable]]::new()
$targets = @{}
$newFiles = [System.Collections.Generic.List[string]]::new()
$changed = $false
$plan = $null
$journal = $null
$success = $false
function Bytes-Hash([byte[]]$bytes) { return [SynkExclusive]::Hash($bytes) }
function Read-LockedJson([string]$file,[string]$expected) {
  $stream=[SynkExclusive]::Existing($file,$false);$handles.Add($stream)
  $bytes=[SynkExclusive]::Bytes($stream)
  if ((Bytes-Hash $bytes) -ne $expected) { throw 'RECEIPT_CHANGED' }
  return [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json -Depth 100
}
function Record($value) {
  $line=[Text.Encoding]::UTF8.GetBytes(($value|ConvertTo-Json -Depth 20 -Compress)+"`n")
  $journal.Write($line,0,$line.Length);$journal.Flush($true)
}
function Save-Result([string]$state,[string]$reason,[bool]$verified) {
  $value=@{version=1;policy='auto_verified_v1';state=$state;reason_code=$reason;needs_attention=(-not $verified);verified=$verified;completed_at=[DateTime]::UtcNow.ToString('o');planFingerprint=$plan.planFingerprint}
  $file=Join-Path $TaskDir 'integration.json';$temp=$file+'.'+[Guid]::NewGuid().ToString('N')+'.new'
  $bytes=[Text.Encoding]::UTF8.GetBytes(($value|ConvertTo-Json -Depth 20)+"`n")
  $out=[IO.FileStream]::new($temp,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try{$out.Write($bytes,0,$bytes.Length);$out.Flush($true)}finally{$out.Dispose()}
  [IO.File]::Move($temp,$file,$true)
}
function Safe-Path([string]$root,[string]$relative) {
  if ($relative -match '[\\:\x00-\x1f*?<>|]' -or $relative.StartsWith('/') -or ($relative.Split('/')|Where-Object {$_ -eq '' -or $_ -eq '.' -or $_ -eq '..'}).Count) {throw 'UNSAFE_INTEGRATION_PATH'}
  $file=[IO.Path]::GetFullPath((Join-Path $root $relative))
  if(-not $file.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'UNSAFE_INTEGRATION_PATH'}
  return $file
}
function Guard-Directory([string]$dir) {
  if ($script:guarded.ContainsKey($dir)) {return}
  $h=[SynkExclusive]::DirectoryGuard($dir);$handles.Add($h);$script:guarded[$dir]=$true
}
function Ensure-Parent([string]$file) {
  $dir=[IO.Path]::GetDirectoryName($file)
  if($dir -eq $plan.sourceRoot){return}
  Ensure-Parent $dir
  # Empty approved-scope directories may remain after an interrupted preflight.
  # Never delete them by path: another application may now own their contents.
  if(-not [IO.Directory]::Exists($dir)) {[IO.Directory]::CreateDirectory($dir)|Out-Null}
  Guard-Directory $dir
}
function Assert-SourceSet {
  $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  $actual=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  $expected=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  $ext='\.(?:js|cjs|mjs|jsx|ts|tsx|css|scss|sass|less|html|htm|md|mdx|txt|json|jsonc|yaml|yml|toml|xml|sh|bash|ps1|cmd|bat|py|sql|prisma|graphql|gql|ini|cfg|conf)$'
  $named='^(?:AGENTS\.md|CLAUDE\.md|Dockerfile|Makefile|Procfile|CMakeLists\.txt|\.gitignore|\.gitattributes|\.editorconfig|\.dockerignore|yarn\.lock|bun\.lock)$'
  $excluded='^(?:\.git|\.tmp|\.cache|\.next|\.nuxt|\.venv|venv|node_modules|dist|build|out|coverage|vendor|target|cache|__pycache__|artifacts|qa-output|playwright-report|test-results|\.codex|\.claude|backups)$'
  $secret='^(?:\.env(?:\..*)?|\.auth(?:[._-].*)?|\.npmrc|\.pypirc|\.netrc|auth(?:[._-].*)?\.json|credentials?(?:[._-].*)?|secrets?(?:[._-].*)?|tokens?(?:[._-].*)?|id_(?:rsa|ed25519)(?:\.pub)?|.*\.(?:pem|key|p12|pfx|keystore))$'
  function Visit-Scoped([string]$relative){
    if(-not $seen.Add($relative)){return}
    if($seen.Count -gt 200000){throw 'SOURCE_SCOPE_LIMIT'}
    foreach($part in $relative.Split('/')){if($part -match $excluded -or $part -match $secret){return}}
    $file=Safe-Path $plan.sourceRoot $relative
    # GetAttributes sees a dangling reparse point; File.Exists would silently
    # treat it as absent and omit it from the final scope check.
    try{$attributes=[IO.File]::GetAttributes($file)}catch [IO.FileNotFoundException]{return}catch [IO.DirectoryNotFoundException]{return}
    if(($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'REPARSE_POINT_REJECTED'}
    if(($attributes -band [IO.FileAttributes]::Directory) -ne 0){foreach($entry in [IO.Directory]::EnumerateFileSystemEntries($file)){Visit-Scoped ($relative+'/'+[IO.Path]::GetFileName($entry))}}
    elseif($relative -match $ext -or [IO.Path]::GetFileName($file) -cmatch $named){[void]$actual.Add($relative);if($actual.Count -gt 2000){throw 'SOURCE_SCOPE_LIMIT'}}
  }
  foreach($relative in $plan.scope){Visit-Scoped $relative}
  foreach($relative in $targets.Keys){if($targets[$relative].stream){[void]$expected.Add($relative)}}
  if(-not $actual.SetEquals($expected)){throw 'SOURCE_SCOPE_CHANGED'}
}
try {
  $TaskDir=[IO.Path]::GetFullPath($TaskDir)
  # One runtime-wide OS lock serializes integrations across every allowed repo.
  $handles.Add([SynkExclusive]::Guard($GlobalGuard))
  $plan=Read-LockedJson (Join-Path $TaskDir 'integration-plan.json') $PlanHash
  $validation=Read-LockedJson (Join-Path $TaskDir 'validation.json') $ValidationHash
  if($plan.policy -ne 'auto_verified_v1' -or $validation.policy -ne 'auto_verified_v1' -or $validation.validation_contract -ne 'multi_language_v2' -or $validation.status -ne 'passed' -or $validation.needs_attention -ne $false -or $validation.planFingerprint -ne $plan.planFingerprint){throw 'VALIDATION_REQUIRED'}
  $guarded=@{}
  Guard-Directory $plan.sourceRoot
  Guard-Directory $plan.candidateRoot
  Guard-Directory $plan.git.gitDir
  Guard-Directory $plan.git.commonDir
  # Respect ordinary Git lock ownership, wait no longer than ten seconds, and
  # never remove an existing lock. Owned reservations vanish if this process dies.
  foreach($lockPath in $plan.git.locks) {
    $end=[DateTime]::UtcNow.AddSeconds(10)
    while($true){try{$h=[SynkExclusive]::Reserve($lockPath);$handles.Add($h);break}catch{if([DateTime]::UtcNow -ge $end){throw 'GIT_LOCKED'};Start-Sleep -Milliseconds 100}}
  }
  foreach($meta in $plan.git.files){
    $actual=$null;if([IO.File]::Exists($meta.path)){$h=[SynkExclusive]::Existing($meta.path,$false);$handles.Add($h);$actual=Bytes-Hash ([SynkExclusive]::Bytes($h))}
    if($actual -ne $meta.sha256){throw 'SOURCE_GIT_CHANGED'}
  }
  $changeMap=@{};foreach($item in $plan.changes){$changeMap[$item.path]=$item}
  $sourceMap=@{};foreach($item in $plan.sourceFiles){$sourceMap[$item.path]=$item}
  $afterBytes=@{}
  foreach($item in $plan.candidateFiles){
    $file=Safe-Path $plan.candidateRoot $item.path
    # Candidate handles stay open; validated bytes cannot change during apply.
    $h=[SynkExclusive]::Existing($file,$false);$handles.Add($h);$bytes=[SynkExclusive]::Bytes($h)
    if((Bytes-Hash $bytes) -ne $item.sha256){throw 'CANDIDATE_CHANGED'}
    if($changeMap.ContainsKey($item.path)){$afterBytes[$item.path]=$bytes}
  }
  $journalPath=Join-Path $TaskDir 'integration-journal.jsonl'
  $recovering=[IO.File]::Exists($journalPath)
  if($recovering){
    $lines=[IO.File]::ReadAllLines($journalPath)
    if($lines.Length -eq 0){throw 'JOURNAL_INVALID'}
    $header=$lines[0]|ConvertFrom-Json
    if($header.kind -ne 'prepared' -or $header.planFingerprint -ne $plan.planFingerprint){throw 'JOURNAL_INVALID'}
  }
  # All original target/dependency handles are acquired before the first write.
  # Existing content is read and written through the same exclusive handle.
  $all=@($sourceMap.Keys)+@($changeMap.Keys)|Sort-Object -Unique
  foreach($relative in $all){
    $file=Safe-Path $plan.sourceRoot $relative
    Ensure-Parent $file
    $change=$changeMap[$relative];$exists=[IO.File]::Exists($file);$new=$false
    if(-not $exists){
      if($change -and $change.kind -eq 'add'){$h=[SynkExclusive]::Reserve($file);$new=$true;$newFiles.Add($relative)}
      elseif($recovering -and $change -and $change.kind -eq 'delete'){$targets[$relative]=@{stream=$null;already=$true;new=$false};continue}
      else{throw 'SOURCE_CHANGED'}
    }else{$h=[SynkExclusive]::Existing($file,[bool]$change)}
    $handles.Add($h);$actual=if($new){$null}else{Bytes-Hash ([SynkExclusive]::Bytes($h))}
    $before=if($change){$change.beforeSha256}else{$sourceMap[$relative].sha256}
    $already=$false
    if($actual -ne $before){
      if($recovering -and $change -and $change.afterSha256 -and $actual -eq $change.afterSha256){$already=$true}
      else{throw $(if($recovering){'RECOVERY_SOURCE_CONFLICT'}else{'SOURCE_CHANGED'})}
    }
    $targets[$relative]=@{stream=$h;already=$already;new=$new}
  }
  Assert-SourceSet
  # Durable backups precede every source write and survive all interrupted jobs.
  foreach($item in $plan.changes){
    if(-not $item.beforeSha256){continue}
    $backup=Safe-Path (Join-Path $TaskDir 'integration-backups') $item.path
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($backup))|Out-Null
    if([IO.File]::Exists($backup)){
      if((Bytes-Hash ([IO.File]::ReadAllBytes($backup))) -ne $item.beforeSha256){throw 'BACKUP_MISMATCH'}
    }elseif(-not $targets[$item.path].already){
      $bytes=[SynkExclusive]::Bytes($targets[$item.path].stream)
      $out=[IO.FileStream]::new($backup,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
      try{$out.Write($bytes,0,$bytes.Length);$out.Flush($true)}finally{$out.Dispose()}
    }else{throw 'BACKUP_MISSING'}
  }
  $journal=[IO.FileStream]::new($journalPath,[IO.FileMode]::Append,[IO.FileAccess]::Write,[IO.FileShare]::Read)
  if(-not $recovering){Record @{kind='prepared';planFingerprint=$plan.planFingerprint;at=[DateTime]::UtcNow.ToString('o')}}
  foreach($item in $plan.changes){
    $target=$targets[$item.path]
    if($target.already){Record @{kind='already_applied';path=$item.path};continue}
    Record @{kind='write_started';path=$item.path;before=$item.beforeSha256;after=$item.afterSha256}
    $changed=$true
    if($item.kind -eq 'delete'){
      [SynkExclusive]::DeleteOnClose($target.stream.SafeFileHandle,$true)
    }else{
      [SynkExclusive]::Write($target.stream,$afterBytes[$item.path])
      if((Bytes-Hash ([SynkExclusive]::Bytes($target.stream))) -ne $item.afterSha256){throw 'WRITE_VERIFICATION_FAILED'}
      if($target.new){[SynkExclusive]::DeleteOnClose($target.stream.SafeFileHandle,$false)}
    }
    Record @{kind='write_verified';path=$item.path;after=$item.afterSha256}
  }
  Record @{kind='committed';planFingerprint=$plan.planFingerprint;at=[DateTime]::UtcNow.ToString('o')}
  $success=$true
} catch {
  $reason=[string]$_.Exception.Message
  $inner=$_.Exception
  while($inner){if($inner.Message -match '^[A-Z_]{3,80}$'){$reason=$inner.Message;break};$inner=$inner.InnerException}
  if($reason -notmatch '^[A-Z_]{3,80}$'){$reason='EXCLUSIVE_APPLY_UNAVAILABLE'}
  if($plan){Save-Result $(if($changed){'unknown'}else{'needs_attention'}) $reason $false}
} finally {
  if($journal){$journal.Dispose()}
  for($i=$handles.Count-1;$i -ge 0;$i--){$handles[$i].Dispose()}
}
if($success){Save-Result 'integrated' 'VERIFIED_CHANGES_INTEGRATED' $true}
