$ErrorActionPreference = 'Stop'
$runnerVoiceRoot = Split-Path -Parent $PSScriptRoot
$runnerVoiceJobs = Get-Content -LiteralPath (Join-Path $runnerVoiceRoot 'assets/voice/jobs.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$runnerVoiceFolder = Join-Path $runnerVoiceRoot 'assets/voice'
Add-Type -AssemblyName System.Speech
$runnerVoiceSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$runnerVoiceSynth.SelectVoice('Microsoft Heami Desktop')
$runnerVoiceSynth.Rate = 0
try {
  foreach ($runnerVoiceJob in $runnerVoiceJobs) {
    $runnerVoiceWave = Join-Path $runnerVoiceFolder ($runnerVoiceJob.id + '.wav')
    $runnerVoiceMp3 = Join-Path $runnerVoiceFolder ($runnerVoiceJob.id + '.mp3')
    if (Test-Path -LiteralPath $runnerVoiceMp3) { continue }
    $runnerVoiceSynth.SetOutputToWaveFile($runnerVoiceWave)
    $runnerVoiceSynth.Speak($runnerVoiceJob.text)
    $runnerVoiceSynth.SetOutputToNull()
    & ffmpeg -hide_banner -loglevel error -n -i $runnerVoiceWave -codec:a libmp3lame -b:a 64k $runnerVoiceMp3
    if ($LASTEXITCODE -ne 0) { throw ('음성 변환 실패: ' + $runnerVoiceJob.id) }
  }
} finally { $runnerVoiceSynth.Dispose() }
Write-Output ('Korean instruction clips: ' + $runnerVoiceJobs.Count)
& python (Join-Path $PSScriptRoot 'build-voice-manifest.py')
if ($LASTEXITCODE -ne 0) { throw '음성 메타데이터 생성 실패' }
