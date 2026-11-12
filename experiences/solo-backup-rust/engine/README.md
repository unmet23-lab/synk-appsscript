# 업무 백업 엔진 — Rust 판의 갈래

2026-11-12 [0.5.0 엔진](../../solo-backup/README.md)(`experiences/solo-backup/src` · `tests`)을 바이트 그대로 갈라 왔다. 0.5.0은 동결(고치지 않음)이고, 1단계의 엔진 고침은 여기에만 한다 — 무엇을 왜 고치는지는 [1단계 설계](../STAGE1_DESIGN.md) 4장 · 6장, 시험은 7장이다.

- 첫 커밋은 `src` · `tests` · `package.json` · `package-lock.json` · `THIRD_PARTY_NOTICES.txt`를 바이트 그대로 복사한 것이고, 두 쪽 시험 결과가 같음을 보였다(T1, [QA](../QA.md)).
- 화면 앱 · 회차 실행기의 워커가 이 폴더를 묶는다(`scripts/stage-resources.cjs` — Electron 전용 `main.cjs` · `preload.cjs` · `startup.cjs`는 묶지 않는다).
- 시험: `npm ci --ignore-scripts --prefix experiences/solo-backup-rust/engine` 뒤 `SOLO_BACKUP_RESTIC=<restic 0.19.1>` `node --test experiences/solo-backup-rust/engine/tests/*.test.cjs`.
