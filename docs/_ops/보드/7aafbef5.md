# 보드 — 7aafbef5

| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |
|---|---|---|---|
| 2026-08-12 | **보드 「데이터 행」 판정이 두 벌 — 짧은 날짜·5칸 줄이 조용히 사라진다**(F322·F330·F331 · 같은 자리 3번째 → 쓸 수 없게 만든다 · 장부 미해소에서 집음 · 새 선언 · 남의 줄 무변경) | `.claude/hooks/board-guard.js`·`tools/lib/보드.js`·`tests/보드폴더.test.js`+픽스처·장부 3줄·이 줄 (엔진 0 · talk 0 · 배포 0 · 운영 0) | ✅**종결** (`local_7aafbef5` · `9a53ccf0`) — 행 판정 3벌→1벌(`표줄`→`데이터행` 파생)·⑨=쓰는 순간 deny·board.js 유령 stderr·board-move 후보 포함 · 회귀 12 · 유령 1 이관 · F322·F330·F331 해소 · 상세=memory `board-row-definition-single` |
