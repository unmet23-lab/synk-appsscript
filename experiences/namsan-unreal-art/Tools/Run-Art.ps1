param(
    [ValidateSet('Compare','Import','Render','Open')][string]$Action='Compare',
    [string]$EngineRoot='C:/Program Files/Epic Games/UE_5.8'
)
$ErrorActionPreference='Stop'
$artProjectRoot=Split-Path -Parent $PSScriptRoot
$artProject=Join-Path $artProjectRoot 'NamsanUnrealArt.uproject'
$artEditor=Join-Path $EngineRoot 'Engine/Binaries/Win64/UnrealEditor.exe'
if(-not (Test-Path -LiteralPath $artEditor)) {
    throw "Unreal Editor is not yet installed at $EngineRoot. Finish the engine installation first. This art project does not require the Namsan C++ build."
}
$artQa=Join-Path $artProjectRoot 'QA'
New-Item -ItemType Directory -Path $artQa -Force | Out-Null

function Invoke-ArtStep([string]$Step) {
    $scriptFile=if($Step -eq 'Import'){'build_art.py'}else{'render_art.py'}
    $scriptPath=Join-Path $artProjectRoot ('Content/Python/'+$scriptFile)
    $logPath=Join-Path $artQa ('unreal-art-'+$Step.ToLowerInvariant()+'.log')
    $started=Get-Date
    $engineArgs=@(('"'+$artProject+'"'),('-ExecutePythonScript="'+$scriptPath+'"'),('-abslog="'+$logPath+'"'),'-unattended','-nosplash','-nosound','-stdout')
    # This must be the full rendering Editor: -NullRHI and Python commandlets
    # cannot produce the same real, lit viewport screenshots.
    $process=Start-Process -FilePath $artEditor -ArgumentList $engineArgs -WindowStyle Hidden -Wait -PassThru
    if($process.ExitCode -ne 0){throw "Unreal art $Step failed ($($process.ExitCode)); see $logPath"}
    $reportName=if($Step -eq 'Import'){'unreal-import-report.json'}else{'Unreal/render-report.json'}
    $reportPath=Join-Path $artQa $reportName
    if(-not (Test-Path -LiteralPath $reportPath)){throw "Editor exited without a $Step report; see $logPath"}
    if((Get-Item -LiteralPath $reportPath).LastWriteTime -lt $started){throw "$Step did not produce a fresh report; see $logPath"}
    $report=Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
    if($report.error){throw $report.error}
    if($Step -eq 'Import') {
        if(-not $report.art_only -or $report.game_mode -ne '/Script/Engine.GameModeBase'){
            throw 'Art import report unexpectedly depends on the gameplay C++ module.'
        }
    } else {
        if(@($report.files).Count -ne 3){throw 'Expected three newly rendered comparison PNGs.'}
        foreach($frame in $report.frames) {
            if(-not (Test-Path -LiteralPath $frame.path)){throw "Missing rendered frame: $($frame.path)"}
            $actualHash=(Get-FileHash -LiteralPath $frame.path -Algorithm SHA256).Hash.ToLowerInvariant()
            if($actualHash -ne $frame.sha256){throw "Rendered frame hash does not match report: $($frame.path)"}
        }
    }
    Get-Content -LiteralPath $reportPath
}

if($Action -eq 'Compare') {
    Invoke-ArtStep 'Import'
    Invoke-ArtStep 'Render'
} elseif($Action -eq 'Open') {
    # Visible Editor is intentional for the user to inspect the generated art.
    $artMap=Join-Path $artProjectRoot 'Content/Namsan/Maps/Namsan.umap'
    if(-not (Test-Path -LiteralPath $artMap)){throw 'Run Compare or Import before opening the generated art scene.'}
    Start-Process -FilePath $artEditor -ArgumentList @(('"'+$artProject+'"'),'/Game/Namsan/Maps/Namsan')
} else {
    Invoke-ArtStep $Action
}
