# SYNK 작업의 연결 구조

> 현행 구조 · 2026-09-10. 작업 원칙은 [AI 운영 원칙](AI_운영원칙.md), 기존 도구 사용법은 [AI 스택 가이드](AI_스택_가이드.md)에 있다. 날짜별 설치·모델·호출 기록은 현재 인증·연결 상태의 증명이 아니다.

## 책임과 자료의 흐름

사용자 요청 → 주담당 → [업무별 현재 원문](문서_지도.md)의 관련 절·승인 자산 → 제작·독립 작업 → 실제 결과 검증 → 요청된 게시·배포 → [남은 일](_ops/트랙.md).

작업본·제작물·게시물의 최신 확인과 인계는 [운영 원칙](AI_운영원칙.md#세션-사이-최신-상태), 매체별 실물 검증은 [명품 기준](명품_기준_v1.md)을 따른다. 자동 훅·중앙 큐·기억이 대신 확인했다고 가정하지 않는다.

## 연결·중단·재개

설치·로그인·실제 호출·업무 품질은 다른 상태다. 현재 환경의 공식 앱·CLI·커넥터를 확인하고 기존 인증을 재사용한다. Codex·Claude의 네이티브 작업·서브에이전트·재개를 우선하며 특정 하네스의 옛 도구 이름이나 숨은 훅을 공통 계약으로 두지 않는다.

Antigravity 비대화 실행은 PATH의 `agy`를 우선하고, Windows에서 없으면 공식 설치 위치를 확인한 뒤 실제 작업 사본을 전달한다.

```powershell
$agyCommand = Get-Command agy -ErrorAction SilentlyContinue
$agyBin = if ($agyCommand) { $agyCommand.Source } else { Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe' }
if (-not (Test-Path -LiteralPath $agyBin)) { throw 'Antigravity CLI를 찾지 못했습니다.' }
& $agyBin --add-dir (Get-Location).Path -p '<구체 목표와 완료 조건>' --output-format json
```

로컬 작업은 연결된 기계가 필요하며 원격 화면 제어와 클라우드 실행을 구분한다. 재개에는 작업 사본·브랜치·커밋·미커밋 범위·현재 실행 상태·시험·남은 일을 넘긴다. 브라우저·로컬 프로세스가 다른 하네스로 자동 이전되지 않으며, 문서 개정만으로 실행 중인 작업의 권한이나 상태가 바뀌었다고 주장하지 않는다.
