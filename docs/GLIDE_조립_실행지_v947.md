# SYNK Glide 조립 실행지 v947 — 앱 생성 직후부터 검증 완료까지, 클릭 순서 그대로

> ⛔ **2026-08-05 유호님 확정: Glide 앱 폐기** — 신규 조립에 이 실행지를 쓰지 않는다(자매 정본과 동일 사유 ·
> `docs/제품방향.md` 개정 참조).

> **용도**: `GLIDE_조립가이드_v947.md`(정본·설명서)의 자매 문서 — **실행 순서서**입니다. 위에서 아래로, 체크박스를 채우며 그대로 따라가면 전 기능이 조립됩니다. 건너뛰기 금지.
> **시작 전제**: 시트 준비 완료(preflight ⚠0) · 데모 크루 8명 시드 완료 · Glide에서 New app → **SYNK_앱데이터** 연결까지 완료된 상태.
> **UI 위치 주의**: Glide 화면의 버튼 위치·이름은 업데이트로 조금씩 바뀝니다. 이 문서와 다르게 보이면 **지어서 누르지 말고 그 화면 스크린샷을 채팅에** — 정확한 다음 클릭을 안내받으세요.
> **용어 3개만**: `Data`(상단 — 시트·계산 컬럼) · `Layout`(상단 — 화면·탭 조립) · 컴포넌트(화면 우측 + 버튼으로 추가하는 조각).
> ⚠ **[v9.147 기능 압축]** 이 실행지의 STEP 중 **카드 4종(기록실 BG·플레이스타일 BH·시냅스케미 BI·매치업프리뷰 BJ)은 조립하지 않고, 리그·월드레이드 탭은 숨기며, 강사 탭에 「골든셋」(teacher_gold)을 추가**합니다 — 상세는 조립가이드 v947 머리말의 v9.147 블록.

**전체 지도** — STEP 0 설정(5분) → 1 공유 데이터(5분·**v9.48로 축소**) → 2 보조 컬럼(5분·**축소**) → 3 학생 5탭(60~90분) → 4 학부모 4탭(15분·**축소**) → 5 강사 4탭(40분) → 6 원장 4탭(30분) → 7 Visibility·최종 감사(15분) → 8 검증 시나리오(30분) → 9 운영 전환.

> **★v9.48 핵심 변경(2026-07-20)**: 손으로 만들던 Glide 계산 컬럼 **약 38개가 사라졌습니다**. app_state 공유값(숙제·퀴즈·팁·배너·보스·여행지도)과 학부모의 자녀 카드를 **Apps Script가 각자의 행(profiles CG85~CW101)에 직접 써 넣기** 때문입니다. 화면은 **자기 행을 그냥 바인딩**하면 끝 — Query·Single Value·If-Then-Else·Split Text·Relation·Lookup을 만들 필요가 없습니다. (조립 UI 조작이 프리즈·실수의 최대 원천이라는 실측 보고에 대한 구조적 대응)

---

## STEP 0 · 설정 3종 + 자동 탭 정리 (5분)

- [ ] 0-1. 좌측 하단(또는 상단) **Settings(⚙) → Users**: User profiles table = **profiles** / Email = `email` / Name = `이름` / Role = `role` (Image는 비워도 됨)
- [ ] 0-2. **Settings → Privacy**: **"Users must sign in" ON** · 로그인 방식은 이메일(Email pin) 기본 · **Row Owner는 어디에도 설정하지 않음**(profiles email 열에 Row Owner 아이콘이 켜져 있으면 해제 — 켜면 랭킹·강사 리스트 전멸)
- [ ] 0-3. **Settings → Appearance**: Accent color = **`#3D5AFE`** · Theme/Background = **Light 고정** · Logo/Icon = SYNK 로고(있으면)
- [ ] 0-4. **Layout** 탭으로 이동 → Glide가 자동 생성한 탭들(profiles, point_logs 등 아무 시트나 잡아 만든 것) **전부 삭제**(탭 우클릭/⋯ → Delete). 우리는 아래에서 전부 새로 만듭니다.
- [ ] 0-5. 상단 **Preview as**(눈/사람 아이콘)를 눌러 **DEMO-01 바야르**가 목록에 나오는지 확인(나오면 Users 매핑 성공)

**✅ STEP 0 완료 판정**: 탭 0개·Preview as에 데모 크루 표시.

---

## STEP 1 · 공유 데이터 준비 — 원장 콕핏용 3세트만 (5분) ★v9.48로 대폭 축소

> **v9.48 변경**: 학생·학부모가 쓰는 공유값(숙제·퀴즈·팁·배너·보스·여행지도·자녀 카드)은 이제 **Apps Script가 각자의 행에 직접 써 넣습니다**(profiles CG85~CW101). 그래서 **구 1-7~1-15와 STEP 2-3~2-6, STEP 4-1~4-2의 계산 컬럼 ~38개가 전부 불필요**해졌습니다. 남은 건 원장 콕핏 3개뿐입니다.

**만드는 법(1개만 상세 — 나머지 동일 패턴)**:
1. Data → 좌측에서 **app_state** 선택 → 우측 끝 **+ (Add column)**
2. 타입 **Query** → 이름 `리텐션_q` → Source: app_state → Filter: **key** is `리텐션레이더HTML` → 저장
3. 다시 **+** → 타입 **Single Value** → 이름 `리텐션_v` → From: **리텐션_q** → Column: **value** → Row: First → 저장

- [ ] 1-1 `리텐션_q`/`리텐션_v` ← key `리텐션레이더HTML`
- [ ] 1-2 `케어사각_q`/`케어사각_v` ← `케어사각HTML`
- [ ] 1-3 `경영월보_q`/`경영월보_v` ← `경영리포트HTML`

> 이미 만들어 둔 `여행지도_v`·`이달의보스_v`·`퀴즈초급_v`가 있다면 **그대로 두세요**(안 써도 무해). 새로 만들 필요는 없습니다.

**✅ 완료 판정**: `리텐션_v`에 카드 HTML 문자열이 보이면 성공.

### 1-B. 서버가 채워 주는 열 확인 (클릭 3번 — 이후 STEP 3·4가 여기에 그대로 붙습니다)
- [ ] Data → **profiles** 테이블 → 오른쪽 끝으로 스크롤 → **CG~CW(85~101열)** 에 아래 17개 헤더가 있는지 눈으로 확인:
  `내숙제유형 · 내숙제 · 내숙제팁 · 오늘의퀴즈문제 · 오늘의퀴즈정답 · 오늘의팁 · 전당배너 · 시즌배너 · 이달의보스HTML · 여행지도HTML · 자녀이름 · 자녀_축하배너 · 자녀_주간리포트 · 자녀_출석달력 · 자녀_대화카드 · 자녀_학업추세 · 자녀_액자`
- [ ] 바야르(DEMO-01) 행의 **내숙제·오늘의퀴즈문제**에 값이 보이면 정상 / 학부모 행의 **자녀_주간리포트**에 값이 보이면 정상
- [ ] 열이 안 보이면: Apps Script에서 **`calcAll`** ▶ 1회 → Glide에서 해당 테이블 **Refresh**(테이블 우클릭 또는 새로고침)

---

## STEP 2 · profiles·contents 보조 컬럼 + 이미지 타입 (10분)

### 2-A. profiles에 만들 컬럼 (Data → profiles → +) — ★v9.48로 2개만 남음
- [ ] 2-1 **Query** `오늘출석_q` — Source: **attendance** / Filter: **student_id** is **This row → user_id** AND **`date`** is within **Today**
  - ⚠ **라이브 헤더 실측(07-20)**: attendance의 헤더는 구명칭 `log_id·student_id·date·type·(gps)·checked_by·created_at` — 엔진은 열 위치로 읽으므로 **3열 `date`=사양의 timestamp, 4열 `type`=method**. `created_at`·`checked_by`는 구버전 잔재라 사용 금지
- [ ] 2-2 **Rollup** `오늘출석수` — From: 오늘출석_q → Count
> 이 2개만 UI에 남는 이유: GPS 출석 버튼은 **누르는 즉시** 상태가 바뀌어야 하는데, 서버 계산은 14/22시라 실시간이 안 됩니다.
> ~~2-3 Single Value 6개~~ · ~~2-4 If-Then-Else 3개~~ · ~~2-5 퀴즈 SV~~ · ~~2-6 Split Text+SV 2개~~ → **전부 삭제**(서버가 profiles CG85~CK89에 이미 채움).

### 2-B. contents에 만들 컬럼
- [ ] 2-7 **Math** `음수가격` — 수식 `T * -1` (T = threshold 지정)
- [ ] 2-8 **Template** `구매사유` — 템플릿 `스토어·{name}` / {name} = value_ko

### 2-C. 이미지 타입 지정 (Data에서 열 머리 클릭 → Edit → 타입 Image)
- [ ] 2-9 contents.**image_url** · report_cards.**image_url** · hall_of_fame.**사진URL** · crew_projects.**사진URL**

**⚠ 금지 재확인(전 단계 공통)**: profiles의 연락처(8)·messenger(9)·tuition(11)·보호자명(13)·보호자연락처(14)·보호자이메일(26)·시냅스게이지(31)·게이지문구(32)·(구)리포트확인월(38)·39·40·⚠상담위험(52)·핵심비전(53)은 **어떤 화면에도 올리지 않음**. 진화진행률(T20)·게이트문구(CD82)도 화면 미배치(액자·여정이 대신 시각화). 리텐션신호(BK63)는 원장 콕핏만. `🔒 Row ID`·처리상태(K·L)열 불가침.

---

## STEP 3 · 학생 앱 (Preview as: DEMO-01 바야르로 확인하며)

### 3-A. 탭 「홈」 — 컴포넌트 13개 (위→아래 순서 그대로)

Layout → **+ New tab** → 이름 `홈` → Source: **profiles** (스타일: Details/상세 화면) → Filter 없음(개인화는 Users 매핑이 자동) → 탭 아이콘: 집 모양.
⚠ 화면 소스가 "로그인한 내 행"인지 확인: 우측 상단 데이터 소스가 profiles → **User's row**(또는 Filter: email is signed-in user)여야 합니다. Preview as 바야르에서 바야르 데이터가 보이면 정상.

| ✔ | # | 컴포넌트 | 소스/값 | 설정 |
|---|---|---|---|---|
| [ ] | ⓪ | **Form 버튼** `🧠 시냅스 ON — 오늘도 왔어!` | 대상 **attendance** (Add row) | 필드(라이브 헤더명 기준): student_id=**User's user_id** · **`date`**=제출 시각 · **`type`**=고정 텍스트 `GPS출석` · **Location**→gps_lat (없으면 위치 없이 진행) · `log_id`는 비움(자동 채번) · `checked_by`·`created_at`은 넣지 않음. **Visibility: 오늘출석수 = 0** |
| [ ] | ⓪b | Text `✅ 오늘 시냅스 연결 완료!` | 고정 문구 | Visibility: 오늘출석수 **≥ 1** (⓪과 같은 자리) |
| [ ] | ① | Collection 1행 | **onboarding** / Filter: role is `student` | 첫 안내 카드 |
| [ ] | ② | Text | **오늘의알림 (BX)** | Visibility: is not empty |
| [ ] | ③ | Text ×2 | **전당배너 (CM91)** · **시즌배너 (CN92)** ← 내 행에 그대로 있음 | 각각 Visibility: is not empty |
| [ ] | ④ | **Rich Text** | **나의여정 (BY)** | ★대표 카드 |
| [ ] | ⑤ | **Rich Text** | **액자HTML (BD)** | 진화 게이지 포함 — Progress 컴포넌트 별도로 두지 않기 |
| [ ] | ⑥ | **Rich Text** | **몬스터한마디 (BF)** | 출석 버튼 바로 아래가 연출상 최적이지만 이 위치도 OK |
| [ ] | ⑦ | **Rich Text** | **학업추세HTML (BW)** | |
| [ ] | ⑧ | Title+Text | 제목 `📚 오늘의 숙제`+**내숙제유형 (CG85)** / 본문 **내숙제 (CH86)** / 작은 글씨 **내숙제팁 (CI87)** | 반유형 분기는 서버가 이미 처리 |
| [ ] | ⑨ | Text+버튼 | **오늘의퀴즈문제 (CJ88)** + 버튼 `🔮 정답 공개!` → Show notification(또는 Show detail)에 **오늘의퀴즈정답 (CK89)** | 🚨 **CK89 정답은 이 리빌 버튼 안에서만 사용 — 다른 어떤 화면·목록·상세에도 절대 배치 금지**(학생 자기 행에 정답이 실려 있으므로 실수로 올리면 즉시 노출). 급수별 난이도는 서버가 자동 선택 |
| [ ] | ⑩ | **Text Entry** | **드림한줄 (CB80)** | 라벨 `🌟 나의 목표` — 학생 유일 입력칸 |
| [ ] | ⑪ | Text ×2 | **오늘의운세 (BE57)** · **오늘의팁 (CL90)** | 최하단 |

- [ ] 3-A-끝. 홈 하단에 작은 버튼 `📜 내 기록 전부 보기` → Action: **Show detail screen → This item** → 열린 화면에 **Rich Text 4장**: 기록실(BG) → 플레이스타일(BH) → 시냅스케미(BI) → 매치업프리뷰(BJ, Visibility: not empty) + (선택) 출석달력(CF)

**✅ 홈 검증(Preview as 바야르)**: 카드 전부 렌더·`<div>` 원문 없음·오늘 MVP 배너 보임·시냅스 ON 누르면 attendance에 행 생기고 버튼이 ✅로 바뀜.

### 3-B. 탭 「도감」
- [ ] 새 탭 `도감`(Source: profiles·User's row) → **Rich Text**: **도감HTML (CE)** (탭 상단)
- [ ] 그 아래 **Collection** — Source: **contents** / Filter: **type** is `monster` **AND threshold ≤ User Profile → 누적잔액(P·16열)** / 이미지=image_url·제목=value_ko
- [ ] Collection 상세 화면: 기본 컴포넌트 지우고 **Rich Text ← contents.상세카드** 하나만 + 버튼 `🐲 내 대표로 임명` → **Set column values → User profile row**: 대표몬스터(BC) = This item → value_ko
- [ ] (재미) 탭 하단 Text Entry: **몬스터이름 (AO)** — "내 몬스터 이름 짓기"
- **✅ 검증**: Preview as **DEMO-06(신입)** — 뉴로만 보이고 나머지 🌫️ ???. 상세에서 몬스터가 숨쉼.

### 3-C. 탭 「스토어」
- [ ] 새 탭 `스토어` → 상단 Title: **잔액 (AQ)** — 라벨 `⚡ 내 포인트`
- [ ] **Collection** — contents / Filter: type is `store` / 이미지+value_ko+threshold(가격)
- [ ] 상세 화면 버튼 1: `🎯 목표로 찜!` → Set column → User profile: 목표아이템(AR)=value_ko
- [ ] 상세 화면 버튼 2: `⚡ 포인트로 데려오기` → **Add row → point_logs**: student_id=User's user_id · points=**음수가격** · reason=**구매사유** · given_by=User's 이름 · created_at=현재 시각
- [ ] ⚠ 버튼 2의 **Visibility: threshold ≤ User Profile → 잔액(AQ)** + 반대 조건으로 Text `포인트가 부족해요 🐣`
- **✅ 검증**: 비싼 상품엔 교환 버튼이 안 보이고, 찜하면 홈 목표진행(BZ) 카드가 "몇 P 남았는지"로 바뀜(다음 계산 때).

### 3-D. 탭 「소식」
- [ ] 새 탭 `소식`(Source: profiles·User's row) → 최상단 **Rich Text**: **이달의보스HTML (CO93)**
- [ ] **Rich Text**: **여행지도HTML (CP94)** (★스토리북 바로 위 — "이번 달 무대" 연결)
- [ ] **Collection**: **notices** — 제목=title_ko·본문=body_ko·날짜=created_at·최신순 (notice_id 바인딩 금지)
- [ ] **Collection**: **raid_story** — Filter: class_name is **User Profile → class_name** OR class_name is `전체` / 제목+스토리·날짜 내림차순
- [ ] **Collection**: **synk_stories** — 월별 그룹·챕터 오름차순·본문은 Rich Text
- [ ] **Collection**: **synk_cards** — Filter: student_id is User's user_id / 카드HTML=Rich Text
- [ ] **Collection** ×2: **hall_of_fame** · **league_history** (읽기 전용)
- **✅ 검증**: 보스가 숨쉬고, 여행지도에 6월 도장 1개(스토리북 제1호 발간분), 전투 리포트에 데모 반 2개.

### 3-E. 탭 「랭킹」
- [ ] 새 탭 `랭킹` → **Collection**(Compact) — profiles / Filter: role is `student` / 정렬: 월간포인트(Q) 내림차순 / 표시: 이름·Q·월간랭킹(R)·출석일당포인트(CA)
- [ ] 아래 섹션: **achievements** Collection(Filter: student_id=User's user_id) — 업적·등급·달성일
- [ ] 내 칭호 카드: 현재칭호(AC)·대표칭호(AH)·칭호등급(AI) Text + **착용칭호(AK)** = **Choice**(Source: contents Filter type=`lore` / display·value=value_ko)
- [ ] 도전·성장 기록 Template: `🔥 ×{AW} · 🌱 ×{AX}`
- **✅ 검증**: 바야르 1위 · 업적 여러 개 · 칭호 배지.

**✅ STEP 3 완료 판정**: 학생 탭 5개·홈 13개 컴포넌트·상세 4장 전부 체크.

---

## STEP 4 · 학부모 앱 (Preview as: 사라 어머니 대신 → profiles의 데모 보호자이메일은 원장 수신이므로, 실계정 P01로 확인하거나 Preview as에서 parent 행 선택)

### 4-0. 데이터 준비 — ★v9.48로 **불필요**(만들지 마세요)
> ~~4-1 Relation `자녀_rel`~~ · ~~4-2 Lookup 7개~~ → 서버가 학부모 행 **CQ95~CW101**에 자녀 카드를 직접 채웁니다. 학부모 화면은 **자기 행만 바인딩**하면 끝입니다.

### 4-A. 탭 「우리 아이」
- [ ] 새 탭 `우리 아이`(Source: profiles·User's row) → 상단 Title: **자녀이름 (CQ95)** + onboarding 1행(Filter role=`parent`)
- [ ] **Rich Text 5장 순서대로**: **자녀_축하배너 (CR96)**(Visibility: not empty) → **자녀_주간리포트 (CS97)** → **자녀_출석달력 (CT98)** → **자녀_대화카드 (CU99)** → **자녀_학업추세 (CV100)** (+선택: **자녀_액자 (CW101)**)

### 4-B. 탭 「성장 리포트」
- [ ] **Collection** — report_cards / Filter: student_id is **User Profile → parent_of** / Image+월+칭호+코멘트

### 4-C. 탭 「신고·문의」 (폼 버튼 2개)
- [ ] Form `🙏 결석 미리 알리기` → **absence_notice** Add row: student_id=**User's parent_of** · 반=비워둠(엔진이 profiles 반을 우선 사용) · 날짜=**Date picker(필수)** · 사유=Text · 등록시각=제출 시각
- [ ] Form `💬 문의하기` → **inquiries** Add row: student_id=User's parent_of · 이름=User's 이름 · 문의내용=Text · 접수시각=제출 시각 (상태 필드는 넣지 않음)

### 4-D. 탭 「소식」
- [ ] **Collection**: notices — 제목=**title_mn**·본문=**body_mn**(몽골어 열!)·최신순

**✅ 검증**: 자녀 카드 5장 렌더(달력에 토요일만 수업일) · 결석 신고 후 그날 미출석 메일 안 옴.

---

## STEP 5 · 강사 앱

### 5-A. 탭 「반」
- [ ] 새 탭 `반` → **Collection** — **class_stats** / 표시: class_name·학생수·반몬스터 (Filter 없음 — 선택형)
- [ ] 반 상세 화면: **Rich Text 5장 순서대로** — 수업전브리핑(9열) → 오늘체크(11열) → 격파찬스(10열·Visibility not empty) → 레이드카드HTML(13열) → 기회밸런스(12열)
- [ ] 상세에 **학생 리스트**(Inline collection) — Source: profiles / Filter: class_name is **This item → class_name** AND role is `student` / 표시: 이름·한국어수준(AY)·몬스터단계(S)·진화진행률(T는 미표시 원칙이므로 단계만 권장)
- [ ] **학생 상세 화면**에 버튼 3종:
  - `🔥 오늘의 도전` → Add row → point_logs: student_id=**This item → user_id** · points=**5**(★v9.83 10→5) · reason=**`오늘의 도전`**(구 `오늘의 MVP` — 겸용 판독) · given_by=User's 이름 · created_at=현재
  - `🌱 오늘의 성장` → 동일하되 reason=**`오늘의 성장`**(구 `오늘의 시냅스`)
  - **`💝 반짝 칭찬`(★v9.51 방식 확정 — 태그별 버튼 4개)**: 라이브 point_logs 8열은 Glide 🔒 Row ID라 태그 열이 없음 → 태그를 **reason 접미로 고정**한 Add row 버튼 4개(Button Block 하나에 묶기): 라벨 `🗣 발음↑` `🔥 열정` `🤝 친구도움` `🎯 집중력` — 각각 student_id=This item→user_id · points=**3** · reason=고정 텍스트 **`칭찬·발음↑`** / **`칭찬·열정`** / **`칭찬·친구도움`** / **`칭찬·집중력`**(가운뎃점 `·` 복사-붙여넣기!) · given_by=User profile→이름 · created_at=현재 시각. 학생당 하루 1회(태그 무관 합산 — 초과분 야간 자동 정정)이며, 태그는 일요일 학부모 다이제스트 '크루의 눈'에 한·몽 병기로 전달
  - (선택) `📚 숙제완료` → Add row: points=10 · reason=`숙제완료`
- [ ] 반 상세에 **폼 버튼 3개**:
  - `🎬 수업 시작 — 출석 1탭` → **attendance_batch**: 날짜=**오늘(제출 시각)** · class_name=This item→class_name · 출석자목록=**Choice 멀티**(Source profiles·Filter 이 반 학생·display 이름·**value user_id**) · 입력자=User's 이름 (처리상태 넣지 않음)
  - `📖 오늘 수업 마감` → **weekly_topics**: class_name(A)=이 반 · 배운내용(B)=Text · **문법태그(F)=Choice 멀티**(Source contents·Filter type=`grammar`·display **value_ko**·**value content_id** ★) · 전체도달도(G)=Choice(Source contents·Filter type=`reach`·value=value_ko) · 예외학생(H)·숙제완료자(I)=Choice 멀티(이 반 학생·value user_id) · 연료미션(J)=Choice(Source contents·Filter type=`fuel`·value value_ko) · created_at(D)=제출 시각 (**E·K·L 절대 넣지 않음**)
  - (선택) `숙제만 체크` → **hw_batch**: date=오늘 · class_name · 완료자목록 멀티 · 입력자

### 5-B. 탭 「보드」 — Collection: **today_board** (읽기: 유형·이름·반·시각·퇴근)
### 5-C. 탭 「출퇴근」 — Form: **teacher_checkins** (이름=User's 이름 · 구분=Choice `출근`/`퇴근` · 시각=제출 시각)
### 5-D. 탭 「수업 준비」(선택) — 숙제 카드(3-A ⑧ 재사용)+퀴즈+onboarding(teacher)+안내 카드 2개(academic_log 월1회 입력법 · student_errors 메모법: "해결"이라 쓰면 브리핑에서 사라짐)

**✅ 검증(Preview as SYNK-T01 → 데모정규반)**: 브리핑에 🎂 사라 생일·⚡ 테무진 진화 임박 / 🔥 오늘의 도전 눌러 +5 행 생성 / 💝 칭찬 폼에서 태그 고르고 제출 → point_logs에 +3·reason=칭찬·태그 저장.

---

## STEP 6 · 원장 앱

### 6-A. 탭 「콕핏」 (Source: profiles·User's row — Rich Text는 STEP 1의 _v 컬럼 사용)
- [ ] Rich Text 3장: **리텐션_v** → **케어사각_v** → **경영월보_v** (+선택: 여행지도_v · Chart: class_stats 이번달출석합)
### 6-B. 탭 「출결」 — today_board (5-B와 동일)
### 6-C. 탭 「운영」
- [ ] **league_pairs** Collection — 편집 허용은 **반A·반B 2열만**(Edit form에서 다른 열 제거)
- [ ] **raid** Collection(읽기) · **world_raid** Collection(읽기·진행중 행 Progress=누적데미지/HP)
- [ ] Form `👑 특별 칭호 수여` → **manual_titles**: student_id(Choice: 학생)·칭호·부여자=User's 이름·날짜
- [ ] Form `📢 공지 쓰기` → **notices**: **title_ko·body_ko만**(몽골어는 10분 내 자동)
- [ ] Form `🏛️ 명예의 전당 등재` → hall_of_fame / Form `🎬 크루 프로젝트` → crew_projects
- [ ] **teacher_stats** Collection(읽기) · **inquiries** Collection(**상태만** 편집 허용) · **exit_log**(읽기)
### 6-D. 탭 「경영」(선택) — 경영계기판·kpi_metrics·system_manifest(읽기) + payments Form + leads Form

**✅ 검증(Preview as SYNK-D01)**: 레이더 🔴 냠카·🟡 졸자야 / 케어사각 오윤아 / 월보 카드에 활성률·💡인사이트 / 공지 폼 제출 → 10분 내 학생 소식탭+몽골어.

---

## STEP 7 · Visibility 일괄 + 최종 감사 (빠뜨림 0 확인)

- [ ] 7-1. **탭별 Visibility**(탭 설정 → Visibility): 홈·도감·스토어·소식·랭킹 = **Role is `student`** / 우리 아이·성장 리포트·신고문의·소식(MN) = **`parent`** / 반·보드·출퇴근·수업 준비 = **`teacher`** / 콕핏·출결·운영·경영 = **`director`**
- [ ] 7-2. 역할 교차 확인: Preview as를 학생↔강사↔원장↔학부모로 바꿔가며 **남의 탭이 안 보이는지**
- [ ] 7-3. **최종 감사표** — 아래 전 항목이 어딘가에 배치돼 있어야 함(§10 매트릭스 압축):
  - 학생: 시냅스ON · 온보딩 · BX76 · 전당CM91/시즌CN92 · BY77 · BD56 · BF58 · BW75 · 숙제CG~CI · 퀴즈CJ/CK · CB80 · BE57/팁CL90 · 내기록4(BG59/BH60/BI61/BJ62) · 도감(CE83+Collection+상세카드+BC55+AO41) · 스토어(AQ43+찜AR44+교환+잔액게이트) · 소식(보스CO93·**여행지도CP94**·공지·전투·스토리북·카드·전당·리그역사) · 랭킹(Q17/R18/CA79·업적·칭호AC/AH/AI·AK37·AW49/AX50)
  - 학부모: 온보딩 · 자녀이름CQ95 · 축하배너CR96 · 주간리포트CS97 · **출석달력CT98** · 대화카드CU99 · 학업추세CV100 · report_cards · 결석폼 · 문의폼 · 공지MN
  - 강사: class_stats 목록 · 5카드(브리핑에 🧩연습 포인트 자동) · 학생 리스트(AY) · 🔥/🌱 도전·성장 · **💝칭찬 4버튼(reason=`칭찬·태그`)** · 출석폼 · 마감폼(F=content_id!) · hw_batch · 보드 · 출퇴근
  - 원장: 리텐션 · 케어사각 · **경영월보** · 보드 · 리그(A/B만) · raid/world · 특별칭호 · 공지폼 · 전당폼 · 크루폼 · teacher_stats · 문의함 · exit_log · (경영 4종)

---

## STEP 8 · 검증 시나리오 (가이드 v947 §11 그대로 — 순서 요약)

1. [ ] 학생(바야르) 홈~랭킹 전 화면 → 2. [ ] 도감 잠금(졸자야) → 3. [ ] 스토어 잔액 게이트 → 4. [ ] 강사 도전·성장 2연타(밤 자동 정정+메일은 22시 후 확인) → 5. [ ] 💝 칭찬 → 일요일 다이제스트 "크루의 눈" → 6. [ ] 출석폼 저장 후 `parentSweep` ▶로 즉시 전개 확인 → 7. [ ] 마감폼 저장 후 `runLessonExpandNow` ▶ → 여정 카드 "문법 n/12" → 8. [ ] **`demoRaidClearNow` ▶** → 학생 홈 레이드카드 "🏆 격파 달성!"+격파 공지 → 9. [ ] `seedConsultDemo` ▶ → 상담→앱 유입 확인 → `clearConsultDemo` → 10. [ ] 학부모 결석 신고→미출석 메일 미발송 → 11. [ ] 원장 공지→10분 몽골어.

## STEP 9 · 운영 전환 (조립·검증 끝난 뒤)

- [ ] `clearDemoData` ▶ 1회(⚠ 월말 전 필수 — 멈추면 자동 이어짐) → preflight ▶ 1회(⚠0 재확인)
- [ ] Settings → **Publish**로 앱 URL 발급 → 실계정 4종(§3-4)으로 최종 로그인 테스트
- [ ] 운영 불변 원칙: 가이드 v947 §12(쿼터·언어정책·불가침 열·reason 문자열 4종).

---
*이 실행지는 GLIDE_조립가이드_v947.md(정본)와 코드 v9.47 기준. 화면이 다르면 스크린샷으로 물어보기 — 지어내지 않기.*
