동결 불가. 지적 14건(P0 1건·P1 13건).

[P0] 트리거 처방이 배포 사후검사를 즉시 깨뜨린다 — [§5](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:108>)는 `submission.created`가 아닌 제출 행에는 잡을 만들지 않지만, 현행 사후검사는 사건 종류와 무관하게 모든 `submissions`에 잡이 있어야 `잡없는제출=0`으로 판정한다([확인_적용후상태.sql:254](<C:/Users/q1212/Documents/SYNK-talk/supabase/확인_적용후상태.sql:254>), [:352](<C:/Users/q1212/Documents/SYNK-talk/supabase/확인_적용후상태.sql:352>)). 재현 입력: 패치 뒤 `task.assigned`와 그 제출 행을 1건 만들면 잡 없는 제출이 1건이 되어 배포 확인이 실패한다.

[P1] “라디오 승격 잡은 소비자 0”이라는 진단이 범위를 거짓으로 넓힌다 — [§0㉢·§5](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:47>)는 라디오 승격 행을 한 갈래로 묶지만, `!출석`·`!목표`는 `submission.created`인 실제 교정 대상이고 소비자가 있으며, 고아는 `quiz.answered` 제출 행뿐이다([radio-promote/index.ts:28](<C:/Users/q1212/Documents/SYNK-talk/supabase/functions/radio-promote/index.ts:28>), [라디오승격.js:43](<C:/Users/q1212/Documents/SYNK-talk/lib/라디오승격.js:43>)). 재현 입력: `!목표 오늘 복습해요` 승격 행의 기존 잡까지 “라디오 고아”로 청소하면 실제 교정 대상이 처리되지 않는다.

[P1] `transcript_state=null` 처방은 현행 `/events`에서 실행되지 않는다 — [§3·§8](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:84>)과 달리 `/events`는 클라이언트의 `transcript_state`를 읽지 않고 서버의 `전사대상()` 결과를 삽입하며, 음성이 있으면 `pending`을 강제한다([events/index.ts:520](<C:/Users/q1212/Documents/SYNK-talk/supabase/functions/events/index.ts:520>), [전사.js:46](<C:/Users/q1212/Documents/SYNK-talk/lib/전사.js:46>)). 재현 입력: `audio_ref='demo.wav'`, 파일 상태가 `missing`이 아닌 음성 일기를 보내면 문서 예상 `null`이 아니라 `pending`으로 저장돼 전사 배치에 잡힌다.

[P1] `code_switch_spans`는 열만 있고 생산자가 0곳이다 — [§3·§8㉡](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:85>)은 글자 판정 결과를 기존 칸에 넣는다고 하지만 `/events` INSERT 열 목록에는 이 칸이 없고, 전사 UPDATE도 `stt_segments`까지만 쓴다([events/index.ts:524](<C:/Users/q1212/Documents/SYNK-talk/supabase/functions/events/index.ts:524>), [transcribe/index.ts:200](<C:/Users/q1212/Documents/SYNK-talk/supabase/functions/transcribe/index.ts:200>)). 재현 입력: `안녕 Сайн`을 제출해도 `code_switch_spans`는 `null`로 남고, 별도로 제시한 `ko|mn|mixed|unknown` 값을 저장할 칸도 문서에 없다.

[P1] “계약 등재 여섯 자리”는 실제 계약 구조를 누락했다 — [§4](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:101>)는 값목록이 `이벤트검증.js`에 있다고 적었지만 실제 정본은 `계약/수집_교정_계약.json`이며, 새 payload 네 필드의 화이트리스트와 DB의 `event_type`·`task_type` CHECK 교체도 필요하다([수집_교정_계약.json:98](<C:/Users/q1212/Documents/SYNK-talk/계약/수집_교정_계약.json:98>), [:112](<C:/Users/q1212/Documents/SYNK-talk/계약/수집_교정_계약.json:112>), [이벤트검증.js:8](<C:/Users/q1212/Documents/SYNK-talk/lib/이벤트검증.js:8>)). 재현 입력으로 문서 모양의 `diary.opened`를 현행 검증기에 넣자 사건 값목록·앱사건·payload 네 필드에서 6/6 오류가 발생했다.

[P1] `diary.opened`를 남기는 것 자체가 닫힌 결정과 충돌한다 — [§0㉡](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:37>)은 “안 쓴 날은 아무 일도 일어나지 않는다”고 적고도 [§4](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:94>)에서 미작성 열람을 영구 사건으로 보존한다. 현행 진행률은 모든 사건의 최소 `occurred_at`을 첫날 판정에 사용하므로([progress/index.ts:151](<C:/Users/q1212/Documents/SYNK-talk/supabase/functions/progress/index.ts:151>)), 첫날 열고 닫은 뒤 다음 날 처음 작성하면 존재하지 말아야 할 전날 이력을 근거로 “첫날 아님”과 전날 0건을 표시한다.

[P1] 자발발화축의 네 값 중 길이·매체는 소비자에게 전달되지 않는다 — [§7](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:160>)은 글자 수·음성 길이·매체를 센다고 하지만, `deliver`가 `학습자상태()`에 넘기는 제출 조인 결과에는 `task_snapshot`만 있고 `body_original`·`audio_ref`·`audio_duration_sec`·`capture_meta`·`task_format`이 없다([deliver/index.ts:395](<C:/Users/q1212/Documents/SYNK-talk/supabase/functions/deliver/index.ts:395>), [:430](<C:/Users/q1212/Documents/SYNK-talk/supabase/functions/deliver/index.ts:430>)). 재현 입력: 같은 시각에 100자 글과 20초 음성을 넣으면 현재 상태 입력에서는 두 산출물의 길이와 매체를 읽을 수 없다.

[P1] `intervention.delivered` 재사용은 기존 사건의 뜻을 오염시킨다 — [§6](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:136>)의 맞장구는 고치지도 평가하지도 않는 반응인데, 현행 `intervention.delivered`는 “지도 방식→반응→1·7·30일 성과”를 재는 교수 개입의 닻이며 전건을 성과 회수 대상으로 센다([성과회수.js:11](<C:/Users/q1212/Documents/SYNK-talk/lib/성과회수.js:11>), [:64](<C:/Users/q1212/Documents/SYNK-talk/lib/성과회수.js:64>), [:279](<C:/Users/q1212/Documents/SYNK-talk/lib/성과회수.js:279>)). 재현 입력: 일기 맞장구 1건을 넣으면 특별 예외가 없는 소비자는 이를 교수 개입 1건으로 세며, §5의 “별도 필터”가 필요하다는 사실 자체가 같은 사건 뜻이 아님을 증명한다.

[P1] 맞장구는 저장 위치만 있고 실행 통로가 없다 — [§6](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:141>)에는 생성 주체·호출 시점·실패 상태·재시도·타임아웃·대체 응답이 없고, `intervention.delivered`는 앱이 만들 수 없는 서버 사건이며 현행 생산자 장부는 일기와 무관한 `deliver`만 가리킨다([이벤트검증.js:65](<C:/Users/q1212/Documents/SYNK-talk/lib/이벤트검증.js:65>), [:394](<C:/Users/q1212/Documents/SYNK-talk/lib/이벤트검증.js:394>)). 재현 입력: `diary.written` 저장을 성공시킨 뒤 현행 통로를 모두 돌려도 맞장구 사건을 만드는 호출자가 없어 학생은 확정된 두 번째 결과를 받지 못한다.

[P1] 맞장구의 1:1 계보와 필수 메타가 강제되지 않는다 — [§6](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:143>)은 `parent_event_id`·모델·프롬프트 판이 남는다고 선언하지만 해당 열들은 nullable이고, 물리 유일성은 `(learner_id,idempotency_key)`뿐이라 “일기 하나당 맞장구 하나”를 막는 제약이 없다([engine_c6.sql:404](<C:/Users/q1212/Documents/SYNK-talk/supabase/migrations/20260806150000_engine_c6.sql:404>), [:431](<C:/Users/q1212/Documents/SYNK-talk/supabase/migrations/20260806150000_engine_c6.sql:431>)). 재현 입력: 두 워커가 같은 `parent_event_id`에 서로 다른 멱등키로 답하면 둘 다 저장되고, 모델·프롬프트 판이 빈 답도 DB가 받아 시즌 종이가 어느 답을 찍어야 하는지 결정할 수 없다.

[P1] 음성 전용 일기에는 맞장구 입력이 없다 — [§3](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:82>)은 음성만 허용하고 [§8](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:170>)은 문서 의도상 전사를 끄지만, §6에는 음성을 직접 읽는 모델이나 언어 판정·실패 갈래가 없다. 재현 입력: `body_original=null`, `audio_ref`만 있는 일기에서는 AI가 내용을 알 수 없어 구체적 맞장구를 만들 수 없으며, 고정 문구를 내면 소유자가 확정한 “AI가 읽고 짧게 맞장구”가 거짓이 된다.

[P1] 날짜·물음의 세 사본 사이에 정합 불변식이 없다 — [§3·§4](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:79>)는 `task_ref`, `task_snapshot`, `diary.opened.payload`에 날짜와 물음 ID를 반복하지만 `diary.written→diary.opened` 고리, 값 일치 검사, 날짜 산출 시점과 시간대를 정의하지 않는다. 재현 입력: `task_ref=diary:2026-09-05:p1`, 스냅샷은 `2026-09-04/p2`, 열린 사건은 `2026-09-06/p3`이어도 제시된 규격에는 거부 규칙이 없어 날짜 목록과 시즌 종이가 진실값을 고를 수 없다.

[P1] 두 기기 중복을 “비용”으로 수용하면 의도가 영구 소실된다 — [§10-4](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:217>)은 서로 다른 초안 키로 온 중복과 의도적인 두 장을 구별하지 못한다고 인정하면서 해결 없이 동결 대상으로 남긴다. 재현 입력: 두 기기가 같은 본문·물음·날짜를 UUID A/B로 전송하면 두 행이 모두 유효하고, 나중에는 중복 재전송인지 학생이 같은 말을 두 번 기록한 것인지 복원할 증거가 없다.

[P1] “내용 연결이 늘었나의 유일한 열쇠”라는 결론도 틀렸다 — [§9·§10-1](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:198>)은 내용 분석만 ㉡ 사람 이해를 채울 수 있다고 취급하지만, 매체 선호·자발 작성 시간·산출량 추세도 정의와 소비자를 세우면 ㉡의 습관 근거가 되며, 반대로 “학교를 그만두고 싶다” 같은 내용은 ㉢ 삶 이해일 수 있어 내용만 연결한다고 ㉡이 자동으로 차지 않는다([SYNK_철학.md:98](<C:/Users/q1212/Documents/SYNK-appsscript/docs/SYNK_철학.md:98>)). 재현 입력: 내용이 같은 글·음성 두 건은 사람 이해 신호가 다르고, 길이·시각이 같은 행복/중단 문장은 삶·정서 분류 계약 없이는 어느 이해 칸에도 안전하게 들어가지 못한다.

[P1] 학생 경험은 확정 문장만 있고 화면 규격이 없다 — [§2·§10](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:62>)에는 첫 화면에서 “이게 무엇이고 무엇을 하면 되는가”, 글/음성 선택과 저장 상태, 맞장구 대기·실패, 목록→되듣기→시즌 종이의 연결이 없고 맞장구 언어·음성 종이 표현·최신 수단 정찰도 미정이다([학생일기_설계_v5.md:210](<C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v5.md:210>)). 재현 입력: 처음 온 초급 학생이 음성만 남기면 무엇을 누르고 언제 어떤 답을 받으며 어디서 다시 듣는지 문서만으로 화면을 만들 수 없으므로, 자기설명의 전체 그림·연결과 기본 게이트의 신선함·재방문 동기가 모두 판정 불능이다.

값비싼 변경 확인: 새 사건 2/2개, 새 `task_type` 1/1개, 트리거 의미 변경 1/1개, 새 학생 화면 1/1개, 기존 개입 사건의 뜻 확장 1/1개 — 총 6/6개를 봤고 모두 문제다. 대외 TOPIK 보장·돈·닫힌 TTS/음악 결정의 변경은 0건이다.

검수 범위:

- 전문 7/7: 두 저장소 지침 2개, 형제 저장소 필수 규약 2개, 공격 대상 1개, v4 심문 결과 2개.
- 관련 정본·실물 20/20: 결정·철학·제품방향·기각 이력, L0/C0/공용 계약, 이벤트 검증·저장·출처·전사·상태·성과회수·진행률·배달·라디오 승격·큐 트리거·사후 확인.
- 대조 시험 4/4개 파일·107/107개 성공. 이는 v5 통과가 아니라 현행 계약과 전사·성과회수 불변식이 위 충돌대로 살아 있음을 확인한 결과다.
- 안 본 것 4종: 라이브 DB, 실제 배포된 함수 묶음, 실기기 학생 화면, 아직 존재하지 않는 일기 구현. 요청에서 제외한 개인정보·비식별·동의·철회·권한 축은 판정하지 않았다.

### 이 문서보다 나은 대안 구조 1개

`diary.opened`는 폐기하고 `diary.written→submissions`만 원본 사건으로 둔다. 날짜는 `task_snapshot.diary_date` 한 곳만 정본으로 삼고, `task_ref`는 물음의 안정 ID만 가리키며 둘의 일치·날짜 형식·시간대를 검증한다.

기존 `pipeline_jobs`에 `job_kind=correction|diary_ack`를 추가해 `submission.created`는 교정, `diary.written`은 맞장구 작업만 만들고 배정·퀴즈는 만들지 않는다. 맞장구는 교수 개입과 분리된 `diary.acknowledged` 서버 사건으로 두어 `parent_event_id`·`output_text`·`model`·`prompt_ver`를 필수화하고, 멱등키를 `diary-ack:{written_event_id}`로 고정하며 `content.viewed`가 이 사건을 가리키게 한다.

음성 일기는 현행 STT의 `pending→machine` 통로를 타되 학생에게 교정으로 노출하지 않고, 맞장구 작업은 전사 완료 뒤 실행한다. `diary.signal.extracted`를 원문 사건에 연결해 사람/삶 이해 종류·근거 구간·모델·프롬프트 판을 남기고 자동 소비자까지 세운 뒤, 트리거 사후검사·자발발화축 조회 필드·첫 화면 자기설명·날짜 목록·종이 조판·최신 수단 정찰을 한 묶음으로 닫아야 동결할 수 있다.