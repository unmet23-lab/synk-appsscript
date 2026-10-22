---
name: deploy
description: SYNK Apps Script를 고친 작업의 마감으로 검증·커밋·push·clasp 배포·라이브 대조를 끝낸다. 2026-10-21부터 Apps Script를 고친 작업은 검증을 통과하면 묻지 않고 라이브까지 반영한다. 검토·조사만 맡은 작업에는 배포하지 않는다.
---

# SYNK Apps Script 배포

목표는 **이번 배포 대상만** 검증해 GitHub와 Apps Script 라이브를 같은 내용으로 만들고, 실제 반영을 다시 읽어 확인하는 것이다. 현행 공통 기준은 `docs/AI_운영원칙.md`와 루트 `AGENTS.md`다.

## 경계

- Apps Script를 고친 작업은 이 스킬로 라이브까지 마친다. 따로 묻지 않는다(2026-10-21 사용자 확정, [AI 운영 원칙 · 비용과 권한](../../../docs/AI_운영원칙.md#비용과-권한)). 검토·조사만 맡은 작업, 배포물에 남의 미커밋이 섞인 경우, 아래 검증이 실패한 경우에는 배포하지 않는다. 로컬 제작, 커밋·push, 라이브 배포는 서로 다른 상태다.
- `clasp pull`은 작업본을 덮어쓰므로 실행하지 않는다.
- 저장소의 `.claude/hooks/*`는 현재 자동 등록된 보호막이 아니다(옛 `tools/githooks/`는 09-21에 비웠고 10-21에 폴더도 걷었다). `PreToolUse`·Git hook이 명령을 막아 준다고 가정하거나 보고하지 않는다. 아래 실측과 각 명령의 종료코드가 배포 게이트다.
- 신규 결제·인증·서비스 보호 절차가 필요하면 그 행동만 사용자에게 요청한다. 다른 검증과 준비는 계속한다.

## 실행

1. **현재 대상 확정**
   - `git status`와 관련 diff를 읽어 이번 작업의 파일, 다른 작업의 미커밋·스테이징, merge/rebase 여부를 구분한다.
   - 현재 하네스의 네이티브 작업·에이전트 목록과 메시지 기능으로 겹치는 파일만 조율한다. 특정 하네스의 옛 도구 이름을 가정하지 않는다.
   - 라이브 배포는 메인 checkout에서 한다. worktree에서 만든 변경은 승인된 범위만 먼저 통합하고, 다른 worktree나 남의 변경은 건드리지 않는다.

2. **배포 대상 검증**
   - 버전 대상 파일에 `[vNEXT]`가 있으면 검사보다 먼저 `node tools/bump-version.js --desc "한 줄 요약" --종류 <수리|보강|신설>`로 채번한다. 채번이 `Code.js`를 고치므로 아래 검사는 그 뒤에 돌아야 마지막 고침 뒤의 검사가 된다.
   - 루트 Apps Script `.js`에 `node --check`를 실행하고 `appsscript.json`을 JSON으로 파싱한다.
   - `node tools/test-ci.js`와 `node tools/deploy-security-check.js`를 실행한다. 전체 저장소의 기존 실패와 이번 변경 때문에 생긴 실패를 나눠 보고, 이번 변경의 관련 실패나 P0·P1은 해결 전 배포하지 않는다.
   - `node tools/보안검토과녁.js`로 미커밋과 미배포 범위를 확인한다. 데이터·인증·익명 웹앱·소급 불가 변경은 현재 사용 가능한 공식/네이티브 검토 통로로 판단 검토까지 한다. 실행하지 못한 검토를 통과로 쓰지 않는다.
   - 필요한 검토는 현재 공식 앱·CLI에서 한다. 역할은 `docs/AI_운영원칙.md`를 따르며 별도 실행기·검수 장부를 요구하지 않는다.
   - **배포 전 아르곤·GPT 검수(2026-10-21, 10-22 GPT 더함):** 위 검사를 통과한 최종 diff를 clasp push 전에 아르곤과 GPT에게 받는다 — `node tools/검수묶음.mjs 준비 <이름> --종류 백엔드 --바탕 <커밋>` 뒤 `아르곤 <이름>`·`GPT <이름>`(함께 돌려도 된다, [운영 원칙 「백엔드 검수」](../../../docs/AI_운영원칙.md)). 어느 쪽이든 재현되는 P0·P1은 고친 뒤 위 검사를 다시 돌린다. 한쪽이 한도·로그인으로 막히면 끝까지 읽은 다른 쪽만으로, 둘 다 막히면 Fable 검수로 대신하며, 완료 보고에 「아르곤 N건(반영 M) · GPT N건(반영 M)」을 적는다. GPT 구독이 끝나면 아르곤만 받는다.

3. **이력과 GitHub**
   - 2단계에서 채번했으면 `node tools/bump-version.js --check`로 대조한다.
   - 자기 변경만 `node tools/바로올리기.js <경로…> -m "…"`로 origin/master에 올린다(공용 작업본에서는 공용 문서를 `--조각`으로, AGENTS.md 커밋 줄). 먼저 `--실행` 없이 돌려 올라갈 경로·줄을 보고, 그다음 `--실행`을 붙인다. `git push origin HEAD:master`는 남의 미푸시 커밋까지 올리므로 쓰지 않는다. 다른 작업의 stage나 파일을 쓸어 담지 않는다.
   - `node tools/원격ci.js <올린 머리>`로 대상 커밋의 원격 상태를 확인한다. 인자를 빼면 로컬 HEAD를 보므로, 올리기가 커밋을 다시 쌓았으면 출력의 새 커밋(원래 → 새)을 준다. 기존의 관련 없는 적색은 그대로 밝혀 구분하고, 이번 배포 대상의 관련 실패는 라이브 전에 막는다.

4. **라이브 반영과 대조**
   - `clasp`는 PATH에서 먼저 찾고, Windows에서 없으면 공식 설치 위치를 확인한다.

     ```powershell
     Set-Location C:\Users\q1212\Documents\SYNK-appsscript
     $claspCommand = Get-Command clasp.cmd -ErrorAction SilentlyContinue
     $claspBin = if ($claspCommand) { $claspCommand.Source } else { Join-Path $env:APPDATA 'npm\clasp.cmd' }
     if (-not (Test-Path -LiteralPath $claspBin)) { throw 'clasp 실행 파일을 찾지 못했습니다.' }
     git diff --quiet origin/master -- tools/deploy-security-check.js .clasp.json .claspignore appsscript.json Code.js 엔진_synkbrief.js && node tools/deploy-security-check.js && & $claspBin push --force
     ```

   - push 줄은 사슬이다. 먼저 보안 검사 스크립트와, clasp가 올리는 세 파일·그 범위를 정하는 `.clasp.json`·`.claspignore`가 origin/master와 같은지 본다. 그다음 배포 표면 검사(`deploy-security-check.js`)가 통과해야 push까지 간다. 그래서 내 변경을 먼저 origin에 올려야 하고, 남의 미커밋이 그 파일들에 섞여 있으면 push하지 않는다.
   - 자동 모드 판정기는 도구 결과를 못 보기 때문에, 통과 여부를 이 사슬로 가르게 미리 허락해 두었다(2026-10-21 검수 반영). 이 꼴 그대로 쓴다. 경로 철자가 틀리면 `git diff`가 조용히 통과하니 고쳐 쓰지 않는다.

   - `node tools/배포판점검.js --라이브`로 실제 라이브를 읽는다. 고정 버전 배포가 낡았으면 도구가 제시한 **기존 deployment ID**를 `clasp deploy -i <기존ID> --description "<설명> #fp:<지문>"`로 갱신한다. ID 없이 새 배포를 만들지 않는다.
   - 다시 `clasp deployments`와 `node tools/배포판점검.js --라이브`를 실행해 배포 개수, 내용 지문, 도장을 확인한다.

## 완료 보고

커밋·push·로컬 검증·원격 CI·라이브 반영·라이브 대조를 각각 구분해 적는다. 이 세션이 할 수 있는데 확인하지 못한 층은 남은 일로 밝힌다. 첫 예약 트리거 실행 시점처럼 시간이 지나야 보이는 것은 「참고」로 적는다 — 참고는 세션 보관을 막지 않는다(AGENTS.md 배포·공개 줄). 자동 훅이 보호했다고 쓰지 않는다.
