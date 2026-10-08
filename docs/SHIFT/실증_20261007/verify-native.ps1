$ErrorActionPreference='Stop'
$manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'qa/manifest.json') -Raw | ConvertFrom-Json
$path=$manifest.output
$before=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
$checks=[System.Collections.Generic.List[object]]::new()
$excel=$null;$book=$null
function Check([string]$Sheet,[string]$Cell,$Expected,[string]$Name){
 $actual=$book.Worksheets.Item($Sheet).Range($Cell).Value2
 $ok=if($Expected -is [string]){$actual -eq $Expected -or ($Expected -eq '' -and $null -eq $actual)}else{$null -ne $actual -and [Math]::Abs([double]$actual-[double]$Expected) -lt 0.0000001}
 $checks.Add(@{name=$Name;sheet=$Sheet;cell=$Cell;expected=$Expected;actual=$actual;passed=$ok})
 if(-not $ok){throw "$Name failed at ${Sheet}!${Cell}: $actual"}
}
function Put([string]$Sheet,[string]$Cell,$Value){$x=$book.Worksheets.Item($Sheet).Range($Cell);if($null -eq $Value){$x.ClearContents()}elseif($Value -is [string]){$x.Value2=[string]$Value}else{$x.Value2=[double]$Value}}
function Trial([int]$Row,[string]$Customer,[string]$Method,[string]$Result,$Time,$Errors,$Handover,[string]$Exclude=''){
 $values=@("QA-$Row",$Customer,'QA-GROUP',$Method,45000,"SYNTHETIC-$Row",'QA-v1',$Result,$Time,$Errors,$Handover,$Exclude,'SYNTHETIC QA ONLY')
 for($i=0;$i -lt $values.Count;$i++){Put '시행기록' "$([char](65+$i))$Row" $values[$i]}
}
function Cost([int]$Row,[string]$Customer,[string]$Phase,[string]$Kind,$Hours,$Rate,$Labor,$Cash,$Allocation=1){
 $values=@("QA-COST-$Row",$Customer,45000,$Phase,$Kind,'SYNTHETIC QA ONLY',$Hours,$Rate,$Labor,$Cash,$Allocation,'SYNTHETIC QA ONLY')
 for($i=0;$i -lt $values.Count;$i++){Put '원가기록' "$([char](65+$i))$Row" $values[$i]}
}
try{
 $excel=New-Object -ComObject Excel.Application;$excel.Visible=$false;$excel.DisplayAlerts=$false;$excel.AskToUpdateLinks=$false
 $book=$excel.Workbooks.Open($path,0,$true);$excel.CalculateFullRebuild()
 $initialErrors=@();foreach($s in $book.Worksheets){try{$bad=$s.UsedRange.SpecialCells(-4123,16);if($bad){$initialErrors+="$($s.Name):$($bad.Address())"}}catch [System.Runtime.InteropServices.COMException]{}}
 if($initialErrors.Count){throw 'Formula errors in original workbook'}
 foreach($a in @('D8','D9','E8','H10','D35','E35','D40','E40','D41','E41','E45','E48')){Check '요약' $a '' '실제 미측정 값은 공란'}
 Check '요약' 'D38' '미확인' '원가 완료 미확인'
 $blankRanges=@(@('업무범위','B7:B30'),@('업무범위','D7:D30'),@('시행기록','A7:M66'),@('원가기록','A7:L66'),@('재사용기록','A7:I31'),@('판단기록','B7:B18'),@('판단기록','D7:D18'))
 $blankCells=0
 foreach($pair in $blankRanges){foreach($cell in $book.Worksheets.Item($pair[0]).Range($pair[1]).Cells){$blankCells++;if($null -ne $cell.Value2 -and $cell.Value2 -ne ''){throw "Unexpected actual or synthetic input at $($pair[0]) $($cell.Address())"}}}
 foreach($col in @('B','D')){Put '업무범위' "${col}10" 'QA-GROUP';Put '업무범위' "${col}11" 'QA-v1';Put '업무범위' "${col}13" 44999;Put '업무범위' "${col}14" 45001}
 Trial 7 '고객1' '기존' '완료' 10 0 0
 Trial 8 '고객1' '기존' '실패' 20 2 1
 Trial 9 '고객1' '개인화' '완료' 6 0 0
 Trial 10 '고객1' '개인화' '중단' $null $null $null
 Trial 11 '고객1' '개인화' '미측정' $null $null $null
 Trial 12 '고객1' '개인화' '실패' 30 1 1 '조건 밖'
 $excel.CalculateFullRebuild()
 Check '요약' 'D8' 2 '실패를 결과 분모에 포함';Check '요약' 'D9' 0.5 '완료율';Check '요약' 'E8' 2 '중단을 결과 분모에 포함';Check '요약' 'E14' 1 '중단 건수';Check '요약' 'E15' 1 '미측정 건수';Check '요약' 'E16' 1 '제외 건수';Check '요약' 'E18' 1 '측정된 시간의 분모';Check '요약' 'E10' 6 '시간 누락은 0분이 아님';Check '요약' 'F10' -9 '관찰 시간 차이';Check '요약' 'D12' 0.5 '사람 전환 비율'
 Put '시행기록' 'A9' 'QA-7';$excel.CalculateFullRebuild();Check '시행기록' 'N9' '입력확인' '중복 시행 ID 표시';Check '요약' 'E8' 1 '중복은 집계에서 제외';Put '시행기록' 'A9' 'QA-9'
 Put '시행기록' 'E9' 45002;$excel.CalculateFullRebuild();Check '시행기록' 'N9' '입력확인' '측정 기간 밖은 집계 제외';Put '시행기록' 'E9' 45000
 Put '시행기록' 'A9' $null;$excel.CalculateFullRebuild();Check '요약' 'E17' 1 '시행 ID 미입력 오류 표시';Put '시행기록' 'A9' 'QA-9'
 Put '시행기록' 'G9' 'QA-v2';$excel.CalculateFullRebuild();Check '시행기록' 'N9' '입력확인' '다른 업무 버전은 혼합하지 않음';Put '시행기록' 'G9' 'QA-v1'
 Trial 66 '고객2' '기존' '완료' 0 0 0;$excel.CalculateFullRebuild();Check '요약' 'H10' 0 '마지막 시행 행의 명시적 0분 보존';Check '요약' 'D8' 2 '고객 간 집계 분리'
 Cost 7 '고객1' '도입' 'Atlas 공통' 4 $null 0 10000;$excel.CalculateFullRebuild();Check '원가기록' 'P7' '입력확인' '대표 시간단가 누락';Check '요약' 'D35' '' '불완전 경제 원가는 공란'
 Put '원가기록' 'H7' 30000;Cost 8 '고객1' '운영' '영업·지원' 2 20000 30000 5000;Cost 9 '고객1' '도입' '공통비 배분' 0 0 0 20000 0.5;$excel.CalculateFullRebuild()
 Check '요약' 'D35' 185000 '경제 원가의 노동 비용 이중 계산 방지';Check '요약' 'D36' 55000 '현금 원가';Check '요약' 'D27' 6 '대표와 지원 시간을 포함';Check '요약' 'D28' 4 'Atlas 공통 시간';Check '요약' 'D32' 2 '지원 시간'
 Put '업무범위' 'B26' 300000;$excel.CalculateFullRebuild();Check '요약' 'D41' '' '원가 완료 확인 전 잔액 미계산';Put '업무범위' 'B27' '완료';$excel.CalculateFullRebuild();Check '요약' 'D41' 115000 '경제 잔액';Check '요약' 'D42' 245000 '현금 잔액'
 Cost 10 '고객2' '도입' '전문 모듈' 1 30000 0 0;Cost 66 '고객2' '도입' '고객 설정·연결' 2 30000 0 0;Put '업무범위' 'D26' 0;Put '업무범위' 'D27' '완료';$excel.CalculateFullRebuild();Check '요약' 'E35' 90000 '고객2 경제 원가';Check '요약' 'E40' 0 '확인된 매출 0원';Check '요약' 'E41' -90000 '매출 없음이 흑자로 계산되지 않음';Check '요약' 'F25' -1 '도입시간 차이';Check '요약' 'E30' 2 '마지막 원가 행도 집계'
 $reuse=@(@('QA-MODULE','전문 모듈','QA-old','QA-v1','수정하여 재사용','SYNTHETIC QA ONLY','SYNTHETIC QA ONLY','QA-COST-10','SYNTHETIC QA ONLY'),@('QA-CONNECTOR','고객 설정·연결','','QA-v1','신규 개발','SYNTHETIC QA ONLY','SYNTHETIC QA ONLY','QA-COST-66','SYNTHETIC QA ONLY'))
 for($n=0;$n -lt 2;$n++){$r=if($n -eq 0){7}else{31};for($i=0;$i -lt 9;$i++){Put '재사용기록' "$([char](65+$i))$r" $reuse[$n][$i]}}
 $excel.CalculateFullRebuild();Check '요약' 'E45' 2 '재사용과 신규 개발 기록 분모';Check '요약' 'E48' 0.5 '기록한 모듈의 재사용 비율';Check '요약' 'E47' 1 '신규 개발 건수'
 Put '재사용기록' 'H7' 'QA-COST-7';$excel.CalculateFullRebuild();Check '재사용기록' 'J7' '입력확인' '다른 고객의 원가 참조 거부';Put '재사용기록' 'H7' 'QA-COST-10';Put '원가기록' 'H10' $null;$excel.CalculateFullRebuild();Check '재사용기록' 'J7' '입력확인' '연결한 원가의 누락 표시';Check '요약' 'E38' '미완료' '완료 선언이 원가 누락을 덮지 않음';Check '요약' 'E41' '' '불완전 원가에서 잔액 미계산'
 $errors=@();foreach($s in $book.Worksheets){try{$bad=$s.UsedRange.SpecialCells(-4123,16);if($bad){$errors+="$($s.Name):$($bad.Address())"}}catch [System.Runtime.InteropServices.COMException]{}}
 if($errors.Count){throw 'Formula error after input perturbations'}
 $clipped=@();foreach($name in @('업무범위','판단기록','재사용기록')){$s=$book.Worksheets.Item($name);$end=if($name -eq '업무범위'){30}elseif($name -eq '판단기록'){18}else{31};foreach($r in 7..$end){$row=$s.Rows.Item($r);$height=[double]$row.RowHeight;[void]$row.AutoFit();if([double]$row.RowHeight -gt $height+1){$clipped+=@{sheet=$name;row=$r;current=$height;required=[double]$row.RowHeight}}}}
 $validation=@{trialCustomer=$book.Worksheets.Item('시행기록').Range('B7').Validation.Formula1;trialResult=$book.Worksheets.Item('시행기록').Range('H7').Validation.Formula1;costClassification=$book.Worksheets.Item('원가기록').Range('E7').Validation.Formula1;reuse=$book.Worksheets.Item('재사용기록').Range('E7').Validation.Formula1}
 $result=@{application='Microsoft Excel';status='verified-in-memory-synthetic-inputs-only';readOnly=$book.ReadOnly;saved=$false;checks=$checks;blankInputCells=$blankCells;formulaErrors=$errors;clippedRows=$clipped;validations=$validation;sheets=@($book.Worksheets|ForEach-Object{$_.Name});font=$book.Worksheets.Item('요약').Range('A2').Font.Name;sourceSha256=$before}
 $result|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'qa/native-excel.json') -Encoding utf8
 Write-Output "Native Excel: $($checks.Count) checks; blank input cells=$blankCells; formula errors=$($errors.Count); clipped rows=$($clipped.Count)."
}finally{
 if($book){$book.Close($false);[void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($book)}
 if($excel){$excel.Quit();[void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel)}
 [GC]::Collect();[GC]::WaitForPendingFinalizers()
}
$after=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
if($after -ne $before){throw 'Delivery file changed during native verification'}
Write-Output 'Delivery file preserved byte for byte; synthetic inputs not saved.'
