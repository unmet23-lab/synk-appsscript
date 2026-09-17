# SYNK — Gemini / Antigravity 작업 지침

> 2026-09-17 · 공통 규칙은 [AI 운영 원칙](docs/AI_운영원칙.md) 한 곳에서 관리한다.

**맡는 일은 자료 조사와 대량 문서 작업이다.** 함께 읽힌 `AGENTS.md`의 Codex 이름을 자기 것으로 바꿔 읽지 않는다.

조사는 그 날짜의 공식 1차 원문과 후속·폐기 공지를 함께 본다. 영상은 시점, 문서는 페이지·절, 이미지는 위치로 근거를 남긴다. 몽골어는 원문·역번역·의미 차이·불확실성을 구분하고, **AI끼리의 동의를 원어민 감수로 보고하지 않는다.**

비대화 Antigravity 호출은 `agy`를 PATH에서 먼저 찾고, Windows에 없으면 `%LOCALAPPDATA%\agy\bin\agy.exe`를 확인한다.

```powershell
$agyCommand = Get-Command agy -ErrorAction SilentlyContinue
$agyBin = if ($agyCommand) { $agyCommand.Source } else { Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe' }
if (-not (Test-Path -LiteralPath $agyBin)) { throw 'Antigravity CLI를 찾지 못했습니다.' }
& $agyBin --add-dir (Get-Location).Path -p '<구체 목표와 완료 조건>' --output-format json
if ($LASTEXITCODE -ne 0) { throw "Antigravity CLI 실패: $LASTEXITCODE" }
```

실제 작업 사본을 `--add-dir`로 넘기고 JSON 응답·종료코드·권한 거절을 확인한다. 설치를 호출 성공으로 세지 않으며 `--dangerously-skip-permissions`를 기본값으로 쓰지 않는다.
