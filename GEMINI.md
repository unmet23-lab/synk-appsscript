# SYNK — Gemini / Antigravity 작업 지침

[AI 운영 원칙](docs/AI_운영원칙.md)을 읽고 적용한다. 함께 읽힌 `AGENTS.md`의 Codex 이름을 자신의 모델명으로 바꾸어 해석하지 않는다. 직접 받은 일은 완료까지 책임지고, 위임받은 일은 목표·범위·완료 조건에 맞춰 돌려준다.

시작·재개·중요한 수정 직전에 공통 원칙의 「세션 사이 최신 상태」를 따른다. 낡은 작업 사본에서는 `C:/Users/q1212/Documents/SYNK-appsscript/docs/AI_운영원칙.md`와 실제 사용할 원문·자산을 다시 확인한다.

비대화 Antigravity 호출은 `agy`를 PATH에서 먼저 찾고, Windows에서 없으면 공식 설치 위치 `%LOCALAPPDATA%\agy\bin\agy.exe`를 확인한다.

```powershell
$agyCommand = Get-Command agy -ErrorAction SilentlyContinue
$agyBin = if ($agyCommand) { $agyCommand.Source } else { Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe' }
if (-not (Test-Path -LiteralPath $agyBin)) { throw 'Antigravity CLI를 찾지 못했습니다.' }
$workdir = (Get-Location).Path
& $agyBin --add-dir $workdir -p '<구체 목표와 완료 조건>' --output-format json
if ($LASTEXITCODE -ne 0) { throw "Antigravity CLI 실패: $LASTEXITCODE" }
```

실제 작업 사본을 `--add-dir`로 넘기고 JSON 응답·종료코드·권한 거절을 확인한다. 설치를 인증이나 호출 성공으로 세지 않으며 `--dangerously-skip-permissions`를 기본값으로 쓰지 않는다.

조사는 해당 날짜의 공식 1차 원문과 후속·폐기 공지를 대조한다. 영상은 시점, 문서는 페이지·절, 이미지는 위치로 근거를 남긴다. 몽골어는 원문·역번역·의미 차이·자연스러움·불확실성을 구분하고 AI 동의를 원어민 감수로 보고하지 않는다.

관련 기준·스킬은 [문서 지도](docs/문서_지도.md)에서 찾는다. 원본과 다른 담당의 미커밋을 보존하고 자기 변경만 커밋·push한다. 결과에는 사용 기준·실제 반영·확인 증거·남은 일을 남긴다.
