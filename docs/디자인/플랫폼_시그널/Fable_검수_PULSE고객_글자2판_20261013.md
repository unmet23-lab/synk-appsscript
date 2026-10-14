# Fable 검수 — PULSE 고객 작업 공간 글자 2판·05 영상 확인 (2026-10-13)

> 검수 원본(scratchpad는 7일 뒤 지워져 여기에 옮김). 반영 내용은 [README 글자 2판](README.md#pulse-client-room-type-20261013)·[05 다시 짜기](README.md#pulse-client-room-review-20261013). 그림 경로는 검수 당시 scratchpad 기준이다.

# PULSE 클라이언트 화면 타이포그래피 2판 검수 (Fable)

- 검수 시작: 2026-10-13
- 대상: `.tmp/pulse-app-signal-20261013/mirror/.../pulse-app/app.css` + casting.css·production.css·preview.css, views.mjs 마크업, 캡처 00~70.
- 방식: 캡처를 먼저 보고, 의심 가는 값은 CSS 원문에서 확인. 파일은 고치지 않음.

## 진행 기록 (그때그때 덧붙임)

### 1차 관찰 (00·11·12·17·20·22)
- 00 불만 캡처: 「정하실 것」 = 굵은 제목(약 26px/800) + 17px 회색 두 문단 + 문단 속 굵은 강조 + 왼쪽 분홍 세로 막대 + 둥근 카드. 블로그 콜아웃(Notion 인용 상자) 문법. 대표가 싫어한 요소 넷: 큰 굵기 대비, 긴 회색 문단, 문단 속 굵게, 색 막대.
- 17(2판 05 첫 화면) vs 20(1판): 날짜 「10월 31일 (토)」, 「내 차례 | 05 · 영상 확인」 한 줄 라벨, 본문 폭 제한으로 「수 / 있습니다」 고아 줄 사라짐. 전체 굵기 톤이 내려가 훨씬 차분함. 1판의 노란 알약 칩·「이 단계」 라벨 사라진 것 좋음.
- 12(2판 01 첫 화면): 리드 문단이 「담당자가 메시지·근거 / ·행동을」로 가운뎃점 앞에서 줄이 바뀜 → 둘째 줄이 「·」로 시작. keep-all이 U+00B7(SUIT 글리프)을 안 지켜 줌. 바로 눈에 띄는 결함(P1 후보).
- 12·17·11 공통: 한 문단 안에 「~돼요」(해요체)와 「~됩니다」(합쇼체)가 섞임. 「영상을 멈추고 … 전달돼요. 수정된 버전과 … 비교할 수 있습니다.」 「가입이나 비밀번호 없이 열려요. … 이 화면으로 연결됩니다. … 요청해 주세요.」 말투 섞임이 싸 보이는 데 한몫(P2).
- 헤더: 「앱 설치 · 알림」 「알림 9」 단추가 나란히 → 「알림」 두 번(P3 카피).
- 11 포스터 「펄스」 큰 글자가 포스터 아래 테두리에 닿거나 잘려 보임 — 전체 길이 캡처에서 확인 필요.
- 하단 3열 정보 띠(지금 확인할 것 / 확인 범위 / 다음 확인): 라벨 12~13px 회색 + 값 15px 650. 가운데 열만 긴 문단 + 초록/노랑 상태 한 줄 → 열마다 밀도가 달라 표처럼 보임. 추가 확인.

### 2차 관찰 (13~19·21 + app.css 1~481 + views.mjs 1~95)
- 가운뎃점 줄바꿈: views.mjs STAGE.strategy.text 「메시지·근거·행동」. SYNK Latin unicode-range가 U+00B7을 빼서 SUIT 글리프가 쓰이지만 줄바꿈 판정은 글꼴과 무관. 12·13 두 화면에서 재현. 02~06 리드는 가운뎃점이 없어 안 보임. 하단 계기판 값 「메시지·근거·행동과 납품 규격」은 한 줄이라 괜찮으나 좁은 폭(휴대폰)에서 같은 일이 날 수 있음.
- 「지금 할 일」 설명이 제목과 안 맞는 화면: 14(02)·15(03)·16(04) 모두 설명이 「참고자료와 꼭 담을 내용을 전해 주세요.」(p.nextStep 고정값)인데 제목은 「마음에 가까운 방향을 골라 주세요」「광고의 흐름을 먼저 맞춰요」. nextDecision()이 `p.nextStep||기본문`이라 프로젝트의 nextStep이 단계보다 오래되면 제목·설명이 모순. 시험 고정 문구라 CSS로는 못 고침 → P3(확인 필요).
- 크기 단계 미준수: 선언은 13·14·15.5·17·20·24인데 실제 CSS에 13.5(.small·.form-note·헤더 단추·welcome-steps dd·.changes-check-note), 14.5(.project-sub·.production-scope p·.record-list·.notice·.kickoff-help…), 15(.button·.next-decision p·.journey-label·summary·legend), 16(.project-meta dd·input·.kickoff-dates dd), 18(.entry-title·.strategy-group strong), 21(.next-decision h3), 22(.block-head h3·.strategy-agreement h3·.strategy-promise·알림함 h2)가 섞임. 첫 화면 한 장에 11·11.5·13·13.5·14.5·15·15.5·17·21·28·42 = 11가지 크기. 0.5px 차이 크기들이 「정돈 안 된」 질감을 만든다(P2).
- 말투: STAGE.text 05 「전달돼요 … 있습니다」, 03 「비교해 보세요 … 전달됩니다」, 01 「확인해요 … 선택입니다」; production-context의 확인 범위 문장은 전부 합쇼체(「제출합니다」「구분됩니다」「남습니다」「아닙니다」). 환영 form-note도 섞임. 토스·당근은 한 화면 한 말투(해요체).
- 06 화면(18·19)은 리드가 한 줄이라 왼쪽 열이 짧고, stage-hero가 stretch라 포스터 높이가 다른 단계(약 330px)보다 작음(약 305px) → 단계를 오갈 때 포스터 높이가 들쭉날쭉(P3).
- 19 수령 뒤 영수증 줄(초록 체크 + 「수령 확인 완료 · 10월 13일 오후 1:17」 + 오른쪽 파일 칩)은 1판(21)의 두 번 말하던 카드보다 확실히 좋음. 유지.
- 11 「펄스」는 포스터 안에 들어감(bottom 22px). 잘림 아님. 취소.
- 헤더 단추 셋(「앱 설치 · 알림」「알림 N」「연결 닫기」)이 같은 무게의 윤곽 알약. 「연결 닫기」가 알림과 같은 무게로 늘 보이는 건 고객 화면에서 어색(P3).
- 05 큰 제목 첫 줄 「이제,」는 두 글자+쉼표라 고아 줄처럼 보임. 다른 단계는 첫 줄이 4~7자(P3 카피).

### 3차 관찰 (30·31·32 전체 길이 + app.css 482~773 + preview/production/casting.css + production-context.mjs)
- 30(05 전체): 오른쪽 열에 카드 셋(승인 → 의견 모으기 → 일정·기타 문의)이 세로로 쌓여 약 1,100px. 「의견을 모아 한 번에 전달해요」 카드는 문단·h4·라벨·입력·단추·라벨·textarea·단추·h4·문단·잔글 순으로 11덩이. 「취합 담당자」 같은 내부 용어, 「보입니다/기록합니다/아닙니다」 합쇼체. 계약 잔글은 카드 끝 13.5px로 내려간 것 확인(유호님 요청대로).
- 30: 「제작팀 메모」가 왼쪽 1px 세로선(.video-note border-left) — 대표가 싫어한 「왼쪽 막대」의 옅은 판. 라벨+본문만으로 충분(P3).
- 31(06 전체): 블록 머리 01·02·03(모노 번호 핑크 + 22px h3) 밑에 납품 규격 카드는 번호 없이 붙어 부록처럼 보임. 「…기록입니다 / …별도로 진행합니다 / …검수를 대신하지 않습니다」 면책 문장이 한 페이지에 세 번. 이력 목록은 같은 시각 「10월 13일 오후 1:17」이 네 줄 반복(픽스처라 실제는 다르겠지만 날짜 묶기 고려).
- 32(01 전체): 위 두 카드(확인 요청 / 현재 저장한 기획)가 같은 칩 둘(「고객 확인 대기」「제작 설계 v1」)을 나란히 되풀이. 첫 화면~1.5화면 안에 「네 차례」 신호가 여섯(여정 「지금 할 일」, 포스터 칩, 내 차례 상자, 계기판 노란 줄, 카드 칩, 카드 LED 점). 확인 요청 카드는 단추 아래에 두 문장 면책 문단(「…기록입니다. …승인하지 않습니다.」) — 00 캡처의 「굵은 제목 + 긴 회색 문단」 구조가 색 막대만 빠진 채 남아 있음.
- 32: 아코디언 제목 「소개할 대상과 목적 · 선택」처럼 「· 선택」이 제목 문자열에 붙음(8개 중 6개). 「선택」은 제목이 아니라 상태라 칩/작은 글자로 떼야 함.
- 제목 끝 마침표 혼재: 「저장한 제작 설계를 확인해 주세요.」「시안 승인을 마쳤어요.」「제작한 시안이 여기에 도착합니다.」엔 있고 「수령 확인 완료」「이 시안을 기준으로 만들까요?」「새 시안을 함께 확인해요」엔 없음. 큰 제목(synk.im 문법)만 마침표, 카드 제목은 없애는 게 토스·당근 관행.
- CSS 추가: .app-dialog h2 font-weight 720(단계 밖 굵기), letter-spacing -.04em 26px. .approval-card h3 22px. .review-form h3 18px. .feedback-rounds>h3 18px. 크기 18·21·22·26이 토큰 밖.
- 날짜: stamp()는 올해면 연도 생략 「10월 13일 오후 1:17」, day()는 「10월 31일 (토)」. 좋음. 다만 「2026. 10. 13.」 형식이 아직 남은 곳(21 1판)은 사라짐.

### 4차 관찰 (40~42 휴대폰, 50~51 대화상자·알림함, 60~62 참고, 70 미리보기 머리)
- 휴대폰 헤더: 유리 캡슐 안에 로고 + 초록 점 + 윤곽 알약 셋(「앱 설치 · 알림」「알림 N」「연결 닫기」)이 390px을 꽉 채움. 토스·당근은 휴대폰 헤더에 글자 단추 하나 이하.
- 휴대폰 프로젝트 머리: 제목 밑에 「최신 내용 불러오기」가 화면 폭 전체 윤곽 알약으로 → 첫 화면에서 가장 큰 단추가 「새로고침」. 주 단추(흰 알약)보다 먼저 보여 위계가 뒤집힘.
- 휴대폰 여정 막대: 가로 스크롤에서 이전 단계가 「성 / 보기」처럼 글자 반쪽만 잘려 보임(mask 22px 페이드가 너무 짧음). 40·41 둘 다.
- 휴대폰 계기판(production-scope)이 세로로 풀려 「지금 확인할 것 / 확인 범위(두 줄 문단) / 다음 확인」이 300px 넘게 차지. 본문 콘텐츠가 그만큼 밀림.
- 휴대폰 리드·「내 차례」 설명은 balance로 2~3줄 고르게 나뉨. 01 리드는 「메시지·근거·행동을」이 한 줄에 들어가 우연히 안 깨짐.
- 50 승인 대화상자: 눈썹 라벨 + 26px/720 제목 + 버전 칩 + 15.5px 동의문 + 단추 둘. 비율 좋음. 720은 단계 밖 굵기(680으로). 동의문 합쇼체는 동의 맥락이라 허용.
- 51 알림함: 「서버의 기기 알림 준비가 필요해요. 앱 안 알림은 계속 받을 수 있습니다.」 해요/합니다 섞임 + 「서버의」 내부 용어. 항목은 15px 제목 + 14px 본문 + 13px 시각으로 정돈됨.
- 61 안내 상자 참고: 제품 안내 상자(shadcn·Radix·Primer·Apple)는 아이콘/점 + 짧은 제목 + 1~2줄. 왼쪽 색 막대는 문서(Stripe docs·토스 블로그 인용)에만. 2판의 「LED 점 + 라벨 + 제목 + 본문」은 제품 쪽 문법과 맞음.
- 62 Linear: 굵기 대신 흰/회색 두 톤 한 문장, 변경 기록은 왼쪽 날짜 열 + 제목. 2판 empty-note가 이 문법을 따름.
- 70 미리보기 머리: 두 줄 제목(680) + 첫 문장 흰색·나머지 회색 리드 + 2×2 수치판(취소선 옛값 → 새값, 「지금 상태 ● 운영 반영 전」). 색 막대·상자 없음. 근거표는 6묶음×6열, 2판 행만 베리 워시. 정의 목록(굵기/크기/영문·숫자/안내 상자/문단/덜어 낸 것)은 회색 문단 속 흰 굵은 값 — 숫자에만 쓰면 Linear 두 톤이고, 「노란 점 + 짧은 라벨 + 제목 + 설명」처럼 구절에 쓰면 00 캡처의 「문단 속 굵게」로 돌아감. 「다음 할 일」 구역은 캡처 범위 밖 → pulse-gallery/index.html 원문(252~267줄)으로 확인함(아래 §4).

---

## 최종 검수 (2026-10-13, Fable)

읽은 범위: 캡처 00~70 전부(30·31·32는 띠로 잘라 원본 크기로 확인), app.css 전체, casting.css·production.css·preview.css 전체, views.mjs 전체, production-context.mjs, api.mjs의 날짜 함수, strategy-view.mjs·feedback-rounds-view.mjs·deliverables-view.mjs·push.mjs는 인용한 문장 줄만. 미리보기 페이지는 70 캡처 + pulse-gallery/index.html 원문(「다음 할 일」 구역 252~267줄). 읽지 않은 것: app.mjs 동작, 03·04 전체 길이 화면(첫 화면만 봄).

### 0. 판정

2판은 「밤티」의 원인이던 것들(900 굵기, 노란 알약 칩, ISO 날짜, 왼쪽 색 막대, 같은 말 두 번)을 벗었고, PC 첫 화면은 Linear·토스 수준의 정돈에 거의 닿았다. 아직 남은 건 글자 값이 아니라 **조판 결함 하나(가운뎃점 앞 줄바꿈), 「네 차례」 신호의 중복, 카드마다 붙는 합쇼체 면책 문장, 그리고 PC보다 한 판 뒤처진 휴대폰 첫 화면**이다. 클라이언트는 초대 링크를 대개 휴대폰에서 열므로 휴대폰 첫 화면이 사실상 첫인상이다.

### 1. P1 — 클라이언트가 바로 싸 보인다고 느낄 것

**P1-1 가운뎃점 앞에서 줄이 바뀜 — 01 제작 설계 리드(12·13 캡처)**
- 부품: `.stage-lead`, 문구는 views.mjs:18 `STAGE.strategy.text` 「메시지·근거·행동」. 둘째 줄이 「·행동을」로 시작한다.
- 원인: body의 `word-break:keep-all`은 한글 사이만 지키고 U+00B7 양옆은 줄바꿈 자리로 남는다. 여기에 `.stage-lead{text-wrap:balance}`(app.css:334)가 두 줄 길이를 맞추려 하필 그 자리를 고른다. 1판(22)은 balance가 없어 우연히 안 보였을 뿐이다. 같은 위험: production-context.mjs:7 「메시지·근거·행동과 납품 규격」(휴대폰 폭), 아코디언 제목 「예산·범위·일정 논의」.
- 고침: 데이터에서 「·」 양옆에 U+2060(WORD JOINER)을 넣는다. JS 문자열에서는 유니코드 이스케이프 u2060으로 쓰면 esc()를 그대로 통과한다. CSS만으로는 못 막는다. 보조로 두 문장 이상인 리드는 `.stage-lead{text-wrap:pretty}`로 두고, balance는 한 문장짜리 `.next-decision p`·`.empty-note`에만 남긴다.

**P1-2 한 화면에 「네 차례」 신호가 여섯 — 01 확인 요청(13·32), 05(17), 06 수령 전(18)**
- 여정 막대 「지금 할 일」(노란 점) → 포스터 칩 「지금 할 일」 → 내 차례 상자(노란 LED) → 계기판 노란 줄 「제작 설계는 함께 확인 중」 → 확인 카드 칩 「고객 확인 대기」 + 요약 카드에 같은 칩 둘 → 카드 오른쪽 위 LED 점. 같은 말을 여섯 번 하면 안내가 아니라 재촉이고, 00 캡처에서 대표가 느낀 「상자가 무겁다」의 절반은 이 중복이다. Linear·Stripe는 상태를 한 자리(제목 옆 점 하나)에만 둔다.
- 고침(CSS만으로):
  - `.tab-panel[data-here=true] .production-scope small{display:none}` — 내 차례 상자가 이미 말하는 단계에선 계기판의 노란 상태 줄을 숨긴다(초록 「v1 확인됨」은 그대로 보임).
  - `.strategy-summary-column .strategy-summary .tags{display:none}` — 요약 카드(「현재 저장한 기획」)의 칩 둘은 왼쪽 카드와 같은 말이다.
  - `.strategy-agreement .tags{display:none}` — 확인 카드는 오른쪽 위 LED 점(app.css:124)과 제목이 이미 말한다. 「제작 설계 v1」 버전 표기가 필요하면 h3 뒤 `.small`로.
  - 여정 막대·포스터 칩은 시그널 문법이라 둔다.

**P1-3 휴대폰 첫 화면(40·41·42)**
- 헤더: 390px 캡슐 안에 로고 + 초록 점 + 윤곽 알약 셋. 「연결 닫기」는 고객이 첫 화면에서 누를 일이 없다.
  - `@media (max-width:640px){.header-actions .button[data-action=logout]{display:none}}` 하고 알림함 패널 `.notification-tools`에 같은 단추를 넣는다(views.mjs liveView). 「앱 설치 · 알림」은 `.install-button` 글자를 「앱 설치」로 줄이거나 아이콘만.
- 「최신 내용 불러오기」가 화면 폭 전체 윤곽 알약(app.css:748 `.project-meta .meta-refresh{flex-basis:100%}` + 276줄 `.project-meta>div{display:grid}`가 단추를 stretch). 첫 화면에서 가장 큰 단추가 새로고침이라 흰 알약 주 단추보다 먼저 눈에 든다.
  - `@media (max-width:640px){.project-meta .meta-refresh{display:flex;justify-content:flex-start;padding-top:2px} .refresh-button{min-height:34px;padding:0 10px;font-size:13px;box-shadow:none;color:var(--ink-3)}}` — 글자 단추 수준으로. 더 좋은 건 제목 줄 오른쪽의 작은 아이콘(마크업).
- 여정 막대의 글자 반쪽(「성 / 보기」): app.css:692 mask 페이드가 22px라 이전 단계 글자가 잘린 채 보인다.
  - `.journey[data-left=true]{mask-image:linear-gradient(90deg,transparent 6px,#000 64px)}`(오른쪽·양쪽도 같은 폭), `.journey{scroll-snap-type:x mandatory}`(691줄), 현재 단계로 스크롤할 때 inline을 start로.
- 계기판이 세로로 풀려 300px 넘게 차지(718~720줄): `@media (max-width:860px){.production-scope{grid-template-columns:1fr 1fr} .scope-range{grid-column:1/-1;order:3} .production-scope p{font-size:14px;color:var(--ink-3)}}` — 「지금 확인할 것 | 다음 확인」을 한 줄에, 「확인 범위」는 아래 한 줄.

### 2. P2 — 다듬으면 확실히 좋아질 것

**P2-1 말투를 해요체 하나로**
- 어디: views.mjs:18·20·22(STAGE.text 01·03·05), :41(환영 form-note), production-context.mjs 6문장 전부, strategy-view.mjs:38·41·66, deliverables-view.mjs:23·29, feedback-rounds-view.mjs:12·21, push.mjs:31.
- 왜: 한 문단에 「전달돼요」와 「있습니다」가 섞인다. 국내 8쪽(토스·당근·카카오·원티드·29CM)은 한 화면 한 말투. 합쇼체 문장은 거의 다 면책·규정 문장이라 글이 아니라 약관처럼 읽힌다.
- 계기판 「확인 범위」 6문장 고침 예시:
  - 01 「설계와 납품 규격은 각각 버전으로 남아요.」
  - 02 「색감·편집·자막처럼 마음에 드는 부분만 골라요. 샘플 그대로 만드는 건 아니에요.」
  - 03 「이미지와 이야기의 방향만 정해요. 장면과 움직임은 다음에 봐요.」
  - 04 「임시 음원으로 흐름을 봐요. 실제 장면 확인은 따로 남아요.」
  - 05 「수정 의견은 초안에 모아 한 번에 보내요. 승인과 파일 수령은 따로 해요.」
  - 06 「규격에 연결된 파일을 확인해요. 연결이 검수를 대신하진 않아요.」
- 승인 대화상자(50)의 동의문만 합쇼체 허용.

**P2-2 크기 단계 밖 값 정리**
- app.css:29 선언은 13·14·15.5·17·20·24인데 실제로 13.5/14.5/15/16/18/21/22/26이 섞여 첫 화면 한 장에 11가지 크기. 0.5px 차이는 눈이 「틀린 것」으로 읽는다.
- 바꿀 표:
  - 13.5 → 13: `.small`(79), `.form-note`(146), `.header-actions .button`(171), `.welcome-steps dd`(256), `.changes-check-note`(434), `.notification-help`(184), `.live-pending`(168), `.delivery-receipt.is-confirmed .receipt-list li`(611), `.casting-motion-note`.
  - 14.5 → 14: `.project-sub`(274), `.production-scope p`(342), `.record-list li`(404), `.notice`(201), `.kickoff-help`(449), `.history-item p`(624), `.scene-requests-summary p`(530), `.new-version-note p`(548), `.changes-comparison dd`(431), `.deliverable-table`(production.css), `.preview-choice-row>span`(preview.css), `.install-success`(656), `.casting-undecided`.
  - 15 → 15.5: `.button`(89), `.next-decision p`(330), `.journey-label`(291), details summary 공통(150), `legend`(144), `.strategy-summary-list dd`(367), `.approval-card p`(576), `.comment p`(589), `.delivery p`(617), `.scene-copy dd`(522), `.concept-copy .detail-copy`(495), `.deliverables-panel>p`, `.preview-samples>p`, `.casting-portfolio-head p`.
  - 16 → 17: `.project-meta dd`(278), `.kickoff-dates dd`(439), `.schedule-summary-facts dd`(458), `.selection-note strong`(484), `.new-version-note strong`(547), `.casting-model-text strong`. `.receipt-line`(607)은 15.5. `input,textarea,select`의 16은 iOS 확대 방지라 유지.
  - 18 → 17 또는 20: `.entry-title`(249)은 20, `.strategy-group>summary strong`(381)·`.review-form h3`(567)·`.feedback-rounds>h3`·`.project-tile strong`(632)·`.casting-configurator legend`는 17.
  - 21 → 20: `.next-decision h3`(329).
  - 22 → 20(카드 안) / 24(블록 머리): `.block-head h3`(216) 24; `.strategy-agreement h3`(357)·`.approval-card h3`(575)·`.video-heading h3`(555)·`.delivery-receipt h3`(596)·`.concept-copy h3`(493)·`.strategy-promise`(363)·`.notification-panel h2`(181)·`.preview-samples h3`·`.deliverables-panel h3`는 20.
  - `.app-dialog h2`(647) 26px/720/-.04em → `var(--t-title-l)`·`var(--w-display)`·`var(--track-display)`.

**P2-3 단추 밑 면책 문단 — 00 상자의 「굵은 제목 + 긴 회색 문단」 잔재**
- 어디: 32 strategy-agreement(strategy-view.mjs:38 「설계 확인은 … 기록입니다. 견적·일정·수정 조건을 자동 확정하거나 … 승인하지 않습니다.」), 31 납품 규격(deliverables-view.mjs:23·29), 30 의견 모으기(feedback-rounds-view.mjs:12 「취합 담당자」).
- 고침: 본문급(15.5px·ink-2) 두 문장 → `.small`(13px·ink-3) 한 문장. 동의 조건은 확인 대화상자(dialogContent의 confirm)의 본문으로 옮기면 카드에서는 사라진다. 임시 CSS: `.strategy-agreement>p:last-of-type{margin:12px 0 0;font-size:var(--t-label);line-height:1.55;color:var(--ink-3)}`.

**P2-4 아코디언 제목에 붙은 「· 선택」**
- strategy-view.mjs:38 group 호출 「소개할 대상과 목적 · 선택」 등 6개. 「선택」은 제목이 아니라 상태다. 토스 폼은 「(선택)」을 라벨 옆 작은 회색으로 둔다.
- 고침: 제목 문자열에서 떼어 `<small class="optional">선택</small>`로, `.strategy-group>summary strong .optional{margin-left:8px;font-size:var(--t-label);font-weight:var(--w-label);letter-spacing:0;color:var(--ink-3)}`.

**P2-5 카드 제목 끝 마침표 혼재**
- 있음: 「저장한 제작 설계를 확인해 주세요.」(strategy-view.mjs:38) 「시안 승인을 마쳤어요.」(views.mjs:94) 「제작한 시안이 여기에 도착합니다.」(94) 「파일과 안내를 확인했어요.」(105) 「선택한 방향이 장면으로 이어집니다.」(91) 「첫 프로젝트를 준비해 주세요.」(43). 없음: 「수령 확인 완료」「새 시안을 함께 확인해요」「이 시안을 기준으로 만들까요?」.
- 규칙: 마침표는 두 줄 큰 제목(h1·stage h2, synk.im 문법)에만. 카드 h3/h4는 마침표 없이, 물음표는 유지. empty-note는 h3가 inline이라 마침표가 문장 경계 역할을 하므로 그대로 둔다.

**P2-6 05 오른쪽 열 밀도(30)**
- 승인 카드 + 의견 모으기 카드(11덩이) + 문의 카드 ≈ 1,100px이 `position:sticky;top:88px`(551줄)라 800px 창에서 아래가 잘린다.
- 고침: `.review-actions{position:static}` 또는 승인 카드만 sticky. 의견 모으기 카드의 「15초 세로 광고 · 시안 v1에 남길 초안」 h4는 카드 제목과 겹치므로 `.small`로, 라벨 「영상 시간 · 초, 선택」은 「영상 시간(초)」, 「제출한 의견 / 아직 … 없습니다」는 비어 있을 땐 숨김.

**P2-7 계기판(production-scope) 비율**
- 가운데 열 1.6fr에 두 줄 문단 + 상태 줄, 양옆은 한 줄이라 표처럼 보인다(337~344줄).
- 고침: `grid-template-columns:minmax(0,1fr) minmax(0,1.4fr) minmax(0,1fr)`, `.production-scope p{font-size:14px;color:var(--ink-3);max-width:36em}`, 문장은 P2-1대로 한 줄.

### 3. P3 — 취향·확인 필요

- 05 큰 제목 첫 줄 「이제,」(views.mjs:22)는 두 글자라 고아 줄처럼 보인다. 「이제 영상으로」/「확인해요.」 제안. 시험이 이 문구를 잡는지 확인.
- 06 포스터가 다른 단계보다 낮다(리드 한 줄 → `.stage-hero` stretch, 305 vs 330px). `.stage-poster{height:330px}` 고정 + `.stage-hero{align-items:start}`.
- PC 헤더 「연결 닫기」가 알림과 같은 무게: `.header-actions .button[data-action=logout]{box-shadow:none;color:var(--ink-3)}`.
- `.video-note`(561) 왼쪽 1px 선은 대표가 싫어한 막대의 옅은 판. `border-left:0;padding-left:0`.
- 「지금 할 일」 설명이 제목과 모순(14·15·16: 제목은 콘셉트/장면인데 설명은 「참고자료와 꼭 담을 내용을 전해 주세요.」). nextDecision()의 `p.nextStep||기본문`(views.mjs:44) 탓. 픽스처 값인지 실제 데이터인지 확인하고, 실제라면 단계가 바뀔 때 nextStep을 비우는 쪽이 안전. 시험 고정 문구라 CSS로는 못 고침.
- 알림함 도움말(push.mjs:31) 「서버의 기기 알림 준비가 필요해요. … 받을 수 있습니다.」 → 「기기 알림은 준비 중이에요. 앱 안 알림은 계속 받아요.」
- 이력 목록(31)의 같은 날 항목은 날짜 한 번 + 시각만(Linear 변경 기록 방식).
- 카드 제목 자간 `--track-title:-.03em`(h1~h5 공통, 68줄)은 SUIT 650 20~22px에서 약간 촘촘. `-.02em`로 완화하고 큰 제목 `-.042em`은 유지(해외 중앙값 -.026em, 국내 0).
- 헤더 「앱 설치 · 알림」 옆에 「알림 N」 — 「알림」이 나란히 두 번. 「앱 설치」로 줄이면 해결.
- 미리보기 정의 목록(70)의 굵은 구절(「노란 점 + 짧은 라벨 + 제목 + 설명」)은 00의 「문단 속 굵게」와 같은 모양. 숫자·고유값(680, 10월 13일 오후 1:17)만 흰 굵게.

### 4. 미리보기 페이지(70 + pulse-gallery/index.html)

- 머리: 두 줄 제목(680) + 첫 문장 흰색·나머지 회색 리드(`.statement`, 32~33줄) + 2×2 수치판(취소선 옛값 → 새값, 「지금 상태 ● 운영 반영 전」). 00 상자의 네 요소(굵기 대비·긴 회색 문단·문단 속 굵게·색 막대) 중 색 막대·상자·굵게가 사라졌고, 강조는 색 두 톤(Linear 62)으로 바뀌었다. 해결.
- 근거표: 6묶음×6열 중앙값, 1판 행은 흐리게 + 취소선, 2판 행만 베리 워시 + LED. 「왜 680인가」를 숫자로 보여 주는 구조라 설득력 있음. 굵기 견본 넷도 좋다.
- 「다음 할 일」(index.html:252~267, `.decide`): NEXT 눈썹 + 두 톤 h2(「마음에 드시면 공용 작업본에 합칠게요.」 흰 / 「다음 회사 배포에 함께 실어요.」 회색) + 16px 문단 하나 + LED 점 한 줄 「채팅에 「넣어줘」라고 남겨 주시면 바로 진행해요.」 + 오른쪽 「다음 판 후보」 4줄. 상자·막대·카드 속 카드가 없고 결정은 제목에, 요청은 한 줄에 있다. 대표가 지적한 상자 문제는 해결.
  - 남은 것 하나: 가운데 문단 세 문장(격리 사본인 이유)은 대표가 정할 일이 아니라 사정 설명이다. 「지금은 격리 사본에만 있고, 합칠 때 충돌은 없어요.」 한 문장으로 줄이면 00 상자의 마지막 잔재(설명 문단)까지 사라진다.
  - 확인: `.decide h2 .statement{font-weight:680}` 안의 `<strong>`이 전역 strong(600)을 받으면 흰 부분이 회색 부분보다 가늘어진다. `.statement strong{font-weight:inherit}`로 색만으로 나누는지 확인.

### 5. 잘 된 점(유지)

- 굵기 체계 680/650/600/550/450과 Inter Tight 숫자 — 「15초」「10월 31일 (토)」가 synk.im과 같은 결.
- 「● 내 차례 | 05 · 영상 확인」 한 줄 라벨 + 21px 제목 + 흰 알약. 1판의 노란 알약·「이 단계」보다 제품답다.
- 빈 상태의 두 톤 문장(`.empty-note`), 수령 뒤 체크 + 한 줄 영수증 + 파일 칩, 승인 대화상자 비율, 날짜 표기(stamp·day), 포스터 큰 한글 900 + 펠트 누끼, 여정 막대의 흰 카드 반전.
- 안내 상자: 왼쪽 막대 → 오른쪽 위 LED 점. 참고 10종 중 제품 쪽(shadcn·Radix·Apple HIG) 문법과 일치하고, 막대는 문서(Stripe docs·토스 블로그)에만 있다는 판단이 맞다.
- 「연결하면 이 프로젝트의 자료와 대화만 볼 수 있어요.」 같은 짧은 도움말, DM Mono 라벨 자간 .08em, 한글 라벨은 모노 금지 규칙.

---

## 반영 확인 (2026-10-13 14:20 이후, confirm/01~09 + 고친 CSS·마크업)

읽은 것: confirm 폴더 01~09 전부(04는 여정·새로고침 줄을 원본 크기로 잘라 확인 → crop-04-*.png), app.css 바뀐 규칙 전부, api.mjs keepDots, production-context.mjs, views.mjs 77·123, strategy-view·feedback-rounds·deliverables·push·preview-view·casting-view·kickoff·changes·schedule·scene-requests의 합쇼체 검색, pulse-gallery/index.html 244~267줄과 img 폴더.

### 판정
- P1-1(가운뎃점)·P1-2(신호 중복): 반영 확인.
- P1-3(휴대폰): 헤더 알약 둘·새로고침 글자 단추·계기판 2칸은 반영. 여정 막대의 잘린 글자 「성/기」는 흐려졌을 뿐 그대로 보임 → P2로 내려 남김.
- P2: 크기·마침표·「선택」·면책 한 문장·sticky·계기판 비율 반영 확인. 말투(P2-1)는 01/05/06 주요 면은 끝났고 02 샘플·캐스팅·04 장면 요청·06 빈 상태·01 요약 카드 잔글에 남음.
- 새로 생긴 문제는 P1·P2 없음. P3 넷(아래).

### 번호별 확인
- P1-1: 01 PC·휴대폰 리드와 계기판 값에 `.nw`(nowrap)가 걸려 「메시지·근거·행동을」이 한 덩어리로 묶임(01·02 오른쪽, 04 아래 줄). keepDots는 esc() 뒤 순수 글자에만 걸림(views.mjs:77, production-context.mjs:15) → 속성·태그가 깨질 위험 없음. 정규식 `[^\s<>]+·[^\s<>]+`는 공백 있는 「 · 」(project-sub)은 건드리지 않음 — 아래 P3 참고.
- P1-2: 01·05 계기판의 노란 상태 줄이 `[data-here=true] … .is-pending`으로 숨고 초록 「v1 확인됨」은 남음(03 오른쪽). 확인 카드·요약 카드 칩 제거, LED 점 + 제목만(06). 01에 남은 노란 신호는 여정·포스터 칩·내 차례 상자·납품 규격 카드 「고객 확인 대기」 칩 = 넷(이전 여섯). 충분.
- P1-3: 헤더 「연결 닫기」는 640px 이하 숨김 + 알림함 `.panel-logout`(views.mjs:123) 확인. 새로고침 13px ink-3 글자. 계기판 `.scope-range{grid-column:1/-1;order:3}`. 여정 막대는 crop-04-journey-after.png에서 왼쪽 가장자리에 「성」「기」 반쪽이 여전히 읽힘. 원인: `scroll-padding-inline:36px`(app.css:701)가 이전 단계의 마지막 36px(오른쪽 패딩 14px + 글자 22px)을 남기고, 흐림 4→40px은 글자를 지우지 않고 어둡게만 함.
  - 고침: `.journey{scroll-padding-inline:12px}` + `.journey[data-left=true]{mask-image:linear-gradient(90deg,transparent 2px,#000 22px)}`(702·704줄의 조합 규칙도 같은 값). 이전 단계는 패딩만 남아 글자가 안 보이고, 흐림은 「더 있음」 신호로만 남는다. JS 스크롤은 inline start 그대로.
- P2-1: 01/05/06 주요 면과 계기판 6문장 해요체 확인. 남은 것(전부 고객 화면 문장):
  - strategy-view.mjs:24 「저장한 버전의 요약입니다. 내용을 바꿔 저장하면 … 다시 살펴봐요.」 — 한 줄 안에 두 말투(06 캡처 요약 카드 잔글). :29 「…목표입니다」, :36 「희망 일정입니다」(도움말), :62·72·76.
  - preview-view.mjs:8·12·16·23(02 표현 샘플 패널), casting-view.mjs:35·45·46·48·53·55(캐스팅), scene-requests-view.mjs:20(04), views.mjs:106 06 빈 상태 셋(「전달됩니다」「쌓입니다」「남습니다」)·:123 「반영됩니다」·:118 떠나기 대화상자, kickoff/changes/schedule 빈 상태.
  - feedback-rounds-view.mjs:12 「취합 담당자」 내부 용어 그대로 → 「담당자」.
- P2-2: app.css 크기 분포 13×17 · 14×39 · 15.5×32 · 17×10 · 20×9 · 24×3. 남은 단계 밖 값: `.tagline`(504) 16→17, `.entry-card .button.primary`(252) 16→17, preview.css `.preview-player-scene` 16→17, casting.css `.casting-video h5` 16→17. 입력창 16(131·743)은 iOS 확대 방지라 유지가 맞음. `.dialog-close` 22·`.casting-voices label strong` 22·`.casting-media-pending>span` 22는 기호라 둠.
- P2-3~7: 확인 카드 잔글 한 문장 `.form-note`, 「선택」 `.optional` 13px 회색, 카드 h3 마침표 없음, `.review-actions` sticky 해제(561·699), 의견 패널 h4→small·빈 「제출한 의견」 숨김·라벨 「영상 시간(초) · 선택」, 계기판 1/1.4/1·14px ink-3 — 05·06·07 캡처에서 확인.
- P3: `--track-title:-.02em`, PC 「연결 닫기」 회색 무테, 제작팀 메모 선 삭제, 「이제 영상으로 / 확인해요.」, 대화상자 h2 24/680/−.042em 확인. nextStep 모순·06 포스터 높이·이력 날짜 묶기는 남긴다는 판단에 동의.
- 미리보기(08·09): `.statement strong` 굵기 상속(머리 리드 두 문장 굵기 같음), 정의 목록 굵게는 숫자·날짜만, 「다음 할 일」 문단 한 문장 + LED 한 줄, 「검수 반영」 줄, 견본 600/680/760/900. 해결.

### 새로 생긴 것 (전부 P3)
- 05 PC 리드가 `pretty`로 바뀌며 둘째 줄이 「비교할 수 있어요.」 세 어절만 남음(03 오른쪽, 05 전체). `.nw`가 가운뎃점을 지키므로 balance를 되돌려도 안전: `.stage-lead{text-wrap:balance}`(336줄). 휴대폰은 두 줄이 다 차서 영향 없음.
- 미리보기 09 「대화상자와 알림함」 다섯 칸 중 알림함·앱 설치 두 칸이 빈 상자로 캡처됨. 파일(img/dialog-notifications.jpg·dialog-install.jpg, 1280×800)은 멀쩡하고 `loading="lazy"`(index.html:247·248)라 캡처 때 안 불린 것. 브라우저에서 스크롤하면 뜨지만 대표가 빨리 넘기거나 PDF로 보면 빈 칸이 보일 수 있음 → 다섯 장 `loading="eager"`(합쳐 약 270KB) 또는 캡처 스크립트가 끝까지 스크롤한 뒤 찍기.
- 휴대폰 「최신 내용 불러오기」 글자 단추가 `padding:0 2px`라 본문과 같은 x에 서서 단추로 안 읽힘(crop-04-refresh-after.png). `.refresh-button{padding:0 10px;margin-left:-10px}`로 눌림 영역만 넓히거나 제목 줄 오른쪽 아이콘.
- `.project-sub` 「가상 브랜드 · 모루 커피 · 담당 김하늘」은 공백 있는 가운뎃점이라 keepDots 대상이 아님 → 고객 이름이 길면 휴대폰에서 「·」가 줄 머리에 올 수 있음. views.mjs:86의 「 · 」 앞 공백을 U+00A0으로.

---

## 05 다시 짜기 (2026-10-13 14:43, review05/01~03 + app.css 555~644·739~742·819~824, production.css, views.mjs:95·101, app.mjs:59·61)

### 판정
첫 화면(02)은 최신 리뷰 도구 수준이다. 어두운 무대에 제 화면비로 놓인 영상, 점으로 찍힌 의견 타임라인(시간은 점 아래, 재생 선이 따라감), 제목 옆 버전 알약, 왼쪽 바로가기·오른쪽 파일 받기 도구 줄, 베리 그라데이션 승인 카드 — Frame.io V4·Vimeo 리뷰 문법이 그대로 읽히고, 1판(20)의 「검은 상자 + 양식 세 개」 느낌은 사라졌다. 남은 건 구조 둘(휴대폰에서 승인 카드가 맨 아래, PC 전체 길이에서 왼쪽 열이 반 비는 것)과 세로 영상 대비다.

### P1
- **휴대폰에서 승인 카드가 문의 양식 뒤(03 셋째 토막)**: `.review-actions .approval-card{order:-1}`가 `@media (min-width:1024px)` 안(app.css:563)에만 있어 휴대폰 순서가 무대 → 의견 모으기 → 일정·기타 문의 → 승인 → 의견 목록. 이 화면의 결정 하나가 양식 두 개 밑에 묻힌다. → 미디어 쿼리 밖으로 꺼내 모든 폭에서 `order:-1`(또는 아래 display:contents 안의 휴대폰 영역 순서 "media" "approval" "rounds" "comments" "inquiry").
- **PC 전체 길이(01)에서 왼쪽 열이 반 빈다**: 왼쪽(무대·타임라인·도구·메모·의견 목록) 약 1,150px, 오른쪽(승인 + 의견 모으기 + 문의) 약 1,900px → 「이 영상의 의견」 아래 700px이 빈 바탕. 스크롤하면 바로 보이는 미완성 느낌. CSS만으로 고치는 안: `.review-actions{display:contents}`(현재 `:has(.feedback-rounds)` flex 규칙 둘은 삭제), `.video-layout{grid-template-areas:"media approval" "media rounds" "comments rounds" "inquiry rounds";grid-template-rows:auto auto auto 1fr}`, `.approval-card{grid-area:approval}`, `.feedback-rounds{grid-area:rounds;align-self:start}`, `.review-comments{grid-area:comments}`, `.review-form{grid-area:inquiry}`. 일정·기타 문의가 왼쪽 의견 목록 밑으로 내려가 두 열 길이가 맞고, 승인은 오른쪽 맨 위 그대로. ≤1023px은 "media" "approval" "rounds" "comments" "inquiry". (`aside`에 display:contents를 주면 랜드마크가 빠지니 `div`로 바꾸거나 `role=complementary`를 자식에.)

### P2
- **세로 영상이면 플레이어가 무대 폭 전체**: `.video-frame video{width:100%;height:auto;max-height:min(62vh,620px);object-fit:contain}`(575줄)라 9:16 영상은 900×496 요소 안에 279px 그림만 가운데 뜨고, 기본 컨트롤 막대와 둥근 모서리는 900px 요소를 따라간다. 합성 자료가 16:9라 캡처엔 안 보이지만 실제 프로젝트는 「15초 세로 광고」. → `.video-frame video,.video-frame img{width:auto;height:auto;max-width:100%;max-height:min(62vh,620px)}` — 치환 요소는 두 제약 안에서 제 비율로 잡히므로 컨트롤·모서리가 그림에 맞는다. 메타데이터 전 300×150 기본 크기는 무대 `min-height:320px`이 가려 준다.
- **타임라인 「의견 2」 vs 목록 「아직 남긴 의견이 없어요」**: 점 둘은 보내지 않은 초안인데 라벨은 「의견」. 같은 화면에서 모순으로 읽힌다. views.mjs:95 reviewTimeline에서 초안만 있으면 「초안 2」, 보낸 것이 있으면 「의견 N」(또는 「초안 2 · 의견 0」). CSS로는 못 고침.
- **「1차 의견 2개 제출」 묶음(담당자 이름 입력 + 동의 체크 + 비활성 단추, 약 300px)**이 매번 펼쳐져 있어 고객이 쓰는 작성칸보다 무겁다. feedback-rounds-view.mjs:21을 `<details class="round-send"><summary>모은 의견 2개 보내기</summary>…`로 접고, 초안이 0이면 숨김. 라벨 「의견을 취합한 담당자 이름」 → 「보내는 분 이름」.
- 휴대폰 도구 줄(03 둘째 토막): 바로가기 둘이 전체 폭을 나눠 쓴 뒤 「파일 받기」가 다음 줄 왼쪽에 혼자. `.review-toolbar>.button-row{margin-left:auto}`로 오른쪽 정렬하거나 `.review-quick-actions{flex:1 1 auto}`로 한 줄에.

### P3
- 타임라인 점이 0:00이나 끝에 찍히면 `margin-left:-22px` 44px 라벨이 트랙 밖으로 나가 「의견 N」 라벨과 겹친다(`.timeline-track.is-ready .timeline-mark`, 591줄). `.timeline-track.is-ready{margin-inline:22px}`로 양끝 여유.
- `.approval-card p{font-size:15px}`(622줄) → 15.5(단계 값).
- 의견 쓰기 칸 focusin에 영상이 멈추는 것(app.mjs:61)은 Frame.io와 같아 괜찮음. `mark.style.left`는 CSSOM이라 CSP(style 속성 금지)에 안 걸림 — 캡처에서 0:03·0:12 자리 확인.
- 03 첫 토막 여정 막대의 「성/기」 반쪽 글자는 앞 절 P2 그대로.

### 잘 된 점
무대 패딩·둥근 모서리·위쪽 하이라이트, 점 세 색(초안 노랑·보낸 베리·처리 초록)과 재생 위치 선, 버전 알약, 도구 줄의 말풍선 아이콘, 초안 줄의 「● 0:03」 시간 알약 + 보통 굵기 두 줄 클램프, 문의 카드를 테두리만으로 한 단계 낮춘 것, 「의견 종류」 숨김, 승인 카드 그라데이션.
