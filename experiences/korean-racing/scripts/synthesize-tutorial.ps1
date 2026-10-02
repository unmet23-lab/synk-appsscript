param([string]$ClipId = '')
$ErrorActionPreference = 'Stop'
$tutorialRoot = Split-Path -Parent $PSScriptRoot
$tutorialJobs = Get-Content -LiteralPath (Join-Path $tutorialRoot 'audio-source/tutorial-jobs.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($tutorialJobs.Count -ne 9) { throw 'Expected nine tutorial narration clips.' }
$tutorialSelectedJobs = @($tutorialJobs | Where-Object { -not $ClipId -or $_.id -eq $ClipId })
if (-not $tutorialSelectedJobs.Count) { throw 'Unknown tutorial clip id.' }
Add-Type -AssemblyName System.Speech
$tutorialSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$tutorialSynth.SelectVoice('Microsoft Heami Desktop')
$tutorialSynth.Rate = -1
try {
  foreach ($tutorialJob in $tutorialSelectedJobs) {
    if ($tutorialJob.id -notmatch '^tutorial-(welcome|right|listen|choices|retry|correct|boost|finish|go)$') { throw 'Unexpected tutorial id.' }
    $tutorialWav = Join-Path $tutorialRoot ('audio-source/wav/' + $tutorialJob.id + '.wav')
    $tutorialMp3 = Join-Path $tutorialRoot ('assets/narration/' + $tutorialJob.id + '.mp3')
    # SetOutputToWaveFile and ffmpeg -y overwrite these owned clips only.
    $tutorialSynth.SetOutputToWaveFile($tutorialWav)
    $tutorialSynth.Speak($tutorialJob.text)
    $tutorialSynth.SetOutputToNull()
    & ffmpeg -hide_banner -loglevel error -nostdin -y -i $tutorialWav -ac 1 -ar 24000 -codec:a libmp3lame -b:a 48k $tutorialMp3
    if ($LASTEXITCODE -ne 0) { throw ('MP3 encoding failed: ' + $tutorialJob.id) }
  }
} finally { $tutorialSynth.Dispose() }
& python (Join-Path $PSScriptRoot 'encode-narration.py') tutorial-jobs.json tutorial-manifest.json
if ($LASTEXITCODE -ne 0) { throw 'Tutorial manifest encoding failed.' }
& python (Join-Path $PSScriptRoot 'verify-tutorial-audio.py')
if ($LASTEXITCODE -ne 0) { throw 'Tutorial MP3 verification failed.' }
