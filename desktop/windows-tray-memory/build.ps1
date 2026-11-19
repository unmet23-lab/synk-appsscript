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
    $built = Join-Path $PSScriptRoot 'target/x86_64-pc-windows-msvc/release/synk-tray-memory.exe'
    $directory = Join-Path (Split-Path $PSScriptRoot) 'src/native'
    $packaged = Join-Path $directory 'tray-memory-win-x64.exe'
    if ($Verify) {
        if (!(Test-Path -LiteralPath $packaged) -or (Get-FileHash -LiteralPath $built).Hash -ne (Get-FileHash -LiteralPath $packaged).Hash) {
            throw 'Packaged helper differs from this build.'
        }
        $dumpbin = Get-Command dumpbin.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source
        if (!$dumpbin) {
            $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
            $dumpbin = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -find 'VC/Tools/MSVC/*/bin/Hostx64/x64/dumpbin.exe' | Select-Object -Last 1
        }
        if (!$dumpbin) { throw 'MSVC dumpbin.exe is required to verify the actual PE imports.' }
        $imports = & $dumpbin /nologo /dependents $packaged
        if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the packaged PE imports.' }
        & (Join-Path $PSScriptRoot 'assert-system-imports.ps1') -Report $imports
        $probe = Start-Process -FilePath $packaged -ArgumentList '--verify-runtime' -WindowStyle Hidden -PassThru -Wait
        if ($probe.ExitCode -ne 0) { throw 'The packaged helper did not run without the Visual C++ runtime loaded.' }
    } else {
        New-Item -ItemType Directory -Force -Path $directory | Out-Null
        Copy-Item -LiteralPath $built -Destination $packaged
    }
    (Get-FileHash -LiteralPath $packaged).Hash
} finally {
    $env:CARGO_ENCODED_RUSTFLAGS = $originalFlags
    Pop-Location
}
