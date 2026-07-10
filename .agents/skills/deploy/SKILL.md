---
name: deploy
description: SYNK 배포 3종 세트 — 구문검사(node --check) → git 커밋 → git push → clasp push(라이브)를 순서 보장으로 실행한다. Code.js·contents_*.js·appsscript.json 등 Apps Script 코드를 변경한 뒤 라이브에 반영할 때 항상 이 스킬을 쓴다. "배포해줘", "/deploy", "라이브 반영"에 트리거.
---

# /deploy — SYNK 배포 파이프라인

목적: **GitHub(백업)과 Google Apps Script(라이브)가 어긋나는 사고 방지.** 구문 깨진 코드가 라이브에 올라가는 것 차단.

## 도구 경로 (PATH에 없음 — 전체 경로 사용)
- node: `"/c/Program Files/nodejs/node.exe"` (Bash) / `& "C:\Program Files\nodejs\node.exe"` (PowerShell)
- clasp: `"/c/Users/q1212/AppData/Roaming/npm/clasp.cmd"`
- 작업 디렉토리: `C:\Users\q1212\Documents\SYNK-appsscript`

## 절차 (순서 엄수 — 하나라도 실패하면 다음 단계 진행 금지)

1. **오염 확인**: `git status --short` — 내 작업이 아닌 변경(다른 세션 흔적)이 섞여 있으면 멈추고 유호님께 보고. `docs/세션보드.md`에 다른 세션이 같은 파일 '작업중'이면 조율 먼저.
2. **구문 검사**: 저장소 루트의 모든 `.js` 파일에 `node --check` 실행. **하나라도 실패 → 배포 중단**, 원인 수정 먼저.
   ```bash
   for f in *.js; do "/c/Program Files/nodejs/node.exe" --check "$f" || exit 1; done
   ```
3. **appsscript.json 검증**: `node -e "JSON.parse(require('fs').readFileSync('appsscript.json','utf8'))"` — 임시 webapp 설정 등 검증 잔재가 남아있지 않은지 눈으로도 확인.
4. **커밋**: `git diff --stat`으로 내 작업만 들어있는지 확인 후 커밋. 메시지 형식: `[v9.xx] 제목 — 요약` + `Co-Authored-By: Codex <모델명> <noreply@anthropic.com>`.
5. **GitHub 백업**: `git push origin master`.
6. **라이브 배포**: `clasp push --force`.
7. **보고**: 커밋 해시 + "GitHub·라이브 동기화 완료"를 1줄로. 트리거가 코드를 쓰는 시각(07시 morning, 14/22시 calc, 월 07시 weekly)을 감안해 첫 실전 작동 시점을 알려줄 것.

## 금지
- 구문 검사 없이 clasp push 단독 실행 금지.
- 커밋 없이 clasp push 금지 (라이브와 git 이력 어긋남).
- 다른 세션의 미커밋 변경을 내 커밋에 쓸어담기 금지.

## 라이브 함수 검증이 필요할 때 (선택)
`clasp run`은 GCP 불일치로 불가. 검증된 우회법(임시 토큰 doGet 러너 → create-deployment → HTTP 호출 → **러너 제거 + delete-deployment + 404 확인**)은 메모리 `synk-tooling-paths` 참조. 러너를 남긴 채 종료 금지.
