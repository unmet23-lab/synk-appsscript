---
paths:
  - "Code.js"
  - "엔진_*.js"
  - "contents_*.js"
  - "appsscript.json"
---
# Apps Script 코드를 만질 때

- 라이브 반영은 `/deploy` 스킬 하나(구문검사 → 안전 테스트 → 보안 검토 → 커밋 → push → clasp push). 손 `clasp push`·`clasp pull` 금지 — clasp-guard 가 막지만, 규칙은 내가 안다.
- push ≠ 라이브. 배포 뒤 «닿았는지»는 실행 통로(트리거·화면)로 눈으로 잰다 — 코드에 있다고 반영된 게 아니다.
- 이 레인은 제 워크트리에서 짓는다(`EnterWorktree` · 로마자 이름 · 커밋·push·master 합치기가 한 벌).
- 새 대량 콘텐츠는 새 `contents_*.js` 파일 — 엔진 파일(`Code.js`·`엔진_*.js`)에 데이터를 섞지 않는다.
- 학생을 식별하는 데이터는 밖으로 내보내지 않는다 — 편의·시연 이유로도(결정.md 08-05 안전 · 철학 🚫㉣).
- 자격증명은 코드·로그·출력 어디에도 안 적는다. 밖으로 «키»로 나가는 낱말(스키마·env·태그)은 ASCII.
