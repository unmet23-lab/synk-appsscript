# synkbrief B10 — 실제 엑셀(Microsoft 365) 화면 찍기. 창을 화면 밖에 두고 PrintWindow(PW_RENDERFULLCONTENT)로 찍어 유호님 화면을 가져가지 않는다.
# 엑셀이 그리는 동안 COM 호출을 거절(RPC_E_CALL_REJECTED)하므로 모든 호출을 X { } 로 다시 시도한다.
# 쓰는 법: pwsh -NoProfile -File excel_cap.ps1 -Out <출력 폴더>
param([string]$Out = "C:/Users/q1212/ego/synkbrief-b10-20261027/X")
$ErrorActionPreference = 'Stop'
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class Cap {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr h);
  [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr h, IntPtr dc);
  [DllImport("gdi32.dll")] public static extern IntPtr CreateCompatibleDC(IntPtr dc);
  [DllImport("gdi32.dll")] public static extern IntPtr CreateCompatibleBitmap(IntPtr dc, int w, int h);
  [DllImport("gdi32.dll")] public static extern IntPtr SelectObject(IntPtr dc, IntPtr o);
  [DllImport("gdi32.dll")] public static extern bool DeleteDC(IntPtr dc);
  [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr o);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public static IntPtr Shot(IntPtr h) {
    RECT r; GetWindowRect(h, out r);
    IntPtr sdc = GetDC(IntPtr.Zero); IntPtr mdc = CreateCompatibleDC(sdc);
    IntPtr bmp = CreateCompatibleBitmap(sdc, r.R - r.L, r.B - r.T);
    IntPtr old = SelectObject(mdc, bmp);
    PrintWindow(h, mdc, 2);
    SelectObject(mdc, old); DeleteDC(mdc); ReleaseDC(IntPtr.Zero, sdc);
    return bmp;
  }
}
"@
[Cap]::SetProcessDPIAware() | Out-Null
New-Item -ItemType Directory -Force $Out | Out-Null
$log = [System.Collections.Generic.List[object]]::new()
$t0 = Get-Date

function X([scriptblock]$b) {
  for ($i = 0; $i -lt 60; $i++) {
    try { return (& $b) } catch {
      $m = "$($_.Exception.Message) $($_.Exception.InnerException.Message)"
      if ($m -match '0x80010001|0x8001010A|RPC_E_CALL_REJECTED|SERVERCALL_RETRYLATER|거부') { Start-Sleep -Milliseconds 250; continue }
      throw
    }
  }
  throw "엑셀이 15초 넘게 호출을 거절함"
}

$xl = New-Object -ComObject Excel.Application
$hwnd = $null
try {
  X { $xl.DisplayAlerts = $false }
  $wb = X { $xl.Workbooks.Add() }
  $ws = X { $wb.Worksheets.Item(1) }
  $rows = @('블랙/L/면티','아이보리/M/니트','네이비/XL/후드티','그레이/S/맨투맨','화이트/L/면티','베이지/M/니트','카키/XL/맨투맨','블랙/M/후드티')
  $last = $rows.Count + 1
  X { $ws.Range("A1").Value2 = '주문 옵션'; $ws.Range("B1").Value2 = '색상'; $ws.Range("C1").Value2 = '사이즈'; $ws.Range("D1").Value2 = '상품' }
  for ($i = 0; $i -lt $rows.Count; $i++) { $r = $i + 2; $v = $rows[$i]; X { $ws.Cells.Item($r, 1).Value2 = $v } }
  X { $ws.Range("A1:D1").Font.Bold = $true }
  X { $ws.Columns.Item(1).ColumnWidth = 15 }
  foreach ($c in 2..4) { X { $ws.Columns.Item($c).ColumnWidth = 7 } }

  # 창: 화면 밖(왼쪽 -3200)에 보통 크기로, 활성화하지 않는다
  X { $xl.Visible = $true }
  X { $xl.WindowState = -4143 }
  $hwnd = [IntPtr](X { $xl.Hwnd })
  [Cap]::SetWindowPos($hwnd, [IntPtr]::Zero, -3200, 30, 1600, 1560, 0x0010) | Out-Null  # SWP_NOACTIVATE
  X { $xl.ActiveWindow.Zoom = 300 }
  X { $xl.ActiveWindow.ScrollRow = 1; $xl.ActiveWindow.ScrollColumn = 1 }
  Start-Sleep -Milliseconds 1500

  $script:n = 0
  function Snap([string]$tag) {
    $script:n++
    Start-Sleep -Milliseconds 900
    $hb = [Cap]::Shot($hwnd)
    $b = [System.Drawing.Image]::FromHbitmap($hb)
    $p = Join-Path $Out ('x{0:D2}_{1}.png' -f $script:n, $tag)
    $b.Save($p, [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose(); [Cap]::DeleteObject($hb) | Out-Null
    $script:log.Add([pscustomobject]@{ n = $script:n; tag = $tag; ms = [int]((Get-Date) - $t0).TotalMilliseconds; f = (Split-Path $p -Leaf) })
  }

  # ChatGPT가 준 세 수식 그대로(옛날 엑셀에서도 되는 판 — U1 답)
  $FORMS = @{ B = '=LEFT(A2,FIND("/",A2)-1)'; C = '=MID(A2,FIND("/",A2)+1,FIND("/",A2,FIND("/",A2)+1)-FIND("/",A2)-1)'; D = '=RIGHT(A2,LEN(A2)-FIND("/",A2,FIND("/",A2)+1))' }
  X { $ws.Range("B2").Select() } | Out-Null
  Snap 'before'
  foreach ($col in 'B','C','D') {
    $fm = $FORMS[$col]; $a = "${col}2"
    X { $ws.Range($a).Formula = $fm }
    X { $ws.Range($a).Select() } | Out-Null
    Snap "paste-$col"
  }
  X { $ws.Range("B2:D2").Select() } | Out-Null
  Snap 'sel-row'
  # 아래로 채우기(세 칸을 골라 채우기 손잡이를 끌어 내린 것과 같은 결과)
  X { $ws.Range("B2:D2").AutoFill($ws.Range("B2:D$last"), 0) } | Out-Null
  X { $ws.Range("B2:D$last").Select() } | Out-Null
  Snap 'fill'
  # 다 나뉜 화면: F2를 고르면 창이 옆으로 밀린다(10-27 X2) → A1을 고르고 왼쪽 위로 되돌린다
  X { $ws.Range("A1").Select() } | Out-Null
  X { $xl.ActiveWindow.ScrollColumn = 1; $xl.ActiveWindow.ScrollRow = 1 }
  Snap 'clean'
  $vals = for ($r = 2; $r -le $last; $r++) { X { ($ws.Cells.Item($r, 1).Text, $ws.Cells.Item($r, 2).Text, $ws.Cells.Item($r, 3).Text, $ws.Cells.Item($r, 4).Text) -join ' | ' } }
  $vals | Set-Content -Encoding utf8 (Join-Path $Out 'values.txt')
  $bld = X { $xl.Build }
  "build $bld · zoom 300 · 수식 B2 $(X { $ws.Range('B2').Formula }) · C2 $(X { $ws.Range('C2').Formula }) · D2 $(X { $ws.Range('D2').Formula })" | Add-Content -Encoding utf8 (Join-Path $Out 'values.txt')
} finally {
  $log | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $Out 'log.json')
  try { X { $wb.Close($false) } } catch { "닫기 실패: $_" }
  try { X { $xl.Quit() } } catch { "끄기 실패: $_" }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
}
$log | Format-Table | Out-String
