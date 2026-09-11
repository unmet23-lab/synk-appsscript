param([string]$OutputDirectory = (Join-Path $env:LOCALAPPDATA 'SYNK/patent-studio/samples'))
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$studioVoice = New-Object -ComObject SAPI.SpVoice
$studioVoice.Voice = $studioVoice.GetVoices() | Where-Object { $_.GetDescription() -match 'Heami' } | Select-Object -First 1
$studioTexts = [ordered]@{
  'original.wav' = '친구를 만나서 카페에 갔어요.'
  'assisted.wav' = '친구를 만나서 카페에 갔어요.'
  'unexpected.wav' = '오늘은 집에서 쉬었어요.'
}
$studioFiles = @()
foreach ($studioEntry in $studioTexts.GetEnumerator()) {
  $studioTarget = Join-Path $OutputDirectory $studioEntry.Key
  $studioStream = New-Object -ComObject SAPI.SpFileStream
  $studioStream.Open($studioTarget,3,$false)
  $studioVoice.AudioOutputStream = $studioStream
  $null = $studioVoice.Speak($studioEntry.Value)
  $studioStream.Close()
  $studioFiles += [ordered]@{file=$studioEntry.Key;text=$studioEntry.Value;sha256=(Get-FileHash -LiteralPath $studioTarget -Algorithm SHA256).Hash.ToLower();bytes=(Get-Item -LiteralPath $studioTarget).Length}
}
[ordered]@{
  kind='synthetic-speech'; generator='Windows SAPI / Microsoft Heami Desktop'; createdAt=(Get-Date).ToUniversalTime().ToString('o')
  origin='Generated solely from the literal demonstration strings in tools/patent-studio/make-samples.ps1. No microphone, student recording, account text, or private source was read.'
  intendedUse='Local demonstration and one actual audio-transcription integration check requested by the user.'
  files=$studioFiles
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'manifest.json') -Encoding utf8
Get-ChildItem -LiteralPath $OutputDirectory | Select-Object Name,Length
