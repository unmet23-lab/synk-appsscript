---
name: deploy
description: SYNK Apps Script 변경을 사용자가 라이브 반영까지 요청했을 때 검증·커밋·push·clasp 배포·라이브 대조를 끝낸다. 로컬 수정이나 검토만 요청된 작업에는 자동으로 배포하지 않는다.
---

# SYNK Apps Script 배포

목표는 **이번 배포 대상만** 검증해 GitHub와 Apps Script 라이브를 같은 내용으로 만들고, 실제 반영을 다시 읽어 확인하는 것이다. 현행 공통 기준은 `docs/AI_운영원칙.md`와 루트 `AGENTS.md`다.

## 경계

- 사용자가 라이브 반영을 요청했거나 현재 작업 범위에 배포가 명시된 경우에만 실행한다. 로컬 제작, 커밋·push, 라이브 배포는 서로 다른 상태다.
- `clasp pull`은 작업본을 덮어쓰므로 실행하지 않는다.
- 저장소의 `.claude/hooks/*`와 `tools/githooks/*`는 현재 자동 등록된 보호막이 아니다. `PreToolUse`·Git hook이 명령을 막아 준다고 가정하거나 보고하지 않는다. 아래 실측과 각 명령의 종료코드가 배포 게이트다.
- 신규 결제·인증·서비스 보호 절차가 필요하면 그 행동만 사용자에게 요청한다. 다른 검증과 준비는 계속한다.

## 실행

1. **현재 대상 확정**
   - `git status`와 관련 diff를 읽어 이번 작업의 파일, 다른 작업의 미커밋·스테이징, merge/rebase 여부를 구분한다.
   - 현재 하네스의 네이티브 작업·에이전트 목록과 메시지 기능으로 겹치는 파일만 조율한다. 특정 하네스의 옛 도구 이름을 가정하지 않는다.
   - 라이브 배포는 메인 checkout에서 한다. worktree에서 만든 변경은 승인된 범위만 먼저 통합하고, 다른 worktree나 남의 변경은 건드리지 않는다.

2. **배포 대상 검증**
   - 루트 Apps Script `.js`에 `node --check`를 실행하고 `appsscript.json`을 JSON으로 파싱한다.
   - `node tools/test-ci.js`와 `node tools/deploy-security-check.js`를 실행한다. 전체 저장소의 기존 실패와 이번 변경 때문에 생긴 실패를 나눠 보고, 이번 변경의 관련 실패나 P0·P1은 해결 전 배포하지 않는다.
   - `node tools/보안검토과녁.js`로 미커밋과 미배포 범위를 확인한다. 데이터·인증·익명 웹앱·소급 불가 변경은 현재 사용 가능한 공식/네이티브 검토 통로로 판단 검토까지 한다. 실행하지 못한 검토를 통과로 쓰지 않는다.
   - Apps Script 배포 파일을 바꿨다면 필요에 따라 `node tools/codex-review.js`로 독립 검수를 실행한다. 종료 1(P0·P1)과 2(확인 불가)를 성공으로 읽지 않는다. 사용자에게 별도 수동 리뷰 명령을 기본 단계로 떠넘기지 않는다.

3. **이력과 GitHub**
   - 버전 대상 파일에 `[vNEXT]`가 있으면 `node tools/bump-version.js --desc "한 줄 요약" --종류 <수리|보강|신설>`로 채번하고 `node tools/bump-version.js --check`로 대조한다.
   - 자기 변경만 경로를 명시해 커밋하고 `git push origin HEAD:master`로 민다. 다른 작업의 stage나 파일을 쓸어 담지 않는다.
   - `node tools/원격ci.js`로 대상 커밋의 원격 상태를 확인한다. 기존의 관련 없는 적색은 그대로 밝혀 구분하고, 이번 배포 대상의 관련 실패는 라이브 전에 막는다.

4. **라이브 반영과 대조**
   - `clasp`는 PATH에서 먼저 찾고, Windows에서 없으면 공식 설치 위치를 확인한다.

     ```powershell
     $claspCommand = Get-Command clasp.cmd -ErrorAction SilentlyContinue
     $claspBin = if ($claspCommand) { $claspCommand.Source } else { Join-Path $env:APPDATA 'npm\clasp.cmd' }
     if (-not (Test-Path -LiteralPath $claspBin)) { throw 'clasp 실행 파일을 찾지 못했습니다.' }
     & $claspBin push --force
     ```

   - `node tools/배포판점검.js --라이브`로 실제 라이브를 읽는다. 고정 버전 배포가 낡았으면 도구가 제시한 **기존 deployment ID**를 `clasp deploy -i <기존ID> --description "<설명> #fp:<지문>"`로 갱신한다. ID 없이 새 배포를 만들지 않는다.
   - 다시 `clasp deployments`와 `node tools/배포판점검.js --라이브`를 실행해 배포 개수, 내용 지문, 도장을 확인한다.

## 완료 보고

커밋·push·로컬 검증·원격 CI·라이브 반영·라이브 대조를 각각 구분해 적는다. 확인하지 못한 층과 첫 예약 트리거 실행 시점은 남은 일로 밝힌다. 자동 훅이 보호했다고 쓰지 않는다.
