# SYNK 동기화 구조 — 상담시트 ↔ Google Sheets(앱) ↔ Notion

> 목적: 동기화가 꼬였을 때 **어디를 봐야 하는지 즉시 알기 위한 지도**.
> 기준 버전: v9.22b · 소스: `Code.js` (라인 번호는 해당 시점 기준, 이동 가능).
> 이 문서는 `.md`라서 clasp가 Apps Script로 푸시하지 않음(안전).

---

## 0. 한눈에 보기 — 데이터 흐름

```
[Google Form]  상담 신청
     │  (10분마다 parentSweep → importFormResponses)
     ▼
[상담 스프레드시트]  탭: "상담데이터입력" (62열) + "수강·납입" (11열)   ← 외부 파일, CONSULT_SHEET_ID
     │  (매일 07:00  morningJobs → syncProfiles)   ※ 여기서 끊기면 profiles가 옛날 데이터로 멈춤
     ▼
[앱 스프레드시트]  탭: "profiles" (A~O 기본 + AY/AZ/BA 상담디테일 + 계산열 다수)
     │  syncProfiles 끝에서 calcAll() 호출 → P~BX 계산열(포인트·게이지·급수 등) 채움
     ├──────────────▶  [Glide 앱]  profiles를 직접 읽어 화면 구성
     │  (매주 월 07:00  weeklyJobs → syncToNotion_)   ※ NOTION_TOKEN 없으면 자동 스킵
     ▼
[Notion 크루 DB]  "🔒 크루 DB — 학생 통합 정보"   ← NOTION_DB_ID
     학생별 upsert(있으면 갱신·없으면 생성). 노션 인터뷰(정성) + 앱 데이터(정량) 결합 허브.
```

**두 개의 독립된 동기화**임을 기억할 것:
- **Layer 1** 상담시트 → profiles (`syncProfiles`, 매일)
- **Layer 2** profiles → Notion (`syncToNotion_`, 매주)

Layer 1이 멈추면 profiles가 스테일 → Layer 2도 옛 데이터를 노션에 밀어넣음. **문제 진단은 항상 Layer 1부터.**

---

## 1. 핵심 ID · 시크릿 (Code.js 상단 상수)

| 이름 | 값 / 위치 | 정의 위치 |
|------|-----------|-----------|
| `CONSULT_SHEET_ID` | `1Ze_8IHOzmtAV-PHt12cUfRn5_LwRZwt8pcWsnjQ19FY` (외부 상담 스프레드시트) | `Code.js:459` |
| `NOTION_DB_ID` | `393bd830-9852-80bf-9101-e7c0a62c3d80` (크루 DB) | `Code.js:6252` |
| Notion data source | `collection://bc0bd830-9852-83e8-bd09-8738470622a3` (라이브 확인) | — |
| `NOTION_TOKEN` | **Script Properties**에 저장 (코드·깃 미포함, 없으면 노션 동기화 자동 스킵) | 설정: notion.so/my-integrations |
| `NOTION_VER` | `2022-06-28` | `Code.js:6253` |
| 앱 스프레드시트 | `getActiveSpreadsheet()` (스크립트가 바인딩된 컨테이너) | — |
| `ADMIN_EMAIL` | `unmet23@gmail.com` (실패 알림 수신) | `Code.js:458` |

> ⚠️ `CONSULT_SHEET_ID`는 v9.19에서 교체됨(구 시트 `10Q-Yhqgy2…` 접근 불가). 상담 파이프라인이 통째로 안 되면 이 ID·공유 권한부터 확인.

---

## 2. Layer 1 — 상담시트 → profiles

**함수:** `syncProfiles()` (`Code.js:1673`)
**트리거:** `morningJobs()` 안에서 **매일 07:00** 실행 (`Code.js:6410`). 이후 `calcAll()` 자동 호출.

### 소스 (읽기)
| 탭 | 범위 | 용도 |
|----|------|------|
| `상담데이터입력` | 3행부터, **62열** (`v18.1` 스키마) | 학생 마스터 데이터. 헤더는 2행. |
| `수강·납입` | 5행부터, 11열 | `A`=학생ID, `E(4)`=수강료→`payFee`, `K(10)`=재원상태→`payStatus`. **`퇴소`면 앱에서 제외.** |

### 매핑: 상담데이터입력 열 → profiles 열
`out[]` 배열이 profiles **A~O(1~15열)**에 기록됨. (인덱스는 0-base 소스 기준)

| profiles 열 | profiles 헤더 | ← 상담 소스 | 비고 |
|---|---|---|---|
| A (1) | user_id | `row[59]` = **BH 학생ID** | 없으면 그 행 스킵. 업서트 키 |
| B (2) | 이름 | `row[0]` = A 이름 | 없으면 그 행 스킵 |
| C (3) | 이름_몽골 | `row[1]` = B | |
| D (4) | role | 고정값 `'student'` | 비학생 행은 profiles에 기존 값 보존(아래) |
| E (5) | class_name | `row[3]` = D 반 | |
| F (6) | 생일 | `row[4]` = E | |
| G (7) | email | `row[9]` = **J** | |
| H (8) | 연락처 | `row[7]` = **H** | |
| I (9) | messenger_link(SNS) | `row[8]` = **I** | |
| J (10) | parent_of | profiles 기존값 보존(`keep`) | 상담시트에 없음 |
| K (11) | tuition | `payFee[userId]` (수강·납입) | |
| L (12) | 등록일 | `row[2]` = C | `created_at` 계산에 사용 |
| M (13) | 보호자명 | `row[12]` = M | |
| N (14) | 보호자연락처 | `row[14]` = O | |
| O (15) | created_at | 등록일(파싱) → 없으면 profiles 보존값 → 없으면 now | **v9.22 리텐션 버그 수정 지점** (아래) |
| Z (26) | 보호자이메일 | profiles 기존값 보존(`keep.pEmail`) | |
| AY (51) | 한국어수준 | `row[18]` = **S** | 강사 뷰 '레벨' |
| AZ (52) | ⚠상담위험 | `row[60]` = **BI** | **원장 콕핏 전용 — 학생·학부모 바인딩 금지** |
| BA (53) | 핵심비전 | `row[21]` = **V** | 케어 대화용 한 줄 |

### 가드 (데이터 사고 방지) — 디버깅 시 필독
1. **연결 실패 방어** (`try/catch`, `Code.js:1674`): 상담시트 못 열면 profiles를 **마지막 정상 상태로 유지**하고 원장에게 실패 메일. → profiles가 안 바뀌면 매일 아침 메일함 확인.
2. **퇴소자 제외**: `payStatus === '퇴소'`면 앱에서 빼되 시트 이력은 보존 (`Code.js:1709`).
3. **비학생 행 보존**: teacher/parent/admin 행은 매 동기화마다 지워지지 않고 재기록 (`Code.js:1724`).
4. **학생 급감/0 가드** (`Code.js:1728`): 신규 학생 **0명** 이거나, 기존 5명+ 인데 **30% 넘게 급감**하면 → **profiles 덮어쓰기 보류** + 원장 알림.
   - **v9.22b dedup**: `app_state`의 `동기화보류_상태`(= `신규/기존` 시그니처)가 바뀔 때만 1회 알림. 빈 상담시트가 매일 경보 도배하는 것 방지. 정상 동기화 시 시그니처 초기화(재무장).
5. **created_at 안정화** (v9.22, `Code.js:1710`): 예전엔 매일 `now`로 덮여 "가입 경과일" 기반 리텐션이 고장 → 등록일 우선 → 보존값 → now 순으로 확정.

---

## 3. Layer 2 — profiles → Notion 크루 DB

**함수:** `syncToNotion_()` (`Code.js:6282`) · 수동 실행 `syncNotionNow()` (`Code.js:6330`)
**트리거:** `weeklyJobs()` 안에서 **매주 월 07:00** (`Code.js:6439`).
**전제:** `NOTION_TOKEN` 미설정이면 조용히 스킵. 통합(integration)이 크루 DB에 Connections로 연결돼 있어야 함.

### 업서트 로직
1. `notionExistingMap_()`가 크루 DB를 페이지네이션 쿼리 → `학생ID → pageId` 맵 생성 (`Code.js:6262`).
2. profiles 2행부터 최대 **67열(BO)**까지 읽음 (`Code.js:6289`).
3. 행마다: `id` 없거나 `role !== 'student'`면 스킵.
4. 맵에 있으면 `PATCH /pages/{id}`(갱신), 없으면 `POST /pages`(생성).
5. 요청 사이 `Utilities.sleep(350)` — 노션 rate limit(~3/s) 회피.

### 매핑: profiles 열 → Notion 속성
| profiles (0-base 인덱스 / 열) | → Notion 속성 | 타입 | 비고 |
|---|---|---|---|
| `r[1]` B 이름 (없으면 id) | **이름** | title | |
| `r[0]` A user_id | **학생ID** | rich_text | 업서트 키 |
| `r[4]` E class_name | **반** | rich_text | |
| `r[18]` S 몬스터단계 | **몬스터단계** | rich_text | |
| `r[15]` **P** | **총포인트** | number | ⚠️ 아래 P열 주의 |
| `r[48]` AW MVP누적 **+** `r[49]` AX 시냅스누적 | **왕관수** | number | 두 왕관 합 |
| `r[27]` AB 최고스트릭 | **최장연속출석** | number | |
| `r[24]` Y 이탈위험 (첫 글자) | **이탈위험** | select(상/중/하) | 상/중/하 아니면 '하'로 보정 |
| `r[66]` **BO** 현재급수 | **현재급수** | number | `null` 아니면만 기록 |
| (계산) 요약 문자열 | **나의여정요약** | rich_text | 최대 1900자. `단계·급수·P·왕관·최장연속` |
| 실행일 today | **앱갱신일** | date | |

> ⚠️ **P열 주의 (자주 헷갈림):** profiles P열(16)의 **시트 헤더 글자는 "누적잔액"**으로 표기돼 있지만, **v7.1부터 실제 값은 "획득 누계"**(양수+정정만 · 진화/랭킹/월간 기준)임. 스토어에서 쓰는 **잔액은 AQ열('잔액')로 분리**됨 (`Code.js:1086`, 설계노트 #61). 즉 Notion **총포인트 = 획득 누계**이지 잔액이 아님. 헤더 라벨만 낡은 것.

---

## 4. Notion 크루 DB 실제 스키마 (라이브 확인)

DB: **🔒 크루 DB — 학생 통합 정보 (상담 시트 연동)**
위치: `SYNK LAB HQ ▸ 운영·관리 ▸ 크루 DB`
data source: `collection://bc0bd830-9852-83e8-bd09-8738470622a3`

| 속성 | 타입 | 스크립트가 씀? |
|------|------|:--:|
| 이름 | title | ✅ |
| 학생ID | text | ✅ (키) |
| 반 | text | ✅ |
| 몬스터단계 | text | ✅ |
| 총포인트 | number | ✅ |
| 왕관수 | number | ✅ |
| 최장연속출석 | number | ✅ |
| 현재급수 | number | ✅ |
| 이탈위험 | select (상=red / 중=yellow / 하=green) | ✅ |
| 나의여정요약 | text | ✅ |
| 앱갱신일 | date | ✅ |
| 최종 편집 일시 | last_edited_time | (시스템) |
| 최종 편집자 | last_edited_by | (시스템) |

> 스크립트는 위 11개만 씀. 노션에서 **인터뷰·정성 메모**를 별도 속성/본문으로 추가해도 스크립트가 건드리지 않음(정량+정성 공존 설계).

---

## 5. 트리거 달력 (`resetAllTriggers`, `Code.js:6453`)

| 시각 | 함수 | 동기화 관련 |
|------|------|------|
| 매 10분 | `parentSweep` | 폼 응답 → 상담시트 기입·ID 채번(`importFormResponses`) |
| 매일 03:00 | `dailyBackup` | 앱 스프레드시트 전체 백업(30일 보관, `SYNK_백업` 폴더) |
| **매일 07:00** | `morningJobs` | **`syncProfiles`** (상담→profiles) + 생일·상담지연 체크 |
| 매일 08:00 | `sendMorningDigest` | 원장 아침 브리핑 |
| 매일 14/22시 | `calcAll`/`nightJobs` | 계산열 갱신 |
| **매주 월 07:00** | `weeklyJobs` | **`syncToNotion_`** (profiles→노션) + 미납·재등록·헬스체크 |
| 매월 1일 05~07시 | `monthlyJobs` 외 | 칭호·스냅샷·아카이브 (순서 고정) |

---

## 6. 디버깅 체크리스트

| 증상 | 먼저 볼 곳 |
|------|-----------|
| **앱(profiles)이 옛날 데이터** | Layer 1. 상담시트 공유 권한 / `CONSULT_SHEET_ID` / 탭명 `상담데이터입력`. 원장 메일함에 "상담 동기화 실패" 있는지. |
| **신규 학생이 앱에 안 뜸** | 상담시트 BH(학생ID)·A(이름)가 채워졌는지. 둘 중 하나 비면 그 행 스킵됨. `수강·납입` 상태가 `퇴소`인지. |
| **"동기화 보류" 메일** | 급감/0 가드 발동. 상담시트가 비었거나 부분 손상. 정상이면 다음날 자동 반영. `app_state` `동기화보류_상태` 확인. |
| **노션이 갱신 안 됨** | `NOTION_TOKEN` Script Property 존재? 통합이 크루 DB에 연결됨? `syncNotionNow()` 수동 실행 후 로그 확인. |
| **노션 총포인트가 이상** | P열 = "획득 누계"지 잔액 아님(§3 주의). 잔액은 AQ열. |
| **노션 일부 학생 누락** | `role==='student'` 인지, profiles에 그 학생이 있는지. 페이지네이션 guard 30회(3000명) 한도. |
| **리텐션/가입경과일 오류** | `created_at`(O열) — 등록일 파싱 실패 시 now로 떨어질 수 있음(v9.22 수정). |

---

## 7. 관련 함수 인덱스

| 함수 | 라인 | 역할 |
|------|------|------|
| `syncProfiles` | `Code.js:1673` | 상담시트 → profiles (Layer 1) |
| `importFormResponses` | `Code.js:3890` 근처 | 폼 응답 → 상담시트 62열 정렬·ID 채번 |
| `createConsultForm` | `Code.js:3780` | 상담 폼 생성(문항=시트 헤더 19개 정합) |
| `syncToNotion_` | `Code.js:6282` | profiles → Notion (Layer 2) |
| `notionExistingMap_` | `Code.js:6262` | 노션 기존 페이지 학생ID→pageId 맵 |
| `notionHeaders_` | `Code.js:6255` | 노션 API 헤더(토큰) |
| `syncNotionNow` | `Code.js:6330` | 노션 동기화 수동 실행 |
| `morningJobs` / `weeklyJobs` | `Code.js:6409` / `6432` | 트리거 진입점 |
| `healthCheck` | `Code.js:5150` 근처 | 상담시트 접근·헤더 진단 |

---

*문서 생성: Claude Code · 코드 라인은 파일 변경 시 이동할 수 있으니 함수명으로 검색 권장.*
