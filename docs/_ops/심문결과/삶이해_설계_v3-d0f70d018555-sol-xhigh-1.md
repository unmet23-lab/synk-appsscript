확인 불가 — 라이브 DB 적용 상태와 실기기 화면은 확인하지 못했다. 저장소 문서·코드·계약 대조만으로도 결론은 **동결 불가**다.

지적 23건 = P0 14/23 · P1 9/23 · P2 0/23.

[P0] 핵심 학생의 ③호흡은 자유발화가 아니다 — 대상 §2㉠·§3㉮는 ③을 항상 `자유발화`라고 전제하지만, 실제로 급수 1~2·미정 학생에게 선택지가 붙으면 `task_format='응답'`이 된다([삶이해_설계_v3.md:36](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:36), [오늘과제.js:173](/C:/Users/q1212/Documents/SYNK-talk/lib/오늘과제.js:173), [오늘과제.js:348](/C:/Users/q1212/Documents/SYNK-talk/lib/오늘과제.js:348)). 재현: 급수 1 학생에게 평일 과제를 배정하면 선택지가 실리고, 이를 그대로 삶 질문에 재사용하면 일기가 아닌 선택 응답이 쌓인다. 동결하면 같은 `응답` 자료를 어떤 날은 선택 신호, 어떤 날은 삶 서술로 해석하는 소급 불가 오염이 생긴다.

[P1] 「자동 채점 금지 부분 철회」는 결정의 범주를 바꿔치기한다 — 대상 §2㉢은 AI 초안 허용을 근거로 나침반 답 자동 채점 금지가 부분 철회됐다고 선언하지만, AI가 후보를 쓰는 것과 목표 도달을 판정하는 것은 다른 행위다([삶이해_설계_v3.md:63](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:63), [나침반문항.js:35](/C:/Users/q1212/Documents/SYNK-talk/lib/나침반문항.js:35)). 재현: 구현자가 이 문장을 따라 나침반 답에 AI 진척 판정을 붙이면, 시즌 회고에서 사람이 판정한다는 판단 정본을 침범한다. 옛 주석은 고칠 대상이 아니라 “초안 생성은 채점이 아니다”라는 경계를 추가할 대상이다.

[P0] 삶 질문의 영구 식별 규격이 없다 — 대상 §3㉮의 `물음 번호·원문·판`만으로는 안정 ID, 삶 이해 차원, 고정/생성 출처, 질문 언어, 선택 정책판, 주 응답 매체를 복원할 수 없다([삶이해_설계_v3.md:71](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:71)). 재현: 문항 목록 중간에 하나를 끼워 번호가 밀리거나 음성과 글이 함께 제출되면, 옛 번호가 어느 질문·어느 응답 축이었는지 갈린다. 원문만으로 사후 동일성을 추측하면 문구 교정·번역·재생성 뒤 종단 분석이 불가능하다.

[P0] `season_goal` 스냅샷의 물리적 착지점이 틀렸다 — 대상 §3㉮는 `degraded`와 “같은 자리”에 싣는다고 하지만, `degraded`는 사건 열이고 `task.assigned.payload`는 `{ver:1}`, 현행 `goal_snapshot`은 `season_goal`이 아니라 `goal_track`이다([삶이해_설계_v3.md:71](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:71), [deliver/index.ts:716](/C:/Users/q1212/Documents/SYNK-talk/supabase/functions/deliver/index.ts:716), [deliver/index.ts:766](/C:/Users/q1212/Documents/SYNK-talk/supabase/functions/deliver/index.ts:766)). `season_goal`은 생성 모드의 `reads.life`에만 실리므로 모든 배정 갈래에 존재한다는 보장도 없다([생성모드.ts:157](/C:/Users/q1212/Documents/SYNK-talk/supabase/functions/deliver/생성모드.ts:157)). 재현: 생성 성공 과제와 직접·강등 과제를 각각 배정하면 삶 질문이 본 목표판을 서로 다른 위치에서 찾거나 한쪽에서는 잃는다.

[P0] 질문 노출과 무응답의 분모가 없다 — 대상 §3㉮는 배정과 제출만 말하고, 학생이 삶 질문을 실제로 보았는지·건너뛰었는지·화면 전에 이탈했는지를 기록하지 않는다([삶이해_설계_v3.md:67](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:67)). 현행 `content.viewed`는 ①듣기 완료 관측이고, 답하기 질문 노출 사건이 아니다([말하기화면.js:629](/C:/Users/q1212/Documents/SYNK-talk/src/말하기화면.js:629)). 재현: 음성을 들은 직후 앱을 닫은 학생과 삶 질문을 보고 답하지 않은 학생이 모두 “배정됐지만 제출 없음”으로 접혀 질문 품질과 회피율을 영구히 가른다.

[P0] 기존 「붓」을 정반대 의미로 재사용한다 — 세층합류 정본의 붓은 `season_goal → 구체 장면(stage) 3~5개`인데, 대상 §3㉯는 `일일 답 → season_goal 후보`라고 정의한다([삶이해_설계_v3.md:76](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:76), [세층합류_설계_v1.md:197](/C:/Users/q1212/Documents/SYNK-appsscript/docs/세층합류_설계_v1.md:197)). 재현: “한국 회사에서 회의하고 싶다”는 시즌 목표에서 무대 후보를 만드는 작업과, 일기 답에서 시즌 목표를 추론하는 작업을 같은 producer·판·source로 저장하면 입력과 산출 의미가 뒤집힌다. 둘을 분리하지 않으면 `season_goal`과 `stage`라는 두 삶 정본이 병렬로 생긴다.

[P0] AI 후보의 생성 계보가 복원되지 않는다 — 대상 §3㉯의 후보 번호·본문 지문·근거 사건·판에는 후보집합 ID, 표시된 전체 후보와 순서, 입력 마감시각, 사용 사건 집합, 프롬프트·모델·정책판, 생성 시도와 실패 상태가 없다([삶이해_설계_v3.md:78](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:78)). 기존 정본은 최소한 노출 당시 후보집합 전체를 굳히라고 이미 요구한다([세층합류_설계_v1.md:208](/C:/Users/q1212/Documents/SYNK-appsscript/docs/세층합류_설계_v1.md:208)). 재현: 늦은 전사가 도착한 뒤 같은 근거 사건으로 다시 생성하면, 학생이 본 후보와 재현된 후보가 달라도 어느 것을 승인했는지 복원할 수 없다.

[P0] 확인 카드에 상태기계와 동시성 계약이 없다 — 대상 §3㉯의 “한 번 누르게”에는 표시·대기·승인·거절·수정·만료 상태, 대상 후보 ID, 멱등키, 두 기기 충돌 규칙이 없다([삶이해_설계_v3.md:77](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:77)). 재현: 기기 A가 후보 A를 띄운 동안 서버가 후보 B를 재생성하고 기기 B에서 먼저 승인하면, A의 늦은 탭이 어느 후보에 귀속되는지 정할 수 없다. 행 부재·미노출·거절·오프라인 대기가 같은 얼굴이면 확인율과 현재 목표가 모두 거짓이 된다.

[P0] `reads.life.confirmed` 불리언 하나로는 출처를 가를 수 없다 — 현행 `reads.life`는 `source='season_goal'|stage`와 값을 담는 구조인데, 대상 §3㉯는 여기에 `confirmed`만 더해 원래 나침반 문장과 AI 후보를 가르겠다고 한다([삶이해_설계_v3.md:79](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:79), [읽기기록.js:31](/C:/Users/q1212/Documents/SYNK-talk/lib/읽기기록.js:31), [읽기기록.js:77](/C:/Users/q1212/Documents/SYNK-talk/lib/읽기기록.js:77)). 재현: 원래 `season_goal`과 승인된 후보의 문장이 우연히 같으면 `value+confirmed`만으로 원천과 적용판을 구분하지 못한다. 후보 ID·확인 사건 ID·source kind·유효 시점이 없으면 엔진이 어떤 삶 진술을 읽었는지 소급 복원할 수 없다.

[P0] 학생 확인과 강사 도장의 의미가 충돌한다 — 대상 §4는 ㉡·㉢ 확정이 학생 몫이라고 하면서, §3㉰는 AI가 쓴 삶 회고를 강사가 “확정”한다고 쓴다([삶이해_설계_v3.md:83](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:83), [삶이해_설계_v3.md:94](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:94)). 재현: 학생이 목표 후보를 거절했는데 AI 회고가 같은 목표를 쓰고 강사가 도장 찍으면, 무엇이 학생 확정 삶 정보인지 결정할 규칙이 없다. `student_truth_confirmation`과 `teacher_publication_approval`을 별도 객체·사건으로 가르지 않으면 권위가 뒤섞인다.

[P0] 후보의 시즌 귀속·만료 규칙이 없다 — 대상 §3㉯의 후보 필드에는 `season_id`, 유효 시작·종료, 대체 관계가 없다([삶이해_설계_v3.md:78](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:78)). 재현: 시즌 마지막 날 답에서 만든 후보가 다음 시즌 첫 과제 카드에 도착하면, 지난 목표의 수정 후보인지 새 시즌 목표인지 판별할 수 없다. 시즌을 넘은 승인 하나가 다음 시즌 콘텐츠와 회고 과녁을 오염시킨다.

[P1] 몽골어 갈래 미정은 동결 가능한 미결이 아니다 — 대상 §5가 미정임을 인정했고, 현재 전사 요청은 명시적으로 `language='ko'`다([삶이해_설계_v3.md:103](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:103), [transcribe/index.ts:46](/C:/Users/q1212/Documents/SYNK-talk/supabase/functions/transcribe/index.ts:46), [transcribe/index.ts:152](/C:/Users/q1212/Documents/SYNK-talk/supabase/functions/transcribe/index.ts:152)). 재현: 초급 학생이 삶 질문에 몽골어나 혼합 발화로 길게 답하면 기존 한국어 과제용 전사와 후보 추출 품질을 구분할 계약이 없다. 요청 언어·감지 언어·번역 여부·번역판·실패 상태를 정하지 않은 채 동결하면 핵심 대상의 삶 답이 엔진에 닿지 않는다.

[P0] 관찰초안 무늬는 회고에 그대로 옮길 수 없다 — 대상 §2㉡·§3㉰는 네 규율과 `고쳤나()`를 그대로 쓰지만, 현행 지문은 `area|정렬된 tags`만 비교하여 회고의 진척·방향·근거·문안을 전부 무시한다([삶이해_설계_v3.md:44](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:44), [관찰초안.js:140](/C:/Users/q1212/Documents/SYNK-talk/lib/관찰초안.js:140)). 또한 회고 AI는 앱·엔진 근거를 읽어야 하므로 “앱 축 데이터를 프롬프트에 안 넣는다”는 규율도 적용 불가능하다. 재현: 근거와 판정을 전부 고쳐도 area·tags가 같으면 서버가 `무수정`으로 기록한다.

[P0] 회고 판정의 과녁 자체가 스냅샷에 봉인되지 않는다 — 현행 `record_snapshot`에는 수행 축과 합계만 있고 나침반 답·행 ID·문장 지문이 없으며, `season_compass`는 같은 시즌 행을 upsert로 덮는다([회고.js:194](/C:/Users/q1212/Documents/SYNK-talk/lib/회고.js:194), [teach/index.ts:812](/C:/Users/q1212/Documents/SYNK-talk/supabase/functions/teach/index.ts:812)). 대상 §3㉰는 이 선행 P0를 다루지 않는다([삶이해_설계_v3.md:81](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:81)). 재현: 목표 A로 회고를 연 뒤 같은 시즌 나침반을 B로 고치고 도장 찍으면, 판정 라벨은 A의 근거와 B의 과녁 사이에 매달린다.

[P0] 도장은 어느 AI 초안에 찍혔는지 증명하지 못한다 — 대상 §3㉰에는 불변 `draft_id`·초안 지문·입력 스냅샷 지문·승인 사건·공개 시각·대체 관계가 없다([삶이해_설계_v3.md:83](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:83)). 현행 회고는 동일 행의 판정과 문안을 UPDATE하므로 예전 값도 보존하지 않는다([teach/index.ts:1162](/C:/Users/q1212/Documents/SYNK-talk/supabase/functions/teach/index.ts:1162)). 재현: 강사가 초안 A를 보고 승인하는 순간 재생성된 B가 저장되면, “도장 없음 비공개” 조건을 지켜도 학생에게 B가 나갈 수 있다.

[P0] 판정 계약 개정이 결론 없이 열린 채다 — 대상 §3㉰·§5는 분리 필요성만 말하고 학생·강사 양쪽의 새 필드, 값 집합, null 의미, 구행 변환, 멱등성과 append-only를 정하지 않는다([삶이해_설계_v3.md:86](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:86), [삶이해_설계_v3.md:104](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:104)). 회고 정본은 이미 `progress_verdict`·`direction_changed` 분리, `판정불가`, 학생·강사 각각 append-only를 한 벌로 요구한다([시즌회고_설계.md:25](/C:/Users/q1212/Documents/SYNK-appsscript/docs/시즌회고_설계.md:25)). 재현: “가까워졌고 방향도 바꿈” 또는 근거 부족 입력을 현행 셋에 넣으면 정보 하나를 버리거나 거짓 판정을 강제한다.

[P1] 「즉각 메아리 이미 존재」는 사실이 아니다 — `intervention.delivered.output_text`는 학생 답 이전에 생성된 따라 말하기 문장이고, 답을 받은 뒤 생성되는 응답이 아니다([삶이해_설계_v3.md:39](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:39), [deliver/index.ts:912](/C:/Users/q1212/Documents/SYNK-talk/supabase/functions/deliver/index.ts:912), [deliver-one/index.ts:522](/C:/Users/q1212/Documents/SYNK-talk/supabase/functions/deliver-one/index.ts:522)). 재현: 학생이 어떤 일기 답을 해도 ①에서 들은 문장은 이미 확정돼 있고 답 뒤에는 일반 완료 카드만 나온다. 따라서 주고받기·즉시 되돌려주기·다시 열 이유가 비어 있다.

[P1] 나침반 회차를 잘못 읽었다 — 대상 §2㉢은 `self_in_5y`를 입학 1회라고 적었지만, 실제 이후 시즌 문항은 `self_in_5y`와 `season_goal` 둘이며 `self_in_5y_changed`도 필수다([삶이해_설계_v3.md:59](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:59), [나침반문항.js:103](/C:/Users/q1212/Documents/SYNK-talk/lib/나침반문항.js:103), [나침반문항.js:164](/C:/Users/q1212/Documents/SYNK-talk/lib/나침반문항.js:164)). 재현: 시즌 2를 열면 문서상 예상보다 한 문항과 방향 변경 신호가 더 필요하다. 이 오독 위에서 회고 입력을 설계하면 방향 변경의 직접 근거를 빼거나 AI 후보로 잘못 대체한다.

[P1] 학습 사슬이 producer 이름에서 끝난다 — 대상 §3은 일일 답과 확인 후보를 말하지만 `이벤트→필드→학습자 모델/평가셋→회수 시점` 중 소비 함수와 회수 시점을 하나도 지목하지 않는다([삶이해_설계_v3.md:65](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:65)). `reads.life`는 콘텐츠가 무엇을 읽었는지 남기는 장부이지, 삶 이해를 갱신하는 엔진 부품이 아니다. 재현: 승인 후보 1건을 저장해도 다음 배정·시즌 회고·평가셋 중 어느 코드가 언제 읽는지 문서에서 실행 경로를 만들 수 없고, 부록 A-1의 “늘어난 칸”도 이름을 댈 수 없다.

[P1] 「새 레일 0」이 새 상태기계를 은폐한다 — 삶 질문 배정은 기존 운송로를 쓸 수 있어도 후보 생성, 다음날 노출, 확인, 만료, 재표시, 회고 초안과 도장은 각각 새 비동기 생명주기다([삶이해_설계_v3.md:24](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:24), [삶이해_설계_v3.md:95](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:95)). 기존 정본은 되묻기 카드가 하루 최대 2장, 성향 1장+목표 1장이라고 못 박고 셋째는 규칙 개정 대상이라 한다([세층합류_설계_v1.md:286](/C:/Users/q1212/Documents/SYNK-appsscript/docs/세층합류_설계_v1.md:286)). 재현: 두 기존 슬롯이 모두 찬 날 삶 후보 카드를 더하면 상한 위반이고, 안 띄우면 삶 후보가 무기한 굶는다.

[P1] 기존 문장↔질문 학습 연결을 끊는다 — 현행 과제는 문장과 질문을 한 벌로 만들고, 답하기 화면도 “방금 따라 말한 문장처럼” 답하라고 설명한다([오늘과제.js:343](/C:/Users/q1212/Documents/SYNK-talk/lib/오늘과제.js:343), [말하기화면.js:856](/C:/Users/q1212/Documents/SYNK-talk/src/말하기화면.js:856)). 대상 §3㉮의 “삶 질문을 섞는다”에는 따라 말한 문장과 삶 질문의 문법·상황 연결 조건이 없다([삶이해_설계_v3.md:69](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:69)). 재현: 식당 표현을 따라 말한 직후 5년 뒤 삶을 묻는 질문이 나오면 실사용 연습의 발판, 기능 전체의 정체 설명, 학생이 한 번 더 열 이유가 동시에 끊긴다.

[P1] 학생에게 무엇이 달라지는지 설명하지 않는다 — 대상 §3㉯는 다음날 확인 카드를 말하지만, 오늘의 일기 답이 왜 목표 후보가 되었고 승인 뒤 어느 과제·회고가 달라지는지 학생에게 되돌려주는 문구와 상태를 정의하지 않는다([삶이해_설계_v3.md:77](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:77)). 재현: 학생이 일기 답을 내고 다음날 맥락 없는 후보 카드를 받으면, 둘의 연결을 알 수 없고 기능은 “답을 가져가는 설문”으로 보인다. 자기설명의 전체 그림·연결 층과 재미 게이트의 재방문 이유가 비었다.

[P1] 강사 도장의 운영 경로가 없다 — 대상 §3㉰는 모든 회고 공개를 도장에 걸면서 초안 대기열, 묶음 처리, 알림, 기한, AI 실패 시 수동 초안 경로, 미처리 가시화를 정의하지 않는다([삶이해_설계_v3.md:83](/C:/Users/q1212/Documents/SYNK-appsscript/docs/삶이해_설계_v3.md:83)). 관찰초안의 “빈 채 확정 가능”을 그대로 적용하면 AI가 못 쓴 회고를 빈 상태로 정상 확정하는 조용한 실패가 된다. 재현: AI 초안 실패 또는 도장 미처리 1건이 생기면 학생 공개와 엔진 라벨이 무기한 막히지만 운영자는 어디서 막혔는지 알 수 없다.

[P1] 최신 수단 정찰 절차가 통째로 없다 — 판단 정본은 학생 접점 기능을 만들 때 현재 가장 새로운 방법을 먼저 정찰하도록 요구하지만, 대상 전문에는 조사 대상·비교 결과·채택 또는 기각 근거가 없다. 재현: 2026-09-05 동결 시점에 음성 대화·맥락 응답·플랫폼 신규 상호작용 중 무엇을 검토했는지 묻으면 문서에서 답을 찾을 수 없다. 신선함 게이트를 측정하기 전 필수 절차가 누락됐다.

값비싼 변경 판정: **봤다 → 문제다.** 판정값 계약, `reads.life` 의미, 후보 이력, 회고 승인·공개 스키마는 모두 소급 불가 변경인데 필드와 마이그레이션·호환 규칙이 확정되지 않았다.

## 이 문서보다 나은 대안 구조 1개

**「일일과제 단일 봉투 → 기존 확인 슬롯 → 불변 회고 봉인」 구조**로 다시 써야 한다.

1. 일일과제 봉투에 `life_probe` 하위 객체를 두고 안정 질문 ID·차원·언어·정책판·시즌 ID·그때의 나침반 행 ID/지문을 함께 굳힌다. 삶 갈래는 ③을 명시적으로 자유발화로 만들고 문장↔질문 연결 조건을 통과시킨다.
2. 제출 뒤 AI는 `season_goal`을 다시 쓰지 않고 `goal_amendment` 또는 기존 `stage` 후보를 append-only 사건으로 만든다. 생성 입력·후보집합 전체·모델/프롬프트판·마감시각·실패를 한 봉투에 봉인한다.
3. 확인은 기존 하루 2장 예산 안에서 교대 배정하고, 노출·승인·거절·만료를 후보 ID와 멱등키로 남긴다. `reads.life`는 source·후보 ID·확인 사건 ID·유효 시즌을 읽어 원래 나침반과 파생 후보를 가른다.
4. 회고를 열 때 나침반 사본·지문과 행동 근거를 한꺼번에 봉인한다. 학생 판정 후 그 봉인본으로 AI 초안을 만들고, 강사는 정확한 `draft_id/hash`에 도장 찍으며 승인과 공개를 한 트랜잭션으로 남긴다.
5. 학생·강사 판정은 각각 append-only로 두고 `progress_verdict`와 `direction_changed`를 분리하며 `판정불가`를 포함한다. 마지막에 다음 과제 소비 함수, 시즌 회고 소비 함수, 평가셋 회수 시점과 부록 A-1의 증가 칸을 각각 이름으로 적는다.

읽은 파일: 대상 전문, v1·v2 선행 심문 4/4편, 세층합류·시즌회고·제품방향·코어엔진·결정·트랙·기각 이력·수집 계약, SYNK-talk의 오늘과제·말하기화면·관찰초안·나침반문항·읽기기록·회고·deliver·deliver-one·생성모드·teach·events·transcribe 및 관련 마이그레이션.

안 본 것: 라이브 DB의 실제 마이그레이션 적용 상태, 실기기 오프라인·두 기기 동시 조작, 실제 운영 화면, 열린 PR 본문.