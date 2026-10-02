param([string]$Voice = 'Microsoft Heami Desktop', [string]$JobsFile = 'jobs.json')
$ErrorActionPreference = 'Stop'
$raceRoot = Split-Path -Parent $PSScriptRoot
$raceJobs = Get-Content -LiteralPath (Join-Path $raceRoot ('audio-source/' + $JobsFile)) -Raw -Encoding UTF8 | ConvertFrom-Json
$raceWavDirectory = Join-Path $raceRoot 'audio-source/wav'
New-Item -ItemType Directory -Path $raceWavDirectory -Force | Out-Null
Add-Type -AssemblyName System.Speech
$raceSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$raceSynth.SelectVoice($Voice)
$raceSynth.Rate = -1
$raceCount = 0
try {
  foreach ($raceJob in $raceJobs) {
    $raceTarget = Join-Path $raceWavDirectory ($raceJob.id + '.wav')
    if (-not (Test-Path -LiteralPath $raceTarget)) {
      $raceSynth.SetOutputToWaveFile($raceTarget)
      $raceSynth.Speak($raceJob.text)
      $raceSynth.SetOutputToNull()
    }
    $raceCount++
    if ($raceCount % 250 -eq 0) { Write-Output "Korean narration: $raceCount / $($raceJobs.Count)" }
  }
} finally { $raceSynth.Dispose() }
Write-Output "Rendered $raceCount narration WAV files with $Voice"
