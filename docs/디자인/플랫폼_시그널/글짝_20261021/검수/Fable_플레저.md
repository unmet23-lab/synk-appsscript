# Fable 최종 검수 — SYNK 플레저 (2026-10-22)

**판정: 고친 뒤 공개** — P0 0 · P1 3 · P2 6 · P3 6

작업본 `C:\Users\q1212\Documents\SYNK-appsscript\.claude\worktrees\platform-copy-audit-20261021` (HEAD fe3ec852d, 읽기만). 캡처는 `scratchpad\shots\care\final\`(34장)·`after\18-person-tabs-360·390`, 추가 재현은 `scratchpad\fable\care-extra\`(스크립트 `repro.cjs`·`repro2.cjs`·`repro3.cjs`, 결과 `repro*-findings.json`, 캡처 A~R·I). 로컬 서버 `http://127.0.0.1:4396/`(로그인 설정 없는 손님 상태)에서 재현했어요.

P1 셋은 모두 글 한두 줄 고침이에요. 셋 다 고치면 그대로 공개해도 돼요.

---

## P1

[P1] `experiences/relationship-care/app.mjs:1371` 연락처 가져오기 안내 — 저장을 켜지 않은 상태로 파일을 불러오면 「남기려면 **「이 기기에 저장」**을 켜거나 백업을 내보내 주세요」라고 하는데, 화면의 체크 상자 이름은 「이 브라우저에 저장」(웹)·「이 PC 앱에 저장」(PC 앱 창, app.mjs:1456)이라 그 이름의 단추가 없어요. 아르곤 P0 반영으로 라벨만 바뀌고 이 안내는 남았어요. — 근거: `fable\care-extra\B-contact-import-destination-1440.png`, `repro-findings.json` `B_destination_persist_off` = 「고른 사람은 지금 화면에만 더해져요. 남기려면 「이 기기에 저장」을 켜거나 백업을 내보내 주세요.」(CSV 1명 불러온 뒤 `#contact-import-destination`). — 고칠 방향: 라벨과 같은 말로. 웹은 「이 브라우저에 저장」, PC 앱 창이면 「이 PC 앱에 저장」(라벨 글자를 그대로 읽어 넣거나 `window.synkProduct` 갈래로 나눔). 같은 줄의 `persist ? '고른 사람을 이 기기의 수첩에 더해요.'`도 「이 브라우저의 수첩」으로.

[P1] `app.mjs:150` 저장 설명 · `app.mjs:1355` 켜고 끌 때 토스트 — 체크 상자는 「이 브라우저에 저장」인데 켜는 순간 바로 아래 설명이 「사람과 일정, 기록, 저장한 대화 글을 **이 기기에** 저장해요」, 토스트가 「**이 기기에** 저장해요. 녹음 파일은 저장하지 않아요.」/「**이 기기** 저장을 껐어요…」예요. 실제 저장소는 이 브라우저(localStorage)뿐이라 다른 브라우저·시크릿 창에서는 안 보여요 — 아르곤이 라벨에서 P0로 본 것과 같은 설명이 라벨 바로 밑에 남아 같은 화면에서 저장 위치가 두 가지로 적혀요. PC 앱 창에서도 라벨은 「이 PC 앱에 저장」인데 설명·토스트는 「이 기기」예요. — 근거: `A-persist-on-1440.png`, `A-persist-on-390.png`, `H-persist-on-pcapp-1440.png`(synkProduct 흉내), `repro-findings.json` `A_desc_on`·`A_toast_on`·`A_toast_off`·`H_desc_on_pc`. — 고칠 방향: 웹 「…이 브라우저에 저장해요」「이 브라우저에 저장해요」「이 브라우저 저장을 껐어요」, PC 앱 창은 「이 PC 앱에」로 라벨과 같은 갈래로 바꿔 보이기. (`app.mjs:130·654·1397·1417·1428`의 「이 기기에 저장하지 못했어요」류 오류 글은 뜻이 틀리진 않아 그대로 둬도 돼요.)

[P1] `experiences/relationship-care/care-memorial.mjs:65` 기일 안내 — 고인으로 표시하지 않은 사람에게 「기억할 날 → 어떤 날인가요? 기일」을 고르고 일정 이름을 비워 저장하면(기본 이름이 `model.mjs:245`에서 「기일」, 대화에서 찾은 날짜는 `care-features.mjs:173`에서 「지민 기일」) 오늘 카드가 「**오늘은 지민 님의 기일이에요.** 제사는 집안에 따라…」로 살아 있는 사람을 고인처럼 말해요. 보고 ③ 첫 줄(P1)에서 고친 「아버님 기일」 꼴은 맞게 나오지만, 이름을 비운 기본 경로가 그대로예요(보고에 「기일만 적은 제목은 그 사람의 기일로 읽는 기존 동작은 그대로」라고 밝혀 둔 선택이고, `tests/care-memorial.test.mjs:122`가 이 문장을 고정해요). — 근거: `I-living-person-blank-memorial-1440.png`, `repro3-findings.json` `today_cards`(예시 자료의 지민에게 오늘 날짜 기일을 이름 없이 저장 → 「지민 · 기일 / 오늘은 지민 님의 기일이에요.」). — 고칠 방향: 고인 아님 + 제목이 「기일」/「이름 기일」이면 단정하지 않는 말로 — 예: 「오늘은 지민 님 수첩에 적어 둔 기일이에요.」(고인 미표시의 옛 자료에도 틀리지 않음). 함께 `care-memorial.test.mjs:122` 기대 문장 수정. 또는 고인이 아닌 사람의 기일 일정은 이름 칸을 비우지 못하게(「누구의 기일인지 적어 주세요」) 막아도 돼요.

## P2

[P2] `app.mjs:359` 준비 질문 안내 — 「**아래** 질문 하나에 답하면 준비를 골라 드려요.」가 질문(「지금 준비에 몇 분을 쓸 수 있나요?」)과 「이 조건으로 준비」 단추보다 **아래**에 그려져요(`index.html:122`에서 `#prepare-form`이 `#preparation-result`보다 앞). — 근거: `D-preparation-needs-input-1440.png`, `repro-findings.json` `D_positions`(form bottom −130 < result top −120), `final\11-person-message-1440.png`. — 고칠 방향: 「위 질문에 답하고 「이 조건으로 준비」를 누르면 준비를 골라 드려요.」 또는 이 줄을 폼 위로.

[P2] `app.mjs:396` 표현 점검 상태 글 — 사람을 열어 「문구 준비」 탭에 들어가면 초안이 비어 있어도, 「초안 만들기」를 처음 눌러도 「문구가 **바뀌었어요**. 「표현 점검」을 **다시** 눌러 주세요.」가 보여요(resetDraft·generateDraft가 invalidateMessageReview를 불러요). 점검한 적이 없는데 「바뀌었어요·다시」라 상황과 안 맞아요. — 근거: `C-message-review-before-draft-1440.png`(초안 빈 상태), `C-message-review-after-draft-1440.png`, `final\17-person2-message-1440.png`, `repro-findings.json` `C_review_before_draft`·`C_review_after_draft`. — 고칠 방향: 점검 결과가 있었을 때만 「문구가 바뀌었어요. 「표현 점검」을 다시 눌러 주세요.」, 그 전에는 `index.html:126`의 기본 글(「이름과 날짜, 약속하는 말, 피하기로 한 표현을 살펴봐요.」)이나 「보내기 전에 「표현 점검」을 눌러 보세요.」

[P2] `care-signal-view.mjs:38` 오늘 카드의 미루기 단추 — 글자가 「3일 뒤에」뿐이라 동사가 없고, 바로 위 「3일 뒤(10월 25일)예요.」·「D-3」와 겹쳐 보여 미루는 단추인지 날짜 안내인지 알기 어려워요(글원칙 「단추는 동사 하나」). 이번 diff 밖 기존 글이지만 고친 카드 안에서 같이 보여요. — 근거: `E-today-cards-1440.png`, `final\06-home-sample-1440.png`·`-390.png`, `repro-findings.json` `E_today_cards` 끝줄. — 고칠 방향: 「3일 뒤에 다시 보기」 또는 「3일 미루기」(토스트 「3일 뒤에 다시 보여 드릴게요.」와 맞춤).

[P2] `app.mjs:785` 기억할 날 줄 — 제목과 상태 표가 붙어 「지민 생일**3일 뒤**」「기일**오늘**」로 보여요(`h4` 안의 `.event-status`에 왼쪽 여백 0). 바꾸기 전에도 같았어요(`before\10-person-events-1440.png`). — 근거: `F-event-status-gap-1440.png`, `repro-findings.json` `F_gap`(gap 0px), `final\10-person-events-1440.png`·`-390.png`, `repro3-findings.json` `event_list`. — 고칠 방향: `.event-status`에 `margin-left:8px`(style.css) 또는 제목 뒤 공백.

[P2] `index.html:86` 통화 녹음 올리기 칸 — 굵은 「통화 녹음 파일 불러오기」와 「이 기기의 음성 파일 · 최대 20 MB」가 붙어 「불러오기**이** 기기의…」로 읽혀요. 바꾸기 전에도 같았어요(`before\14-person-audio-1440.png`). — 근거: `final\14-person-audio-1440.png`·`-390.png`. — 고칠 방향: `.audio-drop span`을 줄 바꿈(display:block)하거나 사이에 ` · `.

[P2] `index.html:45` 사람 검색 칸 — 1440 폭에서 placeholder 「이름·관계·메모 찾기」가 칸보다 길어(글자 123px > 안쪽 116px) 「이름·관계·메모 ?」처럼 잘려 보여요. 390에서는 다 보여요. 바꾸기 전에도 같았어요. — 근거: `P-people-search-1440.png`, `repro2-findings.json` `P_placeholder_1440`, `final\01-home-empty-1440.png`. — 고칠 방향: placeholder를 「이름·관계 찾기」로 줄이거나 분류 select 폭을 줄이기.

## P3

[P3] `app.mjs:485` 「기록 못 한 지난 일정」 빈 상태 — 지난 1년에 일정이 하나도 없어도 「지난 1년 일정은 **모두 기록했어요**.」라고 해요(예시 자료·새 사용자 모두). — 근거: `final\08-overdue-1440.png`, `repro-findings.json` `G_overdue_empty`. — 고칠 방향: 「지난 1년 일정 가운데 기록이 빠진 날은 없어요.」

[P3] `index.html:178` 알림 창 — 「잠금 화면에는 … 「오늘 챙길 일이 있어요」만 보여요」인데 실제 알림 본문은 「오늘 챙길 일이 있어요. 수첩을 열어 보세요.」(`care-sw.js:10`, `app.mjs:1032`, `desktop/src/care-notifications.cjs:3`). 뜻은 맞고 인용만 짧아요. — 고칠 방향: 「이름이나 내용 없이 오늘 챙길 일이 있다는 말만 보여요.」

[P3] 같은 것을 다른 말로 — `index.html:124` 문구 길이 select의 「기억해 둔 내 문구로」(다른 곳은 모두 「보관함」); `index.html:142` 「예전에 저장한 안부는 「목적 미지정」에 있어요」의 「목적 미지정」(`model.mjs:6` 저장 자료 라벨이라 유지했지만 안쪽 말처럼 읽힘 → 「안부 목적을 정하지 않은 문구」); 「10MB」(`index.html:151`) vs 「10 MB」(`app.mjs:437`, `memory-card.mjs:56`); 「무엇을 했나요?」·「보냈나요, 받았나요?」는 물음표, 「무슨 일이었나요」는 없음(`index.html:151`). — 근거: `final\11-person-message-1440.png`, `final\12-person-history-1440.png`.

[P3] `app.mjs:1352` 복사 토스트 「보낸 뒤 **아래** 완료 단추를 눌러 주세요」 — 완료 단추는 1440에서 「문구 복사」 오른쪽 같은 줄이에요(휴대폰에서만 아래로 꺾임). — 근거: `final\11-person-message-1440.png`. — 고칠 방향: 「옆의 「챙김 완료」」 대신 단추 이름만 — 「보낸 뒤 「챙김 완료」를 눌러 주세요」(복사 시점의 `#complete-event` 글자를 넣으면 「안부 전했어요」「마음을 전했어요」도 맞음).

[P3] `app.mjs:938` 달력 저장 토스트 「달력 앱에서 열면 일정과 **미리 알림이** 들어가요」 — 알림(VALARM)은 `model.mjs:881`이 `reminderDays`마다 넣으므로 「미리 알림」 셋을 모두 끈 일정은 알림 없이 들어가요. 기본값(7·1·0일)에서는 맞아요. — 고칠 방향: `row.event.reminderDays.length`에 따라 「미리 알림」 구절을 빼기.

[P3] `care-memorial.mjs:65` 이름 경계 — 이름이 「지민」이고 제목이 「지민이 아버님 기일」처럼 이름 뒤에 조사가 붙으면 이름을 떼지 않아 「지민 님의 지민이 아버님 기일이에요」가 돼요(`tests/care-memorial.test.mjs:123`이 「지 님의 지민이 할머니 기일」로 이 규칙을 의도적으로 고정). 드문 입력이라 기록만 해요.

---

## 사실 확인(문제 없음)

- PC 앱 설정 경로 「설정 → 플레저 PC 알림 → 이 PC에서 받기」: `desktop/renderer/care-notifications.mjs:4`에 `<h2>플레저 PC 알림</h2>`와 체크 「이 PC에서 받기」가 있고 `benefits.mjs:56`도 「설정의 「플레저 PC 알림」」이라 맞아요. PC 앱 창 안내(`care-push.mjs:15`)의 「아래 「브라우저에서 열기」」 단추도 `synkProduct.openInBrowser`가 있을 때 보여요(`H_open_browser_hidden` false).
- 알림 본문은 `care-sw.js:10`·`app.mjs:1032`·`desktop/src/care-notifications.cjs:3` 세 곳이 「오늘 챙길 일이 있어요. 수첩을 열어 보세요.」로 같아요.
- 안내 속 단추·탭 이름: 「기억할 날」「우리의 기록」「문구 준비」「대화와 말투」, 「초안 만들기」「표현 점검」「상황에 맞게 직접 읽고 고쳤어요」「내가 한 말과 상대가 한 말을 제대로 나눴어요」「나와 상대 말 나누기」「이 설정으로 문구를 만들게요」「검색 지우기」「즐겨찾기만 보기」「안부 전체」「달력에 저장」「백업 내보내기」「카드 미리 보기」「임시 저장본 내려받기」「다시 확인」「켜기 취소」는 실제 요소와 같아요. 「계정 자료 다시 불러오기」는 그 상태에서 `app.mjs:560`이 단추 글자를 그렇게 바꿔요.
- 보낼 문구 틀(`model.mjs:532~546`)에 「오늘·내일」 같은 날짜 말 없음. 조문·기일 합쇼체는 허용 범위. 고인 생신 틀 「고인의 생신을 맞아 함께 기억하고 있습니다.」(아르곤 P1 반영 확인). 기일 안내의 「아버님 기일」「아버님 3주기」 갈래는 캡처·시험대로 맞아요(`final\06`).
- 공개판(PUBLIC_WEB) 녹음 글은 `app.mjs:990~991`에서 「웹에서는 녹음을 글로 바꾸는 기능이 없어요…」「고른 녹음은 이 기기에서 재생만 하고 어디에도 보내지 않아요…」로 바뀌고 동의 칸이 숨겨져요(코드로만 확인).
- 관계를 비운 사람은 분류(「기타」)로 보이고(`PEOPLE_GROUPS` import 있음, `R-person-heading-no-relationship-1440.png`), 이름만 저장한 첫 안부 초안·「안부 전했어요」 단추와 도움말이 맞아요(`repro2-findings.json`).
- 휴대폰 폭 사람 수첩 탭 넷은 360·390에서 한 줄(`after\18-person-tabs-360.png`·`-390.png`). 최종 34장 가로 넘침·페이지 오류·콘솔 오류 0(`final\report.json`), 이번 재현 3회에서도 pageerror 없음.
- 시험 diff 19파일은 새 글의 뜻을 그대로 따르고, 옛 글이 없어야 한다는 단언도 새 글로 바뀌어 있어요. 바꾸기 전 캡처와 견줘 더 나빠진 화면은 없어요.

## 본 범위 / 못 본 범위

- 본 범위: `final\` 34장 전부와 `after\18` 2장, `before\` 01·10·14 비교, 작업본 diff 45파일(원천 24 + 시험 19 + `desktop/src/care-notifications.cjs`·`care-notification-model.cjs` 통계), `index.html`·`app.mjs`·`model.mjs`·`care-*.mjs` 관련 줄 직접 확인, 로컬 서버에서 Playwright 재현 3회(저장 켜고 끄기·연락처 CSV 가져오기·문구 준비 탭·준비 질문 위치·오늘 카드·기억할 날 줄·관계 없는 사람 추가·이름 없는 기일·PC 앱 창 흉내).
- 못 본 범위: 로그인한 SYNK ID 상태의 화면(계정 저장·충돌·임시 저장본 고르기·기기 알림 켜기 흐름 — 로컬에 로그인 설정이 없음), 실제 PC 앱 창(`window.synkProduct` 흉내만), synk.im 공개판 화면(PUBLIC_WEB 갈래는 코드로만), 음력·윤달·49재 계산 결과 화면, `care-notification-model.cjs` 생성물의 글 대조(알림 본문만 확인), 아르곤 묶음 원문.
