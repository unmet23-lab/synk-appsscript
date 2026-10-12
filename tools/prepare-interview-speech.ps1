param([switch]$FixtureOnly)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
if (-not $FixtureOnly) {
    python (Join-Path $PSScriptRoot 'prepare-interview-speech.py')
    if ($LASTEXITCODE -ne 0) { throw 'Speech model preparation failed.' }
}
# Synthetic local fixture, not a recording of any user. No network TTS call.
$fixtureDir = Join-Path $taskRoot 'experiences/path-vr/models/fixtures'
New-Item -ItemType Directory -Force -Path $fixtureDir | Out-Null
Add-Type -AssemblyName System.Speech
$taskSpeech = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $taskSpeech.SelectVoice('Microsoft Heami Desktop')
    $taskSpeech.Rate = -1
    $taskFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
    $taskSpeech.SetOutputToWaveFile((Join-Path $fixtureDir 'interview-ko.wav'), $taskFormat)
    $taskSpeech.Speak('안녕하세요. 저는 한국어를 공부하고 있습니다. 저는 회사에서 일하고 싶습니다. 감사합니다.')
} finally { $taskSpeech.Dispose() }
