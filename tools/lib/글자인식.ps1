# 윈도우 내장 글자 인식(Windows.Media.Ocr)으로 폴더 안 그림(.png·.jpg)의 글자 줄과 낱말 상자를 JSON으로 낸다(2026-10-21).
# tools/올리기전검사.js가 영상 장면·표지의 글자 크기와 안전 영역을 잴 때 부른다. 읽기만 하고 그림을 바꾸지 않는다.
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\lib\글자인식.ps1 -Dir <그림 폴더> [-Lang ko]
# Windows PowerShell 5.1(powershell.exe)에서만 돈다 — PowerShell 7(pwsh)은 WinRT 형식을 못 부른다.
# 이 PC의 인식 언어는 ko 하나다. 한국어 엔진은 영어·숫자도 읽고, 키릴·버마 문자는 글자는 틀려도 줄 위치는 잡는다.
param([Parameter(Mandatory = $true)][string]$Dir, [string]$Lang = 'ko')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$type) { $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $task.Wait() | Out-Null; $task.Result }
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new($Lang))
if ($null -eq $engine) { [Console]::Error.WriteLine("글자 인식 언어 '$Lang'이 이 PC에 없습니다."); exit 3 }
$out = @()
foreach ($item in Get-ChildItem -LiteralPath $Dir -File | Where-Object { $_.Extension -in '.png', '.jpg', '.jpeg' } | Sort-Object Name) {
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($item.FullName)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  try {
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $lines = @()
    foreach ($line in $result.Lines) {
      $words = @($line.Words | ForEach-Object { @{ t = $_.Text; x = [int]$_.BoundingRect.X; y = [int]$_.BoundingRect.Y; w = [int]$_.BoundingRect.Width; h = [int]$_.BoundingRect.Height } })
      $lines += , @{ text = $line.Text; words = $words }
    }
    $out += , @{ name = $item.Name; width = $bitmap.PixelWidth; height = $bitmap.PixelHeight; lines = $lines }
  } finally { $stream.Dispose() }
}
[Console]::OutputEncoding = [Text.Encoding]::UTF8
ConvertTo-Json -InputObject $out -Depth 6 -Compress
