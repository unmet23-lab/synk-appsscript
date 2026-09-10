param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('get', 'set', 'has', 'delete')]
  [string]$Mode,

  [Parameter(Mandatory = $true, Position = 1)]
  [string]$Target
)

$ErrorActionPreference = 'Stop'

if (-not $IsWindows -and $env:OS -ne 'Windows_NT') {
  throw 'Windows 자격 증명 보관소는 Windows에서만 사용할 수 있습니다.'
}

if ($Target -notmatch '^SYNK/SNS/[A-Za-z0-9._/-]+$') {
  throw '자격 이름은 SYNK/SNS/ 아래만 사용할 수 있습니다.'
}

if (-not ('SynkCredentialNative' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class SynkCredentialNative
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL
    {
        public UInt32 Flags;
        public UInt32 Type;
        [MarshalAs(UnmanagedType.LPWStr)] public string TargetName;
        [MarshalAs(UnmanagedType.LPWStr)] public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public UInt32 CredentialBlobSize;
        public IntPtr CredentialBlob;
        public UInt32 Persist;
        public UInt32 AttributeCount;
        public IntPtr Attributes;
        [MarshalAs(UnmanagedType.LPWStr)] public string TargetAlias;
        [MarshalAs(UnmanagedType.LPWStr)] public string UserName;
    }

    [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredWrite(ref CREDENTIAL credential, UInt32 flags);

    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credential);

    [DllImport("advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredDelete(string target, UInt32 type, UInt32 flags);

    [DllImport("advapi32.dll", EntryPoint = "CredFree")]
    public static extern void CredFree(IntPtr credential);
}
'@
}

$CredTypeGeneric = 1
$CredPersistLocalMachine = 2
$NotFound = 1168

function Read-SynkCredential([string]$Name) {
  $pointer = [IntPtr]::Zero
  $ok = [SynkCredentialNative]::CredRead($Name, $CredTypeGeneric, 0, [ref]$pointer)
  if (-not $ok) {
    $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    if ($code -eq $NotFound) { return $null }
    throw "Windows 자격 읽기 실패 ($code)"
  }

  try {
    $credential = [Runtime.InteropServices.Marshal]::PtrToStructure(
      $pointer,
      [type][SynkCredentialNative+CREDENTIAL]
    )
    if ($credential.CredentialBlobSize -eq 0) { return '' }
    return [Runtime.InteropServices.Marshal]::PtrToStringUni(
      $credential.CredentialBlob,
      [int]($credential.CredentialBlobSize / 2)
    )
  }
  finally {
    [SynkCredentialNative]::CredFree($pointer)
  }
}

switch ($Mode) {
  'has' {
    if ($null -eq (Read-SynkCredential $Target)) { [Console]::Out.Write('0') }
    else { [Console]::Out.Write('1') }
  }
  'get' {
    $value = Read-SynkCredential $Target
    if ($null -eq $value) { exit 3 }
    [Console]::Out.Write($value)
  }
  'set' {
    $value = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrEmpty($value)) { throw '빈 자격은 저장하지 않습니다.' }
    $bytes = [Text.Encoding]::Unicode.GetBytes($value)
    if ($bytes.Length -gt 2560) { throw '자격 값이 Windows 보관소 한도보다 큽니다.' }

    $blob = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length + 2)
    try {
      [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $blob, $bytes.Length)
      [Runtime.InteropServices.Marshal]::WriteInt16($blob, $bytes.Length, 0)
      $credential = New-Object SynkCredentialNative+CREDENTIAL
      $credential.Type = $CredTypeGeneric
      $credential.TargetName = $Target
      $credential.Comment = 'SYNK SNS official publishing credential'
      $credential.CredentialBlobSize = $bytes.Length
      $credential.CredentialBlob = $blob
      $credential.Persist = $CredPersistLocalMachine
      $credential.UserName = 'SYNK'
      if (-not [SynkCredentialNative]::CredWrite([ref]$credential, 0)) {
        $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        throw "Windows 자격 쓰기 실패 ($code)"
      }
    }
    finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode($blob)
    }
    [Console]::Out.Write('ok')
  }
  'delete' {
    $ok = [SynkCredentialNative]::CredDelete($Target, $CredTypeGeneric, 0)
    if (-not $ok) {
      $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
      if ($code -ne $NotFound) { throw "Windows 자격 삭제 실패 ($code)" }
    }
    [Console]::Out.Write('ok')
  }
}
