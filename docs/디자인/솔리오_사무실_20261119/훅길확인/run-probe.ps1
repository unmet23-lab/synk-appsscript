param([int]$Port, [string]$Tag, [string]$Prompt, [string]$Tools = 'Read', [string]$ConfigDir = '')
if ($ConfigDir) { $env:CLAUDE_CONFIG_DIR = $ConfigDir }
# 이 실행에만 훅을 단다(--settings). 손님의 설정 파일은 건드리지 않는다.
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$work = Join-Path $here 'work'
New-Item -ItemType Directory -Force $work | Out-Null
[IO.File]::WriteAllText((Join-Path $work 'note.txt'), 'orb')
$hook = @{ hooks = @(@{ type = 'http'; url = "http://127.0.0.1:$Port/synk-office/probe"; timeout = 2 }) }
$events = 'SessionStart', 'PostToolUse', 'Notification', 'Stop', 'SubagentStart', 'SubagentStop', 'SessionEnd'
$h = [ordered]@{}; foreach ($e in $events) { $h[$e] = @($hook) }
$settings = Join-Path $here "settings-$Tag.json"
[IO.File]::WriteAllText($settings, (@{ hooks = $h } | ConvertTo-Json -Depth 8))
Push-Location $work
$sw = [Diagnostics.Stopwatch]::StartNew()
$raw = claude -p $Prompt --model haiku --allowedTools $Tools --settings $settings --output-format json 2>&1 | Out-String
$sw.Stop()
Pop-Location
$out = [ordered]@{ tag = $Tag; wall_ms = $sw.ElapsedMilliseconds; exit = $LASTEXITCODE }
try {
  $j = $raw | ConvertFrom-Json
  $out.is_error = $j.is_error; $out.duration_ms = $j.duration_ms; $out.duration_api_ms = $j.duration_api_ms; $out.num_turns = $j.num_turns
  $out.result = "$($j.result)".Substring(0, [Math]::Min(80, "$($j.result)".Length))
} catch { $out.raw = $raw.Substring(0, [Math]::Min(600, $raw.Length)) }
$out | ConvertTo-Json -Compress
