동결 불가. 지적 16건(P0 6건·P1 10건).

[P0] 새 사건 2/2가 계약·검증·도달 장부 밖이다 — [§3](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:66)은 `diary.written`·`diary.opened`만 선언하지만, 현재 17종 사건 값목록에는 둘 다 없고 `앱사건`·`사건출처`·`이벤트별필수`·`생산자`·`엔진도달`에도 없다([이벤트검증.js](C:/Users/q1212/Documents/SYNK-talk/lib/이벤트검증.js:40), [사건출처.js](C:/Users/q1212/Documents/SYNK-talk/lib/사건출처.js:15)). 재현 입력: 정상 봉투에 `event_type='diary.written'`을 넣어 `/v1/events`로 보내면 현재 검증기는 값목록 밖 또는 앱이 만들 수 없는 사건으로 거부하고, 목록만 늘리면 출처·생산자·도달 전건 대조가 실패한다.

[P0] `diary_entries`의 귀속이 두 정본으로 갈린다 — [§4㉡](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:100)은 `event_id`와 `learner_id`를 함께 두면서 같은 학생인지 강제하지 않고, `event_id`가 `diary.written`인지도 확인하지 않는다. 기존 L0는 바로 이 사고 때문에 `submissions.learner_id`를 제거했다([L0_데이터계약.md](C:/Users/q1212/Documents/SYNK-talk/docs/L0_데이터계약.md:205)); 재현 입력: 합성 학생 A의 `submission.created` 사건과 합성 학생 B의 `learner_id`를 한 행에 넣으면 제시된 FK·UNIQUE를 전부 통과한다.

[P0] `diary.opened`가 실제로 보여준 물음은 미작성 순간 영구 소실된다 — [§4㉡](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:104)은 물음 스냅샷을 작성된 `diary_entries`에만 두고 `opened_event_id`도 nullable로 둔다. 재현 입력: 물음 A를 열고 쓰지 않은 뒤 팩을 B로 개정하면 `diary.opened`에는 `prompt_id`·원문·팩 판이 없으므로 A의 노출과 A→무작성 관계를 복원할 수 없다.

[P0] 사건과 원문이 함께 서거나 함께 실패한다는 규격이 없다 — [§4](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:87)은 DDL만 있고 `learning_events`·`diary_entries`의 단일 트랜잭션, 실패 응답, 재시도 보충 경로를 정의하지 않는다. 기존 `/events`는 이 불변식을 명시적으로 한 트랜잭션에 묶는다([events/index.ts](C:/Users/q1212/Documents/SYNK-talk/supabase/functions/events/index.ts:232)); 재현 입력: `diary.written` 삽입 뒤 빈 내용·파일 검사로 일기 행 삽입이 실패하면 재전송은 기존 멱등키에 막혀 사건만 남는 고아가 영구화된다.

[P0] 불변 트리거가 원문의 절반만 잠근다 — [§4㉢](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:143)은 네 필드만 UPDATE 금지하고 `event_id`·`learner_id`·`opened_event_id`·`diary_date`·`prompt_id`·`prompt_pack_ver`·`occurred_at`·`schema_ver`를 열어 둔다. 재현 입력: 저장 후 `event_id`와 `prompt_id`를 다른 유효값으로 UPDATE하면 학생이 언제 어떤 물음을 보고 무엇을 남겼는지가 바뀌지만 제시된 규율은 막지 못한다.

[P0] 확정된 AI 맞장구의 원문·계보·실제 열람이 전부 사라진다 — [§2](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:61)은 맞장구를 확정 기능으로 적었지만 스키마와 사건 사슬에는 AI 출력, 모델, 프롬프트 판, 생성 시각, 일기 고리, 학생 열람 사건이 0개다. 기존 계약은 일반 AI 답을 `intervention.delivered`의 `output_text`로 남기고 실제 열람을 `content.viewed`로 가르도록 정한다([수집_교정_계약.json](C:/Users/q1212/Documents/SYNK-appsscript/계약/수집_교정_계약.json:201)); 재현 입력: 같은 일기에 확률적 맞장구 X가 표시된 뒤 모델이나 프롬프트가 바뀌면 X를 재생성하거나 어느 답이 재방문을 낳았는지 복원할 수 없다.

[P1] “두 기기 중복은 기존 멱등키가 접는다”는 거짓이다 — [§4㉡](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:132)의 기존 제약은 같은 `(learner_id, idempotency_key)`만 접으며, 키는 각 큐 항목이 기기에서 한 번 만든 값이다([사건통로.js](C:/Users/q1212/Documents/SYNK-talk/src/사건통로.js:103)). 재현 입력: 두 기기가 같은 초안을 서로 다른 UUID 키로 전송하면 둘 다 저장되고, 하루 여러 장도 허용했으므로 사후에는 중복과 의도적인 두 장을 구별할 수 없다.

[P1] `diary.opened` 분모가 “안 쓴 날은 결손으로 세지 않는다”는 확정과 충돌한다 — [§2](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:57)은 미작성일에 아무 일도 일어나지 않는다고 적으면서 [§6](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:179)은 열고 쓰지 않은 행동을 분모에 넣어 비율을 낮춘다. 재현 입력: 학생이 탭을 한 번 열고 닫으면 `0/1`이라는 부정 신호가 학습자 모델에 남아 [결정.md](C:/Users/q1212/Documents/SYNK-appsscript/docs/_ops/결정.md:68)의 “결손으로 세지 않는다”를 뒤집는다.

[P1] 분자·분모는 같은 관측 단위가 아니어서 비율이 1을 넘는다 — [§4㉡](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:132)은 하루 여러 장을 허용하지만 [§6](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:181)은 열린 화면 수와 저장된 글 수를 그대로 나눈다. 재현 입력: 한 번 연 화면에서 두 장을 연속 저장하면 `2/1`, 화면 재마운트로 다섯 번 열린 뒤 한 장을 저장하면 `1/5`가 되어 동일한 작성 의지가 앱 생명주기에 따라 다르게 측정된다.

[P1] `쓰는사건` 두 줄 추가만으로 일기 필드는 조회되지 않는다 — [§6](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:179)은 목록 등재만 하면 조회가 따라온다고 하지만, 실제 자동 소비자들은 `learning_events`에 `submissions`만 조인한다([deliver/index.ts](C:/Users/q1212/Documents/SYNK-talk/supabase/functions/deliver/index.ts:435), [teach/index.ts](C:/Users/q1212/Documents/SYNK-talk/supabase/functions/teach/index.ts:918)). 재현 입력: `diary_entries.audio_duration_ms=12000`인 음성 일기를 넣어도 자동 상태 계산에 전달되는 행에는 그 값과 본문·매체가 없어 길이·매체 축이 null 또는 0으로 남는다.

[P1] 성과회수 전용 목록으로 좁히면 같은 `학습자상태`가 서로 다른 입력을 받는다 — [§3](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:83)은 성과회수에서 일기 둘을 제외하라고 하지만, 성과회수는 개입 전후를 다시 `학습자상태()`로 계산하므로 상태 입력 전량을 요구한다([성과회수.js](C:/Users/q1212/Documents/SYNK-talk/lib/성과회수.js:227)). 재현 입력: 개입 뒤 유일한 행동이 일기 작성이면 일반 상태 계산에는 자발발화축이 생기고 성과회수 상태에는 사라져, 같은 학생·같은 시점이 호출자에 따라 두 상태가 된다.

[P1] DDL이 주석에 적힌 상태 규약을 강제하지 않는다 — [§4㉡](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:111)은 빈 문자열, 음수 길이, 임의 언어값, 모순된 전사 상태를 모두 허용한다. 재현 입력: `body_original=''`, `input_lang='오타'`, `lang_source='none'`, `audio_duration_ms=-1`, `transcript_state='완료'`, `transcript=null`인 행은 `diary_has_content`를 통과해 빈 글이 `diary.written` 분자로 계산된다.

[P1] 전사 “미루기”가 확정된 즉시 맞장구와 음성 학습을 동시에 끊는다 — [§5㉠](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:151)은 음성 전사를 기본적으로 영구 비대상 모양인 null에 두면서, 직접 음성을 읽을 모델·호출 규격·실패 갈래·재개 조건도 정하지 않는다. 재현 입력: 한국어 음성만 남긴 학생에게 서버는 내용을 모른 채 일반 문구를 내거나 맞장구를 못 내고, 그 음성의 발음·어휘는 §8의 기한 없는 미정 상태로 엔진 밖에 남는다.

[P1] 일기 내용은 저장될 뿐 엔진이 읽지 않는다 — [§6](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:188)이 정의한 소비는 수·길이·시각대·매체 네 값뿐이며 `prompt_text`·`body_original`을 어휘 지도, 의미 관심사, 오류 말뭉치, 평가셋 중 어디에도 연결하지 않는다. 재현 입력: 길이와 작성시각이 같은 “친구와 놀아 행복했다”와 “학교가 힘들어 그만두고 싶다”는 제시된 축에서 완전히 같은 행이 되어 “한 사람을 깊이 이해한다”는 궁극 가치에 닿지 않는다.

[P1] 학생 회수 화면과 자기설명 규격이 동결할 수준으로 존재하지 않는다 — [§8](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:207)은 맞장구 언어, 목록 상한, 음성만 있는 종이 표현, 최신 수단 정찰을 전부 미정으로 남겼고, 첫 화면에서 무엇인지·무엇을 하면 되는지 알려줄 문안과 단계도 없다. 재현 입력: 처음 온 초급 학생이 음성만 저장하면 어떤 언어의 답을 받는지, 카드에서 어떻게 되듣는지, 종이에 무엇이 찍히는지 어느 절에서도 결정할 수 없다.

[P1] 새 표는 기존 원문 표의 재발명이고 정본의 “있는 관에 얹는다”와 충돌한다 — [§4㉠](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생일기_설계_v4.md:89)은 새 표의 실질 근거를 처리 트리거 하나로 좁혔지만, 기존 `submissions`에는 이미 물음 참조·스냅샷·본문·음성·봉투·길이·전사·시각·판이 있다. [세층합류 설계](C:/Users/q1212/Documents/SYNK-appsscript/docs/세층합류_설계_v1.md:65)의 “새 테이블 0”은 폐기되지 않았고 09-05 결정은 새 화면만 예외로 열었다; 재현 입력: 새 표로 구현하면 불변·원자성·전사·조회·가드가 두 벌이 되고 한쪽만 갱신되는 순간 같은 학생 산출물에 서로 다른 규율이 적용된다.

값비싼 변경 확인: 새 물리표 1/1개·새 사건 2/2개·새 학생 화면 1/1개·AI 출력 통로 1/1개를 봤다 → 계약·불변식·자동 소비·학생 경험이 함께 닫히지 않아 문제다.

읽은 파일: 공격 대상 1/1 전문, v3 심문 결과 2/2 전문, `결정.md`·`SYNK_철학.md`·`세층합류_설계_v1.md` 관련 절, 형제 저장소 L0/C0 계약과 실제 이벤트·진행률·학습자상태·성과회수·배달·회고·교정·큐 트리거 구현.  
안 본 것: 라이브 DB·배포본·실기기 화면·아직 존재하지 않는 일기 API와 UI. 요청에서 제외한 개인정보·비식별·동의·철회·권한 축은 판정하지 않았다.

### 이 문서보다 나은 대안 구조 1개

`diary.opened` 분모를 폐기하고 `diary.written`만 학습 사건으로 남긴다. 원문은 새 표 대신 기존 `submissions`에 저장해 `task_ref=물음 ID`, `task_snapshot=실제 표시 문구·팩 판·몽골 날짜`, `body_original/audio_ref/capture_meta/audio_duration_sec`를 재사용하고, `parent_event_id`와 기존 멱등키·요청 해시·단일 트랜잭션을 그대로 탄다.

처리 트리거는 `learning_events.event_type='submission.created'`인 행만 큐에 넣도록 중앙에서 고쳐 기존 퀴즈 잡 누적까지 함께 제거한다. 날짜 목록과 시즌 종이는 `diary.written→submissions` 조인의 읽기 전용 뷰를 쓰고, AI 맞장구는 `intervention.delivered(parent=diary.written)`로 원문·모델·프롬프트 판을 남긴 뒤 실제 표시는 `content.viewed`로 확인한다.