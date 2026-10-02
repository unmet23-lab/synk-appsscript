# Core·Trail·Temper 현재 상태 감사 — 2026-09-21

이 문서는 비개발자용 엔진 지도의 재료다. 현재 정본과 실제 코드를 읽어 작성했다. 이번 감사에서는 서버·DB·학생 자료를 조회하거나 시험을 새로 실행하지 않았다. 아래 시험 수는 날짜가 있는 기존 실행 기록이고, 시험 파일 검토는 검증 범위를 확인한 것이다.

## 먼저 구분할 것

**여덟 제품 엔진은 회사가 발전시킬 능력의 담당 구분이다. `atlas/engine.js`는 이 여덟 제품 엔진 전체가 들어 있는 파일이 아니다.** 현재 이 파일은 설정·관측·본인 확인·결과 사건을 받아 경험과 도움 방식을 고르는 공통 판단 시제품이다. 기존 앱의 상태 계산, 과제 생성, 교정, 궤적, 성과 회수 코드는 별도 파일과 서버에 있다.

- 담당 범위 정본: [아틀라스 설계 §9](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_설계.md:417), 콘텐츠 이름·NPC 사연은 콘텐츠에 두고 공통 기능을 담당 원본에서 발전시킨다는 기준은 [§1-1](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_설계.md:33).
- 공통 판단 시제품: [atlas/engine.js:12](C:/Users/q1212/Documents/SYNK-appsscript/atlas/engine.js:12)의 `atlas-2.0.0`, [171](C:/Users/q1212/Documents/SYNK-appsscript/atlas/engine.js:171)의 `decide`, [285](C:/Users/q1212/Documents/SYNK-appsscript/atlas/engine.js:285)의 `createSession`.
- **최신 변경:** 09-21 편지 연습의 도움 방식만 계정 장부에 연결했다. 공통 원본→서버→앱 판단·점검 화면이 연결된 로컬 구현이며 관련 **336개 시험 통과 기록**이 있다. 운영 배포·실기기 2대·두 번째 콘텐츠 연결은 아직 전이다. [첫 지속 기억 기록:3](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_첫지속기억_20260921.md:3), [38](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_첫지속기억_20260921.md:38), [50](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_첫지속기억_20260921.md:50).
- `아틀라스_설계.md` §11 표는 **09-19 당시 상태**다. 거기 적힌 ‘한 장부 미착수’를 09-21 첫 선호 저장에도 그대로 적용하면 틀린다. 반대로 선호 하나의 연결로 한 장부·한 봉투 전체를 완료 처리해도 틀린다.

| 엔진 | 현재 상태를 짧게 말하면 |
|---|---|
| Core | 학습 기록을 요약하고 일부 과제·확인카드에 쓰는 기반이 있다. 공통 Atlas 판단과 편지 도움 선호의 계정 연결은 로컬 구현까지 왔다. |
| Trail | 목표·결과를 잇는 운영 코드, 어제의 나 비교, 시즌 목표·회고가 있다. SYNK 전체의 긴 기억과 게임 NPC 관계 이력으로 통합되지는 않았다. |
| Temper | 어떤 도움을 줬고 이후 관측이 있는지 계산한다. 결과를 근거로 정책을 검증·교체·되돌리는 자동 개선 체계는 아직 완성되지 않았다. |

## 1. SYNK Core — 지금 이 사람에게 필요한 다음 도움

### 역할

사용자가 직접 말한 선호와 실제 학습 기록을 구분해 읽고, 지금 무엇을 얼마나 어떤 도움으로 경험하게 할지 판단한다. ‘내가 어떤 사람인가’를 영구 낙인으로 정하는 것이 아니라 현재의 근거와 본인의 정정을 반영한다.

근거: [아틀라스 설계:422](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_설계.md:422), [Core 설계 §10](C:/Users/q1212/Documents/SYNK-appsscript/docs/코어엔진_설계.md:92), [엔진 상향설계:108](C:/Users/q1212/Documents/SYNK-appsscript/docs/엔진8종_상향설계_v3.md:111).

### 쉬운 예

**현재 로컬에서 연결한 예:** 편지 연습에서 ‘하나씩 살펴보기’를 고르면 다음 실행에도 점검 항목을 한 칸씩 보여 준다. ‘먼저 혼자 해 보기’로 바꾸면 점검을 접어서 시작한다. 이 선호 때문에 한국어 점수나 실력을 높게·낮게 판정하지 않는다.

**앞으로 만들 예:** 한국어 주문은 혼자 읽을 수 있지만 긴 대화에는 설명이 필요한 사람에게 가게 주문은 짧게 안내하고 NPC와의 긴 대화에서는 단계별 도움을 준다. 이처럼 콘텐츠별 실제 수행에 따른 도움 조절은 이번 선호 저장만으로 완성되지 않는다.

### 준비된 설계

- 직접 선언·관측·AI의 짐작·본인 확인을 구분하고, 근거와 시효를 가진 ‘현재 이해’를 만든다.
- 공식 급수와 오늘 과제의 난이도를 구분하고, 학습 결과·목표·복습 필요에 따라 다음 내용을 고른다.
- 사람이 정정하거나 반영에서 제외한 내용은 이후 선택·요약에 다시 쓰지 않는다.
- 다른 엔진이 등록한 조정 항목만 공통 판단으로 바꾸며 평가의 의미·개인정보 경계는 임의로 바꾸지 않는다.

근거: [아틀라스 설계:110](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_설계.md:110), [155](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_설계.md:155), [190](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_설계.md:190), [엔진 상향설계:148](C:/Users/q1212/Documents/SYNK-appsscript/docs/엔진8종_상향설계_v3.md:151).

### 현재 코드로 가능한 것

1. **학습자 상태 계산:** `학습자상태`는 학습 사건을 정해진 시점으로 잘라 제출 리듬·재시도·피드백 수용·작성 과정·직접 선호 등의 축과 근거를 낸다. 뒤늦게 들어온 자료를 가르는 기준도 있다. `estimator_confidence`는 정확도 확률이 아니라 표본 충분도다. [학습자상태.js:220](C:/Users/q1212/Documents/SYNK-talk/lib/학습자상태.js:220), [314](C:/Users/q1212/Documents/SYNK-talk/lib/학습자상태.js:314).
2. **본인 정정 반영:** 확인카드에서 ‘아니다’라고 답한 주장에 해당하는 지표를 생성 요약에서 제외하는 코드가 있다. 같은 축의 다른 관측까지 통째로 지우지 않는다. [성향확인.js:4](C:/Users/q1212/Documents/SYNK-talk/lib/성향확인.js:4), [과제요약.js:89](C:/Users/q1212/Documents/SYNK-talk/lib/과제요약.js:89).
3. **공통 판단 시제품:** 명시한 도움 방식을 우선하고, 관측·확인·회차 반응·수행 결과를 처리하며 판단 근거와 기본 구성 비교 회차를 기록하는 코드가 있다. 모든 기능이 앱의 실제 학습 사건과 원격으로 연결된 것은 아니다. [engine.js:171](C:/Users/q1212/Documents/SYNK-appsscript/atlas/engine.js:171), [278](C:/Users/q1212/Documents/SYNK-appsscript/atlas/engine.js:278), [298](C:/Users/q1212/Documents/SYNK-appsscript/atlas/engine.js:298).
4. **회사 지식 기반 답변의 기존 기반:** Apps Script에는 대상별로 허용된 지식을 읽고 관련 지식을 골라 AI에 제공하며 모르는 경우 인계하는 별도 코드가 있다. 이것을 학생 장기 기억이나 범용 지식 그래프 완성으로 부르지는 않는다. [엔진_두뇌.js:192](C:/Users/q1212/Documents/SYNK-appsscript/엔진_두뇌.js:192), [225](C:/Users/q1212/Documents/SYNK-appsscript/엔진_두뇌.js:225), [286](C:/Users/q1212/Documents/SYNK-appsscript/엔진_두뇌.js:286).
5. **근거 자격·확인 관측·선택적 재판정 시제품:** `tools/patent-studio`에 로컬 실험 코드가 있다. 제품 학생 DB나 운영 경로에 연결·배포한 것으로 취급하지 않는다. [엔진 상향설계:116](C:/Users/q1212/Documents/SYNK-appsscript/docs/엔진8종_상향설계_v3.md:119), [128](C:/Users/q1212/Documents/SYNK-appsscript/docs/엔진8종_상향설계_v3.md:131), [observation-planner.cjs](C:/Users/q1212/Documents/SYNK-appsscript/tools/patent-studio/observation-planner.cjs).

### 실제 앱 연결

- **기존 연결:** `progress` 서버가 상태를 계산해 확인카드를 만들고 앱 말하기 화면이 소비한다. [progress/index.ts:250](C:/Users/q1212/Documents/SYNK-talk/supabase/functions/progress/index.ts:250), [App.js:313](C:/Users/q1212/Documents/SYNK-talk/App.js:313), [말하기화면.js:660](C:/Users/q1212/Documents/SYNK-talk/src/말하기화면.js:660).
- **기존 과제 연결:** `deliver/생성모드`가 학습자 상태·부정 이력·목표·시즌 목표를 과제 요약에 넣는다. 관측을 계산할 뿐 전혀 쓰지 않는 상태는 아니다. 이 경로와 새 Atlas 공통 판단 시제품은 아직 전체적으로 하나의 서버 판단 봉투로 합쳐지지 않았다. [생성모드.ts:122](C:/Users/q1212/Documents/SYNK-talk/supabase/functions/deliver/생성모드.ts:122).
- **09-21 신규 로컬 연결:** 실제 계정 읽기·쓰기를 거쳐 도움 선호를 `plan.support`에 복원하고 편지 점검 UI가 소비한다. [아틀라스게임.js:27](C:/Users/q1212/Documents/SYNK-talk/src/아틀라스게임.js:27), [atlas-session.js:29](C:/Users/q1212/Documents/SYNK-talk/lib/atlas-session.js:29), [교수멘탈화면.js:266](C:/Users/q1212/Documents/SYNK-talk/src/교수멘탈화면.js:266), [344](C:/Users/q1212/Documents/SYNK-talk/src/교수멘탈화면.js:344).

### 검증과 배포의 확인 범위

- 기존 시험은 시점 절단·늦게 적재된 자료·표본 없음·같은 입력의 재현, 학생 부정의 지표별 제외, 생성 요약 연결을 검증하도록 작성돼 있다. 이번 감사에서 다시 실행하지 않았다. [학습자상태 시험:42](C:/Users/q1212/Documents/SYNK-talk/tests/학습자상태.test.js:42), [성향확인 시험:234](C:/Users/q1212/Documents/SYNK-talk/tests/성향확인.test.js:234), [272](C:/Users/q1212/Documents/SYNK-talk/tests/성향확인.test.js:272).
- 배포장부에 **2026-09-10 운영 deliver v42·progress v30·deliver-one v26** 기록이 있다. 이는 해당 날짜·소스의 배포 기록이며 현재 작업본 전체가 현재 서버와 같다는 뜻은 아니다. [배포장부:639](C:/Users/q1212/Documents/SYNK-talk/docs/_ops/배포장부.jsonl:639).
- Atlas 첫 판은 09-18 웹 게시·Android preview 인수 기록이 있다. 2판 시제품 전체·09-21 첫 지속 기억은 그 배포 증거에 포함되지 않는다. [아틀라스 설계:538](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_설계.md:538), [542](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_설계.md:542).
- 09-21 첫 지속 기억은 **로컬 구현·336개 관련 시험·정본 통합**, 운영 미배포다. [첫 기억 기록:40](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_첫지속기억_20260921.md:40), [50](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_첫지속기억_20260921.md:50).

### 미구현·다음 할 일

먼저 첫 도움 선호 저장을 리허설 서버와 실제 두 기기에서 검증하고 배포 묶음을 완성한다. 이후 두 번째 실제 콘텐츠에서 기억한 설정이 도움이 되는지 검증한다. 그 다음 학습 수행 근거를 공통 이해 봉투와 다음 내용 선택에 연결한다. 초급 검증 문장 풀·한글 단계·작업 난이도·장기 수행 요약·전체 SYNK 계정 공유는 별도 작업이다. ‘전체 사용자를 자동으로 깊이 이해하는 엔진 완성’이라고 표시하면 안 된다.

근거: [첫 기억 기록:44](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_첫지속기억_20260921.md:44), [46](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_첫지속기억_20260921.md:46), [아틀라스 설계:506](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_설계.md:506).

## 2. SYNK Trail — 무엇을 바라봤고 어떻게 달라졌는지 잇는 기록

### 역할·쉬운 예

한 사람의 목표, 활동, 결과, 정정이 시간에 따라 어떻게 이어지는지 맡는다. 지금 필요한 한 걸음을 고르는 Core와 달리, 지난 경험과 앞으로 이어갈 기록을 담당한다.

**현재 연결된 작은 예:** 오늘 보낸 문장과 어제 보낸 문장 수를 나란히 보고, 교정을 받은 뒤 다시 말한 사실을 구별한다. 시즌 시작에 말한 목표를 그 시즌의 교정 맥락에 넣는다.

**앞으로 만들 예:** 사용자가 만든 첫 정원과 처음 혼자 주문한 한국어 대화를 자기 기록에 남기고 새 콘텐츠에서도 원할 때 다시 본다. NPC는 자신이 실제로 선물받거나 방문해서 알게 된 부분만 기억한다. 이 회사 공통 기록·NPC 관계 연결은 아직 구현 완료 상태가 아니다.

근거: [아틀라스 설계:423](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_설계.md:423), [엔진 상향설계:261](C:/Users/q1212/Documents/SYNK-appsscript/docs/엔진8종_상향설계_v3.md:264).

### 준비된 설계

졸업·중도 이탈·미상 구분, 시즌마다 바뀌는 목표, 원문과 판본을 가진 결과 해석, 본인 제보와 확인된 결과 구분, 본인 기록과 회사 내부 집계 분리, 졸업 뒤 자기 기록, 정정·철회 전파가 설계돼 있다. 향후 앱의 자기 기록 통로 `trail-sync`·`my_trail`도 설계에 있으나 구현 여부는 별도로 확인해야 한다.

근거: [엔진 상향설계:265](C:/Users/q1212/Documents/SYNK-appsscript/docs/엔진8종_상향설계_v3.md:268), [273](C:/Users/q1212/Documents/SYNK-appsscript/docs/엔진8종_상향설계_v3.md:276), [291](C:/Users/q1212/Documents/SYNK-appsscript/docs/엔진8종_상향설계_v3.md:294).

### 현재 코드로 가능한 것

- Apps Script의 `엔진_궤적.js`는 학생ID가 있는 면접폼 결과를 `outcome_log`에 중복 방지하며 모으고, 목표와 최신 관측을 `trajectory`에 이어 쓴다. 내부 운영 기록이며 학생용 전체 기록 화면이 아니다. 현재 구조는 기존 학원·진로 관리 맥락이 강하다. [엔진_궤적.js:40](C:/Users/q1212/Documents/SYNK-appsscript/엔진_궤적.js:40), [198](C:/Users/q1212/Documents/SYNK-appsscript/엔진_궤적.js:198), [260](C:/Users/q1212/Documents/SYNK-appsscript/엔진_궤적.js:260).
- 운영배치에서 실제로 `궤적갱신_`을 호출한다. 따라서 고립된 함수만 있는 상태는 아니다. 다만 이번 감사는 현재 원격 Apps Script의 배포 원문이나 자연 실행을 대조하지 않았다. [엔진_운영배치.js:598](C:/Users/q1212/Documents/SYNK-appsscript/엔진_운영배치.js:598).
- Talk에는 어제와 오늘을 비교하는 `견줌`, 시즌 나침반·회고와 그 화면/API가 있다. 현재 교정 서버는 제출한 날짜가 속한 시즌의 목표를 조회한다. 이는 모든 인생 기록이나 NPC 관계 기억을 통합한 상태와 다르다. [견줌.js:46](C:/Users/q1212/Documents/SYNK-talk/lib/견줌.js:46), [회고API.js:3](C:/Users/q1212/Documents/SYNK-talk/src/회고API.js:3), [correct/index.ts:582](C:/Users/q1212/Documents/SYNK-talk/supabase/functions/correct/index.ts:582).

### 실제 앱 연결

- `GET progress` → `진행받기` → `App` → ‘어제의 나’ 화면이 연결돼 있다. 비교 대상은 타인이 아니라 자기 기록이다. 기록 수 증가를 한국어 실력 증가나 인과 효과로 바꾸지는 않는다. [progress/index.ts:175](C:/Users/q1212/Documents/SYNK-talk/supabase/functions/progress/index.ts:175), [App.js:185](C:/Users/q1212/Documents/SYNK-talk/App.js:185), [395](C:/Users/q1212/Documents/SYNK-talk/App.js:395), [견줌.js:64](C:/Users/q1212/Documents/SYNK-talk/lib/견줌.js:64).
- 강사 영역에는 `teach/retro/*`를 쓰는 회고 화면이 연결돼 있다. **`functions/review`는 별도의 교정 검수 통로**이므로 시즌 회고 서버로 설명하면 안 된다. [회고API.js:3](C:/Users/q1212/Documents/SYNK-talk/src/회고API.js:3), [teach/index.ts:352](C:/Users/q1212/Documents/SYNK-talk/supabase/functions/teach/index.ts:352), [App.js:377](C:/Users/q1212/Documents/SYNK-talk/App.js:377).
- 09-21 계정 도움 선호 복원은 시간을 건넌 연결의 작은 첫 사례지만 **Trail 전체 장기 기억 구현 완료가 아니다**. [첫 기억 기록:17](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_첫지속기억_20260921.md:17).

### 검증과 배포의 확인 범위

- `학생ID종단` 시험에는 번호 재사용·재입학 뒤 퇴소 이력 등 원천 연결의 회귀가 있다. `견줌` 시험에는 첫날/어제 0 구분과 감소를 비난하지 않는 조건, `회고통로` 시험에는 근거 고정과 학생·강사 판단 순서가 있다. 이번에 재실행하지 않았다. [학생ID종단 시험:173](C:/Users/q1212/Documents/SYNK-appsscript/tests/학생ID종단.test.js:173), [287](C:/Users/q1212/Documents/SYNK-appsscript/tests/학생ID종단.test.js:287), [견줌 시험:25](C:/Users/q1212/Documents/SYNK-talk/tests/견줌.test.js:25), [회고통로 시험:53](C:/Users/q1212/Documents/SYNK-talk/tests/회고통로.test.js:53).
- Talk 배포장부에 운영 progress(09-10), teach(09-11) 기록이 있다. 현재 원격 함수의 전체 일치·사용자 실제 수신은 이번 감사에서 확인하지 않았다. [배포장부:640](C:/Users/q1212/Documents/SYNK-talk/docs/_ops/배포장부.jsonl:640), [650](C:/Users/q1212/Documents/SYNK-talk/docs/_ops/배포장부.jsonl:650).
- 교정 서버의 09-11 배포·합성 API·빈 대기 예약 실행 증거는 있다. 그것으로 실제 학습자의 시즌 목표 반영 효과까지 확인했다고 말할 수 없다. [자동교정 운영 기록:12](C:/Users/q1212/Documents/SYNK-talk/docs/_ops/Talk_자동교정_배포준비_20260911.md:12), [21](C:/Users/q1212/Documents/SYNK-talk/docs/_ops/Talk_자동교정_배포준비_20260911.md:21), [24](C:/Users/q1212/Documents/SYNK-talk/docs/_ops/Talk_자동교정_배포준비_20260911.md:24).

### 미구현·다음 할 일

현재 Talk의 `lib`, `src`, `supabase/functions`, `supabase/migrations`에서 `trail-sync`, `my_trail`, `senior_paths`, `outcome_verdict`, `trail_ref` 구현을 찾지 못했다. Apps Script의 현행 `trajectory`는 최신 결과 한 줄을 만드는 구조이며 미래 설계의 모든 정정·관계·시간 이력을 다 담는 구조가 아니다. [학생ID 종단 설계:26](C:/Users/q1212/Documents/SYNK-appsscript/docs/학생ID_종단_설계.md:26), [엔진_궤적.js:306](C:/Users/q1212/Documents/SYNK-appsscript/엔진_궤적.js:306).

다음에는 기존 SYNK 계정에 속한 ‘내 기록’에서 본인이 남긴 성취 하나를 다음 실행에 다시 보여 주는 좁은 경로부터 만든다. 실제 관측·내가 한 말·해석을 분리하고 정정·공유 허용·삭제 범위를 함께 정한다. 그 다음 두 번째 콘텐츠에서 허용한 정보만 재사용한다. NPC가 아는 사실은 별도 관계 범위로 전달하고, 사용자 전체 기록을 모든 NPC에 넘기지 않는다. 전용 런처나 회사 전체 기억 창고를 먼저 만드는 순서는 아니다.

## 3. SYNK Temper — 준 도움이 실제로 통했는지 확인

### 역할·쉬운 예

어떤 도움을 언제 왜 제공했는지와 그 뒤에 생긴 관측을 잇고, 지금 무엇을 측정할 수 있는지 판단한다. Core가 다음 도움을 제안한다면 Temper는 그 제안이 도움이 되었는지 확인하는 쪽이다.

예를 들어 존댓말 힌트를 준 다음 같은 표현을 혼자 사용했는지를 보려면, 힌트를 실제로 봤는지와 다시 말할 기회가 있었는지부터 구별해야 한다. 다시 말할 기회가 없었다고 ‘효과 없음’으로 처리하면 안 된다. **현재 구현은 노출·후속 관측과 기간별 상태를 계산하는 수준이며, 이 예의 독립 수행 향상·인과 효과를 자동 확정하는 수준은 아니다.**

근거: [아틀라스 설계:424](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_설계.md:424), [Temper 개입 규격:7](C:/Users/q1212/Documents/SYNK-appsscript/docs/Temper_개입로그_규격_v1.md:7), [엔진 상향설계:359](C:/Users/q1212/Documents/SYNK-appsscript/docs/엔진8종_상향설계_v3.md:362).

### 준비된 설계

- 도움을 제공한 당시의 상태·규칙·근거·개입 ID를 남긴다.
- 1·7·30일 등의 후행 관측에서 기간 미도래·기회 없음·자료 누락을 구분한다.
- 기존 정책과 후보 정책을 비교하고 독립 표본·측정 타당성·성공 기준을 확인한다.
- 가상 학생 시험장, 성능·비용·품질 지킴이, 조건을 충족한 정책의 점진적 확대와 자동 되돌림을 만든다.

근거: [Temper 개입 규격:11](C:/Users/q1212/Documents/SYNK-appsscript/docs/Temper_개입로그_규격_v1.md:11), [엔진 상향설계:359](C:/Users/q1212/Documents/SYNK-appsscript/docs/엔진8종_상향설계_v3.md:362), [아틀라스 설계:278](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_설계.md:278).

### 현재 코드로 가능한 것

- Talk `성과회수`는 실제 개입 사건과 `content.viewed.parent_event_id`를 연결하고, 그 뒤의 교정 관측을 개입 ID로 잇는다. 관측 없음의 이유를 남긴다. [성과회수.js:73](C:/Users/q1212/Documents/SYNK-talk/lib/성과회수.js:73), [119](C:/Users/q1212/Documents/SYNK-talk/lib/성과회수.js:119), [163](C:/Users/q1212/Documents/SYNK-talk/lib/성과회수.js:163).
- 개입 전 기준선과 1·7·30일 뒤 상태를 계산하며 `미도래`·`표본0`·`측정`을 구분한다. 길이가 다른 기간의 값을 빼서 효과 점수로 표시하지 않는다. [성과회수.js:199](C:/Users/q1212/Documents/SYNK-talk/lib/성과회수.js:199).
- `회수요약`과 `tools/성과계기판.js`는 개입·도달·고리 누락·관측 상태를 집계한다. 이 집계 자체는 한국어 실력이 늘었다는 증거가 아니다. [성과회수.js:245](C:/Users/q1212/Documents/SYNK-talk/lib/성과회수.js:245), [성과계기판.js:85](C:/Users/q1212/Documents/SYNK-talk/tools/성과계기판.js:85).

### 실제 소비 연결

`deliver`가 학생별 지난 개입에 대해 `회수요약`을 호출한다. 하지만 여기서는 결과를 계수로 모으고, 다음 과제를 고르는 입력으로 되돌리지 않는다. 코드는 ‘호출되지 않는 죽은 계산기’ 단계를 넘었지만 ‘결과로 자동 학습하여 다음 처방을 바꾸는 엔진’까지 연결되지는 않았다. [deliver/index.ts:646](C:/Users/q1212/Documents/SYNK-talk/supabase/functions/deliver/index.ts:646).

공통 `atlas/engine.js`에는 결과 사건과 다음 판단을 잇는 시제품 기능이 별도로 있다. 이를 Talk의 `성과회수`와 운영 장부를 잇는 배포된 전체 고리로 간주해서는 안 된다. [engine.js:280](C:/Users/q1212/Documents/SYNK-appsscript/atlas/engine.js:280), [316](C:/Users/q1212/Documents/SYNK-appsscript/atlas/engine.js:316), [아틀라스 설계:510](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_설계.md:510).

### 검증과 배포의 확인 범위

- 개입 스탬프 시험은 서버 생산자가 당시 상태·선택 근거 필드를 싣는지, 학생 통로로 서버 개입을 위조할 수 없는지 확인하도록 작성돼 있다. [개입스탬프 시험:105](C:/Users/q1212/Documents/SYNK-talk/tests/개입스탬프.test.js:105).
- 성과회수 시험은 미도래 경계, 열람 고리, 개입 이전 사건 제외, 연결률 분모 0, 후속 교정 고리를 검증한다. 이번 감사에서 새로 실행하지 않았다. [성과회수 시험:27](C:/Users/q1212/Documents/SYNK-talk/tests/성과회수.test.js:27), [55](C:/Users/q1212/Documents/SYNK-talk/tests/성과회수.test.js:55), [157](C:/Users/q1212/Documents/SYNK-talk/tests/성과회수.test.js:157), [185](C:/Users/q1212/Documents/SYNK-talk/tests/성과회수.test.js:185).
- 기존 `deliver` 운영 배포 기록은 있으나 현재 전체 원문·실제 개입 완비율·학습 효과를 이번 감사에서 실측하지 않았다. 새 Atlas 지속 기억의 336개 시험도 Temper의 정책 개선이나 학습 효과를 입증하는 시험 수가 아니다. [배포장부:639](C:/Users/q1212/Documents/SYNK-talk/docs/_ops/배포장부.jsonl:639), [첫 기억 기록:38](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_첫지속기억_20260921.md:38).

### 미구현·다음 할 일

게임에서 ‘도움이 통했다’는 구체적인 결과 하나부터 정의해야 한다. 예컨대 점검 도움 없이 다음 편지에서 필수 정보를 스스로 적었는지를 보되, 다시 쓸 기회·도움 사용 여부·자료 누락을 함께 남긴다. 그 결과를 Core의 다음 제안에 연결하고 기본 구성과 비교해야 한다. 이후 충분한 관측이 쌓였을 때 시험장·지킴이·정책 확대·자동 되돌림을 순서대로 구현한다.

현재 회수 코드에는 `degraded` 개입을 분리해 결과를 소비하는 경로를 찾지 못했다. 시제품의 가상 결과나 API 성공을 교육 효과로 쓰지 않도록 이 분리와 실제 후행 기회 측정도 함께 필요하다. [Temper 개입 규격:46](C:/Users/q1212/Documents/SYNK-appsscript/docs/Temper_개입로그_규격_v1.md:46), [아틀라스 설계:514](C:/Users/q1212/Documents/SYNK-appsscript/docs/아틀라스_설계.md:514).

## 지도에 쓰지 말아야 할 표현

- “여덟 엔진이 모두 완성되어 회사 전체에서 운영 중”
- “모든 SYNK 콘텐츠가 이미 하나의 장기 기억을 공유”
- “NPC가 이미 모든 성취·관계·습관을 이해”
- “Temper가 학습 효과를 증명하고 스스로 정책을 개선 중”
- “336개 시험 통과 = 서버 배포·실기기 확인·학생 만족 검증”

권장 상태 표시는 **설계 준비 / 코드 있음 / 제품 일부 연결 / 로컬 검증 / 과거 배포 기록 있음 / 현행 원격 미확인 / 다음 구현 필요**다. 엔진 전체에 완료율 하나를 붙이지 말고 사용자에게 제공하는 능력별로 이 상태를 표시한다.
