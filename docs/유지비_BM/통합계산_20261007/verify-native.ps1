$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent (Split-Path -Parent $taskRoot)
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'qa/manifest.json') -Raw | ConvertFrom-Json
$bookPath = $manifest.output
$qaPath = Join-Path $PSScriptRoot 'qa/native-excel.json'
$excel = $null
$book = $null
$checks = [System.Collections.Generic.List[object]]::new()
function Check-Cell([string]$Sheet,[string]$Cell,$Expected,[string]$Name) {
    $actual = $book.Worksheets.Item($Sheet).Range($Cell).Value2
    $ok = if ($Expected -is [string]) { $actual -eq $Expected -or ($Expected -eq '' -and $null -eq $actual) } else { $null -ne $actual -and [Math]::Abs([double]$actual-[double]$Expected) -lt 0.0000001 }
    $checks.Add(@{name=$Name;sheet=$Sheet;cell=$Cell;expected=$Expected;actual=$actual;passed=$ok})
    if (-not $ok) { throw "$Name failed at ${Sheet}!${Cell}: $actual" }
}
function Product-Rows([string]$Id) {
    $entry=$manifest.productRowsById.$Id
    if (-not $entry) {throw "Unknown product ID: $Id"}
    Check-Cell '상품목록' "C$($entry.catalog)" $Id "$Id catalog identity"
    return $entry
}
function Set-Input($Entry,[int]$Offset,$Value,[string]$Column='F') {
    $cell=$book.Worksheets.Item('월별상품').Range("${Column}$([int]$Entry.input+$Offset)")
    if($null -eq $Value){$cell.ClearContents()}else{$cell.Value2=[double]$Value}
}
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.AskToUpdateLinks = $false
    $book = $excel.Workbooks.Open($bookPath,0,$true)
    $excel.CalculateFullRebuild()
    $issues = @()
    foreach ($sh in $book.Worksheets) {
        try { $bad = $sh.UsedRange.SpecialCells(-4123,16); if ($bad) {$issues += "$($sh.Name):$($bad.Address())"} } catch [System.Runtime.InteropServices.COMException] {}
    }
    if ($issues.Count) {throw "Formula errors: $($issues -join ', ')"}
    foreach($id in $manifest.currentShift){
        $entry=Product-Rows $id
        foreach($col in @('F','L','Q')){
            Check-Cell '월별상품' "${col}$([int]$entry.input+1)" '' "$id $col unspecified quantity"
            Check-Cell '월별상품' "${col}$([int]$entry.input+2)" '' "$id $col unspecified price"
            Check-Cell '상품계산' "${col}$([int]$entry.calculation+1)" '' "$id $col unavailable revenue"
        }
    }
    Check-Cell '월별손익' 'F9' '' 'initial SHIFT revenue unavailable'
    Check-Cell '월별손익' 'F13' '' 'initial company revenue unavailable'
    Check-Cell '요약' 'F24' 3 'three current SHIFT monetary inputs missing'
    Check-Cell '월별손익' 'F26' '' 'unknown cost remains blank'
    Check-Cell '월별손익' 'F48' '' 'unknown opening cash remains blank'
    foreach($id in $manifest.currentShift){$entry=$manifest.productRowsById.$id; foreach($col in @('F','G')){Set-Input $entry 1 0 $col}}
    $excel.CalculateFullRebuild()
    Check-Cell '월별손익' 'F13' 0 'explicit zero quantity yields zero revenue'
    $legacy=Product-Rows 'SHIFT_AUTO_S'
    foreach($pair in @(@(1,1),@(3,0),@(4,0),@(7,0))){Set-Input $legacy $pair[0] $pair[1]}
    $excel.CalculateFullRebuild()
    Check-Cell '상품계산' "F$([int]$legacy.calculation+3)" 270000 'historical automation contribution retained'
    Check-Cell '월별손익' 'F9' 0 'historical reference excluded from current revenue'
    Set-Input $legacy 1 0
    $setup=Product-Rows 'SHIFT_PERSONALIZATION_SETUP'
    Set-Input $setup 1 1
    $excel.CalculateFullRebuild()
    Check-Cell '상품계산' "F$([int]$setup.calculation+1)" '' 'missing current price blocks revenue'
    foreach($pair in @(@(2,290000),@(3,0),@(4,0),@(5,20000),@(6,5),@(7,0))){Set-Input $setup $pair[0] $pair[1]}
    $book.Worksheets.Item('운영비').Range('F8:G21').Value2 = 0.0
    $book.Worksheets.Item('현금입력').Range('F8').Value2 = 1000000.0
    foreach ($r in @(12,14,24,37,38)) {$book.Worksheets.Item('인력과 LAB').Range("F$r").Value2 = 0.0}
    $excel.CalculateFullRebuild()
    Check-Cell '상품계산' "F$([int]$setup.calculation+3)" 270000 'hypothetical setup cash contribution'
    Check-Cell '상품계산' "F$([int]$setup.calculation+6)" 120000 'hypothetical setup owner-time contribution'
    Check-Cell '월별손익' 'F48' 1270000 'closing cash'
    Check-Cell '현금입력' 'G8' 1270000 'cash carry forward'
    $book.Worksheets.Item('현금입력').Range('G21').Value2 = 290000.0
    $excel.CalculateFullRebuild()
    Check-Cell '월별손익' 'G13' -290000 'refund revenue deduction'
    Check-Cell '월별손익' 'G48' 980000 'refund cash deduction'
    $book.Worksheets.Item('인력과 LAB').Range('F35').ClearContents()
    $excel.CalculateFullRebuild()
    Check-Cell '월별손익' 'F26' '' 'missing free-user count blocks profit'
    $book.Worksheets.Item('인력과 LAB').Range('F35').Value2 = 0.0
    $book.Worksheets.Item('인력과 LAB').Range('F16').Value2 = 32.5875
    $excel.CalculateFullRebuild()
    Check-Cell '인력과 LAB' 'F49' 1127625 'owner LAB teaching time value'
    $book.Worksheets.Item('운영비').Range('F8').Value2 = 100000.0
    $excel.CalculateFullRebuild()
    Check-Cell '월별손익' 'F26' 170000 'owner salary cash expense once'
    Check-Cell '월별손익' 'F30' -857625 'owner salary opportunity value reconciliation'
    Set-Input $setup 1 -1
    $excel.CalculateFullRebuild()
    Check-Cell '상품계산' "F$([int]$setup.calculation+1)" '' 'pasted negative volume invalid'
    foreach($id in @($manifest.productRowsById.PSObject.Properties.Name)) {Check-Cell '상품목록' "C$($manifest.productRowsById.$id.catalog)" $id "$id identity after extension"}
    Check-Cell '상품목록' "C$($manifest.productNotesRow)" '학생월·구독월·좌석월은 해당 월 제공량입니다. 기간권 선수금은 현금입력에서 따로 조정합니다.' 'catalog note starts after final product'
    $sheetNames = @($book.Worksheets | ForEach-Object {$_.Name})
    $view = @{firstMonth=$book.Worksheets.Item('요약').Range('F6').Text;lastMonth=$book.Worksheets.Item('요약').Range('Q6').Text;font=$book.Worksheets.Item('요약').Range('C2').Font.Name;negativeMoney=$book.Worksheets.Item('월별손익').Range('G13').Text}
    $clipped = @()
    foreach ($name in @('상품목록','판매조건','근거','월별상품')) {
        $sh = $book.Worksheets.Item($name)
        $last = if ($name -eq '상품목록') {6+$manifest.products} elseif ($name -eq '판매조건') {8+($manifest.products-1)*8+5} elseif($name -eq '월별상품') {0} else {76}
        $rows = if($name -eq '월별상품'){@($manifest.currentShift | ForEach-Object {[int]$manifest.productRowsById.$_.input+1})}else{@(7..$last)}
        foreach ($r in $rows) {
            $rw = $sh.Rows.Item($r)
            $original = [double]$rw.RowHeight
            [void]$rw.AutoFit()
            $required = [double]$rw.RowHeight
            if ($required -gt $original + 1) {$clipped += @{sheet=$name;row=$r;current=$original;required=$required}}
        }
    }
    @{application='Microsoft Excel';readOnly=$book.ReadOnly;saved=$false;checks=$checks;formulaErrors=$issues;sheetNames=$sheetNames;view=$view;clippedRows=$clipped} | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $qaPath -Encoding utf8
    Write-Output "Native Excel: $($checks.Count) checks passed; all 10 sheets opened; no formula errors."
    if ($clipped.Count) {$clipped | ConvertTo-Json -Compress} else {Write-Output 'Wrapped text fits all inspected rows.'}
} finally {
    if ($book) {$book.Close($false);[void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($book)}
    if ($excel) {$excel.Quit();[void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel)}
    [GC]::Collect();[GC]::WaitForPendingFinalizers()
}
