# SYNK 복원 — 노트북을 잃었을 때 새 노트북에서 이전처럼 일할 수 있게 되돌린다. 「복원 시작.cmd」를 더블클릭하면 이것이 돈다.
# 여러 번 돌려도 된다(끝난 것은 건너뛴다). 있는 파일은 덮지 않는다. 비밀번호 · 키 값은 화면과 기록에 내지 않는다.
#
# 유호님 손: Windows 설치 · GitHub 로그인 · 구글 드라이브 로그인 · 복호화 암호 한 번. 나머지는 이 스크립트가 한다.
#
#   복원 시작.cmd                                   처음부터(또는 이어서)
#   ... restore.ps1 -대화기록                        대화 기록(풀면 약 50GB, 받는 양은 그 절반 아래)도 받아 푼다(앱을 처음 켜기 전에 하면 세션 목록 · 설정까지 그대로 온다)
#   ... restore.ps1 -릴리스계보                      회사 릴리스 사슬이 따라가는 .tmp 계보 폴더(약 8GB)도 받아 푼다(회사 서버를 배포할 때 필요)
#   ... restore.ps1 -예약켜기                        꺼 둔 예약 작업만 켜고 끝낸다(옛 노트북이 안 도는 것을 확인한 뒤 — 둘 다 돌면 SNS가 두 번 나간다)
#   ... restore.ps1 -전부설치                        기록된 프로그램 · 파이썬 패키지 전부
#   ... restore.ps1 -집 D:\복원시험\q1212 -시험 [-가볍게]   가짜 집에 푼다: 설치 · 로그인 기다림 · 예약 · 환경 변수를 건드리지 않는다
# Windows PowerShell 5.1에서 돈다(새 PC에는 pwsh가 처음에 없다). 파일은 UTF-8 BOM이다.
param(
  [string]$집 = $env:USERPROFILE,
  [switch]$시험,
  [switch]$가볍게,
  [switch]$예약켜기,
  [switch]$대화기록,
  [switch]$릴리스계보,
  [switch]$전부설치,
  [string]$암호파일 = '',
  [string]$비밀키 = '',
  [string]$열쇠파일 = ''
)
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$OutputEncoding = [Text.Encoding]::UTF8
$Root = Split-Path $PSScriptRoot -Parent
$문서 = Join-Path $집 'Documents'
$로그폴더 = Join-Path $집 'SYNK복원_로그'
New-Item -ItemType Directory -Force $로그폴더 | Out-Null
$Log = Join-Path $로그폴더 ("복원_{0}.txt" -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
$남은일 = New-Object System.Collections.Generic.List[string]
$오래된집 = 'C--Users-q1212'
$진짜 = -not $시험

function Say($m = '') { Write-Host $m; Add-Content -LiteralPath $Log -Value $m -Encoding utf8 }
function Step($m) { Say ''; Say "== $m" }
function RefreshPath { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') }
function Fail($m) { Say ''; Say "멈춤: $m"; Say '이 창을 사진으로 찍어 Claude에게 보여 주셔도 돼요.'; Read-Host '이 창은 Enter를 누르면 닫혀요' | Out-Null; exit 10 }

# 없는 파일만 복사한다(있는 것은 그대로). 긴 경로도 된다. $빼기는 복사하지 않을 폴더 이름. 복사한 수를 돌려준다.
function CopyMissing($from, $to, [string[]]$빼기 = @()) {
  if (-not (Test-Path -LiteralPath $from)) { return 0 }
  New-Item -ItemType Directory -Force $to | Out-Null
  $out = & robocopy $from $to /E /XC /XN /XO /R:1 /W:1 /NP /NDL /NJH /BYTES /XD .git @빼기 2>$null
  $code = $LASTEXITCODE
  if ($code -ge 8) { $남은일.Add("복사 실패 $from (코드 $code)") }
  $line = $out | Where-Object { $_ -match '^\s*(Files|파일)\s*:' } | Select-Object -First 1
  if ($line -match ':\s*(\d+)\s+(\d+)') { return [int]$Matches[2] }
  return 0
}

# -예약켜기는 예약만 켜고 끝낸다(전체를 다시 돌리면 암호를 또 묻는다). 옛 노트북이 안 도는 것을 확인한 뒤에 쓴다.
if ($예약켜기) {
  if ($시험) { Say '시험: 이 PC의 예약 작업은 건드리지 않아요.'; exit 0 }
  $예약폴더 = Join-Path $Root '윈도우\예약작업'
  $목록 = Join-Path $예약폴더 '목록.json'
  $옛상태 = @{}
  if (Test-Path -LiteralPath $목록) { foreach ($t in @(Get-Content -LiteralPath $목록 -Raw -Encoding utf8 | ConvertFrom-Json)) { $옛상태[$t.이름] = $t.상태 } }
  $켬 = 0
  foreach ($x in Get-ChildItem -LiteralPath $예약폴더 -Filter '*.xml') {
    if ($옛상태[$x.BaseName] -eq 'Disabled') { continue }
    if (Enable-ScheduledTask -TaskName $x.BaseName -ErrorAction SilentlyContinue) { $켬++ } else { Say "  못 켬(등록 전일 수 있어요): $($x.BaseName)" }
  }
  Say "예약 작업 $켬개를 켰어요."
  if ($진짜) { Read-Host '이 창은 Enter를 누르면 닫혀요' | Out-Null }
  exit 0
}

Say "SYNK 복원 $(Get-Date -Format 'yyyy-MM-dd HH:mm')  집: $집$(if ($시험) { '  (시험)' })"
Say "꾸러미: $Root"
Say "기록: $Log"

# ── 1. 확인 ──
Step '1. 이 노트북 확인'
if ($진짜 -and $env:USERPROFILE -ne 'C:\Users\q1212') {
  Say "  사용자 폴더가 $env:USERPROFILE 입니다. 도구 여러 곳이 C:\Users\q1212를 가리켜 이대로면 일부가 안 돕니다."
  Say '  Windows를 같은 Microsoft 계정으로 설치하면 q1212가 됩니다. 그래도 이어서 받을 수는 있어요.'
  if ((Read-Host '  이어서 할까요? (y/n)') -ne 'y') { exit 10 }
}
$free = [math]::Round((Get-PSDrive ($집.Substring(0, 1))).Free / 1GB)
Say "  남은 공간 ${free}GB"

# ── 2. 프로그램 ──
Step '2. 프로그램 설치'
if ($시험) { Say '  시험: 건너뜀' } else {
  $필수 = @(
    @{ id = 'Git.Git' }, @{ id = 'GitHub.cli' }, @{ id = 'Microsoft.PowerShell' }, @{ id = 'OpenJS.NodeJS.LTS' },
    @{ id = 'Python.PythonInstallManager' }, @{ id = 'Google.GoogleDrive' }, @{ id = 'BurntSushi.ripgrep.MSVC' },
    @{ id = 'Anthropic.Claude'; a = @('--installer-type', 'msix') }
  )
  winget source update --disable-interactivity 2>&1 | Out-Null
  foreach ($p in $필수) {
    winget list --id $p.id -e --accept-source-agreements --disable-interactivity 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Say "  있음 $($p.id)"; continue }
    $args2 = @('install', '--id', $p.id, '-e', '--source', 'winget', '--silent', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity')
    if ($p.a) { $args2 += $p.a }
    winget @args2 | Out-Null
    $ok = $LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq -1978335189
    Say ("  {0} {1}" -f $(if ($ok) { '설치됨' } else { "실패($LASTEXITCODE)" }), $p.id)
    if (-not $ok) { $남은일.Add("프로그램 설치 실패: $($p.id)") }
  }
  RefreshPath
  $lp = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem').LongPathsEnabled
  if ($lp -ne 1) {
    Say '  긴 경로 허용을 켭니다(UAC 창에서 「예」를 눌러 주세요)'
    Start-Process reg -Verb RunAs -Wait -ArgumentList 'add', 'HKLM\SYSTEM\CurrentControlSet\Control\FileSystem', '/v', 'LongPathsEnabled', '/t', 'REG_DWORD', '/d', '1', '/f'
  }
  # 파이썬 3.14 — 묶음(zstd)을 풀려면 이 판이 필요하다
  if (-not (Get-Command py -ErrorAction SilentlyContinue)) { RefreshPath }
  if (-not (Get-Command py -ErrorAction SilentlyContinue)) { Fail 'py(파이썬 설치 관리자)가 아직 안 보여요. 잠시 뒤 다시 더블클릭해 주세요.' }
  '' | py install -y 3.14 2>&1 | Out-Null
  $py = ('' | py -V:3.14 -c "import sys; print(sys.executable)" 2>$null | Select-Object -First 1)
  if (-not $py -or -not (Test-Path -LiteralPath $py)) { Fail '파이썬 3.14를 못 찾았어요.' }
  $env:SYNK_복원_파이썬 = $py
  & $py -m pip install -q --disable-pip-version-check requests 2>&1 | Out-Null
  Say "  파이썬 $py"
  $wingetList = Join-Path $Root '윈도우\winget.json'
  if ($전부설치 -and (Test-Path -LiteralPath $wingetList)) {
    Say '  기록된 프로그램 전부 설치(오래 걸립니다)'
    winget import -i $wingetList --ignore-unavailable --ignore-versions --accept-package-agreements --accept-source-agreements --disable-interactivity | Out-Null
    RefreshPath
  }
  $npmList = Join-Path $Root '윈도우\npm-global.json'
  if (Test-Path -LiteralPath $npmList) {
    $deps = (Get-Content -LiteralPath $npmList -Raw -Encoding utf8 | ConvertFrom-Json).dependencies
    foreach ($n in ($deps.PSObject.Properties | Where-Object { $_.Name -notin 'npm', 'corepack' })) {
      & npm install -g "$($n.Name)@$($n.Value.version)" 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) { $남은일.Add("npm 전역 설치 실패: $($n.Name)") }
    }
    Say '  npm 전역 도구 끝'
  }
  $pipList = Join-Path $Root '윈도우\pip.txt'
  if ($전부설치 -and (Test-Path -LiteralPath $pipList)) { & $py -m pip install -q --disable-pip-version-check -r $pipList 2>&1 | Out-Null }
}

# ── 3. 로그인 ──
Step '3. GitHub · 구글 드라이브 로그인'
if ($진짜) {
  gh auth status 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Say '  GitHub 로그인 창이 브라우저로 뜹니다. unmet23-lab 계정으로 로그인해 주세요.'
    gh auth login --web --git-protocol https --hostname github.com
  }
  $G = 'G:\내 드라이브'
  if (-not (Test-Path -LiteralPath $G)) {
    $exe = Get-ChildItem 'C:\Program Files\Google\Drive File Stream' -Recurse -Filter GoogleDriveFS.exe -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
    if ($exe -and -not (Get-Process GoogleDriveFS -ErrorAction SilentlyContinue)) { Start-Process $exe.FullName }
    Say '  Google Drive 창에서 unmet23@gmail.com으로 로그인해 주세요(「스트리밍」 그대로, 폴더 백업은 건너뛰기).'
    $t = 0
    while (-not (Test-Path -LiteralPath $G) -and $t -lt 900) { Start-Sleep 5; $t += 5 }
    if (-not (Test-Path -LiteralPath $G)) { Say '  드라이브가 아직 안 보여요. 열쇠는 브라우저로 받아도 됩니다.' }
  }
} else { Say '  시험: 지금 로그인을 그대로 씁니다' }

# ── 4. 저장소 ──
Step '4. 저장소 받기'
New-Item -ItemType Directory -Force $문서 | Out-Null
$저장소들 = @(
  @{ slug = 'synk-appsscript'; 이름 = 'SYNK-appsscript' }, @{ slug = 'SYNK-talk'; 이름 = 'SYNK-talk' }, @{ slug = 'SYNK-website'; 이름 = 'SYNK-website' },
  @{ slug = 'synk-policy'; 이름 = 'synk-policy' }, @{ slug = 'synk-tips'; 이름 = 'synk-tips' }, @{ slug = 'claude-session-share'; 이름 = 'claude-session-share' }
)
foreach ($r in $저장소들) {
  $곳 = Join-Path $문서 $r.이름
  if (Test-Path -LiteralPath (Join-Path $곳 '.git')) { Say "  있음 $($r.이름)"; continue }
  $시작 = Get-Date
  $추가 = @('--', '-c', 'core.longpaths=true')
  if ($가볍게) { $추가 += @('--depth', '1', '--filter=blob:none', '--no-checkout') }
  gh repo clone "unmet23-lab/$($r.slug)" $곳 @추가 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { $남은일.Add("저장소 받기 실패: $($r.이름)"); Say "  실패 $($r.이름)"; continue }
  git -C $곳 remote set-url origin "git@github.com:unmet23-lab/$($r.slug).git"
  Say ("  받음 {0} ({1:N0}초)" -f $r.이름, ((Get-Date) - $시작).TotalSeconds)
}

# ── 5. 작업 방식 제자리 ──
Step '5. 메모 · 설정 · 스킬 제자리에(없는 것만)'
$짝 = @(
  @('claude', '.claude'), @('codex', '.codex'), @('agents', '.agents'), @('ai-accounts', '.ai-accounts'),
  @('창고도구\PC_백업_20261003', 'Documents\PC_백업_20261003'), @('창고도구', 'Documents\SYNK_원본창고', 'PC_백업_20261003'), @('문서\Videos', 'Videos')
)
foreach ($p in $짝) { $n = CopyMissing (Join-Path $Root $p[0]) (Join-Path $집 $p[1]) @($p | Select-Object -Skip 2); Say "  $($p[0]) → $($p[1]): 새 파일 $n" }
# 메모는 프로젝트 폴더 이름이 저장소 경로에서 나온다. 집이 같으면 이름도 같다.
$새집 = ($집 -replace '[^A-Za-z0-9]', '-')
$메모뿌리 = Join-Path $Root '메모'
$메모수 = 0
if (Test-Path -LiteralPath $메모뿌리) {
  foreach ($d in Get-ChildItem -LiteralPath $메모뿌리 -Directory) {
    $이름 = $d.Name
    if ($이름.StartsWith($오래된집)) { $이름 = $새집 + $이름.Substring($오래된집.Length) }
    $n = CopyMissing $d.FullName (Join-Path $집 ".claude\projects\$이름\memory")
    $메모수 += $n
  }
}
Say "  메모: 새 파일 $메모수"
$로라 = if ($시험) { Join-Path $집 'SYNK-LoRA' } else { 'C:\SYNK-LoRA' }
$n = CopyMissing (Join-Path $Root '문서\SYNK-LoRA') $로라; Say "  LoRA 문서: 새 파일 $n"
# 저장소에 아직 안 올린 글: 받은 저장소에 없는 글만 넣는다. 내용이 다른 글은 덮지 않고 8단계 점검이 따로 모아 준다.
foreach ($r in 'SYNK-appsscript', 'SYNK-talk', 'SYNK-website', 'synk-tips', 'claude-session-share') {
  $곳 = Join-Path $문서 $r
  if (-not (Test-Path -LiteralPath $곳) -or $가볍게) { continue }
  $n = CopyMissing (Join-Path $Root "문서\$r") $곳
  if ($r -eq 'SYNK-appsscript') { $n += CopyMissing (Join-Path $Root '문서\SYNK-appsscript-설정') $곳 }
  Say "  $r 안 올린 글: 새 파일 $n"
}

# ── 6. 열쇠와 암호 묶음 ──
Step '6. 열쇠와 비공개 문서 풀기(복호화 암호를 한 번 물어요)'
function FindKeysFile {
  if ($열쇠파일) { return $열쇠파일 }
  foreach ($곳 in @('G:\내 드라이브\SYNK_복원\열쇠', (Join-Path $env:USERPROFILE 'Downloads'))) {
    if (Test-Path -LiteralPath $곳) {
      $f = Get-ChildItem -LiteralPath $곳 -Filter '열쇠-*.tar.zst.enc' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
      if ($f) { return $f.FullName }
    }
  }
  return $null
}
function FindLockedKey {
  if ($비밀키) { return $비밀키 }
  foreach ($곳 in @('G:\내 드라이브\SYNK_복원\열쇠', (Join-Path $env:USERPROFILE 'Downloads'))) {
    $f = Join-Path $곳 '비밀키_잠금.json'
    if (Test-Path -LiteralPath $f) { return $f }
  }
  return $null
}
$열쇠 = FindKeysFile
if ((-not $열쇠 -or -not (FindLockedKey)) -and $진짜) {
  Say '  열쇠 파일을 못 찾았어요. 브라우저에서 드라이브의 SYNK_복원/열쇠 폴더를 열어'
  Say '  가장 새 「열쇠-….tar.zst.enc」와 「비밀키_잠금.json」을 내려받기 폴더에 받아 주세요.'
  Start-Process 'https://drive.google.com/drive/search?q=SYNK_%EB%B3%B5%EC%9B%90'
  $t = 0
  while (-not (($열쇠 = FindKeysFile) -and (FindLockedKey)) -and $t -lt 1800) { Start-Sleep 5; $t += 5 }
}
$풀기 = Join-Path $PSScriptRoot '복원풀기.cjs'
$받을것 = @('비공개문서', '창고장부', '작업기록')
if ($대화기록) { $받을것 += '대화기록' }
if ($릴리스계보) { $받을것 += '릴리스계보' }
if ($열쇠) {
  $인자 = @($풀기, '--집', $집, '--열쇠파일', $열쇠, '--받기', ($받을것 -join ','))
  # 두 드라이브에 가는 묶음은 G: 쪽도 함께 본다 — 77yuhbs가 막혀 unmet23에만 간 조각이 빠지지 않게(같은 이름은 받은 것을 쓴다).
  foreach ($묶음 in @('비공개문서', '창고장부')) {
    $곳 = "G:\내 드라이브\SYNK_복원\$묶음"
    if (Test-Path -LiteralPath $곳) { $인자 += @('--폴더', $곳) }
  }
  if ($암호파일) { $인자 += @('--암호파일', $암호파일) }
  if ($비밀키) { $인자 += @('--비밀키', $비밀키) }
  $env:SYNK_복원_집 = $집
  & node @인자
  $code = $LASTEXITCODE
  Remove-Item Env:\SYNK_복원_집 -ErrorAction SilentlyContinue
  if ($code -eq 3) { $남은일.Add('77yuhbs에서 받지 못한 묶음이 있습니다 — 인터넷과 로그인을 확인하고 복원 시작.cmd를 다시 눌러 주세요') }
  elseif ($code -eq 2) { $남은일.Add('일부 파일을 못 풀었습니다 — 위 결과와 기록을 Claude에게 보여 주세요') }
  elseif ($code -ne 0) { $남은일.Add('열쇠 · 묶음 풀기 실패 — 암호를 확인하고 다시 돌려 주세요') }
} else { $남은일.Add('열쇠를 못 찾아 풀지 못했습니다') }
if ($진짜) {
  # 열쇠의 .gitconfig를 먼저 풀고 나서 더한다
  git config --global core.longpaths true
  gh auth setup-git 2>&1 | Out-Null
}

# ── 7. 연결 · 환경 변수 · 운영 사본 · 예약 ──
Step '7. 연결 · 환경 변수 · 운영 사본 · 예약 작업'
if ($시험) { Say '  시험: 건너뜀' } else {
  $연결파일 = Join-Path $Root '윈도우\연결목록.json'
  if (Test-Path -LiteralPath $연결파일) {
    foreach ($l in @(Get-Content -LiteralPath $연결파일 -Raw -Encoding utf8 | ConvertFrom-Json)) {
      $대상 = ("$($l.대상)" -split ';')[0]
      if ((Test-Path -LiteralPath $l.자리) -or -not (Test-Path -LiteralPath $대상)) { continue }
      New-Item -ItemType Junction -Path $l.자리 -Target $대상 -ErrorAction SilentlyContinue | Out-Null
    }
  }
  $환경 = Join-Path $집 '.synk-복원\환경변수.json'
  if (Test-Path -LiteralPath $환경) {
    $옛 = Get-Content -LiteralPath $환경 -Raw -Encoding utf8 | ConvertFrom-Json
    $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
    foreach ($e in $옛.PSObject.Properties) {
      if ($e.Name -in 'TEMP', 'TMP', 'OneDrive', 'OneDriveConsumer') { continue }
      $cur = $key.GetValue($e.Name, $null, 'DoNotExpandEnvironmentNames')
      if ($e.Name -eq 'Path') {
        $합 = New-Object System.Collections.Generic.List[string]
        foreach ($c in (("$($e.Value.값)" -split ';') + ("$cur" -split ';'))) { if ($c -and -not ($합 | Where-Object { $_ -ieq $c })) { $합.Add($c) } }
        $key.SetValue('Path', ($합 -join ';'), [Microsoft.Win32.RegistryValueKind]::ExpandString)
      } elseif ($null -eq $cur) {
        $key.SetValue($e.Name, $e.Value.값, [Microsoft.Win32.RegistryValueKind]$e.Value.종류)
      }
    }
    $key.Close()
    RefreshPath
    Say '  환경 변수: 없는 것만 넣고 Path는 합침'
  }
  $본 = Join-Path $문서 'SYNK-appsscript'
  if (Test-Path -LiteralPath (Join-Path $본 'package-lock.json')) { Push-Location $본; & npm ci --no-audit --no-fund 2>&1 | Out-Null; Pop-Location; Say '  저장소 의존성 끝' }
  if (Test-Path -LiteralPath (Join-Path $본 'tools\운영사본.js')) {
    & node (Join-Path $본 'tools\운영사본.js') 만들기 --실행 2>&1 | Out-Null
    Say ("  운영 사본: {0}" -f $(if ($LASTEXITCODE -eq 0) { '만듦' } else { '실패 — 나중에 node tools/운영사본.js 만들기 --실행' }))
  }
  $예약폴더 = Join-Path $Root '윈도우\예약작업'
  $나 = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $등록 = 0
  if (Test-Path -LiteralPath $예약폴더) {
    foreach ($x in Get-ChildItem -LiteralPath $예약폴더 -Filter '*.xml') {
      $이름 = $x.BaseName
      if (Get-ScheduledTask -TaskName $이름 -ErrorAction SilentlyContinue) { continue }
      $xml = Get-Content -LiteralPath $x.FullName -Raw -Encoding utf8
      $xml = [regex]::Replace($xml, '<UserId>[^<]*</UserId>', "<UserId>$나</UserId>")
      $실행 = [regex]::Match($xml, '<Command>([^<]*)</Command>').Groups[1].Value
      if ($실행 -and -not (Test-Path -LiteralPath ([Environment]::ExpandEnvironmentVariables($실행)))) { $남은일.Add("예약 $이름 실행 파일 없음: $실행") }
      try {
        Register-ScheduledTask -TaskName $이름 -Xml $xml -ErrorAction Stop | Out-Null
        Disable-ScheduledTask -TaskName $이름 -ErrorAction SilentlyContinue | Out-Null
        $등록++
      } catch { $남은일.Add("예약 등록 실패: $이름") }
    }
  }
  Say "  예약 작업 $등록개를 꺼진 채 등록"
  $남은일.Add('옛 노트북이 안 도는 것을 확인한 뒤 예약 작업 켜기: 복원 시작.cmd -예약켜기')
}

# ── 8. 점검 ──
Step '8. 점검'
$점검 = @((Join-Path $PSScriptRoot '복원점검.cjs'), '--집', $집, '--꾸러미', $Root, '--차이보관', (Join-Path $로그폴더 '다른글'))
if ($시험) { $점검 += '--시험' }
& node @점검
foreach ($m in $남은일) { Say "  남은 일: $m" }
Say ''
Say "끝. 기록: $Log"
if ($진짜) { Read-Host '이 창은 Enter를 누르면 닫혀요' | Out-Null }
