param([string[]]$OnlyIds = @())
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskBank = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'voice-bank.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($OnlyIds.Count -gt 0) {
 foreach ($taskId in $OnlyIds) { if ($taskId -notin $taskBank.id) { throw "Unknown order ID: $taskId" } }
 $taskBank = @($taskBank | Where-Object { $_.id -in $OnlyIds })
}
$taskSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$taskSynth.SelectVoice('Microsoft Heami Desktop')
$taskSynth.Rate = -1
$taskSynth.Volume = 100
try {
 foreach ($taskOrder in $taskBank) {
  $taskWav = Join-Path $taskRoot ('audio/' + $taskOrder.id + '.wav')
  $taskSynth.SetOutputToWaveFile($taskWav)
  $taskSynth.Speak($taskOrder.text)
  $taskSynth.SetOutputToNull()
 }
} finally { $taskSynth.Dispose() }
Write-Output ('Saved ' + $taskBank.Count + ' Korean synthetic order clips.')
