# 드라마 시범판 → 학습 기록(Atlas Trail) 왕복 — 2026-11-02

`/drama/` 시범판(`experiences/drama/pilot`)이 대사 테이크마다 학습 기록(응답 꼴 `spoken`)을 남기게 이은 일의 실측이다. 서버 쪽(talk synk-learning v80 · synk-account v89가 spoken을 받음)은 11-02에 먼저 끝났다([트랙](../../../../docs/_ops/트랙.md) 「드라마 말하기 응답 꼴 spoken 서버 학습 기록」).

## 어떻게 남기나

- 길은 WORLD 게임과 같다: 화면은 이 창이나 같은 출처 부모 창의 계정 학습 호스트(`SYNKLearningHost`)에만 적고, 호스트가 학습 기록 동의가 켜진 계정에서만 서버로 보낸다(사건 ID로 중복을 뺀다). 호스트가 없으면(로그인 전 · 지금의 이PC 시범) 아무것도 남지 않는다. 묶음은 [`learning-entry.cjs`](../../pilot/learning-entry.cjs) → `tools/build-drama-learning.js` → `atlas-learning.js`.
- 차례 하나(장면의 한 줄 · 테이크 2 · 새 상황) = 보임 하나(gameId `drama-s1`, [말하기 지도](../../../../strata/maps/ko-speaking.json)의 능력, 난도 장면 1 · 새 상황 2), 테이크 하나 = 시도 하나. 도움은 한국어 카드가 보임(cue) · 빈칸 열기와 모범 보기(answer), 테이크 2는 앞 코치 카드가 대사 전체를 보이므로 늘 answer. 「제가 한 말과 달라요」는 그 시도를 기록에서 뺀다(record.excluded).
- 「혼자 해 봄」(assessable)은 시범 서버가 테이크 응답의 `trail`로 정한다(`tools/lib/drama-pilot-service.mjs` `trailOf`): 검수를 통과한 새 상황 명세에서 모범을 보기 전 첫 판정 테이크가 규칙으로 확신한 것(통과+확실 → 맞음, 노트 → 고칠 점)뿐이다([기획 §3-5](../../../../docs/드라마말하기_기획.md#3-5-말하기-향상을-확인하는-단위) · 결정 10-31 ②). 장면 · 테이크 2 · 판정 보류 · 검수 전 명세는 시도(unassessed)로만, 안 들린 테이크는 대답 없음(unanswered)이다. **지금 시범판의 새 상황(편의점)은 검수 전 연습 예시라 「혼자 해 봄」이 하나도 생기지 않는다** — B/C 측정에는 검수를 통과한 새 상황 문항이 따로 든다.
- 사건에는 대사 id · 능력 이름 · 판정 · 도움 종류 · 시도 순서 · 시각만 들고, 받아 적은 글 · 소리 · 대사 한국어는 들지 않는다.

## 합성 계정 왕복(운영 · 리허설 DB 안 건드림)

[`리허설.mjs`](리허설.mjs): talk origin/master `6f18ed32`를 git 밖에 풀어 synk-learning과 같은 서비스(`createService` + 증분 검증 = 배포 묶음 `_shared/synk-atlas.js`)를 PGlite 메모리 DB와 합성 계정 하나로 띄우고, 시범 서버가 그 계정을 화면에 준다.

```bash
git -C ../SYNK-talk archive origin/master lib supabase/functions/_shared/synk-atlas.js supabase/migrations tests/lib package.json | tar -x -C .tmp/drama-learning-20261102/talk
```

```bash
NODE_PATH=../SYNK-talk/node_modules node experiences/drama/qa/학습기록-20261102/리허설.mjs --port 8796 --받아쓰기 흉내
```

브라우저(앱 안 브라우저)에서 승인 모범 소리(`model-6/7/8.mp3`)를 WebAudio 합성 마이크로 넣고 장면을 끝까지 돌렸다. 받아쓰기는 **흉내**다 — 시범판의 기존 키 통로가 이날 크레딧 소진(unmet23 · 429)으로 막혀, 테이크마다 받아 적은 글을 파일로 정해 두었다. 판정 · trail · 기록 길은 그대로 돈다.

| 경우 | 한 일 | 결과 |
|---|---|---|
| 동의 켬 | 장면 3줄(6번 줄 반말 → 선배 되묻기 → 고쳐 통과, 7 · 8번 통과) → 「다른 말로 한번 더」 테이크 2 + 「제가 한 말과 달라요」 → 새 상황 통과 → 모범 보기 → 마침 | 서버 저장 26건: 보임 5(전부 spoken · 능력 explain/ask/thank/ask/ask · 새 상황 난도 2 · 첫 노출 true) · 시도 6(모두 unassessed — 장면 · 테이크 2 · 검수 전 새 상황) · 도움 4(cue 3 · answer 1). 이때는 테이크 2 앞 코치 카드가 대사 전체를 보인 것을 기록하지 않았다 — Fable 지적 뒤 테이크 2 보임에 answer 도움 하나를 더한다 · 뺌 1 · 결정/끝남 각 5. 요청 get 13 · post 13 · 거절 0. 저장된 사건 어디에도 한글 없음 |
| 다시 읽기 | 기기 저장(localStorage)을 지우고 다시 열기 | 호스트가 서버에서 26건을 다시 받아 synced · cursor 26 · 새 상황 사건 있음 · 기기 저장에도 한글 없음 |
| 테이크 2 다시 녹음(검수 고침 뒤) | 장면 3줄 통과 → 「다른 말로 한번 더」 테이크 2 → 「다시 녹음」 → 테이크 2 | 테이크 2 보임은 하나이고 시도가 1 · 2로 이어짐(고치기 전에는 다시 녹음마다 보임이 새로 열리고 시도가 1로 되돌았다 — 아르곤 A2). 저장 20건 · 한글 없음 |
| 동의 끔 | 같은 합성 계정 꼴, 동의 끈 채 장면 첫 테이크 | /api/learning 요청 0, 호스트 phase local(WORLD와 같게 기기 안에만) |

요약 파일은 git 밖 `.tmp/drama-learning-20261102/summary-consent-on.json` · `server-consent-on.log` · `server-consent-off.log`.

## 시험

`node --test tests/drama-pilot-learning.test.mjs tests/drama-pilot.test.mjs` — trailOf 규칙(검수 전 · 모범 본 뒤 · 두 번째 판정 · 장면은 혼자 해 봄 아님), 호스트 없음 = 기록 없음, 동의 끔 = 전송 없음, 시도 번호 · 도움 한 번 · 뺌, 서버 Trail 검증기(`atlas/engine.js` validateIncrement · createSession) 통과, 받아 적은 글이 사건 · 기기 저장에 없음, `/api/learning`은 리허설 계정이 있을 때만 열리고 CSRF를 지킴, 묶음이 원천과 같음.

## 남은 것

- **실제 계정 왕복**: 시범판은 이PC 루프백 서버라 SYNK ID로 로그인할 수 없다. 화면은 WORLD 호스트가 있으면 그대로 쓰게 짜 두었으므로(WORLD 엔진을 호스트로 세운 같은 log에서 WORLD 게임이 함께 도는 것까지 확인), 실제 계정 왕복은 드라마를 WORLD(로그인 · 학습 기록 동의가 있는 곳) 안에 올릴 때 본다.
- **B/C 측정 문항**: 지금 새 상황은 검수 전 예시라 「혼자 해 봄」이 생기지 않는다. 검수 통과 B 문항과 6~9일 창의 C 문항이 있어야 단원 측정이 된다.
- **받아쓰기 통로**: 시범판 기존 키 통로(unmet23)가 크레딧 소진 429로 막혀 있다(11-02 확인) — 실제 녹음 시범 전에 크레딧이 든 키로 돌려야 한다.
