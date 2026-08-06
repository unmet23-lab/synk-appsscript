# SYNK 자동 상담 AI — 설치 절차 v1

> **결정 잠금(2026-07-24)**: 연결 = **Meta 메신저 직결**(매니챗 미도입, 구독료 0원) · 운영 = **완전 자동**
> 코드 정본: [상담AI.js](../상담AI.js)(엔진) · [contents_상담AI.js](../contents_상담AI.js)(봇이 아는 것)
>
> **총 소요 40~60분.** 화면이 이 문서와 다르면 **지어내지 말고 그 화면을 캡처해서 알려주세요** — Meta 개발자 화면은 자주 바뀝니다.
> 유호님이 직접 하셔야 하는 이유: Meta 앱은 유호님 페이스북 계정에 묶이고, 액세스 토큰은 금융·인증 정보라 제가 대신 입력하지 않습니다.

---

## 전체 그림 (먼저 읽기)

```
학부모가 페이스북 페이지에 메시지를 보냄
   → Meta가 우리 Apps Script 웹앱 주소로 그 내용을 보냄 (STEP 3에서 연결)
   → 우리 코드가 Claude에게 물어 몽골어 답을 만듦
   → 우리 코드가 Meta로 답장을 쏨 (STEP 2의 페이지 토큰 사용)
   → 이름·연락처가 잡히면 leads 시트에 자동 적재 + 유호님께 메일
   → 봇이 모르는 질문이면 답하지 않고 유호님께 인계 메일
```

**봇이 절대 못 하는 것**: 수강료·주소·정확한 수업 시각·연락처·체험 절차·할인·환불·대상 연령·결석 보강·반 배정을 말하는 것. 이 미확정 주제들은 `contents_상담AI.js`에 `확정: false`로 잠겨 있어 물어보면 무조건 사람에게 넘깁니다. 값이 확정된 뒤 `true`로 바꾸면 그때부터 답합니다. <!-- [v9.152] 지식 정합 — 정원 16명·수업 요일은 확정 승격, 구멍 3건 등재 -->

---

## STEP 0 — 스크립트 속성 4개 넣기 (10분)

1. 스프레드시트 → 상단 메뉴 **확장 프로그램** → **Apps Script**
2. 왼쪽 톱니바퀴 **⚙ 프로젝트 설정** 클릭
3. 맨 아래 **스크립트 속성** → **속성 추가** 를 눌러 아래를 하나씩 넣습니다

| 속성 이름 | 값 | 설명 |
|---|---|---|
| `CLAUDE_API_KEY` | console.anthropic.com 발급 키 | AI 첨삭용으로 이미 넣으셨으면 **건너뜁니다** |
| `상담AI_URL키` | 아무 긴 문자열<br>예: `synk-mn-9f3k2x7q` | 웹훅 주소 뒤에 붙는 비밀번호. **이게 없으면 봇이 모든 요청을 거부합니다** |
| `상담AI_검증토큰` | 아무 문자열<br>예: `synk-verify-2027` | STEP 3에서 Meta 화면에 똑같이 한 번 입력 |
| `상담AI_페이지토큰` | (STEP 2에서 받아옵니다 — 지금은 비워두고 나중에 추가) | 이게 없으면 답장이 안 나갑니다 |
| `상담AI_페이지ID` | (선택·권장) 우리 페이스북 페이지의 숫자 ID | 우리 페이지 웹훅만 받도록 거르는 **잠금**. 이걸 걸었다면 인스타 개통 시 STEP 6의 `상담AI_IG계정ID`도 함께 걸어야 합니다(비대칭이면 인스타 쪽이 `ig-lock-missing`으로 안전 차단됩니다) |

4. **저장** 클릭

> 값은 아무거나 좋지만 **메모장에 적어두세요.** STEP 2·3에서 다시 씁니다.

---

## STEP 1 — 웹앱 주소 만들기 (5분)

1. Apps Script 편집기 오른쪽 위 파란 **배포** → **새 배포**
2. 톱니바퀴 ⚙ → **웹 앱** 선택
3. 아래처럼 맞춥니다
   - 설명: `상담AI v1`
   - 다음 사용자 인증 정보로 실행: **나**
   - 액세스 권한이 있는 사용자: **모든 사용자**  ← ⚠ 반드시 이 값. Meta 서버는 구글 로그인이 없습니다
4. **배포** → 권한 승인 화면이 뜨면 승인
5. 나오는 **웹 앱 URL**을 복사해 메모장에 붙여넣습니다. 이렇게 생겼습니다:
   ```
   https://script.google.com/macros/s/AKfy...../exec
   ```
6. 그 뒤에 **STEP 0의 `상담AI_URL키` 값**을 이렇게 붙여 최종 주소를 만듭니다:
   ```
   https://script.google.com/macros/s/AKfy...../exec?k=synk-mn-9f3k2x7q
   ```
   → 이게 **웹훅 주소**입니다. STEP 3에서 씁니다.

> "모든 사용자"가 불안하실 수 있는데, 주소만 알아서는 아무것도 못 합니다 — `?k=` 비밀키가 틀리면 즉시 거부되고, 하루 호출 상한(300건)도 걸려 있습니다.

---

## STEP 2 — Meta 앱 만들고 페이지 토큰 받기 (20분)

1. 브라우저에서 **developers.facebook.com** 접속 → 유호님 페이스북 계정으로 로그인
2. 우측 상단 **내 앱(My Apps)** → **앱 만들기(Create App)**
3. 사용 사례를 고르라고 하면 **비즈니스(Business)** 또는 **기타(Other)** → **비즈니스**
4. 앱 이름: `SYNK LAB 상담` · 연락 이메일 입력 → **앱 만들기**
5. 앱 대시보드에서 **Messenger** 제품을 찾아 **설정(Set up)** 클릭
6. Messenger 설정 화면 → **액세스 토큰(Access Tokens)** 구역 → **페이지 추가(Add or Remove Pages)**
7. **SYNK LAB 페이지**를 선택하고 권한을 모두 허용
8. 페이지 목록에 SYNK LAB이 뜨면 옆의 **토큰 생성(Generate Token)** 클릭 → 긴 문자열이 나옵니다
9. **그 토큰을 복사** → Apps Script **⚙ 프로젝트 설정 → 스크립트 속성**으로 돌아가
   `상담AI_페이지토큰` 속성을 추가하고 값으로 붙여넣기 → **저장**

> ⚠ 토큰은 비밀번호입니다. 메신저·메일로 남에게 보내지 마세요. 저에게도 보낼 필요 없습니다.
> ⚠ 이 단계에서 만든 토큰은 만료될 수 있습니다. 답장이 갑자기 안 나가면 유호님께 「상담AI 전송 실패」 메일이 가니, 그때 8번을 다시 하면 됩니다.

---

## STEP 3 — 웹훅 연결 (10분)

1. 같은 Messenger 설정 화면 → **웹훅(Webhooks)** 구역 → **웹훅 설정하기(Configure Webhooks)**
2. 두 칸을 채웁니다
   - **콜백 URL**: STEP 1의 6번에서 만든 **`?k=...`까지 포함한 전체 주소**
   - **인증 토큰(Verify Token)**: STEP 0의 **`상담AI_검증토큰`** 값
3. **확인 및 저장(Verify and Save)** 클릭 → 초록 체크가 뜨면 성공
   - ❌ 실패하면: `상담AI_검증토큰` 값이 양쪽에서 정확히 같은지, 주소 끝이 `/exec?k=...` 인지 확인
4. 아래 구독 항목 목록에서 **`messages`** 를 체크하고 **구독(Subscribe)**
5. 페이지 구독 칸에서 **SYNK LAB 페이지**를 선택해 구독

---

## STEP 4 — 실제로 되는지 확인 (5분)

**먼저 코드만 점검** (메신저 없이):
1. Apps Script 편집기 상단 함수 목록에서 **`상담AI_점검`** 선택 → **실행**
2. 실행 로그에 이렇게 나오면 정상입니다
   - `준비 상태: ✅ 정상`
   - 질문 「수업이 언제 시작하나요?」 → 몽골어 답변 + `인계=false`
   - 질문 「한 달에 얼마인가요?」 → **`인계=true`** ← 수강료가 미확정이라 봇이 답을 거부한 것, **이게 정상**

**그다음 진짜 메신저로**:
3. 유호님 개인 페이스북 계정으로 **SYNK LAB 페이지에 메시지**를 보냅니다 (예: `Сайн байна уу`)
4. 몇 초 뒤 답장이 오면 완료입니다. **첫 답장은 「저는 SYNK LAB의 자동 상담 봇입니다」(한·몽 병기)로 시작**하고 그다음에 답변이 옵니다 — [v9.154]에서 넣은 **Meta 정책 필수 고지**라 뺄 수 없습니다(두 번째 턴부터는 안 붙습니다)
5. 스프레드시트에 **`상담로그`** 시트가 새로 생겨 대화가 쌓입니다

---

## 운영 중 알아둘 것

| 상황 | 하실 일 |
|---|---|
| **인계 메일이 왔다** <!-- [v9.185] 인계 회로 --> | 메일에 **학부모 질문의 한국어 번역 + 답변 초안 3개**가 옵니다(각 초안 아래 괄호는 **실제로 나갈 몽골어 문장을 한국어로 되돌린 것**입니다). 맞는 초안의 **「▶ 확인 후 발송」**을 열면 **확인 화면**이 뜨고, 거기서 한 번 더 눌러야 실제로 나갑니다 — 첫 링크는 아무것도 보내지 않으니 안심하고 열어보셔도 됩니다. 🔴 **괄호 안 역번역이 위 한국어와 뜻이 다르면 그 초안은 쓰지 마세요**(학부모 메시지가 봇을 속이려 한 흔적일 수 있습니다 — 저에게 보여주세요). ⚠ 메일의 **24시간 마감**이 지나면 링크가 거부합니다 → 메신저 앱에서 직접 답장. 같은 초안은 두 번 발송되지 않습니다 |
| **봇을 즉시 멈추고 싶다** | 스크립트 속성에 `상담AI_OFF` = `1` 추가 → 저장. 봇은 "곧 연락드리겠습니다"만 답하고 유호님께 인계 메일 |
| **수강료를 답하게 하고 싶다** | `contents_상담AI.js`의 `주제: '수강료'` 줄에서 내용을 채우고 `확정: false` → `true`. 저에게 말씀하시면 제가 합니다 |
| **비용이 궁금하다** | 함수 목록에서 **`상담AI_비용`** 실행 → 이번 달 실제 토큰과 ₮ 환산이 로그에 나옵니다 (추정 아닌 실측) |
| **봇이 이상한 말을 했다** | `상담로그` 시트에서 그 대화를 찾아 저에게 보여주세요. 지식·금칙을 고쳐 재발을 막습니다 |
| **하루 상한을 늘리고 싶다** | 속성 `상담AI_일일상한` 값을 숫자로(기본 300) |

**24시간 규칙**: 봇은 방금 받은 메시지에 답하는 것이라 항상 허용 범위 안입니다. 다만 **우리가 먼저 거는 홍보 발송**은 상대가 마지막으로 보낸 지 24시간이 지나면 막힙니다 — 이 봇의 범위가 아니고, 개원 후 별도 설계가 필요합니다.

---

## 미해결 · 유호님 확인 대기

| # | 항목 | 필요한 것 |
|---|---|---|
| 1 | 수강료 공개 여부·정확한 금액 | 확정되면 지식에 넣고 `확정: true` |
| 2 | 학원 주소·대표 전화 | 개원 장소 확정 후 |
| 3 | 무료 체험·레벨체크 운영 방식 | 절차가 정해지면 |
| 4 | 몽골어 답변 감수 | 실제 대화 20건쯤 쌓인 뒤 에리카쌤(또는 감수자)이 어색한 표현을 잡아주면 지식 문구를 고칩니다 |
| 5 | Meta 앱 검수(App Review) | 지금은 **개발 모드**라 페이지 관리자·테스터에게만 답합니다. 일반 학부모에게 열려면 `pages_messaging` 권한 검수가 필요합니다 — **신청 문구는 아래 STEP 5에 준비돼 있습니다** |

> ⚠ **5번이 가장 중요합니다.** STEP 4까지 마쳐도 처음에는 **유호님 본인 계정과 테스터에게만** 답장이 갑니다. 일반 학부모 응대까지 가려면 Meta 검수를 통과해야 하는데, **선행 요건 2건(개인정보처리방침 URL·비즈니스 인증)이 아직 없고 심사도 약 20일 걸립니다** — 상세는 STEP 5. 광고를 켜실 계획이면 그만큼 앞당겨 준비하세요.

---

## STEP 5 — Meta 앱 검수 신청 <!-- [v9.154] 웹 실측으로 전면 개정 — 초판(v9.152)은 선행 요건 3건이 빠져 있었다 -->

> 🔴 **먼저 읽으세요 — 검수는 「문구를 잘 쓰면 되는 일」이 아닙니다.** 2026-08-04 실측 결과, 신청 **전에** 갖춰야 하는 것이 셋 있고 **그중 둘을 유호님이 아직 안 갖고 계십니다.** 문구는 그다음 문제입니다.
> **STEP 4까지만 해도 봇은 유호님·테스터에게 정상 작동합니다** — 몽골어 검수와 내부 테스트는 검수 없이 지금 할 수 있습니다. 검수는 **일반 학부모에게 열 때** 필요합니다.

### 5-0. 신청 전 필수 3종 (이게 진짜 관문)

| # | 필요한 것 | 지금 상태 | 없으면 |
|---|---|---|---|
| 1 | **개인정보처리방침 URL** (공개·라이브·HTTPS) | ❌ 홈페이지가 없어 URL이 없음 | **신청 자체가 안 됨** — Meta가 링크를 실제로 열어 확인합니다 |
| 2 | **비즈니스 인증(Business Verification)** — 사업자 등록 서류 + 라이브 웹사이트 | ❓ 개원 전(2027-02)이라 서류 상태 확인 필요 | 고급 액세스 승인 불가 |
| 3 | 작동하는 봇 (STEP 0~4 완료) | 코드 준비 완료 | 심사자가 테스트할 대상이 없음 |

**1번이 최소 비용 해법이 있습니다** — 홈페이지 전체가 아니라 **개인정보처리방침 페이지 1장**이면 됩니다(무료 호스팅 가능). 이걸 만들면 검수 신청이 열리고, 나중에 홈페이지를 만들 때 그대로 옮기면 됩니다. **말씀 주시면 제가 초안을 씁니다** — 봇이 무엇을 수집하고(메시지 내용·이름·연락처), 어디에 저장하며(구글 스프레드시트), 누구에게 보내는지(Anthropic Claude API로 답변 생성)를 정직하게 적어야 합니다.

> ⚠ **심사 기간은 「며칠」이 아니라 최근 기준 약 20일**입니다(예전 10일 → 늘어남). 광고를 켜실 계획이면 그만큼 앞당겨 신청하세요.

### 5-1. 신청 절차

1. developers.facebook.com → 내 앱 → `SYNK LAB 상담` → 왼쪽 메뉴 **앱 검수(App Review)** → **권한 및 기능(Permissions and Features)**
2. 목록에서 **`pages_messaging`** 을 찾아 **고급 액세스 요청(Request Advanced Access)** 클릭
3. 신청 양식의 사용 설명에 **아래를 그대로 복사해 붙여넣으세요**(영어가 안전합니다):

   ```
   SYNK LAB is a Korean-language academy in Ulaanbaatar, Mongolia
   (opening February 2027; currently accepting pre-opening enquiries).

   This app powers an automated FAQ assistant on our Facebook Page
   "SYNK LAB". It only reacts to messages that a user sends to our Page,
   and only within the standard 24-hour messaging window. It never sends
   promotional broadcasts and never initiates conversations.

   At the start of every conversation the assistant discloses that it is
   an automated bot, in Mongolian and Korean, before answering anything.

   It answers from a fixed, pre-approved knowledge base about the academy
   (opening date, teaching method, level system, class size, native-speaker
   classes). Anything outside that knowledge base — for example tuition
   fees, which we have not finalized — is NOT answered: the assistant tells
   the user that a teacher will contact them and notifies our staff.
   It never invents prices, dates or guarantees of results.

   Message text is sent to Anthropic's Claude API to generate the reply,
   and conversation logs are stored in our private Google Sheet. This is
   described in our privacy policy.

   If a user appears to be a minor, the assistant does not ask for or store
   contact details; it asks them to have a parent or guardian contact the
   Page instead.
   ```

4. **심사자용 테스트 방법(Test Instructions)** 칸:

   ```
   1) Open our Facebook Page "SYNK LAB" and send any message,
      e.g. "Сайн байна уу" (Mongolian) or "When do classes start?"
   2) The first reply begins with the automated-bot disclosure, then
      answers in Mongolian (or in the language you wrote in).
   3) Ask "Төлбөр хэд вэ?" (How much is tuition?) to see the human-handoff
      behaviour: the bot does not invent a price and tells you a teacher
      will contact you.
   All replies are sent within seconds; there is no human in the loop.
   ```

5. **화면 녹화(Screencast)** 요구 시: 휴대폰 화면 녹화로 위 3단계(공개 문구가 보이는 첫 답장 → 수강료 질문 → 인계 답변)를 30초쯤 찍어 올리면 됩니다. **첫 답장의 봇 공개 문구가 화면에 보이게** 찍는 것이 중요합니다.
6. 제출 → 결과 메일. **반려되면 사유를 캡처해서 보여주세요** — 사유별로 문구·코드를 고쳐 재신청합니다.

### 5-2. 정책상 우리가 이미 지키는 것 (반려 사유 예방)

| 요건 | 우리 상태 |
|---|---|
| 대화 시작 시 자동화 공개 | ✅ [v9.154] 첫 응답 맨 앞에 **코드가 붙입니다**(한·몽 병기) — 모델 판단에 안 맡깁니다 |
| 모든 입력에 30초 내 응답 | ✅ 정지·상한 초과·API 오류 **모든 경로**에서 인계문을 즉시 돌려줍니다(침묵하는 경로 0) |
| 24시간 창 준수·홍보 발송 금지 | ✅ 받은 메시지에만 답합니다. 먼저 거는 경로가 코드에 없습니다 |
| 없는 정보 지어내지 않기 | ✅ 미확정 10주제는 프롬프트에 아예 안 들어가고 자동 인계됩니다 |
| 미성년 연락처 미수집 | ✅ [v9.152] 금칙+프롬프트 양쪽에 규칙 |

> 승인 전까지도 봇은 유호님(관리자)과 테스터에게 정상 작동합니다. 테스터 추가: 앱 대시보드 → **앱 역할(App Roles)** → 테스터.

---

## STEP 6 — 인스타그램 DM 배선 (15분) <!-- [v9.185] 코드는 이미 인스타를 받는다 — 유호님 몫은 Meta 쪽 연결뿐 -->

> 코드 쪽은 끝나 있습니다(인스타 웹훅 `object:"instagram"` 분기 · 계정ID 잠금 · 토큰 분리). 여기서는 **Meta 쪽 연결**만 하시면 됩니다. ⚠ 페북과 마찬가지로, **일반 학생에게 답장이 나가려면 `instagram_manage_messages` 검수 승인**이 필요합니다(개발 모드에선 관리자·테스터만) — STEP 5 신청 때 함께 넣는 것이 두 번 심사를 피하는 길입니다.

1. **전제**: SYNK LAB 인스타 계정이 **프로페셔널(비즈니스) 계정**이고, 페북 페이지와 **연결**돼 있어야 합니다.
   인스타 앱 → 프로필 → 메뉴 → **설정** → **비즈니스 도구** 근처에서 확인(앱 버전에 따라 문구가 다릅니다. 화면이 다르면 캡처해 보여주세요 — 지어내지 않고 그 화면 기준으로 다시 안내합니다).
2. **웹훅 구독 추가**: [developers.facebook.com](https://developers.facebook.com) → 우리 앱 → **Webhooks** → 구독 대상에서 **Instagram** 선택 → **messages** 필드 구독. 콜백 URL·검증 토큰은 **STEP 3에서 쓴 것과 동일**합니다(웹앱 하나가 둘 다 받습니다).
3. **권한 추가**: 앱 대시보드 → 권한 및 기능에서 **`instagram_manage_messages`** 요청(검수는 STEP 5와 같은 절차).
4. **(선택) 스크립트 속성 2개**:
   - `상담AI_IG계정ID` — 우리 인스타 비즈니스 계정 ID(잠금용 · 페이지ID와 **다른 값**입니다)
   - `상담AI_IG토큰` — 인스타 전용 토큰이 따로 있을 때만. **없으면 페이지 토큰을 그대로 씁니다**(연결 계정이면 보통 그걸로 됩니다)
5. **확인**: 유호님 개인 인스타 계정으로 SYNK 계정에 DM → 답장이 오고 `상담로그`에 쌓이면 완료. 인계 메일에는 채널이 **「인스타그램」**으로, 상대가 우리를 팔로우하는지도 함께 표시됩니다.
