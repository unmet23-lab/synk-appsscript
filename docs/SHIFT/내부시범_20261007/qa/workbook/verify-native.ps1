$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
$inputPath = Join-Path $PSScriptRoot '../../workbook-input.json'
$data = Get-Content -LiteralPath $inputPath -Raw | ConvertFrom-Json
$target = $manifest.output
$before = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
$checks = [System.Collections.Generic.List[object]]::new()
$excel = $null; $book = $null
function Check([string]$Sheet, [string]$Cell, $Expected, [string]$Name) {
  $actual = $book.Worksheets.Item($Sheet).Range($Cell).Value2
  $ok = if ($null -eq $Expected) { $null -eq $actual -or $actual -eq '' } elseif ($Expected -is [string]) { $actual -eq $Expected } else { $null -ne $actual -and [Math]::Abs([double]$actual - [double]$Expected) -lt 0.00000001 }
  $checks.Add(@{ name=$Name; sheet=$Sheet; cell=$Cell; expected=$Expected; actual=$actual; passed=$ok })
  if (-not $ok) { throw "$Name failed at ${Sheet}!${Cell}." }
}
function Put([string]$Sheet, [string]$Cell, $Value) {
  $range = $book.Worksheets.Item($Sheet).Range($Cell)
  if ($null -eq $Value) { $range.ClearContents() } elseif ($Value -is [string]) { $range.Value2 = [string]$Value } else { $range.Value2 = [double]$Value }
}
function ScanErrors {
  $errors = @()
  foreach ($sheet in $book.Worksheets) {
    try { $bad = $sheet.UsedRange.SpecialCells(-4123, 16); if ($bad) { $errors += "$($sheet.Name):$($bad.Address())" } }
    catch [System.Runtime.InteropServices.COMException] { }
  }
  if ($errors.Count) { throw 'Unexpected formula errors in the pilot workbook.' }
  return $errors
}
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false; $excel.DisplayAlerts = $false; $excel.AskToUpdateLinks = $false
  $book = $excel.Workbooks.Open($target, 0, $true)
  $excel.CalculateFullRebuild()
  $errors = @(ScanErrors)
  Check '요약' 'D8' 1 '기존 실제 AI 시행'
  Check '요약' 'E8' 1 '개인화 실제 AI 시행'
  Check '요약' 'D9' 1 '기존 AI 과업 완료'
  Check '요약' 'E9' 1 '개인화 AI 과업 완료'
  Check '요약' 'D10' 1.65 '기존 AI 경과시간 99초'
  Check '요약' 'E10' (77.0/60) '개인화 AI 경과시간 77초'
  Check '요약' 'F10' (-22.0/60) '관찰 차이 정확히 22초'
  foreach ($cell in @('D11','E11','D17','E17')) { Check '요약' $cell 0 '검수 오류 또는 입력확인 없음' }
  foreach ($cell in @('D12','E12','H8','I8','D35','D36','D40','E40','D41','D42','E45','E48')) { Check '요약' $cell $null '미측정 결과 공란 유지' }
  Check '요약' 'D38' '미완료' '원가 미측정 표시'
  foreach ($row in @(7,8)) { Check '시행기록' "N$row" '집계' '실제 시행 집계 상태'; Check '시행기록' "K$row" $null '사람 전환 원자료 공란' }
  $unusedInputRanges = @(@('업무범위','D7:D30'), @('시행기록','A9:M66'), @('원가기록','A7:L66'), @('재사용기록','A7:I31'), @('판단기록','D7:D18'))
  $unmeasuredCells = 0
  foreach ($pair in $unusedInputRanges) { foreach ($cell in $book.Worksheets.Item($pair[0]).Range($pair[1]).Cells) { $unmeasuredCells++; if ($null -ne $cell.Value2 -and $cell.Value2 -ne '') { throw "Unmeasured input is populated in $($pair[0])." } } }
  Check '업무범위' 'B25' $null '비용 한도 미확정'
  Check '업무범위' 'B26' $null '실제 매출 미측정'
  Put '시행기록' 'I8' $null; $excel.CalculateFullRebuild()
  Check '요약' 'E18' 0 'AI 시간 누락의 측정 분모'
  Check '요약' 'E10' $null '누락 시간이 0분으로 바뀌지 않음'
  Put '시행기록' 'I8' 0; $excel.CalculateFullRebuild()
  Check '요약' 'E18' 1 '명시적 0분의 측정 분모'
  Check '요약' 'E10' 0 '명시적 0분 보존'
  Put '시행기록' 'I8' (77.0/60)
  Put '시행기록' 'J8' $null; $excel.CalculateFullRebuild()
  Check '요약' 'E19' 0 '오류 누락의 별도 측정 분모'
  Check '요약' 'E11' $null '오류 미측정은 오류 0이 아님'
  Put '시행기록' 'J8' 0
  Put '시행기록' 'G8' 'QA-VERSION'; $excel.CalculateFullRebuild()
  Check '시행기록' 'N8' '입력확인' '서로 다른 원고 버전 혼합 방지'
  Check '요약' 'E8' 0 '버전 불일치 시행 집계 제외'
  Put '시행기록' 'G8' $data.version
  Put '시행기록' 'A8' 'RUN-BASE-01'; $excel.CalculateFullRebuild()
  Check '시행기록' 'N7' '입력확인' '중복 시행 ID 첫 기록 표시'
  Check '시행기록' 'N8' '입력확인' '중복 시행 ID 둘째 기록 표시'
  Put '시행기록' 'A8' 'RUN-PERS-01'
  Put '시행기록' 'H8' '실패'; $excel.CalculateFullRebuild()
  Check '요약' 'E8' 1 '실패는 시행 분모에 포함'
  Check '요약' 'E9' 0 '실패는 완료로 계산하지 않음'
  Put '시행기록' 'H8' '완료'; $excel.CalculateFullRebuild()
  Check '요약' 'E10' (77.0/60) '처음 실측값 복원 후 재계산'
  Check '시행기록' 'N8' '집계' '복원한 시행은 정상 집계'
  $errors = @(ScanErrors)
  $clipped = @()
  foreach ($name in @('업무범위','판단기록','시행기록')) {
    $sheet = $book.Worksheets.Item($name)
    $rows = if ($name -eq '업무범위') { 7..30 } elseif ($name -eq '판단기록') { 7..18 } else { @(7,8) }
    foreach ($rowNumber in $rows) {
      $row = $sheet.Rows.Item($rowNumber)
      $height = [double]$row.RowHeight
      [void]$row.AutoFit()
      if ([double]$row.RowHeight -gt $height + 1) { $clipped += @{sheet=$name;row=$rowNumber;current=$height;required=[double]$row.RowHeight} }
    }
  }
  $validations = @{trialCustomer=$book.Worksheets.Item('시행기록').Range('B7').Validation.Formula1;trialResult=$book.Worksheets.Item('시행기록').Range('H7').Validation.Formula1;costClassification=$book.Worksheets.Item('원가기록').Range('E7').Validation.Formula1;reuse=$book.Worksheets.Item('재사용기록').Range('E7').Validation.Formula1}
  $result = @{application='Microsoft Excel';status='real-ai-run-values-and-in-memory-perturbations-verified';readOnly=$book.ReadOnly;saved=$false;checks=$checks;unmeasuredInputCells=$unmeasuredCells;formulaErrors=$errors;clippedRows=$clipped;validations=$validations;sheets=@($book.Worksheets | ForEach-Object{$_.Name});sourceSha256=$before;humanTrialRun=$false;realCustomerTrialRun=$false}
  $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'native-excel.json') -Encoding utf8
  Write-Output "Native Excel: $($checks.Count) checks; unmeasured input cells=$unmeasuredCells; formula errors=$($errors.Count); clipped rows=$($clipped.Count)."
} finally {
  if ($book) { $book.Close($false); [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($book) }
  if ($excel) { $excel.Quit(); [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel) }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
$after = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
if ($after -ne $before) { throw 'Output workbook changed during read-only Excel verification.' }
Write-Output 'Delivery preserved byte for byte; disposable input perturbations not saved.'
