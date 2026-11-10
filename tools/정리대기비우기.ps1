<#
정리대기 비우기 — 정리 대기(D:\SYNK_정리대기, 11-10 전에는 %USERPROFILE%\SYNK_정리대기) 안에 옮겨 둔 것을 보고, 고른 것만 영구 삭제한다.

SYNK 작업(날마다 도는 .tmp 자동 정리, 매달 1일 .tmp 정리 예약, 10-21 tools 정리 등)은 파일을 바로 지우지 않고 이 폴더로 옮겨 둔다.
영구 삭제는 유호님이 이 스크립트로 직접 한다(Claude는 영구 삭제를 하지 않는다).
잘못 옮겨진 임시 폴더는 지우지 말고 `node tools/tmp자동정리.js --되돌리기 <이름> --실행`으로 .tmp 제자리에 되돌린다.

쓰기(앱 안 터미널에서 그대로 실행 단추를 눌러도 된다)
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\정리대기비우기.ps1
      목록만 본다. 아무것도 지우지 않는다.
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\정리대기비우기.ps1 -Name 20261021_tools잔재
      그 항목 하나를 보여 주고 「지울까요?」에 예라고 하면 지운다. 이름은 쉼표로 여럿 줄 수 있다.
  ... -All    정리대기 안의 것을 모두 보여 주고 지운다(들어온 지 7일이 안 된 것은 남긴다 — -MinDays 로 바꾼다).
  ... -Yes    「지울까요?」를 묻지 않는다(-Name·-All과 함께).

지키는 것
  - 정리대기 폴더 바로 아래 항목만 지운다. 이름에 \ / .. 가 있거나 정리대기 밖을 가리키면 멈춘다.
  - 안에 연결 폴더(junction·심볼릭 링크)가 있어도 링크만 지우고 링크가 가리키는 원본은 건드리지 않는다
    (크기를 잴 때도 링크 안으로 들어가지 않는다. 폴더는 rmdir /s로 지운다 — 링크를 따라가지 않는다).
  - 휴지통을 거치지 않는 영구 삭제다. 지운 뒤 남은 것이 있으면(쓰는 중인 파일 등) 그 이름을 알려 준다.
#>
[CmdletBinding()]
param(
  [string[]]$Name,
  [switch]$All,
  [switch]$Yes,
  [string]$Root,
  [int]$MinDays = 7
)
$ErrorActionPreference = 'Stop'
$링크 = [IO.FileAttributes]::ReparsePoint
# 11-10부터 tools/tmp자동정리.js가 정리 대기를 D:로 내려놓는다(C: 여유가 바로 늘게). -Root를 안 주면 D:에 든 것이 있을 때 거기를 보고,
# 없으면 예전 자리(C:)를 본다. 다른 자리에도 남은 것이 있으면 한 줄로 알린다.
$가까운 = Join-Path $env:USERPROFILE 'SYNK_정리대기'
$먼 = 'D:\SYNK_정리대기'
if (-not $Root) {
  $먼것 = @(if (Test-Path -LiteralPath $먼) { Get-ChildItem -LiteralPath $먼 -Force -Directory })
  $Root = if ($먼것.Count) { $먼 } else { $가까운 }
  $다른 = if ($Root -eq $먼) { $가까운 } else { $먼 }
  if ((Test-Path -LiteralPath $다른) -and @(Get-ChildItem -LiteralPath $다른 -Force -Directory).Count) {
    Write-Host "다른 자리에도 남은 것이 있어요: $다른 (보려면 -Root `"$다른`" 을 붙이세요)"
  }
}

function Measure-Item([IO.FileSystemInfo]$Item) {
  if ($Item.Attributes -band $링크) { return [pscustomobject]@{ Bytes = 0; Files = 0; Links = 1 } }
  if (-not ($Item -is [IO.DirectoryInfo])) { return [pscustomobject]@{ Bytes = $Item.Length; Files = 1; Links = 0 } }
  $bytes = [long]0; $files = 0; $links = 0
  $stack = New-Object System.Collections.Stack
  $stack.Push($Item)
  while ($stack.Count -gt 0) {
    $dir = $stack.Pop()
    try { $entries = $dir.GetFileSystemInfos() } catch { continue }
    foreach ($e in $entries) {
      if ($e.Attributes -band $링크) { $links++; continue }
      if ($e -is [IO.DirectoryInfo]) { $stack.Push($e) } else { $bytes += $e.Length; $files++ }
    }
  }
  [pscustomobject]@{ Bytes = $bytes; Files = $files; Links = $links }
}

function Format-Size([long]$Bytes) {
  if ($Bytes -ge 1GB) { return '{0:N2} GB' -f ($Bytes / 1GB) }
  if ($Bytes -ge 1MB) { return '{0:N1} MB' -f ($Bytes / 1MB) }
  return '{0:N0} KB' -f [math]::Ceiling($Bytes / 1KB)
}

function Show-Items($Items) {
  $total = [long]0
  $rows = foreach ($i in $Items) {
    $m = Measure-Item $i
    $total += $m.Bytes
    [pscustomobject]@{
      '이름'      = $i.Name
      '크기'      = Format-Size $m.Bytes
      '파일 수'   = $m.Files
      '연결 폴더' = $(if ($m.Links) { "$($m.Links)개(원본은 안 지움)" } else { '' })
      '마지막 수정' = $i.LastWriteTime.ToString('yyyy-MM-dd HH:mm')
    }
  }
  $rows | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
  Write-Host ("합계 {0} · {1}개" -f (Format-Size $total), @($Items).Count)
}

if (-not (Test-Path -LiteralPath $Root)) { Write-Host "정리대기 폴더가 없어요: $Root"; exit 0 }
$rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
# 이름이 _ 로 시작하는 것은 자동 정리가 쓰는 자리다(_크기.json · 되돌리다 멈춘 _되돌리는중) — 보이지도 지우지도 않는다
$items = @(Get-ChildItem -LiteralPath $Root -Force | Where-Object { -not $_.Name.StartsWith('_') })
if ($items.Count -eq 0) { Write-Host "정리대기 폴더가 비어 있어요: $Root"; exit 0 }

if (-not $All -and -not $Name) {
  Write-Host "정리대기 폴더: $Root"
  Show-Items $items
  Write-Host '지우려면 -Name <이름>(쉼표로 여럿) 또는 -All 을 붙여서 다시 실행하세요.'
  exit 0
}

if ($All) {
  # 자동 정리가 사람이 고르지 않은 것을 날마다 넣는다 — 들어온 지 $MinDays일이 안 된 것은 -All에서 빼고 알린다
  # (그사이 「그 폴더가 없다」는 도구가 나오면 지우지 말고 되돌린다). 이름을 대면(-Name) 날짜와 상관없이 지운다.
  $기준 = (Get-Date).AddDays(-$MinDays)
  $새것 = @($items | Where-Object { $_.LastWriteTime -gt $기준 })
  $targets = @($items | Where-Object { $_.LastWriteTime -le $기준 })
  if ($새것.Count) {
    Write-Host ("들어온 지 {0}일이 안 된 {1}개는 남겨요: {2}" -f $MinDays, $새것.Count, (($새것 | ForEach-Object { $_.Name }) -join ', '))
    Write-Host '  (지우려면 -Name 으로 이름을 대거나 -MinDays 0 을 붙이세요)'
  }
  if ($targets.Count -eq 0) { Write-Host '지금 지울 것이 없어요.'; exit 0 }
} else {
  $targets = foreach ($n in ($Name | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })) {
    if ($n -match '[\\/]' -or $n -match '\.\.') { throw "이름에 경로 문자가 있어요(정리대기 바로 아래 이름만 줄 수 있어요): $n" }
    $p = Join-Path $Root $n
    if (-not (Test-Path -LiteralPath $p)) { throw "정리대기에 없어요: $n" }
    Get-Item -LiteralPath $p -Force
  }
  $targets = @($targets)
}
foreach ($t in $targets) {
  $full = [IO.Path]::GetFullPath($t.FullName)
  if (-not $full.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase) -or $full.TrimEnd('\') -eq $rootFull.TrimEnd('\')) {
    throw "정리대기 바로 아래가 아니에요: $full"
  }
}

Write-Host '지울 것:'
Show-Items $targets
if (-not $Yes) {
  $answer = Read-Host '위 항목을 영구 삭제할까요? 휴지통에 남지 않아요. (예/아니요)'
  if ($answer.Trim() -notin @('예', 'ㅇ', 'y', 'Y', 'yes', 'Yes')) { Write-Host '지우지 않았어요.'; exit 0 }
}

$left = @()
foreach ($t in $targets) {
  $path = $t.FullName
  if ($t.Attributes -band $링크) {
    # 링크 자체만 지운다(가리키는 원본은 그대로).
    if ($t -is [IO.DirectoryInfo]) { [IO.Directory]::Delete($path) } else { [IO.File]::Delete($path) }
  } elseif ($t -is [IO.DirectoryInfo]) {
    & cmd.exe /d /c "rmdir /s /q `"$path`"" | Out-Null
  } else {
    Remove-Item -LiteralPath $path -Force
  }
  if (Test-Path -LiteralPath $path) { $left += $t.Name; Write-Host "다 지우지 못했어요(쓰는 중인 파일이 있을 수 있어요): $($t.Name)" }
  else { Write-Host "지웠어요: $($t.Name)" }
}
if ($left.Count) { exit 1 }
