# TEXTSPLIT이 언제 #NAME?이 되는지: 숨긴 채 → 띄운 뒤 → 다시 계산
$ErrorActionPreference = 'Stop'
function X([scriptblock]$b) { for ($i = 0; $i -lt 80; $i++) { try { return (& $b) } catch { if ("$($_.Exception.Message)" -match '0x80010001|0x8001010A|거부') { Start-Sleep -Milliseconds 250; continue }; throw } }; throw '거절 계속' }
$xl = New-Object -ComObject Excel.Application
try {
  X { $xl.DisplayAlerts = $false }
  $wb = X { $xl.Workbooks.Add() }; $ws = X { $wb.Worksheets.Item(1) }
  X { $ws.Range("A1").Value2 = '블랙/L/면티' }
  X { $ws.Range("B1").Formula2 = '=TEXTSPLIT(A1,"/")' }
  "숨김: $(X { $ws.Range('B1').Text }) $(X { $ws.Range('C1').Text })"
  X { $xl.Visible = $true }; Start-Sleep 3
  X { $ws.Range("B2").Formula2 = '=TEXTSPLIT(A1,"/")' }
  "띄운 뒤 새로: $(X { $ws.Range('B2').Text }) · 앞 칸: $(X { $ws.Range('B1').Text })"
  X { $xl.CalculateFull() }; Start-Sleep 2
  "다시 계산: $(X { $ws.Range('B1').Text }) $(X { $ws.Range('B2').Text })"
  "TEXTBEFORE: " + $(X { $ws.Range("B3").Formula2 = '=TEXTBEFORE(A1,"/")'; $ws.Range('B3').Text })
  "LET: " + $(X { $ws.Range("B4").Formula2 = '=LET(x,1,x+1)'; $ws.Range('B4').Text })
  "XLOOKUP: " + $(X { $ws.Range("B5").Formula2 = '=XLOOKUP(1,{1},{"ok"})'; $ws.Range('B5').Text })
} finally {
  try { X { $wb.Close($false) } } catch {}
  try { X { $xl.Quit() } } catch {}
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
}
