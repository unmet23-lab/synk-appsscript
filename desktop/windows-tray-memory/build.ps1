param([switch]$Verify)
$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
$originalFlags = $env:CARGO_ENCODED_RUSTFLAGS
try {
    $env:CARGO_ENCODED_RUSTFLAGS = @('-C', 'target-feature=+crt-static', '-C', 'link-arg=/Brepro', '-C', 'link-arg=/PDBALTPATH:%_PDB%', ('--remap-path-prefix=' + $PSScriptRoot + '=synk-tray-memory')) -join [char]31
    $rust = rustc -vV
    if ($LASTEXITCODE -ne 0 -or $rust -notcontains 'release: 1.99.1' -or $rust -notcontains 'host: x86_64-pc-windows-msvc') {
        throw 'Build with Rust 1.99.1 for x86_64-pc-windows-msvc.'
    }
    cargo build --release --locked --target x86_64-pc-windows-msvc --target-dir target
    if ($LASTEXITCODE -ne 0) { throw 'Could not build the Windows tray memory helper.' }
    $built = Join-Path $PSScriptRoot 'target/x86_64-pc-windows-msvc/release/synk_tray_memory.dll'
    $directory = Join-Path (Split-Path $PSScriptRoot) 'src/native'
    $packaged = Join-Path $directory 'tray-memory-win-x64.node'
    $pin = Join-Path $directory 'tray-memory-win-x64.sha256'
    if ($Verify) {
        if (!(Test-Path -LiteralPath $packaged) -or (Get-FileHash -LiteralPath $built).Hash -ne (Get-FileHash -LiteralPath $packaged).Hash) {
            throw 'Packaged native module differs from this build.'
        }
        if ((Get-Content -Raw -LiteralPath $pin).Trim() -cne (Get-FileHash -LiteralPath $built).Hash.ToLowerInvariant()) { throw 'Invalid native module hash.' }
        $dumpbin = Get-Command dumpbin.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source
        if (!$dumpbin) {
            $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
            $dumpbin = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -find 'VC/Tools/MSVC/*/bin/Hostx64/x64/dumpbin.exe' | Select-Object -Last 1
        }
        if (!$dumpbin) { throw 'MSVC dumpbin.exe is required to verify the actual PE imports.' }
        $imports = & $dumpbin /nologo /dependents $packaged
        if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the packaged PE imports.' }
        & (Join-Path $PSScriptRoot 'assert-system-imports.ps1') -Report $imports
        $probe = @'
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const path = require('node:path');
const run = require(process.argv[2]);
const windowsPowerShell = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
const command = [
    "Add-Type -Namespace SynkTrayBuild -Name ProcessClock -MemberDefinition '[System.Runtime.InteropServices.DllImport(\"kernel32.dll\", SetLastError=true)] public static extern bool GetProcessTimes(System.IntPtr process, out long created, out long exited, out long kernel, out long user);'",
    '$p=Get-Process -Id ' + process.pid + ' -ErrorAction Stop',
    '$created=0L; $exited=0L; $kernel=0L; $user=0L',
    "if(![SynkTrayBuild.ProcessClock]::GetProcessTimes($p.Handle,[ref]$created,[ref]$exited,[ref]$kernel,[ref]$user)){throw 'Could not read the birth FILETIME'}",
    '$created'
].join(';');
const ticks = BigInt(execFileSync(windowsPowerShell, ['-NoProfile', '-NonInteractive', '-Command', command], {
    encoding: 'utf8', windowsHide: true, timeout: 30000
}).trim());
const born = (ticks - 116444736000000000n) / 10000n;
assert.ok(born > 0n && born <= BigInt(Date.now()));
assert.equal(typeof run, 'function');
assert.equal(run('cancel'), 0);
assert.equal(run('next'), 2);
assert.equal(run(process.pid + ':' + born), 3, 'A non-Platform host with a valid PID and creation time must be refused');
'@
        $probe | node - $packaged
        if ($LASTEXITCODE -ne 0) { throw 'The native module failed the Node-API load or host guard probe.' }
    } else {
        New-Item -ItemType Directory -Force -Path $directory | Out-Null
        $newHash = (Get-FileHash -LiteralPath $built).Hash.ToLowerInvariant()
        if (!(Test-Path -LiteralPath $packaged) -or (Get-FileHash -LiteralPath $packaged).Hash -ine $newHash) {
            try { Copy-Item -LiteralPath $built -Destination $packaged -ErrorAction Stop }
            catch { throw ('Could not replace the development module. Close any development process using this copy and retry. ' + $_.Exception.Message) }
        }
        [System.IO.File]::WriteAllText($pin, $newHash + [char]10)
    }
    (Get-FileHash -LiteralPath $packaged).Hash
} finally {
    $env:CARGO_ENCODED_RUSTFLAGS = $originalFlags
    Pop-Location
}
