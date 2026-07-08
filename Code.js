/**********************************************************
 * ═══════════════════════════════════════════════════════════
 * 🆘 SYNK OS 긴급 복구 가이드 — 이 파일 하나가 시스템 전부입니다
 * ═══════════════════════════════════════════════════════════
 * 이 스크립트에는 SYNK의 모든 것이 들어 있습니다: 시트 29장의 구조,
 * 게임 콘텐츠 488개(몬스터·보스·대군주·스토어·팁·시즌·문법·감정),
 * 자동화 로직 전체, 그리고 설계 결정 이력(아래 노트 1~130).
 *
 * ▶ 무(無)에서 전체 재건 (새 시트·새 계정·재해 복구):
 *   1) 새 Google 스프레드시트 생성 → 확장 프로그램 → Apps Script
 *   2) 이 파일 전체를 붙여넣고 저장
 *   3) bootstrapSynk() 1회 실행 (권한 승인 2회) — 세계가 재림합니다
 *   4) setupV5Triggers() 1회 실행 — 심장 박동(17개 트리거) 시작
 *   5) 데이터(학생·포인트 이력)는 Drive 'SYNK_백업' 폴더 최신본에서
 *      profiles·point_logs·attendance 시트를 복사해 덮어쓰기
 *
 * ▶ 일상 안전망: 매일 밤 dailyBackup이 파일 전체 사본을 30일 보관.
 *   신규 시트도 자동 포함(파일 단위 복제). 복원 리허설 = restoreDrill().
 * ═══════════════════════════════════════════════════════════
 *
 * SYNK 앱데이터 통합 스크립트 v5 (v4 전체 유지 + 정체성 기능 통합)
 * 2026-07-07 · 이 파일 하나가 전체입니다. 기존 v4 전체 교체.
 *
 * [v4에서 유지되는 자동 트리거 — 변경 없음]
 *  calcAll(6h) dailyBackup(새벽3) birthdayCheck(아침7)
 *  checkReenrollment(아침8) checkConsultDelay(오전9)
 *  importFormResponses(1h) checkNoShow(30분) checkTuition(저녁8)
 *  notifyParents(저녁8) checkEvolution(밤9) checkAchievements(밤10)
 *  raidMonday(월) raidFriday(금) weeklyReport(일) healthCheck(일)
 *  archiveMonthly(1일 새벽2~3) monthlyGameBatch(1일 새벽5~6)
 *  monthlyReport(1일 아침7~8)
 *
 * [v5 신규 트리거 — setupV5Triggers() 1회 실행으로 자동 등록]
 *  weeklyBingoBatch(토 9시)   monthlyReportCards(1일 아침6~7시)
 *
 * [수동/1회용] setupSchedule setupStore createConsultForm
 *  cleanupFormTest setupTables(잠금)
 *  + v5: setupMonsters setupBrainTips setupSeasons setupHomework setupV5Triggers
 *  + v5.2: setupParentLabels translateContents (초벌 번역) · parentSweep(자동)
 *  + v5.7: setupFuelMissions setupQuiz setupTitleLore setupBosses
 *  + v5.8: checkConsultSync (상담 연동 진단) · setupHomework (210개 확장)
 *  + v6.7: setupTeacherCheers (강사 출퇴근 인사 14종)
 *
 * [v5 통합 내역 — v4 로직은 그대로, 수정 지점은 전부 [v5] 주석]
 *  1. 시냅스 게이지: calcAll이 AE~AG열 자동 계산
 *     (AE 시냅스게이지 0~100 · AF 게이지문구 · AG 다음진화까지P)
 *  2. 오늘의 시냅스: 명언 로테이션에 뇌과학팁(braintip) 통합
 *     + app_state '오늘의출처' 신설
 *  3. (v5.5 완전 삭제) 출석 빙고 — 보드 시각화 없인 체감 낮음 판정
 *  4. 월간 리포트 카드: monthlyReportCards — Slides 템플릿→PNG→Drive
 *     → report_cards 시트 (재실행 안전 · 60장 초과분 자동 이어하기)
 *  5. 명예의 전당: monthlyGameBatch 끝에 league_history 자동 기록
 *     + 리그 결과/레이드 성공 자동 공지(notices)
 *  6. 콘텐츠: setupMonsters/setupBrainTips/setupSeasons가
 *     contents(6열 v4 스키마)에 자동 입력 — 붙여넣기 불필요
 *  7. 버그 수정: PL/SYNK 채번 padStart (999번 초과 시 ID 중복 방지)
 *
 * [v5.1 콘텐츠·디테일 업그레이드 — 수정 지점은 [v5.1] 주석]
 *  8. 몬스터 7단계 확장 — 뉴로→스파키→링커→서킷→미엘로→플로우→싱크마스터
 *  9. 오늘의 숙제 — 요일 테마 로테이션 (setupHomework, app_state 3키)
 * 10. 칭호 5종 추가 + 등급 시스템(레전드/에픽/레어/일반) → AH·AI열
 * 11. 업적 7종 추가 (빙고·레이드·TOP10 단골·신규 진화 단계)
 * 12. 연속출석을 수업일 기준으로 개선 (평일반 주말 끊김 문제 해결)
 * 13. 중복 정리 — 칭찬 부자 통합, 지각 제로 자동 가드
 *
 * [v5.2 학부모 경험 + 다국어 기반 — 수정 지점은 [v5.2] 주석]
 * 14. 🛍️ 포인트 플렉스 칭호 제거 — 소비 경쟁 배제 (양도·도박성 없는 포인트 정책)
 * 15. 학부모 등원 알림: parentSweep(30분) — 등원만 몽골어 메일 푸시, 세부 기록은 인앱
 * 16. 공지 자동 몽골어: notices에 title_mn/body_mn 자동 번역
 * 17. 다국어 기반: contents G열(몽골어)/H열(영어) + translateContents 초벌 번역
 *     + setupParentLabels (학부모 화면 라벨 한·몽·영)
 * 18. replaceContentType 전체 열 보존 — 번역 열이 setup 재실행에도 안 밀림
 *
 * [v5.3 최종 감사 — 수정 지점은 [v5.3] 주석]
 * 19. 빙고 결함 수정: 블랙아웃 제거(평일반 최대 수업일 22~23일 → 24출석 도달 불가,
 *     낮추면 개근왕과 중복) + 페이싱 재설계(첫 줄 8출석 → 주말반도 매달 달성 가능)
 * 20. 업데이트 절약: 기준일·등원알림 포인터 → Script Properties (시트 쓰기 제거)
 * 21. 안정화: Slides export 간 sleep(429 방지) · 연속출석 계산 캐시(속도 100배)
 * 22. applyLowUpdateMode(): calcAll 하루 2회 전환 옵션 (업데이트 예산 절약)
 *
 * [v5.4 알림 다이어트 — 수정 지점은 [v5.4] 주석]
 * 23. 학부모 메일 정책 패널: 등원·미출석·생일(연1회)만 유지,
 *     칭찬·진화 메일은 인앱 전용 전환 (v4가 매일 보내던 것 차단)
 * 24. 원장 브리핑: 생일·진화·임박·업적·신규학생을 아침 8시 1통으로 통합
 * 25. (v5.4 보류 → v5.5 확정 삭제)
 *
 * [v5.5 — 빙고 완전 삭제]
 * 26. weeklyBingoBatch·countBingoLines·BINGO 상수·빙고 마스터 칭호·첫 빙고 업적
 *     ·bingo_state 참조 전부 제거. 남은 토요일 트리거는 setupV5Triggers가 자동 삭제.
 *
 * [v5.6 — 몽골 수업 리듬 정렬]
 * 27. 오늘의 숙제: 저녁 21시 이후 자동 일괄 게시로 변경 ("오늘 배운" = 진짜 오늘 수업)
 * 28. 저업데이트 모드 시각: 14시(수업 전)·22시(수업 후+숙제 게시)로 조정
 *
 * [v5.7 확장팩 — 수정 지점은 [v5.7] 주석]
 * 29. 레이드 연료: class_fuel 1행 = 반 전체 보너스 (수업 미션 6종, raidFriday 합산)
 * 30. 보스 서사: 월초 등장 공지 + 금요일 격파 대사 (contents boss 월 로테이션)
 * 31. 오늘의 시냅스 퀴즈(30) · 칭호 로어(11) · 시즌 인트로 배너 · 주간 배운 것 몽골어
 *
 * [v5.8 — 숙제 210 + 주말 분리 + 상담 진단]
 * 32. 숙제 뱅크 요일당 30개(총 210) — 30주 무반복 로테이션
 * 33. 평일반/주말반 숙제 분리: 평일 키는 월~금만 갱신(금 숙제가 주말 유지),
 *     토·일은 주말의숙제* 키만 갱신 → 평일반에 주말 숙제 미발행 + 덮어쓰기 버그 해결
 * 34. profiles AJ열 = 반유형 (Glide ITE로 숙제 키 자동 선택)
 * 35. checkConsultSync — 상담시트↔profiles↔폼 연동 읽기 전용 진단 (메일 보고)
 *
 * [v5.9 — 이름 자유화 · 업적 21종 · 숙제 초급 다듬기]
 * 36. classNumOf 일반화 — 반 이름에 숫자만 있으면 어떤 이름이든 시간표 매칭 유지
 * 37. 업적 +6 (숙제 30/100 · 무대 체질 · 칭찬 컬렉터 · 시냅스 1주년 · 싱크 베테랑)
 * 38. 숙제 10개 난이도 하향 — 초급~고급 공용 하한선 재정비
 *
 * [v6.0 — 최종 전수 감사 통과]
 * 39. 자동 감사 28항목: 함수 계약·스코프·트리거·콘텐츠 수량 전수 검증 완료
 * 40. healthCheck에 class_fuel·weekly_topics 추가 (유일한 실결함 수정)
 *
 * [v6.1 — 칭호 착용 시스템 지원]
 * 41. setupTitleLore E열에 등급 라벨 — 학생이 고른 착용 칭호(profiles AK열, Glide 기록)의
 *     등급 Pill·로어를 Relation 하나로 표시. AK열은 스크립트가 건드리지 않음(사용자 선택 보존).
 *
 * [v6.2 — 시스템 워치독]
 * 42. systemWatchdog(월 7시): 트리거 실종·로테이션 멈춤·셋업 미실행·데이터 무결성·번역 적체를
 *     매주 자동 점검해 메일 보고 — 숨은 문제를 "곪기 전에 먼저 아는" 안전망.
 *
 * [v6.3 — 트리거 20개 한도 해결: 통합 리셋]
 * 43. resetAllTriggers(): 전체 삭제 후 통합 10개 재설치 (morning/night/weekly/monthlyJobs)
 *     · 게임배치→아카이브 순서 코드 고정 · 폼 접수 30분 스위프 편입 · safeRun 실패 격리+알림
 *
 * [v6.4 — 처음의 목표 (여정 페이지)]
 * 44. syncProfiles가 상담시트의 목표 급수·시기 2필드만 profiles AM·AN으로 선별 복사
 *     (열 번호 상수 입력 전엔 꺼짐 · 비자/재정 등 민감정보는 앱에 절대 안 감)
 *
 * [v6.5 — 사용자 기록 열 정비]
 * 45. calcAll이 AK(착용칭호)·AL(리포트확인월)·AO(몬스터이름) 헤더 자동 보장
 *     — 값은 Glide(학생·학부모)만 기록, 스크립트 불가침. 진화 임박 배너는 T열(진행률) Glide ITE로.
 *
 * [v6.6 — 애정 장치 시트 반영]
 * 46. 지난달의 전당: 월초 리그 기록 시 app_state '지난달의전당' 배너 문구 자동 세팅
 * 47. AP열 단계번호(1~7): 강사 대시보드 "우리 반 누적 진화" Rollup 근거 (자동 계산)
 * 48. 리포트카드 {{몬스터}}에 학생이 지은 몬스터 이름 반영 — "네오 (스파키)"
 * 49. 안전 가드: profiles·상담 목표 기록 전 열 자동 확장 (좁은 시트 오류 방지)
 *
 * [v6.7 — 강사 출퇴근 인사]
 * 50. setupTeacherCheers: 출근 토스트 7종 + 퇴근 응원 메일 뱅크 30종으로 개편 (v6.8)
 *
 * [v6.8 — 강사 알림 시스템]
 * 51. 퇴근 응원 메일: 퇴근 기록 5분+ 경과 시 발송 (30종 일자 로테이션, 즉시 발송 아님)
 * 52. 수업 전 브리핑: 시작 0~12분 전 — 오늘 검사할 숙제·워밍업 퀴즈·연료 리마인드
 * 53. parentSweep 30→10분 승격 (등원 메일·폼 접수도 더 빨라짐) · 상태는 Properties(시트 0)
 * 54. 강사 이메일 자동 탐지(profiles teacher 행) · teacher_checkins 열은 TC_* 상수로 조정
 *
 * [v6.9 — TOPIK 필수 문법 퀴즈 통합]
 * 55. 오늘의 시냅스 퀴즈 30 → 100 (TOPIK I 필수 문법 40 + TOPIK II 진입 문법 30 추가)
 *     — 숙제 210은 유지 (진도 참조형이 레벨 공용의 핵심). 문법 간격 복습은 퀴즈가 담당.
 *
 * [v7.0 — 런타임 시뮬레이션 감사 수정]
 * 56. syncProfiles가 강사·학부모 행을 매일 지우던 v4 잠복 결함 수정 (비학생 행 보존)
 * 57. weeklyJobs의 pruneAppState 무인자 호출 제거 (archiveMonthly 내부 헬퍼였음)
 * 58. 워치독 권장 트리거 목록을 v6.3 통합 체계로 갱신 (매주 오탐 경고 제거)
 *
 * [v7.1 — 포인트 경제 전면 재설계] 기준 단위 = 숙제 10P · 평균 월소득 ~160P/성실 ~280P 역산
 * 59. 진화 임계 0/100/250/500/900/1500/2400 — 첫 진화 3주 내(훅), 최종 = 성실 9개월
 * 60. 레이드: 보스 HP = 인원×(평일 35·주말 20), 승리 +20(50→), 연료 15~25(40~70→)
 *     — 유기 포인트만으론 아슬아슬, 연료 미션이 승부처가 되도록 (노력 > 연료)
 * 61. 성장/잔액 분리: P열 = 획득 누계(양수+정정만 · 진화/랭킹/월간 기준), AQ열(신설) = 잔액(스토어 기준)
 *     → 스토어 소비가 몬스터 진화·랭킹을 깎던 구조 결함 제거. carryover 3열(earned) 확장
 * 62. 월간 정산 신설: 출석 1회 +3P(학생당 1행) · 칭호보너스 = 조건형만(개근왕 30·레이드영웅 20)
 *     — "조건에 포인트를, 경쟁에 명예를" (챔피언·숙제왕 등 1위 칭호는 명예 전용)
 * 63. 스토어 22종 재가격(40~1,800P) — 간식·체험(DJ권·자리지정권) 티어 신설, 주간 소비~연간 목표 사다리
 * 64. 강사 버튼: 숙제완료 10 + 왕관 2종(아래 79) · 생일 20 자동. 오지급 정정은 '정정' 포함 음수 행
 *
 * [v7.2 — 발표 폐지 · MVP 신설 · 정원 HP · 스토어 앵커]
 * 65. 발표 +5 폐지(강사 버튼·학생 퀴즈 버튼 모두 — 발표마다 탭하는 운영 비용 + 학생 자가지급 구멍 제거)
 *     → '오늘의 MVP' +10 신설: 수업 종료 시 강사가 가장 빛난 1명에게 1탭 (reason='오늘의 MVP')
 *     칭호 발표왕 → '🌟 이달의 스타'(MVP 최다) · 업적 무대체질 = MVP 8회
 * 66. 보스 HP = 반 정원 × (평일 28 · 주말 18) — 정원: 반 번호 1~4 = 20명, 5번~ = 10명
 *     → 대형반 560 · 소형반 280 · 주말반 180. 매주 동일 HP = 예측 가능한 보스
 * 67. 스토어 앵커(성실 월 ~280P): 반팔 3개월(850) · 과잠 6개월(1,700) · 촬영 7개월+(2,000)
 *
 * [v7.3 — 레이드 스토리 엔진 · 주말반 정산 수정 · 기능 열 4종]
 * 68. raid_story 시트 신설 — 일일 전투 리포트(월~목·토 22시, RPG 서사 자동 생성: 부위 타격·연료
 *     합동 공격·남은 HP) + 결산 서사(격파/도주/무공격, 최다 딜러·막타 주인공 자동 캐스팅)
 * 69. 주말반 정산 결함 수정: 금요일 정산은 토·일 수업 데미지를 영원히 놓침 → 금=평일반 · 일=주말반
 * 70. profiles 신설: AR 목표아이템(사용자 전용) · AS 최고월간기록·AT 기록월(자기 경신, 경신 시만
 *     기록) · AU 이달의스토리(gameBatch가 story 문장을 복사 — 학부모·여정 원클릭 바인딩)
 * 71. class_stats 7열 '반주간데미지' — 학생 주간 양수+연료, 레이드 카드 게이지 기본 데이터(14·22시)
 *
 * [v7.4 — MVP 하루 1명 가드 · 학부모 알림]
 * 72. mvpGuard(22시): 같은 날·같은 반 MVP 2건+ → 최초 1건만 유효, 초과분 자동 정정(-10) + 원장 경고.
 *     정정은 성장(P)·잔액(AQ)·레이드 데미지·스타왕 카운트까지 전부 대칭으로 되돌림
 * 73. Glide 사전 차단(1차): 오늘 우리 반에 MVP가 있으면 버튼 자동 숨김 — 레시피 §12
 * 74. notifyMvpParents(22시): 유효 MVP만 학부모 한·몽 메일 (PARENT_MAIL_MVP=true, 반당 하루 1건)
 *
 * [v7.5 — 전 지급 경로 일일 한도 · 재실행 방어 총점검]
 * 75. dailyGuard(22시, 舊 mvpGuard 확장): 숙제완료·칭찬·생일축하 = 학생당 하루 1회, MVP = 반당 1명.
 *     초과분 '정정·일일한도(사유)' 자동. today 기준이라 자정에 자동 초기화 → 다음 날 다시 지급 가능
 * 76. monthlyGameBatch 월 1회 강제(app_state 게임배치완료월) — 재실행해도 출석정산·칭호보너스 중복 없음
 * 77. 연료 미션 주 1회: 같은 반·같은 미션 중복 행은 정산·일일스토리·게이지 3곳 모두 첫 건만 합산
 * 78. 정정 행은 숙제왕·정성왕·이달의 스타·누적 업적 카운트에서 전부 제외 (카운트 오염 차단)
 *     [1회성 보장 현황] 업적=영구 1회(Set) · 생일=연 1회(올해 로그 체크) · 레이드=주 1회(지급완료 마커)
 *     · 월간 칭호=매월 리셋(의도) · 진화=단계 상승 시 1회 · 출석 정산=Set 기반 중복 출석 무해
 *
 * [v7.6 — 칭찬 → '⚡ 오늘의 시냅스' 승격 · 몬스터 설명 교체]
 * 79. 칭찬 +3 전원 뿌리기 폐지 → '오늘의 시냅스' +3: MVP처럼 반당 하루 1명(오늘 가장 성장한 학생).
 *     MVP(기량·참여) × 시냅스(노력·성장) 이원 왕관 — dailyGuard가 각각 반당 1명 강제, 학부모 통합 알림
 * 80. 정성왕(월간 시냅스 최다·명예)·업적 '시냅스 컬렉터'(10회)로 승계 · X열=칭찬+시냅스 연속 집계
 * 81. 사유 라벨 6종(R06 시냅스 추가, 과거 칭찬 라벨 유지) — setupParentLabels·setupTitleLore 재실행
 * 82. 몬스터 M05~M07 설명을 실제 캐릭터 이미지(촛불 순례자→빛의 현자→왕관의 왕)에 맞게 — setupMonsters 재실행
 *
 * [v7.7 — 왕관 코너 · 무포인트 경보(7일) · 몬스터 도감/교체 · 왕관 컬렉션]
 * 83. 일일 전투 리포트 끝에 '👑 오늘의 왕관 — MVP·시냅스 수상자' 자동(순계 기준, 추가 행 0)
 * 84. QUIET_DAYS=7 무포인트 경보: AV열 마지막포인트일 → Y열 이탈위험 '중(N일 무포인트)' + 주간
 *     리포트 🔕절(기록 없음 포함) + Glide 배너(레시피 §16)
 * 85. AW·AX 왕관 컬렉션(MVP·시냅스 누적, checkAchievements가 매일 갱신) — 여정 탭 표시
 *     (몬스터 도감/교체는 v7.8에서 제거 — 진화 단계 S열 단일 체계 유지)
 *
 * [v7.8 — 운영 리스크 3종 해결 + 시즌·시상식·공정성·전당]
 * 87. 수업 전 브리핑에 '오늘의 루틴' 1줄 자동(시작 숙제 1탭 → 끝 왕관 2탭 → 연료 1행) — 습관 형성
 * 88. 보스 휴식 주: app_state '보스휴식주'에 날짜(쉼표 여러 주 가능) → 그 주 소환 스킵 + 🏖️ 스토리
 * 89. restoreDrill(): 최신 백업을 읽기만 하여 복구 가능 검증(덮어쓰기 없음) + 주간 리포트에 경과 표시
 * 90. 시즌 보스 12종(몽골 계절 반영, 월별 고정) — setupBosses 재실행, 워치독 boss 12
 * 91. 월초 🏆 왕관 시상식 준비 메일: 칭호별 수상자 + 상장 문구(로어) — 실물 왕관 세리머니용
 * 92. teacher_stats 7·8열 '이번달왕관·왕관편중%' — 왕관이 한 아이에게 쏠리는지 공정성 감지
 * 93. hall_of_fame 시트(졸업생 명예의 전당) — 원장이 Glide 폼으로 TOPIK 합격자 등재
 *
 * [v7.9 — 빼기 패치: 조잡 제거 · 알림 다이어트 · 주간 다이제스트]
 * 94. 명언·브레인팁 카드 폐지(app_state 게시 중단) — 몬스터·레이드 코어에서 시선 분산 제거
 * 95. 학생 홈 퀴즈 카드 제거(Glide) — 퀴즈는 강사 브리핑 워밍업으로만 유지(오늘의퀴즈 게시는 존속)
 * 96. 시냅스 게이지 AE·AF 은퇴(쓰기 중단·헤더 '(구)') — 진행바 T열로 성장 시각화 단일화
 * 97. 등원 즉시 메일 기본 OFF(PARENT_MAIL_ARRIVAL) → 일요일 22시 parentWeeklyDigest 1통으로 통합
 *     (등원·포인트·왕관 횟수·레이드 결과·배운 것 — 미출석 안전 메일은 그대로 유지)
 * 98. AL·AM·AN 은퇴 표기('(구)') — 저참여 예상 + 상담 정보는 노션 원칙
 * 99. 케어지수 = 출석×12 + 포인트×1 (praise 변별력 소멸로 산식에서 제외)
 * 100. 업적 신규 동결 — 명예 3중 체계(왕관·칭호·업적) 유지, 확장 금지. 홈은 5컴포넌트 원칙
 *
 * [v8.0 — 업데이트 다이어트: 숙제 일괄 모드 · 스토어 정리]
 * 101. hw_batch: 강사가 완료 학생 멀티 선택 → 저장 1탭(수업당 1업데이트, 학생당→수업당 ~85% 절감).
 *      expandHwBatch(22시)가 학생별 +10 전개 — 당일 레이드·스토리·왕관 집계에 전부 포함.
 *      개별 숙제 버튼 병행 가능(같은 날 지급자 자동 스킵) · '전개완료' 마킹 멱등
 * 102. Glide 업데이트 규칙(공식): 앱→시트 = 건당 1 / 시트→앱 sync = 변경 묶음당 1 / 변경 없으면 0
 * 103. 스토어 20종 — 오늘의 DJ권·자리 지정권 삭제(원장 결정). 주간 소비는 간식 티어가 담당
 *
 * [v8.1 — 오늘의 출결 보드 (분 단위 한눈 뷰)]
 * 104. today_board 시트: parentSweep(10분)마다 재구성 — 강사 출근·퇴근 HH:mm 한 줄 페어링,
 *      학생 반별 등원 HH:mm, 오늘 수업 반의 미등원자 '—' 표시. GPS 원본(created_at)은 분 단위 그대로
 * 105. 원장 탭에 today_board Collection 하나면 끝 — 갱신 자체는 writeIfChanged라 sync 저비용
 *
 * [v8.2 — 최종 검수: 콜드스타트 가드 · 죽은 코드 정리]
 * 106. 빈 시트(학생 0·로그 0) 가드 7곳: raidMonday(class_stats)·dailyGuard(point_logs)·
 *      checkEvolution·sendMorningDigest·알림 info맵(profiles)·번역 헬퍼·syncProfiles(try)
 *      — 배포 첫날·상담시트 미연결에도 전 파이프라인 무크래시 (콜드스타트 시뮬로 검증)
 * 107. 죽은 코드 삭제: gaugeTextOf·setupBrainTips·GAUGE_STREAK_MAX (v7.9 게시 중단의 잔재)
 * 108. AD열(30) 정정: 은퇴 아님 — 진화 임박 알림의 중복 방지 마커(내부용)로 유지
 *
 * [v8.3 — 신반명 15반 정합 (정규반1~4·집중반1~6·주말정규반1~2·주말집중반1~3)]
 * 109. scheduleMap 키 = 반명(정확 일치) + schedOf 헬퍼. 번호 키는 유일할 때만(구체계 100% 호환)
 * 110. 보스 정원 = 트랙 기반: '집중반' 포함=10 · '주말정규반'=20 · 정규반1~4=20 · 구 5번~=10
 *      → HP: 정규반 560 · 집중반 280 · 주말정규반 360 · 주말집중반 180
 * 111. checkNoShow·classPrepMail_ 순회 = 반명 키만(이중 키 중복 방지) · 미등원 메일 문구 반명화
 * 112. syncProfiles = 상담 v18.1(62열) 재배선: ID BH(60) · 이메일 J · 연락처 H · SNS I ·
 *      보호자 M/O · 수강료는 수강·납입 시트 ID 조인 · 재원상태 '퇴소' 학생은 동기화 제외
 *
 * [v8.4 — 구글폼 파이프라인 (폼 → 시트 → 앱 완전 자동)]
 * 113. createConsultForm v2: 문항 제목 = 시트 v18.1 헤더명 · 선택지 = 시트 드롭다운 값과 1:1
 *      (영어수업·핵심가치관·대표강점·지망 2/3순위·학습시간 4구간 등 상담지 v2 반영, 서술형 7종은 노션행)
 * 114. importFormResponses: 62열·ID BH 채번·생년월일/등록일 Date 객체·서술형→📝노션이관 병합
 *      흐름: 폼 제출 → 10분 스위프가 상담시트 62열 정렬 기입+ID 채번 → 아침 7시 sync → 앱
 *
 * [v8.5 — 디테일 연동 3종 (시트 → 앱)]
 * 115. syncProfiles가 추가 복사: 한국어수준(S)→AY51 (강사 뷰 '레벨' — 사양 누락 보완) ·
 *      ⚠위험신호(BI)→AZ52 (원장 콕핏 전용, 학생·학부모 바인딩 금지) · 핵심비전(V)→BA53 (케어 한 줄)
 *      비학생 행 잔값 방지 clear 포함 · 계산열(16~50)과 완전 분리
 *
 * [v8.6 — 오늘의 시냅스 팁 부활 (재설계)]
 * 116. v7.9 폐지 사유(홈 5원칙·시선 분산)를 존중한 재배치: 홈 '최하단' 한 줄 카드로만.
 *      브레인팁 30종 신규 집필(setupBrainTips) · calcAll이 '오늘의팁' 일 로테이션 게시 ·
 *      번역 스위프가 몽골어 자동(targets에 braintip 기존재) · 워치독 감시 복원
 *
 * [v8.7 — 최종 총검수 라운드]
 * 117. CONSULT_GOAL 죽은 블록 완전 삭제(v6.4 유산 ~20줄) · 무가드 빈시트 3곳 추가 봉합
 *      (raidFriday pf·왕관알림 pl·배너 nt) · AY~BA 쓰기 3회→1회 병합
 *
 * [v8.8 — 가드 실증 시뮬이 잡은 실버그 1건]
 * 118. checkNoShow 결석자 매칭의 번호 폴백이 신체계에서 트랙 간 오매칭(정규반1 학생이 집중반1
 *      결석자로도 집계 → 미등원 메일 중복). scheduleMap과 동일 원칙으로 수리: 번호가 유일할 때만 폴백.
 *
 * [v8.9 — 시냅스 +3 → +10 상향 (경제 조정)]
 * 119. Glide 버튼 값만 변경 — 스크립트는 금액 하드코딩 0(정정=실지급액·사유=문자열 매칭)이라 자동 적응.
 *      기존 +3 이력과 신규 +10 혼재 안전(가드가 각 행의 실제 pts를 되돌림). 문서·라벨 전수 갱신.
 *
 * [v9.0 — 만족도 팩 (진화 연출 · 생일 브리핑 · 칭찬 태그)]
 * 120. ①진화일 BB(54): calcAll이 단계 '상승'만 감지해 기록(신규생 첫 계산·하락 제외) → Glide 홈
 *      최상단 3일 축하 카드 ②강사 브리핑에 오늘 생일자 한 줄(교실 축하 유도) ③point_logs H(8)
 *      칭찬 태그(발음↑/열정/친구도움/집중력) → 다이제스트 '크루의 눈' 한/몽 병기. 스크립트는 H열 무해.
 *
 * [v9.1 — 반 대항 리그 (자동 제안 + 원장 오버라이드)]
 * 121. 월요일 raidMonday가 학생≥1 반들을 인원순 인접 페어로 league_pairs에 '제안'(홀수=부전 휴식).
 *      원장은 Glide에서 반A/반B만 바꾸면 수동 매칭(행 기준 정산이라 상태 무관). 일요일 밤
 *      leagueSettle_: 판정 = class_stats 8열 '주간평균'(1인당 — 20명 vs 18명 인원차 공정 흡수),
 *      승리 반 전원 +5P('리그승리') + 자동 공지(몽골어 스위프 번역). 결과 기입 = 멱등 가드.
 *
 * [v9.2 — 리그 서사: 양 반 모두의 스토리 ('패배' 없는 리그)]
 * 122. 정산 시 raid_story에 페어당 2행 — 승자: '👑 이번 주 리듬왕'(+방어전 예고로 자만 방지),
 *      상대: 격차 ≤25%면 '🔥 명승부·리벤지 예약', 크면 '🌱 사라지지 않는 데미지'(몬스터 양분 프레임).
 *      양쪽 다 그 반 최다 기여자 실명 호명. 공지도 순화('꺾었다' 제거 — 양 반 병기 + 양분 문구).
 *      금칙어: 패배·졌다·아쉽 — 시스템 어디에도 없음.
 *
 * [v9.3 — 리그 일일 중계석 (월~토 밤)]
 * 123. leagueStoryDaily_: 매칭된 각 반에 캐스터 톤 중계 1행(raid_story 유형='리그중계').
 *      구성 = 스코어 상황(리드/동점/근소 추격/마이페이스 4트랙) + 오늘의 캐리 실명 + 아기자기
 *      디테일(왕관 획득 > 숙제 n명 > 단단한 하루) + 응원 꼬리. 뒤처져도 '근육' 프레임 — 지치지 않게.
 *      멱등(일·반 dup) · 부전 반 스킵 · 일요일은 결산 서사가 대신.
 *
 * [v9.4 — 📖 싱크 스토리: 월간 스토리북 자동 발간]
 * 124. 매월 1일 buildMonthlyStorybook_(칭호 뒤·아카이브 앞): 지난달 실화(보스 격파 수·레이드 영웅·
 *      리그 최고 명승부·진화자·왕관왕)를 표지+프롤로그+4장+에필로그 7행으로 synk_stories에 발간.
 *      문장 골격 = STORY_GRAMMAR 월 로테이션(TOPIK 3~4급 문형 12세트×4) + 챕터별 📖 문법 포인트 배지.
 *      제목 자동(STORY_TITLES 6종 × 보스명) · 빈 달 대체 서사 완비 · 멱등 · 발간 공지 1건.
 *
 * [v9.5 — 스토리북 v2: 청춘만화 서사 엔진 (배경 12경 × 아크 2종)]
 * 125. STORY_SCENES 12경(덕수궁 눈길~보신각 제야, 각각 도착 묘사·문화 디테일·보스 등장 연출) 월 로테이션.
 *      홀수 달 = 원정 편(소풍→습격→각성→라이벌 원군→결전), 짝수 달 = 라이벌 조우 편(우연한 만남→
 *      신경전→공동전선→승부의 재정의) — 구성 자체가 격월로 변주. 표지+10화+에필로그 = 12장(30분+ 독서).
 *      캐스팅 전부 실데이터: 최다 캐리 h1·h2, 진화자, 왕관왕, 리그 명승부 두 반. 폴백 완비 · 문법 유지.
 *
 * [v9.6~9.7 — 🌍 월드 레이드 + 스토리북 기승전결 재구성]
 * 126. 월드 레이드: 매월 1일 소환(HP=재적×100 — 전원 참여 시 클리어 가능한 '조금 강한' 난이도),
 *      calcAll이 전교 월간 획득 총합을 누적, 다음 달 1일 판정(격파=전원 +10P·R08 / 미달=봉인).
 *      정체 = 매달 반 보스들의 배후 '망각의 대군주 제로'(contents worldboss — 교체 가능).
 * 127. 스토리북 v3: 起(일상·설렘, 홀짝 아크 변주 유지)→承(반 보스전→"나는 그림자일 뿐")→
 *      轉(대군주 강림·전교 {N}명 총집결·전교 총데미지 실수치)→結(격파=완전 승리 / 미달=봉인 성공,
 *      모두 해피엔딩)+에필로그. 챕터 배지 = 문법 4 + 💗 감정 표현 4(설레다·소름이 돋다·가슴이
 *      벅차오르다 등 — 감정 곡선과 1:1, 한국어 감정 관용구 학습). 제목 = 무대+'대결전'+대군주.
 *
 * [v9.8 — 스토리북 v4: 몰입 우선 리라이팅]
 * 128. 문체 전면 교체: -했다체 서사, 감정은 설명 대신 장면으로, 본문 이모지 0·지문 느낌표 억제,
 *      억지 증량분 삭제(분량 자유·밀도 검증 폐기). 교육 장치는 전부 배지 열(G)로 격리 — 화당 하나,
 *      Glide에서 본문 카드 하단에 작게 렌더. 감정 관용구는 화당 최대 1회 *기울임* 마크다운(Rich Text).
 * 129. 캐스팅 5역: 주연 1(월간 최다 활약 — 전 이야기의 시점 축, 등장 화 6+), 조연 2, 단역 1~2(왕관왕
 *      중 미중복자), 엑스트라(반명·크루들). 진화 장면은 주·조연 중 실제 진화자에게 자동 배정.
 *
 * [v9.9 — 🧬 자기완결 · 재해 복구]
 * 130. bootstrapSynk(): 셋업 13종+월드 소환+calcAll을 원버튼으로 — 빈 시트에서 세계 재건(단계별
 *      try/catch·요약 리포트). 최상단 🆘 복구 가이드 5단계. healthCheck에 league_pairs·world_raid·
 *      synk_stories 등록. watchdog expect에 worldboss:1. 백업은 파일 전체 사본(신규 시트 자동
 *      포함·30일). 이 파일 = 구조+콘텐츠+로직+설계사(史) 전부를 담은 단일 진실 원본.
 *
 * [v9.10 — 🎬 영상팩: 씬 프롬프트 자동 생성 + 원장 메일]
 * 131. 발간 시 12씬 영문 프롬프트를 H열 '씬프롬프트'에 저장 + 원장 메일 1통. 구조 = IMG(일러스트
 *      생성용: 무대 SCENE_EN·보스 BOSS_EN·대군주 WB_EN·스타일 STYLE_EN 고정) || MOT(모션 전용 —
 *      image-to-video 모범: 이미지가 시각을, 프롬프트가 움직임을). 홀짝 아크별 12씬 2세트.
 *
 * [v9.11 — 🖼️ 몬스터 스킨 + 액자 시스템 (표현과 지위의 분리)]
 * 132. BC(55)=대표몬스터: 도감에서 학생이 선택(Glide Set Column — 도달 단계만 버튼 노출).
 *      calcAll이 임계 검증 — 미도달 선택은 자동 무효화. BD(56)=액자HTML: 스킨 이미지 × AP 액자
 *      (FRAME_CSS 7종: 새싹→스파크→링크→서킷→불씨→빛→왕관) 합성 — Glide 홈 카드 = Rich Text 1개.
 *      스킨은 취향(가로 선택), 액자는 성장(세로 승급·다운그레이드 없음). 진행 게이지·수치는 실단계 유지.
 *
 * [v9.12 — 🎮 학생 재미 팩 5종 (전부 밤 계산 편승 — 추가 sync 0)]
 * 133. 🔮 운세 BE(57): FORTUNES 36종, 이름+날짜 결정론(같은 날 재계산 불변). 💬 몬스터 한마디 BF(58):
 *      상태(생일>왕관>진화임박≤30P>오늘출석>7일+그리움>3~6일>일상) × 말투 3그룹(1-2 아기말·3-5 친구말·
 *      6-7 현자말) 말풍선 HTML — 패배·죄책감 어조 없음. 📊 기록실 BG(59): 최장 연속출석(전 기간 스캔)·
 *      최고 월간(스냅샷)·첫 왕관일·보스 참여·총 누적. 🃏 카드(synk_cards): 월간P 티어(브론즈~플래티나),
 *      0P는 '다음 달 주인공 예약' 참가 카드, 멱등. 🗺️ 지도(app_state 여행지도HTML): 발간 무대 도장
 *      12칸 그리드 — 미발간은 도감 문법(???). monthlyJobs ①.6~.7 편입 · healthCheck synk_cards.
 *
 * [v9.13 — 🧭 스타일 · 🤝 케미 · ⚔️ 매치업 · 🎯 히든]
 * 134. 🧭 BH(60): 2축 분석(리듬: 스타터/꾸준/피니셔 — 활동일 8+ 또는 분산이면 꾸준 · 스타일: 무대/
 *      성실/성장) 9유형+분석중, 표본 5건 가드, 전 유형 칭찬형. 공용 playStyleOf_ — 카드 뱃지에도.
 *      🤝 BI(61): 같은 반 이번 달 공통 출석일 최다(동점=이름순), 0건은 '솔로 플레이' 유머. ⚔️ BJ(62):
 *      이번 주 매치업(양방향 탐색) — 부전='재정비 주간', 미발표=공란, 첫 대결='첫 만남', 전적은 완료
 *      행만 파싱('X 승' 접두), '패' 단어 미사용, 경계 대상=상대 반 이번 달 에이스. 🎯 히든 업적 3종
 *      (한밤 21시+·하루 세 빛깔(하루 3종 사유)·새 달 첫 발자국) — 등급 '히든', has Set 멱등.
 *
 * [v9.14 — 원장 팩: 📡 레이더 · 👩‍🏫 케어 사각 · 📊 경영 리포트]
 * 135. 📡 BK(63)+원장 카드: 추세 기반 신호(🔴=7일+ 미출석 or 출석·포인트 동반 반토막 / 🟡=4~6일·
 *      단일 추세 하락·신입 45일 내 무왕관 / 입학 14일 내 무출석=적응 중 🟢). 14일 vs 이전 14일 창.
 *      👩‍🏫 케어 사각 = 최근 출석(14일 내 1+·4일 내 등원)인데 마지막 포인트 14일+ — 반별 명단, 강사
 *      코칭용. 📊 buildExecReport_(매월 1일·멱등키): 재적·활성률·반 온도 순위·레이더 현황·하이라이트
 *      — 원장 메일 즉발 + app_state 경영리포트HTML 상설. 전부 기존 데이터 재집계(비용 0).
 *
 * [v9.15 — 🧑‍🏫 강사 팩: 브리핑 · 격파 찬스 · 오늘 체크 · 왕관 밸런스]
 * 136. class_stats 9~12열(반 정렬 키 동일·writeIfChanged): ⑨수업전브리핑(🎂 오늘 생일 · 📵 어제
 *      결석(반에 어제 출석자 있을 때만 — 휴강 자동 무시) · 👩‍🏫 사각 · ⚡ 진화 임박 '오늘 왕관이면
 *      진화! 남은 nP') ⑩격파찬스(이번 주 raid 잔량 ≤ 인원×10 → '전원 숙제 하나면 끝', 아니면 공란
 *      — Glide visibility 숨김) ⑪오늘체크(숙제/MVP/시냅스/배운내용 ✅⏳ — 오늘 pl·topics 실데이터)
 *      ⑫왕관밸런스(이번 달 수혜 k/n + 미수혜 명단, 전원 시 축하). 잠복버그 수리: monsterOf.next는
 *      객체 — 진화 임박 판정을 mon.rem으로(v9.12 한마디의 임박 대사도 이 수리로 비로소 발화).
 *      공유 집계 변수는 calcAll 최상단 선언(스코프 승격) · todayYmd0 TDZ 수리.
 *
 * [v9.16 — 👨‍👩‍👧 학부모 팩: 몽골어 완결 뷰]
 * 137. 학생 행 BL~BN(64~66, 학부모 뷰가 relation·lookup으로 표시): 📋 주간리포트MN(최근 7일 롤링 —
 *      Ирц n/반수업일 · Оноо +nP · Титэм n · Сурсан зүйл 최근 주제 3) 💬 대화카드MN(최근 주제를
 *      몽골어 질문 틀에 삽입 — 문법명은 한국어 유지(아이에게 물을 때 그대로 발음), 주제 없으면 안내
 *      폴백) 🎉 축하배너MN(왕관 당일 титэм авлаа / 진화 3일 хувьслаа — 이중 언어 병기, 평시 공란).
 *      몽골어는 고정 템플릿(번역 API 무의존 — 견고). 학부모 뷰의 몽골어 갭 해소 완결.
 *
 * [v9.17 — 스토리북 발전 4종: 캐스팅 순환 · 카메오 확대 · 크레딧 · 집필 브리프]
 * 138. ① 연속 주연 가드(app_state 전호주연 — 직전 호 주연은 자동 제외, 유일 활동자 예외) +
 *      🌟 이달의 신인 슬롯(전월 스냅샷 대비 상승률 ≥100%·15P+ 최고 상승자를 조연 우선 배정).
 *      ② 🎭 카메오 엔진: 주조연 외 활동자를 실화 근거 8유형(한밤 업적·세 빛깔·신입 첫 달·개근·
 *      숙제 다수·시냅스·목소리·수호)으로 분류, 承轉結 10슬롯(승부처 2인)에 한 문장 마이크로 컷 —
 *      화당 ≤2·나열 금지·이모지 0(몰입 가드 유지). 본문 실명 최대 14명. ③ 🎬 크레딧(13장):
 *      활동 전원 실명 + 무활동자 '다음 호 출연 예정' — 소외 0. ④ ✍️ 집필 브리프: 영상팩 메일에
 *      캐스팅·사건·무대·문법 사실 시트 동봉 + 수기 각색 3단계 안내(월키 멱등이라 수기본 안전).
 *
 * [v9.17.1 — 출항 전 안전망 총점검]
 * 139. 미가드 단발 메일 5곳(주간리포트·복구리허설·개별발송·월말경영·헬스체크)에 quotaOk(1) 인라인
 *      가드 — 이제 sendEmail 31곳 전부 쿼터 가드 하에서만 발사. 다량 발송 루프(학부모·주간소식·
 *      시상식)는 애초에 루프 전 일괄 가드 확인. healthCheck 27시트 = 재건 실물 27과 완전 정합.
 *      백업 = 파일 전체 사본(SYNK_백업 폴더·30일) — 신규 시트 자동 포함. safeRun 34곳 크래시 격리.
 *
 * [v9.18 — 📚 학업 성장 축 v1 (급수·모의점수 시간축)]
 * 140. academic_log 시트(강사 월 1회 시트 직접 입력·Glide 업데이트 0): 유형 level(급수 1~6)·mock(점수 0~100).
 *      calcAcademic_(calcAll 말미 편승)이 학생별 스냅샷을 profiles BO~BV(67~74)에 기록 — 현재급수·최근모의·
 *      직전대비Δ·최고모의·레벨업누적·마지막평가월 + 학업한마디 KO/MN(따뜻한 리프레이밍, '하락' 금칙어).
 *      setupAcademic(bootstrap 재건 편입) · previewAcademic(시트 무쓰기 검증) · healthCheck 등록. 리포트카드는 열만 준비.
 *
 * [v9.19 — 🛠️ 상담폼 무효 ID 방어 (10분 실패 메일 스팸 차단)]
 * 141. importFormResponses의 FormApp.openById를 try/catch로 감쌈 — 저장된 상담폼ID가 삭제·타계정·권한없음·
 *      오타로 열리지 않으면 매 parentSweep(10분)마다 크래시→실패 메일이 쏟아지던 문제. 이제 빈 ID처럼
 *      조용히 스킵(로그만). 폼 재사용하려면 createConsultForm 재실행 또는 app_state '상담폼ID' 키 교정.
 * 142. checkFormMapping(폼ID?): 폼 질문 제목 ↔ 상담시트 헤더 매핑을 읽기 전용 진단 — 정상 매핑·노션이관
 *      ·빈 칸을 메일 보고. 폼 질문지 변경 시 "제대로 적용됐는지" 검증용. 새 폼 ID를 인자로 주면 상담폼ID
 *      교체 전 미리 검증 가능. 무인자는 현재 연결 폼 검사.
 * 143. 상담 파이프라인 v18.3 정합: CONSULT_SHEET_ID 현행 시트로 교체 · createConsultForm 질문 제목 19개
 *      재정렬(학력→최종학력, 지망대학N→…순위, 학비조달→학비조달주체 등) · 서술형 저장칸 📝노션이관→
 *      📝자유서술→노션 · dumpConsultHeaders(헤더 덤프) · syncProfiles 빈-원본 삭제 방지 가드 추가.
 * 144. 리포트카드 v2 ON: REPORT_TEMPLATE_ID 설정 · runReportCards_ 현재월 profiles+academic_log 기준 재배선
 *      (랭킹·monthly_snapshot 의존 제거) · {{급수변화}}{{모의점수}}{{점수변화}}{{출석}}{{몬스터단계}}{{칭호}}
 *      {{포인트}}{{코멘트}} + {{CHART}}(모의 최근5 막대) + {{MONIMG}}(단계 이미지). previewOneReportCard(sid)
 *      테스트. 코멘트 따뜻·리프레이밍. 학부모 메일은 SEND_REPORT_EMAIL=false로 아직 미발송.
 **********************************************************/

const ADMIN_EMAIL = 'unmet23@gmail.com'; // 운영 전환 시 founder@synk.im
const CONSULT_SHEET_ID = '1Ze_8IHOzmtAV-PHt12cUfRn5_LwRZwt8pcWsnjQ19FY'; // [v9.19] 구 시트(10Q-Yhqgy2…) 접근 불가로 현행 상담 스프레드시트로 교체

/* ── [v5] 신규 설정 ─────────────────────────────────── */
const REPORT_TEMPLATE_ID = '1XDhZPMjd17fbxmqGGEjq-kRks2Y3tJc9Ntrp90XV4pE';   // [v9.19] 리포트카드 Slides 템플릿 (비우면 스킵)
const REPORT_FOLDER_NAME = 'SYNK_리포트카드'; // Drive 폴더 (없으면 자동 생성)
const SEND_REPORT_EMAIL = false; // true: 학부모 이메일로 카드 링크 발송 (쿼터 가드 적용)
const MAX_CARDS_PER_RUN = 60;    // 1회 실행당 카드 수 (초과분은 4분 후 자동 이어하기)
const GAUGE_POINTS_MAX = 250;    //                  월간포인트 250P (40%)
const GAUGE_ATT_MAX = 22;        //                  월 출석 22일 (30%)
/* ── [v6.8] 강사 알림: 수업 전 브리핑 · 퇴근 후 응원 ── */
const TC_NAME_COL = 1, TC_TYPE_COL = 2, TC_TIME_COL = 3; // teacher_checkins 열 순서(이름·구분·시각) — 시트와 다르면 숫자만 조정
const CHECKOUT_MAIL_DELAY_MIN = 5; // 퇴근 후 최소 5분 뒤 발송 (10분 스위프 → 실제 5~15분 뒤 도착)
const CLASS_PREP_WINDOW_MIN = 12;  // 수업 시작 0~12분 전 창에서 브리핑 발송

/* ── [v6.4] 여정 페이지 "처음의 목표" (0 = 사용 안 함) ── */
// 상담데이터입력 시트 2행(헤더)에서 Ctrl+F '목표'로 찾은 열 번호(1-base)를 입력하면
// syncProfiles가 그 두 값만 profiles AM·AN으로 복사합니다. 민감정보(비자·재정)는 앱에 안 감.

/* ── [v5.4] 알림 정책 패널 — "필요한 것만 울린다" ─────── */
const PARENT_MAIL_ARRIVAL = false;   // [v7.9] 등원 즉시 메일 → 끔 (일요일 주간 다이제스트 1통으로 통합 — 알림 피로 방지)
const PARENT_MAIL_PRAISE = false;    // 칭찬 상세 메일 → 인앱 전용 (v4가 매일 보내던 것, 정책상 끔)
const PARENT_MAIL_EVOLUTION = false; // 진화 축하 메일 → 인앱 전용 (끔)
const PARENT_MAIL_ABSENT = true;     // 미출석 안내 — 안전 관련 큼직한 알림, 유지
const PARENT_MAIL_BIRTHDAY = true;   // 생일 축하 — 학생당 연 1회, 유지
const PARENT_MAIL_MVP = true;        // [v7.4] 오늘의 MVP — 반당 하루 1건의 희소 소식, 유지
const QUIET_DAYS = 7;                // [v7.7] 무포인트 경보 기준(일) — 조용히 멀어지는 학생 조기 감지
const DIGEST_MODE = true;            // 원장 일상 알림(생일·진화·업적·신규학생)을 아침 8시 1통으로

/* ── [v5.2] 학부모 알림 · 다국어 ─────────────────────── */
const NOTIFY_PARENT_ATTENDANCE = true; // 등원 시 학부모 메일 푸시 (false = 끔)
// 메일 쿼터: 일반 Gmail 100통/일 · Workspace 1,500통/일 → 운영 전환 시 founder@synk.im 계정으로 실행 권장

// [v5.1] 칭호 등급 (4 레전드 · 3 에픽 · 2 레어 · 1 일반) — 대표칭호/등급 표시용
const TITLE_RARITY = {
  '👑 개근왕': 4, '🧠 시냅스 챔피언': 4,
  '🚀 로켓 성장': 3, '⚔️ 레이드 영웅': 3, '🐎 다크호스': 3,
  '🔥 불꽃 출석러': 2, '🏋️ 우리 반 캐리': 2, '📚 숙제왕': 2, '🌟 이달의 스타': 2, '💝 정성왕': 2,
  '⏰ 지각 제로': 1
};
const TIER_LABEL = { 4: '👑 레전드', 3: '🟣 에픽', 2: '🔵 레어', 1: '⚪ 일반' };
function rarityOf(t) { return TITLE_RARITY[t] || 1; }

/* profiles 열 지도 (1-base)
 1 user_id  2 이름  3 이름_몽골  4 role  5 class_name  6 생일  7 email
 8 연락처  9 messenger_link 10 parent_of 11 tuition 12 등록일 13 보호자명
14 보호자연락처 15 created_at 16 누적잔액 17 월간포인트 18 월간랭킹
19 몬스터단계 20 진화진행률 21 연속출석 22 이번달출석 23 마지막출석일
24 이번달칭찬 25 이탈위험 26 보호자이메일 27 이전몬스터 28 최고스트릭
29 현재칭호 30 진화임박알림
[v5] 31 시냅스게이지 32 게이지문구 33 다음진화까지
[v5.1] 34 대표칭호 35 칭호등급 [v5.8] 36 반유형 */

/* ===================== 공용 유틸 ===================== */

function ensureSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function writeIfChanged(sheet, row, col, values) {
  if (!values.length) return false;
  const rng = sheet.getRange(row, col, values.length, values[0].length);
  if (JSON.stringify(rng.getValues()) === JSON.stringify(values)) return false;
  rng.setValues(values);
  return true;
}

function dstr(v, tz, fmt) { // 날짜값 안전 문자열화
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, tz, fmt || 'yyyy-MM-dd');
  return String(v).substring(0, (fmt === 'yyyy-MM') ? 7 : 10);
}

function getState(st, key) {
  const last = st.getLastRow();
  if (last < 1) return { row: -1, val: '' };
  const data = st.getRange(1, 1, last, 2).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) === key) return { row: i + 1, val: data[i][1] };
  }
  return { row: -1, val: '' };
}
function setState(st, key, val) {
  const g = getState(st, key);
  if (g.row > 0) {
    if (String(g.val) !== String(val)) st.getRange(g.row, 2).setValue(val);
  } else {
    st.getRange(st.getLastRow() + 1, 1, 1, 2).setValues([[key, val]]);
  }
}

/* --- PL 채번: app_state 카운터 + Lock (아카이빙 후에도 중복 없음) --- */
function reservePlIds(ss, count) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const st = ensureSheet(ss, 'app_state', ['key', 'value']);
    let g = getState(st, 'PL카운터');
    let cur = Number(g.val) || 0;
    if (cur === 0) { // 최초 1회: 현재+아카이브 최대값으로 초기화
      ['point_logs', 'point_logs_archive'].forEach(name => {
        const sh = ss.getSheetByName(name);
        if (!sh || sh.getLastRow() < 2) return;
        sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(r => {
          const m = String(r[0]).match(/^PL(\d+)$/);
          if (m) cur = Math.max(cur, parseInt(m[1], 10));
        });
      });
    }
    const ids = [];
    // [v5] slice(-3) → padStart: 1000건 이후 ID 중복 버그 수정
    for (let i = 1; i <= count; i++) ids.push('PL' + String(cur + i).padStart(3, '0'));
    setState(st, 'PL카운터', cur + count);
    return ids;
  } finally { lock.releaseLock(); }
}

/* --- point_logs 추가는 전부 이 함수로 (동시성 안전) --- */
function appendPoints(ss, rows) { // rows: [[sid, pts, reason, by], ...]
  if (!rows.length) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const pl = ss.getSheetByName('point_logs');
    const ids = reservePlIdsInner(ss, rows.length);
    const now = new Date();
    const out = rows.map((r, i) => [ids[i], r[0], r[1], r[2], r[3], now]);
    pl.getRange(pl.getLastRow() + 1, 1, out.length, 6).setValues(out);
  } finally { lock.releaseLock(); }
}
// appendPoints 내부용 (이미 lock 보유 상태)
function reservePlIdsInner(ss, count) {
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  let g = getState(st, 'PL카운터');
  let cur = Number(g.val) || 0;
  if (cur === 0) {
    ['point_logs', 'point_logs_archive'].forEach(name => {
      const sh = ss.getSheetByName(name);
      if (!sh || sh.getLastRow() < 2) return;
      sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(r => {
        const m = String(r[0]).match(/^PL(\d+)$/);
        if (m) cur = Math.max(cur, parseInt(m[1], 10));
      });
    });
  }
  const ids = [];
  // [v5] slice(-3) → padStart: 1000건 이후 ID 중복 버그 수정
  for (let i = 1; i <= count; i++) ids.push('PL' + String(cur + i).padStart(3, '0'));
  setState(st, 'PL카운터', cur + count);
  return ids;
}

/* --- 시간표 --- */
function classNumOf(classStr) {
  // [v5.9] 이름 자유화 — "정규반3"뿐 아니라 "크루3", "홍대 3크루" 등 숫자가 포함된 어떤 이름도 OK
  //        (숫자 없는 반은 기존처럼 시간표 미등록 취급 → 달력일 방식 안전 폴백)
  const m = String(classStr).match(/(\d+)/);
  return m ? m[1] : '';
}
function scheduleMap(ss) { // [v8.3] 키 = 반명(정확 일치) · 번호 키는 '그 번호가 유일할 때만' 유지(구체계 하위호환)
  const sc = ss.getSheetByName('schedule');
  const map = {};
  if (sc && sc.getLastRow() >= 2) {
    const rows = sc.getRange(2, 1, sc.getLastRow() - 1, 3).getValues().filter(r => r[0]);
    const cnt = {};
    rows.forEach(r => { const n = classNumOf(r[0]); if (n) cnt[n] = (cnt[n] || 0) + 1; });
    rows.forEach(r => {
      const e = { type: r[1], time: String(r[2]), name: String(r[0]) };
      map[String(r[0])] = e;
      const n = classNumOf(r[0]);
      if (n && cnt[n] === 1 && !map[n]) map[n] = e;
    });
  }
  return map;
}
function schedOf(map, cls) { return map[String(cls)] || map[classNumOf(cls)]; } // [v8.3] 반명 우선 조회
function hasClassToday(ss, classStr) {
  const s = schedOf(scheduleMap(ss), classStr); // [v8.3]
  if (!s) return false;
  const day = new Date().getDay();
  const type = (day === 0 || day === 6) ? '주말' : '평일';
  return s.type === type;
}

/* --- 메일 쿼터 가드 --- */
function quotaOk(needed) {
  const q = MailApp.getRemainingDailyQuota();
  if (q >= needed + 3) return true;
  try {
    MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] ⚠️ 메일 쿼터 부족',
      '오늘 남은 발송량 ' + q + '건, 필요 ' + needed + '건.\n' +
      '일부 알림이 발송되지 않았습니다. founder@synk.im(Workspace) 전환을 권장합니다.');
  } catch (e) {}
  return false;
}

/* ===================== 통합 계산 엔진 v5 ===================== */

// [v9.13] 🧭 플레이 스타일 — 2축(리듬×스타일) 9유형, MBTI 감성. 전 유형 칭찬형(패배 없음)
const PLAY_STYLES = {
  '스타터무대': ['🌅','오프닝 스타','달이 시작되자마자 무대를 여는 개막의 아이콘'],
  '스타터성실': ['🌄','아침형 성실러','남들이 시동 걸 때 이미 반환점을 도는 부지런쟁이'],
  '스타터성장': ['🌱','새벽의 스파크','새 달의 첫 시냅스는 언제나 이 크루의 것'],
  '꾸준무대': ['👑','무대 체질','언제 어디서든 스포트라이트가 따라다니는 타고난 주인공'],
  '꾸준성실': ['🧠','꾸준함의 화신','비가 오나 눈이 오나 — 매일이 쌓여 산이 되는 유형'],
  '꾸준성장': ['🌿','매일 자라는 나무','하루하루는 조용하지만 한 달 뒤엔 훌슝 커 있는 성장형'],
  '피니셔무대': ['🔥','클라이맥스 메이커','결정적 순간에 가장 빛나는 대미의 승부사'],
  '피니셔성실': ['🌙','막판 스퍼트의 제왕','몰입이 시작되면 아무도 못 말리는 폭발형 집중러'],
  '피니셔성장': ['⚡','라스트 스파크','마지막 주에 시냅스가 폭발하는 저력의 소유자'],
  '분석중': ['🔬','분석 중…','시냅스 연구소가 너의 플레이 데이터를 모으는 중이야 (조금만 더!)']
};
function playStyleOf_(logs) {
  if (!logs || logs.length < 5) return PLAY_STYLES['분석중'];
  let early = 0, late = 0, stage = 0, growth = 0, steady = 0;
  const daySet = {};
  logs.forEach(l => {
    if (l.d <= 10) early++; else if (l.d >= 21) late++;
    daySet[l.d] = 1;
    if (l.rs === '오늘의 MVP' || l.rs.indexOf('발표') > -1) stage++;
    else if (l.rs === '오늘의 시냅스') growth++;
    else steady++;
  });
  const n = logs.length;
  const rhythm = (Object.keys(daySet).length >= 8 || (early / n < 0.5 && late / n < 0.5)) ? '꾸준' : (early >= late ? '스타터' : '피니셔');
  const style = (stage >= growth && stage >= steady * 0.5) ? '무대' : (growth > steady * 0.6 ? '성장' : '성실');
  return PLAY_STYLES[rhythm + style] || PLAY_STYLES['꾸준성실'];
}
function playStyleHtml_(ps) {
  return '<div style="background:linear-gradient(135deg,#EEF2FF,#F5F3FF);border:2px solid #C4B5FD;border-radius:14px;padding:10px 12px;"><div style="font-size:11px;color:#6B7280;">🧭 이번 달 나의 플레이 스타일</div><div style="font-size:16px;font-weight:800;padding:2px 0;">' + ps[0] + ' ' + ps[1] + '</div><div style="font-size:12px;color:#4338CA;">' + ps[2] + '</div></div>';
}

// [v9.12] 🔮 오늘의 시냅스 운세 — 결정론(이름+날짜), 절반은 행동 유도를 운세로 포장
const FORTUNES = [
  '오늘은 발표 운이 강한 날 ✨ 손을 드는 순간 왕관이 한 뼘 가까워져요','숙제 요정이 지켜보는 날 📝 완료 도장이 평소보다 반짝여요',
  '친구에게 배운 걸 설명해 주면 두 배로 기억되는 날 🤝','오늘 외운 단어 하나가 다음 시험에 그대로 나올 예감 🎯',
  '선생님과 눈이 마주치는 순간 정답이 떠오르는 날 👀','보스가 유난히 네 데미지를 무서워하는 날 ⚔️',
  '조용히 앉아만 있어도 시냅스가 스스로 연결되는 날 🧠','질문 하나가 반 전체를 구하는 날 🙋 부끄러워하지 마세요',
  '오늘 틀린 문제는 내일의 필살기가 되는 날 💪','몬스터가 네 발음을 따라 하고 싶어 하는 날 🗣️',
  '한국어로 혼잣말하면 행운이 붙는 날 🍀','짝꿍과의 협동 운 최고조 — 같이 하면 뭐든 되는 날 👯',
  '평소보다 딱 5분만 더 — 그 5분이 진화를 앞당기는 날 ⏰','노트 정리 운이 빛나는 날 ✏️ 오늘의 필기는 보물이 돼요',
  '몬스터가 네 필통을 부러워하는 날 ✏️','급식(간식) 먹고 외우면 두 배로 외워지는 날 🍙',
  '오늘 처음 보는 단어와 친구가 될 운명의 날 📖','창밖을 봐도 좋아요 — 쉼표가 있어야 문장이 완성되니까 ☁️',
  '작은 목소리도 크게 들리는 날 🎤 자신 있게!','어제의 나보다 딱 1P 더 — 그게 오늘의 미션 🎯',
  '몬스터가 아침부터 기분이 좋아 콧노래를 불러요 🎵','지우개를 잃어버려도 웃어넘기면 행운이 오는 날 😄',
  '오늘 배운 문법이 꿈에 나올 확률 87% 💤','한국 노래 한 곡이 오늘의 최고 선생님이 되는 날 🎧',
  '리그 상대가 네 이름만 들어도 긴장하는 날 🔥','도감의 다음 몬스터가 너를 살짝 훔쳐보는 날 👻',
  '오늘 웃으면 시냅스가 두 배로 튼튼해져요 😊','실수 운? 아니요, 실험 운이 들어온 날 🧪',
  '가장 어려운 문제를 먼저 풀면 나머지가 술술 풀리는 날 🗝️','친구의 좋은 점을 하나 말해 주면 너에게 두 개가 돌아오는 날 💐',
  '오늘의 별자리: 시냅스자리 — 연결의 기운이 가득해요 ⭐','책상 정리 운 상승 — 깨끗한 책상에 왕관이 내려앉아요 👑',
  '평소 안 쓰던 표현 하나에 도전하면 대박이 나는 날 🎲','몬스터가 "오늘 주인님 멋질 예정"이라고 예언했어요 🔮',
  '물 한 잔 마시고 시작하면 집중력 만렙이 되는 날 💧','오늘의 한 걸음이 스토리북의 한 문장이 되는 날 📖'];

// [v9.12] 🌱 몬스터의 한마디 — 상태 × 성장 단계 말투(1-2 아기말 · 3-5 친구말 · 6-7 현자말)
const SPEAK = {
  today: [
    ['왔다! 왔다! 오늘도 가치(같이) 크는 거야? 🐣','주인님 냄새다! 오늘도 붙어 있을래 🥚','헤헤, 기다렸어! 오늘은 뭐 배워? 🍼'],
    ['왔구나! 네 발소리만 듣고도 알았어 😊','기다렸어 — 오늘도 같이 자라자 🌱','네가 오면 교실이 2도쯤 밝아지는 거 알아? ✨'],
    ['어서 오게. 오늘의 배움도 그대와 함께라면 축제라네 ✨','기다리고 있었네 — 오늘은 어떤 지혜를 모아 볼까 📜','그대가 문을 여는 순간, 나의 하루도 시작된다네 👑']],
  miss3: [
    ['창밖만 보고 이떠(있어)… 주인님 자리는 내가 지키는 중! 🐣','오늘도 문 소리마다 고개를 들었어… 보고 시퍼(싶어) 🥺','주인님 책상에 먼지 못 앉게 후후 불고 있어!'],
    ['창밖만 보고 있어… 네 자리는 늘 여기 있어 🌱','네 목소리가 그리운 날이야 — 돌아오면 제일 먼저 반겨 줄게','괜찮아, 천천히 와도 돼. 나 여기서 튼튼하게 기다릴게 💪'],
    ['그대의 빈자리에도 배움의 불씨는 꺼지지 않게 지키고 있네 🕯️','기다림도 수행이라네 — 하지만 그대가 오면 더 좋겠군','그대가 돌아올 길을 밝혀 두었네. 서두르지 않아도 좋아 ✨']],
  miss7: [
    ['주인님이 준 포인트 꼭 안고 씩씩하게 기다리는 중! 돌아오면 제일 먼저 안아 줄 거야 🤗','알 속에서도 주인님 응원해! 언제든 돌아와 🥚'],
    ['네가 쌓아 둔 포인트, 하나도 안 사라지고 여기 있어 — 언제든 이어서 가자 🌱','오래 못 봐도 우린 한 팀이야. 문은 항상 열려 있어 🚪'],
    ['먼 길을 돌아오는 것도 여정의 일부라네 — 그대의 기록은 영원히 이곳에 있네 📜','별은 잠시 구름에 가려도 빛을 잃지 않는 법이지 ⭐']],
  evosoon: ['몸이 근질근질… 곧 뭔가 일어날 것 같아! (다음 진화까지 {n}P) ⚡','껍질이(몸이) 간지러워! 조금만 더! (진화까지 {n}P) 🔥','변화의 기운이 차오르고 있네… 앞으로 {n}P라네 ✨'],
  crown: ['오늘 왕관 쓴 모습, 세상에서 제일 멋졌어 👑 밤새 자랑할 거야','왕관이 주인을 알아봤네 — 눈부셨다네 👑','네 머리 위 왕관, 내가 제일 먼저 봤다! 👑'],
  bday: ['오늘은 주인공의 날! 내가 세상에서 제일 먼저 축하해 🎂🎉','생일 축하하네 — 그대가 태어나 나도 태어날 수 있었지 🎂'],
  idle: [
    ['오늘은 구름 구경 중 ☁️ 주인님은 뭐 해?','시냅스 씨앗 심는 연습 하고 이떠(있어) 🌱','하품 크게 하고 기지개! 오늘도 화이팅 🐣'],
    ['월요일은 몬스터도 살짝 졸려… 같이 힘내 보자 ☀️','오늘 급식(간식) 뭐야? 나도 궁금해 🍙','네 필통 속에서 낮잠 자는 상상했어 😴'],
    ['고요한 날에도 시냅스는 자라는 법이라네 🍃','오늘의 바람에서 가을 냄새가 나는군 — 배움하기 좋은 날씨야','천천히 가도 괜찮네. 방향이 맞다면 말일세 🧭']]
};
// [v9.16] 💬 학부모 대화 카드 — 몽골어 질문 로테이션 (아이에게 이렇게 물어보세요)
const PARENT_Q = [
  '«Өнөөдөр юу сурсан бэ? Надад зааж өгөөч!» (오늘 뭐 배웠어? 나한테 가르쳐줘!)',
  '«{t} гэдгийг ашиглаад нэг өгүүлбэр хэлээд өгөөч!» (그 표현으로 문장 하나 만들어줘!)',
  '«Өнөөдөр багш чамайг юу гэж магтсан бэ?» (오늘 선생님이 뭐라고 칭찬하셨어?)',
  '«Солонгос хэлээр надад мэндлээд үзээч!» (한국어로 나한테 인사해줘!)'
];

function speakTone_(idx) { return idx <= 2 ? 0 : (idx <= 5 ? 1 : 2); }
function hashPick_(arr, seedStr) { let h = 0; for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) % 100000; return arr[h % arr.length]; }

// [v9.11] 🖼️ 액자 시스템 — 도달 최고 단계(AP)가 액자 등급. 스킨은 취향, 액자는 지위.
const FRAME_CSS = [
  ['새싹 액자','background:#E9E7F5;padding:6px;border-radius:16px;'],
  ['스파크 액자','background:linear-gradient(135deg,#BFDBFE,#93C5FD);padding:7px;border-radius:16px;'],
  ['링크 액자','background:linear-gradient(135deg,#A5B4FC,#7DD3FC);padding:7px;border-radius:18px;'],
  ['서킷 액자','background:linear-gradient(135deg,#4338CA,#06B6D4);padding:8px;border-radius:18px;'],
  ['불씨 액자','background:linear-gradient(135deg,#B91C1C,#F5A623);padding:8px;border-radius:20px;'],
  ['빛의 액자','background:linear-gradient(135deg,#F5F3FF,#C4B5FD,#F5A623);padding:9px;border-radius:20px;'],
  ['왕관 액자','background:linear-gradient(135deg,#F5A623,#FDE68A,#B45309);padding:10px;border-radius:22px;']
];
const FRAME_ICON = ['🌱','⚡','🔗','💡','🕯️','✨','👑'];
function buildMonsterFrame_(dispName, dispImg, apIdx) {
  const f = FRAME_CSS[Math.min(Math.max(apIdx - 1, 0), 6)];
  const ic = FRAME_ICON[Math.min(Math.max(apIdx - 1, 0), 6)];
  const inner = dispImg && dispImg.indexOf('http') === 0
    ? '<img src="' + dispImg + '" style="width:100%;border-radius:12px;display:block;background:#fff;"/>'
    : '<div style="background:#fff;border-radius:12px;text-align:center;font-size:64px;padding:28px 0;">' + ic + '</div>';
  return '<div style="' + f[1] + '">' + inner +
    '<div style="text-align:center;font-size:12px;padding:5px 0 1px;color:#fff;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,.25);">' +
    ic + ' ' + f[0] + ' · ' + dispName + '</div></div>';
}

// [v9.14] 📊 월간 경영 리포트 — 숫자로 보는 SYNK (매월 1일, 원장 메일 즉발 + 원장 탭 상설)
function buildExecReport_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const ym = Utilities.formatDate(lastM, tz, 'yyyy-MM');
  const st = ensureSheet(ss, 'app_state', ['key','value']);
  const doneKey = '경영리포트발송_' + ym;
  const stData = st.getLastRow() < 2 ? [] : st.getRange(2, 1, st.getLastRow() - 1, 2).getValues();
  if (stData.some(r => String(r[0]) === doneKey)) return; // 멱등
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return;
  const stu = {}; let total = 0;
  pf.getRange(2, 1, pf.getLastRow() - 1, 63).getValues().forEach(r => {
    if (!r[0] || r[3] !== 'student') return;
    total++;
    stu[r[0]] = { c: String(r[4] || ''), sig: String(r[62] || '🟢').slice(0, 2) };
  });
  const active = {}, crowns = { n: 0 }, raids = { n: 0 };
  const plE = ss.getSheetByName('point_logs');
  if (plE && plE.getLastRow() >= 2) plE.getRange(2, 1, plE.getLastRow() - 1, 6).getValues().forEach(r => {
    if (!r[1] || !r[5] || dstr(r[5], tz).indexOf(ym) !== 0) return;
    const rs = String(r[3] || '');
    if ((Number(r[2]) || 0) > 0) active[r[1]] = 1;
    if (rs === '오늘의 MVP' || rs === '오늘의 시냅스') crowns.n++;
    if (rs === '레이드보상') raids.n++;
  });
  const actN = Object.keys(active).filter(sid => stu[sid]).length;
  const actPct = total ? Math.round(actN / total * 100) : 0;
  const byCls = {};
  Object.keys(stu).forEach(sid => {
    const cn = stu[sid].c || '미배정';
    byCls[cn] = byCls[cn] || { t: 0, a: 0 };
    byCls[cn].t++;
    if (active[sid]) byCls[cn].a++;
  });
  const clsRank = Object.keys(byCls).map(cn => ({ cn: cn, pct: Math.round(byCls[cn].a / byCls[cn].t * 100) })).sort((a, b) => b.pct - a.pct);
  let red = 0, yellow = 0;
  Object.keys(stu).forEach(sid => { if (stu[sid].sig === '🔴') red++; else if (stu[sid].sig === '🟡') yellow++; });
  const issueRow = ss.getSheetByName('synk_stories');
  const issued = issueRow && issueRow.getLastRow() >= 2 && issueRow.getRange(2, 1, issueRow.getLastRow() - 1, 1).getValues().some(r => String(r[0]) === ym);
  const mNum = lastM.getMonth() + 1;
  const lines = [
    '📊 SYNK 경영 리포트 — ' + mNum + '월',
    '재적 학생: ' + total + '명',
    '월간 활성률: ' + actPct + '% (' + actN + '명이 포인트 활동)',
    '반 참여 온도 TOP: ' + clsRank.slice(0, 3).map(x => x.cn + ' ' + x.pct + '%').join(' · '),
    (clsRank.length > 3 ? '관심 필요 반: ' + clsRank[clsRank.length - 1].cn + ' ' + clsRank[clsRank.length - 1].pct + '%' : ''),
    '이탈 레이더 현황: 🔴 ' + red + '명 · 🟡 ' + yellow + '명',
    '이달의 하이라이트: 👑 왕관 ' + crowns.n + '회 · ⚔️ 레이드 보상 ' + raids.n + '건 · 📖 싱크 스토리 ' + (issued ? '발간 완료' : '발간 예정')
  ].filter(String);
  const html = '<div style="background:#fff;border:2px solid #C7D2FE;border-radius:14px;padding:12px 14px;font-size:13px;line-height:2;">' + lines.map((l, i) => i === 0 ? '<b style="font-size:14px;">' + l + '</b>' : l).join('<br/>') + '</div>';
  setAppState_(ss, '경영리포트HTML', html);
  setAppState_(ss, doneKey, Utilities.formatDate(now, tz, 'yyyy-MM-dd'));
  if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 📊 ' + mNum + '월 경영 리포트', lines.join('\n'));
  Logger.log('경영 리포트 ' + ym + ' 발송');
}

// [v9.14] app_state 키-값 갱신 헬퍼 (변경 시에만 쓰기)
function setAppState_(ss, key, val) {
  const st = ensureSheet(ss, 'app_state', ['key','value']);
  const data = st.getLastRow() < 2 ? [] : st.getRange(2, 1, st.getLastRow() - 1, 2).getValues();
  let found = -1;
  data.forEach((r, i) => { if (String(r[0]) === key) found = i + 2; });
  if (found > 0) { if (String(st.getRange(found, 2).getValue()) !== String(val)) st.getRange(found, 2).setValue(val); }
  else st.getRange(st.getLastRow() + 1, 1, 1, 2).setValues([[key, val]]);
}

function calcAll() {
  // [v9.15] 프로필·반통계 양쪽에서 쓰는 공유 집계 — 함수 최상단 선언
  const blindList = [], crownSetM = {}, clsBday = {}, clsAbsent = {}, clsEvoSoon = {};
  const raidLeft = {}, yAttCls = {}, yAttSid = {}, tdActs = {}, tdTopic = {};
  const topicRecent = {}, weekTopicsCls = {}, weekAtt = {}, weekPts = {}, weekCrown = {}; // [v9.16]
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const todayYmd0 = Utilities.formatDate(now, tz, 'yyyy-MM-dd'); // [v9.15] TDZ 수리 — 사용처보다 앞으로
  const thisMonth = Utilities.formatDate(now, tz, 'yyyy-MM');
  const todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const msPerDay = 86400000;

  const pl = ss.getSheetByName('point_logs');
  const pf = ss.getSheetByName('profiles');
  const at = ss.getSheetByName('attendance');
  const ct = ss.getSheetByName('contents');
  const co = ss.getSheetByName('carryover');
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);

  const plLast = pl.getLastRow();
  const plData = plLast >= 2 ? pl.getRange(2, 1, plLast - 1, 6).getValues() : [];
  const pfLast = pf.getLastRow();
  const pfData = pfLast >= 2 ? pf.getRange(2, 1, pfLast - 1, 15).getValues() : [];
  const atLast = at.getLastRow();
  const atData = atLast >= 2 ? at.getRange(2, 1, atLast - 1, 4).getValues() : [];
  const ctLast = ct.getLastRow();
  const ctData = ctLast >= 2 ? ct.getRange(2, 1, ctLast - 1, 6).getValues() : [];

  // --- point_logs 빈칸 보정 (Glide 버튼 대비) ---
  let blanks = 0;
  plData.forEach(r => { if (r[1] && !r[0]) blanks++; });
  if (blanks > 0) {
    const ids = reservePlIds(ss, blanks);
    let k = 0, fixed = false;
    plData.forEach(r => {
      if (r[1] && !r[0]) { r[0] = ids[k++]; fixed = true; }
      if (r[1] && !r[5]) { r[5] = now; fixed = true; }
    });
    if (fixed) pl.getRange(2, 1, plData.length, 6).setValues(plData);
  } else {
    let fixed = false;
    plData.forEach(r => { if (r[1] && !r[5]) { r[5] = now; fixed = true; } });
    if (fixed) pl.getRange(2, 1, plData.length, 6).setValues(plData);
  }

  const ymCol = plData.map(r => [r[5] ? dstr(r[5], tz, 'yyyy-MM') : '']);
  if (plData.length) {
    if (pl.getRange('G1').getValue() !== '연월') pl.getRange('G1').setValue('연월');
    writeIfChanged(pl, 2, 7, ymCol);
  }

  // --- 집계 (이월잔액 포함) ---
  const total = {}, bal = {}, monthly = {}, praise = {}; // [v7.1] total=획득 누계(진화·랭킹) · bal=잔액(스토어)
  if (co && co.getLastRow() >= 2) {
    co.getRange(2, 1, co.getLastRow() - 1, 3).getValues().forEach(r => { // [v7.1] 3열(earned)
      if (!r[0]) return;
      bal[r[0]] = Number(r[1]) || 0;
      total[r[0]] = (r[2] !== '' && r[2] !== null && r[2] !== undefined)
        ? (Number(r[2]) || 0) : (Number(r[1]) || 0); // 구형 2열 이월은 net=earned로 폴백
    });
  }
  const lastPtD = {}; // [v7.7]
  plData.forEach((r, i) => {
    const sid = r[1], pts = Number(r[2]) || 0, ym = ymCol[i][0];
    if (!sid) return;
    bal[sid] = (bal[sid] || 0) + pts; // 잔액: 전 행 합산 (구매 차감 포함)
    // [v7.1] 성장·월간·랭킹은 "번 것" 기준: 양수 + 정정(오지급 취소) 음수만 반영, 스토어 소비는 제외
    const isEarn = pts > 0 || String(r[3]).indexOf('정정') > -1;
    if (isEarn) total[sid] = (total[sid] || 0) + pts;
    if (pts > 0 && r[5]) { // [v7.7] 마지막 포인트일 (무포인트 경보용)
      const dP = (r[5] instanceof Date) ? r[5] : new Date(r[5]);
      if (!lastPtD[sid] || dP.getTime() > lastPtD[sid]) lastPtD[sid] = dP.getTime();
    }
    if (ym === thisMonth && isEarn) {
      monthly[sid] = (monthly[sid] || 0) + pts;
      if ((String(r[3]).indexOf('칭찬') > -1 || String(r[3]).indexOf('시냅스') > -1) && String(r[3]).indexOf('정정') === -1) praise[sid] = (praise[sid] || 0) + 1; // [v7.6]
    }
  });

  // --- 몬스터 ---
  const stages = [];
  ctData.forEach(r => {
    if (r[1] === 'monster') stages.push({ name: r[2], th: Number(r[5]) || 0, img: String(r[4] || '') }); // [v9.11] 이미지
  });
  stages.sort((a, b) => a.th - b.th);
  function monsterOf(pts) {
    let cur = stages[0] || { name: '', th: 0 }, next = null, curIdx = 0; // [v6.6] idx
    for (let i = 0; i < stages.length; i++) {
      if (pts >= stages[i].th) { cur = stages[i]; curIdx = i; }
      else { next = stages[i]; break; }
    }
    let pct = 100, rem = 0; // [v5] rem: 다음 진화까지 남은 포인트
    if (next) {
      const span = next.th - cur.th;
      pct = span > 0 ? Math.max(0, Math.min(100, Math.floor(((pts - cur.th) / span) * 100))) : 0;
      rem = Math.max(next.th - pts, 0);
    }
    return { stage: cur.name, pct: pct, rem: rem, idx: curIdx + 1 }; // [v6.6] 1~7단계 번호
  }

  // --- 출석 ---
  const attDates = {}, lastAtt = {};
  atData.forEach(r => {
    const sid = r[1]; const d = r[2];
    if (!sid || !d) return;
    const ds = dstr(d, tz);
    if (!attDates[sid]) attDates[sid] = new Set();
    attDates[sid].add(ds);
    if (!lastAtt[sid] || ds > lastAtt[sid]) lastAtt[sid] = ds;
  });
  // [v5.1] 연속출석 = 수업일 기준 (평일반은 주말을 건너뜀 → 주말에 스트릭이 끊기지 않음)
  const schMapAll = scheduleMap(ss);
  const classTypeOf = {};
  pfData.forEach(r => {
    if (!r[0]) return;
    const e = schedOf(schMapAll, r[4]); // [v8.3]
    classTypeOf[r[0]] = e ? e.type : '';
  });
  function isClassDayOf(sid, d) {
    const t = classTypeOf[sid];
    if (!t) return true; // 시간표 미등록 반은 기존(달력일) 방식 유지
    const we = (d.getDay() === 0 || d.getDay() === 6);
    return (t === '주말') === we;
  }
  const dayFmtCache = {}; // [v5.3] formatDate 메모 — 120명 × 최대 370일 반복 호출을 캐시로 절감
  function fmtDay(d) {
    const k = d.getTime();
    if (!dayFmtCache[k]) dayFmtCache[k] = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    return dayFmtCache[k];
  }
  function streakOf(sid) {
    const set = attDates[sid];
    if (!set) return 0;
    let streak = 0, guard = 0;
    const d = new Date(now);
    if (isClassDayOf(sid, d) && !set.has(fmtDay(d))) {
      d.setDate(d.getDate() - 1); // 오늘 수업인데 아직 출석 전이면 어제부터
    }
    while (guard++ < 370) {
      if (!isClassDayOf(sid, d)) { d.setDate(d.getDate() - 1); continue; }
      if (!set.has(fmtDay(d))) break;
      streak++; d.setDate(d.getDate() - 1);
    }
    return streak;
  }
  function monthAttOf(sid) {
    const set = attDates[sid];
    if (!set) return 0;
    let c = 0;
    set.forEach(ds => { if (ds.startsWith(thisMonth)) c++; });
    return c;
  }

  // --- 칭호 로드 (최신 월 titles + manual, AC 중앙관리) ---
  const titleOf = {};
  const tt = ss.getSheetByName('titles');
  if (tt && tt.getLastRow() >= 2) {
    const tData = tt.getRange(2, 1, tt.getLastRow() - 1, 3).getValues();
    let latest = '';
    tData.forEach(r => { if (String(r[0]) > latest) latest = String(r[0]); });
    tData.forEach(r => {
      if (String(r[0]) !== latest || !r[1]) return;
      if (!titleOf[r[1]]) titleOf[r[1]] = [];
      titleOf[r[1]].push(r[2]);
    });
  }
  const mt = ss.getSheetByName('manual_titles');
  if (mt && mt.getLastRow() >= 2) {
    mt.getRange(2, 1, mt.getLastRow() - 1, 2).getValues().forEach(r => {
      if (!r[0] || !r[1]) return;
      if (!titleOf[r[0]]) titleOf[r[0]] = [];
      titleOf[r[0]].push(r[1]);
    });
  }

  // --- profiles P~Y + AB(최고스트릭) + AC(현재칭호) + [v5] AE~AG ---
  if (pfData.length) {
    writeIfChanged(pf, 1, 16, [[
      '누적잔액','월간포인트','월간랭킹','몬스터단계','진화진행률',
      '연속출석','이번달출석','마지막출석일','이번달칭찬','이탈위험'
    ]]);
    if (pf.getRange('AB1').getValue() !== '최고스트릭') pf.getRange('AB1').setValue('최고스트릭');
    if (pf.getRange('AC1').getValue() !== '현재칭호') pf.getRange('AC1').setValue('현재칭호');
    // [v5] 게이지 헤더 3종
    if (pf.getRange('AE1').getValue() !== '시냅스게이지') pf.getRange('AE1').setValue('시냅스게이지');
    if (pf.getRange('AF1').getValue() !== '게이지문구') pf.getRange('AF1').setValue('게이지문구');
    if (pf.getRange('AG1').getValue() !== '다음진화까지') pf.getRange('AG1').setValue('다음진화까지');
    // [v5.1] 대표칭호·칭호등급 헤더
    if (pf.getRange('AH1').getValue() !== '대표칭호') pf.getRange('AH1').setValue('대표칭호');
    if (pf.getRange('AI1').getValue() !== '칭호등급') pf.getRange('AI1').setValue('칭호등급');
    if (pf.getRange('AJ1').getValue() !== '반유형') pf.getRange('AJ1').setValue('반유형'); // [v5.8]
    // [v6.6] 열 부족 자동 확장 (AP=42열까지) — 좁은 시트에서 헤더 쓰기 오류 방지
    if (pf.getMaxColumns() < 50) pf.insertColumnsAfter(pf.getMaxColumns(), 50 - pf.getMaxColumns()); // [v7.7] AX까지
    // [v6.5] 사용자 기록 전용 열 — 스크립트는 값을 절대 안 쓰고 헤더만 보장 (Glide 오타 방지)
    if (pf.getRange('AE1').getValue() !== '(구)게이지') pf.getRange('AE1').setValue('(구)게이지'); // [v7.9] 은퇴
    if (pf.getRange('AF1').getValue() !== '(구)게이지문구') pf.getRange('AF1').setValue('(구)게이지문구');
    if (pf.getRange('AK1').getValue() !== '착용칭호') pf.getRange('AK1').setValue('착용칭호');
    if (pf.getRange('AL1').getValue() !== '(구)리포트확인월') pf.getRange('AL1').setValue('(구)리포트확인월'); // [v7.9] 은퇴
    if (pf.getRange('AO1').getValue() !== '몬스터이름') pf.getRange('AO1').setValue('몬스터이름');
    if (pf.getRange('AP1').getValue() !== '단계번호') pf.getRange('AP1').setValue('단계번호'); // [v6.6]
    if (pf.getRange('AQ1').getValue() !== '잔액') pf.getRange('AQ1').setValue('잔액'); // [v7.1] P열=획득 누계(진화), AQ=잔액(스토어)
    // [v7.3] AR = 사용자 기록 전용(스토어 목표 찜 — Glide Set Column, 스크립트는 값 안 씀)
    if (pf.getRange('AR1').getValue() !== '목표아이템') pf.getRange('AR1').setValue('목표아이템');
    if (pf.getRange('AS1').getValue() !== '최고월간기록') pf.getRange('AS1').setValue('최고월간기록'); // [v7.3] 자기 경신
    if (pf.getRange('AT1').getValue() !== '최고기록월') pf.getRange('AT1').setValue('최고기록월');
    if (pf.getRange('AU1').getValue() !== '이달의스토리') pf.getRange('AU1').setValue('이달의스토리'); // [v7.3] 학부모·여정 표시
    if (pf.getRange('AV1').getValue() !== '마지막포인트일') pf.getRange('AV1').setValue('마지막포인트일'); // [v7.7]
    if (pf.getRange('AW1').getValue() !== 'MVP누적') pf.getRange('AW1').setValue('MVP누적'); // [v7.7] 왕관 컬렉션
    if (pf.getRange('AX1').getValue() !== '시냅스누적') pf.getRange('AX1').setValue('시냅스누적');

    const sorted = pfData.map(r => ({ id: r[0], m: monthly[r[0]] || 0 }))
                         .sort((a, b) => b.m - a.m);
    const rankMap = {};
    sorted.forEach((s, i) => {
      if (s.m <= 0) { rankMap[s.id] = 999; return; }
      rankMap[s.id] = (i > 0 && s.m === sorted[i-1].m) ? rankMap[sorted[i-1].id] : i + 1;
    });

    const prevAB = pf.getRange(2, 28, pfData.length, 1).getValues();
    const evoRemOut = [], stageNumOut = [], balOut = []; // [v7.9] 게이지 2열 은퇴(진행바 T열로 단일화)
    const evoDateOut = []; // [v9.0]
    const prevAP = pfData.length ? pf.getRange(2, 42, pfData.length, 1).getValues() : [];
    const prevBB = (pfData.length && pf.getMaxColumns() >= 54) ? pf.getRange(2, 54, pfData.length, 1).getValues() : [];
  const prevBC = (pfData.length && pf.getMaxColumns() >= 55) ? pf.getRange(2, 55, pfData.length, 1).getValues() : []; // [v9.11]
  const skinOut = [], frameOut = [];
  const fortuneOut = [], speakOut = [], recordOut = []; // [v9.12]
  const styleOut = [], chemOut = [], matchOut = []; // [v9.13]
  const weeklyOut = [], talkOut = [], bannerOut = []; // [v9.16]
  const clsB2 = {}; // sid→반 (주간 분모용)
  const radarOut = [], radarList = []; // [v9.14] (공유 변수는 함수 최상단으로 승격)
  pfData.forEach(rr => { if (rr[0] && rr[3] === 'student') clsB2[rr[0]] = String(rr[4] || ''); }); // [v9.16]
  { // [v9.15] 강사 팩 재료 — 어제 출석·이번 주 레이드 잔량·오늘 활동·오늘 배운 내용
    const yD = new Date(now); yD.setDate(now.getDate() - 1);
    const yYmd = dstr(yD, tz);
    const atY = ss.getSheetByName('attendance');
    if (atY && atY.getLastRow() >= 2) atY.getRange(2, 1, atY.getLastRow() - 1, 3).getValues().forEach(rr => {
      if (rr[1] && rr[2] && dstr(rr[2], tz) === yYmd) yAttSid[rr[1]] = 1;
    });
    const rdT = ss.getSheetByName('raid');
    if (rdT && rdT.getLastRow() >= 2) {
      const mondayT = new Date(now); mondayT.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const wkT = dstr(mondayT, tz);
      rdT.getRange(2, 1, rdT.getLastRow() - 1, 6).getValues().forEach(rr => {
        if (String(rr[0]) === wkT && rr[1] && String(rr[5] || rr[4] || '') !== '격파')
          raidLeft[String(rr[1])] = Math.max((Number(rr[2]) || 0) - (Number(rr[3]) || 0), 0);
      });
    }
    const tpT = ss.getSheetByName('weekly_topics');
    if (tpT && tpT.getLastRow() >= 2) tpT.getRange(2, 1, tpT.getLastRow() - 1, 5).getValues().forEach(rr => {
      if (!rr[0] || !rr[3]) return;
      const d6t = dstr(rr[3], tz);
      if (d6t === todayYmd0) tdTopic[String(rr[0])] = 1;
      const gapT = Math.floor((new Date(todayYmd0) - new Date(d6t)) / msPerDay);
      if (gapT >= 0 && gapT <= 7) {
        const cur = topicRecent[String(rr[0])];
        if (!cur || d6t > cur.d) topicRecent[String(rr[0])] = { d: d6t, ko: String(rr[1] || ''), mn: String(rr[4] || ''), today: d6t === todayYmd0 };
        if (gapT === 0 || (gapT <= 7)) (weekTopicsCls[String(rr[0])] = weekTopicsCls[String(rr[0])] || []).push(String(rr[1] || ''));
      }
    });
    { // 이번 주(월~오늘) 개인 출석·포인트·왕관 + 반별 수업일
      const mondayW = new Date(now); mondayW.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const wkStart = dstr(mondayW, tz);
      const atW = ss.getSheetByName('attendance');
      if (atW && atW.getLastRow() >= 2) atW.getRange(2, 1, atW.getLastRow() - 1, 3).getValues().forEach(rr => {
        if (!rr[1] || !rr[2]) return;
        const d6w = dstr(rr[2], tz);
        if (d6w >= wkStart && d6w <= todayYmd0) {
          (weekAtt[rr[1]] = weekAtt[rr[1]] || {})[d6w] = 1;
        }
      });
      const plW = ss.getSheetByName('point_logs');
      if (plW && plW.getLastRow() >= 2) plW.getRange(2, 1, plW.getLastRow() - 1, 6).getValues().forEach(rr => {
        const sid = rr[1], pts = Number(rr[2]) || 0, rs = String(rr[3] || '');
        if (!sid || !rr[5] || pts <= 0) return;
        const d6w = dstr(rr[5], tz);
        if (d6w < wkStart || d6w > todayYmd0) return;
        weekPts[sid] = (weekPts[sid] || 0) + pts;
        if (rs === '오늘의 MVP' || rs === '오늘의 시냅스') weekCrown[sid] = (weekCrown[sid] || 0) + 1;
      });
    }
  }
  const styleLogs = {}, chemi = {}, matchupByCls = {};
  { // [v9.13] 스타일 로그(이번 달 pl)
    const plY = ss.getSheetByName('point_logs');
    if (plY && plY.getLastRow() >= 2) plY.getRange(2, 1, plY.getLastRow() - 1, 6).getValues().forEach(rr => {
      const sid = rr[1], pts = Number(rr[2]) || 0;
      if (!sid || !rr[5] || pts <= 0) return;
      const d6 = dstr(rr[5], tz);
      if (d6.indexOf(thisMonth) !== 0) return;
      (styleLogs[sid] = styleLogs[sid] || []).push({ d: parseInt(d6.slice(8), 10), rs: String(rr[3] || ''), pts: pts });
    });
  }
  { // [v9.13] 케미 — 같은 반, 이번 달 공통 출석일 최다 (동점 = 이름순)
    const atC = ss.getSheetByName('attendance');
    const byDay = {};
    if (atC && atC.getLastRow() >= 2) atC.getRange(2, 1, atC.getLastRow() - 1, 3).getValues().forEach(rr => {
      if (!rr[1] || !rr[2]) return;
      const d6 = dstr(rr[2], tz);
      if (d6.indexOf(thisMonth) !== 0) return;
      (byDay[rr[1]] = byDay[rr[1]] || {})[d6] = 1;
    });
    const clsGroups = {};
    pfData.forEach(rr => { if (rr[0] && rr[3] === 'student' && rr[4]) (clsGroups[rr[4]] = clsGroups[rr[4]] || []).push({ id: rr[0], nm: rr[1] || rr[0] }); });
    Object.keys(clsGroups).forEach(cn => {
      const g = clsGroups[cn];
      g.forEach(a => {
        let best = null;
        g.forEach(b => {
          if (a.id === b.id) return;
          const da = byDay[a.id] || {}, db = byDay[b.id] || {};
          let c = 0;
          Object.keys(da).forEach(d6 => { if (db[d6]) c++; });
          if (c > 0 && (!best || c > best.c || (c === best.c && b.nm < best.n))) best = { n: b.nm, c: c };
        });
        if (best) chemi[a.id] = best;
      });
    });
  }
  { // [v9.13] ⚔️ 매치업 프리뷰 — 엣지 방어: 미발표·부전·첫 대결·진행 중·무활동 상대·양방향
    const lgM = ss.getSheetByName('league_pairs');
    if (lgM && lgM.getLastRow() >= 2) {
      const mondayM = new Date(now); mondayM.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const wkM = dstr(mondayM, tz);
      const allP = lgM.getRange(2, 1, lgM.getLastRow() - 1, 5).getValues();
      const hist = {};
      allP.forEach(rr => {
        const res = String(rr[4] || '');
        const mW = res.match(/^(.+?) 승 /);
        if (!mW) return;
        const key = [String(rr[1]), String(rr[2])].sort().join('|');
        hist[key] = hist[key] || {};
        hist[key][mW[1].trim()] = (hist[key][mW[1].trim()] || 0) + 1;
      });
      const topByCls = {};
      pfData.forEach(rr => {
        if (!rr[0] || rr[3] !== 'student' || !rr[4]) return;
        const tot = (styleLogs[rr[0]] || []).reduce((a2, l) => a2 + l.pts, 0);
        if (tot > 0 && (!topByCls[rr[4]] || tot > topByCls[rr[4]].p)) topByCls[rr[4]] = { n: rr[1] || rr[0], p: tot };
      });
      allP.forEach(rr => {
        if (String(rr[0]) !== wkM) return;
        [[String(rr[1]), String(rr[2])], [String(rr[2]), String(rr[1])]].forEach(pair => {
          const me = pair[0], opp = pair[1];
          if (!me) return;
          if (!opp || opp.indexOf('부전') > -1 || opp.indexOf('🏖') > -1) {
            matchupByCls[me] = '🏖️ 이번 주는 재정비 주간 — 다음 매치를 준비해요';
            return;
          }
          const key = [me, opp].sort().join('|');
          const h = hist[key] || {};
          const myW = h[me] || 0, opW = h[opp] || 0;
          const vs = (myW + opW === 0) ? '첫 만남! 새 역사의 시작' : '전적 우리 ' + myW + '승 vs 상대 ' + opW + '승';
          const ace = topByCls[opp];
          matchupByCls[me] = '⚔️ 이번 주 상대: <b>' + opp + '</b> · ' + vs + (ace ? ' · 경계 대상: ' + ace.n : '');
        });
      });
    }
  }
  const crownDates = {}, records = {};
  { // 기록실 사전 집계 — 첫 왕관일·레이드 참여(pl 스캔), 최고 월간(스냅샷), 최장 연속(출석 스캔)
    const plR = ss.getSheetByName('point_logs');
    if (plR && plR.getLastRow() >= 2) plR.getRange(2, 1, plR.getLastRow() - 1, 6).getValues().forEach(rr => {
      const sid = rr[1], rs = String(rr[3] || ''), d6 = rr[5] ? dstr(rr[5], tz) : '';
      if (!sid || !d6) return;
      const rec = records[sid] = records[sid] || {};
      if (rs === '오늘의 MVP' || rs === '오늘의 시냅스') {
        if (!rec.firstCrown || d6 < rec.firstCrown) rec.firstCrown = d6;
        if (d6 > (crownDates[sid] || '')) crownDates[sid] = d6;
        if (d6.indexOf(thisMonth) === 0) crownSetM[sid] = 1; // [v9.15] 이번 달 왕관 수혜
      }
      if (rs === '레이드보상' || rs === '월드레이드') rec.raids = (rec.raids || 0) + 1;
      const gapP = Math.floor((new Date(Utilities.formatDate(now, tz, 'yyyy-MM-dd')) - new Date(d6)) / msPerDay);
      if (rr[2] > 0) { if (gapP >= 0 && gapP < 14) rec.p14 = (rec.p14 || 0) + Number(rr[2]); else if (gapP >= 14 && gapP < 28) rec.pPrev14 = (rec.pPrev14 || 0) + Number(rr[2]); }
    });
    const msR = ss.getSheetByName('monthly_snapshot');
    if (msR && msR.getLastRow() >= 2) msR.getRange(2, 1, msR.getLastRow() - 1, 3).getValues().forEach(rr => {
      if (!rr[1]) return;
      const rec = records[rr[1]] = records[rr[1]] || {};
      if ((Number(rr[2]) || 0) > (rec.bestMonth || 0)) rec.bestMonth = Number(rr[2]) || 0;
    });
    const atR = ss.getSheetByName('attendance');
    const byS = {};
    if (atR && atR.getLastRow() >= 2) atR.getRange(2, 1, atR.getLastRow() - 1, 3).getValues().forEach(rr => {
      if (rr[1] && rr[2]) (byS[rr[1]] = byS[rr[1]] || {})[dstr(rr[2], tz)] = 1;
    });
    Object.keys(byS).forEach(sid => {
      const dNow = new Date(todayYmd0 || Utilities.formatDate(now, tz, 'yyyy-MM-dd'));
      let a14 = 0, aPrev14 = 0;
      Object.keys(byS[sid]).forEach(d6 => {
        const gap = Math.floor((dNow - new Date(d6)) / msPerDay);
        if (gap >= 0 && gap < 14) a14++; else if (gap >= 14 && gap < 28) aPrev14++;
      });
      (records[sid] = records[sid] || {}).a14 = a14;
      records[sid].aPrev14 = aPrev14;
      const days = Object.keys(byS[sid]).sort();
      let best = 0, cur = 0, prev = '';
      days.forEach(d6 => {
        cur = (prev && (new Date(d6) - new Date(prev)) === msPerDay) ? cur + 1 : 1;
        if (cur > best) best = cur;
        prev = d6;
      });
      (records[sid] = records[sid] || {}).maxStreak = best;
    });
  }
    const todayYmd = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
    const out = pfData.map((r, idx) => {
      const id = r[0], t = total[id] || 0, mon = monsterOf(t);
      const la = lastAtt[id] || '';
      const daysSince = la ? Math.floor((now - new Date(la)) / msPerDay) : 999;
      const p = praise[id] || 0, mPts = monthly[id] || 0;
      const stk = streakOf(id), matt = monthAttOf(id); // [v5] 기존 계산을 변수로 추출
      let risk = '하';
      if (daysSince >= 14) risk = '상 (' + (la ? daysSince + '일 미출석' : '출석기록 없음') + ')';
      else if (lastPtD[id] && Math.floor((now - lastPtD[id]) / msPerDay) >= QUIET_DAYS)
        risk = '중 (' + Math.floor((now - lastPtD[id]) / msPerDay) + '일 무포인트)'; // [v7.7]
      else if (p === 0 && mPts <= 0) risk = '중 (인정 0회·포인트 정체)'; // [v7.6]
      // [v5] 시냅스 게이지: 연속출석 30% + 월간포인트 40% + 월출석 30%
      evoRemOut.push([mon.rem]);
      stageNumOut.push([mon.idx || 1]); // [v6.6] 단계번호 — 강사 대시보드 진화 카운트용
      { // [v9.11] 대표몬스터 스킨(BC=55) — 도달한 단계만 유효, 초과 선택은 자동 무효화
        const iE2 = stageNumOut.length - 1;
        const pick = String((prevBC[iE2] && prevBC[iE2][0]) || '').trim();
        let disp = { name: mon.stage, img: (stages.find(s2 => s2.name === mon.stage) || {}).img || '' };
        let bcOut = '';
        if (pick) {
          const pk = stages.find(s2 => s2.name === pick);
          if (pk && t >= pk.th) { disp = { name: pk.name, img: pk.img }; bcOut = pick; } // 유효 — 유지
        }
        skinOut.push([bcOut]);
        frameOut.push([buildMonsterFrame_(disp.name, disp.img, mon.idx || 1)]);
      }
      { // [v9.12] 운세·몬스터의 한마디·기록실
        fortuneOut.push(['🔮 ' + hashPick_(FORTUNES, id + todayYmd)]);
        const tone = speakTone_(mon.idx || 1);
        const isBday = String(r[5] || '').slice(5, 10) === todayYmd.slice(5, 10);
        const crownToday = (crownDates[id] || '') === todayYmd;
        const toNext = mon.rem || 0; // [v9.15] rem = 다음 진화까지 남은 P (next는 객체 — 잠복버그 수리)
        let line;
        if (isBday) line = hashPick_(SPEAK.bday, id + todayYmd);
        else if (crownToday) line = hashPick_(SPEAK.crown, id + todayYmd);
        else if (toNext > 0 && toNext <= 30) line = hashPick_(SPEAK.evosoon, id + todayYmd).replace('{n}', toNext);
        else if (la && lastAtt[id] === todayYmd) line = hashPick_(SPEAK.today[tone], id + todayYmd);
        else if (daysSince >= 7 && daysSince < 999) line = hashPick_(SPEAK.miss7[Math.min(tone, SPEAK.miss7.length - 1)], id + todayYmd);
        else if (daysSince >= 3 && daysSince < 7) line = hashPick_(SPEAK.miss3[tone], id + todayYmd);
        else line = hashPick_(SPEAK.idle[tone], id + todayYmd);
        { // [v9.15] 강사 팩 반별 수집
          const cn5 = String(r[4] || '');
          if (cn5) {
            if (isBday) (clsBday[cn5] = clsBday[cn5] || []).push(r[1] || id);
            if (yAttSid[id]) yAttCls[cn5] = 1;
            else if (daysSince < 999) (clsAbsent[cn5] = clsAbsent[cn5] || []).push(r[1] || id);
            if (toNext > 0 && toNext <= 10) (clsEvoSoon[cn5] = clsEvoSoon[cn5] || []).push({ n: r[1] || id, need: toNext });
            (styleLogs[id] || []).forEach(l => {
              if (l.d !== parseInt(todayYmd0.slice(8), 10)) return;
              const ta = tdActs[cn5] = tdActs[cn5] || {};
              if (l.rs === '숙제완료') ta.hw = 1;
              if (l.rs === '오늘의 MVP') ta.mvp = 1;
              if (l.rs === '오늘의 시냅스') ta.syn = 1;
            });
          }
        }
        speakOut.push(['<div style="background:#F5F3FF;border:2px solid #C4B5FD;border-radius:14px;padding:9px 12px;font-size:13px;">💬 ' + line + '</div>']);
        styleOut.push([playStyleHtml_(playStyleOf_(styleLogs[id] || []))]);
        const chemP = chemi[id];
        chemOut.push([chemP
          ? '🤝 이번 달 최고의 케미: <b>' + chemP.n + '</b> (' + chemP.c + '일 동행)'
          : '🐺 이번 달은 솔로 플레이 중 — 다음 달의 케미를 기대해요']);
        matchOut.push([matchupByCls[String(r[4] || '')] || '']);
        { // [v9.14] 📡 리텐션 신호 — 추세 기반 🟢🟡🔴
          const rec2 = records[id] || {};
          const joinD = r[14] ? Math.floor((now - new Date(r[14])) / msPerDay) : 999;
          const attDrop = (rec2.aPrev14 || 0) >= 2 && (rec2.a14 || 0) <= (rec2.aPrev14 || 0) / 2;
          const ptDrop = (rec2.pPrev14 || 0) >= 20 && (rec2.p14 || 0) <= (rec2.pPrev14 || 0) / 2;
          let sig, why;
          if (daysSince === 999 && joinD < 14) { sig = '🟢'; why = '적응 중'; }
          else if (daysSince === 999 && joinD >= 14) { sig = '🟡'; why = '출석 기록 없음 — 확인 필요'; }
          else if (daysSince >= 7 && daysSince < 999) { sig = '🔴'; why = daysSince + '일 연속 미출석'; }
          else if (attDrop && ptDrop) { sig = '🔴'; why = '출석·포인트 동반 하락'; }
          else if (daysSince >= 4 && daysSince < 7) { sig = '🟡'; why = daysSince + '일째 안 보여요'; }
          else if (attDrop || ptDrop) { sig = '🟡'; why = attDrop ? '출석 추세 하락' : '포인트 추세 하락'; }
          else if (joinD >= 14 && joinD < 45 && !rec2.firstCrown) { sig = '🟡'; why = '신입 — 아직 첫 왕관 전'; }
          else { sig = '🟢'; why = ''; }
          radarOut.push([sig + (why ? ' ' + why : '')]);
          if (sig !== '🟢') radarList.push({ s: sig, n: r[1] || id, c: String(r[4] || ''), w: why });
          if ((rec2.a14 || 0) >= 1 && daysSince < 4) {
            const lastP = lastPtD[id] ? Math.floor((now - lastPtD[id]) / msPerDay) : 999;
            if (lastP >= 14) blindList.push({ n: r[1] || id, c: String(r[4] || ''), d: lastP === 999 ? '기록 없음' : lastP + '일' });
          }
        }
        { // [v9.16] 👨‍👩‍👧 학부모 3종 — 몽골어 우선
          const cn6 = String(r[4] || '');
          const wAtt = Object.keys(weekAtt[id] || {}).length;
          const wDaysCls = {};
          Object.keys(weekAtt).forEach(sid2 => { if (clsB2[sid2] === cn6) Object.keys(weekAtt[sid2]).forEach(d6 => wDaysCls[d6] = 1); });
          const wDen = Math.max(Object.keys(wDaysCls).length, wAtt);
          const wTop = (weekTopicsCls[cn6] || []).slice(-3);
          weeklyOut.push(['<div style="background:#fff;border:2px solid #C7D2FE;border-radius:14px;padding:10px 12px;font-size:12.5px;line-height:2;"><b style="font-size:13.5px;">📋 Долоо хоногийн тайлан <span style="color:#9CA3AF;font-weight:400;">· 주간 리포트</span></b><br/>✅ Ирц: <b>' + wAtt + '/' + (wDen || '-') + '</b> өдөр<br/>⚡ Оноо: <b>+' + (weekPts[id] || 0) + 'P</b> · 👑 Титэм: <b>' + (weekCrown[id] || 0) + '</b> удаа' + (wTop.length ? '<br/>📚 Сурсан зүйл: ' + wTop.join(' · ') : '') + '</div>']);
          const tp = topicRecent[cn6];
          if (tp) {
            const q = hashPick_(PARENT_Q, id + todayYmd0).replace('{t}', tp.ko);
            talkOut.push(['<div style="background:linear-gradient(135deg,#FFF7ED,#FEF3C7);border:2px solid #FDE68A;border-radius:14px;padding:10px 12px;font-size:12.5px;line-height:1.95;"><b style="font-size:13.5px;">💬 Өнөөдрийн яриа <span style="color:#9CA3AF;font-weight:400;">· 오늘의 대화</span></b><br/>' + (tp.today ? 'Өнөөдөр' : 'Сүүлийн хичээлээр') + ' хүүхэд тань <b>«' + tp.ko + '»</b>' + (tp.mn ? ' (' + tp.mn + ')' : '') + ' сурсан.<br/>Хүүхдээсээ ингэж асуугаарай:<br/><b>' + q + '</b></div>']);
          } else {
            talkOut.push(['<div style="background:#F9FAFB;border:2px dashed #E5E7EB;border-radius:14px;padding:10px 12px;font-size:12px;color:#6B7280;">💬 Дараагийн хичээлийн дараа энд ярианы сэдэв гарч ирнэ (다음 수업 후 대화 주제가 여기에)</div>']);
          }
          const evoStr6 = (prevBB[idx] && String(prevBB[idx][0] || '')) || '';
          const evoRecent = evoStr6 && (new Date(todayYmd0) - new Date(evoStr6.slice(0, 10))) / msPerDay <= 3;
          const crownToday2 = (crownDates[id] || '') === todayYmd0;
          bannerOut.push([crownToday2
            ? '<div style="background:linear-gradient(135deg,#FDE68A,#F5A623);border-radius:14px;padding:10px 12px;font-size:13px;font-weight:700;">🎉 ' + (r[1] || id) + ' өнөөдөр титэм авлаа! Гэртээ магтаж өгөөрэй 💛<br/><span style="font-weight:400;font-size:11px;">오늘 왕관을 받았어요! 집에서 칭찬해 주세요</span></div>'
            : (evoRecent
              ? '<div style="background:linear-gradient(135deg,#C4B5FD,#A5B4FC);border-radius:14px;padding:10px 12px;font-size:13px;font-weight:700;color:#fff;">⚡ ' + (r[1] || id) + '-ийн монстр шинэ шатанд хувьслаа! Түүхэн мөч 📸<br/><span style="font-weight:400;font-size:11px;">몬스터가 진화했어요! 역사적인 순간</span></div>'
              : '')]);
        }
        const rec = records[id] || {};
        recordOut.push(['<div style="background:#fff;border:2px solid #E9E7F5;border-radius:14px;padding:10px 12px;font-size:13px;line-height:1.9;">📊 <b>나의 기록실</b><br/>🔥 최장 연속출석 <b>' + (rec.maxStreak || stk) + '일</b><br/>🏔️ 최고 월간 포인트 <b>' + (rec.bestMonth || mPts) + 'P</b><br/>👑 첫 왕관 <b>' + (rec.firstCrown || '이번 달이 기회!') + '</b><br/>⚔️ 보스 토벌 참여 <b>' + (rec.raids || 0) + '회</b><br/>📚 총 누적 <b>' + t + 'P</b></div>']);
      }
      { // [v9.0] 진화 순간 감지 → BB(54) 진화일 (상승만, 신규생 첫 계산 제외)
        const iE = stageNumOut.length - 1;
        const prevN = Number(prevAP[iE] && prevAP[iE][0]) || 0;
        const newN = mon.idx || 1;
        evoDateOut.push([(prevN >= 1 && newN > prevN) ? todayYmd : ((prevBB[iE] && prevBB[iE][0]) || '')]);
      }
      balOut.push([bal[id] || 0]); // [v7.1] 잔액(AQ) — 스토어 결제 기준
      return [t, mPts, rankMap[id] === 999 ? '' : (rankMap[id] || ''), mon.stage, mon.pct,
              stk, matt, la, p, risk];
    });
    writeIfChanged(pf, 2, 16, out);
    if (pf.getMaxColumns() < 66) pf.insertColumnsAfter(pf.getMaxColumns(), 66 - pf.getMaxColumns()); // [v9.16]
    if (String(pf.getRange('BB1').getValue()) !== '진화일') pf.getRange('BB1').setValue('진화일');
    if (String(pf.getRange('BC1').getValue()) !== '대표몬스터') pf.getRange('BC1').setValue('대표몬스터');
    if (String(pf.getRange('BD1').getValue()) !== '액자HTML') pf.getRange('BD1').setValue('액자HTML');
    if (String(pf.getRange('BE1').getValue()) !== '오늘의운세') pf.getRange('BE1').setValue('오늘의운세');
    if (String(pf.getRange('BF1').getValue()) !== '몬스터한마디') pf.getRange('BF1').setValue('몬스터한마디');
    if (String(pf.getRange('BG1').getValue()) !== '기록실HTML') pf.getRange('BG1').setValue('기록실HTML');
    writeIfChanged(pf, 2, 54, evoDateOut);
    writeIfChanged(pf, 2, 55, skinOut);   // 무효 선택 자동 클리어 · 유효는 유지
    writeIfChanged(pf, 2, 56, frameOut);  // 스킨 이미지 × AP 액자 합성 — Glide는 Rich Text 1개
    writeIfChanged(pf, 2, 57, fortuneOut); // [v9.12] 🔮
    writeIfChanged(pf, 2, 58, speakOut);   // [v9.12] 💬 말풍선
    writeIfChanged(pf, 2, 59, recordOut);  // [v9.12] 📊
    if (String(pf.getRange('BH1').getValue()) !== '플레이스타일') pf.getRange('BH1').setValue('플레이스타일');
    if (String(pf.getRange('BI1').getValue()) !== '시냅스케미') pf.getRange('BI1').setValue('시냅스케미');
    if (String(pf.getRange('BJ1').getValue()) !== '매치업프리뷰') pf.getRange('BJ1').setValue('매치업프리뷰');
    writeIfChanged(pf, 2, 60, styleOut);
    writeIfChanged(pf, 2, 61, chemOut);
    writeIfChanged(pf, 2, 62, matchOut);
    if (String(pf.getRange('BL1').getValue()) !== '주간리포트MN') pf.getRange('BL1').setValue('주간리포트MN');
    if (String(pf.getRange('BM1').getValue()) !== '대화카드MN') pf.getRange('BM1').setValue('대화카드MN');
    if (String(pf.getRange('BN1').getValue()) !== '축하배너MN') pf.getRange('BN1').setValue('축하배너MN');
    writeIfChanged(pf, 2, 64, weeklyOut); // [v9.16] 📋
    writeIfChanged(pf, 2, 65, talkOut);   // [v9.16] 💬
    writeIfChanged(pf, 2, 66, bannerOut); // [v9.16] 🎉
    if (String(pf.getRange('BK1').getValue()) !== '리텐션신호') pf.getRange('BK1').setValue('리텐션신호');
    writeIfChanged(pf, 2, 63, radarOut); // [v9.14] 📡
    { // 원장 홈 카드 2종
      radarList.sort((a2, b2) => a2.s === b2.s ? 0 : (a2.s === '🔴' ? -1 : 1));
      const rHtml = radarList.length
        ? '<div style="background:#fff;border:2px solid #FECACA;border-radius:14px;padding:10px 12px;"><div style="font-size:13px;font-weight:800;">📡 리텐션 레이더 — 관심 필요 ' + radarList.length + '명</div><div style="font-size:12px;line-height:1.9;">' + radarList.slice(0, 8).map(x => x.s + ' <b>' + x.n + '</b> (' + x.c + ') — ' + x.w).join('<br/>') + (radarList.length > 8 ? '<br/>… 외 ' + (radarList.length - 8) + '명' : '') + '</div></div>'
        : '<div style="background:#F0FDF4;border:2px solid #BBF7D0;border-radius:14px;padding:10px 12px;font-size:13px;">📡 전원 🟢 — 평화로운 항해 중입니다</div>';
      setAppState_(ss, '리텐션레이더HTML', rHtml);
      const bByCls = {};
      blindList.forEach(x => (bByCls[x.c] = bByCls[x.c] || []).push(x.n + '(' + x.d + ')'));
      const bHtml = blindList.length
        ? '<div style="background:#fff;border:2px solid #FDE68A;border-radius:14px;padding:10px 12px;"><div style="font-size:13px;font-weight:800;">👩‍🏫 케어 사각 — 출석 중인데 2주+ 무포인트</div><div style="font-size:12px;line-height:1.9;">' + Object.keys(bByCls).map(cn => '<b>' + cn + '</b>: ' + bByCls[cn].join(', ')).join('<br/>') + '</div><div style="font-size:11px;color:#6B7280;padding-top:4px;">이번 주, 이 크루들에게 왕관 기회를 한 번씩 🙏</div></div>'
        : '<div style="background:#F0FDF4;border:2px solid #BBF7D0;border-radius:14px;padding:10px 12px;font-size:13px;">👩‍🏫 사각지대 없음 — 모든 크루가 케어받는 중 ✨</div>';
      setAppState_(ss, '케어사각HTML', bHtml);
    }

    const abOut = pfData.map((r, i) =>
      [Math.max(out[i][5], Number(prevAB[i][0]) || 0)]);
    writeIfChanged(pf, 2, 28, abOut);

    // [v5.1] 칭호를 등급 높은 순으로 정렬 → 제일 화려한 칭호가 앞에
    const acOut = [], badgeOut = [], tierOut = [];
    pfData.forEach(r => {
      const ts = (titleOf[r[0]] || []).slice().sort((a, b) => rarityOf(b) - rarityOf(a));
      acOut.push([ts.join(' · ')]);
      badgeOut.push([ts[0] || '']);
      tierOut.push([ts.length ? TIER_LABEL[rarityOf(ts[0])] : '']);
    });
    writeIfChanged(pf, 2, 29, acOut);

    // [v5] 게이지 3열 기록 (writeIfChanged라 변화 없으면 쓰기 0)
    writeIfChanged(pf, 2, 33, evoRemOut);
    // [v5.1] 대표칭호(AH)·칭호등급(AI) — Glide에서 배지/태그로 표시
    writeIfChanged(pf, 2, 34, badgeOut);
    writeIfChanged(pf, 2, 35, tierOut);
    // [v5.8] 반유형(AJ) — 평일/주말 (Glide ITE가 오늘의숙제 vs 주말의숙제 선택)
    writeIfChanged(pf, 2, 36, pfData.map(r => [classTypeOf[r[0]] || '평일']));
    // [v6.6] 단계번호(AP) — Glide Rollup(단계번호−1 합)으로 "우리 반 누적 진화 🐲" 계산
    writeIfChanged(pf, 2, 42, stageNumOut);
    writeIfChanged(pf, 2, 43, balOut); // [v7.1] AQ 잔액
    // [v7.7] AV 마지막포인트일 (무포인트 경보용)
    const lastPtOut = pfData.map(r => {
      const lp = lastPtD[r[0]];
      return [lp ? Utilities.formatDate(new Date(lp), tz, 'yyyy-MM-dd') : ''];
    });
    writeIfChanged(pf, 2, 48, lastPtOut);
  }

  // --- class_stats ---
  const cls = {};
  pfData.forEach(r => {
    const c = r[4];
    if (!c || r[3] !== 'student') return;
    if (!cls[c]) cls[c] = { n: 0, total: 0, monthly: 0, att: 0 };
    cls[c].n++;
    cls[c].total += total[r[0]] || 0;
    cls[c].monthly += monthly[r[0]] || 0;
    cls[c].att += monthAttOf(r[0]);
  });
  function classMonster(pts, n) {
    let cur = stages[0] ? stages[0].name : '';
    stages.forEach(s => { if (pts >= s.th * Math.max(n, 1)) cur = s.name; });
    return cur;
  }
  // [v7.3] 반주간데미지 = 학생 주간 양수 포인트 + 연료 (raidFriday와 동일 산식, 14·22시 갱신)
  const mondayW = new Date(now);
  mondayW.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  mondayW.setHours(0, 0, 0, 0);
  const clsOfW = {};
  pfData.forEach(r => { if (r[0] && r[3] === 'student' && r[4]) clsOfW[r[0]] = r[4]; });
  const weekDmg = {};
  plData.forEach(r => {
    const sid = r[1], pts = Number(r[2]) || 0, d = r[5];
    const isE = pts > 0 || String(r[3] || '').indexOf('정정') > -1; // [v7.4]
    if (!sid || !d || !isE || pts === 0 || !clsOfW[sid]) return;
    const dd = (d instanceof Date) ? d : new Date(d);
    if (dd >= mondayW) weekDmg[clsOfW[sid]] = (weekDmg[clsOfW[sid]] || 0) + pts;
  });
  const fuelMapW = {};
  ctData.forEach(r => { if (r[1] === 'fuel' && r[2]) fuelMapW[String(r[2])] = Number(r[5]) || 0; });
  const cfW = ss.getSheetByName('class_fuel');
  const fSeenW = new Set(); // [v7.5]
  if (cfW && cfW.getLastRow() >= 2) {
    cfW.getRange(2, 1, cfW.getLastRow() - 1, 4).getValues().forEach(r => {
      const m = String(r[1] || ''), d = r[3];
      if (!r[0] || !d || !fuelMapW[m]) return;
      const dd = (d instanceof Date) ? d : new Date(d);
      if (dd >= mondayW && !fSeenW.has(r[0] + '|' + m)) {
        fSeenW.add(r[0] + '|' + m);
        weekDmg[r[0]] = (weekDmg[r[0]] || 0) + fuelMapW[m];
      }
    });
  }
  ensureSheet(ss, 'hall_of_fame', ['연도','이름','반','업적','한마디','사진URL']); // [v7.8] 졸업생 명예의 전당 — 원장이 Glide 폼으로 행 추가
  const cs = ensureSheet(ss, 'class_stats',
    ['class_name','학생수','반누적포인트','반월간포인트','반몬스터','이번달출석합','반주간데미지','주간평균']);
  if (cs.getRange(1, 7).getValue() !== '반주간데미지') cs.getRange(1, 7).setValue('반주간데미지'); // [v7.3]
  if (cs.getMaxColumns() < 8) cs.insertColumnsAfter(cs.getMaxColumns(), 8 - cs.getMaxColumns()); // [v9.1]
  if (cs.getRange(1, 8).getValue() !== '주간평균') cs.getRange(1, 8).setValue('주간평균'); // [v9.1] 리그 판정 기준(1인당)
  const csOut = Object.keys(cls).sort().map(c => {
    const v = cls[c];
    const wdC = weekDmg[c] || 0;
    return [c, v.n, v.total, v.monthly, classMonster(v.total, v.n), v.att, wdC, v.n ? Math.round(wdC / v.n * 10) / 10 : 0]; // [v9.1] 8열 주간평균
  });
  const csLast = cs.getLastRow();
  if (csLast - 1 > csOut.length) {
    cs.getRange(csOut.length + 2, 1, csLast - 1 - csOut.length, 8).clearContent(); // [v9.1]
  }
  { // [v9.6] 🌍 월드 레이드 누적 — 전 학생 이번 달 획득 총합
    const wrC = ss.getSheetByName('world_raid');
    if (wrC && wrC.getLastRow() >= 2) {
      let totalM = 0;
      Object.keys(monthly).forEach(k => { totalM += Math.max(monthly[k] || 0, 0); });
      const wrData = wrC.getRange(2, 1, wrC.getLastRow() - 1, 5).getValues();
      wrData.forEach((r, i) => {
        if (String(r[0]) === thisMonth && String(r[4]) === '진행중')
          writeIfChanged(wrC, i + 2, 4, [[totalM]]);
      });
    }
  }
  if (csOut.length) writeIfChanged(cs, 2, 1, csOut);
  { // [v9.15] 🧑‍🏫 강사 팩 4열 — 브리핑·격파 찬스·오늘 체크·왕관 밸런스
    ['수업전브리핑','격파찬스','오늘체크','왕관밸런스'].forEach((h, i) => {
      if (String(cs.getRange(1, 9 + i).getValue()) !== h) cs.getRange(1, 9 + i, 1, 1).setValue(h);
    });
    const blindByCls = {};
    blindList.forEach(x => (blindByCls[x.c] = blindByCls[x.c] || []).push(x.n));
    const crewCols = Object.keys(cls).sort().map(c => {
      const v = cls[c];
      const parts = [];
      if ((clsBday[c] || []).length) parts.push('🎂 오늘 생일: <b>' + clsBday[c].join(', ') + '</b>');
      if (yAttCls[c] && (clsAbsent[c] || []).length) parts.push('📵 어제 결석: ' + clsAbsent[c].slice(0, 5).join(', ') + ' — 오늘 오면 한마디 챙겨주세요');
      if ((blindByCls[c] || []).length) parts.push('👩‍🏫 케어 사각: ' + blindByCls[c].join(', '));
      (clsEvoSoon[c] || []).slice(0, 3).forEach(e => parts.push('⚡ <b>' + e.n + '</b> — 오늘 왕관(10P)이면 <b>진화</b>! (남은 ' + e.need + 'P)'));
      const brief = '<div style="background:#fff;border:2px solid #C7D2FE;border-radius:14px;padding:10px 12px;font-size:12px;line-height:1.9;"><b style="font-size:13px;">🎬 오늘의 ' + c + '</b><br/>' + (parts.length ? parts.join('<br/>') : '오늘도 평화로운 교실 ✨ 좋은 수업 되세요!') + '</div>';
      const left = raidLeft[c];
      const chance = (left !== undefined && left > 0 && left <= v.n * 10)
        ? '<div style="background:linear-gradient(135deg,#FEF3C7,#FDE68A);border:2px solid #F5A623;border-radius:14px;padding:9px 12px;font-size:12px;">🐉 <b>오늘 격파 가능!</b> 남은 HP ' + left + ' — 전원이 숙제 하나씩이면 끝!</div>' : '';
      const ta = tdActs[c] || {};
      const ck = it => it ? '✅' : '⏳';
      const check = '<div style="background:#fff;border:2px solid #E9E7F5;border-radius:14px;padding:9px 12px;font-size:12px;line-height:1.9;"><b style="font-size:13px;">✅ 오늘 체크 — ' + c + '</b><br/>' + ck(ta.hw) + ' 숙제 처리 · ' + ck(ta.mvp) + ' MVP 왕관 · ' + ck(ta.syn) + ' 시냅스 왕관 · ' + ck(tdTopic[c]) + ' 배운 내용 입력</div>';
      const members = [];
      pfData.forEach(rr => { if (rr[0] && rr[3] === 'student' && String(rr[4]) === c) members.push({ id: rr[0], n: rr[1] || rr[0] }); });
      const got = members.filter(m => crownSetM[m.id]);
      const notYet = members.filter(m => !crownSetM[m.id]).map(m => m.n);
      const bal = '<div style="background:#fff;border:2px solid #FDE68A;border-radius:14px;padding:9px 12px;font-size:12px;line-height:1.9;"><b style="font-size:13px;">👑 이번 달 왕관 밸런스 — ' + c + '</b><br/>' + got.length + '/' + members.length + '명 수혜' + (notYet.length ? '<br/>아직: ' + notYet.slice(0, 6).join(', ') + (notYet.length > 6 ? ' 외 ' + (notYet.length - 6) + '명' : '') : ' — 전원 수혜 달성! 🎉') + '</div>';
      return [brief, chance, check, bal];
    });
    if (crewCols.length) writeIfChanged(cs, 2, 9, crewCols);
  }

  // --- app_state: 학생수/신규감지 --- ([v7.9] 명언·브레인팁 카드 폐지 — 시선 분산 제거)
  // [v5.3] 기준일을 Script Properties로 이전 — app_state 시트 쓰기(월 ~30업데이트) 제거
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('기준일') !== todayStr) {
    // [v5.7] 오늘의 시냅스 퀴즈 — 1행("문제|정답")만 기록, Glide Split Text로 분리 표시
    const quizPool = ctData.filter(r => r[1] === 'quiz' && r[3]);
    if (quizPool.length) {
      const q = quizPool[Math.floor(now / msPerDay) % quizPool.length];
      setState(st, '오늘의퀴즈', q[3]);
    }
    const tipPool = ctData.filter(r => r[1] === 'braintip' && r[2]); // [v8.6] 오늘의 시냅스 팁
    if (tipPool.length) {
      const tp = tipPool[Math.floor(now / msPerDay) % tipPool.length];
      setState(st, '오늘의팁', String(tp[2]));
    }
    if (quizPool.length) props.setProperty('기준일', todayStr);
  }
  // [v5.6] 오늘의 숙제 — 수업이 끝난 저녁(21시 이후) 자동 일괄 게시. 강사 손 불필요.
  //        "오늘 배운 ○○" 프롬프트가 실제 오늘 수업을 가리키도록 아침이 아닌 밤에 갱신.
  //        ⚠️ calcAll 트리거에 21~23시 실행이 반드시 1개 필요 (applyLowUpdateMode의 22시가 담당)
  const hourNow = Number(Utilities.formatDate(now, tz, 'H'));
  if (hourNow >= 21 && props.getProperty('숙제기준일') !== todayStr) {
    const hwPool = ctData.filter(r => r[1] === 'homework' && r[3] && Number(r[5]) > 0);
    if (hwPool.length) {
      const wd = now.getDay() === 0 ? 7 : now.getDay(); // 월1 ~ 일7
      let todays = hwPool.filter(r => Math.floor(Number(r[5]) / 100) === wd);
      if (!todays.length) todays = hwPool;
      const wk = Number(Utilities.formatDate(now, tz, 'w')) || 1;
      const hw = todays[wk % todays.length];
      // [v5.8] 반 유형 분리 — 평일 키는 월~금만 갱신(금요일 숙제가 주말 내내 유지 → 월요일 검사 1개),
      //        토·일은 주말반 전용 키(주말의숙제*)만 갱신 → 평일반에 주말 숙제 미발행
      if (wd <= 5) {
        setState(st, '오늘의숙제유형', hw[2]);
        setState(st, '오늘의숙제', hw[3]);
        setState(st, '오늘의숙제팁', hw[4] || '');
      } else {
        setState(st, '주말의숙제유형', hw[2]);
        setState(st, '주말의숙제', hw[3]);
        setState(st, '주말의숙제팁', hw[4] || '');
      }
      props.setProperty('숙제기준일', todayStr);
    }
  }
  const count = pfData.filter(r => r[0]).length;
  const prevG = getState(st, '학생수');
  const prev = prevG.row > 0 ? (Number(prevG.val) || 0) : -1;
  if (prev === -1) setState(st, '학생수', count);
  else if (count > prev) {
    const names = pfData.slice(prev).filter(r => r[0])
      .map(r => r[0] + ' ' + r[1]).join(', ');
    adminMail('[SYNK] 신규 학생 ' + (count - prev) + '명 등록',
      '새로 등록된 학생: ' + names + '\n\n상담 배정을 진행해주세요.'); // [v5.4] 브리핑 통합
    setState(st, '학생수', count);
  } else if (count !== prev) setState(st, '학생수', count);

  try { calcAcademic_(); } catch (e) { Logger.log('calcAcademic_ 스킵: ' + e); } // [v9.18] 학업 성장 축 — 같은 사이클 편승·오류 격리
  Logger.log('calcAll v5 완료');
}

/* ===================== 상담시트 → profiles 동기화 ===================== */

function syncProfiles() {
  try { // [v8.2] 상담시트 미연결·권한 오류에도 앱 본체는 무사
  const book = SpreadsheetApp.openById(CONSULT_SHEET_ID);
  const src = book.getSheetByName('상담데이터입력');
  const paySh = book.getSheetByName('수강·납입'); // [v8.3] 수강료·재원상태 조인
  const payFee = {}, payStatus = {};
  if (paySh && paySh.getLastRow() >= 5) {
    paySh.getRange(5, 1, paySh.getLastRow() - 4, 11).getValues().forEach(pr => {
      if (pr[0]) { payFee[pr[0]] = pr[4] || ''; payStatus[pr[0]] = String(pr[10] || ''); }
    });
  }
  const dst = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('profiles');

  const lastRow = src.getLastRow();
  if (lastRow < 3) { Logger.log('데이터 없음'); return; }
  const data = src.getRange(3, 1, lastRow - 2, 62).getValues(); // [v8.3] v18.1 = 62열

  const dstLast = dst.getLastRow();
  const keep = {};
  const nonStudents = []; // [v7.0] teacher/parent/admin 행 보존 — 기존엔 매 동기화마다 지워지던 결함
  if (dstLast >= 2) {
    dst.getRange(2, 1, dstLast - 1, 26).getValues().forEach(r => {
      if (!r[0]) return;
      keep[r[0]] = { parent_of: r[9] || '', pEmail: r[25] || '' };
      if (r[3] && r[3] !== 'student') nonStudents.push(r.slice(0, 15));
    });
  }

  const now = new Date();
  const out = [], lvlOut = [], riskOut = [], visionOut = []; // [v8.5] 디테일 연동 3종
  data.forEach(row => {
    if (!row[0]) return;               // A 이름
    const userId = row[59];            // [v8.3] BH 학생ID (v18.1)
    if (!userId) return;
    if (payStatus[userId] === '퇴소') return; // [v8.3] 퇴소자는 앱 제외 (이력은 시트 보관)
    out.push([
      userId, row[0], row[1], 'student', row[3], row[4],
      row[9], row[7], row[8],
      (keep[userId] ? keep[userId].parent_of : ''),
      payFee[userId] || '', row[2], row[12], row[14], now
    ]);
    lvlOut.push([row[18] || '']);    // S 한국어수준 → AY(51): 강사 뷰 '레벨'
    riskOut.push([row[60] || '']);   // BI ⚠위험신호 → AZ(52): 원장 콕핏 전용
    visionOut.push([row[21] || '']); // V 핵심비전 → BA(53): 케어 대화용 한 줄
  });

  nonStudents.forEach(r => out.push(r)); // [v7.0] 학생 뒤에 비학생 행 재기록
  // [v9.19] 안전 가드 — 상담시트에 학생이 0명이면 기존 profiles 학생을 덮어쓰지 않음
  //          (빈/오연결/신규 상담시트가 원본일 때 실학생 대량 삭제 방지 · 백업 복구 이전에 예방)
  if (out.filter(r => r[3] === 'student').length === 0 && dstLast > 1) {
    Logger.log('syncProfiles 중단: 상담시트 학생 0명 — 기존 profiles 보호(덮어쓰기 안 함)');
    return;
  }
  if (dstLast > 1) dst.getRange(2, 1, dstLast - 1, 15).clearContent();
  if (out.length > 0) {
    dst.getRange(2, 1, out.length, 15).setValues(out);
    const zOut = out.map(r => [keep[r[0]] ? keep[r[0]].pEmail : '']);
    dst.getRange(2, 26, zOut.length, 1).setValues(zOut);

    // [v8.5] 디테일 3종 → AY·AZ·BA (계산열 50 이후 안전 지대)
    if (dst.getMaxColumns() < 53) dst.insertColumnsAfter(dst.getMaxColumns(), 53 - dst.getMaxColumns());
    if (String(dst.getRange('AY1').getValue()) !== '한국어수준') dst.getRange('AY1').setValue('한국어수준');
    if (String(dst.getRange('AZ1').getValue()) !== '⚠상담위험') dst.getRange('AZ1').setValue('⚠상담위험');
    if (String(dst.getRange('BA1').getValue()) !== '핵심비전') dst.getRange('BA1').setValue('핵심비전');
    if (dstLast > 1) dst.getRange(2, 51, dstLast - 1, 3).clearContent();
    if (lvlOut.length) {
      const trio = lvlOut.map((v, i) => [v[0], riskOut[i][0], visionOut[i][0]]); // [v8.7] 3열 1회 쓰기
      dst.getRange(2, 51, trio.length, 3).setValues(trio);
    }

  }
  Logger.log(out.length + '명 동기화 완료');
  calcAll();
  } catch (e) { Logger.log('syncProfiles 스킵(상담시트 연결 확인): ' + e); }
}

/* ===================== 매일 백업 (30일 보관) ===================== */

function dailyBackup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const stamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const file = DriveApp.getFileById(ss.getId());

  const it = DriveApp.getFoldersByName('SYNK_백업');
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder('SYNK_백업');
  file.makeCopy('SYNK_앱데이터_백업_' + stamp, folder);

  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (f.getName().startsWith('SYNK_앱데이터_백업_') && f.getDateCreated() < cutoff) {
      f.setTrashed(true);
    }
  }
  Logger.log('백업 완료: ' + stamp);
}

/* ===================== 알림: 미납 / 학부모 / 재등록 / 상담지연 ===================== */

function checkTuition() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pf = ss.getSheetByName('profiles');
  const last = pf.getLastRow();
  if (last < 2) return;
  const data = pf.getRange(2, 1, last - 1, 15).getValues();
  const unpaid = [];
  data.forEach(r => {
    if (r[0] && r[3] === 'student' && !r[10]) {
      unpaid.push(r[0] + ' ' + r[1] + ' (' + (r[4] || '반 미정') + ')');
    }
  });
  if (unpaid.length === 0 || !quotaOk(1)) return;
  MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 미납 ' + unpaid.length + '명 - 확인 필요',
    'SYNK 미납 현황\n\n' + unpaid.map(s => '· ' + s).join('\n') +
    '\n\n※ profiles의 tuition 칸이 비어있는 학생 기준입니다.');
  Logger.log('미납 메일: ' + unpaid.length + '명');
}

function notifyParents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');

  const pf = ss.getSheetByName('profiles');
  const pfLast = pf.getLastRow();
  if (pfLast < 2) return;
  const pfData = pf.getRange(2, 1, pfLast - 1, 26).getValues();
  const students = {};
  pfData.forEach(r => {
    if (r[0] && r[3] === 'student') {
      students[r[0]] = { name: r[1], cls: r[4] || '', pEmail: String(r[25] || '').trim() };
    }
  });

  const pl = ss.getSheetByName('point_logs');
  const plLast = pl.getLastRow();
  const todayPts = {};
  if (plLast >= 2) {
    pl.getRange(2, 1, plLast - 1, 6).getValues().forEach(r => {
      const sid = r[1], d = r[5];
      if (!sid || !d || dstr(d, tz) !== todayStr) return;
      if (!todayPts[sid]) todayPts[sid] = [];
      todayPts[sid].push({ pts: Number(r[2]) || 0, reason: r[3] || '', by: r[4] || '' });
    });
  }

  const at = ss.getSheetByName('attendance');
  const atLast = at.getLastRow();
  const todayAtt = new Set();
  if (atLast >= 2) {
    at.getRange(2, 1, atLast - 1, 3).getValues().forEach(r => {
      if (r[1] && r[2] && dstr(r[2], tz) === todayStr) todayAtt.add(r[1]);
    });
  }

  // 발송 대상 먼저 집계 (쿼터 확인용)
  const jobs = [];
  Object.keys(students).forEach(sid => {
    const s = students[sid];
    if (!s.pEmail || s.pEmail.indexOf('@') === -1) return;
    const goodPts = (todayPts[sid] || []).filter(p => p.pts > 0);
    const attended = todayAtt.has(sid);
    if (PARENT_MAIL_PRAISE && goodPts.length > 0) jobs.push({ s: s, type: 'praise', pts: goodPts, att: attended }); // [v5.4] 칭찬은 인앱 전용
    else if (PARENT_MAIL_ABSENT && !attended && hasClassToday(ss, s.cls)) jobs.push({ s: s, type: 'absent' });
  });
  if (jobs.length === 0) { Logger.log('학부모 알림 대상 없음'); return; }
  if (!quotaOk(jobs.length)) return;

  jobs.forEach(j => {
    const s = j.s;
    if (j.type === 'praise') {
      let body = s.name + ' 학생의 오늘 활동입니다 (' + todayStr + ')\n\n';
      j.pts.forEach(p => {
        body += '⭐ ' + p.reason + ' +' + p.pts + 'P' + (p.by ? ' (' + p.by + ' 선생님)' : '') + '\n';
      });
      if (j.att) body += '\n✅ 오늘 정상 출석했습니다.\n';
      body += '\n항상 ' + s.name + ' 학생을 응원해주셔서 감사합니다.\n- SYNK 학원';
      MailApp.sendEmail(s.pEmail, '[SYNK] ' + s.name + ' 학생, 오늘 칭찬받았어요! 🎉', body);
    } else {
      MailApp.sendEmail(s.pEmail, '[SYNK] ' + s.name + ' 학생 미출석 안내',
        '안녕하세요, SYNK 학원입니다.\n\n' + s.name + ' 학생이 오늘(' + todayStr +
        ') 출석 기록이 없습니다.\n혹시 사정이 있으셨다면 담당 선생님께 알려주세요.\n\n- SYNK 학원');
    }
  });
  Logger.log('학부모 알림: ' + jobs.length + '건');
}

function checkReenrollment() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');

  const pf = ss.getSheetByName('profiles');
  const last = pf.getLastRow();
  if (last < 2) return;
  const data = pf.getRange(2, 1, last - 1, 15).getValues();

  function parseReg(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    const s = String(v).replace(/\D/g, '');
    if (s.length === 8) {
      return new Date(Number(s.substring(0,4)), Number(s.substring(4,6)) - 1, Number(s.substring(6,8)));
    }
    const d = new Date(v);
    return isNaN(d) ? null : d;
  }

  const hits = [];
  data.forEach(r => {
    if (!r[0] || r[3] !== 'student') return;
    const reg = parseReg(r[11]);
    if (!reg) return;
    [3, 6, 12].forEach(m => {
      const target = new Date(reg);
      target.setMonth(target.getMonth() + m);
      if (Utilities.formatDate(target, tz, 'yyyy-MM-dd') === todayStr) {
        hits.push('· ' + r[0] + ' ' + r[1] + ' (' + (r[4] || '') + ') — ' + m + '개월차');
      }
    });
  });
  if (hits.length === 0 || !quotaOk(1)) return;
  MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 🔄 재등록 시점 학생 ' + hits.length + '명',
    '오늘 재등록 상담 시점인 학생입니다.\n\n' + hits.join('\n') +
    '\n\n재등록 안내 및 상담을 진행해주세요.');
  Logger.log('재등록 알림: ' + hits.length + '명');
}

function checkConsultDelay() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const now = new Date();
  const fr = ss.getSheetByName('form_responses');
  const last = fr.getLastRow();
  if (last < 2) { Logger.log('상담 응답 없음'); return; }
  if (fr.getRange('E1').getValue() !== '처리상태') fr.getRange('E1').setValue('처리상태');

  const data = fr.getRange(2, 1, last - 1, 5).getValues();
  const overdue = [];
  data.forEach(r => {
    const ts = r[1], status = String(r[4] || '').trim();
    if (!ts || status === '완료') return;
    const t = (ts instanceof Date) ? ts : new Date(ts);
    if (isNaN(t)) return;
    const hours = (now - t) / 3600000;
    if (hours >= 24) overdue.push('· ' + (r[2] || '(이름 미입력)') + ' — ' + Math.floor(hours) + '시간 경과');
  });
  if (overdue.length === 0) { Logger.log('지연 상담 없음'); return; }
  if (!quotaOk(1)) return;
  MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] ⏰ 미처리 상담 ' + overdue.length + '건',
    '24시간 이상 미처리 상담:\n\n' + overdue.join('\n') +
    '\n\n처리 후 form_responses의 처리상태에 "완료"를 입력하세요.');
  Logger.log('상담 지연: ' + overdue.length + '건');
}

/* ===================== 주간 리포트 ===================== */

function weeklyReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const pf = ss.getSheetByName('profiles');
  const cs = ss.getSheetByName('class_stats');
  const last = pf.getLastRow();
  if (last < 2 || !quotaOk(1)) return;

  const pfData = pf.getRange(2, 1, last - 1, 25).getValues();
  const top = pfData.filter(r => r[0] && (Number(r[16]) || 0) > 0)
    .sort((a, b) => (Number(b[16]) || 0) - (Number(a[16]) || 0)).slice(0, 3);

  let body = '📊 SYNK 주간 리포트 (' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd') + ')\n\n';
  body += '🏆 이번달 TOP 3\n';
  body += top.length ? top.map((r, i) =>
    (i + 1) + '위 ' + r[1] + ' (' + (r[4] || '') + ') - ' + r[16] + 'P').join('\n') + '\n'
    : '아직 포인트 기록 없음\n';

  body += '\n⚠️ 이탈위험 학생 (상)\n';
  const risky = pfData.filter(r => r[0] && String(r[24]).startsWith('상'));
  body += risky.length === 0 ? '없음\n'
    : risky.map(r => '· ' + r[1] + ' (' + (r[4] || '') + ') - ' + r[24]).join('\n') + '\n';

  body += '\n🏫 반별 현황\n';
  if (cs && cs.getLastRow() >= 2) {
    cs.getRange(2, 1, cs.getLastRow() - 1, 6).getValues().forEach(r => {
      body += '· ' + r[0] + ': ' + r[1] + '명, 월간 ' + r[3] + 'P, 몬스터 ' + r[4] + '\n';
    });
  }
  // [v7.7] 🔕 무포인트 경보 — 최근 QUIET_DAYS일간 포인트 0 (조용히 멀어지는 학생)
  body += '\n🔕 ' + QUIET_DAYS + '일+ 무포인트\n';
  const colsOk = pf.getMaxColumns() >= 48;
  const lpCol = colsOk ? pf.getRange(2, 48, last - 1, 1).getValues() : [];
  const nowQ = Date.now(), quiet = [];
  pfData.forEach((r, i) => {
    if (!r[0] || r[3] !== 'student') return;
    const lp = colsOk ? String(lpCol[i][0] || '') : '';
    if (!lp) { quiet.push('· ' + r[1] + ' (' + (r[4] || '') + ') — 포인트 기록 없음'); return; }
    const dq = Math.floor((nowQ - new Date(lp).getTime()) / 86400000);
    if (dq >= QUIET_DAYS) quiet.push('· ' + r[1] + ' (' + (r[4] || '') + ') — ' + dq + '일째');
  });
  body += quiet.length ? quiet.join('\n') + '\n' : '없음 — 전원이 이번 주 포인트를 받았어요 🎉\n';

  // [v7.8] 🧯 복구 리허설 경과 — 백업의 존재와 복구 능력은 다른 문제
  const stW = ss.getSheetByName('app_state');
  const drill = stW ? String(getState(stW, '복구리허설일').val || '') : '';
  const dDays = drill ? Math.floor((Date.now() - new Date(drill).getTime()) / 86400000) : -1;
  body += '\n🧯 복구 리허설: ' + (dDays < 0 ? '기록 없음 — restoreDrill을 한 번 실행해주세요 (10분, 안전)'
    : dDays + '일 전' + (dDays > 30 ? ' ⚠️ 30일 초과 — 이번 주 권장' : ' ✅')) + '\n';

  if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 주간 리포트', body);
  Logger.log('주간 리포트 발송');
}

/* ===================== 생일 자동 +20 ===================== */

function birthdayCheck() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const mmdd = Utilities.formatDate(now, tz, 'MM-dd');
  const thisYear = Utilities.formatDate(now, tz, 'yyyy');

  const pf = ss.getSheetByName('profiles');
  const pfLast = pf.getLastRow();
  if (pfLast < 2) return;
  const pfData = pf.getRange(2, 1, pfLast - 1, 26).getValues();

  function birthMMDD(v) {
    if (!v) return '';
    if (v instanceof Date) return Utilities.formatDate(v, tz, 'MM-dd');
    const s = String(v).replace(/\D/g, '');
    if (s.length === 8) return s.substring(4, 6) + '-' + s.substring(6, 8);
    return '';
  }

  const pl = ss.getSheetByName('point_logs');
  const given = new Set();
  ['point_logs', 'point_logs_archive'].forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(r => {
      if (String(r[3]) === '생일축하' && r[5] && dstr(r[5], tz, 'yyyy-MM').substring(0, 4) === thisYear) {
        given.add(r[1]);
      }
    });
  });

  const kids = pfData.filter(r =>
    r[0] && r[3] === 'student' && birthMMDD(r[5]) === mmdd && !given.has(r[0]));
  if (kids.length === 0) return;

  appendPoints(ss, kids.map(r => [r[0], 20, '생일축하', '시스템']));

  const emails = PARENT_MAIL_BIRTHDAY ? kids.filter(r => String(r[25] || '').indexOf('@') > -1) : []; // [v5.4]
  if (quotaOk(emails.length + 1)) {
    emails.forEach(r => {
      MailApp.sendEmail(String(r[25]).trim(),
        '[SYNK] 🎂 ' + r[1] + ' 학생의 생일을 축하합니다!',
        r[1] + ' 학생의 생일을 SYNK 가족 모두가 축하합니다!\n' +
        '축하 포인트 +20P를 선물로 드렸어요 🎁\n\n- SYNK 학원');
    });
    adminMail('[SYNK] 오늘 생일 ' + kids.length + '명',
      kids.map(r => '· ' + r[0] + ' ' + r[1]).join('\n') + '\n\n+20P 자동 지급 완료'); // [v5.4] 브리핑 통합
  }
  calcAll();
  Logger.log('생일 지급: ' + kids.length + '명');
}

/* ===================== 반 레이드 ===================== */

function raidMonday() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekKey = Utilities.formatDate(monday, tz, 'yyyy-MM-dd');

  const rd = ensureSheet(ss, 'raid',
    ['week', 'class_name', '목표', '달성포인트', '상태', '보상지급']);
  const rdLast = rd.getLastRow();
  if (rdLast >= 2) {
    const exists = rd.getRange(2, 1, rdLast - 1, 1).getValues()
      .some(r => dstr(r[0], tz) === weekKey);
    if (exists) { Logger.log('이번주 레이드 이미 생성됨'); return; }
  }
  const cs = ss.getSheetByName('class_stats');
  if (!cs || cs.getLastRow() < 2) return;
  // [v7.8] 🏖️ 보스 휴식 주 — 원장이 app_state '보스휴식주'에 날짜(그 주 아무 날, 쉼표로 여러 주)를 넣으면 소환 스킵
  const stR = ss.getSheetByName('app_state');
  const restRaw = stR ? String(getState(stR, '보스휴식주').val || '') : '';
  if (restRaw) {
    const tzR = ss.getSpreadsheetTimeZone();
    const nowR = new Date();
    const m0 = new Date(nowR); m0.setDate(nowR.getDate() - ((nowR.getDay() + 6) % 7)); m0.setHours(0, 0, 0, 0);
    const weekKeyR = Utilities.formatDate(m0, tzR, 'yyyy-MM-dd');
    const restKeys = restRaw.split(',').map(s => {
      const d = new Date(String(s).trim());
      if (isNaN(d.getTime())) return '';
      const w = new Date(d); w.setDate(d.getDate() - ((d.getDay() + 6) % 7)); w.setHours(0, 0, 0, 0);
      return Utilities.formatDate(w, tzR, 'yyyy-MM-dd');
    });
    if (restKeys.indexOf(weekKeyR) > -1) {
      const rsR = ensureSheet(ss, 'raid_story', ['date','class_name','유형','제목','스토리']);
      const dupR = rsR.getLastRow() >= 2 && rsR.getRange(2, 1, rsR.getLastRow() - 1, 3).getValues()
        .some(r => dstr(r[0], tzR) === weekKeyR && String(r[2]) === '휴식');
      if (!dupR) rsR.getRange(rsR.getLastRow() + 1, 1, 1, 5).setValues([[weekKeyR, '전체', '휴식', '🏖️ 보스도 방학!',
        '이번 주 보스는 온천 여행을 떠났다… 크루들도 재충전 타임! 다음 주 월요일, 새로운 보스가 돌아온다 💤']]);
      Logger.log('레이드: 보스 휴식 주(' + weekKeyR + ') — 소환 스킵');
      return;
    }
  }
  const smR = scheduleMap(ss);
  // [v7.2] 보스 HP = 반 정원 × 계수(평일 28 · 주말 18) — 정원: 반 번호 1~4 = 20명, 5번~ = 10명
  //        (대형반 560 · 소형반 280 · 주말반 180) 번호 없는 반은 실인원 폴백. 매주 같은 HP = 외울 수 있는 보스.
  const rows = (cs.getLastRow() < 2 ? [] : cs.getRange(2, 1, cs.getLastRow() - 1, 2).getValues()) // [v8.2] 콜드 가드
    .filter(r => r[0])
    .map(r => {
      const s0 = String(r[0]); // [v8.3] 트랙 기반 정원: 집중반(주말집중반 포함)=10 · 주말정규반=20 · 정규반1~4=20 · 구체계(5번~)=10
      let cap;
      if (s0.indexOf('집중반') > -1) cap = 10;
      else if (s0.indexOf('주말정규반') === 0) cap = 20;
      else { const num = classNumOf(s0); cap = num ? (Number(num) <= 4 ? 20 : 10) : (Number(r[1]) || 1); }
      const eS = schedOf(smR, s0);
      const per = (eS && eS.type === '주말') ? 18 : 28;
      return [weekKey, r[0], cap * per, 0, '진행중', ''];
    });
  if (rows.length) rd.getRange(rd.getLastRow() + 1, 1, rows.length, 6).setValues(rows);

  // [v9.1] 반 대항 리그 — 인원 비슷한 반끼리 자동 '제안' (원장이 Glide에서 반만 바꾸면 오버라이드)
  const lg = ensureSheet(ss, 'league_pairs', ['week','반A','반B','상태','결과']);
  const hasWk = lg.getLastRow() >= 2 && lg.getRange(2, 1, lg.getLastRow() - 1, 1).getValues()
    .some(r => String(r[0]) === weekKey);
  if (!hasWk) {
    const roster = (cs.getLastRow() < 2 ? [] : cs.getRange(2, 1, cs.getLastRow() - 1, 2).getValues())
      .filter(r => r[0] && Number(r[1]) >= 1)
      .sort((a, b) => Number(b[1]) - Number(a[1])); // 인원 내림차순 → 인접 = 규모 유사
    const pairRows = [];
    for (let i = 0; i + 1 < roster.length; i += 2) {
      pairRows.push([weekKey, String(roster[i][0]), String(roster[i + 1][0]), '제안', '']);
    }
    if (roster.length % 2 === 1) {
      pairRows.push([weekKey, String(roster[roster.length - 1][0]), '', '부전', '이번 주 휴식 🏖️']);
    }
    if (pairRows.length) lg.getRange(lg.getLastRow() + 1, 1, pairRows.length, 5).setValues(pairRows);
    Logger.log('리그 매칭 제안: ' + pairRows.length + '건');
  }
  Logger.log('레이드 생성: ' + rows.length + '개 반');
}

// [v9.1] 반 대항 리그 정산 — 일요일 밤, 1인당 주간평균으로 승패 (인원차 공정 보정)
function leagueSettle_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const mon = new Date(now); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7)); // 이번 주 월요일
  const weekKey = Utilities.formatDate(mon, tz, 'yyyy-MM-dd');
  const lg = ss.getSheetByName('league_pairs');
  if (!lg || lg.getLastRow() < 2) return;
  const cs = ss.getSheetByName('class_stats');
  const avgOf = {}, memberCls = {};
  if (cs && cs.getLastRow() >= 2) {
    cs.getRange(2, 1, cs.getLastRow() - 1, 8).getValues().forEach(r => { if (r[0]) avgOf[String(r[0])] = Number(r[7]) || 0; });
  }
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) {
    pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
      if (r[0] && r[3] === 'student' && r[4]) (memberCls[String(r[4])] = memberCls[String(r[4])] || []).push(r[0]);
    });
  }
  // [v9.2] 반별 최다 기여자 — 양 반 모두 스토리에서 실명 호명 (진 반 배려의 핵심)
  const clsOfL = {};
  Object.keys(memberCls).forEach(c => memberCls[c].forEach(sid => clsOfL[sid] = c));
  const nameOfL = {};
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 2).getValues()
    .forEach(r => { if (r[0]) nameOfL[r[0]] = r[1] || r[0]; });
  const topOf = {};
  const plL = ss.getSheetByName('point_logs');
  if (plL && plL.getLastRow() >= 2) {
    const perSid = {};
    plL.getRange(2, 1, plL.getLastRow() - 1, 6).getValues().forEach(r => {
      const sid = r[1], pts = Number(r[2]) || 0, d = r[5];
      if (!sid || !d || !clsOfL[sid]) return;
      const dd = (d instanceof Date) ? d : new Date(d);
      if (dd < mon) return;
      if (pts > 0 || String(r[3] || '').indexOf('정정') > -1) perSid[sid] = (perSid[sid] || 0) + pts;
    });
    Object.keys(perSid).forEach(sid => {
      const c = clsOfL[sid];
      if (!topOf[c] || perSid[sid] > topOf[c].d) topOf[c] = { n: nameOfL[sid] || sid, d: perSid[sid] };
    });
  }
  const rsL = ensureSheet(ss, 'raid_story', ['date','class_name','유형','제목','스토리']);
  const todayL = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const storyRows = [];
  function topLine(c) { const t = topOf[c]; return t ? t.n + josa(t.n, '이', '가') + ' ' + t.d + ' 데미지로 반을 이끌었다' : '모두가 조용히 힘을 모은 한 주'; }

  const data = lg.getRange(2, 1, lg.getLastRow() - 1, 5).getValues();
  const winRows = []; let noticed = 0;
  data.forEach((r, i) => {
    if (String(r[0]) !== weekKey || String(r[3]) === '부전' || String(r[4] || '')) return; // 이번 주 · 미정산만 (멱등)
    const a = String(r[1] || ''), b = String(r[2] || '');
    if (!a || !b) return;
    const av = avgOf[a] || 0, bv = avgOf[b] || 0;
    let res, winner = '';
    if (av === bv) res = '무승부 ' + av + ' : ' + bv;
    else { winner = av > bv ? a : b; res = winner + ' 승 (' + Math.max(av, bv) + ' : ' + Math.min(av, bv) + ')'; }
    lg.getRange(i + 2, 5).setValue(res);
    // [v9.2] 양 반 모두에게 서사 — '패배'라는 단어는 이 시스템에 존재하지 않는다
    const hi = Math.max(av, bv), lo = Math.min(av, bv);
    if (!winner) {
      const tie = '⚖️ ' + a + ' × ' + b + ', 완벽한 균형 ' + av + ' : ' + bv + ' — 시냅스 쌍둥이 반 탄생! 다음 주, 이 균형이 깨지는 순간을 지켜보라.';
      storyRows.push([todayL, a, '리그', '⚖️ 무승부 — 쌍둥이 반', tie]);
      storyRows.push([todayL, b, '리그', '⚖️ 무승부 — 쌍둥이 반', tie]);
    } else {
      const loser = (winner === a) ? b : a;
      storyRows.push([todayL, winner, '리그', '👑 이번 주 리듬왕',
        '⚔️ ' + winner + ', 1인 평균 ' + hi + '로 이번 주 리듬왕에 올랐다! ' + topLine(winner) +
        '. 왕좌는 달콤하지만 짧다 — 다음 주, 방어전이 기다린다 👑']);
      const close = hi > 0 && (hi - lo) / hi <= 0.25;
      if (close) {
        storyRows.push([todayL, loser, '리그', '🔥 명승부 — 다음 주를 예약하다',
          '🔥 ' + loser + ', 단 ' + Math.round((hi - lo) * 10) / 10 + ' 차이의 명승부를 만들었다! ' + topLine(loser) +
          '. 이 리듬이면 다음 주 결과는 아무도 모른다 — 리벤지 매치, 이미 예약됐다 ⏳']);
      } else {
        storyRows.push([todayL, loser, '리그', '🌱 사라지지 않는 데미지',
          '🌱 ' + loser + '의 이번 주 성장은 어디로도 사라지지 않는다 — 전부 우리 몬스터의 양분이 됐다. ' + topLine(loser) +
          '. 불씨는 살아있다, 다음 주에 더 크게 타오른다 🔥']);
      }
    }
    if (winner && memberCls[winner]) {
      memberCls[winner].forEach(sid => winRows.push([sid, 5, '리그승리', 'SYSTEM']));
      const nt = ensureSheet(ss, 'notices', ['title', 'body', 'date', 'title_mn', 'body_mn']);
      nt.getRange(nt.getLastRow() + 1, 1, 1, 3).setValues([[
        '🏆 주간 리그 결과: ' + a + ' × ' + b,
        '이번 주 리듬왕은 ' + winner + ' (1인 평균 ' + hi + ' : ' + lo + ')! 승리 반 전원 +5P. 양 반 모두의 데미지는 각자의 몬스터에게 그대로 쌓였습니다 🌱',
        new Date()]]);
      noticed++;
    }
  });
  if (storyRows.length) rsL.getRange(rsL.getLastRow() + 1, 1, storyRows.length, 5).setValues(storyRows); // [v9.2]
  if (winRows.length) appendPoints(ss, winRows);
  Logger.log('리그 정산: 승리 지급 ' + winRows.length + '명 · 서사 ' + storyRows.length + '건 · 공지 ' + noticed + '건');
}

// [v9.3] 리그 일일 중계 — 월~토 밤, 각 반의 오늘을 캐스터 톤으로 (아기자기 · 지치지 않게)
function leagueStoryDaily_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const mon = new Date(now); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const weekKey = Utilities.formatDate(mon, tz, 'yyyy-MM-dd');
  const todayD = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const lg = ss.getSheetByName('league_pairs');
  if (!lg || lg.getLastRow() < 2) return;
  const rivalOf = {};
  lg.getRange(2, 1, lg.getLastRow() - 1, 5).getValues().forEach(r => {
    if (String(r[0]) !== weekKey || String(r[3]) === '부전') return;
    const a = String(r[1] || ''), b = String(r[2] || '');
    if (a && b) { rivalOf[a] = b; rivalOf[b] = a; }
  });
  if (!Object.keys(rivalOf).length) return;
  const cs = ss.getSheetByName('class_stats');
  const avgD = {};
  if (cs && cs.getLastRow() >= 2) cs.getRange(2, 1, cs.getLastRow() - 1, 8).getValues()
    .forEach(r => { if (r[0]) avgD[String(r[0])] = Number(r[7]) || 0; });
  const pf = ss.getSheetByName('profiles');
  const clsD = {}, nmD = {};
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
    if (r[0] && r[3] === 'student' && r[4]) { clsD[r[0]] = String(r[4]); nmD[r[0]] = r[1] || r[0]; }
  });
  const pl = ss.getSheetByName('point_logs');
  const dayDmg = {}, perD = {}, hwCnt = {}, crownD = {};
  if (pl && pl.getLastRow() >= 2) pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => {
    const sid = r[1], pts = Number(r[2]) || 0, rs = String(r[3] || ''), d = r[5];
    if (!sid || !d || !clsD[sid] || !rivalOf[clsD[sid]]) return;
    const dd = (d instanceof Date) ? d : new Date(d);
    if (dstr(dd, tz) !== todayD) return;
    if (pts > 0 || rs.indexOf('정정') > -1) {
      const c = clsD[sid];
      dayDmg[c] = (dayDmg[c] || 0) + pts;
      perD[c] = perD[c] || {}; perD[c][sid] = (perD[c][sid] || 0) + pts;
      if (pts > 0 && rs === '숙제완료') hwCnt[c] = (hwCnt[c] || 0) + 1;
      if (pts > 0 && (rs.indexOf('MVP') > -1 || rs.indexOf('시냅스') > -1))
        crownD[c] = nmD[sid] + josa(nmD[sid], '이', '가') + ' ' + (rs.indexOf('MVP') > -1 ? '🌟 MVP' : '⚡ 시냅스') + ' 왕관을 썼다';
    }
  });
  const rsS = ensureSheet(ss, 'raid_story', ['date','class_name','유형','제목','스토리']);
  const dup = new Set();
  if (rsS.getLastRow() >= 2) rsS.getRange(2, 1, rsS.getLastRow() - 1, 3).getValues()
    .forEach(r => { if (String(r[2]) === '리그중계') dup.add(dstr(r[0], tz) + '|' + r[1]); });
  const outS = [];
  Object.keys(rivalOf).forEach(c => {
    if (dup.has(todayD + '|' + c)) return;
    const rv = rivalOf[c];
    const my = avgD[c] || 0, op = avgD[rv] || 0, dToday = dayDmg[c] || 0;
    let topLn = '오늘은 전원이 숨을 고른 날';
    if (perD[c]) {
      let bs = '', bd = 0;
      Object.keys(perD[c]).forEach(s => { if (perD[c][s] > bd) { bd = perD[c][s]; bs = s; } });
      if (bs) topLn = '오늘의 캐리 ' + nmD[bs] + ' (' + bd + ' 데미지)';
    }
    const detail = crownD[c] ? crownD[c] : (hwCnt[c] ? '숙제 완료 ' + hwCnt[c] + '명 — 성실의 벽돌이 차곡차곡' : '조용하지만 단단한 하루');
    let head, tail;
    const gap = Math.round(Math.abs(my - op) * 10) / 10;
    if (my > op) { head = '📣 ' + c + ', 평균 ' + my + '로 ' + rv + '(' + op + ')를 ' + gap + ' 리드 중!'; tail = '리드를 지키는 자가 왕좌를 가져간다 👑'; }
    else if (my === op) { head = '📣 ' + c + ' × ' + rv + ', 평균 ' + my + ' 완벽한 동점!'; tail = '내일 첫 데미지가 균형을 깨뜨린다 ⚖️'; }
    else if (op > 0 && gap / op <= 0.3) { head = '📣 ' + c + ', ' + rv + '까지 단 ' + gap + '! 숨막히는 추격전!'; tail = '내일 아침, 뒤집힌 스코어를 보게 될지도 🔥'; }
    else { head = '📣 ' + c + ', 오늘 +' + dToday + ' 적립 — 우리 페이스대로!'; tail = '스코어는 숫자일 뿐, 매일의 데미지가 진짜 근육이다 💪'; }
    outS.push([todayD, c, '리그중계', '🎙️ 리그 중계석 D' + (Math.floor((now - mon) / 86400000) + 1),
      head + ' ' + topLn + '. ' + detail + '. ' + tail]);
  });
  if (outS.length) rsS.getRange(rsS.getLastRow() + 1, 1, outS.length, 5).setValues(outS);
  Logger.log('리그 중계: ' + outS.length + '건');
}

function raidFriday() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const weekKey = Utilities.formatDate(monday, tz, 'yyyy-MM-dd');

  const rd = ss.getSheetByName('raid');
  if (!rd || rd.getLastRow() < 2) return;

  const pl = ss.getSheetByName('point_logs');
  const plLast = pl.getLastRow();
  const pf = ss.getSheetByName('profiles');
  const pfData = (!pf || pf.getLastRow() < 2) ? [] : pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues(); // [v8.7]
  const classOf = {}, members = {}, nameOf = {}; // [v7.3] nameOf: 결산 스토리용
  pfData.forEach(r => {
    if (r[0] && r[3] === 'student' && r[4]) {
      classOf[r[0]] = r[4];
      nameOf[r[0]] = r[1] || r[0];
      if (!members[r[4]]) members[r[4]] = [];
      members[r[4]].push(r[0]);
    }
  });
  const smS = scheduleMap(ss); // [v7.3] 금요일 run = 평일반만 · 일요일 run = 주말반만 정산
  const isSunday = (now.getDay() === 0);
  function clsType(c) { const e = schedOf(smS, c); return e ? e.type : '평일'; } // [v8.3]
  const weekPts = {};
  const sidWeek = {}, lastHit = {}; // [v7.3] 결산 스토리 — 개인 주간 데미지 · 마지막 타격 시각
  if (plLast >= 2) {
    pl.getRange(2, 1, plLast - 1, 6).getValues().forEach(r => {
      const sid = r[1], pts = Number(r[2]) || 0, d = r[5];
      const isE = pts > 0 || String(r[3] || '').indexOf('정정') > -1; // [v7.4] 정정은 데미지도 되돌림
      if (!sid || !d || !isE || pts === 0) return;
      const dd = (d instanceof Date) ? d : new Date(d);
      if (dd >= monday && classOf[sid]) {
        weekPts[classOf[sid]] = (weekPts[classOf[sid]] || 0) + pts;
        sidWeek[sid] = (sidWeek[sid] || 0) + pts;
        if (!lastHit[sid] || dd.getTime() > lastHit[sid]) lastHit[sid] = dd.getTime();
      }
    });
  }

  // [v5.7] 레이드 연료 — 강사가 반 단위 1행으로 주입한 수업 미션 보너스를 반 합계에 합산
  const fuelByCls = {}; // [v7.3] 결산 스토리용
  const fuelMap = {};
  const ctF = ss.getSheetByName('contents');
  if (ctF && ctF.getLastRow() >= 2) {
    ctF.getRange(2, 1, ctF.getLastRow() - 1, 6).getValues().forEach(r => {
      if (r[1] === 'fuel' && r[2]) fuelMap[String(r[2])] = Number(r[5]) || 0;
    });
  }
  const cf = ss.getSheetByName('class_fuel');
  const fSeen = new Set(); // [v7.5] 같은 미션은 주 1회만 합산 (중복 행 2배 방지)
  if (cf && cf.getLastRow() >= 2) {
    cf.getRange(2, 1, cf.getLastRow() - 1, 4).getValues().forEach(r => {
      const cls = r[0], mission = String(r[1] || ''), d = r[3];
      if (!cls || !d) return;
      const dd = (d instanceof Date) ? d : new Date(d);
      if (dd >= monday && fuelMap[mission] && !fSeen.has(cls + '|' + mission)) {
        fSeen.add(cls + '|' + mission);
        weekPts[cls] = (weekPts[cls] || 0) + fuelMap[mission];
        fuelByCls[cls] = (fuelByCls[cls] || 0) + fuelMap[mission]; // [v7.3]
      }
    });
  }

  const rdLast = rd.getLastRow();
  const rdData = rd.getRange(2, 1, rdLast - 1, 6).getValues();
  const rewardSids = [];
  const winners = []; // [v5] 자동 공지용 성공 반 목록
  const settled = []; // [v7.3] 결산 스토리 대상
  rdData.forEach((r, i) => {
    if (dstr(r[0], tz) !== weekKey) return;
    const cls = r[1], target = Number(r[2]) || 0;
    if ((clsType(cls) === '주말') !== isSunday) return; // [v7.3] 금=평일 · 일=주말
    const wasPaid = (r[5] === '지급완료');
    const got = weekPts[cls] || 0;
    r[3] = got;
    if (got >= target && target > 0 && !wasPaid) {
      r[4] = '달성 🎉'; r[5] = '지급완료';
      winners.push(cls + ' (' + got + 'P)'); // [v5]
      (members[cls] || []).forEach(sid => rewardSids.push(sid));
    } else if (!wasPaid) {
      r[4] = got >= target * 0.7 ? '아쉬움' : '미달성';
    }
    if (!wasPaid) settled.push({ cls: cls, target: target, got: got, win: got >= target && target > 0 });
    rdData[i] = r;
  });
  rd.getRange(2, 1, rdData.length, 6).setValues(rdData);

  // [v7.3] 결산 스토리 — 격파 서사 / 도주 서사 / 무공격 서사 (raid_story → Glide 레이드 탭)
  const rsSh = ensureSheet(ss, 'raid_story', ['date','class_name','유형','제목','스토리']);
  const dupe = new Set();
  if (rsSh.getLastRow() >= 2) {
    rsSh.getRange(2, 1, rsSh.getLastRow() - 1, 3).getValues().forEach(r => {
      if (String(r[2]) === '결산') dupe.add(dstr(r[0], tz) + '|' + r[1]);
    });
  }
  const bossS = bossOfMonth(ss, Number(Utilities.formatDate(now, tz, 'M')));
  const bN = bossS ? bossS.name : '이달의 보스';
  const stOut = [];
  settled.forEach(o => {
    if (dupe.has(weekKey + '|' + o.cls)) return;
    const roster = (members[o.cls] || [])
      .map(sid => ({ n: nameOf[sid] || sid, d: sidWeek[sid] || 0, t: lastHit[sid] || 0 }))
      .filter(x => x.d > 0).sort((a, b) => b.d - a.d);
    const top = roster[0], second = roster[1];
    let last = null;
    roster.forEach(x => { if (!last || x.t > last.t) last = x; });
    const fuel = fuelByCls[o.cls] || 0;
    let title, text;
    if (o.win) {
      title = '⚔️ ' + o.cls + ' — ' + bN + ' 격파!';
      text = '일주일의 총공세, ' + o.got + ' 데미지로 ' + bN + '(HP ' + o.target + ')를 쓰러뜨렸다! ' +
        (top ? '선봉 ' + top.n + josa(top.n, '이', '가') + ' ' + top.d + ' 데미지로 최다 타격' +
          (second ? ', ' + second.n + josa(second.n, '이', '가') + ' ' + second.d + ' 데미지로 뒤를 이었다' : '') + '. ' : '') +
        (fuel ? '🔥 연료 미션 합동 공격 ' + fuel + ' 데미지가 결정적이었다. ' : '') +
        (last ? bN + josa(bN, '이', '가') + ' 비틀거리며 도망치려는 순간 — ' + last.n + '의 마지막 일격이 작렬! ' : '') +
        '반 전원 +20P 🏆';
    } else if (o.got > 0) {
      title = '🌫️ ' + o.cls + ' — ' + bN + ' 도주…';
      text = o.got + ' 데미지를 입혔지만, ' + bN + '(HP ' + o.target + ')' + josa('P', '은', '는') + ' ' + Math.max(o.target - o.got, 0) +
        '의 체력을 남기고 어둠 속으로 도망쳤다. ' +
        (top ? '가장 용감했던 전사는 ' + top.n + '(' + top.d + ' 데미지)! ' : '') +
        '다음 주 월요일, 복수전이 시작된다 🔥';
    } else {
      title = '😴 ' + o.cls + ' — ' + bN + '의 코웃음';
      text = '이번 주 아무도 ' + bN + josa(bN, '을', '를') + ' 공격하지 않았다. ' + bN + josa(bN, '은', '는') + ' 하품을 하며 유유히 사라졌다… ' +
        '다음 주, 반격 개시! (숙제·칭찬·MVP 하나하나가 전부 데미지가 된다 ⚡)';
    }
    stOut.push([weekKey, o.cls, '결산', title, text]);
  });
  if (stOut.length) rsSh.getRange(rsSh.getLastRow() + 1, 1, stOut.length, 5).setValues(stOut);

  if (rewardSids.length) {
    appendPoints(ss, rewardSids.map(sid => [sid, 20, '레이드보상', '시스템'])); // [v7.1] 50→20
    const bossW = bossOfMonth(ss, Number(Utilities.formatDate(now, tz, 'M'))); // [v5.7]
    // [v5] 레이드 성공 자동 공지 → 앱 공지 탭에 노출
    addNotice(ss,
      '🎉 이번 주 레이드 성공' + (bossW ? ' — ' + bossW.name + ' 격파!' : '!'),
      winners.join(' · ') + ' — 목표 달성! 반 전원 보상 지급 완료 🏆' +
      (bossW ? '\n"' + bossW.win + '"' : ''));
    calcAll();
  }
  Logger.log('레이드 정산: 보상 ' + rewardSids.length + '명 / 결산 스토리 ' + stOut.length + '건');
}

/* ===================== [v8.1] 오늘의 출결 보드 ===================== */
// 원장 탭 한눈 뷰 — parentSweep(10분)마다 재구성. 강사 = 출근·퇴근을 한 줄에(HH:mm),
// 학생 = 반별 등원 시각, 오늘 수업 반의 미등원자는 '—'(빈자리가 보여야 한눈). GPS 기록 자체는 분 단위 원본 유지.
function todayBoard_(ss) {
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const bd = ensureSheet(ss, 'today_board', ['유형','이름','반','시각','퇴근']);
  const hhmm = function (d) { return Utilities.formatDate((d instanceof Date) ? d : new Date(d), tz, 'HH:mm'); };
  const isToday = function (d) {
    const dd = (d instanceof Date) ? d : new Date(d);
    return Utilities.formatDate(dd, tz, 'yyyy-MM-dd') === today;
  };

  const tin = {}, tout = {};
  const tc = ss.getSheetByName('teacher_checkins');
  if (tc && tc.getLastRow() >= 2) {
    tc.getRange(2, 1, tc.getLastRow() - 1, 3).getValues().forEach(r => {
      const nm = String(r[TC_NAME_COL - 1] || '').trim(), tp = String(r[TC_TYPE_COL - 1] || ''), d = r[TC_TIME_COL - 1];
      if (!nm || !d || !isToday(d)) return;
      const t = (d instanceof Date) ? d.getTime() : new Date(d).getTime();
      if (tp.indexOf('출근') > -1) { if (!tin[nm] || t < tin[nm]) tin[nm] = t; }
      else if (tp.indexOf('퇴근') > -1) { if (!tout[nm] || t > tout[nm]) tout[nm] = t; }
    });
  }
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return;
  const pfData = pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues();
  const rows = [];
  pfData.forEach(r => {
    if (r[0] && r[3] === 'teacher') {
      const nm = String(r[1] || r[0]).trim();
      if (tin[nm] || tout[nm]) {
        rows.push(['👩‍🏫 강사', nm, String(r[4] || ''),
          tin[nm] ? hhmm(new Date(tin[nm])) : '—', tout[nm] ? hhmm(new Date(tout[nm])) : '—']);
      }
    }
  });
  const arr = {};
  const at = ss.getSheetByName('attendance');
  if (at && at.getLastRow() >= 2) {
    at.getRange(2, 1, at.getLastRow() - 1, 4).getValues().forEach(r => {
      const sid = r[1], d = r[2];
      if (!sid || !d || !isToday(d) || String(r[3]).indexOf('출석') === -1) return;
      const t = (d instanceof Date) ? d.getTime() : new Date(d).getTime();
      if (!arr[sid] || t < arr[sid]) arr[sid] = t;
    });
  }
  const stuRows = [];
  pfData.forEach(r => {
    if (!(r[0] && r[3] === 'student' && r[4])) return;
    const came = arr[r[0]];
    if (came) stuRows.push(['🧑‍🎓 학생', r[1] || r[0], String(r[4]), hhmm(new Date(came)), '']);
    else if (hasClassToday(ss, String(r[4]))) stuRows.push(['🧑‍🎓 학생', r[1] || r[0], String(r[4]), '—', '']);
  });
  stuRows.sort((a, b) => a[2] === b[2] ? String(a[3]).localeCompare(String(b[3])) : String(a[2]).localeCompare(String(b[2])));
  const all = rows.concat(stuRows);
  const last = bd.getLastRow();
  if (last - 1 > all.length) bd.getRange(all.length + 2, 1, Math.max(last - 1 - all.length, 1), 5).clearContent();
  if (all.length) writeIfChanged(bd, 2, 1, all);
}

/* ===================== [v8.0] 숙제 일괄 전개 ===================== */
// 강사: 완료 학생 멀티 선택 → 저장 1탭 = 수업당 1업데이트 (개별 버튼: 학생당 1업데이트).
// 밤 22시 스크립트가 학생별 +10으로 전개 — 시트→앱 sync는 묶음당 1업데이트라 ~85% 절감.
// 개별 버튼과 병행 가능: 같은 날 이미 지급된 학생은 자동 스킵. 행 재실행은 '전개완료' 마킹으로 멱등.
function expandHwBatch() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const hb = ensureSheet(ss, 'hw_batch', ['date','class_name','완료자목록','입력자','created_at','처리상태']);
  if (hb.getLastRow() < 2) return;
  const rows = hb.getRange(2, 1, hb.getLastRow() - 1, 6).getValues();

  const doneToday = new Set(); // 오늘 이미 지급된 학생 (개별 버튼 병행 대비)
  const pl = ss.getSheetByName('point_logs');
  if (pl && pl.getLastRow() >= 2) {
    pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => {
      const d = r[5];
      if (!r[1] || !d) return;
      const dd = (d instanceof Date) ? d : new Date(d);
      if (Utilities.formatDate(dd, tz, 'yyyy-MM-dd') === today &&
          String(r[3] || '').indexOf('숙제완료') > -1 && Number(r[2]) > 0) doneToday.add(String(r[1]).trim());
    });
  }
  const valid = new Set();
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) {
    pf.getRange(2, 1, pf.getLastRow() - 1, 4).getValues().forEach(r => {
      if (r[0] && r[3] === 'student') valid.add(String(r[0]).trim());
    });
  }
  const outRows = [];
  let skip = 0;
  rows.forEach((r, i) => {
    const d = r[0];
    if (!d || String(r[5]) === '전개완료') return;
    const dd = (d instanceof Date) ? d : new Date(d);
    if (Utilities.formatDate(dd, tz, 'yyyy-MM-dd') !== today) return; // 당일 행만 전개
    const by = String(r[3] || '강사');
    const seen = new Set();
    String(r[2] || '').split(',').forEach(tok => {
      const sid = String(tok).trim();
      if (!sid || seen.has(sid) || !valid.has(sid)) return;
      seen.add(sid);
      if (doneToday.has(sid)) { skip++; return; }
      doneToday.add(sid);
      outRows.push([sid, 10, '숙제완료', by]);
    });
    hb.getRange(i + 2, 6).setValue('전개완료');
  });
  if (outRows.length) appendPoints(ss, outRows);
  Logger.log('숙제 일괄 전개: +' + outRows.length + '명 / 중복 스킵 ' + skip);
}

/* ===================== [v7.9] 학부모 주간 다이제스트 ===================== */
// 일요일 22시 — 등원·포인트·왕관·레이드·배운 것을 학부모에게 한 통으로 (등원 즉시 메일 대체)
function parentWeeklyDigest() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const weekKey = Utilities.formatDate(monday, tz, 'yyyy-MM-dd');
  const st = ss.getSheetByName('app_state');
  if (st && String(getState(st, '학부모다이제스트주').val) === weekKey) return; // 재실행 방지

  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return;
  const kids = [];
  pf.getRange(2, 1, pf.getLastRow() - 1, 26).getValues().forEach(r => {
    if (r[0] && r[3] === 'student' && String(r[25] || '').indexOf('@') > -1)
      kids.push({ sid: r[0], n: r[1] || r[0], cls: r[4] || '', m: String(r[25]) });
  });
  if (!kids.length) return;

  const attW = {};
  const at = ss.getSheetByName('attendance');
  if (at && at.getLastRow() >= 2) {
    at.getRange(2, 1, at.getLastRow() - 1, 4).getValues().forEach(r => {
      const d = r[2];
      if (!r[1] || !d) return;
      const dd = (d instanceof Date) ? d : new Date(d);
      if (dd >= monday && String(r[3]).indexOf('출석') > -1) attW[r[1]] = (attW[r[1]] || 0) + 1;
    });
  }
  const ptsW = {}, mvpW = {}, synW = {};
  const tagW = {}; // [v9.0] 칭찬 태그 — pl 루프보다 앞에 선언
  const pl = ss.getSheetByName('point_logs');
  if (pl && pl.getLastRow() >= 2) {
    pl.getRange(2, 1, pl.getLastRow() - 1, 8) /* [v9.0] H 태그 */.getValues().forEach(r => {
      const sid = r[1], pts = Number(r[2]) || 0, rs = String(r[3] || ''), d = r[5];
      if (!sid || !d) return;
      const dd = (d instanceof Date) ? d : new Date(d);
      if (dd < monday) return;
      const isE = pts > 0 || rs.indexOf('정정') > -1;
      if (isE && pts !== 0) ptsW[sid] = (ptsW[sid] || 0) + pts;
      if (rs.indexOf('MVP') > -1) mvpW[sid] = (mvpW[sid] || 0) + (pts > 0 ? 1 : (rs.indexOf('정정') > -1 ? -1 : 0)); // [v9.0] 건수 — 금액 독립
      else if (rs.indexOf('시냅스') > -1) synW[sid] = (synW[sid] || 0) + (pts > 0 ? 1 : (rs.indexOf('정정') > -1 ? -1 : 0));
      if (pts > 0 && (rs.indexOf('MVP') > -1 || rs.indexOf('시냅스') > -1)) { // [v9.0] 칭찬 태그
        const tg = String(r[7] || '').trim();
        if (tg) (tagW[sid] = tagW[sid] || []).push(tg);
      }
    });
  }
  const raidBy = {};
  const rd = ss.getSheetByName('raid');
  if (rd && rd.getLastRow() >= 2) {
    rd.getRange(2, 1, rd.getLastRow() - 1, 5).getValues().forEach(r => {
      if (r[1] && dstr(r[0], tz) === weekKey) raidBy[r[1]] = String(r[4] || '');
    });
  }
  const topicBy = {};
  const wt = ss.getSheetByName('weekly_topics');
  if (wt && wt.getLastRow() >= 2) {
    wt.getRange(2, 1, wt.getLastRow() - 1, 5).getValues().forEach(r => {
      const d = r[3];
      if (!r[0] || !d) return;
      const dd = (d instanceof Date) ? d : new Date(d);
      if (dd >= monday) topicBy[r[0]] = String(r[4] || r[1] || '');
    });
  }
  let sent = 0;
  kids.forEach(k => {
    if (!quotaOk(1)) return;
    const att = attW[k.sid] || 0;
    const pts = Math.max(ptsW[k.sid] || 0, 0);
    const mvpN = Math.max(mvpW[k.sid] || 0, 0); // [v9.0] 건수 방식 — 시냅스 +10 상향에도 정확
    const synN = Math.max(synW[k.sid] || 0, 0);
    const raidSt = raidBy[k.cls] || '';
    const lines = [];
    lines.push('이번 주 등원 ' + att + '회 · 포인트 +' + pts + 'P');
    if (mvpN || synN) lines.push('👑 왕관: ' + [mvpN ? '🌟 오늘의 MVP ' + mvpN + '회' : '',
      synN ? '⚡ 오늘의 시냅스 ' + synN + '회' : ''].filter(String).join(' · '));
    if (tagW[k.sid] && tagW[k.sid].length) { // [v9.0] 크루의 눈 — 한/몽 병기
      const uniq = tagW[k.sid].filter((v, i, a) => a.indexOf(v) === i);
      lines.push('💬 크루의 눈: ' + uniq.join(' · ') + ' / ' + uniq.map(t => TAG_MN[t] || t).join(' · '));
    }
    if (raidSt) lines.push('⚔️ 반 레이드: ' + (raidSt.indexOf('달성') > -1 ? '보스 격파! 반 전원 +20P 🏆'
      : raidSt.indexOf('아쉬움') > -1 ? '아깝게 놓쳤어요 — 다음 주 복수전!' : '다음 주, 반격을 준비 중이에요!'));
    if (topicBy[k.cls]) lines.push('📖 이번 주 배운 것: ' + topicBy[k.cls]);
    const body = k.n + ' 학생의 한 주 소식입니다.\n\n' + lines.join('\n') +
      '\n\n자세한 내용은 SYNK 앱에서 확인하실 수 있어요 😊\n\n' +
      'Долоо хоногийн тойм — ирц ' + att + ' · оноо +' + pts + 'P' +
      ((mvpN + synN) > 0 ? ' · титэм ' + (mvpN + synN) + 'ш 👑' : '') + ' 🎉';
    MailApp.sendEmail(k.m, '[SYNK] 📮 ' + k.n + ' — 이번 주 소식', body);
    sent++;
  });
  if (st && sent) setState(st, '학부모다이제스트주', weekKey);
  Logger.log('학부모 주간 다이제스트: ' + sent + '통');
}

/* ===================== [v7.8] 복구 리허설 ===================== */
// 월 1회 원장이 실행: 최신 백업을 '읽기만' 해서 복원 가능 여부 검증 (원본 덮어쓰기 없음 — 100% 안전)
function restoreDrill() {
  if (typeof DriveApp === 'undefined') { Logger.log('복구 리허설: Drive 미지원 환경 — 스킵'); return; }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  try {
    const it = DriveApp.getFoldersByName('SYNK_백업');
    if (!it.hasNext()) { adminMail('[SYNK] 🧯 복구 리허설 실패', '백업 폴더(SYNK_백업)가 없습니다. dailyBackup 트리거(새벽 3시)를 확인하세요.'); return; }
    const files = it.next().getFiles();
    let latest = null;
    while (files.hasNext()) {
      const f = files.next();
      if (f.getName().indexOf('SYNK_앱데이터_백업_') === 0 && (!latest || f.getDateCreated() > latest.getDateCreated())) latest = f;
    }
    if (!latest) { adminMail('[SYNK] 🧯 복구 리허설 실패', '백업 파일이 없습니다.'); return; }
    const bk = SpreadsheetApp.openById(latest.getId());
    const bp = bk.getSheetByName('profiles'), op = ss.getSheetByName('profiles');
    const bRows = bp ? bp.getLastRow() - 1 : -1, oRows = op ? op.getLastRow() - 1 : -1;
    const bH = bp ? String(bp.getRange(1, 1, 1, 5).getValues()[0].join('|')) : '';
    const oH = op ? String(op.getRange(1, 1, 1, 5).getValues()[0].join('|')) : '';
    const ok = !!bp && bRows > 0 && bH === oH && Math.abs(bRows - oRows) <= 5;
    const st = ss.getSheetByName('app_state');
    if (st) setState(st, '복구리허설일', Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'));
    if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 🧯 복구 리허설 ' + (ok ? '✅ 통과' : '⚠️ 확인 필요'),
      '최신 백업: ' + latest.getName() + '\n' +
      'profiles — 백업 ' + bRows + '행 / 원본 ' + oRows + '행 · 헤더 ' + (bH === oH ? '일치 ✅' : '불일치 ⚠️') + '\n\n' +
      (ok ? '언제든 복구 가능한 상태입니다. 다음 리허설: 한 달 뒤 🗓' : '차이가 큽니다 — 백업 파일을 직접 열어 확인해주세요.') + '\n\n' +
      '[실제 복구 절차 — 3단계]\n① Drive의 SYNK_백업 폴더에서 원하는 날짜 파일 열기\n② 손상된 시트만 전체 선택 → 복사\n③ 원본 같은 이름 시트에 붙여넣기 (스크립트·트리거는 원본에 살아있으므로 그대로)');
  } catch (e) {
    adminMail('[SYNK] 🧯 복구 리허설 오류', String(e));
  }
}

/* ===================== [v7.5] 일일 한도 가드 (dailyGuard) ===================== */
// 매일 22시. ① MVP·오늘의 시냅스: 같은 날·같은 반 각 1명(최초 지급만 유효)  ② 숙제완료·생일축하: 학생당 하루 1회
// 초과분은 자동 정정(-P) + 원장 경고. 정정은 성장·잔액·레이드 데미지·칭호 카운트까지 대칭으로 되돌린다.
// today 기준 검사라 자정이 지나면 자동 초기화 — 다음 날은 다시 지급 가능.
const DAILY_LIMIT = { '숙제완료': 1, '생일축하': 1 }; // 사유(정확 일치)별 학생당 일일 한도
const CLASS_AWARDS = ['오늘의 MVP', '오늘의 시냅스']; // [v7.6] 반당 하루 1명 왕관 2종
const TAG_MN = { '발음↑': 'Дуудлага ↑', '열정': 'Хичээл зүтгэл', '친구도움': 'Найздаа тусалсан', '집중력': 'Төвлөрөл' }; // [v9.0] 칭찬 태그 몽골어
function dailyGuard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const pf = ss.getSheetByName('profiles');
  const pl = ss.getSheetByName('point_logs');
  if (!pf || !pl || pf.getLastRow() < 2 || pl.getLastRow() < 2) return;
  const classOf = {};
  pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
    if (r[0] && r[3] === 'student' && r[4]) classOf[r[0]] = r[4];
  });
  const byAward = {}, fixedA = {};   // [v7.6] 왕관 2종: byAward[상][반] = 지급 목록
  const bySR = {}, fixedSR = {};     // [v7.5] 학생×사유: 하루 1회
  (pl.getLastRow() < 2 ? [] : pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues()).forEach(r => { // [v8.2]
    const sid = r[1], pts = Number(r[2]) || 0, rs = String(r[3] || ''), d = r[5];
    if (!sid || !d || !classOf[sid]) return;
    const dd = (d instanceof Date) ? d : new Date(d);
    if (Utilities.formatDate(dd, tz, 'yyyy-MM-dd') !== today) return;
    const cls = classOf[sid];
    if (rs.indexOf('정정') > -1) { // 오늘 이미 만든 정정 집계 (재실행 멱등)
      if (rs.indexOf('MVP') > -1) { fixedA['MVP|' + cls] = (fixedA['MVP|' + cls] || 0) + 1; return; }
      if (rs.indexOf('시냅스') > -1) { fixedA['시냅스|' + cls] = (fixedA['시냅스|' + cls] || 0) + 1; return; }
      if (rs.indexOf('일일한도') > -1) {
        Object.keys(DAILY_LIMIT).forEach(k => {
          if (rs.indexOf(k) > -1) fixedSR[sid + '|' + k] = (fixedSR[sid + '|' + k] || 0) + 1;
        });
      }
      return;
    }
    for (let a = 0; a < CLASS_AWARDS.length; a++) {
      if (pts > 0 && rs.indexOf(CLASS_AWARDS[a]) > -1) {
        const key = a + '|' + cls;
        if (!byAward[key]) byAward[key] = [];
        byAward[key].push({ sid: sid, pts: pts, t: dd.getTime() });
        return;
      }
    }
    if (pts > 0 && DAILY_LIMIT[rs]) { // 사유 정확 일치만 (오탐 방지)
      const key = sid + '|' + rs;
      if (!bySR[key]) bySR[key] = [];
      bySR[key].push({ sid: sid, pts: pts, t: dd.getTime(), rs: rs });
    }
  });
  const fixRows = [];
  Object.keys(byAward).forEach(key => {
    const a = Number(key.split('|')[0]), cls = key.split('|')[1];
    const tag = a === 0 ? 'MVP' : '시냅스';
    const list = byAward[key].sort((x, y) => x.t - y.t); // 최초 지급이 유효
    const need = (list.length - 1) - (fixedA[tag + '|' + cls] || 0);
    for (let k = 0; k < need; k++) {
      const x = list[list.length - 1 - k];
      fixRows.push([x.sid, -x.pts, '정정·' + tag + ' 중복(하루 1명)', 'SYSTEM']);
    }
  });
  Object.keys(bySR).forEach(key => {
    const list = bySR[key].sort((a, b) => a.t - b.t);
    const limit = DAILY_LIMIT[list[0].rs];
    const need = (list.length - limit) - (fixedSR[key] || 0);
    for (let k = 0; k < need; k++) {
      const x = list[list.length - 1 - k];
      fixRows.push([x.sid, -x.pts, '정정·일일한도(' + x.rs + ')', 'SYSTEM']);
    }
  });
  if (fixRows.length) {
    appendPoints(ss, fixRows);
    adminMail('[SYNK] ⚠️ 일일 한도 초과 자동 정정 ' + fixRows.length + '건',
      'MVP·시냅스는 반당 하루 1명, 숙제완료·생일은 학생당 하루 1회 규칙입니다.\n' +
      '초과 지급분을 자동 정정했습니다 (내일이 되면 다시 지급 가능).\n\n' +
      fixRows.map(r => '· ' + r[0] + ' ' + r[2] + ' ' + r[1] + 'P').join('\n'));
  }
  Logger.log('일일 가드: 정정 ' + fixRows.length + '건');
}

/* [v7.6] 일일 왕관(오늘의 MVP·오늘의 시냅스) 학부모 알림 — 반당 하루 1명씩의 희소 소식 (한·몽 병기, 통합 1통) */
function notifyDailyAwards() {
  if (!PARENT_MAIL_MVP) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const st = ss.getSheetByName('app_state');
  if (st && String(getState(st, 'MVP메일발송일').val) === today) return; // 재실행 중복 방지
  const pf = ss.getSheetByName('profiles');
  const pl = ss.getSheetByName('point_logs');
  if (!pf || !pl || pf.getLastRow() < 2 || pl.getLastRow() < 2) return;
  const info = {};
  pf.getRange(2, 1, pf.getLastRow() - 1, 26).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') info[r[0]] = { n: r[1] || r[0], c: r[4] || '', m: String(r[25] || '') };
  });
  const netM = {}, netS = {}; // 오늘 순계 (dailyGuard 정정 반영)
  (pl.getLastRow() < 2 ? [] : pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues()).forEach(r => { // [v8.7]
    const sid = r[1], pts = Number(r[2]) || 0, rs = String(r[3] || ''), d = r[5];
    if (!sid || !d || !info[sid]) return;
    const dd = (d instanceof Date) ? d : new Date(d);
    if (Utilities.formatDate(dd, tz, 'yyyy-MM-dd') !== today) return;
    if (rs.indexOf('MVP') > -1) netM[sid] = (netM[sid] || 0) + pts;
    else if (rs.indexOf('시냅스') > -1) netS[sid] = (netS[sid] || 0) + pts;
  });
  let sent = 0;
  const sids = {};
  Object.keys(netM).forEach(k => { sids[k] = 1; });
  Object.keys(netS).forEach(k => { sids[k] = 1; });
  Object.keys(sids).forEach(sid => {
    const hasM = (netM[sid] || 0) > 0, hasS = (netS[sid] || 0) > 0;
    if (!hasM && !hasS) return; // 정정으로 상쇄된 지급은 알림 제외
    const o = info[sid];
    if (o.m.indexOf('@') === -1) return;
    const title = hasM && hasS ? '🌟 ' + o.n + ' — 오늘의 MVP + 시냅스!'
      : hasM ? '🌟 ' + o.n + ' — 오늘의 MVP!'
      : '⚡ ' + o.n + ' — 오늘의 시냅스!';
    let body = '';
    if (hasM) body += o.n + ' 학생이 오늘 ' + o.c + ' 수업에서 최고의 참여자(오늘의 MVP)로 선정되었습니다! (+' + netM[sid] + 'P)\n' +
      '발표·태도·집중을 종합해 선생님이 하루 단 한 명에게 드리는 왕관입니다.\n\n';
    if (hasS) body += o.n + ' 학생이 오늘 가장 크게 성장한 학생(오늘의 시냅스)으로 선정되었습니다! (+' + netS[sid] + 'P)\n' +
      '어제의 나보다 한 걸음 — 노력과 태도에 드리는 하루 단 한 명의 왕관입니다.\n\n';
    body += '많이 칭찬해주세요 🎉\n\n';
    if (hasM) body += o.n + ' сурагч өнөөдрийн хичээлийн шилдэг оролцогчоор (MVP) шалгарлаа! (+' + netM[sid] + 'P)\n';
    if (hasS) body += o.n + ' сурагч өнөөдөр хамгийн их өссөн сурагчаар (Өнөөдрийн синапс) шалгарлаа! (+' + netS[sid] + 'P)\n';
    body += 'Багшийн өдөрт ганцхан хүнд өгдөг титэм — гэртээ магтаж урамшуулаарай 🎉';
    if (quotaOk(1)) MailApp.sendEmail(o.m, '[SYNK] ' + title, body);
    sent++;
  });
  if (st && sent) setState(st, 'MVP메일발송일', today);
  Logger.log('일일 왕관 학부모 메일: ' + sent + '통');
}

/* [v7.3] 조사 헬퍼 — 받침 판정(바트카가/테무진이), 비한글(이모지 등)은 병기 폴백 */
function josa(w, a, b) {
  const s = String(w || '');
  const c = s.charCodeAt(s.length - 1);
  if (c >= 0xAC00 && c <= 0xD7A3) return ((c - 0xAC00) % 28 !== 0) ? a : b;
  return a + '(' + b + ')';
}

/* ===================== [v7.3] 일일 전투 리포트 ===================== */
// 월~목·토 22시 (nightJobs) — 오늘 반별 데미지를 RPG 전투 서사로 자동 변환 → raid_story 시트
function raidStoryDaily() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const dy = now.getDay();
  if (dy === 5 || dy === 0) return; // 금·일은 결산 스토리가 담당
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const weekKey = Utilities.formatDate(monday, tz, 'yyyy-MM-dd');

  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return;
  const classOf = {}, nameOf = {};
  pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
    if (r[0] && r[3] === 'student' && r[4]) { classOf[r[0]] = r[4]; nameOf[r[0]] = r[1] || r[0]; }
  });
  const pl = ss.getSheetByName('point_logs');
  if (!pl || pl.getLastRow() < 2) return;
  const dayD = {}, weekD = {}, topReason = {}, crM = {}, crS = {}; // [v7.7]
  pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => {
    const sid = r[1], pts = Number(r[2]) || 0, d = r[5];
    const isE = pts > 0 || String(r[3] || '').indexOf('정정') > -1; // [v7.4]
    if (!sid || !d || !isE || pts === 0 || !classOf[sid]) return;
    const dd = (d instanceof Date) ? d : new Date(d);
    const cls = classOf[sid];
    if (dd >= monday) weekD[cls] = (weekD[cls] || 0) + pts;
    if (Utilities.formatDate(dd, tz, 'yyyy-MM-dd') === today) {
      if (!dayD[cls]) dayD[cls] = {};
      dayD[cls][sid] = (dayD[cls][sid] || 0) + pts;
      if (!topReason[sid]) topReason[sid] = String(r[3] || '');
      const rsC = String(r[3] || ''); // [v7.7] 오늘의 왕관 순계(정정 자동 상쇄)
      if (rsC.indexOf('MVP') > -1) { if (!crM[cls]) crM[cls] = {}; crM[cls][sid] = (crM[cls][sid] || 0) + pts; }
      else if (rsC.indexOf('시냅스') > -1) { if (!crS[cls]) crS[cls] = {}; crS[cls][sid] = (crS[cls][sid] || 0) + pts; }
    }
  });
  // 연료 (주간 게이지 + 오늘 합동 공격)
  const fuelMap = {};
  const ct = ss.getSheetByName('contents');
  if (ct && ct.getLastRow() >= 2) {
    ct.getRange(2, 1, ct.getLastRow() - 1, 6).getValues().forEach(r => {
      if (r[1] === 'fuel' && r[2]) fuelMap[String(r[2])] = Number(r[5]) || 0;
    });
  }
  const fuelToday = {}, fSeenD = new Set(); // [v7.5] 주 1회 dedup
  const cf = ss.getSheetByName('class_fuel');
  if (cf && cf.getLastRow() >= 2) {
    cf.getRange(2, 1, cf.getLastRow() - 1, 4).getValues().forEach(r => {
      const cls = r[0], m = String(r[1] || ''), d = r[3];
      if (!cls || !d || !fuelMap[m]) return;
      const dd = (d instanceof Date) ? d : new Date(d);
      if (dd >= monday && !fSeenD.has(cls + '|' + m)) {
        fSeenD.add(cls + '|' + m);
        weekD[cls] = (weekD[cls] || 0) + fuelMap[m];
        if (Utilities.formatDate(dd, tz, 'yyyy-MM-dd') === today) {
          fuelToday[cls] = (fuelToday[cls] || 0) + fuelMap[m];
          if (!dayD[cls]) dayD[cls] = {};
        }
      }
    });
  }
  // 이번 주 보스 HP
  const hpOf = {};
  const rd = ss.getSheetByName('raid');
  if (rd && rd.getLastRow() >= 2) {
    rd.getRange(2, 1, rd.getLastRow() - 1, 3).getValues().forEach(r => {
      if (dstr(r[0], tz) === weekKey) hpOf[r[1]] = Number(r[2]) || 0;
    });
  }
  const boss = bossOfMonth(ss, Number(Utilities.formatDate(now, tz, 'M')));
  const bN = boss ? boss.name : '이달의 보스';
  const PARTS = ['왼쪽 눈', '오른쪽 뿔', '꼬리', '왼팔', '코어', '등딱지', '오른발'];
  const VERB = { '숙제': '숙제 완검(完劍)으로', 'MVP': '오늘의 MVP 필살기로', '시냅스': '반짝이는 시냅스 스파크로', '칭찬': '빛나는 태도 광선으로',
                 '생일': '생일 축포로', '출석': '출석 러시로', '레이드': '승리의 기세로' };
  function verbOf(rs) { for (var k in VERB) { if (rs.indexOf(k) > -1) return VERB[k]; } return '기습 공격으로'; }
  function pick(arr, seed) {
    let h = 0; const s = String(seed);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
    return arr[h % arr.length];
  }
  const rsSh = ensureSheet(ss, 'raid_story', ['date','class_name','유형','제목','스토리']);
  const dupe = new Set();
  if (rsSh.getLastRow() >= 2) {
    rsSh.getRange(2, 1, rsSh.getLastRow() - 1, 3).getValues().forEach(r => {
      if (String(r[2]) === '일일') dupe.add(dstr(r[0], tz) + '|' + r[1]);
    });
  }
  const out = [];
  Object.keys(dayD).forEach(cls => {
    if (dupe.has(today + '|' + cls)) return;
    const hits = Object.keys(dayD[cls])
      .map(sid => ({ sid: sid, n: nameOf[sid] || sid, d: dayD[cls][sid] }))
      .filter(x => x.d > 0).sort((a, b) => b.d - a.d); // [v7.4] 정정 상쇄분 제외
    const tot = hits.reduce((s, x) => s + x.d, 0) + (fuelToday[cls] || 0);
    if (tot <= 0) return;
    const lines = [];
    if (hits[0]) {
      const p0 = pick(PARTS, today + cls + hits[0].sid);
      lines.push('⚡ ' + hits[0].n + josa(hits[0].n, '이', '가') + ' ' + verbOf(topReason[hits[0].sid] || '') + ' ' + bN +
        '의 ' + p0 + josa(p0, '을', '를') + ' 강타! (' + hits[0].d + ' 데미지)');
    }
    if (hits[1]) lines.push('연이어 ' + hits[1].n + '의 공격이 ' + pick(PARTS, today + cls + hits[1].sid) + '에 명중! (' + hits[1].d + ')');
    if (hits.length > 2) lines.push('그리고 ' + (hits.length - 2) + '명의 동료들이 함께 몰아붙였다! (+' +
      hits.slice(2).reduce((s, x) => s + x.d, 0) + ')');
    if (fuelToday[cls]) lines.push('🔥 연료 미션 합동 공격 작렬! (+' + fuelToday[cls] + ')');
    const hp = hpOf[cls] || 0;
    if (hp > 0) {
      const remain = Math.max(hp - (weekD[cls] || 0), 0);
      if (remain === 0) lines.push('💥 ' + bN + '이(가) 이미 빈사 상태다… 정산일의 확인 사살만 남았다!');
      else lines.push('🩸 ' + bN + ' 남은 HP: ' + remain + ' / ' + hp);
    }
    const crowns = []; // [v7.7] 👑 오늘의 왕관 코너
    if (crM[cls]) Object.keys(crM[cls]).forEach(s => { if (crM[cls][s] > 0) crowns.push('🌟 MVP: ' + (nameOf[s] || s)); });
    if (crS[cls]) Object.keys(crS[cls]).forEach(s => { if (crS[cls][s] > 0) crowns.push('⚡ 시냅스: ' + (nameOf[s] || s)); });
    if (crowns.length) lines.push('👑 오늘의 왕관 — ' + crowns.join(' · '));
    out.push([today, cls, '일일', '⚔️ ' + cls + ' — 오늘 ' + tot + ' 데미지!', lines.join(' ')]);
  });
  if (out.length) rsSh.getRange(rsSh.getLastRow() + 1, 1, out.length, 5).setValues(out);
  Logger.log('일일 전투 리포트: ' + out.length + '개 반');
}

/* ===================== 시간표 / 미등원 ===================== */

function setupSchedule() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sc = ss.getSheetByName('schedule');
  if (!sc) { sc = ss.insertSheet('schedule'); sc.setFrozenRows(1); }
  sc.clear();
  sc.getRange(1, 1, 1, 3).setValues([['반', '요일유형', '시작시간']]);
  const rows = [
    ['정규반1','평일','11:00'], ['정규반2','평일','14:00'], ['정규반3','평일','15:30'], ['정규반4','평일','18:00'],
    ['집중반1','평일','11:00'], ['집중반2','평일','11:00'], ['집중반3','평일','14:00'],
    ['집중반4','평일','15:30'], ['집중반5','평일','18:00'], ['집중반6','평일','18:00'],
    ['주말정규반1','주말','11:00'], ['주말정규반2','주말','15:30'],
    ['주말집중반1','주말','11:00'], ['주말집중반2','주말','11:00'], ['주말집중반3','주말','15:30']
  ];
  sc.getRange(2, 1, rows.length, 3).setValues(rows);
  Logger.log('시간표 ' + rows.length + '개 반 생성');
}

function checkNoShow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const day = now.getDay();
  const type = (day === 0 || day === 6) ? '주말' : '평일';
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const map = scheduleMap(ss);
  const targets = Object.keys(map).filter(num => map[num].name === num).filter(num => { // [v8.3] 반명 키만
    if (map[num].type !== type) return false;
    const p = map[num].time.split(':');
    const start = Number(p[0]) * 60 + Number(p[1]);
    return nowMin >= start + 30 && nowMin < start + 90;
  });
  if (targets.length === 0) return;

  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const at = ss.getSheetByName('attendance');
  const atLast = at.getLastRow();
  const todayAtt = new Set();
  if (atLast >= 2) {
    at.getRange(2, 1, atLast - 1, 3).getValues().forEach(r => {
      if (r[1] && r[2] && dstr(r[2], tz) === todayStr) todayAtt.add(r[1]);
    });
  }
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return; // [v8.2] 콜드 가드
  const pfData = pf.getRange(2, 1, pf.getLastRow() - 1, 15).getValues();

  targets.forEach(num => {
    const key = '미등원_' + todayStr + '_정규반' + num;
    if (getState(st, key).row > 0) return;
    const absent = pfData.filter(r =>
      r[0] && r[3] === 'student' && (String(r[4]) === num || (map[classNumOf(r[4])] && map[classNumOf(r[4])].name === num)) && !todayAtt.has(r[0])); // [v8.8] 번호 폴백은 '유일 번호'일 때만 — 신체계 트랙 간 오매칭 차단
    if (absent.length > 0 && quotaOk(1)) {
      MailApp.sendEmail(ADMIN_EMAIL,
        '[SYNK] ⚠️ ' + num + ' 미등원 ' + absent.length + '명 (' + map[num].time + ')',
        map[num].time + ' 시작 ' + num + ' 수업 30분 경과, 미출석:\n\n' +
        absent.map(r => '· ' + r[0] + ' ' + r[1] +
          (r[13] ? ' (보호자 ' + r[13] + ')' : '')).join('\n') +
        '\n\n학부모 연락을 권장합니다.');
    }
    setState(st, key, absent.length + '명');
  });
  Logger.log('미등원 체크: ' + targets.length + '개 반');
}

/* ===================== 진화 감지 + 임박 알림 ===================== */

function checkEvolution() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pf = ss.getSheetByName('profiles');
  const last = pf.getLastRow();
  if (last < 2) return;
  if (pf.getRange('AA1').getValue() !== '이전몬스터') pf.getRange('AA1').setValue('이전몬스터');
  if (pf.getRange('AD1').getValue() !== '진화임박알림') pf.getRange('AD1').setValue('진화임박알림');

  const data = pf.getRange(2, 1, last - 1, 30).getValues();
  const ct = ss.getSheetByName('contents');
  const order = {};
  if (ct.getLastRow() >= 2) {
    let i = 0;
    ct.getRange(2, 1, ct.getLastRow() - 1, 6).getValues().forEach(r => {
      if (r[1] === 'monster') order[r[2]] = i++;
    });
  }

  const newAA = [], newAD = [], evolved = [], imminent = [];
  data.forEach(r => {
    const cur = String(r[18] || '');   // S 몬스터단계
    const prev = String(r[26] || '');  // AA 이전몬스터
    const pct = Number(r[19]) || 0;    // T 진화진행률
    const adPrev = String(r[29] || '');// AD 진화임박알림(단계)
    newAA.push([cur]);
    let ad = adPrev;
    if (r[0] && r[3] === 'student') {
      if (prev && cur !== prev && (order[cur] || 0) > (order[prev] || 0)) {
        evolved.push({ id: r[0], name: r[1], from: prev, to: cur,
                       pEmail: String(r[25] || '').trim() });
      }
      if (pct >= 90 && cur && adPrev !== cur) {
        imminent.push('· ' + r[0] + ' ' + r[1] + ' — ' + cur + ' ' + pct + '%');
        ad = cur;
      }
    }
    newAD.push([ad]);
  });

  writeIfChanged(pf, 2, 27, newAA);
  writeIfChanged(pf, 2, 30, newAD);

  if (evolved.length) {
    const withEmail = PARENT_MAIL_EVOLUTION ? evolved.filter(e => e.pEmail.indexOf('@') > -1) : []; // [v5.4] 진화는 인앱 전용
    if (quotaOk(withEmail.length + 1)) {
      withEmail.forEach(e => {
        MailApp.sendEmail(e.pEmail,
          '[SYNK] 🐣→🐲 ' + e.name + ' 학생의 몬스터가 진화했어요!',
          e.name + ' 학생의 SYNK 몬스터가 [' + e.from + '] 에서 [' + e.to +
          '] (으)로 진화했습니다!\n꾸준한 노력의 결과예요. 많이 칭찬해주세요 🎉\n\n- SYNK 학원');
      });
      adminMail('[SYNK] 🐲 몬스터 진화 ' + evolved.length + '명',
        evolved.map(e => '· ' + e.id + ' ' + e.name + ': ' + e.from + ' → ' + e.to).join('\n')); // [v5.4] 브리핑 통합
    }
  }
  if (imminent.length) { // [v5.4] 브리핑 통합
    adminMail('[SYNK] ✨ 진화 임박 ' + imminent.length + '명 (90%+)',
      '조금만 더 하면 진화하는 학생들입니다. 수업에서 살짝 응원해주세요!\n\n' +
      imminent.join('\n'));
  }
  Logger.log('진화 ' + evolved.length + ' / 임박 ' + imminent.length);
}

/* ===================== 강사 케어 지수 ===================== */

function calcTeacherStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pf = ss.getSheetByName('profiles');
  const last = pf.getLastRow();
  if (last < 2) return [];
  const data = pf.getRange(2, 1, last - 1, 25).getValues();

  const t = {};
  data.forEach(r => {
    if (!r[0] || r[3] !== 'student' || !r[4]) return;
    const teacher = String(r[4]).split('(')[0].trim();
    if (!t[teacher]) t[teacher] = { n: 0, att: 0, pts: 0, praise: 0 };
    t[teacher].n++;
    t[teacher].att += Number(r[21]) || 0;
    t[teacher].pts += Number(r[16]) || 0;
    t[teacher].praise += Number(r[23]) || 0;
  });

  // [v7.8] 👑 왕관 공정성 — 강사별 이번 달 왕관 수 + 편중도(한 학생 최다 비중 %, 60%↑면 골고루 권장)
  const tz8 = ss.getSpreadsheetTimeZone();
  const ym8 = Utilities.formatDate(new Date(), tz8, 'yyyy-MM');
  const crownBy = {};
  const clsOfT = {};
  data.forEach(r => { if (r[0] && r[3] === 'student' && r[4]) clsOfT[r[0]] = String(r[4]).split('(')[0].trim(); });
  const pl8 = ss.getSheetByName('point_logs');
  if (pl8 && pl8.getLastRow() >= 2) {
    pl8.getRange(2, 1, pl8.getLastRow() - 1, 6).getValues().forEach(r => {
      const rs = String(r[3] || ''), pts = Number(r[2]) || 0, d = r[5];
      if (pts <= 0 || !d || rs.indexOf('정정') > -1) return;
      if (rs.indexOf('MVP') === -1 && rs.indexOf('시냅스') === -1) return;
      const dd = (d instanceof Date) ? d : new Date(d);
      if (Utilities.formatDate(dd, tz8, 'yyyy-MM') !== ym8) return;
      const cl = clsOfT[r[1]];
      if (!cl) return;
      if (!crownBy[cl]) crownBy[cl] = { tot: 0, bySid: {} };
      crownBy[cl].tot++;
      crownBy[cl].bySid[r[1]] = (crownBy[cl].bySid[r[1]] || 0) + 1;
    });
  }
  const rows = Object.keys(t).map(k => {
    const v = t[k];
    const perAtt = v.att / v.n, perPts = v.pts / v.n, perPraise = v.praise / v.n;
    const cb = crownBy[k] || { tot: 0, bySid: {} };
    let mx = 0;
    Object.keys(cb.bySid).forEach(s => { if (cb.bySid[s] > mx) mx = cb.bySid[s]; });
    const share = cb.tot ? Math.round(mx * 100 / cb.tot) : 0;
    return [k, v.n, Number(perAtt.toFixed(1)), Number(perPts.toFixed(1)),
            Number(perPraise.toFixed(1)),
            Math.round(perAtt * 12 + perPts * 1), // [v7.9] 시냅스(반당 1명) 체제에서 praise 변별력 소멸 — 출석 중심 재조정
            cb.tot, share];
  }).sort((a, b) => b[5] - a[5]);

  const ts = ensureSheet(ss, 'teacher_stats',
    ['강사','담당학생수','1인당출석','1인당포인트','1인당칭찬','케어지수','이번달왕관','왕관편중%']);
  if (ts.getRange(1, 7).getValue() !== '이번달왕관') ts.getRange(1, 7).setValue('이번달왕관'); // [v7.8]
  if (ts.getRange(1, 8).getValue() !== '왕관편중%') ts.getRange(1, 8).setValue('왕관편중%');
  const tsLast = ts.getLastRow();
  if (tsLast - 1 > rows.length && rows.length >= 0) {
    ts.getRange(rows.length + 2, 1, Math.max(tsLast - 1 - rows.length, 1), 8).clearContent();
  }
  if (rows.length) writeIfChanged(ts, 2, 1, rows);
  return rows;
}

/* ===================== 월말 경영 리포트 ===================== */

function monthlyReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = Utilities.formatDate(lastMonthDate, tz, 'yyyy-MM');
  if (!quotaOk(1)) return;

  function readLogs(name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return [];
    return sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
  }
  const logs = readLogs('point_logs').concat(readLogs('point_logs_archive'))
    .filter(r => String(r[6]) === lastMonth);

  let issued = 0, deducted = 0;
  const byStudent = {};
  logs.forEach(r => {
    const p = Number(r[2]) || 0;
    if (p > 0) issued += p; else deducted += -p;
    if (r[1]) byStudent[r[1]] = (byStudent[r[1]] || 0) + p;
  });

  const pf = ss.getSheetByName('profiles');
  const pfData = pf.getLastRow() >= 2
    ? pf.getRange(2, 1, pf.getLastRow() - 1, 25).getValues() : [];
  const students = pfData.filter(r => r[0] && r[3] === 'student');
  const riskHigh = students.filter(r => String(r[24]).startsWith('상')).length;
  const riskMid = students.filter(r => String(r[24]).startsWith('중')).length;

  function regYM(v) {
    if (!v) return '';
    if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM');
    const s = String(v).replace(/\D/g, '');
    return s.length === 8 ? s.substring(0, 4) + '-' + s.substring(4, 6) : '';
  }
  const newStudents = students.filter(r => regYM(r[11]) === lastMonth);
  const tRows = calcTeacherStats() || [];

  const insights = [];
  if (deducted === 0 && issued > 0) {
    insights.push('포인트가 발행만 되고 사용되지 않고 있습니다. 스토어 상품 홍보를 권장합니다.');
  } else if (issued > 0 && deducted / issued < 0.2) {
    insights.push('포인트 사용률 ' + Math.round(deducted / issued * 100) + '%로 낮습니다. 스토어 활성화가 필요합니다.');
  }
  if (riskHigh > 0) insights.push('이탈위험(상) ' + riskHigh + '명. 이번 주 우선 케어 대상으로 지정하세요.');
  if (students.length > 0 && riskHigh / students.length >= 0.3) {
    insights.push('전체의 30% 이상이 이탈위험(상)입니다. 출석 관리 점검이 필요합니다.');
  }
  if (newStudents.length === 0) insights.push('지난달 신규 등록이 없었습니다. 마케팅/상담 파이프라인 점검을 권장합니다.');
  if (tRows.length >= 2 && tRows[0][5] > 0) {
    insights.push('이달의 강사: ' + tRows[0][0] + ' (케어지수 ' + tRows[0][5] + ').');
  }
  if (insights.length === 0) insights.push('특이사항 없이 안정적으로 운영되고 있습니다.');

  let body = '📈 SYNK 월말 경영 리포트 — ' + lastMonth + '\n\n';
  body += '👥 재원생 ' + students.length + '명 (지난달 신규 ' + newStudents.length + '명)\n';
  body += '💰 포인트: 발행 ' + issued + 'P / 사용 ' + deducted + 'P\n';
  body += '⚠️ 이탈위험: 상 ' + riskHigh + ' · 중 ' + riskMid + '\n\n';
  body += '🏆 지난달 TOP 3\n';
  const top = Object.keys(byStudent).filter(id => byStudent[id] > 0)
    .sort((a, b) => byStudent[b] - byStudent[a]).slice(0, 3);
  body += top.length ? top.map((id, i) => {
    const s = students.find(r => r[0] === id);
    return (i + 1) + '위 ' + (s ? s[1] : id) + ' — ' + byStudent[id] + 'P';
  }).join('\n') + '\n' : '기록 없음\n';
  body += '\n🧑‍🏫 강사 케어지수\n';
  tRows.forEach(r => { body += '· ' + r[0] + ': ' + r[5] + '점 (담당 ' + r[1] + '명)\n'; });
  body += '\n💡 인사이트\n' + insights.map(s => '→ ' + s).join('\n');

  if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 📈 ' + lastMonth + ' 월말 경영 리포트', body);
  Logger.log('월말 리포트 발송');
}

/* ===================== 월별 아카이빙 (잔액 보존) ===================== */

function archiveMonthly() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const thisMonth = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
  const lock = LockService.getScriptLock();
  lock.waitLock(60000);
  try {
    const pl = ss.getSheetByName('point_logs');
    const plLast = pl.getLastRow();
    if (plLast < 2) return;

    const arc = ensureSheet(ss, 'point_logs_archive',
      ['log_id','student_id','points','reason','given_by','created_at','연월']);
    const co = ensureSheet(ss, 'carryover', ['student_id', 'points']);
    if (co.getRange(1, 3).getValue() !== 'earned') co.getRange(1, 3).setValue('earned'); // [v7.1]

    const carry = {}; // [v7.1] {n: 잔액, e: 획득 누계}
    if (co.getLastRow() >= 2) {
      co.getRange(2, 1, co.getLastRow() - 1, 3).getValues().forEach(r => {
        if (!r[0]) return;
        const n = Number(r[1]) || 0;
        carry[r[0]] = { n: n, e: (r[2] !== '' && r[2] !== null && r[2] !== undefined) ? (Number(r[2]) || 0) : n };
      });
    }
    const data = pl.getRange(2, 1, plLast - 1, 7).getValues();
    const keep = [], move = [];
    data.forEach(r => {
      const ym = String(r[6]);
      if (ym && ym < thisMonth) {
        move.push(r);
        if (r[1]) {
          if (!carry[r[1]]) carry[r[1]] = { n: 0, e: 0 };
          const p = Number(r[2]) || 0;
          carry[r[1]].n += p;
          if (p > 0 || String(r[3]).indexOf('정정') > -1) carry[r[1]].e += p; // [v7.1]
        }
      } else keep.push(r);
    });
    if (move.length === 0) { Logger.log('아카이빙 대상 없음'); return; }

    arc.getRange(arc.getLastRow() + 1, 1, move.length, 7).setValues(move);
    pl.getRange(2, 1, data.length, 7).clearContent();
    if (keep.length) pl.getRange(2, 1, keep.length, 7).setValues(keep);

    const coOut = Object.keys(carry).map(k => [k, carry[k].n, carry[k].e]); // [v7.1]
    if (co.getLastRow() > 1) co.getRange(2, 1, co.getLastRow() - 1, 3).clearContent();
    if (coOut.length) co.getRange(2, 1, coOut.length, 3).setValues(coOut);

    pruneAppState(ss, thisMonth);
    Logger.log('아카이빙: ' + move.length + '건, 이월 ' + coOut.length + '명');
  } finally { lock.releaseLock(); }
  calcAll();
}

// app_state에서 오래된 미등원 키 정리
function pruneAppState(ss, thisMonth) {
  const st = ss.getSheetByName('app_state');
  if (!st || st.getLastRow() < 2) return;
  const data = st.getRange(1, 1, st.getLastRow(), 2).getValues();
  const kept = data.filter((r, i) => {
    if (i === 0) return true; // 헤더
    const k = String(r[0]);
    if (!k) return false;
    if (k.startsWith('미등원_')) return k.substring(4, 11) === thisMonth; // 이번달만 유지
    return true;
  });
  st.getRange(1, 1, data.length, 2).clearContent();
  st.getRange(1, 1, kept.length, 2).setValues(kept);
}

/* ===================== 월간 게임 배치 (칭호·스냅샷·스토리) ===================== */

function monthlyGameBatch() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const ym = Utilities.formatDate(lastMonthDate, tz, 'yyyy-MM');

  // [v7.5] 월 1회 강제 — 재실행 시 출석정산·칭호보너스 중복 지급 원천 차단
  const stG5 = ss.getSheetByName('app_state');
  if (stG5 && String(getState(stG5, '게임배치완료월').val) === ym) {
    Logger.log('게임배치: ' + ym + ' 이미 완료 — 스킵 (재실행하려면 app_state 키 삭제)');
    return;
  }

  // 중복 실행 방지
  const snap = ensureSheet(ss, 'monthly_snapshot', ['월', 'student_id', '월간포인트', '랭킹']);
  if (snap.getLastRow() >= 2) {
    const done = snap.getRange(2, 1, snap.getLastRow() - 1, 1).getValues()
      .some(r => String(r[0]) === ym);
    if (done) { Logger.log(ym + ' 게임배치 이미 완료 — 스킵'); return; }
  }

  function readLogs(name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return [];
    return sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
  }
  const logs = readLogs('point_logs').concat(readLogs('point_logs_archive'))
    .filter(r => String(r[6]) === ym && r[1]);

  const mPts = {}, praiseCnt = {}, hwCnt = {}, spkCnt = {}; // [v5.1] ([v5.2] storeUse 제거)
  logs.forEach(r => {
    const sid = r[1], p = Number(r[2]) || 0;
    const rs = String(r[3]);
    if (p > 0 || rs.indexOf('정정') > -1) mPts[sid] = (mPts[sid] || 0) + p; // [v7.1] 획득 기준
    if (rs.indexOf('시냅스') > -1 && rs.indexOf('정정') === -1) praiseCnt[sid] = (praiseCnt[sid] || 0) + 1; // [v7.6] 오늘의 시냅스 최다
    if (rs.indexOf('숙제') > -1 && rs.indexOf('정정') === -1) hwCnt[sid] = (hwCnt[sid] || 0) + 1; // [v7.5]
    if (rs.indexOf('MVP') > -1 && rs.indexOf('정정') === -1) spkCnt[sid] = (spkCnt[sid] || 0) + 1; // [v7.4] 정정 제외
  });

  const pf = ss.getSheetByName('profiles');
  const pfLast = pf.getLastRow();
  if (pfLast < 2) return;
  const pfData = pf.getRange(2, 1, pfLast - 1, 26).getValues();
  const students = pfData.filter(r => r[0] && r[3] === 'student');
  const clsOf = {}, nameOf = {}, regOf = {};
  students.forEach(r => {
    clsOf[r[0]] = r[4] || '';
    nameOf[r[0]] = r[1];
    regOf[r[0]] = r[11];
  });

  // 랭킹 (0P 이하 = 999)
  const ranked = students.map(r => ({ id: r[0], m: mPts[r[0]] || 0 }))
    .sort((a, b) => b.m - a.m);
  const rank = {};
  ranked.forEach((s, i) => {
    if (s.m <= 0) { rank[s.id] = 999; return; }
    rank[s.id] = (i > 0 && s.m === ranked[i-1].m) ? rank[ranked[i-1].id] : i + 1;
  });

  // 전월 스냅샷
  const prevYm = Utilities.formatDate(
    new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() - 1, 1), tz, 'yyyy-MM');
  const prevPts = {}, prevRank = {};
  if (snap.getLastRow() >= 2) {
    snap.getRange(2, 1, snap.getLastRow() - 1, 4).getValues().forEach(r => {
      if (String(r[0]) === prevYm) {
        prevPts[r[1]] = Number(r[2]) || 0;
        prevRank[r[1]] = Number(r[3]) || 999;
      }
    });
  }

  // 출석 (지난달)
  const at = ss.getSheetByName('attendance');
  const attDays = {}, lateCnt = {};
  if (at.getLastRow() >= 2) {
    at.getRange(2, 1, at.getLastRow() - 1, 4).getValues().forEach(r => {
      const sid = r[1]; const d = r[2];
      if (!sid || !d) return;
      const ds = dstr(d, tz);
      if (!ds.startsWith(ym)) return;
      if (!attDays[sid]) attDays[sid] = new Set();
      attDays[sid].add(ds);
      if (String(r[3]).indexOf('지각') > -1) lateCnt[sid] = (lateCnt[sid] || 0) + 1;
    });
  }

  const anyLate = Object.keys(lateCnt).length > 0; // [v5.1] 지각 기록이 있는 달만 지각 제로 수여

  // 수업일 리스트 (반 유형 + 등록일 반영)
  const schMap = scheduleMap(ss);
  const y = lastMonthDate.getFullYear(), mIdx = lastMonthDate.getMonth();
  const daysInMonth = new Date(y, mIdx + 1, 0).getDate();
  function parseReg(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    const s = String(v).replace(/\D/g, '');
    if (s.length === 8) return new Date(Number(s.substring(0,4)), Number(s.substring(4,6)) - 1, Number(s.substring(6,8)));
    return null;
  }
  function schedDaysOf(sid) {
    const eG = schedOf(schMap, clsOf[sid]); // [v8.3]
    const type = eG ? eG.type : '평일';
    const reg = parseReg(regOf[sid]);
    const list = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(y, mIdx, d);
      const isWe = (dt.getDay() === 0 || dt.getDay() === 6);
      if ((type === '주말') !== isWe) continue;
      if (reg && dt < reg) continue;
      list.push(ym + '-' + ('0' + d).slice(-2));
    }
    return list;
  }
  function schedRun(sid, list) { // 수업일 기준 최장 연속 출석
    const set = attDays[sid];
    if (!set) return 0;
    let best = 0, run = 0;
    list.forEach(ds => {
      if (set.has(ds)) { run++; best = Math.max(best, run); }
      else run = 0;
    });
    return best;
  }

  // 레이드 주차/참여
  const rd = ss.getSheetByName('raid');
  const raidWeeks = new Set();
  if (rd && rd.getLastRow() >= 2) {
    rd.getRange(2, 1, rd.getLastRow() - 1, 1).getValues().forEach(r => {
      const wk = dstr(r[0], tz);
      if (wk.startsWith(ym)) raidWeeks.add(wk);
    });
  }
  const weekPos = {};
  logs.forEach(r => {
    const sid = r[1], p = Number(r[2]) || 0, d = r[5];
    if (p <= 0 || !d) return;
    const dd = (d instanceof Date) ? d : new Date(d);
    const mon = new Date(dd);
    mon.setDate(dd.getDate() - ((dd.getDay() + 6) % 7));
    const wk = Utilities.formatDate(mon, tz, 'yyyy-MM-dd');
    if (!weekPos[sid]) weekPos[sid] = new Set();
    weekPos[sid].add(wk);
  });

  // ---- 칭호 산출 ----
  const won = {};
  function give(sid, t) { if (!won[sid]) won[sid] = []; won[sid].push(t); }

  const runBySid = {}, daysBySid = {};
  students.forEach(r => {
    const sid = r[0];
    const list = schedDaysOf(sid);
    const days = attDays[sid] ? [...attDays[sid]].filter(ds => list.indexOf(ds) > -1).length : 0;
    const run = schedRun(sid, list);
    runBySid[sid] = run;
    daysBySid[sid] = days; // [v7.1] 출석 정산용
    const eG2 = schedOf(schMap, clsOf[sid]); // [v8.3]
    const type = eG2 ? eG2.type : '평일';

    if (list.length >= 4 && days >= list.length) give(sid, '👑 개근왕');
    if (anyLate && days > 0 && !(lateCnt[sid] > 0)) give(sid, '⏰ 지각 제로'); // [v5.1]
    if (run >= (type === '주말' ? 4 : 5)) give(sid, '🔥 불꽃 출석러');
    if (raidWeeks.size > 0 && weekPos[sid] &&
        [...raidWeeks].every(wk => weekPos[sid].has(wk))) give(sid, '⚔️ 레이드 영웅');
  });
  function giveTop(map, title) {
    let best = 0;
    Object.keys(map).forEach(k => best = Math.max(best, map[k]));
    if (best >= 1) Object.keys(map).forEach(k => { if (map[k] === best) give(k, title); });
  }
  giveTop(praiseCnt, '💝 정성왕');
  // [v5.1] '💰 칭찬 부자' 제거 — 칭찬이 고정 +3P라 정성왕과 항상 동일 순위(완전 중복)
  giveTop(hwCnt, '📚 숙제왕');           // [v5.1] 숙제 최다
  giveTop(spkCnt, '🌟 이달의 스타');     // [v7.2] MVP 최다 (명예 전용)
  // [v5.2] '🛍️ 포인트 플렉스' 제거 — 포인트 소비 경쟁 유도 배제 (양도·도박성 메커니즘 없음 정책)
  ranked.forEach(s => { if (s.m > 0 && rank[s.id] === 1) give(s.id, '🧠 시냅스 챔피언'); }); // [v5.1] 월간 1위
  if (Object.keys(prevPts).length) {
    let bestRate = -Infinity, bestSid = '';
    students.forEach(r => {
      const sid = r[0], cur = mPts[sid] || 0, prev = prevPts[sid];
      if (prev === undefined || cur <= prev) return;
      const rate = (cur - prev) / Math.max(prev, 1);
      if (rate > bestRate) { bestRate = rate; bestSid = sid; }
    });
    if (bestSid) give(bestSid, '🚀 로켓 성장');
    students.forEach(r => {
      const sid = r[0];
      if (prevRank[sid] && rank[sid] && rank[sid] < 999 &&
          prevRank[sid] - rank[sid] >= 5) give(sid, '🐎 다크호스');
    });
  }
  const byCls = {};
  students.forEach(r => {
    const c = clsOf[r[0]];
    if (!byCls[c]) byCls[c] = [];
    byCls[c].push(r[0]);
  });
  Object.keys(byCls).forEach(c => {
    if (byCls[c].length < 2) return;
    let best = 0, bestSid = '';
    byCls[c].forEach(sid => {
      if ((mPts[sid] || 0) > best) { best = mPts[sid]; bestSid = sid; }
    });
    if (bestSid && best > 0) give(bestSid, '🏋️ 우리 반 캐리');
  });

  // ---- 기록 ----
  const tt = ensureSheet(ss, 'titles', ['월', 'student_id', '칭호']);
  const ttRows = [];
  Object.keys(won).forEach(sid => won[sid].forEach(t => ttRows.push([ym, sid, t])));
  if (ttRows.length) tt.getRange(tt.getLastRow() + 1, 1, ttRows.length, 3).setValues(ttRows);

  const snapRows = students.map(r => [ym, r[0], mPts[r[0]] || 0, rank[r[0]] || 999]);
  snap.getRange(snap.getLastRow() + 1, 1, snapRows.length, 4).setValues(snapRows);

  // [v5] 클래스 리그 명예의 전당 + 챔피언 자동 공지 (이미 계산된 값 재사용)
  writeLeagueHistory(ss, tz, ym, mPts, rank, clsOf, nameOf);

  // [v5.7] 새 달 세계관 오프닝 — 이달의 보스 등장 공지 + 시즌 인트로 배너
  const nowMonth = Number(Utilities.formatDate(new Date(), tz, 'M'));
  const bossNew = bossOfMonth(ss, nowMonth);
  if (bossNew) {
    addNotice(ss, '⚔️ ' + nowMonth + '월의 보스 등장 — ' + bossNew.name,
      '"' + bossNew.entry + '"\n이번 달 레이드에서 우리 반의 힘으로 쓰러뜨리자! 🔥');
  }
  const stG = ss.getSheetByName('app_state');
  if (stG) {
    const ctS = ss.getSheetByName('contents');
    let sName = '', sTheme = '';
    if (ctS && ctS.getLastRow() >= 2) {
      ctS.getRange(2, 1, ctS.getLastRow() - 1, 6).getValues().forEach(r => {
        if (r[1] === 'season' && Number(r[5]) === nowMonth) { sName = String(r[2]); sTheme = String(r[3] || ''); }
      });
    }
    if (sName) setState(stG, '이달의시즌', nowMonth + '월 시즌 · ' + sName + (sTheme ? ' — ' + sTheme : ''));
  }

  // [v7.1] 월간 정산 — ① 칭호보너스: 조건형만 포인트(경쟁형 1위류는 명예만) ② 출석 1회당 +3P
  const TITLE_BONUS = { '👑 개근왕': [30, '칭호보너스·개근왕'], '⚔️ 레이드 영웅': [20, '칭호보너스·영웅'] };
  const settleRows = [];
  Object.keys(won).forEach(sid => won[sid].forEach(t => {
    if (TITLE_BONUS[t]) settleRows.push([sid, TITLE_BONUS[t][0], TITLE_BONUS[t][1], '시스템']);
  }));
  students.forEach(r => {
    const d = daysBySid[r[0]] || 0;
    if (d > 0) settleRows.push([r[0], d * 3, '출석정산 ' + ym + ' (' + d + '회)', '시스템']);
  });
  if (settleRows.length) appendPoints(ss, settleRows);

  ensureSheet(ss, 'manual_titles', ['student_id', '칭호', '부여자', '날짜']);

  // ---- SYNK 스토리 ----
  const story = ensureSheet(ss, 'story', ['월', 'student_id', '이름', '스토리']);
  const stRows = [];
  students.forEach(r => {
    const sid = r[0];
    const parts = [];
    if (won[sid] && won[sid].length) parts.push(won[sid].join(', ') + ' 칭호 획득!');
    const mp = mPts[sid] || 0;
    if (mp !== 0) parts.push('월간 ' + (mp > 0 ? '+' : '') + mp + 'P');
    if (runBySid[sid] >= 3) parts.push('최고 연속 출석 ' + runBySid[sid] + '일(수업일)');
    if (prevRank[sid] && rank[sid] < 999 && prevRank[sid] < 999 && rank[sid] < prevRank[sid])
      parts.push('랭킹 ' + prevRank[sid] + '위→' + rank[sid] + '위');
    if (!parts.length) parts.push('꾸준히 함께한 한 달');
    stRows.push([ym, sid, nameOf[sid], ym.replace('-', '년 ') + '월 — ' + parts.join(' · ')]);
  });
  story.getRange(story.getLastRow() + 1, 1, stRows.length, 4).setValues(stRows);

  // [v7.8] 🏆 왕관 시상식 준비 메일 — 실물 왕관·스티커 수여 명단 + 상장 문구(로어 재사용)
  if (ttRows.length && quotaOk(1)) {
    const loreMap = {};
    const ctA = ss.getSheetByName('contents');
    if (ctA && ctA.getLastRow() >= 2) {
      ctA.getRange(2, 1, ctA.getLastRow() - 1, 4).getValues()
        .forEach(r => { if (r[1] === 'lore' && r[2]) loreMap[String(r[2])] = String(r[3] || ''); });
    }
    const nmA = {}, clA = {};
    pfData.forEach(r => { if (r[0]) { nmA[r[0]] = r[1] || r[0]; clA[r[0]] = r[4] || ''; } });
    const byTitle = {};
    ttRows.forEach(t => {
      if (!byTitle[t[2]]) byTitle[t[2]] = [];
      byTitle[t[2]].push(nmA[t[1]] + (clA[t[1]] ? ' (' + clA[t[1]] + ')' : ''));
    });
    let aBody = ym + ' 왕관 시상식 준비물입니다.\n월 첫 수업 30초 세리머니 추천 — 실물 종이 왕관·스티커 수여 + 📸 학부모 공유용 사진!\n\n';
    Object.keys(byTitle).forEach(t => {
      aBody += t + ' — ' + byTitle[t].join(', ') + '\n';
      if (loreMap[t]) aBody += '   상장 문구: "' + loreMap[t] + '"\n';
    });
    MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 🏆 ' + ym + ' 왕관 시상식 준비', aBody);
  }

  // [v7.3] 최고 월간 기록(자기 경신 AS·AT) + 이달의 스토리(AU) — 학부모·여정 탭 원클릭 바인딩용
  if (pf.getMaxColumns() < 50) pf.insertColumnsAfter(pf.getMaxColumns(), 50 - pf.getMaxColumns()); // [v7.7]
  const stMap = {};
  stRows.forEach(r => { stMap[r[1]] = r[3]; });
  const prevBT = pf.getRange(2, 45, pfLast - 1, 2).getValues(); // AS·AT
  const bestOut = [], storyOut = [];
  pfData.forEach((r, i) => {
    if (!(r[0] && r[3] === 'student')) {
      bestOut.push([prevBT[i][0] || '', prevBT[i][1] || '']);
      storyOut.push(['']);
      return;
    }
    const cur = mPts[r[0]] || 0;
    const pb = Number(prevBT[i][0]) || 0;
    if (cur > pb) bestOut.push([cur, ym]);
    else bestOut.push([prevBT[i][0] || '', prevBT[i][1] || '']);
    storyOut.push([stMap[r[0]] || '']);
  });
  writeIfChanged(pf, 2, 45, bestOut);
  writeIfChanged(pf, 2, 47, storyOut);

  if (stG5) setState(stG5, '게임배치완료월', ym); // [v7.5]
  calcAll();
  Logger.log('게임배치 완료: 칭호 ' + ttRows.length + ' / 스토리 ' + stRows.length);
}

/* ===================== 누적 업적 ===================== */

// [v7.9] ⚠️ 업적 신규 추가 동결 — 일일 왕관 + 월간 칭호 + 영구 업적의 명예 3중 체계로 충분.
//        더 늘리면 전부 안 귀해진다. 여정 탭 노출은 최근 3개만 (마스터 체크리스트 참조).
function checkAchievements() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  const pf = ss.getSheetByName('profiles');
  const pfLast = pf.getLastRow();
  if (pfLast < 2) return;
  const pfData = pf.getRange(2, 1, pfLast - 1, 28).getValues();

  const ach = ensureSheet(ss, 'achievements', ['student_id', '업적', '등급', '달성일']);
  const has = new Set();
  if (ach.getLastRow() >= 2) {
    ach.getRange(2, 1, ach.getLastRow() - 1, 2).getValues()
      .forEach(r => has.add(r[0] + '|' + r[1]));
  }

  { // [v9.13] 🎯 히든 업적 3종 — 조건 비공개('?????'), 달성 순간 등급 '히든'으로 반짝 공개
    const plH = ss.getSheetByName('point_logs');
    const night = {}, tricolor = {}, firstStep = {};
    if (plH && plH.getLastRow() >= 2) {
      const dayKinds = {};
      plH.getRange(2, 1, plH.getLastRow() - 1, 6).getValues().forEach(rr => {
        const sid = rr[1], pts = Number(rr[2]) || 0;
        if (!sid || !rr[5] || pts <= 0) return;
        const dObj = (rr[5] instanceof Date) ? rr[5] : new Date(rr[5]);
        const d6 = dstr(dObj, tz);
        if (dObj.getHours() >= 21) night[sid] = 1;
        if (d6.slice(8) === '01') firstStep[sid] = 1;
        const k = sid + '|' + d6;
        (dayKinds[k] = dayKinds[k] || {})[String(rr[3] || '')] = 1;
      });
      Object.keys(dayKinds).forEach(k => {
        if (Object.keys(dayKinds[k]).length >= 3) tricolor[k.split('|')[0]] = 1;
      });
    }
    const hidRows = [];
    const hid = (map, name) => Object.keys(map).forEach(sid => {
      if (!has.has(sid + '|' + name)) { hidRows.push([sid, name, '히든', today]); has.add(sid + '|' + name); }
    });
    hid(night, '🌙 한밤의 시냅스');
    hid(tricolor, '🎨 하루 세 빛깔');
    hid(firstStep, '🌅 새 달의 첫 발자국');
    if (hidRows.length) ach.getRange(ach.getLastRow() + 1, 1, hidRows.length, 4).setValues(hidRows);
  }

  const ct = ss.getSheetByName('contents');
  const order = {};
  if (ct.getLastRow() >= 2) {
    let i = 0;
    ct.getRange(2, 1, ct.getLastRow() - 1, 6).getValues().forEach(r => {
      if (r[1] === 'monster') order[r[2]] = i++;
    });
  }

  const snap = ss.getSheetByName('monthly_snapshot');
  const bySid = {};
  if (snap && snap.getLastRow() >= 2) {
    snap.getRange(2, 1, snap.getLastRow() - 1, 4).getValues().forEach(r => {
      if (!bySid[r[1]]) bySid[r[1]] = [];
      bySid[r[1]].push({ ym: String(r[0]), pts: Number(r[2]) || 0, rank: Number(r[3]) || 999 });
    });
    Object.keys(bySid).forEach(k => bySid[k].sort((a, b) => a.ym < b.ym ? -1 : 1));
  }

  // [v5.1] 레이드 승수 (누적 업적용)
  function readLogs6(name) {
    const sh2 = ss.getSheetByName(name);
    if (!sh2 || sh2.getLastRow() < 2) return [];
    return sh2.getRange(2, 1, sh2.getLastRow() - 1, 6).getValues();
  }
  const raidWins = {}, hwAll = {}, spkAll = {}, praiseAll = {}; // [v5.9] 누적 노력 카운트
  readLogs6('point_logs').concat(readLogs6('point_logs_archive')).forEach(r => {
    const sid0 = r[1];
    if (!sid0) return;
    const rs0 = String(r[3]);
    if (rs0 === '레이드보상') raidWins[sid0] = (raidWins[sid0] || 0) + 1;
    if (rs0.indexOf('숙제') > -1 && rs0.indexOf('정정') === -1) hwAll[sid0] = (hwAll[sid0] || 0) + 1; // [v7.5]
    if (rs0.indexOf('MVP') > -1 && rs0.indexOf('정정') === -1) spkAll[sid0] = (spkAll[sid0] || 0) + 1; // [v7.4]
    if (rs0.indexOf('시냅스') > -1 && rs0.indexOf('정정') === -1) praiseAll[sid0] = (praiseAll[sid0] || 0) + 1; // [v7.6]
  });

  // [v5.9] 첫 출석일 — 재원 기념 업적용
  const firstAtt = {};
  const atA = ss.getSheetByName('attendance');
  if (atA && atA.getLastRow() >= 2) {
    atA.getRange(2, 1, atA.getLastRow() - 1, 3).getValues().forEach(r => {
      const sid0 = r[1], d0 = r[2];
      if (!sid0 || !d0) return;
      const t = (d0 instanceof Date) ? d0.getTime() : new Date(d0).getTime();
      if (t && (!firstAtt[sid0] || t < firstAtt[sid0])) firstAtt[sid0] = t;
    });
  }
  const newRows = [];
  function award(sid, name, grade) {
    if (has.has(sid + '|' + name)) return;
    newRows.push([sid, name, grade, today]);
    has.add(sid + '|' + name);
  }

  pfData.forEach(r => {
    const sid = r[0];
    if (!sid || r[3] !== 'student') return;
    const best = Math.max(Number(r[20]) || 0, Number(r[27]) || 0);
    const attended = r[22];
    const so = order[String(r[18] || '')] !== undefined ? order[String(r[18])] : -1;

    if (attended) award(sid, '첫 발걸음', '🥉');
    if (best >= 30) award(sid, '한 달의 약속', '🥈');
    if (best >= 60) award(sid, '두 달의 전설', '🥇');
    if (best >= 100) award(sid, '100일의 기적', '👑');
    if (so >= 1) award(sid, '알 깨고 나왔다!', '🥉');
    if (so >= 2) award(sid, '폭풍 성장기', '🥈');
    if (so >= 3) award(sid, '회로의 완성', '🥈');       // [v5.1] 서킷 도달
    if (so >= 4) award(sid, '거인의 증표', '🥇');
    if (so >= 5) award(sid, '몰입의 경지', '🥇');       // [v5.1] 플로우 도달
    if (so >= 6) award(sid, 'SYNK 마스터의 탄생', '👑');

    const hist = (bySid[sid] || []);
    if (hist.some(h => h.rank <= 3)) award(sid, '명예의 전당 입성', '🥇');

    // [v5.1] 신규 업적: 레이드·TOP10 단골
    if ((raidWins[sid] || 0) >= 1) award(sid, '레이드 첫 승', '🥉');
    if ((raidWins[sid] || 0) >= 5) award(sid, '레이드 5승 클럽', '🥇');

    // [v5.9] 누적 노력 + 재원 기념 (조용한 꾸준함이 반드시 보상받는 라인)
    if ((hwAll[sid] || 0) >= 30) award(sid, '숙제 30 클럽', '🥉');
    if ((hwAll[sid] || 0) >= 100) award(sid, '숙제 100 마스터', '🥇');
    if ((spkAll[sid] || 0) >= 8) award(sid, '무대 체질', '🥈'); // [v7.2] MVP 8회
    if ((praiseAll[sid] || 0) >= 10) award(sid, '시냅스 컬렉터', '🥈'); // [v7.6] 오늘의 시냅스 10회
    if (firstAtt[sid] && (Date.now() - firstAtt[sid]) >= 365 * 86400000) award(sid, '시냅스 1주년', '🥇');
    if (firstAtt[sid] && (Date.now() - firstAtt[sid]) >= 730 * 86400000) award(sid, '싱크 베테랑', '👑');
    let streak10 = 0, best10 = 0;
    hist.forEach(h => { if (h.rank <= 10) { streak10++; best10 = Math.max(best10, streak10); } else streak10 = 0; });
    if (best10 >= 3) award(sid, 'TOP10 단골', '🥇');
    const pos = hist.filter(h => h.pts > 0);
    for (let i = 2; i < pos.length; i++) {
      if (pos[i].pts > pos[i-1].pts && pos[i-1].pts > pos[i-2].pts) {
        award(sid, '진짜 주인공', '👑'); break;
      }
    }
  });

  if (newRows.length) {
    ach.getRange(ach.getLastRow() + 1, 1, newRows.length, 4).setValues(newRows);
    adminMail('[SYNK] 🏅 새 업적 ' + newRows.length + '건',
      newRows.map(r => '· ' + r[0] + ' — ' + r[2] + ' ' + r[1]).join('\n')); // [v5.4] 브리핑 통합
  }

  // [v7.7] 👑 왕관 컬렉션 — MVP·시냅스 누적 횟수를 AW·AX에 (여정 탭 "🌟 ×4 · ⚡ ×7" 표시용)
  if (pf.getMaxColumns() < 50) pf.insertColumnsAfter(pf.getMaxColumns(), 50 - pf.getMaxColumns());
  const crownOut = pfData.map(r =>
    (r[0] && r[3] === 'student') ? [spkAll[r[0]] || 0, praiseAll[r[0]] || 0] : ['', '']);
  writeIfChanged(pf, 2, 49, crownOut);

  Logger.log('업적: 신규 ' + newRows.length);
}

/* ===================== 상담 구글폼 ===================== */

function createConsultForm() { // [v9.19] 상담지 시트 v18.3 정합 — 문항 제목=시트 헤더명(19개 재정렬), 서술형→📝자유서술→노션. (구 v8.4=v18.1)
  const form = FormApp.create('SYNK LAB 크루 적성 파악 상담지')
    .setDescription('환영합니다! SYNK LAB 크루가 된 것을 축하드립니다.\n뇌과학 기반 맞춤 한국어 여정을 설계하기 위한 설문입니다. 솔직하게 답해주세요 🙂')
    .setCollectEmail(false);

  function txt(t, req) { const i = form.addTextItem().setTitle(t); if (req) i.setRequired(true); return i; }
  function para(t) { return form.addParagraphTextItem().setTitle(t); }
  function mc(t, opts, req) {
    const i = form.addMultipleChoiceItem().setTitle(t).setChoiceValues(opts);
    if (req) i.setRequired(true); return i;
  }

  form.addSectionHeaderItem().setTitle('PART 1 — 기본 인적사항');
  txt('이름(한국어)', true); txt('이름(몽골어)', true);
  form.addDateItem().setTitle('생년월일').setRequired(true);
  mc('성별', ['남', '여'], true);
  txt('연락처', true);
  txt('SNS_ID').setHelpText('페이스북/인스타그램 ID');
  txt('이메일', true).setHelpText('앱 로그인에 사용됩니다. 정확히 입력해주세요!');
  txt('거주지역');
  mc('최종학력', ['재학', '졸업', '휴학']); // [v9.19] v18.3: 학력→최종학력
  txt('보호자명', true);
  mc('보호자관계', ['엄마', '아빠', '형제/자매', '기타'], true);
  txt('보호자연락처', true);

  form.addSectionHeaderItem().setTitle('PART 1 — 어학 수준');
  mc('TOPIK급수', ['없음', '1급', '2급', '3급', '4급', '5급', '6급']);
  txt('TOPIK점수'); txt('기타인증서');
  mc('한국어수준', ['완전초보', '기초', '초중급', '중급', '고급'], true);
  txt('영어(점수/회화)').setHelpText('예: TOEIC 800 / 회화 중'); // [v9.19] v18.3: 영어수준→영어(점수/회화)
  mc('학습경로', ['독학', '학원', '온라인', 'K콘텐츠']).setHelpText('가장 주된 것 하나만');

  form.addSectionHeaderItem().setTitle('PART 2 — 동기와 목표');
  mc('핵심비전', ['토픽고득점', '유학진학', '취업비자', 'K컬처전문가', '비자행정', '생활회화'], true)
    .setHelpText('SYNK에 온 가장 큰 이유 하나만');
  para('나의 다짐 노트').setHelpText('한국 유학과 배움이 나에게 갖는 의미, 진짜 꿈');
  para('3-5년 후 목표');
  mc('TOPIK목표', ['1~2급', '3~4급', '5~6급']);
  txt('TOPIK목표기한').setHelpText('예: 2027-06'); // [v9.19] v18.3: 목표기한→TOPIK목표기한
  txt('대학진학시기').setHelpText('예: 2027년 3월');

  form.addSectionHeaderItem().setTitle('PART 3 — 한국 경험과 비자');
  mc('한국방문경험', ['없음', '관광', '단기연수', '장기체류']); // [v9.19] v18.3
  mc('비자신청이력', ['없음', '승인', '거절'], true); // [v9.19] v18.3
  mc('거절비자종류', ['C-3', 'D-4', 'D-2', '기타']).setHelpText('비자 거절 경험이 있을 때만'); // [v9.19] v18.3
  mc('가족한국체류', ['없음', '현재합법체류', '특이사항'], true); // [v9.19] v18.3

  form.addSectionHeaderItem().setTitle('PART 4 — 학업 계획과 재정');
  mc('희망진학과정', ['어학연수', '전문대', '학사', '편입', '석사', '박사', '취업비자준비']); // [v9.19] v18.3
  mc('희망진학지역', ['서울', '경기·인천', '지방국공립', '상관없음']); // [v9.19] v18.3
  mc('현재직업', ['학생', '직장인', '구직', '기타']);
  mc('학습가능시간', ['1시간 미만', '1~2시간', '2~3시간', '3시간 이상']).setHelpText('하루 평균 공부 시간'); // [v9.19] v18.3
  mc('목표달성시기', ['6개월(집중)', '1년(표준)', '2년(장기)']); // [v9.19] v18.3
  mc('졸업후진로', ['한국취업', '몽골귀국', '미정']);
  mc('핵심가치관', ['안정성', '고수입', '보람성취', '워라밸']);
  txt('지망대학1순위'); txt('지망대학2순위'); txt('지망대학3순위'); // [v9.19] v18.3: …순위
  txt('지망전공1순위'); txt('지망전공2순위'); txt('지망전공3순위'); // [v9.19] v18.3: …순위
  mc('유학예산', ['여유있음', '보통', '빠듯함'], true);
  mc('학비조달주체', ['부모님지원', '본인저축', '정부·기관장학금', '한국내근로', '기타'], true); // [v9.19] v18.3
  mc('가족지지', ['전폭지지', '조건부찬성', '설득필요'], true);

  form.addSectionHeaderItem().setTitle('PART 5 — 성향과 K-컬처');
  mc('성격유형', ['외향적', '내향적', '상황에따라']);
  mc('학습_집중', ['혼자집중', '그룹스터디']);
  mc('학습_방식', ['이론중심', '실습·회화중심']);
  mc('학습_태도', ['꼼꼼한반복', '새로운탐구']);
  mc('대표강점', ['리더십', '분석력', '예술감각', '추진력', '창의성', '소통', '꼼꼼함', '기타']);
  mc('관심K분야', ['KPOP', '드라마', '뷰티패션', '음식']).setHelpText('가장 관심 있는 것 하나만');
  mc('KPOP댄스희망', ['매우희망', '보통', '없음']);
  mc('보컬트레이닝', ['매우희망', '보통', '없음']);
  mc('연기체험', ['매우희망', '보통', '없음']);
  mc('K뷰티메이크업', ['매우희망', '보통', '없음']);
  mc('영어수업관심', ['매우희망', '보통', '없음']).setHelpText('SYNK 영어 수업 (GLOBAL ENGLISH) 참여 희망'); // [v9.19] v18.3: 영어수업→영어수업관심
  para('영어 학습 목표 (선택)');

  form.addSectionHeaderItem().setTitle('PART 6 — 기대와 건의');
  mc('인지채널', ['릴스', '지인추천', '광고', '기타'], true);
  para('SYNK 기대사항');
  para('이전 학원 경험');
  para('담당크루께 바라는 점');
  para('기타 질문');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  setState(st, '상담폼ID', form.getId());
  Logger.log('✅ 폼 생성 완료!');
  Logger.log('학생용: ' + form.getPublishedUrl());
  Logger.log('편집용: ' + form.getEditUrl());
}

function importFormResponses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);

  const formId = String(getState(st, '상담폼ID').val || '');
  if (!formId) { Logger.log('상담폼ID 없음'); return; }
  const lastTs = Number(getState(st, '폼처리시각').val) || 0;

  // [v9.19] 폼 삭제·다른 계정 생성·권한 없음·잘못된 ID면 매 sweep(10분)마다 크래시 → 실패 메일 스팸.
  //         빈 ID(위 3771행)처럼 무효 ID도 조용히 스킵해 파이프라인·본체를 무사히 유지.
  let form;
  try { form = FormApp.openById(formId); }
  catch (e) { Logger.log('상담폼 열기 실패 — ID 무효/삭제/권한 없음(' + formId + '): ' + e + ' · 상담폼ID 재설정(createConsultForm) 또는 app_state에서 키 삭제 필요'); return; }
  const responses = form.getResponses().filter(r => r.getTimestamp().getTime() > lastTs);
  if (responses.length === 0) { Logger.log('신규 응답 없음'); return; }

  const lock = LockService.getScriptLock();
  lock.waitLock(60000);
  try {
    const consult = SpreadsheetApp.openById(CONSULT_SHEET_ID).getSheetByName('상담데이터입력');
    const headers = consult.getRange(2, 1, 1, 62).getValues()[0]; // [v8.4] v18.1
    const colOf = {};
    headers.forEach((h, i) => { if (h) colOf[String(h).trim()] = i + 1; });

    const fr = ss.getSheetByName('form_responses');
    let newTs = lastTs;

    // 현재 최대 SYNK 번호 (한 배치 내 연속 채번)
    const biCol = consult.getRange(3, 60, 600, 1).getValues(); // [v8.4] BH
    let maxSynk = 0;
    biCol.forEach(r => {
      const m = String(r[0]).match(/^SYNK-(\d+)$/);
      if (m) maxSynk = Math.max(maxSynk, parseInt(m[1], 10));
    });

    responses.forEach(resp => {
      const ts = resp.getTimestamp();
      newTs = Math.max(newTs, ts.getTime());
      const ans = {}, narrative = [];
      resp.getItemResponses().forEach(ir => {
        const title = ir.getItem().getTitle();
        let v = ir.getResponse();
        if (Array.isArray(v)) v = v.join(', ');
        ans[title] = v;
      });

      // 빈 행 찾기 (A열 기준)
      const colA = consult.getRange(3, 1, 600, 1).getValues();
      let newRow = 3;
      for (let i = 0; i < colA.length; i++) {
        if (!colA[i][0]) { newRow = i + 3; break; }
      }

      // 행 데이터 배열(1~60열) 한 번에 구성 → 일괄 쓰기
      const rowArr = new Array(59).fill(''); // [v8.4] 입력 A~BG(59열)
      Object.keys(ans).forEach(title => {
        const c = colOf[title];
        if (c && c <= 59) rowArr[c - 1] = ans[title];
        else narrative.push('[' + title + '] ' + ans[title]);
      });
      if (colOf['생년월일'] && rowArr[colOf['생년월일'] - 1]) { // [v8.4] Date 객체로 (나이 수식 안정)
        const bd = new Date(rowArr[colOf['생년월일'] - 1]);
        if (!isNaN(bd)) rowArr[colOf['생년월일'] - 1] = bd;
      }
      if (colOf['등록일'] && colOf['등록일'] <= 59) {
        rowArr[colOf['등록일'] - 1] = ts; // [v8.4] Date 객체 (신규 카운트 수식 안정)
      }
      if (narrative.length && colOf['📝자유서술→노션'] && colOf['📝자유서술→노션'] <= 59) { // [v9.19] v18.3: 📝노션이관→📝자유서술→노션
        rowArr[colOf['📝자유서술→노션'] - 1] = narrative.join('\n\n');
      }
      consult.getRange(newRow, 1, 1, 59).setValues([rowArr]);

      // 학생ID 직접 채번 (수식 비의존)
      maxSynk++;
      // [v5] slice → padStart: SYNK-1000 이후 ID 중복 방지
      consult.getRange(newRow, 60).setValue('SYNK-' + String(maxSynk).padStart(3, '0')); // [v8.4] BH

      // form_responses 기록
      const frRow = fr.getLastRow() + 1;
      fr.getRange(frRow, 1, 1, 4).setValues([[
        'R' + String(frRow).padStart(3, '0'), ts,
        ans['이름(한국어)'] || ans['이름(몽골어)'] || '(무명)', '폼 자동접수'
      ]]);
    });

    setState(st, '폼처리시각', newTs);
  } finally { lock.releaseLock(); }

  if (quotaOk(1)) {
    MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 📝 신규 상담 접수 ' + responses.length + '건',
      '새 상담 설문이 상담시트에 자동 기록되었습니다.\n' +
      '담당 크루 배정 후 form_responses의 처리상태에 "완료"를 입력하세요.');
  }
  syncProfiles();
  Logger.log('폼 응답 ' + responses.length + '건 처리');
}

/* ===================== 스토어 상품 (contents) ===================== */

function setupStore() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ct = ss.getSheetByName('contents') ||
    ensureSheet(ss, 'contents', ['콘텐츠ID','유형','이름','설명','이미지URL','순번','몽골어','영어']); // [v9.9]
  const last = ct.getLastRow();
  if (last >= 2) {
    const data = ct.getRange(2, 1, last - 1, 6).getValues();
    const keep = data.filter(r => r[1] !== 'store');
    ct.getRange(2, 1, last - 1, 6).clearContent();
    if (keep.length) ct.getRange(2, 1, keep.length, 6).setValues(keep);
  }
  const items = [
    // [v7.1] 소득(평균 월 ~160P·성실 ~280P) 역산 가격 사다리 — 간식·체험 티어 신설
    ['ST01','store','한국 간식 1개 (초코파이·빼빼로 등)','간식','',40],
    ['ST02','store','바나나우유 · 음료 1개','간식','',60],
    ['ST04','store','싱크 스티커','굿즈','',80],
    ['ST05','store','싱크 볼펜','굿즈','',100],
    ['ST07','store','싱크 노트','굿즈','',120],
    ['ST08','store','한국 프리미엄 간식 랜덤박스','간식','',250],
    ['ST09','store','싱크 굿즈 (인형·가방키링)','굿즈','',400],
    ['ST10','store','싱크 텀블러','굿즈','',450],
    ['ST11','store','우리 반 전체 간식 쏘기권','특별','',500],
    ['ST12','store','싱크 반팔티','의류','',850],
    ['ST13','store','싱크 카라티','의류','',900],
    ['ST14','store','한국어 이름 디자인 액자','특별','',700],
    ['ST15','store','졸업 포토북 제작','특별','',1000],
    ['ST16','store','싱크 패딩 조끼','의류','',1400],
    ['ST17','store','부모님께 드리는 꽃다발+손편지','가족','',1200],
    ['ST18','store','싱크 과잠','의류','',1700],
    ['ST19','store','가족 외식 상품권','가족','',1500],
    ['ST20','store','어버이날 K-플라워 박스 배달','가족','',1500],
    ['ST21','store','스튜디오 스타일 가족사진 촬영','체험','',2000],
    ['ST22','store','K-아이돌 메이크업+프로필 촬영','체험','',2000]
  ];
  ct.getRange(ct.getLastRow() + 1, 1, items.length, 6).setValues(items);
  Logger.log('스토어 ' + items.length + '개 등록');
}

/* ===================== 시스템 헬스체크 (일요일) ===================== */

function healthCheck() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const required = ['profiles','point_logs','attendance','teacher_checkins','notices',
    'form_responses','contents','class_stats','app_state','raid','schedule',
    'monthly_snapshot','titles','achievements','story','manual_titles','teacher_stats',
    'report_cards','league_history','class_fuel','weekly_topics','hw_batch','today_board',
    'league_pairs','world_raid','synk_stories','synk_cards', // [v9.12]
    'academic_log']; // [v9.18] 학업 성장 축
  const missing = required.filter(n => !ss.getSheetByName(n));
  const plRows = ss.getSheetByName('point_logs') ? ss.getSheetByName('point_logs').getLastRow() - 1 : 0;
  const quota = MailApp.getRemainingDailyQuota();

  let body = '🩺 SYNK 시스템 헬스체크\n\n';
  body += missing.length ? '❌ 누락 시트: ' + missing.join(', ') + '\n' : '✅ 시트 구조 정상\n';
  body += '📊 point_logs ' + plRows + '행' + (plRows > 8000 ? ' ⚠️ (아카이빙 확인 필요)' : ' ✅') + '\n';
  body += '📧 오늘 남은 메일 쿼터: ' + quota + '건' + (quota < 30 ? ' ⚠️' : '') + '\n';
  body += '\n※ 문제 항목이 있으면 확인해주세요.';
  if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 🩺 주간 헬스체크' + (missing.length ? ' ⚠️' : ' ✅'), body);
  Logger.log('헬스체크 완료');
}

/* ===================== 1회용 유틸 ===================== */

function cleanupFormTest() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const consult = SpreadsheetApp.openById(CONSULT_SHEET_ID).getSheetByName('상담데이터입력');
  const colA = consult.getRange(8, 1, 600, 1).getValues();
  let cleaned = 0;
  colA.forEach((r, i) => {
    if (r[0]) { consult.getRange(8 + i, 1, 1, 68).clearContent(); cleaned++; }
  });
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  setState(st, '폼처리시각', 0);
  const fr = ss.getSheetByName('form_responses');
  const frLast = fr.getLastRow();
  if (frLast >= 2) {
    fr.getRange(2, 1, frLast - 1, 4).getValues().forEach((r, i) => {
      if (String(r[3]) === '폼 자동접수') fr.getRange(2 + i, 1, 1, 5).clearContent();
    });
  }
  Logger.log('정리: ' + cleaned + '건');
}

function setupTables() {
  // ⚠️ 최초 1회용. 실행 시 테이블이 샘플로 리셋되므로 잠금.
  Logger.log('setupTables는 잠겨 있습니다 (데이터 보호).');
  return;
}

/* ********************************************************
 * ▼▼▼ 여기부터 [v5] 신규 모듈 ▼▼▼
 ******************************************************** */

/* ===================== [v5] 시냅스 게이지 문구 ===================== */


/* ===================== [v5] 월간 리포트 카드 (1일 아침 6~7시) =====================
 * monthly_snapshot(게임배치 산출물) 기반 → Slides 복제·치환 → PNG →
 * Drive(SYNK_리포트카드 폴더) → report_cards 시트. 재실행 안전:
 * 이미 생성된 학생은 스킵, 60장 초과분은 4분 뒤 자동 이어하기.        */

function monthlyReportCards() { runReportCards_(); }
  // [v6.6] 몬스터 이름(AO열) — 학생이 지은 별명을 카드의 {{몬스터}}에 반영
  const nickOf = {};
  (function () {
    const pfN = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('profiles');
    if (!pfN || pfN.getLastRow() < 2 || pfN.getMaxColumns() < 41) return;
    const n = pfN.getLastRow() - 1;
    const ids = pfN.getRange(2, 1, n, 1).getValues();
    const nks = pfN.getRange(2, 41, n, 1).getValues();
    ids.forEach((r, k) => { if (r[0] && String(nks[k][0] || '').trim()) nickOf[r[0]] = String(nks[k][0]).trim(); });
  })();

function reportCardsContinue() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'reportCardsContinue') ScriptApp.deleteTrigger(t);
  });
  runReportCards_();
}

function runReportCards_() {
  if (!REPORT_TEMPLATE_ID) { Logger.log('REPORT_TEMPLATE_ID 미설정 — 카드 생성 스킵'); return; }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const ym = Utilities.formatDate(now, tz, 'yyyy-MM'); // [v9.19] 현재월 스냅샷 — 포인트·출석·학업 모두 현재 profiles 기준
  const label = Number(ym.substring(0, 4)) + '년 ' + Number(ym.substring(5, 7)) + '월';

  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return; // [v8.2]
  const w = Math.min(pf.getLastColumn(), 74); // [v9.19] BQ(69)까지 필요 · 열 부족 시 안전 클램프
  const pfData = pf.getRange(2, 1, pf.getLastRow() - 1, w).getValues();
  const students = pfData.filter(r => r[0] && r[3] === 'student');
  const logsById = readAcademicLogs_(ss, tz); // [v9.19] academic_log — 급수변화·모의 점수 차트
  const monMap = monsterImgMap_(ss);          // [v9.19] 단계명 → 이미지URL

  const rc = ensureSheet(ss, 'report_cards',
    ['card_id', 'student_id', '월', 'image_url', '칭호', '코멘트', 'created_at']);
  const done = new Set();
  if (rc.getLastRow() >= 2) {
    rc.getRange(2, 1, rc.getLastRow() - 1, 3).getValues().forEach(r => {
      done.add(String(r[2]) + '|' + r[1]);
    });
  }
  const pendingAll = students.filter(r => !done.has(ym + '|' + r[0]));
  if (!pendingAll.length) { Logger.log('리포트카드: ' + ym + ' 전원 생성 완료'); return; }
  const pending = pendingAll.slice(0, MAX_CARDS_PER_RUN);

  // [v9.19] Phase 1: 슬라이드 복제 + 치환 + 막대차트/몬스터이미지 (buildReportCardSlide_ 공용)
  const pres = SlidesApp.openById(REPORT_TEMPLATE_ID);
  const tpl = pres.getSlides()[0];
  const made = [];
  pending.forEach(r => {
    const d = reportCardData_(r, logsById[r[0]], monMap, now);
    d.month = label;
    const sl = buildReportCardSlide_(tpl, d);
    made.push({ d: d, pageId: sl.getObjectId() });
  });
  pres.saveAndClose();

  // Phase 2: PNG 추출 → Drive 저장 → 시트 기록 (+옵션: 학부모 메일)
  const it = DriveApp.getFoldersByName(REPORT_FOLDER_NAME);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(REPORT_FOLDER_NAME);
  const rows = [], mails = [];
  made.forEach(m => {
    Utilities.sleep(350); // [v5.3] 연속 export 429 방지
    const blob = exportSlidePng(REPORT_TEMPLATE_ID, m.pageId)
      .setName(ym + '_' + m.d.sid + '_' + m.d.name + '.png');
    const file = folder.createFile(blob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
    catch (e) { Logger.log('공유설정 실패(' + m.d.name + ') — 폴더 공유 설정으로 대체'); }
    const url = 'https://lh3.googleusercontent.com/d/' + file.getId();
    rows.push([ym + '-' + m.d.sid, m.d.sid, ym, url,
      m.d.title, m.d.comment, new Date()]);
    if (SEND_REPORT_EMAIL && m.d.pEmail.indexOf('@') > -1) {
      mails.push({ to: m.d.pEmail, name: m.d.name, url: url, pts: m.d.pointsText, attend: m.d.attendText });
    }
  });
  if (rows.length) rc.getRange(rc.getLastRow() + 1, 1, rows.length, 7).setValues(rows);

  if (mails.length && quotaOk(mails.length)) {
    mails.forEach(m => {
      MailApp.sendEmail(m.to, '[SYNK] 📮 ' + m.name + ' 학생 ' + label + ' 성장 리포트',
        m.name + ' 학생의 ' + label + ' 성장 리포트가 도착했어요!\n\n' +
        '포인트 ' + m.pts + ' · 출석 ' + m.attend + '\n' +
        '리포트 카드 보기: ' + m.url + '\n\n' +
        '한 달 동안 수고 많았습니다. 다음 달도 함께 성장해요!\n- 뇌과학으로 배우는 한국어, SYNK');
    });
  }

  // Phase 3: 임시 슬라이드 정리 (템플릿 1장만 유지)
  const pres2 = SlidesApp.openById(REPORT_TEMPLATE_ID);
  const rm = new Set(made.map(m => m.pageId));
  pres2.getSlides().forEach(sl => { if (rm.has(sl.getObjectId())) sl.remove(); });
  pres2.saveAndClose();

  const remaining = pendingAll.length - pending.length;
  if (remaining > 0) {
    ScriptApp.newTrigger('reportCardsContinue').timeBased().after(4 * 60 * 1000).create();
    Logger.log('카드 ' + rows.length + '장 생성 · 잔여 ' + remaining + '장 — 4분 후 자동 이어하기');
  } else {
    if (quotaOk(1)) {
      MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 📮 ' + label + ' 리포트카드 생성 완료',
        '이번 실행 ' + rows.length + '장 생성 — ' + label + ' 카드 전원 완료.\n' +
        'Drive 폴더: ' + REPORT_FOLDER_NAME + '\n앱의 report_cards에서 확인하세요.');
    }
    Logger.log('리포트카드 완료: ' + rows.length + '장');
  }
}

function reportComment(s) {
  if (s.rank <= 3) return '이번 달 TOP ' + s.rank + '! 최고의 시냅스 활동이었어요 🏆';
  if (s.growth >= 50) return '지난달보다 ' + s.growth + 'P 상승 — 로켓 성장 중! 🚀';
  if (s.attend >= 20) return '꾸준함이 최고의 재능 — 개근에 가까운 출석이에요 🔥';
  if (s.pts >= 100) return '탄탄하게 쌓아가는 중 — 이 페이스 그대로!';
  return '다음 달, 새로운 시냅스 연결을 함께 만들어봐요 💪';
}

function exportSlidePng(presId, pageId) {
  const url = 'https://docs.google.com/presentation/d/' + presId +
    '/export/png?id=' + presId + '&pageid=' + pageId;
  const resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) {
    throw new Error('PNG 추출 실패(' + resp.getResponseCode() + ') — Slides ID/권한 확인');
  }
  return resp.getBlob();
}

/* ===================== [v9.19] 리포트 카드 v2 — 학업 성장·차트·몬스터 이미지 =====================
 * 현재월 profiles 상태 + academic_log로 카드 생성. 플레이스홀더: {{월}}{{학생이름}}{{반이름}}{{몬스터이름}}
 * {{급수변화}}{{모의점수}}{{점수변화}}{{출석}}{{몬스터단계}}{{칭호}}{{포인트}}{{코멘트}} + 도형 마커 {{CHART}}{{MONIMG}}.
 * 메시지·코멘트는 항상 따뜻·희망(하락/유지도 '다지는 시간'으로 리프레이밍). */

// contents(type=monster) 단계명 → 이미지URL
function monsterImgMap_(ss) {
  const ct = ss.getSheetByName('contents'), map = {};
  if (ct && ct.getLastRow() >= 2) ct.getRange(2, 1, ct.getLastRow() - 1, 6).getValues().forEach(r => {
    if (r[1] === 'monster' && r[2]) map[String(r[2])] = String(r[4] || '');
  });
  return map;
}

// 이번 달 시작~오늘까지 반유형(평일/주말) 예정 수업일 수 (개근 판정용 · calcAll의 수업일 개념과 동일)
function scheduledSoFar_(type, now) {
  const y = now.getFullYear(), m = now.getMonth(), today = now.getDate();
  let c = 0;
  for (let dd = 1; dd <= today; dd++) {
    const dt = new Date(y, m, dd), we = (dt.getDay() === 0 || dt.getDay() === 6);
    if ((type === '주말') === we) c++;
  }
  return c;
}

// 따뜻한 코멘트 — 급수·점수·출석을 사실 기반으로 엮되 부정어 없음('하락' 금칙, 유지는 '다지는 시간')
function reportCardComment_(d) {
  const parts = [];
  if (d.levelUp) parts.push('🎉 ' + d.fromLv + '급에서 ' + d.toLv + '급으로 진급했어요! 한국어 뇌에 새 회로가 열렸어요.');
  if (typeof d.delta === 'number' && d.delta > 0) parts.push('모의 점수도 지난 기록보다 +' + d.delta + '점 올랐어요 📈 꾸준함이 실력이 되고 있어요.');
  else if (d.hasMock && !d.levelUp) parts.push('이번 달은 실력을 탄탄히 다지는 시간이었어요 💪 다음 도약을 준비 중이에요.');
  if (d.gaegeun) parts.push('개근까지 해냈어요 🔥 매일의 한 걸음이 큰 성장을 만듭니다.');
  else if (d.attendCount >= 8) parts.push(d.attendCount + '일 함께하며 성실하게 자랐어요 🌱');
  if (!parts.length) parts.push('이번 달도 SYNK와 함께 한 걸음씩 성장했어요 ✨ 다음 달이 더 기대돼요!');
  return parts.slice(0, 3).join(' ');
}

// profiles 행 + academic_log → 카드 데이터 객체 (배치·프리뷰 공용)
function reportCardData_(r, logs, monMap, now) {
  logs = logs || [];
  const levels = logs.filter(l => l.type === 'level');
  const mocks = logs.filter(l => l.type === 'mock');
  const curLv = levels.length ? levels[levels.length - 1].val : null;
  const prevLv = levels.length >= 2 ? levels[levels.length - 2].val : null;
  const levelUp = (curLv != null && prevLv != null && curLv > prevLv);
  let levelText = '—';
  if (levels.length >= 2) levelText = prevLv + '급 → ' + curLv + '급';
  else if (levels.length === 1) levelText = curLv + '급';
  const bp = (r[67] === '' || r[67] == null) ? null : Number(r[67]); // BP 최근모의점수
  const bq = (r[68] === '' || r[68] == null) ? null : Number(r[68]); // BQ 직전대비Δ
  const delta = (bq != null && !isNaN(bq)) ? bq : null;
  const type = String(r[35] || '평일'); // AJ 반유형
  const schSoFar = scheduledSoFar_(type, now);
  const attendCount = Number(r[21]) || 0; // V 이번달출석
  const gaegeun = schSoFar >= 1 && attendCount >= schSoFar;
  const stage = String(r[18] || '뉴로'), stageNum = Number(r[41]) || 1; // S 단계 · AP 단계번호
  const d = {
    sid: r[0], name: r[1] || r[0], cls: String(r[4] || 'SYNK'), pEmail: String(r[25] || '').trim(),
    nickname: String(r[40] || '') || stage, // AO 별명 (없으면 단계명)
    levelText: levelText, levelUp: levelUp, fromLv: prevLv, toLv: curLv,
    mockText: (bp != null && !isNaN(bp)) ? String(bp) : '—', hasMock: mocks.length > 0,
    scoreText: (delta == null) ? '—' : (delta > 0 ? '+' + delta : String(delta)), delta: delta,
    attendText: attendCount + '일' + (gaegeun ? ' · 개근' : ''), attendCount: attendCount, gaegeun: gaegeun,
    stageText: stage + ' · ' + stageNum + '단계',
    title: String(r[33] || '') || '이달도 화이팅 💪', // AH 대표칭호
    pointsText: (Number(r[16]) || 0) + 'P', // Q 월간포인트
    monImg: monMap[stage] || '',
    mockScores: mocks.slice(-5).map(m => Number(m.val) || 0) // 시간순 최근 5개
  };
  d.comment = reportCardComment_(d);
  return d;
}

// {{CHART}} 마커 도형 자리에 막대그래프 (없으면 첫 기록 안내), 마커는 제거
function drawScoreChart_(sl, scores) {
  let marker = null;
  sl.getShapes().forEach(sh => { let t = ''; try { t = sh.getText().asString(); } catch (e) {} if (t.indexOf('{{CHART}}') > -1) marker = sh; });
  if (!marker) return;
  const L = marker.getLeft(), T = marker.getTop(), W = marker.getWidth(), H = marker.getHeight();
  marker.remove();
  if (!scores || !scores.length) {
    const tb = sl.insertTextBox('이번이 첫 기록! ✨', L, T, W, H);
    tb.getText().getTextStyle().setFontSize(13).setBold(true).setForegroundColor('#10B981');
    return;
  }
  const use = scores.slice(-5), n = use.length;
  const slot = W / n, barW = slot * 0.6;
  for (let i = 0; i < n; i++) {
    const sc = Math.max(0, Math.min(100, Number(use[i]) || 0));
    const bh = Math.max(H * (sc / 100), 2);
    const bar = sl.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE, L + i * slot + (slot - barW) / 2, T + H - bh, barW, bh);
    bar.getFill().setSolidFill(i === n - 1 ? '#10B981' : '#CFEDDF'); // 최신=초록 · 나머지=연초록
    bar.getBorder().setTransparent();
  }
}

// {{MONIMG}} 마커 자리에 몬스터 이미지 (URL 없으면 빈 칸), 마커는 제거
function insertMonsterImage_(sl, url) {
  let marker = null;
  sl.getShapes().forEach(sh => { let t = ''; try { t = sh.getText().asString(); } catch (e) {} if (t.indexOf('{{MONIMG}}') > -1) marker = sh; });
  if (!marker) return;
  const L = marker.getLeft(), T = marker.getTop(), W = marker.getWidth(), H = marker.getHeight();
  marker.remove();
  if (url && String(url).indexOf('http') === 0) {
    try { sl.insertImage(url, L, T, W, H); } catch (e) { Logger.log('몬스터 이미지 삽입 실패: ' + e); }
  }
}

// 템플릿 복제 → 텍스트 치환 + 차트 + 이미지 → 슬라이드 반환 (배치·프리뷰 공용)
function buildReportCardSlide_(tpl, d) {
  const sl = tpl.duplicate();
  const rep = {
    '{{월}}': d.month, '{{학생이름}}': d.name, '{{반이름}}': d.cls, '{{몬스터이름}}': d.nickname,
    '{{급수변화}}': d.levelText, '{{모의점수}}': d.mockText, '{{점수변화}}': d.scoreText,
    '{{출석}}': d.attendText, '{{몬스터단계}}': d.stageText, '{{칭호}}': d.title,
    '{{포인트}}': d.pointsText, '{{코멘트}}': d.comment
  };
  Object.keys(rep).forEach(k => sl.replaceAllText(k, String(rep[k] == null ? '' : rep[k])));
  drawScoreChart_(sl, d.mockScores); // {{CHART}}
  insertMonsterImage_(sl, d.monImg); // {{MONIMG}}
  return sl;
}

// 테스트: 학생 1명만 카드 생성 → PNG URL 로그·반환 (report_cards 미기록 · 임시 슬라이드 정리)
function previewOneReportCard(studentId) {
  if (!REPORT_TEMPLATE_ID) { Logger.log('REPORT_TEMPLATE_ID 미설정'); return; }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const ym = Utilities.formatDate(now, tz, 'yyyy-MM');
  const label = Number(ym.substring(0, 4)) + '년 ' + Number(ym.substring(5, 7)) + '월';
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) { Logger.log('profiles 없음'); return; }
  const w = Math.min(pf.getLastColumn(), 74);
  const r = pf.getRange(2, 1, pf.getLastRow() - 1, w).getValues().find(x => String(x[0]) === String(studentId));
  if (!r) { Logger.log('학생 없음: ' + studentId + ' — profiles user_id(A열) 확인'); return; }
  const d = reportCardData_(r, readAcademicLogs_(ss, tz)[r[0]], monsterImgMap_(ss), now);
  d.month = label;

  const pres = SlidesApp.openById(REPORT_TEMPLATE_ID);
  const sl = buildReportCardSlide_(pres.getSlides()[0], d);
  const pageId = sl.getObjectId();
  pres.saveAndClose();

  Utilities.sleep(350);
  const blob = exportSlidePng(REPORT_TEMPLATE_ID, pageId).setName('PREVIEW_' + ym + '_' + d.sid + '_' + d.name + '.png');
  const it = DriveApp.getFoldersByName(REPORT_FOLDER_NAME);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(REPORT_FOLDER_NAME);
  const file = folder.createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  const pngUrl = 'https://lh3.googleusercontent.com/d/' + file.getId();

  // 임시 프리뷰 슬라이드 제거 (템플릿 원본 보존)
  const pres2 = SlidesApp.openById(REPORT_TEMPLATE_ID);
  pres2.getSlides().forEach(s2 => { if (s2.getObjectId() === pageId) s2.remove(); });
  pres2.saveAndClose();

  Logger.log('📇 리포트카드 프리뷰 — ' + d.name + ' (' + d.sid + ')\nPNG: ' + pngUrl +
    '\n데이터: 급수 ' + d.levelText + ' · 모의 ' + d.mockText + '(' + d.scoreText + ') · ' +
    d.attendText + ' · ' + d.stageText + ' · ' + d.pointsText + '\n코멘트: ' + d.comment);
  return pngUrl;
}

/* ===================== [v5] 명예의 전당 (monthlyGameBatch가 호출) ===================== */

// [v5.7] 이달의 보스 — contents type='boss' 순번(F열) 월 로테이션. D열 = "등장대사|격파대사"
// [v9.4] 📖 싱크 스토리 — 월간 스토리북 자동 발간 (한 달의 실화 × TOPIK 문법)
const STORY_GRAMMAR = [ // 월(1~12) 로테이션 · TOPIK 3~4급 문형 4개/월 — 챕터 문장의 골격
  [['-느라고','이유·핑계'],['-았/었더니','경험 후 결과'],['-는 바람에','뜻밖의 원인'],['-기 마련이다','당연한 이치']],
  [['-(으)ㄹ 뻔하다','아슬아슬'],['-고 말다','결국 그렇게 됨'],['-도록','목적·정도'],['-는 김에','겸사겸사']],
  [['-자마자','직후'],['-(으)ㄹ수록','비례'],['-는 대신에','대체'],['-기만 하면','조건 반복']],
  [['-다 보니','하다 보니 알게 됨'],['-(으)ㄹ 만하다','가치'],['-는 척하다','거짓 행동'],['-거든요','이유 설명']],
  [['-(으)ㄴ 지','시간 경과'],['-을/를 통해','수단'],['-는 데다가','추가'],['-기 나름이다','하기에 달림']],
  [['-던','회상'],['-(으)ㄹ 리가 없다','강한 부정 추측'],['-곤 하다','습관'],['-(으)면서도','대조 동시']],
  [['-느니 차라리','선택'],['-는 통에','시끄러운 원인'],['-기는커녕','부정 강조'],['-(으)ㄹ 겸','두 목적']],
  [['-다가','전환'],['-(으)ㄴ 채로','상태 유지'],['-을 뿐만 아니라','추가 강조'],['-기 십상이다','되기 쉬움']],
  [['-더니','관찰 후 변화'],['-(으)ㄹ 정도로','정도'],['-는 한','조건 한계'],['-기에','이유 문어']],
  [['-고 나서','순서'],['-(으)ㄹ 테니까','추측 근거'],['-는 반면에','대조'],['-을 비롯해서','대표 예시']],
  [['-자','즉시 계기'],['-(으)므로','문어 이유'],['-든지','선택 나열'],['-기 위해서','목적']],
  [['-았/었더라면','과거 가정'],['-(으)ㄹ 겸 해서','겸사'],['-는 데 비해','비교'],['-고서야','그제야']]
];
const STORY_TITLES = ['{boss}와 시냅스의 불꽃','{boss}가 남긴 것','우리가 {boss}를 만났을 때','{boss}보다 빛난 아이들','{boss}의 계절, 성장의 계절','안녕, {boss} — 우리는 자랐다'];

// [v9.5] 배경 12경 — 한국 생활·문화의 무대 (월 로테이션): [이름, 도착 묘사, 문화 디테일, 보스 등장 연출]
const STORY_SCENES = [
  ['눈 내리는 덕수궁 돌담길','첫눈이 내리는 덕수궁 돌담길을 크루들이 걸었습니다. 입김이 하얗게 피어오르고, 돌담 위에 눈이 소복이 쌓였습니다.','붕어빵을 반으로 쪼개 나눠 먹으며 "머리부터? 꼬리부터?" 하고 웃었습니다. 한국의 겨울은 붕어빵 냄새로 시작된다는 걸 크루들은 알게 되었습니다.','그때, 돌담 그림자가 이상하게 길어지더니 눈발이 거꾸로 솟구쳤습니다.'],
  ['광장시장 먹자골목','설 연휴의 광장시장은 사람들의 웃음소리로 가득했습니다. 크루들은 빈대떡 부치는 소리를 따라 골목 깊숙이 들어갔습니다.','마약김밥과 육회를 앞에 두고, 꼬마 크루가 "이모, 여기 하나 더요!"를 완벽한 발음으로 외치자 모두가 박수를 쳤습니다.','그런데 시장의 불빛이 하나둘 꺼지더니, 골목 끝에서 무거운 그림자가 스멀스멀 기어 나왔습니다.'],
  ['여의도 벚꽃길','4월의 여의도, 벚꽃이 눈처럼 흩날렸습니다. 크루들은 꽃잎을 손바닥에 받으며 윤중로를 걸었습니다.','돗자리를 펴고 김밥을 나눠 먹는데, 지나가던 할머니가 "학생들 한국말 참 잘하네" 하고 웃어주셨습니다. 그 한마디에 어깨가 으쓱해졌습니다.','갑자기 바람이 멈추고, 흩날리던 벚꽃잎이 공중에 그대로 얼어붙었습니다.'],
  ['경복궁 한복 나들이','크루들은 색색의 한복을 입고 경복궁 근정전 앞에 섰습니다. 옷고름을 서로 매어주며 한참을 웃었습니다.','수문장 교대식의 북소리에 맞춰 걷다가, 외국인 관광객이 사진을 부탁하자 "김치~" 하고 포즈까지 취해주었습니다.','그 순간, 근정전 지붕 위 잡상들 사이로 낯선 실루엣 하나가 스르륵 일어났습니다.'],
  ['한강 치킨 피크닉','5월의 한강공원, 크루들은 돗자리 위에 치킨과 라면을 펼쳤습니다. 강바람이 시원하게 불어왔습니다.','배달 앱으로 주문한 치킨이 정확히 돗자리 앞까지 온 것을 보고 다들 "한국 최고!"를 외쳤습니다. 편의점 라면 끓이는 기계 앞에선 작은 줄다툼도 있었습니다.','그런데 잔잔하던 한강 물결이 뚝 멈추더니, 수면 아래에서 거대한 그림자가 떠올랐습니다.'],
  ['남산 노을 전망대','케이블카를 타고 오른 남산, 크루들은 노을에 물드는 서울을 내려다보았습니다. 사랑의 자물쇠 앞에서 소원도 하나씩 걸었습니다.','"서울이 이렇게 넓었어?" 누군가 중얼거리자, 다른 크루가 "우리가 배운 한국어로 저 도시 전부랑 이야기할 수 있는 거야"라고 답했습니다.','노을이 절정에 달한 순간, 타워의 그림자가 갑자기 두 배로 길어지며 꿈틀거렸습니다.'],
  ['부산 해운대 바다','여름방학, 크루들은 KTX를 타고 부산으로 떠났습니다. 해운대 모래사장에 발을 딛자마자 파도가 발목을 간질였습니다.','밀면과 씨앗호떡을 사 들고, 부산 사투리로 "마, 억수로 맛있네!"를 따라 하다 다 같이 웃음이 터졌습니다.','그때 수평선 너머 하늘이 먹물처럼 어두워지더니, 파도가 이상한 리듬으로 출렁이기 시작했습니다.'],
  ['홍대 버스킹 거리','금요일 밤의 홍대 걷고싶은거리, 크루들은 버스킹 무대 앞에 모였습니다. 기타 소리와 박수 소리가 골목을 채웠습니다.','즉석에서 마이크를 넘겨받은 크루가 한국 노래 한 소절을 불렀고, 지나가던 사람들이 함성을 질러주었습니다. 떡볶이 컵을 든 손이 떨릴 만큼 짜릿했습니다.','그 순간 스피커가 지직거리더니, 무대 뒤 어둠 속에서 낮게 웃는 소리가 들려왔습니다.'],
  ['북촌 한옥마을 골목','가을 오후의 북촌, 크루들은 기와지붕 사이 좁은 골목을 탐험했습니다. 골목마다 다른 서울이 숨어 있었습니다.','한옥 카페에서 대추차를 마시며, 창호지 문으로 스며드는 햇살에 다들 말을 잃었습니다. "옛날 사람들은 이런 집에서 공부했구나."','그런데 골목 끝 담벼락의 그림자가, 아무도 걷지 않는데 혼자 움직이기 시작했습니다.'],
  ['설악산 단풍 산행','단풍이 절정인 설악산, 크루들은 서로를 끌어주며 흔들바위까지 올랐습니다. 산 전체가 붉게 타오르고 있었습니다.','정상 근처 매점에서 컵라면을 후후 불어 먹으며 "산에서 먹는 라면이 세상에서 제일 맛있다"는 한국의 진리를 몸으로 배웠습니다.','그때 단풍잎들이 일제히 떨어지기를 멈추고, 공중에서 소용돌이치기 시작했습니다.'],
  ['롯데월드 자유이용권','기말고사가 끝난 기념으로 크루들은 롯데월드에 갔습니다. 머리띠를 하나씩 나눠 쓰고 회전목마 앞에서 단체 사진도 찍었습니다.','자이로드롭 앞에서 "먼저 타" "네가 먼저 타"를 반복하다 결국 다 같이 탔고, 내려온 뒤엔 다리가 풀려 한참을 웃었습니다.','퍼레이드 음악이 뚝 끊기더니, 아이스링크 한가운데 조명이 꺼지며 냉기가 확 퍼졌습니다.'],
  ['보신각 제야의 종','한 해의 마지막 밤, 크루들은 보신각 앞 인파 속에 섰습니다. 입김과 함성이 뒤섞여 밤하늘로 올라갔습니다.','"쓰리, 투, 원!" 카운트다운을 한국어로 목이 터져라 외치고, 종소리가 울리자 서로를 끌어안았습니다. 낯선 나라의 새해가 우리의 새해가 된 밤이었습니다.','서른세 번째 종소리가 울리려는 순간 — 종소리가 멈췄습니다. 광장의 대형 전광판이 지직거리며 검게 물들었습니다.']
];

// [v9.10] 🎬 영상팩 — 씬 프롬프트 자동 생성용 영문 자산
const SCENE_EN = ['snowy Deoksugung palace stone wall road in Seoul, winter','bustling Gwangjang traditional market food alley at night','Yeouido cherry blossom road in full bloom','Gyeongbokgung palace courtyard, students in colorful hanbok','Han river park picnic at dusk, food delivery on mats','N Seoul Tower observatory at sunset, city skyline below','Haeundae beach in Busan, summer waves','Hongdae busking street at night, neon and guitar crowd','Bukchon hanok village narrow alley, autumn afternoon','Seoraksan mountain trail in peak autumn foliage','Lotte World theme park, carousel and ice rink','Bosingak bell pavilion on New Year\'s Eve, festival crowd'];
const BOSS_EN = ['a giant sleepy hibernating bear monster','a lazy holiday slime monster','a mesmerizing spring butterfly monster','a hazy yellow-dust sphinx of fog','a daydream cloud monster','a tempting grassland wolf monster','a giant memory-devouring kraken rising from water','a procrastination skeleton monster','an autumn drowsiness goblin monster','a shadowy exam-anxiety phantom','a freezing yeti monster in a blizzard','a distraction phantom ghost in year-end lights'];
const WB_EN = 'ZERO, the colossal Overlord of Oblivion — a vast void-black entity with a glowing crown, looming over the sky';
const STYLE_EN = 'vibrant Korean coming-of-age webtoon style, clean flat vector illustration, warm indigo and coral palette, expressive teenage students with small glowing neuron companion monsters, cinematic composition';

const STORY_EMOTIONS = [ // [v9.7] 감정 표현 배지 — 막의 감정 곡선과 1:1 (한국어 감정 관용구 학습)
  ['설레다','기대로 마음이 두근거리다'],['심장이 쿵 내려앉다','갑작스러운 충격을 받다'],
  ['입술을 깨물다','분함이나 결심을 참아 누르다'],['소름이 돋다','놀라움·감동으로 피부가 오싹해지다'],
  ['가슴이 벅차오르다','기쁨과 감동이 가득 차다'],['목이 메다','감동으로 말이 잘 나오지 않다'],
  ['어깨가 으쓱해지다','자랑스러워지다'],['속이 후련하다','걱정이 풀려 시원하다']];

function buildMonthlyStorybook_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const ym = Utilities.formatDate(lastM, tz, 'yyyy-MM');
  const mNum = lastM.getMonth() + 1;
  const sb = ensureSheet(ss, 'synk_stories', ['월','호수','제목','챕터','챕터제목','본문','문법포인트','씬프롬프트']);
  if (sb.getMaxColumns() < 8) sb.insertColumnsAfter(sb.getMaxColumns(), 8 - sb.getMaxColumns()); // [v9.10]
  if (String(sb.getRange(1, 8).getValue()) !== '씬프롬프트') sb.getRange(1, 8).setValue('씬프롬프트');
  if (sb.getLastRow() >= 2 && sb.getRange(2, 1, sb.getLastRow() - 1, 1).getValues()
    .some(r => String(r[0]) === ym)) { Logger.log('스토리북: ' + ym + '호 기발간'); return; }
  const issue = 1 + new Set(sb.getLastRow() < 2 ? [] : sb.getRange(2, 1, sb.getLastRow() - 1, 1).getValues().map(r => String(r[0])).filter(String)).size;
  const G = STORY_GRAMMAR[(mNum - 1) % 12];
  const boss = bossOfMonth(ss, mNum) || { name: '이달의 보스', open: '', win: '' };
  const wb = worldBossOf(ss);
  const SC = STORY_SCENES[(mNum - 1) % 12];

  // ── 캐스팅 (전부 실데이터, 5역 체계: 주연1·조연2·단역2·엑스트라) ──
  const pf = ss.getSheetByName('profiles');
  const nmB = {}, clsB = {}, evolvedMap = {};
  let stuCnt = 0;
  if (pf && pf.getLastRow() >= 2) {
    const wide = Math.min(54, pf.getMaxColumns());
    pf.getRange(2, 1, pf.getLastRow() - 1, wide).getValues().forEach(r => {
      if (!r[0] || r[3] !== 'student') return;
      stuCnt++; nmB[r[0]] = r[1] || r[0]; clsB[r[0]] = String(r[4] || '');
      if (wide >= 54 && String(r[53] || '').indexOf(ym) === 0) evolvedMap[r[0]] = r[18] || '몬스터';
    });
  }
  const perM = {}; let raidWins = 0;
  const plB = ss.getSheetByName('point_logs');
  if (plB && plB.getLastRow() >= 2) plB.getRange(2, 1, plB.getLastRow() - 1, 6).getValues().forEach(r => {
    const sid = r[1], pts = Number(r[2]) || 0, rs = String(r[3] || '');
    if (!sid || !r[5] || dstr(r[5], tz).indexOf(ym) !== 0) return;
    if (rs === '레이드보상') raidWins++;
    if (pts > 0 || rs.indexOf('정정') > -1) perM[sid] = (perM[sid] || 0) + pts;
  });
  const crownSid = {};
  const tl = ss.getSheetByName('titles');
  if (tl && tl.getLastRow() >= 2) tl.getRange(2, 1, tl.getLastRow() - 1, 3).getValues().forEach(r => {
    if (String(r[0]) !== ym) return;
    if (String(r[2]).indexOf('이달의 스타') > -1 || String(r[2]).indexOf('시냅스 챔피언') > -1) crownSid[r[1]] = String(r[2]);
  });
  const ranked = Object.keys(perM).filter(s => nmB[s]).sort((a, b) => perM[b] - perM[a]);
  const stH = ensureSheet(ss, 'app_state', ['key','value']);
  const stHData = stH.getLastRow() < 2 ? [] : stH.getRange(2, 1, stH.getLastRow() - 1, 2).getValues();
  let prevLead = '';
  stHData.forEach(rr => { if (String(rr[0]) === '전호주연') prevLead = String(rr[1] || ''); });
  const pick = [];
  const leadCand = ranked.filter(s => s !== prevLead);
  if (leadCand[0]) pick.push(leadCand[0]);
  else if (ranked[0]) pick.push(ranked[0]);
  const prevMon = {};
  const msH = ss.getSheetByName('monthly_snapshot');
  const ymPrev = Utilities.formatDate(new Date(lastM.getFullYear(), lastM.getMonth() - 1, 1), tz, 'yyyy-MM');
  if (msH && msH.getLastRow() >= 2) msH.getRange(2, 1, msH.getLastRow() - 1, 3).getValues().forEach(rr => {
    if (String(rr[0]) === ymPrev && rr[1]) prevMon[rr[1]] = Number(rr[2]) || 0;
  });
  let rookie = null;
  ranked.forEach(s => {
    if (pick.indexOf(s) > -1 || (perM[s] || 0) < 15) return;
    const rise = ((perM[s] || 0) - (prevMon[s] || 0)) / Math.max(prevMon[s] || 0, 10);
    if (rise >= 1 && (!rookie || rise > rookie.rise)) rookie = { s: s, rise: rise };
  });
  if (rookie && pick.indexOf(rookie.s) < 0) pick.push(rookie.s);
  ranked.forEach(s => { if (pick.indexOf(s) < 0 && pick.length < 3) pick.push(s); });
  Object.keys(evolvedMap).forEach(s => { if (pick.indexOf(s) < 0 && pick.length < 3 && nmB[s]) pick.push(s); });
  const cameoPool = Object.keys(crownSid).filter(s => pick.indexOf(s) < 0 && nmB[s]);
  const M  = pick[0] ? { n: nmB[pick[0]], d: perM[pick[0]] || 0, c: clsB[pick[0]], evo: evolvedMap[pick[0]] } : { n: '유나', d: 0, c: '우리 반', evo: null };
  const S1 = pick[1] ? { n: nmB[pick[1]], evo: evolvedMap[pick[1]] } : { n: '민호', evo: null };
  const S2 = pick[2] ? { n: nmB[pick[2]], evo: evolvedMap[pick[2]] } : null;
  const C1 = cameoPool[0] ? { n: nmB[cameoPool[0]], t: crownSid[cameoPool[0]] } : null;
  const evoActor = M.evo ? M : (S1.evo ? S1 : (S2 && S2.evo ? S2 : null));
  let duel = null;
  const lgB = ss.getSheetByName('league_pairs');
  if (lgB && lgB.getLastRow() >= 2) lgB.getRange(2, 1, lgB.getLastRow() - 1, 5).getValues().forEach(r => {
    if (String(r[0]).indexOf(ym) !== 0) return;
    const m2 = String(r[4] || '').match(/\((\d+(?:\.\d+)?) : (\d+(?:\.\d+)?)\)/);
    if (!m2) return;
    const hi = Number(m2[1]), lo = Number(m2[2]);
    if (!duel || (hi - lo) < duel.gap) duel = { a: String(r[1]), b: String(r[2]), gap: hi - lo };
  });
  let world = null;
  const wrS = ss.getSheetByName('world_raid');
  if (wrS && wrS.getLastRow() >= 2) wrS.getRange(2, 1, wrS.getLastRow() - 1, 5).getValues().forEach(r => {
    if (String(r[0]) === ym) world = { hp: Number(r[2]) || 0, dmg: Number(r[3]) || 0, win: String(r[4]) === '격파' };
  });
  const rvA = duel ? duel.a : '옆 반';
  const bN = boss.name.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
  const wN = wb.name.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
  const J = josa;
  const usedNames = {};
  pick.forEach(s => usedNames[s] = 1);
  Object.keys(crownSid).forEach(s => usedNames[s] = 1);
  const cameoCand = [];
  const atCam = ss.getSheetByName('attendance');
  const attDays = {}, firstAtt = {};
  if (atCam && atCam.getLastRow() >= 2) atCam.getRange(2, 1, atCam.getLastRow() - 1, 3).getValues().forEach(rr => {
    if (!rr[1] || !rr[2]) return;
    const dC = dstr(rr[2], tz);
    if (!firstAtt[rr[1]] || dC < firstAtt[rr[1]]) firstAtt[rr[1]] = dC;
    if (dC.indexOf(ym) === 0) attDays[rr[1]] = (attDays[rr[1]] || 0) + 1;
  });
  const achCam = ss.getSheetByName('achievements');
  const nightSid = {}, tricolorSid = {};
  if (achCam && achCam.getLastRow() >= 2) achCam.getRange(2, 1, achCam.getLastRow() - 1, 4).getValues().forEach(rr => {
    if (String(rr[3] || '').indexOf(ym) !== 0) return;
    if (String(rr[1]).indexOf('한밤') > -1) nightSid[rr[0]] = 1;
    if (String(rr[1]).indexOf('세 빛깔') > -1) tricolorSid[rr[0]] = 1;
  });
  const CAMEO_TPL = {
    night: n => '밤 아홉 시가 넘도록 시냅스를 쌓던 ' + n + '의 습관이, 이런 날을 위해 있었다.',
    tri: n => '하루에 세 가지 빛을 낸 적 있는 ' + n + J(n, '이', '가') + ' 세 방향에서 동시에 움직였다.',
    newbie: n => '들어온 지 한 달도 안 된 ' + n + J(n, '이', '가') + ' 누구보다 먼저 달려 나갔다.',
    steady: n => '이번 달 거의 하루도 빠지지 않은 ' + n + '의 다리는 지치는 법을 몰랐다.',
    syn: n => '조용히, 그러나 꾸준히 시냅스를 이어 온 ' + n + '의 손이 빛났다.',
    hw: n => n + J(n, '은', '는') + ' 말없이 숙제로 쌓아 올린 화살들을 쏟아부었다.',
    voice: n => '함성 사이로 ' + n + '의 목소리가 또렷하게 길을 열었다.',
    guard: n => '맨 뒤에서 ' + n + J(n, '이', '가') + ' 넘어지는 친구들을 하나씩 일으켰다.'
  };
  Object.keys(perM).forEach(s => {
    if (usedNames[s] || !nmB[s] || (perM[s] || 0) <= 0) return;
    let tag;
    if (nightSid[s]) tag = 'night';
    else if (tricolorSid[s]) tag = 'tri';
    else if ((firstAtt[s] || '').indexOf(ym) === 0) tag = 'newbie';
    else if ((attDays[s] || 0) >= 8) tag = 'steady';
    else if ((perM[s] || 0) >= 40) tag = 'hw';
    else tag = ['syn', 'voice', 'guard'][s.charCodeAt(s.length - 1) % 3];
    cameoCand.push({ s: s, n: nmB[s], tag: tag });
  });
  cameoCand.sort((a, b) => (perM[b.s] || 0) - (perM[a.s] || 0));
  let cameoIdx = 0;
  const cameo = () => { const c = cameoCand[cameoIdx++]; return c ? ' ' + CAMEO_TPL[c.tag](c.n) : ''; };
  const arcA = (mNum % 2 === 1);
  const title = STORY_TITLES[(issue - 1) % STORY_TITLES.length].replace('{boss}', wN);
  const rows = [];
  const gB = i => '📖 ' + G[i][0] + ' — ' + G[i][1];
  const eB = i => '💗 ' + STORY_EMOTIONS[i][0] + ' — ' + STORY_EMOTIONS[i][1];
  const SEn = SCENE_EN[(mNum - 1) % 12], BEn = BOSS_EN[(mNum - 1) % 12];
  const IMG = t => 'IMG: ' + t + ' | ' + STYLE_EN;
  const scenePrompts = arcA ? [
    IMG('poster cover: group of students at ' + SEn + ', title space at top') + ' || MOT: slow cinematic push-in, floating light particles',
    IMG('a student arriving first at meeting spot, morning light, snack bag, friends gathering') + ' || MOT: gentle pan across smiling faces, hair moving in breeze',
    IMG('students enjoying local food and culture at ' + SEn + ', laughing together') + ' || MOT: handheld documentary feel, steam and light flares',
    IMG('sudden silence — dark aura appearing over ' + SEn + ', ' + BEn + ' emerging, students turning around') + ' || MOT: slow dolly back, sky darkening, wind picking up',
    IMG('the hero student stepping forward, glowing word-arrows forming from open notebook, determined eyes') + ' || MOT: dramatic low-angle push-in, arrows streaking forward',
    IMG(BEn + ' staggering, then dissolving into black smoke rising to the sky, students shocked') + ' || MOT: smoke spiraling upward, camera tilting up',
    IMG('the sky splitting open, ' + WB_EN + ', tiny students below') + ' || MOT: massive slow reveal from above, rumbling scale',
    IMG('hundreds of students from all classes running to join, one monster evolving in a burst of light at the center') + ' || MOT: sweeping crane shot over the crowd, light burst bloom',
    IMG('all students chanting together, chains of glowing Korean letters wrapping the overlord') + ' || MOT: orbiting camera, letter-chains tightening, rising intensity',
    IMG('the overlord defeated or sealed, golden sparkle rain falling, students embracing under the light') + ' || MOT: slow-motion sparkle fall, warm glow expanding',
    IMG('sunset group photo at ' + SEn + ', arms over shoulders, tired happy smiles') + ' || MOT: still-photo freeze with gentle zoom, lens flare',
    IMG('empty classroom at night, faint shadow whispering outside the window, a single desk lamp on') + ' || MOT: slow creep toward window, curtain swaying'
  ] : [
    IMG('poster cover: two rival class groups facing each other at ' + SEn + ', playful tension') + ' || MOT: split-screen slide-in, spark between them',
    IMG('two rival student groups spotting each other across ' + SEn + ', surprised faces') + ' || MOT: whip-pan between the two groups',
    IMG('rivals sharing snacks at one table, awkward then warming up, ' + SEn + ' background') + ' || MOT: slow push-in as smiles appear',
    IMG(BEn + ' erupting between the two groups, splitting them apart, dark energy wall') + ' || MOT: shockwave burst, camera shake',
    IMG('the hero student reaching a hand across the divide toward the rival class') + ' || MOT: intimate close-up, hand meeting hand, light igniting',
    IMG('two class monsters roaring side by side above joined hands') + ' || MOT: twin energy auras merging into one new color',
    IMG('the sky splitting open, ' + WB_EN + ', both classes standing together below') + ' || MOT: massive slow reveal, dust swirling',
    IMG('combined chant of both classes, glowing letter-chains from two directions binding the overlord') + ' || MOT: dual spiral camera, chains crossing',
    IMG('crown-wearing students leading the final chant, all monsters glowing') + ' || MOT: heroic slow push through the front line',
    IMG('the overlord falling, rivals high-fiving in golden light rain') + ' || MOT: slow-motion high-five, sparkles',
    IMG('sunset group photo of both classes together at ' + SEn) + ' || MOT: freeze-frame with camera flash white-out',
    IMG('empty classroom at night, faint shadow at the window, distant whisper') + ' || MOT: slow creep, single light flickering'
  ];
  const push = (ch, cTitle, body, badge) => rows.push([ym, issue, title, ch, cTitle, body, badge || '', scenePrompts[ch] || '']);

  push(0, '표지', 'SYNK LAB 청춘 실록 제' + issue + '호 — ' + mNum + '월의 무대: ' + SC[0] + '\n이 이야기의 인물과 기록은 크루들이 이번 달 실제로 만든 것입니다. 배경과 모험은 상상이지만, 주인공은 상상이 아닙니다.', '');

  // ═══ 起 ═══
  if (arcA) {
    push(1, '제1화 — 아침', '약속 장소에 가장 먼저 나온 사람은 ' + M.n + '였다. 가방 안에는 어젯밤 미리 사 둔 간식이 들어 있었다. 하나둘 모여드는 크루들의 얼굴에는 같은 표정이 떠 있었다. 오늘만큼은 공부가 아니라는 표정. 버스가 출발하자 누군가 창문을 열었고, ' + S1.n + '이(가) 이어폰 한쪽을 ' + M.n + '에게 건넸다. 창밖의 간판들이 빠르게 지나갔다. ' + M.n + '은(는) 그것들을 하나씩 소리 내지 않고 읽어 보았다. 전부 읽을 수 있었다.', gB(0));
    push(2, '제2화 — ' + SC[0], SC[1] + ' ' + SC[2] + ' ' + M.n + '이(가) 주문을 맡았다. 조금 떨렸지만, 점원은 한 번에 알아들었다. 돌아서는 ' + M.n + '의 입꼬리가 *슬며시 올라갔다*. ' + S1.n + '이(가) 그걸 보고 웃었다. "잘하네." "당연하지."', eB(0));
  } else {
    push(1, '제1화 — 마주침', SC[1] + ' 먼저 알아본 쪽은 ' + M.n + '였다. 길 건너편, 낯익은 얼굴들. 매주 리그에서 겨루던 ' + rvA + ' 크루들이었다. 잠깐 어색한 정적이 흘렀다. 그 정적을 깬 것은 양쪽의 막내들이었다. "안녕!" 아이들의 인사는 언제나 스코어보다 빠르다.', gB(0));
    push(2, '제2화 — 같은 테이블', SC[2] + ' 간식을 나누다 보니 자리가 섞였다. ' + M.n + '은(는) ' + rvA + ' 크루와 지난주 승부 이야기를 했다. ' + (duel ? '단 ' + Math.round(duel.gap * 10) / 10 + ' 차이였던 그 승부.' : '매주 이어진 접전들.') + ' 서로의 기록을 서로가 외우고 있었다. 라이벌이란 그런 것이었다.' + cameo(), eB(0));
  }

  // ═══ 承 ═══
  push(3, '제3화 — 정적', SC[3] + ' 웃음소리가 끊겼다. 공기가 한 단계 무거워졌다. "' + (boss.open || '...') + '" ' + bN + '였다. 매일 밤 전투 리포트에서만 보던 그 이름이, 지금 눈앞에 있었다. ' + M.n + '의 *심장이 쿵 내려앉았다*. 그러나 물러선 크루는 없었다.', eB(1));
  push(4, '제4화 — 선봉', '먼저 움직인 것은 ' + M.n + '였다. 이번 달 기록 ' + M.d + '. 반에서 가장 높은 숫자였고, 그 숫자만큼의 밤이 있었다. 외운 단어가 화살이 되고, 발표했던 문장이 방패가 되었다. ' + S1.n + '이(가) 옆에 붙었다. 둘의 호흡은 오래 맞춰 온 것처럼 정확했다.' + cameo(), gB(1));
  push(5, '제5화 — 그림자', bN + J(bN, '이', '가') + ' 비틀거렸다. ' + (raidWins > 0 ? '이번 달에만 ' + raidWins + '번 무릎 꿇었던 상대다.' : '매일 쌓인 데미지는 거짓말을 하지 않는다.') + ' 승리가 눈앞이었다. 그때, 쓰러지던 보스가 웃었다. "나는… 그림자일 뿐." 보스의 몸이 검은 안개가 되어 하늘로 빨려 올라갔다. ' + M.n + '은(는) *입술을 깨물었다*. 이긴 것이 아니었다.' + cameo(), eB(2));

  // ═══ 轉 ═══
  push(6, '제6화 — 대군주', '하늘이 갈라졌다. "' + (wb.open || '...') + '" ' + wN + '. 매달의 보스들을 뒤에서 부리던 존재가 처음으로 모습을 드러냈다. 한 반의 힘으로 어찌할 상대가 아니라는 것은, 그 그림자의 크기만으로 알 수 있었다.', gB(2));
  push(7, '제7화 — 집결', '멀리서 발소리가 들려왔다. ' + rvA + '이(가) 오고 있었다. 평일반이, 주말반이, ' + stuCnt + '명의 크루 전원이 한 전장에 모이고 있었다. ' + (evoActor
    ? '그 한가운데서 빛이 터졌다. ' + evoActor.n + '의 몬스터가 ' + evoActor.evo + '(으)로 진화하는 순간이었다. 한 달의 포인트가 가장 필요한 순간에 형태를 바꾼 것이다.'
    : '크루들의 몬스터가 일제히 낮게 울었다. 대군주의 그림자가 처음으로 흔들렸다.') + cameo() + cameo(), eB(3));
  push(8, '제8화 — 총공세', (C1 ? C1.n + '이(가) 앞으로 나섰다. ' + (C1.t.indexOf('스타') > -1 ? '이달의 무대를 가장 많이 가졌던 목소리' : '이달 가장 많이 성장한 목소리') + '가 첫 문장을 열었다.' : M.n + '이(가) 첫 문장을 열었다.') + ' 다음 크루가 이어받고, 또 다음 크루가 이어받았다. ' + stuCnt + '명의 한국어가 하나의 사슬이 되어 대군주를 감았다. ' + (world ? '이번 달 전교의 기록, ' + world.dmg + '. 그 전부가 지금 한 점을 향하고 있었다.' : '한 달의 기록 전부가 한 점을 향하고 있었다.') + cameo() + cameo(), gB(3));

  // ═══ 結 ═══
  if (world && world.win) {
    push(9, '제9화 — 끝', '"' + (wb.win || '...') + '" 대군주가 무너졌다. 잠깐의 정적 뒤, 함성이 터졌다. ' + M.n + '은(는) 소리를 지르는 대신 하늘을 올려다보았다. 반짝이는 가루가 내리고 있었다. *가슴이 벅차올랐다*. 매일의 숙제가, 매일의 출석이, 여기까지 온 것이다.' + cameo(), eB(4));
  } else {
    push(9, '제9화 — 봉인', '전교의 총공세에 대군주가 밀려났다. "기억하는 자들이… 이렇게 많다니…" 어둠 속으로 사라지는 목소리는 처음보다 훨씬 작았다. 완전한 끝은 아니었다. 그러나 고개를 떨군 크루는 없었다. 오늘의 데미지는 남고, 대군주는 매달 약해진다. ' + M.n + '이(가) 먼저 웃었다. "다음 달엔 끝내자." *속이 후련한* 함성이 뒤따랐다.' + cameo(), eB(7));
  }
  push(10, '제10화 — 귀갓길', '돌아가는 버스 안, 크루들은 하나둘 잠들었다. ' + S1.n + '은(는) ' + M.n + '의 어깨에 기대어 있었다. 창밖의 불빛을 오래 바라보던 ' + M.n + '이(가) 낮게 중얼거렸다. "다음 달에도, 다 같이 오자." 대답 대신 고른 숨소리가 들렸다. 그것으로 충분했다.' + cameo(), eB(6));
  push(11, '에필로그', '그날 밤, 불 꺼진 교실. 창밖 어둠 저편에서 희미한 목소리가 울렸다. "다음 달… 다시…" 크루들은 이제 그 목소리가 두렵지 않다. 내일 완료할 숙제가 다음 호의 화살이 되고, 내일 받을 왕관이 다음 호의 첫 문장이 된다. 이 책의 다음 주인공은, 지금 이 페이지를 덮는 당신이다.', '');

  { // [v9.17] 🎬 크레딧 롤 — 활동 전원 출연 · 무활동자는 다음 호 예고 (소외 0)
    const cast = Object.keys(perM).filter(s => nmB[s] && (perM[s] || 0) > 0).sort((a, b) => perM[b] - perM[a]).map(s => nmB[s]);
    const nextUp = Object.keys(nmB).filter(s => !(perM[s] > 0)).map(s => nmB[s]);
    push(12, '🎬 크레딧', '― 출연 · 이 이야기를 실제로 만든 크루들 ―\n' + cast.join(' · ') +
      (nextUp.length ? '\n\n― 다음 호 출연 예정 ―\n' + nextUp.join(' · ') : '') +
      '\n\n각본·주연·제작: SYNK LAB 크루 전원 | 이 이야기의 모든 기록은 실화입니다.', '');
  }
  setAppState_(ss, '전호주연', pick[0] || '');
  sb.getRange(sb.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
  if (quotaOk(1)) { // [v9.10] 🎬 원장 영상팩 — 즉발(브리핑 큐 미경유: 복사용 독립 메일, 월 1통)
    const pLines = rows.map(r => '── 씬 ' + r[3] + ' · ' + r[4] + ' ──\n' + r[7]).join('\n\n');
    MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 🎬 싱크 스토리 제' + issue + '호 영상팩 — 씬 프롬프트 12',
      '「' + title + '」 발간과 함께 영상 제작용 프롬프트가 준비됐습니다.\n\n사용법: ① IMG 부분을 Recraft(또는 이미지 AI)에 넣어 씬 일러스트 생성 → ② 그 이미지를 Kling 등 영상 AI에 올리고 MOT 부분만 프롬프트로 입력.\n\n' + pLines +
      '\\n\\n════ ✍️ 집필 브리프 (수기 각색용 — 원할 때만) ════' +
      '\\n무대: ' + SC[0] + ' | 아크: ' + (arcA ? '원정 편' : '라이벌 편') + ' | 문법: ' + G.map(g => g[0]).join(', ') +
      '\\n주연: ' + (pick[0] ? nmB[pick[0]] + ' (' + (perM[pick[0]] || 0) + 'P)' : '-') + (rookie ? ' | 🌟 이달의 신인: ' + nmB[rookie.s] : '') +
      '\\n조연: ' + pick.slice(1).map(s => nmB[s]).join(', ') +
      '\\n사건: 격파 ' + raidWins + '회 | ' + (duel ? '명승부 ' + duel.a + ' vs ' + duel.b : '명승부 없음') + ' | ' + (world ? (world.win ? '월드 격파' : '월드 봉인') : '월드 진행중') +
      '\\n카메오 본문 출연(' + Math.min(cameoIdx, cameoCand.length) + '명): ' + cameoCand.slice(0, cameoIdx).map(c => c.n).join(', ') +
      '\\n\\n✍️ 수기 각색법: 위 브리프를 Claude에 붙여넣고 "싱크 스토리를 이 사실 그대로 12장 기승전결·해피엔딩으로 다시 써줘" → 나온 챕터를 synk_stories 해당 월 행의 F열(본문)에 붙여넣기. 자동 재발간은 월키 멱등이라 수기본을 절대 덮어쓰지 않습니다.');
  }
  const ntB = ensureSheet(ss, 'notices', ['title','body','date','title_mn','body_mn']);
  ntB.getRange(ntB.getLastRow() + 1, 1, 1, 3).setValues([['📖 싱크 스토리 제' + issue + '호 발간!',
    '「' + title + '」 — ' + SC[0] + '에서 펼쳐진 우리들의 ' + mNum + '월 이야기. 앱의 싱크 스토리에서 읽어보세요.', new Date()]]);
  Logger.log('스토리북 ' + ym + ' 제' + issue + '호(v4·주연 ' + M.n + '): ' + rows.length + '행');
}

// [v9.6] 🌍 월드 레이드 — 학원 전체 vs 망각의 대군주 (월간 · 반 보스들의 배후 = 스토리북 최종 보스)
const WORLD_HP_PER = 100; // 재적 학생 1인당 HP 계수 — 월 평균 개인 획득(~100P+)이면 전원 참여 시 클리어 가능한 '조금 강한' 난이도
function worldBossOf(ss) {
  const ct = ss.getSheetByName('contents');
  let w = null;
  if (ct && ct.getLastRow() >= 2) ct.getRange(2, 1, ct.getLastRow() - 1, 5).getValues().forEach(r => {
    if (r[1] === 'worldboss' && r[2] && !w) w = { name: String(r[2]), open: String(r[3] || '').split('|')[0] || '', win: String(r[3] || '').split('|')[1] || '', img: r[4] || '' };
  });
  return w || { name: '망각의 대군주 제로', open: '너희가 배운 모든 것을... 0으로 되돌려주마...', win: '기억하는 자들 앞에서, 망각은 이름을 잃었다!', img: '' };
}

function worldRaidMonthly_() { // 매월 1일: 지난달 판정·보상 → 이번 달 소환 (멱등)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const ymNow = Utilities.formatDate(now, tz, 'yyyy-MM');
  const ymLast = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth() - 1, 1), tz, 'yyyy-MM');
  const wr = ensureSheet(ss, 'world_raid', ['월','보스명','HP','누적데미지','상태']);
  const wb = worldBossOf(ss);
  const data = wr.getLastRow() < 2 ? [] : wr.getRange(2, 1, wr.getLastRow() - 1, 5).getValues();
  // 지난달 판정
  data.forEach((r, i) => {
    if (String(r[0]) !== ymLast || String(r[4]) !== '진행중') return;
    const hp = Number(r[2]) || 0, dmg = Number(r[3]) || 0;
    const win = dmg >= hp;
    wr.getRange(i + 2, 5).setValue(win ? '격파' : '봉인');
    const pfW = ss.getSheetByName('profiles');
    const winRows = [];
    if (win && pfW && pfW.getLastRow() >= 2) pfW.getRange(2, 1, pfW.getLastRow() - 1, 5).getValues()
      .forEach(pr => { if (pr[0] && pr[3] === 'student') winRows.push([pr[0], 10, '월드레이드', 'SYSTEM']); });
    if (winRows.length) appendPoints(ss, winRows);
    const ntW = ensureSheet(ss, 'notices', ['title','body','date','title_mn','body_mn']);
    ntW.getRange(ntW.getLastRow() + 1, 1, 1, 3).setValues([[
      win ? '🌍 월드 레이드 대승리! ' + wb.name + ' 격파!' : '🌍 월드 레이드 — ' + wb.name + ' 봉인 성공!',
      win ? '"' + wb.win + '" 전교 크루의 ' + dmg + ' 데미지가 대군주를 쓰러뜨렸습니다! 전원 +10P!'
          : '전교 크루가 ' + dmg + ' 데미지로 대군주를 한 달 더 봉인했습니다. 다음 달, 완전한 승리를 향해!',
      new Date()]]);
  });
  // 이번 달 소환
  if (!data.some(r => String(r[0]) === ymNow)) {
    let stu = 0;
    const pfW2 = ss.getSheetByName('profiles');
    if (pfW2 && pfW2.getLastRow() >= 2) pfW2.getRange(2, 1, pfW2.getLastRow() - 1, 5).getValues()
      .forEach(pr => { if (pr[0] && pr[3] === 'student') stu++; });
    wr.getRange(wr.getLastRow() + 1, 1, 1, 5).setValues([[ymNow, wb.name, Math.max(stu, 1) * WORLD_HP_PER, 0, '진행중']]);
    Logger.log('월드 보스 소환: HP ' + Math.max(stu, 1) * WORLD_HP_PER);
  }
}

// [v9.12] 🃏 이달의 카드 — 월말 성과를 트레이딩 카드로 (0P도 참가 카드 — 소외 없음)
const CARD_TIERS = [[200,'플래티나','linear-gradient(135deg,#E0E7FF,#A5B4FC,#F5F3FF)','💎'],[100,'골드','linear-gradient(135deg,#F5A623,#FDE68A)','🥇'],[50,'실버','linear-gradient(135deg,#CBD5E1,#F1F5F9)','🥈'],[0,'브론즈','linear-gradient(135deg,#D6A67C,#F3E3CF)','🥉']];
function buildMonthlyCards_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const ym = Utilities.formatDate(lastM, tz, 'yyyy-MM');
  const cd = ensureSheet(ss, 'synk_cards', ['월','student_id','카드HTML']);
  if (cd.getLastRow() >= 2 && cd.getRange(2, 1, cd.getLastRow() - 1, 1).getValues().some(r => String(r[0]) === ym)) return; // 멱등
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return;
  const stus = [];
  pf.getRange(2, 1, pf.getLastRow() - 1, 19).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') stus.push({ id: r[0], nm: r[1] || r[0], mon: r[18] || '뉴로' });
  });
  const mP = {}, crowns = {}, raids = {}, cardLogs = {};
  const plC = ss.getSheetByName('point_logs');
  if (plC && plC.getLastRow() >= 2) plC.getRange(2, 1, plC.getLastRow() - 1, 6).getValues().forEach(r => {
    if (!r[1] || !r[5] || dstr(r[5], tz).indexOf(ym) !== 0) return;
    const pts = Number(r[2]) || 0, rs = String(r[3] || '');
    if (pts > 0) (cardLogs[r[1]] = cardLogs[r[1]] || []).push({ d: parseInt(dstr(r[5], tz).slice(8), 10), rs: rs, pts: pts });
    if (pts > 0 || rs.indexOf('정정') > -1) mP[r[1]] = (mP[r[1]] || 0) + pts;
    if (rs === '오늘의 MVP' || rs === '오늘의 시냅스') crowns[r[1]] = (crowns[r[1]] || 0) + 1;
    if (rs === '레이드보상' || rs === '월드레이드') raids[r[1]] = (raids[r[1]] || 0) + 1;
  });
  const rows = stus.map(s => {
    const pts = mP[s.id] || 0;
    const tier = CARD_TIERS.find(tt => pts >= tt[0]);
    const stat = pts > 0
      ? '⚡ ' + pts + 'P · 👑 ' + (crowns[s.id] || 0) + ' · ⚔️ ' + (raids[s.id] || 0)
      : '🌟 다음 달 주인공 예약';
    return [ym, s.id, '<div style="background:' + tier[2] + ';border-radius:16px;padding:10px;max-width:230px;">' +
      '<div style="background:#fff;border-radius:12px;padding:10px 12px;text-align:center;">' +
      '<div style="font-size:11px;color:#6B7280;">SYNK ' + ym + ' · ' + tier[3] + ' ' + tier[1] + '</div>' +
      '<div style="font-size:17px;font-weight:800;padding:3px 0;">' + s.nm + '</div>' +
      '<div style="font-size:12px;color:#4338CA;">' + s.mon + '와 함께한 한 달</div>' +
      '<div style="font-size:11px;color:#6B7280;padding-top:2px;">' + (function(){ const ps2 = playStyleOf_(cardLogs[s.id] || []); return ps2[0] + ' ' + ps2[1]; })() + '</div>' +
      '<div style="font-size:13px;padding-top:6px;border-top:1px dashed #E5E7EB;margin-top:6px;">' + stat + '</div>' +
      '</div></div>'];
  });
  if (rows.length) cd.getRange(cd.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
  Logger.log('이달의 카드 ' + ym + ': ' + rows.length + '장');
}

// [v9.12] 🗺️ 시냅스 여행 지도 — 스토리북이 다녀간 한국 12경, 도감 문법(???)의 지도판
const MAP_EMOJI = ['🏯','🥘','🌸','👘','🍗','🌇','🌊','🎸','🏘️','🍁','🎡','🔔'];
const MAP_NAME = ['덕수궁','광장시장','여의도','경복궁','한강','남산','해운대','홍대','북촌','설악산','롯데월드','보신각'];
function updateTravelMap_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sbM = ss.getSheetByName('synk_stories');
  const done = {};
  if (sbM && sbM.getLastRow() >= 2) sbM.getRange(2, 1, sbM.getLastRow() - 1, 1).getValues().forEach(r => {
    const mm = parseInt(String(r[0]).split('-')[1], 10);
    if (mm >= 1 && mm <= 12) done[(mm - 1) % 12] = 1;
  });
  const n = Object.keys(done).length;
  let cells = '';
  for (let i = 0; i < 12; i++) {
    const nm = MAP_NAME[i];
    cells += done[i]
      ? '<div style="width:31%;margin:1%;background:linear-gradient(135deg,#EEF2FF,#E0E7FF);border:2px solid #A5B4FC;border-radius:12px;text-align:center;padding:8px 0;float:left;"><div style="font-size:22px;">' + MAP_EMOJI[i] + '</div><div style="font-size:11px;font-weight:700;">' + nm + '</div><div style="font-size:10px;color:#4338CA;">⭕ 정복!</div></div>'
      : '<div style="width:31%;margin:1%;background:#F3F4F6;border:2px dashed #D1D5DB;border-radius:12px;text-align:center;padding:8px 0;float:left;opacity:.75;"><div style="font-size:22px;">🌫️</div><div style="font-size:11px;color:#9CA3AF;">???</div><div style="font-size:10px;color:#9CA3AF;">' + (i + 1) + '월의 무대</div></div>';
  }
  const html = '<div style="background:#fff;border:2px solid #E9E7F5;border-radius:16px;padding:12px;"><div style="font-size:14px;font-weight:800;padding-bottom:6px;">🗺️ 시냅스 여행 지도 — 한국 12경 <span style="color:#4338CA;">' + n + '/12곳 정복</span></div><div style="overflow:hidden;">' + cells + '</div><div style="clear:both;font-size:11px;color:#6B7280;padding-top:6px;">매달 싱크 스토리가 발간되면 새로운 무대에 도장이 찍혀요 📖</div></div>';
  const st = ensureSheet(ss, 'app_state', ['key','value']);
  const data = st.getLastRow() < 2 ? [] : st.getRange(2, 1, st.getLastRow() - 1, 2).getValues();
  let found = -1;
  data.forEach((r, i) => { if (String(r[0]) === '여행지도HTML') found = i + 2; });
  if (found > 0) { if (String(st.getRange(found, 2).getValue()) !== html) st.getRange(found, 2).setValue(html); }
  else st.getRange(st.getLastRow() + 1, 1, 1, 2).setValues([['여행지도HTML', html]]);
}

function bossOfMonth(ss, monthNum) {
  const ct = ss.getSheetByName('contents');
  if (!ct || ct.getLastRow() < 2) return null;
  const list = [];
  ct.getRange(2, 1, ct.getLastRow() - 1, 6).getValues().forEach(r => {
    if (r[1] === 'boss' && r[2]) {
      const parts = String(r[3] || '').split('|');
      list.push({ name: String(r[2]), entry: parts[0] || '', win: parts[1] || '', ord: Number(r[5]) || 99 });
    }
  });
  if (!list.length) return null;
  list.sort((a, b) => a.ord - b.ord);
  return list[(monthNum - 1) % list.length];
}

function seasonNameOf(ss, monthNum) {
  const ct = ss.getSheetByName('contents');
  if (!ct || ct.getLastRow() < 2) return '';
  let name = '';
  ct.getRange(2, 1, ct.getLastRow() - 1, 6).getValues().forEach(r => {
    if (r[1] === 'season' && Number(r[5]) === monthNum) name = String(r[2]);
  });
  return name;
}

function writeLeagueHistory(ss, tz, ym, mPts, rank, clsOf, nameOf) {
  const lh = ensureSheet(ss, 'league_history',
    ['월', '시즌', '챔피언반', '챔피언포인트', '준우승', '준우승포인트',
     'MVP_id', 'MVP이름', 'MVP포인트', 'created_at']);
  if (lh.getLastRow() >= 2) {
    const exists = lh.getRange(2, 1, lh.getLastRow() - 1, 1).getValues()
      .some(r => String(r[0]) === ym);
    if (exists) { Logger.log(ym + ' 리그 기록 이미 존재 — 스킵'); return; }
  }
  const cls = {};
  Object.keys(mPts).forEach(sid => {
    const c = clsOf[sid];
    if (!c) return;
    cls[c] = (cls[c] || 0) + (mPts[sid] || 0);
  });
  const ranked = Object.keys(cls).map(c => ({ name: c, pts: cls[c] }))
    .sort((a, b) => b.pts - a.pts);
  if (!ranked.length || ranked[0].pts <= 0) { Logger.log('리그: 유효 데이터 없음'); return; }

  let mvpId = '';
  Object.keys(rank).forEach(sid => { if (rank[sid] === 1 && !mvpId) mvpId = sid; });
  const champ = ranked[0], runner = ranked[1] || { name: '', pts: '' };
  const season = seasonNameOf(ss, Number(ym.substring(5, 7)));

  lh.getRange(lh.getLastRow() + 1, 1, 1, 10).setValues([[
    ym, season, champ.name, champ.pts, runner.name, runner.pts,
    mvpId, mvpId ? (nameOf[mvpId] || '') : '', mvpId ? (mPts[mvpId] || 0) : '', new Date()
  ]]);

  // [v6.6] 지난달의 전당 — 학생 홈 고정 배너용 app_state 키 (Glide는 키 하나만 바인딩)
  const stH = ss.getSheetByName('app_state');
  if (stH) {
    setState(stH, '지난달의전당',
      '🏛 ' + Number(ym.substring(5, 7)) + '월의 전당 — 챔피언 ' + champ.name +
      ' (' + champ.pts + 'P)' + (mvpId ? ' · MVP ' + (nameOf[mvpId] || '') : ''));
  }

  const label = Number(ym.substring(0, 4)) + '년 ' + Number(ym.substring(5, 7)) + '월';
  addNotice(ss,
    '🏆 ' + label + (season ? " '" + season + "' 시즌" : '') + ' 리그 결과!',
    '챔피언: ' + champ.name + ' (' + champ.pts + 'P) 🎉' +
    (mvpId ? ' · 이달의 MVP: ' + (nameOf[mvpId] || mvpId) + ' (' + (mPts[mvpId] || 0) + 'P)' : '') +
    ' — 명예의 전당에 기록되었습니다!');
  Logger.log('리그 기록: ' + champ.name);
}

/* ===================== [v5] 자동 공지 (notices 시트 → 앱 공지 탭) =====================
 * notices 헤더를 자동 인식 (title/제목, body·content/내용·본문, created_at/날짜)
 * 못 찾으면 1·2·3열에 기록. 시트가 없으면 조용히 스킵.                      */

function addNotice(ss, title, body) {
  const sh = ss.getSheetByName('notices');
  if (!sh) { Logger.log('notices 시트 없음 — 공지 생략'); return; }
  const lastCol = Math.max(sh.getLastColumn(), 3);
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(h => String(h).trim().toLowerCase());
  function find(cands) {
    for (let i = 0; i < headers.length; i++) {
      if (cands.indexOf(headers[i]) > -1) return i;
    }
    return -1;
  }
  let iT = find(['title', '제목']);
  let iB = find(['body', 'content', '내용', '본문']);
  let iC = find(['created_at', 'date', '날짜', '작성일']);
  if (iT === -1 && iB === -1) { iT = 0; iB = 1; if (iC === -1) iC = 2; }
  const row = new Array(lastCol).fill('');
  if (iT > -1) row[iT] = title;
  if (iB > -1) row[iB] = body;
  if (iC > -1) row[iC] = new Date();
  sh.getRange(sh.getLastRow() + 1, 1, 1, lastCol).setValues([row]);
}

/* ===================== [v5] 콘텐츠 셋업 (contents 6열 v4 스키마) =====================
 * 스키마: [id, type, name(C), text(D), extra(E), value(F)]
 * 같은 type만 교체하고 나머지(store·quote 등)는 그대로 유지.                */

function replaceContentType(ss, type, items) {
  // [v5.2] 전체 열 보존 — G열(몽골어)/H열(영어) 번역이 다른 type의 setup 재실행에도 밀리지 않음
  //        단, 같은 type을 재실행하면 그 type의 번역은 초기화됨 → translateContents 재실행
  const ct = ss.getSheetByName('contents') ||
    ensureSheet(ss, 'contents', ['콘텐츠ID','유형','이름','설명','이미지URL','순번','몽골어','영어']); // [v9.9] 무에서 재건 대응
  const last = ct.getLastRow();
  const width = Math.max(ct.getLastColumn(), 8);
  if (last >= 2) {
    const data = ct.getRange(2, 1, last - 1, width).getValues();
    const keep = data.filter(r => r[1] !== type);
    ct.getRange(2, 1, last - 1, width).clearContent();
    if (keep.length) ct.getRange(2, 1, keep.length, width).setValues(keep);
  }
  if (items.length) {
    const rows = items.map(it => {
      const r = it.slice(0, width);
      while (r.length < width) r.push('');
      return r;
    });
    ct.getRange(ct.getLastRow() + 1, 1, rows.length, width).setValues(rows);
  }
  Logger.log("contents '" + type + "' " + items.length + '개 입력 완료');
}

function setupMonsters() {
  // ⚠️ 기존 monster 행을 아래 5단계(뇌과학 진화 라인)로 교체합니다.
  //    임계값은 F열, Recraft 이미지 URL은 E열에 입력하면 도감에서 사용 가능.
  //    행 순서 = 진화 순서(임계값 오름차순)로 유지해주세요.
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  replaceContentType(ss, 'monster', [ // [v9.11] 도감 스토리 — 아기자기·1~2문장, 뇌과학 은유 유지
    ['M01','monster','뉴로','알 속에서 바깥세상의 소리를 가만히 엿듣는 아기 뉴런 🥚 네가 첫 단어를 말하는 순간, 껍질에 처음으로 금이 가요.','',0],
    ['M02','monster','스파키','태어나자마자 번쩍! 첫 신호를 쏜 꼬마 ⚡ 신나면 참지 못하고 머리끝에서 스파크가 파바박 튀어요.','',100],
    ['M03','monster','링커','친구 사귀기가 세상에서 제일 좋은 연결쟁이 🔗 외로운 단어들의 손을 잡아 문장으로 만들어 줘요.','',250],
    ['M04','monster','서킷','몸에 반짝이는 회로를 두른 꼬마 발명가 💡 네가 배운 길들이 서로 이어져, 몸 위에 작은 지도가 생겼어요.','',500],
    ['M05','monster','미엘로','붉은 망토에 촛불을 든 배움의 순례자 🕯️ 매일의 반복 연습이 이 작은 불씨를 꺼지지 않는 등불로 키워요.','',900],
    ['M06','monster','플로우','지팡이를 짚고 양손에서 빛이 흐르는 현자 ✨ 이제 생각보다 한국어가 먼저, 물처럼 흘러나와요.','',1500],
    ['M07','monster','싱크마스터','빛의 왕관과 황금 홀을 든 시냅스의 왕 👑 그가 지나가면 반 전체가 환해져요 — 배움의 끝에서, 모든 것이 이어졌어요.','',2400]
  ]);
  calcAll();
}


function setupBrainTips() { // [v8.6] 오늘의 시냅스 팁 — 홈 최하단 한 줄 (v7.9 폐지 → 재설계 부활)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  replaceContentType(ss, 'braintip', [
    ['BT01','braintip','단어는 잘 때 저장된다 — 시험 전날 밤샘보다 7시간 수면이 점수를 올린다 😴','','',1],
    ['BT02','braintip','오늘·내일·일주일 뒤, 세 번 만난 단어는 평생 친구가 된다 📅','','',2],
    ['BT03','braintip','다시 읽기보다 덮고 떠올리기 — 뇌는 꺼낼 때 강해진다 🎯','','',3],
    ['BT04','braintip','같은 문장을 소리 내어 반복할 때, 뇌 속 전선에 절연 테이프(미엘린)가 감긴다 ⚡','','',4],
    ['BT05','braintip','공부 시작이 힘들면 "딱 5분만" — 시작된 뇌는 멈추기가 더 어렵다 ⏱️','','',5],
    ['BT06','braintip','20분 걷기는 해마에 물 주기 — 산책 후 외운 단어는 더 오래 산다 🚶','','',6],
    ['BT07','braintip','단어를 그림과 함께 — 두 개의 길로 저장된 기억은 두 배로 튼튼하다 🖼️','','',7],
    ['BT08','braintip','책상에서만 외운 말은 책상에서만 나온다 — 버스에서도 한 문장 🚌','','',8],
    ['BT09','braintip','웃으며 배운 표현은 잊히지 않는다 — 재미는 기억의 접착제 😄','','',9],
    ['BT10','braintip','입 밖으로 나온 문장만 진짜 내 것 — 오늘 배운 것, 소리 내어 한 문장 🗣️','','',10],
    ['BT11','braintip','전화번호처럼 — 긴 문장은 덩어리 3개로 쪼개면 외워진다 🧩','','',11],
    ['BT12','braintip','틀린 순간 뇌는 가장 크게 배운다 — 실수는 시냅스의 공사 신호 🚧','','',12],
    ['BT13','braintip','친구에게 설명해보라 — 가르칠 수 있으면 아는 것이다 👥','','',13],
    ['BT14','braintip','자고 일어난 직후 5분 복습 — 밤새 정리된 기억에 도장 찍기 ☀️','','',14],
    ['BT15','braintip','타이핑보다 손으로 — 손이 그린 글자는 뇌에 더 깊이 새겨진다 ✍️','','',15],
    ['BT16','braintip','가사 있는 노래는 공부의 적, 공부 끝의 보상으로는 최고 🎧','','',16],
    ['BT17','braintip','뇌의 75%는 물 — 목마름은 집중력 도둑 💧','','',17],
    ['BT18','braintip','뇌는 동시에 두 가지를 못 한다 — 폰은 다른 방에 📵','','',18],
    ['BT19','braintip','"TOPIK 합격"보다 "오늘 단어 10개" — 뇌는 작은 승리를 연료로 쓴다 🔥','','',19],
    ['BT20','braintip','하굣길에 오늘 배운 것 3가지 떠올리기 — 걷는 뇌는 기억을 정리한다 🌆','','',20],
    ['BT21','braintip','자기 전 10분 암기는 프라임 타임 — 방해 없이 바로 저장된다 🌙','','',21],
    ['BT22','braintip','발음이 정확해지면 듣기가 뚫린다 — 입과 귀는 한 회로 👂','','',22],
    ['BT23','braintip','어제의 나와만 비교 — 남과의 비교는 학습 호르몬을 꺼버린다 🪞','','',23],
    ['BT24','braintip','25분 집중 + 5분 멍때리기 — 멍때리는 동안 뇌가 정리정돈한다 🧹','','',24],
    ['BT25','braintip','답보다 질문이 기억된다 — "왜?"라고 물은 내용은 오래간다 ❓','','',25],
    ['BT26','braintip','단어 5개로 이야기 만들기 — 뇌는 목록보다 이야기를 사랑한다 📖','','',26],
    ['BT27','braintip','"나는 한국어가 는다"고 말하는 뇌는 정말 그렇게 배선된다 🧠','','',27],
    ['BT28','braintip','아침 햇빛 10분 — 오늘 밤 수면의 질을 예약하는 스위치 🌅','','',28],
    ['BT29','braintip','배운 지 24시간 안에 한 번 복습 — 망각곡선이 꺾인다 📉','','',29],
    ['BT30','braintip','매일 +10P — 시냅스는 폭발이 아니라 누적으로 자란다 🌱','','',30]
  ]);
  Logger.log('브레인팁 30종 OK');
}

function setupSeasons() {
  // 리그 시즌명 12종 (K-컬처 테마 · 창작명) — 명예의 전당/공지에 자동 사용
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  replaceContentType(ss, 'season', [
    ['SE01','season','첫눈의 시냅스','새해 첫 연결을 만드는 달','',1],
    ['SE02','season','설날 포인트 대잔치','세뱃돈 대신 포인트!','',2],
    ['SE03','season','새 학기 K-캠퍼스','새 교실, 새 에너지','',3],
    ['SE04','season','벚꽃 스터디 피크닉','꽃길만 걷는 공부','',4],
    ['SE05','season','한강의 봄','초록 위의 집중력','',5],
    ['SE06','season','미리 여름 페스티벌','축제처럼 공부하기','',6],
    ['SE07','season','한강 나이트','열대야를 이기는 시냅스','',7],
    ['SE08','season','서울 서머 웨이브','파도처럼 밀려오는 성장','',8],
    ['SE09','season','추석 보름달','꽉 찬 달처럼 꽉 찬 포인트','',9],
    ['SE10','season','단풍 로드','물들어가는 실력','',10],
    ['SE11','season','수능 파이팅','대한민국 집중의 달, 우리도!','',11],
    ['SE12','season','연말 시상식','올해의 MVP를 가리자','',12]
  ]);
}

/* ===================== [v6.2] 시스템 워치독 (매주 월 7시 · 읽기 전용) =====================
 * 정적 검사로 못 잡는 "살아있는 시스템"의 이상을 감시:
 * 트리거 실종 · 데일리 로테이션 멈춤 · 셋업 미실행/부분 실행 · 데이터 무결성 · 번역 적체.
 * 이상이 곪기 전에 월요일 아침 메일이 먼저 알립니다. */

function systemWatchdog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const out = [];
  function add(ok, msg) { out.push((ok ? '✅ ' : '⚠️ ') + msg); }

  // 1) 필수 트리거 생존
  const have = {};
  ScriptApp.getProjectTriggers().forEach(t => { have[t.getHandlerFunction()] = true; });
  ['calcAll', 'parentSweep', 'sendMorningDigest'].forEach(f => {
    add(!!have[f], '필수 트리거 ' + f + (have[f] ? ' 정상' : ' 실종! — setupV5Triggers/트리거 화면 확인'));
  });
  const recommended = ['dailyBackup', 'morningJobs', 'nightJobs', 'weeklyJobs',
    'monthlyJobs', 'monthlyReportCards', 'monthlyReport']; // [v7.0] v6.3 통합 트리거 기준
  const missing = recommended.filter(f => !have[f]);
  add(missing.length === 0, '권장 트리거: ' + (missing.length ? missing.join(', ') + ' 미등록 (의도적이면 무시)' : '전부 등록됨'));

  // 2) 데일리 로테이션 생존 (멈춤 = 트리거/시간대 문제 신호)
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const hw = props.getProperty('숙제기준일') || '(없음)';
  const daysOld = hw === '(없음)' ? 99 :
    Math.round((new Date(today) - new Date(hw)) / 86400000);
  add(daysOld <= 2, '오늘의 숙제 게시: 마지막 ' + hw +
    (daysOld > 2 ? ' — 21~23시 calcAll 트리거가 없거나 시간대가 어긋났을 가능성!' : ' (정상)'));
  const stW = ss.getSheetByName('app_state');
  const keys = {};
  if (stW && stW.getLastRow() >= 2) {
    stW.getRange(2, 1, stW.getLastRow() - 1, 2).getValues().forEach(r => { keys[r[0]] = r[1]; });
  }
  add(!!keys['오늘의퀴즈'], 'app_state 오늘의퀴즈: ' + (keys['오늘의퀴즈'] ? '있음' : '없음 — setupQuiz 실행 여부 확인'));
  add(!!keys['오늘의팁'], 'app_state 오늘의팁: ' + (keys['오늘의팁'] ? '있음' : '없음 — setupBrainTips 실행 여부 확인')); // [v8.6]

  // 3) 셋업 실행 상태 (contents 수량 대조 — 부분 실행 감지)
  const expect = { monster: 7, homework: 210, quiz: 100, lore: 11, fuel: 6, boss: 12, // [v7.8] 시즌 보스 12
    season: 12, label: 15, reason: 8, cheer: 7, cheermail: 30, braintip: 30, worldboss: 1 }; // [v9.9]
  const cnt = {};
  let bossImg = 0, monThr = [], loreTier = 0;
  const ct = ss.getSheetByName('contents');
  if (ct && ct.getLastRow() >= 2) {
    ct.getRange(2, 1, ct.getLastRow() - 1, 6).getValues().forEach(r => {
      const t = String(r[1] || '');
      if (!t) return;
      cnt[t] = (cnt[t] || 0) + 1;
      if (t === 'boss' && String(r[4] || '').indexOf('http') === 0) bossImg++;
      if (t === 'monster') monThr.push(Number(r[5]) || 0);
      if (t === 'lore' && String(r[4] || '')) loreTier++;
    });
  }
  const bad = Object.keys(expect).filter(k => (cnt[k] || 0) !== expect[k]);
  add(bad.length === 0, '콘텐츠 수량: ' + (bad.length
    ? bad.map(k => k + ' ' + (cnt[k] || 0) + '/' + expect[k]).join(', ') + ' — 해당 setup 함수 재실행 필요'
    : '10종 전부 정상'));
  const sortedOk = monThr.length < 2 || monThr.every((v, i) => i === 0 || v >= monThr[i - 1]);
  add(sortedOk, '몬스터 임계값 오름차순: ' + (sortedOk ? '정상' : '순서 꼬임! 진화 오작동 위험'));
  add(bossImg === 12, '보스 이미지 URL: ' + bossImg + '/12' + (bossImg < 12 ? ' — contents boss E열 입력(시즌 보스 12종)' : '')); // [v7.8]
  add(loreTier === 11, '칭호 로어 등급(E열): ' + loreTier + '/11' + (loreTier < 11 ? ' — setupTitleLore 재실행(v6.1)' : ''));

  // 4) 데이터 무결성
  const pl = ss.getSheetByName('point_logs');
  if (pl && pl.getLastRow() >= 3) {
    const n = Math.min(pl.getLastRow() - 1, 800);
    const idsW = pl.getRange(pl.getLastRow() - n + 1, 1, n, 1).getValues().map(r => String(r[0]));
    const seen = {}; let dupN = 0;
    idsW.forEach(id => { if (id) { if (seen[id]) dupN++; seen[id] = true; } });
    add(dupN === 0, 'PL ID 중복(최근 ' + n + '행): ' + dupN + '건');
  }
  const pfW = ss.getSheetByName('profiles');
  if (pfW && pfW.getLastRow() >= 2) {
    const hdrOk = String(pfW.getRange('AJ1').getValue()) === '반유형';
    add(hdrOk, 'profiles 확장열(AE~AJ) 헤더: ' + (hdrOk ? '정상' : 'AJ 헤더 없음 — 최신 calcAll 1회 실행'));
  }
  const nt = ss.getSheetByName('notices');
  if (nt && nt.getLastRow() >= 2) {
    const lc = nt.getLastColumn();
    const hd = nt.getRange(1, 1, 1, lc).getValues()[0].map(h => String(h).toLowerCase());
    const iBm = hd.indexOf('body_mn');
    if (iBm > -1) {
      let untr = 0;
      (nt.getLastRow() < 2 ? [] : nt.getRange(2, 1, nt.getLastRow() - 1, lc).getValues()).forEach(r => { // [v8.7]
        if (r[0] && !String(r[iBm] || '')) untr++;
      });
      add(untr <= 10, '공지 몽골어 미번역 적체: ' + untr + '건' + (untr > 10 ? ' — 번역 쿼터/스위프 확인' : ''));
    }
  }

  const report = '🛡️ SYNK 시스템 워치독 · ' +
    Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm') + '\n\n' + out.join('\n') +
    '\n\n⚠️가 하나라도 있으면 그 줄만 공유해주세요 — 나머지는 건강합니다.';
  Logger.log(report);
  const warn = out.filter(l => l.indexOf('⚠️') === 0).length;
  if (quotaOk(1)) {
    MailApp.sendEmail(ADMIN_EMAIL,
      '[SYNK] 🛡️ 주간 워치독 ' + (warn ? '⚠️ ' + warn + '건' : '✅ 전부 정상'), report);
  }
}

/* ===================== [v5.8] 상담 연동 진단 (수동 실행 · 읽기 전용) =====================
 * 상담시트↔profiles↔폼 연동 상태를 점검해 원장 메일로 보고. 데이터는 절대 수정하지 않음. */

function checkConsultSync() {
  const out = [];
  function add(ok, msg) { out.push((ok ? '✅ ' : '⚠️ ') + msg); }
  let src = null;
  try {
    const srcSs = SpreadsheetApp.openById(CONSULT_SHEET_ID);
    src = srcSs.getSheetByName('상담데이터입력');
    add(!!src, '상담시트 접근: ' + srcSs.getName() + (src ? " — '상담데이터입력' 탭 OK" : " — '상담데이터입력' 탭 없음!"));
  } catch (e) { add(false, '상담시트 열기 실패 — ID/권한 확인 필요: ' + e); }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let consultCnt = 0, noId = [], dup = [], ids = {};
  if (src && src.getLastRow() >= 3) {
    src.getRange(3, 1, src.getLastRow() - 2, 62).getValues().forEach((r, i) => { // [v8.3] v18.1
      if (!r[0]) return;
      consultCnt++;
      const id = String(r[59] || '').trim();
      if (!id) noId.push((i + 3) + '행 ' + r[0]);
      else { if (ids[id]) dup.push(id); ids[id] = true; }
    });
    add(true, '상담시트 학생(이름 있는 행): ' + consultCnt + '명');
    add(noId.length === 0, '학생ID(BH열) 누락: ' + noId.length + '명' +
      (noId.length ? ' → ⚠️ 동기화에서 조용히 빠집니다! ' + noId.slice(0, 5).join(', ') : ''));
    add(dup.length === 0, '학생ID 중복: ' + (dup.length ? dup.join(', ') : '없음'));
  }

  const pf = ss.getSheetByName('profiles');
  let pfCnt = 0, noEmail = 0, noClass = 0, orphan = [];
  if (pf && pf.getLastRow() >= 2) {
    pf.getRange(2, 1, pf.getLastRow() - 1, 26).getValues().forEach(r => {
      if (!r[0] || r[3] !== 'student') return;
      pfCnt++;
      if (String(r[25] || '').indexOf('@') === -1) noEmail++;
      if (!r[4]) noClass++;
      if (Object.keys(ids).length && !ids[r[0]]) orphan.push(r[0]);
    });
  }
  add(true, 'profiles 학생: ' + pfCnt + '명 (상담시트 유효 인원과 차이: ' +
    Math.abs(pfCnt - Math.max(consultCnt - noId.length, 0)) + '명)');
  add(noEmail === 0, '학부모 이메일(Z열) 미입력: ' + noEmail + '명 — 등원 메일을 못 받습니다');
  add(noClass === 0, '반 미배정: ' + noClass + '명');
  add(orphan.length === 0, '상담시트에 없는 profiles ID: ' +
    (orphan.length ? orphan.slice(0, 5).join(', ') + ' — 다음 syncProfiles에서 사라질 수 있음!' : '없음'));

  const st = ss.getSheetByName('app_state');
  const formId = st ? String(getState(st, '상담폼ID').val || '') : '';
  add(!!formId, '상담폼 연결: ' + (formId ? 'OK (ID 저장됨)' : '미설정 — createConsultForm 실행 필요'));
  const fr = ss.getSheetByName('form_responses');
  add(true, 'form_responses 누적: ' + (fr && fr.getLastRow() > 1 ? (fr.getLastRow() - 1) + '건' : '0건'));

  const report = '🔎 SYNK 상담 연동 진단\n' + Utilities.formatDate(new Date(),
    ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm') + '\n\n' + out.join('\n') +
    '\n\n※ 읽기 전용 진단 — 어떤 데이터도 수정하지 않았습니다.';
  Logger.log(report);
  if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 🔎 상담 연동 진단 결과', report);
}

/* ===================== [v9.19] 상담시트 헤더 덤프 (수동 · 읽기 전용) =====================
 * 폼 질문을 시트 버전(v18.3 등)에 맞출 때, 시트 2행 헤더를 열 번호와 함께 그대로 출력.
 * createConsultForm/importFormResponses 정렬의 기준 자료. 데이터는 수정하지 않음. */
function dumpConsultHeaders() {
  let out = [];
  try {
    const consult = SpreadsheetApp.openById(CONSULT_SHEET_ID).getSheetByName('상담데이터입력');
    if (!consult) { Logger.log("'상담데이터입력' 탭 없음 — 탭 이름 확인"); return; }
    const w = Math.max(consult.getLastColumn(), 62);
    const h = consult.getRange(2, 1, 1, w).getValues()[0]; // 헤더는 2행
    h.forEach((v, i) => { if (String(v).trim() !== '') out.push((i + 1) + '\t' + String(v).trim()); });
  } catch (e) { Logger.log('상담시트 열기 실패: ' + e); return; }
  Logger.log('=== 상담데이터입력 헤더(2행) · ' + out.length + '개 ===\n' + out.join('\n'));
}

/* ===================== [v9.19] 상담폼 ↔ 시트 매핑 진단 (수동 · 읽기 전용) =====================
 * 폼 질문지가 바뀌었을 때 "제대로 적용됐는지" 검증. importFormResponses와 동일 규칙(제목=헤더명 매칭,
 * 매칭 안 되면 노션이관)으로, 각 질문이 어느 칸에 들어가는지·노션이관으로 빠지는지·빈 칸은 뭔지 보고.
 * 인자로 새 폼 ID를 주면 상담폼ID를 바꾸기 전에 미리 검증 가능: checkFormMapping('새폼ID')
 * 무인자 호출은 app_state '상담폼ID'(현재 연결된 폼)를 검사. 데이터는 절대 수정하지 않음. */
function checkFormMapping(optId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const formId = String(optId || getState(st, '상담폼ID').val || '').trim();
  if (!formId) { Logger.log('폼 ID 없음 — checkFormMapping("폼ID")로 호출하거나 createConsultForm 먼저 실행'); return; }

  let form;
  try { form = FormApp.openById(formId); }
  catch (e) { Logger.log('폼 열기 실패 — ID 무효/권한 없음(' + formId + '): ' + e); return; }

  let headers = [];
  try {
    const consult = SpreadsheetApp.openById(CONSULT_SHEET_ID).getSheetByName('상담데이터입력');
    headers = consult.getRange(2, 1, 1, 62).getValues()[0].map(h => String(h || '').trim()); // [v8.4] v18.1 헤더 2행
  } catch (e) { Logger.log('상담시트 열기 실패 — ID/권한 확인: ' + e); return; }
  const colOf = {};
  headers.forEach((h, i) => { if (h) colOf[h] = i + 1; });

  // 답변형 문항만 (섹션 헤더·이미지·페이지 나눔 제외)
  const answerable = [FormApp.ItemType.TEXT, FormApp.ItemType.PARAGRAPH_TEXT, FormApp.ItemType.MULTIPLE_CHOICE,
    FormApp.ItemType.CHECKBOX, FormApp.ItemType.LIST, FormApp.ItemType.DATE, FormApp.ItemType.DATETIME,
    FormApp.ItemType.TIME, FormApp.ItemType.SCALE, FormApp.ItemType.GRID];
  const titles = form.getItems().filter(it => answerable.indexOf(it.getType()) > -1).map(it => String(it.getTitle()).trim());

  const matched = [], narrative = [], dupTitle = [], seen = {};
  titles.forEach(t => {
    if (seen[t]) dupTitle.push(t);
    seen[t] = true;
    const c = colOf[t];
    if (c && c <= 59) matched.push('  · ' + t + ' → ' + c + '열'); // importFormResponses와 동일 규칙(1~59열만 시트 기입)
    else narrative.push('  · ' + t + (c ? ' (헤더 존재하나 ' + c + '열>59 → 노션이관)' : ' → 노션이관(대응 헤더 없음)'));
  });

  // [v9.19] v18.3 기준 — 폼이 안 채워도 정상인 칸(자동 채번·타임스탬프·서술형 모음·강사 배정·자동 계산)
  const autoCols = { '학생ID': 1, '등록일': 1, '📝자유서술→노션': 1, '나이(자동)': 1, '반': 1, '비고': 1, '⚠위험신호(자동)': 1, '반조회순번(숨김)': 1 };
  const uncovered = [];
  headers.forEach((h, i) => { if (h && i < 59 && !seen[h] && !autoCols[h]) uncovered.push(h + '(' + (i + 1) + '열)'); });

  const out = [
    '🔎 상담폼 ↔ 시트 매핑 진단',
    '폼: ' + form.getTitle() + ' (ID ' + formId + ')',
    '폼 질문 ' + titles.length + '개 · 시트 헤더 ' + Object.keys(colOf).length + '개',
    '',
    '✅ 시트 칸에 정상 매핑 (' + matched.length + '):', matched.join('\n') || '  (없음)',
    '',
    '📝 노션이관으로 들어가는 질문 (' + narrative.length + ') — 서술형이면 정상 / 아니면 제목 오타 의심:',
    narrative.join('\n') || '  (없음)',
    '',
    '⚠️ 폼에 대응 질문이 없는 시트 칸 (' + uncovered.length + ', 자동·계산열 제외): ' + (uncovered.length ? uncovered.join(', ') : '없음'),
    (dupTitle.length ? '\n⚠️ 중복 질문 제목: ' + dupTitle.join(', ') : ''),
    '',
    '※ 읽기 전용 진단 — 어떤 데이터도 수정하지 않았습니다.'
  ].filter(l => l !== '');
  const report = out.join('\n');
  Logger.log(report);
  if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 🔎 상담폼 매핑 진단', report);
}

/* ===================== [v5.4] 원장 브리핑 (일상 알림 통합) =====================
 * 생일·진화·임박·업적·신규학생 같은 "좋은 소식"은 개별 발송 대신 큐에 모아 아침 8시 1통.
 * 긴급/액션 필요(미납·상담지연·신규상담·헬스체크·쿼터)는 기존대로 즉시 발송 유지.   */

function adminMail(subject, body) {
  if (!DIGEST_MODE) { if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, subject, body); return; }
  const p = PropertiesService.getScriptProperties();
  const cur = p.getProperty('브리핑큐') || '';
  const item = '■ ' + subject.replace('[SYNK] ', '') + '\n' + body + '\n\n';
  if ((cur + item).length > 8500) { // Properties 9KB 한계 보호 — 넘치면 즉시 발송
    if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, subject, body);
    return;
  }
  p.setProperty('브리핑큐', cur + item);
}

function sendMorningDigest() {
  const p = PropertiesService.getScriptProperties();
  const q = p.getProperty('브리핑큐');
  if (!q) return;
  p.deleteProperty('브리핑큐');
  if (quotaOk(1)) {
    MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] ☀️ 오늘의 운영 브리핑',
      q + '— 개별 알림을 아침 1통으로 모았습니다 (DIGEST_MODE)');
  }
}

/* ===================== [v6.8] 강사 알림 (10분 스위프에서 호출) =====================
 * ① classPrepMail_: 수업 시작 0~12분 전 — 오늘 검사할 숙제·워밍업 퀴즈·연료 리마인드 브리핑
 * ② checkoutCheerMail_: 퇴근 기록 5분+ 경과 시 — 응원 메일 (30종 일자 로테이션)
 * 상태는 전부 Script Properties — 시트 쓰기 0. 강사 이메일은 profiles teacher 행에서 자동 탐지. */

function teacherEmailMap_(ss) {
  const out = { byKey: {}, byClass: {} };
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return out;
  pf.getRange(2, 1, pf.getLastRow() - 1, 26).getValues().forEach(r => {
    if (r[3] !== 'teacher') return;
    let email = '';
    for (let c = 0; c < 26; c++) {
      if (String(r[c] || '').indexOf('@') > 0) { email = String(r[c]).trim(); break; }
    }
    if (!email) return;
    [r[0], r[1], r[2]].forEach(k => { if (k) out.byKey[String(k).trim()] = email; });
    String(r[4] || '').split(/[,/·]/).forEach(part => {
      const nm = String(part).trim(); // [v8.3] 반명 키 우선 + 번호 키(자유화 호환)
      if (!nm) return;
      (out.byClass[nm] = out.byClass[nm] || []).push({ email: email, name: String(r[1] || r[0]) });
      const n = classNumOf(nm);
      if (n && n !== nm) (out.byClass[n] = out.byClass[n] || []).push({ email: email, name: String(r[1] || r[0]) });
    });
  });
  return out;
}

function classPrepMail_(ss, tz) {
  const now = new Date();
  const day = now.getDay();
  const isWknd = (day === 0 || day === 6);
  const todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const props = PropertiesService.getScriptProperties();
  const key = '수업알림_' + todayStr;
  const sent = String(props.getProperty(key) || '');
  let sentNew = sent;

  const sch = scheduleMap(ss);
  const emap = teacherEmailMap_(ss);
  const bdayByClass = {}; // [v9.0] 오늘 생일자 → 브리핑 한 줄 (교실 축하 유도)
  {
    const pfB = ss.getSheetByName('profiles');
    if (pfB && pfB.getLastRow() >= 2) {
      const mmddB = Utilities.formatDate(now, tz, 'MM-dd');
      pfB.getRange(2, 1, pfB.getLastRow() - 1, 6).getValues().forEach(r => {
        if (!r[0] || r[3] !== 'student' || !r[5]) return;
        const v = r[5]; let md = '';
        if (v instanceof Date) md = Utilities.formatDate(v, tz, 'MM-dd');
        else { const s0 = String(v).replace(/\D/g, ''); if (s0.length === 8) md = s0.substring(4,6) + '-' + s0.substring(6,8); }
        if (md === mmddB) (bdayByClass[String(r[4])] = bdayByClass[String(r[4])] || []).push(r[1] || r[0]);
      });
    }
  }
  const st = ss.getSheetByName('app_state');
  const kv = {};
  if (st && st.getLastRow() >= 2) {
    st.getRange(2, 1, st.getLastRow() - 1, 2).getValues().forEach(r => { kv[r[0]] = r[1]; });
  }

  Object.keys(sch).filter(num => sch[num].name === num).forEach(num => { // [v8.3] 반명 키만
    const s = sch[num];
    if ((String(s.type) === '주말') !== isWknd) return;
    const m = String(s.time || '').match(/(\d{1,2})\s*[:시]?\s*(\d{2})?/);
    if (!m) return;
    const start = new Date(now);
    start.setHours(Number(m[1]), Number(m[2] || 0), 0, 0);
    const diff = (start - now) / 60000;
    if (diff <= 0 || diff > CLASS_PREP_WINDOW_MIN) return;
    if (sentNew.indexOf('[' + num + ']') > -1) return;
    const teachers = emap.byClass[num] || [];
    if (!teachers.length) { sentNew += '[' + num + ']'; return; }

    const hwT = String((isWknd ? kv['주말의숙제유형'] : kv['오늘의숙제유형']) || '');
    const hw = String((isWknd ? kv['주말의숙제'] : kv['오늘의숙제']) || '');
    const quiz = String(kv['오늘의퀴즈'] || '').split('|')[0];
    const cname = s.name || (num + '반');
    const body = cname + ' 수업 시작 ' + Math.round(diff) + '분 전입니다.\n' +
      (bdayByClass[cname] ? '\n🎂 오늘 ' + bdayByClass[cname].join(', ') + ' 생일! 반 전체 축하 한 번 어때요?\n' : '') + '\n' +
      '⚡ 오늘의 루틴: 시작 — 숙제 검사 1탭 · 끝 — 왕관 2개(🌟MVP·⚡시냅스 각 1명) · 미션 성공 시 연료 1행\n\n' +
      '📚 오늘 검사할 숙제' + (hwT ? ' (' + hwT + ')' : '') + '\n' + (hw || '게시된 숙제 없음') + '\n\n' +
      (quiz ? '⚡ 워밍업 퀴즈: ' + quiz + '\n\n' : '') +
      '🔥 연료 미션을 걸 계획이면 수업 시작 때 선언해 주세요!\n\n좋은 수업 되세요 — SYNK LAB';
    teachers.forEach(t => {
      if (quotaOk(1)) MailApp.sendEmail(t.email, '[SYNK] 🎬 ' + cname + ' 수업 ' + Math.round(diff) + '분 전 — 오늘의 준비', body);
    });
    sentNew += '[' + num + ']';
  });
  if (sentNew !== sent) props.setProperty(key, sentNew);
  const yest = Utilities.formatDate(new Date(now.getTime() - 86400000), tz, 'yyyy-MM-dd');
  props.deleteProperty('수업알림_' + yest); // 어제 키 정리
}

function checkoutCheerMail_(ss) {
  const tc = ss.getSheetByName('teacher_checkins');
  if (!tc || tc.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  const ptr = Number(props.getProperty('퇴근메일_포인터')) || 1;
  const last = tc.getLastRow();
  if (ptr >= last) return;
  const width = Math.max(TC_NAME_COL, TC_TYPE_COL, TC_TIME_COL);
  const rows = tc.getRange(ptr + 1, 1, last - ptr, width).getValues();
  const emap = teacherEmailMap_(ss);
  const now = new Date();

  const pool = [];
  const ct = ss.getSheetByName('contents');
  if (ct && ct.getLastRow() >= 2) {
    ct.getRange(2, 1, ct.getLastRow() - 1, 6).getValues().forEach(r => {
      if (r[1] === 'cheermail' && r[3]) pool.push(String(r[3]));
    });
  }

  let advanced = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const typ = String(r[TC_TYPE_COL - 1] || '');
    if (typ.indexOf('퇴근') === -1) { advanced = i + 1; continue; }
    const tRaw = r[TC_TIME_COL - 1];
    const t = (tRaw instanceof Date) ? tRaw : new Date(tRaw);
    if (!t || isNaN(t.getTime())) { advanced = i + 1; continue; }
    if ((now - t) / 60000 < CHECKOUT_MAIL_DELAY_MIN) break; // 아직 5분 미만 → 다음 스위프에서
    const who = String(r[TC_NAME_COL - 1] || '').trim();
    const email = emap.byKey[who] || '';
    if (email && pool.length && quotaOk(1)) {
      const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
      const msg = pool[(doy + i) % pool.length];
      MailApp.sendEmail(email, '[SYNK] 🌙 오늘도 수고하셨습니다',
        (who ? who + ' 선생님,\n\n' : '') + msg + '\n\n— SYNK LAB');
    }
    advanced = i + 1;
  }
  if (advanced > 0) props.setProperty('퇴근메일_포인터', String(ptr + advanced));
}

/* ===================== [v5.2] 학부모 스위프 (30분 간격) =====================
 * 알림 철학: 푸시(메일)는 '등원' 하나만. 칭찬·포인트·진화 같은 긍정 세부 기록은
 * 메일 없이 앱 안에서만 보여줌 → 알림 피로 없이 열어볼 이유를 만든다.
 * 1) 새 등원 기록 → 학부모 몽골어 메일 (오늘 기록만, 포인터 기반 중복 방지)
 * 2) notices 미번역분 → title_mn / body_mn 자동 채움                          */

function parentSweep() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (PARENT_MAIL_ARRIVAL) attendanceNotify_(ss); // [v7.9] 등원 즉시 알림은 기본 OFF
  translateNotices_(ss);
  translateTopics_(ss); // [v5.7] 이번 주 우리 반 배운 것 → 몽골어
  safeRun('importFormResponses', importFormResponses); // [v6.3] 상담 폼 접수 편입
  safeRun('classPrepMail', function () { classPrepMail_(ss, ss.getSpreadsheetTimeZone()); }); // [v6.8]
  safeRun('checkoutCheerMail', function () { checkoutCheerMail_(ss); }); // [v6.8]
  safeRun('todayBoard', function () { todayBoard_(ss); }); // [v8.1] 오늘의 출결 보드 (10분 갱신)
}

function translateTopics_(ss) {
  const sh = ss.getSheetByName('weekly_topics');
  if (!sh || sh.getLastRow() < 2) return;
  if (String(sh.getRange(1, 5).getValue()) === '') sh.getRange(1, 5).setValue('배운내용_mn');
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
  let done = 0;
  for (let i = 0; i < data.length && done < 10; i++) {
    const ko = String(data[i][1] || '');
    if (!ko || String(data[i][4] || '')) continue;
    try { sh.getRange(i + 2, 5).setValue(LanguageApp.translate(ko, 'ko', 'mn')); done++; }
    catch (e) { break; }
  }
}

function attendanceNotify_(ss) {
  if (!NOTIFY_PARENT_ATTENDANCE) return;
  const at = ss.getSheetByName('attendance');
  if (!at || at.getLastRow() < 2) return;
  const tz = ss.getSpreadsheetTimeZone();
  // [v5.3] 포인터를 Script Properties로 — 30분 스위프의 시트 쓰기(월 ~150업데이트) 제거
  const props = PropertiesService.getScriptProperties();
  let from = Number(props.getProperty('등원알림_포인터')) || 1; // 마지막 처리 행 (헤더 = 1)
  const lastRow = at.getLastRow();
  if (from >= lastRow) { return; }

  const pf = ss.getSheetByName('profiles');
  const info = {};
  (!pf || pf.getLastRow() < 2 ? [] : pf.getRange(2, 1, pf.getLastRow() - 1, 26).getValues()).forEach(r => { // [v8.2]
    if (r[0]) info[r[0]] = { name: r[1], pEmail: String(r[25] || '').trim() };
  });

  const rows = at.getRange(from + 1, 1, lastRow - from, 4).getValues();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const mails = [];
  rows.forEach(r => {
    const sid = r[1], d = r[2];
    if (!sid || !d) return;
    const s = info[sid];
    if (!s || s.pEmail.indexOf('@') === -1) return;
    if (dstr(d, tz) !== today) return; // 과거 날짜 정정 입력은 메일 생략
    const t = (d instanceof Date) ? Utilities.formatDate(d, tz, 'HH:mm') : '';
    mails.push({ to: s.pEmail, name: s.name, time: t });
  });

  if (mails.length && quotaOk(mails.length)) {
    mails.forEach(m => {
      MailApp.sendEmail(m.to,
        '[SYNK] ✅ ' + m.name + (m.time ? ' — ' + m.time : '') + ' ирлээ',
        'Сайн байна уу! 👋\n\n' +
        m.name + ' сурагч өнөөдөр' + (m.time ? ' ' + m.time + ' цагт' : '') + ' SYNK-д ирлээ ✅\n' +
        'Өнөөдрийн магтаал болон оноог аппаас харна уу 🙂\n\n' +
        '(' + m.name + ' 학생이 오늘' + (m.time ? ' ' + m.time + '에' : '') + ' 등원했습니다.)\n\n' +
        '— SYNK · Тархи судлалд суурилсан солонгос хэлний академи');
    });
  }
  props.setProperty('등원알림_포인터', String(lastRow)); // 쿼터 부족 시에도 전진 (다음 날 몰림 방지)
}

function translateNotices_(ss) {
  const sh = ss.getSheetByName('notices');
  if (!sh || sh.getLastRow() < 2) return;
  let headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(h => String(h).trim().toLowerCase());
  function find(cands) {
    for (let i = 0; i < headers.length; i++) if (cands.indexOf(headers[i]) > -1) return i;
    return -1;
  }
  let iT = find(['title', '제목']);
  let iB = find(['body', 'content', '내용', '본문']);
  if (iT === -1 && iB === -1) { iT = 0; iB = 1; }
  let iTm = headers.indexOf('title_mn');
  let iBm = headers.indexOf('body_mn');
  if (iTm === -1) { sh.getRange(1, sh.getLastColumn() + 1).setValue('title_mn'); iTm = sh.getLastColumn() - 1; }
  if (iBm === -1) { sh.getRange(1, sh.getLastColumn() + 1).setValue('body_mn'); iBm = sh.getLastColumn() - 1; }
  const width = sh.getLastColumn();
  const data = sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, width).getValues(); // [v8.2]
  let done = 0;
  for (let i = 0; i < data.length && done < 20; i++) {
    const row = data[i];
    const hasKo = String((iT > -1 ? row[iT] : '') || '') || String((iB > -1 ? row[iB] : '') || '');
    if (!hasKo) continue;
    if (String(row[iTm] || '') || String(row[iBm] || '')) continue; // 이미 번역됨
    try {
      if (iT > -1 && row[iT]) sh.getRange(i + 2, iTm + 1).setValue(LanguageApp.translate(String(row[iT]), 'ko', 'mn'));
      if (iB > -1 && row[iB]) sh.getRange(i + 2, iBm + 1).setValue(LanguageApp.translate(String(row[iB]), 'ko', 'mn'));
      done++;
    } catch (e) { Logger.log('공지 번역 쿼터 대기: ' + e); break; }
  }
  if (done) Logger.log('공지 몽골어 번역: ' + done + '건');
}

/* ===================== [v5.2] contents 다국어 초벌 번역 =====================
 * G열 = 몽골어, H열 = 영어. 빈 칸만 채움 · 실행당 60행 (쿼터에 걸리면 내일 재실행).
 * 기계번역 초안이므로 학습 콘텐츠(숙제·팁)는 몽골어 가능한 크루 검수 권장.        */

function translateContents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ct = ss.getSheetByName('contents');
  if (!ct || ct.getLastRow() < 2) return;
  if (String(ct.getRange(1, 7).getValue()) === '') ct.getRange(1, 7).setValue('몽골어(G)');
  if (String(ct.getRange(1, 8).getValue()) === '') ct.getRange(1, 8).setValue('영어(H)');
  const data = ct.getRange(2, 1, ct.getLastRow() - 1, 8).getValues();
  const targets = ['quote', 'braintip', 'homework', 'monster', 'season'];
  let done = 0;
  for (let i = 0; i < data.length && done < 60; i++) {
    const r = data[i];
    if (targets.indexOf(String(r[1])) === -1) continue;
    const ko = String(r[3] || r[2] || '');
    if (!ko) continue;
    if (String(r[6] || '') && String(r[7] || '')) continue;
    try {
      if (!String(r[6] || '')) ct.getRange(i + 2, 7).setValue(LanguageApp.translate(ko, 'ko', 'mn'));
      if (!String(r[7] || '')) ct.getRange(i + 2, 8).setValue(LanguageApp.translate(ko, 'ko', 'en'));
      done++;
    } catch (e) { Logger.log('번역 쿼터 도달 — ' + (i + 2) + '행부터 내일 이어서'); break; }
  }
  Logger.log('translateContents: ' + done + '행 완료');
}

/* ===================== [v5.2] 학부모 화면 라벨 (한·몽·영 직접 큐레이션) =====================
 * type='label' → Glide에서 화면 라벨을 데이터로 바인딩할 때 사용 (C=키, D=한국어, G=몽골어, H=영어)
 * type='reason' → point_logs.reason(C와 일치)을 학부모 화면에서 몽골어로 표시 (Relation→Lookup) */

function setupParentLabels() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  replaceContentType(ss, 'label', [
    ['L01','label','오늘우리아이','오늘 우리 아이','','','Өнөөдрийн миний хүүхэд','My Child Today'],
    ['L02','label','등원완료','등원 완료','','','Ирсэн','Checked in'],
    ['L03','label','등원시간','등원 시간','','','Ирсэн цаг','Arrival time'],
    ['L04','label','이번주출석','이번 주 출석','','','Энэ долоо хоногийн ирц','Attendance this week'],
    ['L05','label','이번달출석','이번 달 출석','','','Энэ сарын ирц','Attendance this month'],
    ['L06','label','칭찬기록','칭찬 기록','','','Магтаалын түүх','Praise history'],
    ['L07','label','이번달포인트','이번 달 포인트','','','Энэ сарын оноо','Points this month'],
    ['L08','label','월간리포트','월간 성장 리포트','','','Сарын өсөлтийн тайлан','Monthly growth report'],
    ['L09','label','공지사항','공지사항','','','Зарлал','Notices'],
    ['L10','label','내정보','내 정보','','','Миний мэдээлэл','My info'],
    ['L11','label','문의하기','선생님께 문의','','','Багштай холбогдох','Contact teacher'],
    ['L12','label','지각','지각','','','Хоцролт','Late'],
    ['L13','label','출석','출석','','','Ирц','Attendance'],
    ['L14','label','몬스터','내 몬스터','','','Миний монстер','My monster'],
    ['L15','label','언어','언어','','','Хэл','Language']
  ]);
  replaceContentType(ss, 'reason', [
    ['R01','reason','숙제완료','숙제 완료','','','Гэрийн даалгавраа хийсэн','Homework done'],
    ['R02','reason','오늘의 MVP','오늘 수업 최고의 참여자','','','Өнөөдрийн шилдэг оролцогч','Best participant of the day'],
    ['R03','reason','칭찬','칭찬','','','Магтаал','Praise'],
    ['R06','reason','오늘의 시냅스','오늘 가장 크게 성장한 학생','','','Өнөөдөр хамгийн их өссөн сурагч','Most improved of the day'],
    ['R07','reason','리그승리','반 대항 주간 리그 승리','','','Долоо хоногийн ангийн лигийн ялалт','Weekly class league win'],
    ['R08','reason','월드레이드','전교 월드 레이드 승리','','','Бүх сургуулийн ертөнцийн рейдийн ялалт','World raid victory'],
    ['R04','reason','생일','생일 축하','','','Төрсөн өдрийн мэнд','Birthday'],
    ['R05','reason','레이드보상','클래스 레이드 성공','','','Ангийн рейд амжилт','Class raid success']
  ]);
  Logger.log('✅ 학부모 라벨/사유 번역 입력 완료 — 스토어 상품명 사유는 필요 시 reason 행으로 직접 추가');
}

/* ===================== [v5.7] 확장팩 콘텐츠 셋업 ===================== */

function setupTeacherCheers() {
  // [v6.8] 출근 토스트 7종(요일) + 퇴근 응원 메일 30종(일자 로테이션)
  // 퇴근은 탭 순간이 아니라 5~15분 뒤 이메일로 — 퇴근 버튼 알림은 "퇴근 기록 완료 🌙" 정도로만
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  replaceContentType(ss, 'cheer', [
    ['CH11','cheer','출근','일요일의 교실 — 주말 크루의 시냅스가 선생님을 기다립니다 ☀️','',1],
    ['CH12','cheer','출근','한 주의 첫 신호를 켜는 사람 — 좋은 아침입니다 ⚡','',2],
    ['CH13','cheer','출근','어제의 수업이 오늘의 회로가 됩니다 — 화요일도 잘 부탁드려요','',3],
    ['CH14','cheer','출근','한 주의 한가운데 — 오늘 교실의 온도는 선생님이 정합니다 🌡️','',4],
    ['CH15','cheer','출근','목요일, 반복이 미엘린을 만드는 날 — 늘 감사합니다','',5],
    ['CH16','cheer','출근','금요일, 레이드 정산의 날 — 이번 주 연료 충분히 모였을까요? 🔥','',6],
    ['CH17','cheer','출근','토요일의 헌신 — 주말 크루의 한 주가 선생님 손에서 시작됩니다','',7]
  ]);
  replaceContentType(ss, 'cheermail', [
    ['CM01','cheermail','퇴근','오늘 교실에서 나온 문장들은 학생들 뇌에서 밤새 재생됩니다 — 편히 쉬세요.','',1],
    ['CM02','cheermail','퇴근','수업은 끝났지만 미엘린은 지금부터 감깁니다. 오늘의 반복, 감사합니다.','',2],
    ['CM03','cheermail','퇴근','가장 좋은 수업은 선생님이 잘 쉰 다음 날 나옵니다 — 오늘은 충전의 날.','',3],
    ['CM04','cheermail','퇴근','오늘 던진 질문 하나가 어떤 학생에겐 진로가 됩니다.','',4],
    ['CM05','cheermail','퇴근','칠판은 지워져도 배움은 저장됐습니다. 수고하셨어요.','',5],
    ['CM06','cheermail','퇴근','오늘도 한 반의 하루를 설계하셨습니다 — 쉽지 않은 일을 매일 하고 계세요.','',6],
    ['CM07','cheermail','퇴근','퇴근길, 오늘 잘된 순간 하나만 떠올려 보세요. 그게 내일의 연료입니다.','',7],
    ['CM08','cheermail','퇴근','학생들의 "아!" 하는 순간들 — 전부 선생님이 만든 겁니다.','',8],
    ['CM09','cheermail','퇴근','오늘의 피로는 누군가의 성장 비용이었습니다. 감사합니다.','',9],
    ['CM10','cheermail','퇴근','교실의 에너지는 공짜가 아니죠. 오늘 쓰신 만큼 푹 채우세요.','',10],
    ['CM11','cheermail','퇴근','반복해서 가르치는 일의 위대함 — 뇌과학이 증명하고, SYNK가 압니다.','',11],
    ['CM12','cheermail','퇴근','오늘 출석부의 이름들, 모두 선생님 덕에 하루만큼 자랐습니다.','',12],
    ['CM13','cheermail','퇴근','잘된 날도, 아쉬운 날도 — 내일의 수업이 또 있습니다.','',13],
    ['CM14','cheermail','퇴근','선생님의 목소리 톤 하나가 오늘 교실의 온도였습니다.','',14],
    ['CM15','cheermail','퇴근','오늘 나눈 피드백은 사라지지 않습니다 — 시냅스에 남았어요.','',15],
    ['CM16','cheermail','퇴근','하루의 마지막 업무가 끝났습니다. 이제 선생님의 시간입니다.','',16],
    ['CM17','cheermail','퇴근','좋은 교사는 퇴근을 잘하는 교사이기도 합니다. 오늘은 여기까지!','',17],
    ['CM18','cheermail','퇴근','오늘 웃게 한 학생 수만큼, 내일이 기다려질 겁니다.','',18],
    ['CM19','cheermail','퇴근','교실 문을 닫는 순간까지가 수업입니다 — 완주 축하드려요.','',19],
    ['CM20','cheermail','퇴근','몽골의 밤, 한국어가 자라는 중입니다 — 선생님 덕분에.','',20],
    ['CM21','cheermail','퇴근','지식은 전달이 아니라 점화라고 하죠. 오늘도 여러 개 켜셨습니다.','',21],
    ['CM22','cheermail','퇴근','수업 준비부터 마무리까지, 보이지 않는 노동에 감사드립니다.','',22],
    ['CM23','cheermail','퇴근','오늘의 아쉬움은 내일의 교안이 됩니다 — 편하게 내려놓으세요.','',23],
    ['CM24','cheermail','퇴근','학생이 기억하는 건 진도가 아니라 선생님의 태도입니다. 오늘 좋았습니다.','',24],
    ['CM25','cheermail','퇴근','이번 주 레이드 게이지, 선생님 손끝에서 올라가는 중입니다 🔥','',25],
    ['CM26','cheermail','퇴근','목소리 많이 쓰신 날 — 따뜻한 물 한 잔 하세요.','',26],
    ['CM27','cheermail','퇴근','교실은 무대고, 오늘 공연은 성공적이었습니다.','',27],
    ['CM28','cheermail','퇴근','가르치며 배우는 사람 — 오늘 선생님도 한 뼘 자랐을 겁니다.','',28],
    ['CM29','cheermail','퇴근','내일의 교실을 위해, 오늘의 선생님을 먼저 돌보세요.','',29],
    ['CM30','cheermail','퇴근','SYNK의 하루가 무사히 닫혔습니다 — 마지막 열쇠는 늘 선생님이네요.','',30]
  ]);
}

function setupFuelMissions() {
  // 레이드 연료 미션 — 이름이 Glide 폼 Choice와 정확히 일치해야 함 (raidFriday가 이름→P 매핑)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  replaceContentType(ss, 'fuel', [
    ['F01','fuel','⏰ 정시 출석 데이','출석자 전원 지각 0','',20],
    ['F02','fuel','📚 숙제 올클리어','출석자 전원 숙제 완료','',25],
    ['F03','fuel','✍️ 받아쓰기 데이','받아쓰기 반 평균 80점 이상','',20],
    ['F04','fuel','📖 단어 시험 통과','쪽지 단어시험 반 평균 8/10 이상','',20],
    ['F05','fuel','🎤 전원 한 문장 데이','출석자 전원이 오늘 문형으로 한 문장 말하기','',15],
    ['F06','fuel','🔇 올 한국어 타임','수업 마지막 10분 한국어만 사용 성공','',15]
  ]);
}

function setupBosses() {
  // D열 = "등장대사|격파대사" · E열에 픽셀 보스 이미지 URL 직접 입력 · F열 = 월 로테이션 순번
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  replaceContentType(ss, 'worldboss', [
    ['WB01','worldboss','망각의 대군주 제로 🕳️','너희가 배운 모든 것을... 0으로 되돌려주마...|기억하는 자들 앞에서, 망각은 이름을 잃었다!','',1]
  ]);
  replaceContentType(ss, 'boss', [
    ['BOSS01','boss','겨울잠 곰 🐻‍❄️','이불 밖은 위험해… 같이 자자…|이불을 박차고 나온 크루들이 곰을 깨웠다!','',1],
    ['BOSS02','boss','연휴 후유증 슬라임 🛌','명절도 끝났는데… 조금만 더 쉬자…|다시 잡은 연필 끝에서 슬라임이 녹아내렸다!','',2],
    ['BOSS03','boss','봄바람 나비 🦋','창밖을 봐… 공부는 무슨…|봄바람보다 설레는 성장 앞에 나비는 날아갔다!','',3],
    ['BOSS04','boss','황사 안개 스핑크스 🌫️','뿌연 안개 속에서 아무것도 보이지 않을걸…|또렷한 발음이 안개를 갈랐다!','',4],
    ['BOSS05','boss','딴생각 구름 ☁️','머릿속에 딴 세상을 띄워줄게…|몰입의 햇살이 구름을 걷어냈다!','',5],
    ['BOSS06','boss','초원의 유혹 늑대 🐺','나가서 놀자… 초원이 부른다…|공부 끝의 초원이 두 배로 달콤함을 늑대도 알았다!','',6],
    ['BOSS07','boss','방학 망각 크라켄 🐙','방학 동안 배운 걸 전부 삼켜주마…|매일의 복습 작살이 크라켄을 꿰뚫었다!','',7],
    ['BOSS08','boss','미루기 해골 💀','나중에 해… 내일 해도 돼…|지금 하는 자들 앞에서 미루기는 힘을 잃었다!','',8],
    ['BOSS09','boss','가을 졸음 요괴 😴','스르르… 눈꺼풀이 무겁지…|또렷한 목소리의 발표가 요괴를 쫓아냈다!','',9],
    ['BOSS10','boss','시험 불안 그림자 👤','틀리면 어떡하지… 라는 속삭임…|준비된 자의 자신감이 그림자를 지웠다!','',10],
    ['BOSS11','boss','혹한의 예티 ❄️','영하 30도… 학원은 무리야…|출석 도장의 온기가 예티를 녹였다!','',11],
    ['BOSS12','boss','산만함 팬텀 👻','연말인데… 잠깐 저것 좀 보고 하자…|집중의 빛 앞에서 유령은 흩어졌다!','',12]
  ]);
}

function setupTitleLore() {
  // 칭호 로어 — C열이 대표칭호(AH) 문자열과 정확히 일치 → Glide Relation·Lookup으로 표시
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // [v6.1] E열 = 등급 라벨 — 착용 칭호의 등급 Pill과 로어를 Relation 하나로 표시
  replaceContentType(ss, 'lore', [
    ['LR01','lore','👑 개근왕','미엘린은 반복을 사랑한다 — 매일 온 너를, 뇌가 기억한다.','👑 레전드',''],
    ['LR02','lore','🧠 시냅스 챔피언','이번 달, 이 학원에서 가장 많은 연결을 만든 사람.','👑 레전드',''],
    ['LR03','lore','🚀 로켓 성장','성장 곡선이 수직이 되는 순간이 있다 — 지금이 그 순간이다.','🟣 에픽',''],
    ['LR04','lore','⚔️ 레이드 영웅','혼자면 빨리 가지만, 함께면 보스를 잡는다.','🟣 에픽',''],
    ['LR05','lore','🐎 다크호스','아무도 예상하지 못한 질주 — 랭킹이 너를 따라잡지 못했다.','🟣 에픽',''],
    ['LR06','lore','🔥 불꽃 출석러','끊기지 않은 신호는, 결국 회로가 된다.','🔵 레어',''],
    ['LR07','lore','🏋️ 우리 반 캐리','반 게이지 뒤에는 너의 어깨가 있다.','🔵 레어',''],
    ['LR08','lore','📚 숙제왕','복습의 골든타임을 단 한 번도 놓치지 않은 사람.','🔵 레어',''],
    ['LR09','lore','🌟 이달의 스타','오늘 가장 빛난 사람에게 왕관을. 매 수업, 단 한 명.','🔵 레어',''],
    ['LR10','lore','💝 정성왕','이번 달, 시냅스가 가장 많이 반짝인 이름 — 어제의 나를 이긴 횟수 1위.','🔵 레어',''],
    ['LR11','lore','⏰ 지각 제로','시작을 지키는 사람이 끝도 지킨다.','⚪ 일반','']
  ]);
}

function setupQuiz() {
  // [v6.9] 오늘의 시냅스 퀴즈 100 — 기존 30 + TOPIK 필수 문법 70 (초급 40 · 중급 진입 30)
  // 100일 로테이션 = 3개월+ 무반복. 객관식·정답공개형이라 초급도 부담 0 (노출 학습).
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  replaceContentType(ss, 'quiz', [
    ['QZ01','quiz','조사','빈칸은? 학교( ) 가요 — ①에 ②에서|① 에 — 방향·도착점은 에',''],
    ['QZ02','quiz','조사','빈칸은? 도서관( ) 공부해요 — ①에 ②에서|② 에서 — 행동하는 장소는 에서',''],
    ['QZ03','quiz','조사','빈칸은? 사과( ) 좋아해요 — ①이 ②를|② 를 — 좋아하다의 대상',''],
    ['QZ04','quiz','조사','저는 학생( ) — ①이에요 ②예요|① 이에요 — 학생은 받침이 있어요',''],
    ['QZ05','quiz','조사','친구( ) 만나요 — ①을 ②를|② 를 — 친구는 받침이 없어요',''],
    ['QZ06','quiz','어휘','크다의 반대말은?|작다',''],
    ['QZ07','quiz','어휘','덥다의 반대말은?|춥다',''],
    ['QZ08','quiz','어휘','사다의 반대말은?|팔다',''],
    ['QZ09','quiz','어휘','아버지의 어머니는 누구?|할머니',''],
    ['QZ10','quiz','어휘','재미있다와 비슷한 말은? ①즐겁다 ②슬프다|① 즐겁다',''],
    ['QZ11','quiz','문법','과거형: 어제 밥을 ___ (먹다)|먹었어요',''],
    ['QZ12','quiz','문법','미래: 내일 학교에 ___ (가다)|갈 거예요',''],
    ['QZ13','quiz','문법','춥다 + 아/어요 = ?|추워요 — ㅂ 불규칙',''],
    ['QZ14','quiz','문법','듣다 + 어요 = ?|들어요 — ㄷ 불규칙',''],
    ['QZ15','quiz','문법','물을 ___ 싶어요 (마시다)|마시고 — V고 싶다',''],
    ['QZ16','quiz','문법','안 먹어요 vs 먹지 않아요 — 틀린 것은?|없음 — 둘 다 맞아요',''],
    ['QZ17','quiz','맞춤법','맞는 표기는? ①됬어요 ②됐어요|② 됐어요',''],
    ['QZ18','quiz','맞춤법','맞는 표기는? ①안녕히 가세요 ②안녕이 가세요|① 안녕히 가세요',''],
    ['QZ19','quiz','발음','같이의 발음은?|가치 — 구개음화',''],
    ['QZ20','quiz','발음','꽃이의 발음은?|꼬치',''],
    ['QZ21','quiz','발음','감사합니다의 실제 발음은?|감사함니다 — ㅂ+ㄴ은 ㅁ으로',''],
    ['QZ22','quiz','높임','선생님께 밥 먹었어? 대신?|식사하셨어요?',''],
    ['QZ23','quiz','높임','나이의 높임말은?|연세',''],
    ['QZ24','quiz','높임','집의 높임말은?|댁',''],
    ['QZ25','quiz','표현','처음 만난 사람에게는 반말? 존댓말?|존댓말 — 처음 뵙겠습니다',''],
    ['QZ26','quiz','어휘','월요일 다음 날은?|화요일',''],
    ['QZ27','quiz','어휘','사과 3개 — 한국어로 세면?|세 개',''],
    ['QZ28','quiz','어휘','병원에서 일하는 사람은?|의사 또는 간호사',''],
    ['QZ29','quiz','상식','설날에 어른께 하는 큰절 인사는?|세배',''],
    ['QZ30','quiz','상식','한글을 만든 왕은?|세종대왕',''],
    ['QZ31','quiz','TOPIK필수','오늘( ) 날씨가 좋아요 — ①은 ②는|② 는 — 받침 없는 말 + 는',''],
    ['QZ32','quiz','TOPIK필수','동생( ) 키가 커요 — ①이 ②가|② 가 — 받침 없는 말 + 가',''],
    ['QZ33','quiz','TOPIK필수','친구( ) 선물을 줘요 — ①에게 ②에서|① 에게 — 사람에게 줄 때',''],
    ['QZ34','quiz','TOPIK필수','버스( ) 가요 — ①로 ②으로|① 로 — 받침 없으면 로',''],
    ['QZ35','quiz','TOPIK필수','지하철( ) 가요 — ①로 ②으로|① 로 — ㄹ 받침도 로!',''],
    ['QZ36','quiz','TOPIK필수','9시( ) 6시( ) 일해요 — 빈칸 두 개는?|부터, 까지',''],
    ['QZ37','quiz','TOPIK필수','형이 나( ) 커요 — 비교할 때 조사는?|보다',''],
    ['QZ38','quiz','TOPIK필수','빵( ) 우유 — ①와 ②과|② 과 — 받침 있는 말 + 과',''],
    ['QZ39','quiz','TOPIK필수','하루에 두 번( ) 드세요 — 하나하나 나눠서?|씩',''],
    ['QZ40','quiz','TOPIK필수','수영을 ( ) 수 있어요 (하다)|할 — V(으)ㄹ 수 있다',''],
    ['QZ41','quiz','TOPIK필수','내일 시험이라서 공부( ) 해요 — ①해야 ②하야|① 해야 — 아/어야 하다',''],
    ['QZ42','quiz','TOPIK필수','여기서 사진을 찍( ) 마세요|지 — 금지',''],
    ['QZ43','quiz','TOPIK필수','문 좀 열( ) 주세요 — ①어 ②아|① 어 — 열다→열어',''],
    ['QZ44','quiz','TOPIK필수','지금 밥을 먹( ) 있어요|고 — 진행',''],
    ['QZ45','quiz','TOPIK필수','이 옷 한번 입( ) 보세요 — ①어 ②아|① 어 — 시도',''],
    ['QZ46','quiz','TOPIK필수','한국에 ( ) 적이 있어요 (가다)|간 — 경험',''],
    ['QZ47','quiz','TOPIK필수','자( ) 전에 이를 닦아요|기 — V기 전에',''],
    ['QZ48','quiz','TOPIK필수','수업이 끝( ) 후에 만나요 — ①난 ②은|① 난 — 끝나+ㄴ 후에',''],
    ['QZ49','quiz','TOPIK필수','다리를 다쳐서 ( ) 걸어요 — ①안 ②못|② 못 — 능력이 안 될 때',''],
    ['QZ50','quiz','TOPIK필수','밥을 먹( ) 식당에 가요|으러 — 목적 + 이동',''],
    ['QZ51','quiz','TOPIK필수','한국에서 일하( ) 한국어를 배워요|려고 — 의도',''],
    ['QZ52','quiz','TOPIK필수','비가 오( ) 우산을 가져가세요 — ①니까 ②으니까|① 니까 — 오+니까',''],
    ['QZ53','quiz','TOPIK필수','김치는 맵( ) 맛있어요|지만 — 대조',''],
    ['QZ54','quiz','TOPIK필수','주말에 영화를 보( ) 집에서 쉬어요 — 선택은?|거나',''],
    ['QZ55','quiz','TOPIK필수','음악을 들( ) 공부해요 — ①으면서 ②면서|① 으면서 — 듣→들으',''],
    ['QZ56','quiz','TOPIK필수','바쁘다 + 기 때문에 = ?|바쁘기 때문에 — 이유(문어)',''],
    ['QZ57','quiz','TOPIK필수','한국에 살( ) 됐어요|게 — 게 되다(변화)',''],
    ['QZ58','quiz','TOPIK필수','내일부터 운동하( ) 했어요|기로 — 결심',''],
    ['QZ59','quiz','TOPIK필수','와, 눈이 오( )! — ①네요 ②나요|① 네요 — 감탄',''],
    ['QZ60','quiz','TOPIK필수','피곤한데 우리 좀 쉴( )? — 제안|까요',''],
    ['QZ61','quiz','TOPIK필수','제가 전화( )게요 — ①할 ②하ㄹ|① 할 — 약속',''],
    ['QZ62','quiz','TOPIK필수','배가 고픈( ) 같이 먹을래요? — ①데 ②대|① 데 — 배경 제시',''],
    ['QZ63','quiz','TOPIK필수','지금 ( ) 사람이 동생이에요 (자다)|자는 — 현재 관형형',''],
    ['QZ64','quiz','TOPIK필수','어제 ( ) 영화가 재미있었어요 (보다)|본 — 과거 관형형',''],
    ['QZ65','quiz','TOPIK필수','내일 ( ) 곳이 어디예요? (가다)|갈 — 미래 관형형',''],
    ['QZ66','quiz','TOPIK필수','밥을 먹( ) 때 말하지 마세요|을 — V(으)ㄹ 때',''],
    ['QZ67','quiz','TOPIK필수','여기 앉( ) 돼요? — ①아도 ②어도|① 아도 — 허락',''],
    ['QZ68','quiz','TOPIK필수','교실에서 뛰( ) 안 돼요|면 — 금지 규칙',''],
    ['QZ69','quiz','TOPIK필수','한국어를 정말 잘하( )! (감탄·새 발견)|시는군요/는군요',''],
    ['QZ70','quiz','TOPIK필수','오늘 정말 춥( )? (확인·동의)|지요',''],
    ['QZ71','quiz','TOPIK중급','집에 도착하( ) 바로 잤어요|자마자 — 직후',''],
    ['QZ72','quiz','TOPIK중급','한국어를 배운 ( ) 1년 됐어요|지 — 시간 경과',''],
    ['QZ73','quiz','TOPIK중급','제가 요리하( ) 동안 상 좀 차려 주세요|는',''],
    ['QZ74','quiz','TOPIK중급','숙제를 하( ) 잠들어 버렸어요|다가 — 하던 중 전환',''],
    ['QZ75','quiz','TOPIK중급','게임하( ) 숙제를 못 했어요|느라고 — 이유(나쁜 결과)',''],
    ['QZ76','quiz','TOPIK중급','늦잠 자( ) 바람에 지각했어요|는 — 예상 밖 원인',''],
    ['QZ77','quiz','TOPIK중급','내일 비가 ( ) 것 같아요 (오다)|올 — 추측',''],
    ['QZ78','quiz','TOPIK중급','밖이 시끄러운 걸 보니 학생들이 왔( ) 봐요|나 — 근거 있는 추측',''],
    ['QZ79','quiz','TOPIK중급','아이스크림을 떨어뜨릴 ( )했어요|뻔 — 아슬아슬',''],
    ['QZ80','quiz','TOPIK중급','저는 밥을 빨리 먹는 ( )이에요|편 — 경향',''],
    ['QZ81','quiz','TOPIK중급','한국어는 배( ) 재미있어요 — ①울수록 ②우면|① 울수록 — 점점 더',''],
    ['QZ82','quiz','TOPIK중급','건강( ) 위해서 운동해요 — ①을 ②를|① 을 — N을 위해서',''],
    ['QZ83','quiz','TOPIK중급','감기에 걸리지 않( ) 옷을 따뜻하게 입으세요|도록',''],
    ['QZ84','quiz','TOPIK중급','동생도 형( ) 키가 커요 — 비슷한 정도|만큼',''],
    ['QZ85','quiz','TOPIK중급','그 학생은 가수( ) 노래를 잘해요|처럼',''],
    ['QZ86','quiz','TOPIK중급','친구가 바빠요 → 친구가 바쁘( ) 했어요|다고 — 간접화법',''],
    ['QZ87','quiz','TOPIK중급','어디 가요? → 어디 가( ) 물었어요|냐고 — 간접 의문',''],
    ['QZ88','quiz','TOPIK중급','같이 가요! → 같이 가( ) 했어요|자고 — 간접 청유',''],
    ['QZ89','quiz','TOPIK중급','조용히 하세요 → 조용히 하( ) 하셨어요|라고 — 간접 명령',''],
    ['QZ90','quiz','TOPIK중급','어제 그 식당 가 봤는데 정말 맛있( )|더라고요 — 직접 경험 전달',''],
    ['QZ91','quiz','TOPIK중급','왜 안 먹어요? — 아까 먹었( )|거든요 — 이유 알려주기',''],
    ['QZ92','quiz','TOPIK중급','내일 시험이( )! 같이 공부해요|잖아요 — 아는 사실 환기',''],
    ['QZ93','quiz','TOPIK중급','어릴 때 자주 가( ) 공원이에요|던 — 과거 회상',''],
    ['QZ94','quiz','TOPIK중급','바람에 문이 저절로 ___ (닫다)|닫혔어요 — 피동',''],
    ['QZ95','quiz','TOPIK중급','엄마가 아기에게 밥을 ___ (먹다)|먹여요 — 사동',''],
    ['QZ96','quiz','TOPIK중급','따뜻하다 → 날씨가 점점 ___|따뜻해져요 — 아/어지다(변화)',''],
    ['QZ97','quiz','TOPIK중급','선생님이 학생들을 웃( ) 해요|게 — 게 하다',''],
    ['QZ98','quiz','TOPIK중급','숙제를 드디어 다 끝내 ( )어요! (시원함)|버렸 — 아/어 버리다',''],
    ['QZ99','quiz','TOPIK중급','손을 씻( ) 나서 드세요|고 — 순서 강조',''],
    ['QZ100','quiz','TOPIK중급','이 드라마는 정말 ( ) 만해요 (보다)|볼 — 추천 가치','']
  ]);
}

/* ===================== [v5.8] 오늘의 숙제 뱅크 (210개 · 요일당 30 · 30주 무반복) =====================
 * F열 = 요일코드×100 + 순번 (월1 화2 수3 목4 금5 토6 일7)
 * 월~금 = 평일반(오늘의숙제*), 토·일 = 주말반(주말의숙제*) — calcAll이 저녁 21시 이후 자동 게시.
 * 강사는 검사 포인트(E열)만 보고 5분 체크 → 숙제완료 버튼 +10P.
 * ⚠️ 재실행 시 contents 행 +174 → 일회성 싱크 ~210 업데이트 (한가한 날 실행 권장) */

function setupHomework() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  replaceContentType(ss, 'homework', [
    ['HW101','homework','어휘','오늘 배운 단어 3개로 각각 한 문장씩 만들어 오세요.','조사(이/가·을/를) 확인',101],
    ['HW102','homework','어휘','오늘 단어 중 2개를 한 문장 안에 같이 넣어 보세요.','의미 연결이 자연스러운지',102],
    ['HW103','homework','어휘','새 단어 3개의 반대말 또는 비슷한 말을 찾아 오세요.','뜻을 말로 설명시키기',103],
    ['HW104','homework','어휘','오늘 단어 5개로 미니 단어장(단어+뜻+예문 1개) 만들기.','예문이 교재 복사 아닌지',104],
    ['HW105','homework','어휘','집에 있는 물건 5개의 한국어 이름을 적어 오세요.','받침 발음 확인',105],
    ['HW106','homework','어휘','오늘 단어 3개가 들어간 3문장 미니 이야기 만들기.','시제 일관성',106],
    ['HW107','homework','어휘','오늘 단어 하나로 시작하는 끝말잇기 5개 이어 오기.','실제 있는 단어인지',107],
    ['HW108','homework','어휘','오늘 단어 3개를 그림으로 그려 오기(뜻은 쓰지 말고).','그림 보고 단어 말하게 하기',108],
    ['HW109','homework','어휘','제일 어려운 단어 1개를 10번 소리 내어 읽고 체크.','그 단어 발음 확인',109],
    ['HW110','homework','어휘','오늘 단어 4개를 두 그룹으로 나누고 기준 말하기.','분류 기준의 논리',110],
    ['HW111','homework','어휘','오늘 단어 중 하나를 간판·포장에서 찾아 메모.','실물 발견 공유',111],
    ['HW112','homework','어휘','오늘 단어 1개의 뜻을 몸짓으로 표현해 보기.','수업에서 친구가 맞히기',112],
    ['HW113','homework','어휘','오늘 단어 3개를 나에 관한 문장으로 쓰기.','진짜 자기 얘기인지',113],
    ['HW114','homework','어휘','오늘 단어와 짝이 되는 말 3개 찾기(예: 사진을 찍다).','연어가 자연스러운지',114],
    ['HW115','homework','어휘','사전에서 오늘 단어 3개의 예문을 손으로 베껴 쓰기.','손글씨 확인(운동 기억)',115],
    ['HW116','homework','어휘','오늘 단어 3개를 큰 소리로 3번씩 읽고 체크 표시.','발음 확인',116],
    ['HW117','homework','어휘','오늘 단어 3개에 해당하는 실물 사진 찍어 오기.','사진 보며 단어 말하기',117],
    ['HW118','homework','어휘','반대말을 써서 오늘 문장 2개를 뒤집어 보세요.','반의어 정확성',118],
    ['HW119','homework','어휘','가족에게 오늘 단어 3개를 가르쳐 주고 반응 메모.','가르친 경험 공유',119],
    ['HW120','homework','어휘','오늘 단어를 넣은 질문 2개 만들기 — 수업에서 사용.','질문 어순',120],
    ['HW121','homework','어휘','오늘 단어 5개를 가나다순으로 정렬해 오기.','자모 순서 감각',121],
    ['HW122','homework','어휘','오늘 단어 1개로 나의 하루를 한 줄 요약.','단어 활용 적절성',122],
    ['HW123','homework','어휘','발음이 비슷한 단어 한 쌍 찾아 차이 메모.','최소대립쌍 확인',123],
    ['HW124','homework','어휘','오늘 단어를 명사/동사/형용사로 분류하기.','품사 감각',124],
    ['HW125','homework','어휘','오늘 단어 3개로 두 줄 대화 만들기.','대화 자연스러움',125],
    ['HW126','homework','어휘','모르는 단어 1개 뜻을 먼저 추측해 쓰고 사전 확인.','추측 과정 물어보기',126],
    ['HW127','homework','어휘','오늘 단어 5개를 이모지로 표현해 오기.','이모지 보고 단어 복원',127],
    ['HW128','homework','어휘','오늘 단어 5개로 단어 카드(앞 단어/뒤 뜻) 만들기.','카드로 즉석 테스트',128],
    ['HW129','homework','어휘','지난주 단어 3개 + 오늘 단어 3개로 문장 2개.','누적 복습 여부',129],
    ['HW130','homework','어휘','오늘 단어 중 최애 1개와 이유를 한 문장으로.','이유 표현(-아/어서)',130],
    ['HW201','homework','문법·문장','오늘 배운 문법으로 나에 대한 문장 3개 쓰기.','형태 정확성 + 자기 얘기',201],
    ['HW202','homework','문법·문장','오늘 문법으로 질문 2개 — 내일 친구에게 묻기.','질문 억양으로 읽기',202],
    ['HW203','homework','문법·문장','어제 한 일을 3문장으로 쓰기(과거형).','았/었 활용',203],
    ['HW204','homework','문법·문장','내일 할 일을 3문장으로 쓰기(계획 표현).','(으)ㄹ 거예요',204],
    ['HW205','homework','문법·문장','교재 문장 2개를 부정문으로 바꾸기.','안 / -지 않다 위치',205],
    ['HW206','homework','문법·문장','오늘 문법 + 지난주 문법을 한 문장에 같이 쓰기.','결합 자연스러움',206],
    ['HW207','homework','문법·문장','오늘 문장 2개에서 조사에 동그라미 치기.','조사 위치 인식',207],
    ['HW208','homework','문법·문장','오늘 문법으로 가족 소개 2문장.','호칭 정확성',208],
    ['HW209','homework','문법·문장','교재에서 오늘 문법이 들어간 문장 2개 찾아 밑줄.','용례 찾기',209],
    ['HW210','homework','문법·문장','오늘 문법 + 시간 표현(아침·어제 등) 문장 2개.','시간 부사 위치',210],
    ['HW211','homework','문법·문장','오늘 문장을 명령문과 청유문으로 바꾸기.','(으)세요 / -읍시다',211],
    ['HW212','homework','문법·문장','이유 표현(-아/어서)으로 문장 3개.','인과 연결',212],
    ['HW213','homework','문법·문장','조건 표현(-으면)으로 문장 2개.','가정 의미',213],
    ['HW214','homework','문법·문장','오늘 문법으로 몽골을 소개하는 문장 1개.','고유명사 표기',214],
    ['HW215','homework','문법·문장','오늘 문장 2개를 높임말로 바꾸기.','-(으)세요 / 께서',215],
    ['HW216','homework','문법·문장','반말 2문장을 존댓말로, 존댓말 2문장을 반말로.','종결어미 전환',216],
    ['HW217','homework','문법·문장','오늘 문법의 규칙을 내 말로 한 줄 정리.','메타 이해',217],
    ['HW218','homework','문법·문장','교재 문장 하나를 단어 순서 섞었다가 복원하기.','어순 감각',218],
    ['HW219','homework','문법·문장','대조 표현(-지만)으로 문장 2개.','앞뒤 대조 성립',219],
    ['HW220','homework','문법·문장','지금 하고 있는 일 3개 쓰기(-고 있다).','진행형',220],
    ['HW221','homework','문법·문장','누가·언제·어디 질문 각 1개씩 만들기.','의문사 선택',221],
    ['HW222','homework','문법·문장','할 수 있는 것 3개 쓰기(-(으)ㄹ 수 있다).','능력 표현',222],
    ['HW223','homework','문법·문장','오늘 문법 예문 1개를 3번 소리 내어 읽기.','입에 붙이기',223],
    ['HW224','homework','문법·문장','부탁 표현(-아/어 주세요) 문장 2개.','공손한 어감',224],
    ['HW225','homework','문법·문장','비교 표현(-보다) 문장 2개.','비교 대상 + 조사',225],
    ['HW226','homework','문법·문장','오늘 문법으로 방학 계획 한 문장.','미래 결합',226],
    ['HW227','homework','문법·문장','짧은 문장 1개를 정보 3개 담긴 긴 문장으로.','확장 능력',227],
    ['HW228','homework','문법·문장','긴 문장 1개를 두 문장으로 나누기.','분리 지점',228],
    ['HW229','homework','문법·문장','그리고·그래서·하지만으로 문장 잇기 각 1개.','접속 논리',229],
    ['HW230','homework','문법·문장','교재 최애 예문 1개 베껴 쓰고 별점 + 이유.','문장 감상',230],
    ['HW301','homework','말하기','오늘 배운 표현으로 30초 혼잣말을 폰에 녹음.','수업에서 1~2명 재현',301],
    ['HW302','homework','말하기','거울 보며 대화문 3번 읽고 어려운 발음 1개 메모.','그 발음 집중 교정',302],
    ['HW303','homework','말하기','가족·친구에게 한국어 인사 + 한 문장, 반응 메모.','실제 사용 경험 공유',303],
    ['HW304','homework','말하기','오늘 대화문을 혼자 두 역할로 바꿔 읽기.','역할별 억양 차이',304],
    ['HW305','homework','말하기','한국 노래 한 소절 따라 말하기(가사 보고 발음만).','연음 확인',305],
    ['HW306','homework','말하기','"오늘 뭐 했어요?"에 20초 멈추지 않고 대답 연습.','멈춤 횟수 체크',306],
    ['HW307','homework','말하기','오늘 대화문을 안 보고 외워 말하기 도전.','핵심 문장 회상',307],
    ['HW308','homework','말하기','오늘 날짜·요일·시간을 소리 내어 3번 말하기.','수 읽기',308],
    ['HW309','homework','말하기','15초 셀프 소개 영상 찍기(제출은 안 해도 됨).','촬영 여부 자기 보고',309],
    ['HW310','homework','말하기','전화 첫인사 3가지(여보세요 등) 연습.','전화 어투',310],
    ['HW311','homework','말하기','가게에서 물건 사는 상황을 혼자 롤플레이.','가격 묻기 표현',311],
    ['HW312','homework','말하기','길 묻는 문장 3개 소리 내어 연습.','어디·어떻게',312],
    ['HW313','homework','말하기','오늘 기분을 문장 3개로 말해 보기.','감정 어휘',313],
    ['HW314','homework','말하기','교재 문단을 2배 속도로 읽기 도전.','속도에서도 정확한지',314],
    ['HW315','homework','말하기','같은 문단을 아주 천천히 또박또박 1회.','받침 살리기',315],
    ['HW316','homework','말하기','같은 문장을 작게·보통·크게 3번 말하기.','성량 조절',316],
    ['HW317','homework','말하기','스스로 질문 만들고 스스로 답하기 2세트.','자문자답 구조',317],
    ['HW318','homework','말하기','내 방 물건 5개를 손으로 가리키며 말하기.','지시어(이·그·저)',318],
    ['HW319','homework','말하기','오늘 표현을 인형·반려동물에게 말해 보기.','부담 없는 산출',319],
    ['HW320','homework','말하기','짧은 영상 1분 그림자 스피킹(동시에 따라 말하기).','속도 따라가기',320],
    ['HW321','homework','말하기','발음이 꼬이는 문장 1개를 5번 반복.','혀 풀기',321],
    ['HW322','homework','말하기','연음 단어 5개 소리 내기(꽃이·같이 등).','연음 규칙',322],
    ['HW323','homework','말하기','자기소개를 15초 최신판으로 업데이트해 말하기.','새 정보 포함',323],
    ['HW324','homework','말하기','좋아하는 것 3가지를 이유와 함께 말하기.','-아/어서',324],
    ['HW325','homework','말하기','내일 계획을 소리 내어 말하기.','미래 표현',325],
    ['HW326','homework','말하기','오늘 최고의 순간을 한 문장으로 말하기.','과거 + 감정',326],
    ['HW327','homework','말하기','지금 하는 행동을 30초 실황 중계하기.','-고 있다',327],
    ['HW328','homework','말하기','친구를 칭찬하는 문장 3개 소리 내기.','칭찬 어휘',328],
    ['HW329','homework','말하기','반 친구 이름을 넣은 문장 2개 말하기.','이름 + 조사',329],
    ['HW330','homework','말하기','이번 주 최애 문장 낭독을 녹음해 오기.','낭독 태도',330],
    ['HW401','homework','쓰기','오늘 배운 문형으로 3줄 일기 쓰기.','문형 사용 + 교정은 1~2개만',401],
    ['HW402','homework','쓰기','한국 음식·드라마·노래 중 하나를 3문장 소개.','이유 표현 사용',402],
    ['HW403','homework','쓰기','오늘 수업에서 기억 남는 것 2문장 요약.','핵심 파악',403],
    ['HW404','homework','쓰기','짝에게 주는 쪽지 2문장 — 수업에서 교환.','높임/반말 선택',404],
    ['HW405','homework','쓰기','교재 그림 하나를 3문장으로 묘사.','위치 표현',405],
    ['HW406','homework','쓰기','이번 주 단어로 빈칸 문제 2개 출제 — 친구가 풂.','출제 의도 설명',406],
    ['HW407','homework','쓰기','친구에게 보내는 문자 형식으로 3줄.','구어체 어미',407],
    ['HW408','homework','쓰기','나의 하루 시간표를 한국어로 쓰기.','시간 표기',408],
    ['HW409','homework','쓰기','장보기 목록 5개를 한국어로.','단위 명사',409],
    ['HW410','homework','쓰기','1년 뒤 나에게 보내는 2문장.','미래 표현',410],
    ['HW411','homework','쓰기','오늘 최고의 순간 1문장 + 이유 1문장.','-아/어서',411],
    ['HW412','homework','쓰기','오늘 날씨와 내 옷차림 2문장.','날씨 어휘',412],
    ['HW413','homework','쓰기','좋아하는 음식 만드는 순서 3단계.','먼저·그다음·마지막',413],
    ['HW414','homework','쓰기','고마운 사람에게 감사 문장 2개.','감사 표현',414],
    ['HW415','homework','쓰기','사과 상황을 하나 만들어 사과 문장 2개.','사과 표현',415],
    ['HW416','homework','쓰기','친구를 생일에 초대하는 문장 쓰기.','초대 표현',416],
    ['HW417','homework','쓰기','아무 물건 하나의 광고 문구 한 줄.','매력 표현',417],
    ['HW418','homework','쓰기','오늘 하루를 SNS 캡션 1개로.','짧은 문장 감각',418],
    ['HW419','homework','쓰기','마음에 드는 표현 베껴 쓰고 내 문장 1개 만들기.','응용',419],
    ['HW420','homework','쓰기','반 친구 인터뷰 질문 3개 만들기.','의문문',420],
    ['HW421','homework','쓰기','다음 주 계획 3줄 쓰기.','-(으)려고 하다',421],
    ['HW422','homework','쓰기','내 방을 3문장으로 묘사.','있다/없다',422],
    ['HW423','homework','쓰기','최근 꾼 꿈(또는 상상 이야기) 2문장.','과거 서술',423],
    ['HW424','homework','쓰기','한국에 가면 하고 싶은 것 3가지.','-고 싶다',424],
    ['HW425','homework','쓰기','오늘 문형으로 짧은 편지 3줄(받는 사람 자유).','편지 형식',425],
    ['HW426','homework','쓰기','오늘 단어 5개를 가리고 스스로 받아쓰기.','맞은 개수 기록',426],
    ['HW427','homework','쓰기','몽골어 문장 2개를 한국어로 직접 번역.','어순 전환',427],
    ['HW428','homework','쓰기','오늘 수업에 제목 붙이기 + 이유 한 줄.','요약 감각',428],
    ['HW429','homework','쓰기','그림·만화 한 컷에 어울리는 대사 만들기.','말풍선 감각',429],
    ['HW430','homework','쓰기','지난 목요일에 쓴 글 하나를 더 좋게 고치기.','스스로 교정',430],
    ['HW501','homework','복습','이번 주 단어 중 헷갈리는 3개 골라 각 1문장.','자기 점검 칭찬',501],
    ['HW502','homework','복습','이번 주 문법 하나를 몽골어로 설명하는 메모 작성.','개념 이해(설명하며 배우기)',502],
    ['HW503','homework','복습','한국 영상 1분 보고 들리는 단어 3개 적기.','실제 대사인지',503],
    ['HW504','homework','복습','월~목 숙제 중 하나를 더 좋게 업그레이드.','고친 부분 설명',504],
    ['HW505','homework','복습','이번 주 새 단어 10개 셀프 테스트, 점수 기록.','인출 연습 습관',505],
    ['HW506','homework','복습','이번 주 틀린 것 1개 오답노트(왜 틀렸는지).','원인 분석',506],
    ['HW507','homework','복습','이번 주 문법으로 새 예문 3개 만들기.','응용력',507],
    ['HW508','homework','복습','단어 카드 섞어 스스로 테스트, 점수 기록.','누적 암기',508],
    ['HW509','homework','복습','이번 주 숙제 중 최고작 선정 + 이유.','자기 평가',509],
    ['HW510','homework','복습','이번 주 배운 것 마인드맵 한 장 그리기.','개념 연결',510],
    ['HW511','homework','복습','이번 주 문장 중 최애 1개를 예쁘게 다시 쓰기.','필사 + 애착',511],
    ['HW512','homework','복습','이번 주 단어 3개로 문장 2개 만들기.','누적 활용',512],
    ['HW513','homework','복습','선생님께 할 질문 1개 준비해 오기.','질문의 구체성',513],
    ['HW514','homework','복습','짝에게 낼 미니 퀴즈 3문제 만들기.','출제 의도',514],
    ['HW515','homework','복습','이번 주 단어를 주제별로 분류한 표 만들기.','범주화',515],
    ['HW516','homework','복습','이번 주 배운 내용 3줄 요약.','압축력',516],
    ['HW517','homework','복습','이번 주 나에게 별점 + 이유 한 문장.','메타 인지',517],
    ['HW518','homework','복습','다음 주 교재 훑어보고 궁금한 것 1개 메모.','예습 습관',518],
    ['HW519','homework','복습','이번 주 최다 실수 1개 + 올바른 문장.','교정 능력',519],
    ['HW520','homework','복습','수요일 녹음 다시 듣고 좋아진 점 1개 메모.','자기 피드백',520],
    ['HW521','homework','복습','이번 주 단어 5개만 골라 가리고 말해 보기.','가벼운 인출 연습',521],
    ['HW522','homework','복습','이번 주 문장 3개 암송 도전.','암기 확인',522],
    ['HW523','homework','복습','이번 주 최애 단어 1개를 크게 쓰고 꾸미기.','애착 형성',523],
    ['HW524','homework','복습','부모님께 배운 것 1개 설명하기(몽골어 OK).','프로테제 효과',524],
    ['HW525','homework','복습','교재 이번 주 페이지 소리 내어 통독 1회.','유창성',525],
    ['HW526','homework','복습','헷갈린 조사 2개 정리(예문 포함).','조사 구분',526],
    ['HW527','homework','복습','이번 주 한국어를 실제로 쓴 순간 1개 기록.','실사용 인식',527],
    ['HW528','homework','복습','나만의 복습 체크리스트 5칸 만들기.','습관 설계',528],
    ['HW529','homework','복습','이번 주 표현으로 짧은 대화 4줄 쓰기.','종합 산출',529],
    ['HW530','homework','복습','한 주 소감 한 줄 + 다음 주 다짐 한 줄.','성찰',530],
    ['HW601','homework','K-컬처','한국 영상 5분 시청 — 새로 들은 표현 1개 적기.','표현 뜻 함께 확인',601],
    ['HW602','homework','K-컬처','주변 한국 제품·간판에서 한국어 3개 찾기.','실생활 인식',602],
    ['HW603','homework','K-컬처','한국 음식 5개를 좋아하는 순서로 한국어로 적기.','순위·서수 표현',603],
    ['HW604','homework','K-컬처','드라마 한 장면의 대사 1개 받아 적기.','청취 정확도',604],
    ['HW605','homework','K-컬처','좋아하는 가수에게 한국어 응원 문장 2개.','감정 어휘',605],
    ['HW606','homework','K-컬처','예능 리액션 표현 1개(대박 등) 뜻과 함께 적기.','구어 표현',606],
    ['HW607','homework','K-컬처','한국 지도에서 도시 3개 이름 읽고 쓰기.','지명 발음',607],
    ['HW608','homework','K-컬처','한국 음식 1개 사진 + 이름 + 맛 한 단어.','미각 어휘',608],
    ['HW609','homework','K-컬처','웹툰 한 컷 읽고 모르는 단어 1개 뜻 추측.','문맥 추측',609],
    ['HW610','homework','K-컬처','아는 한국 브랜드 3개를 한글로 쓰기.','외래어 표기',610],
    ['HW611','homework','K-컬처','드라마에서 존댓말 장면 1개 — 누가 누구에게?','높임 상황 인식',611],
    ['HW612','homework','K-컬처','한국 명절 1개 조사해 한 줄 설명.','문화 지식',612],
    ['HW613','homework','K-컬처','아이돌 자기소개 멘트 하나 따라 말하기.','리듬·억양',613],
    ['HW614','homework','K-컬처','한국 유행어 1개 뜻 조사.','신조어',614],
    ['HW615','homework','K-컬처','좋아하는 드라마·영화 제목 3개 한글로 쓰기.','제목 읽기',615],
    ['HW616','homework','K-컬처','K-뷰티·패션 단어 3개 수집.','분야 어휘',616],
    ['HW617','homework','K-컬처','한국 날씨 앱 화면 보고 소리 내어 읽기.','숫자 + 단위',617],
    ['HW618','homework','K-컬처','한국 노래 1곡 들으며 아는 단어 1개 적기.','청취 부담 완화',618],
    ['HW619','homework','K-컬처','먹방에서 맛 표현 2개 수집.','감각 어휘',619],
    ['HW620','homework','K-컬처','한국과 몽골의 같은 점 1개를 한 문장으로.','비교 문장',620],
    ['HW621','homework','K-컬처','태극기·무궁화 등 한국 상징 이름 3개.','문화 상식',621],
    ['HW622','homework','K-컬처','지하철 노선도에서 역 이름 3개 읽기.','합성어 읽기',622],
    ['HW623','homework','K-컬처','영화 포스터의 문구 1개 적어 오기.','카피 읽기',623],
    ['HW624','homework','K-컬처','한국 인사 예절 1개(두 손 등) 정리.','문화 매너',624],
    ['HW625','homework','K-컬처','자주 쓰는 초성·이모티콘 2개 뜻(ㅋㅋ 등).','디지털 표현',625],
    ['HW626','homework','K-컬처','팬덤 단어 2개(응원봉 등) 수집.','취미 어휘',626],
    ['HW627','homework','K-컬처','한국어가 보이는 사진 1장 찍어 오기.','주변 탐색',627],
    ['HW628','homework','K-컬처','드라마 명대사 1개 + 좋아하는 이유.','감상 표현',628],
    ['HW629','homework','K-컬처','지금 계절의 한국 음식 1개 조사.','계절 어휘',629],
    ['HW630','homework','K-컬처','주말 K-플레이리스트 1곡 + 느낌 한 단어.','감정 단어',630],
    ['HW701','homework','리셋','이번 주 최애 표현 1개 + 이유 한 문장.','다음 수업 아이스브레이킹',701],
    ['HW702','homework','리셋','다음 주 목표를 한국어 한 문장으로.','-고 싶다',702],
    ['HW703','homework','리셋','지난주 단어장 소리 내어 1번 통독(체크만).','자기 보고 신뢰',703],
    ['HW704','homework','리셋','책상 정리 + 단어장 제자리(인증 한 줄).','학습 환경',704],
    ['HW705','homework','리셋','이번 주 필기 사진 1장 찍어 보관.','기록 습관',705],
    ['HW706','homework','리셋','이번 주 감사한 일 1개를 한국어로.','감사 표현',706],
    ['HW707','homework','리셋','자음·모음 한 벌 소리 내어 읽기 1회.','기초 리셋',707],
    ['HW708','homework','리셋','스트레칭하며 1~20을 한국어로 세기.','수 세기',708],
    ['HW709','homework','리셋','내일 가져갈 준비물 3개 한국어로.','생활 어휘',709],
    ['HW710','homework','리셋','이번 주 잘한 것 1개 스스로 칭찬 문장.','긍정 자기 대화',710],
    ['HW711','homework','리셋','오늘의 시냅스(명언) 하나 골라 베껴 쓰기.','필사',711],
    ['HW712','homework','리셋','내 한국어 이름·서명 연습 3번.','한글 쓰기',712],
    ['HW713','homework','리셋','미래의 꿈 한 문장 업데이트.','장래 표현',713],
    ['HW714','homework','리셋','좋아하는 한국어 문장·가사 한 줄 수집.','취향 기록',714],
    ['HW715','homework','리셋','제일 쉬운 문장 1개를 완벽 발음으로 3번.','성공 경험',715],
    ['HW716','homework','리셋','5분 눈 감고 쉬고 기분을 한 단어로 기록.','감정 단어',716],
    ['HW717','homework','리셋','다음 수업에 물어볼 것 1개 메모.','질문 준비',717],
    ['HW718','homework','리셋','가족과 한국어 단어 맞히기 1회.','가족 참여',718],
    ['HW719','homework','리셋','일요일 저녁 나의 루틴 한 줄 쓰기.','일상 서술',719],
    ['HW720','homework','리셋','한 달 전 나에게 한마디.','과거 회고',720],
    ['HW721','homework','리셋','앱 랭킹 보고 이번 달 목표 순위 정하기.','목표 설정',721],
    ['HW722','homework','리셋','내 몬스터 확인, 다음 진화까지 몇 P인지 적기.','앱 활용',722],
    ['HW723','homework','리셋','단어장 표지에 스티커·그림 1개 꾸미기.','애착 형성',723],
    ['HW724','homework','리셋','필통 속 물건 3개 한국어로.','사물 어휘',724],
    ['HW725','homework','리셋','부모님께 이번 주 배운 것 1개 자랑하기.','가정 연계',725],
    ['HW726','homework','리셋','가족에게 한국어로 잘 자요 인사하기.','인사 실천',726],
    ['HW727','homework','리셋','알람·메모 하나를 한국어로 바꾸기.','환경 한국어화',727],
    ['HW728','homework','리셋','물 마시며 건배 표현 1개 말해 보기.','재미 표현',728],
    ['HW729','homework','리셋','창밖에 보이는 것 3개 한국어로.','즉석 어휘',729],
    ['HW730','homework','리셋','한 주를 이모지 3개 + 한 단어 소감으로.','압축 표현',730]
  ]);
}

/* ===================== [v9.18] 📚 학업 성장 축 v1 =====================
 * 실제 한국어 실력(급수 + 월간 모의점수)을 시간축으로 기록하는 순수 추가 축.
 * academic_log = 강사가 월 1회 시트에 직접 입력(Glide 업데이트 0).
 *   유형 level → 값=급수(1~6) · 유형 mock → 값=모의점수(0~100)
 * calcAcademic_이 calcAll 말미에 편승해 profiles BO~BV(67~74) 스냅샷을 writeIfChanged로 갱신.
 * 메시지는 언제나 따뜻하게 — '하락'을 쓰지 않고 '다지는 시간'으로 리프레이밍. */

function setupAcademic() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureSheet(ss, 'academic_log',
    ['log_id', 'student_id', '날짜', '유형', '값', '비고', '입력자']);
  if (sh.getLastRow() < 2) { // 빈 시트(헤더만)일 때만 예시 3행 — 재실행 안전
    sh.getRange(2, 1, 3, 7).setValues([
      ['AL001', '(예시)S001', '2026-05-01', 'level', 3, '3급 인증', '(예시)'],
      ['AL002', '(예시)S001', '2026-06-01', 'mock', 62, '6월 모의', '(예시)'],
      ['AL003', '(예시)S001', '2026-07-01', 'mock', 69, '7월 모의', '(예시)']
    ]);
  }
  Logger.log('academic_log 준비 완료 (헤더 7열 · 예시 3행)');
}

// 따뜻한 한마디 — [ko, mn]. 우선순위: 첫기록 > 급수상승 > 점수상승 > 유지/리프레이밍(부정어 없음)
function academicMsg_(s) {
  if (s.first) return [
    '🌱 첫 평가 기록! 여기서부터 성장 스토리가 시작돼요 ✨',
    '🌱 Анхны үнэлгээ бүртгэгдлээ! Эндээс өсөлтийн түүх эхэлж байна ✨'
  ];
  if (s.levelUp) return [
    '🎉 ' + s.fromLv + '급 → ' + s.toLv + '급! 한국어 뇌에 새 회로가 열렸어요',
    '🎉 ' + s.fromLv + '-р зэрэг → ' + s.toLv + '-р зэрэг боллоо! Солонгос хэлний тархинд шинэ холбоос нээгдлээ'
  ];
  if (s.hasDelta && s.delta > 0) return [
    '지난달보다 +' + s.delta + '점 📈 꾸준함이 실력이 되고 있어요',
    'Өнгөрсөн сараас +' + s.delta + ' оноо 📈 Тэвчээр чинь чадвар болж байна'
  ];
  return [ // 유지/하락 → 리프레이밍 (금칙어 '하락' 미사용)
    '이번 달은 실력을 다지는 시간, 다음 도약을 준비 중이에요 💪',
    'Энэ сар бол чадвараа бэхжүүлэх цаг, дараагийн үсрэлтэд бэлдэж байна 💪'
  ];
}

// 학생 1명의 학업 로그(날짜 오름차순) → 스냅샷 객체. calcAcademic_·previewAcademic 공용.
function academicSnapshot_(logs) {
  if (!logs || !logs.length) return null;
  const levels = logs.filter(l => l.type === 'level');
  const mocks = logs.filter(l => l.type === 'mock');
  const curLevel = levels.length ? levels[levels.length - 1].val : '';
  let levelUps = 0, recentLevelUp = false, fromLv = '', toLv = '';
  for (let k = 1; k < levels.length; k++) if (levels[k].val > levels[k - 1].val) levelUps++;
  if (levels.length >= 2 && levels[levels.length - 1].val > levels[levels.length - 2].val) {
    recentLevelUp = true; fromLv = levels[levels.length - 2].val; toLv = levels[levels.length - 1].val;
  }
  const curMock = mocks.length ? mocks[mocks.length - 1].val : '';
  const hasDelta = mocks.length >= 2;
  const delta = hasDelta ? (curMock - mocks[mocks.length - 2].val) : '';
  const bestMock = mocks.length ? Math.max.apply(null, mocks.map(m => m.val)) : '';
  const lastMonth = String(logs[logs.length - 1].ds).substring(0, 7);
  const lastEntry = logs[logs.length - 1];
  const state = { first: logs.length === 1, levelUp: false, fromLv: fromLv, toLv: toLv, hasDelta: false, delta: delta };
  if (!state.first) { // 가장 최근 사건 기준 메시지 (mock 항목이라도 직전 레벨업이 있으면 축하 유지)
    if (lastEntry.type === 'level' && recentLevelUp) state.levelUp = true;
    else if (lastEntry.type === 'mock' && hasDelta) state.hasDelta = true;
    else if (recentLevelUp) state.levelUp = true;
    else if (hasDelta) state.hasDelta = true;
  }
  const msg = academicMsg_(state);
  return { curLevel: curLevel, curMock: curMock, delta: delta, bestMock: bestMock,
           levelUps: levelUps, lastMonth: lastMonth, ko: msg[0], mn: msg[1] };
}

// academic_log를 학생별로 읽어 그룹핑(날짜 오름차순). calcAcademic_·previewAcademic 공용.
function readAcademicLogs_(ss, tz) {
  const byId = {};
  const al = ss.getSheetByName('academic_log');
  if (!al || al.getLastRow() < 2) return byId;
  al.getRange(2, 1, al.getLastRow() - 1, 7).getValues().forEach(r => {
    const sid = r[1], type = String(r[3] || '').trim(), val = Number(r[4]) || 0;
    if (!sid || (type !== 'level' && type !== 'mock')) return;
    (byId[sid] = byId[sid] || []).push({ ds: dstr(r[2], tz), type: type, val: val });
  });
  Object.keys(byId).forEach(k => byId[k].sort((a, b) => a.ds < b.ds ? -1 : (a.ds > b.ds ? 1 : 0)));
  return byId;
}

function calcAcademic_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return; // 콜드스타트 가드

  const byId = readAcademicLogs_(ss, tz);

  // profiles 신규열 BO~BV(67~74) 확장 + 헤더 보장 (기존 66열 계산과 분리)
  if (pf.getMaxColumns() < 74) pf.insertColumnsAfter(pf.getMaxColumns(), 74 - pf.getMaxColumns());
  const heads = ['현재급수','최근모의점수','직전대비Δ','최고모의점수','레벨업누적','마지막평가월','학업한마디_KO','학업한마디_MN'];
  heads.forEach((h, i) => { if (String(pf.getRange(1, 67 + i).getValue()) !== h) pf.getRange(1, 67 + i).setValue(h); });

  const n = pf.getLastRow() - 1;
  const ids = pf.getRange(2, 1, n, 1).getValues();
  const roles = pf.getRange(2, 4, n, 1).getValues();
  const out = ids.map((r, i) => {
    const sid = r[0];
    if (!sid || roles[i][0] !== 'student') return ['', '', '', '', '', '', '', ''];
    const snap = academicSnapshot_(byId[sid]);
    if (!snap) return ['', '', '', '', '', '', '', ''];
    return [snap.curLevel, snap.curMock, snap.delta, snap.bestMock, snap.levelUps, snap.lastMonth, snap.ko, snap.mn];
  });
  writeIfChanged(pf, 2, 67, out);
  Logger.log('calcAcademic_ 완료: 학업 로그 ' + Object.keys(byId).length + '명');
}

// 시트에 쓰지 않고 계산 결과만 로그로 — 배포 전 검증용
function previewAcademic() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const byId = readAcademicLogs_(ss, tz);
  const keys = Object.keys(byId);
  if (!keys.length) { Logger.log('academic_log 비어 있음 — setupAcademic 먼저 실행하세요'); return; }
  Logger.log('=== previewAcademic (시트 미기록) — ' + keys.length + '명 ===');
  keys.forEach(sid => {
    const s = academicSnapshot_(byId[sid]);
    Logger.log(sid + ' | 급수 ' + (s.curLevel === '' ? '-' : s.curLevel) +
      ' · 최근모의 ' + (s.curMock === '' ? '-' : s.curMock) +
      ' · Δ ' + (s.delta === '' ? '-' : s.delta) +
      ' · 최고 ' + (s.bestMock === '' ? '-' : s.bestMock) +
      ' · 레벨업 ' + s.levelUps + ' · ' + s.lastMonth +
      '\n    KO: ' + s.ko + '\n    MN: ' + s.mn);
  });
}

/* ===================== [v9.18] 🖼️ 임시 플레이스홀더 이미지 =====================
 * ⚠️ 임시용 — Recraft 진짜 이미지가 나오기 전, 앱에 빈 이미지 자리가 보이지 않도록 채우는 용도.
 * contents의 monster/boss/worldboss 행 중 이미지URL(E열)이 "빈 행만" placehold.co URL로 채움.
 * 이미 URL이 있는 행은 절대 덮어쓰지 않음(진짜 이미지 보존). 진짜 이미지가 오면 그 행은 자동 스킵.
 * 임시 부품이라 bootstrapSynk 재건 목록·healthCheck 시트 점검에는 넣지 않음(academic_log와 반대). */
function setupPlaceholderImages() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ct = ss.getSheetByName('contents');
  if (!ct || ct.getLastRow() < 2) { Logger.log('contents 비어 있음 — 플레이스홀더 스킵'); return; }
  const color = { monster: '4F46E5', boss: '312E81', worldboss: '1E1B4B' }; // 인디고 · 다크퍼플 · 더 어둡게
  const n = ct.getLastRow() - 1;
  const data = ct.getRange(2, 1, n, 6).getValues(); // A~F (콘텐츠ID·유형·이름·설명·이미지URL·순번)
  let filled = 0;
  const eCol = data.map(r => {
    const id = String(r[0] || ''), type = String(r[1] || ''), url = String(r[4] || '').trim();
    if (color[type] && !url) { // 대상 유형 + 빈 URL만 (기존 URL·비대상 유형은 손대지 않음)
      const label = id.replace(/[^A-Za-z0-9]/g, '') || type.toUpperCase(); // ASCII만 — placehold.co 한글 깨짐 방지
      filled++;
      return ['https://placehold.co/400x400/' + color[type] + '/FFFFFF/png?text=' + label];
    }
    return [r[4]]; // 그대로 보존 (진짜 이미지 포함)
  });
  writeIfChanged(ct, 2, 5, eCol);
  Logger.log('임시 플레이스홀더 이미지 ' + filled + '개 채움 (빈 monster/boss/worldboss만 · 기존 URL 보존)');
}

/* ===================== [v5] 신규 트리거/시트 셋업 (1회 실행) ===================== */

// [v9.9] 🧬 원버튼 재건 — 빈 스프레드시트에서 SYNK 세계 전체를 되살립니다
function bootstrapSynk() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // 0단계: 데이터 시트 골격 — 이 목록이 곧 SYNK의 시트 지도입니다 (실데이터는 백업에서 복원)
  const skeleton = [
    ['profiles', ['user_id','이름','invite_code','role','class_name','생년월일','연락처','SNS','비고','email']],
    ['point_logs', ['id','student_id','points','reason','given_by','created_at','month','태그']],
    ['attendance', ['id','student_id','timestamp','method']],
    ['teacher_checkins', ['id','teacher','timestamp','type']],
    ['form_responses', ['제출시각']],
    ['raid', ['week','class_name','boss','HP','누적데미지','상태']],
    ['carryover', ['student_id','points']], ['app_state', ['key','value']],
    ['titles', ['월','student_id','칭호']], ['manual_titles', ['student_id','칭호','부여자','날짜']],
    ['achievements', ['student_id','업적','등급','달성일']],
    ['monthly_snapshot', ['월','student_id','월간포인트','랭킹']],
    ['story', ['월','student_id','이름','스토리']],
    ['notices', ['title','body','date','title_mn','body_mn']],
    ['weekly_topics', ['class_name','배운내용','입력자','created_at','배운내용_mn']],
    ['class_fuel', ['class_name','미션','입력자','created_at']],
    ['hw_batch', ['date','class_name','완료자목록','입력자','created_at','처리상태']],
    ['today_board', ['유형','이름','반','시각','퇴근']],
    ['teacher_stats', ['teacher','지급수','편중률']], ['report_cards', ['월','student_id','내용']],
    ['league_history', ['월','student_id','랭킹']], ['hall_of_fame', ['연도','이름','반','업적','한마디','사진URL']],
    ['raid_story', ['date','class_name','유형','제목','스토리']]
  ];
  skeleton.forEach(k => ensureSheet(ss, k[0], k[1]));
  const steps = [
    ['시간표·반 구조', setupSchedule], ['기준 테이블', setupTables], ['스토어', setupStore],
    ['몬스터 7', setupMonsters], ['보스 12 + 대군주', setupBosses], ['시즌 12', setupSeasons],
    ['브레인팁 30', setupBrainTips], ['학부모 라벨', setupParentLabels], ['크루 응원', setupTeacherCheers],
    ['연료 미션', setupFuelMissions], ['칭호 설화', setupTitleLore], ['워밍업 퀴즈', setupQuiz],
    ['숙제 210', setupHomework], ['학업 로그', setupAcademic] // [v9.18] 학업 성장 축 시트 재건 편입
  ];
  const log = [];
  steps.forEach(s => { try { s[1](); log.push('✓ ' + s[0]); } catch (e) { log.push('✗ ' + s[0] + ': ' + e.message); } });
  try { worldRaidMonthly_(); log.push('✓ 월드 보스 소환'); } catch (e) { log.push('✗ 월드: ' + e.message); }
  try { calcAll(); log.push('✓ 전체 계산 1회'); } catch (e) { log.push('✗ calcAll: ' + e.message); }
  let cnt = 0;
  const ct = ss.getSheetByName('contents');
  if (ct && ct.getLastRow() >= 2) cnt = ct.getLastRow() - 1;
  const summary = 'SYNK OS 재건 완료 — 시트 ' + ss.getSheets().length + '장 · 콘텐츠 ' + cnt + '개\n' + log.join('\n') +
    '\n\n다음 단계: setupV5Triggers() 1회 실행 → 데이터 복원(백업 폴더) → Glide 연결';
  Logger.log(summary);
  return summary;
}

function setupV5Triggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, 'class_fuel', ['class_name', '미션', '입력자', 'created_at']); // [v5.7] 레이드 연료
  ensureSheet(ss, 'weekly_topics', ['class_name', '배운내용', '입력자', 'created_at', '배운내용_mn']); // [v5.7]
  ensureSheet(ss, 'report_cards',
    ['card_id', 'student_id', '월', 'image_url', '칭호', '코멘트', 'created_at']);
  ensureSheet(ss, 'league_history',
    ['월', '시즌', '챔피언반', '챔피언포인트', '준우승', '준우승포인트',
     'MVP_id', 'MVP이름', 'MVP포인트', 'created_at']);

  // [v6.3] 트리거 생성은 resetAllTriggers()가 전담 — 20개 한도 초과 방지
  Logger.log('✅ 시트 준비 완료 — 이어서 resetAllTriggers()를 실행하세요 (트리거 통합 재설치)');
}

/* ===================== [v6.3] 트리거 통합 리셋 — 20개 한도 해결 =====================
 * Apps Script는 스크립트당 시간 트리거 20개 한도. v4부터 쌓인 개별 트리거를 전부 지우고
 * 시간대별 통합 작업 10개로 재설치합니다. 실행 순서 보장 덤:
 * 게임배치 → 아카이브 순서가 코드로 고정 (기존엔 별도 트리거라 경합 위험).
 * ⚠️ 매월 1일 오전(리포트카드 생성 중)에는 실행하지 마세요 — 이어하기 트리거가 끊깁니다. */

function safeRun(name, fn) {
  try { fn(); }
  catch (e) {
    Logger.log('❗ ' + name + ' 실패: ' + e);
    if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] ❗ 자동 작업 실패: ' + name,
      String(e && e.stack ? e.stack : e) + '\n\n다른 작업들은 정상 진행되었습니다.');
  }
}

function morningJobs() {   // 매일 07시
  safeRun('syncProfiles', syncProfiles);       // [v7.0] 동기화 먼저 — 신규 학생 생일을 당일부터 인식
  safeRun('birthdayCheck', birthdayCheck);
  safeRun('checkConsultDelay', checkConsultDelay);
}

function nightJobs() {     // 매일 22시 — 수업 종료 후
  safeRun('calcAll', calcAll); // 오늘의 숙제 게시(21시 조건) 포함
  safeRun('expandHwBatch', expandHwBatch);       // [v8.0] 숙제 일괄 1탭 → 학생별 +10 전개 (가드·정산·스토리 전에)
  safeRun('dailyGuard', dailyGuard);             // [v7.5] 일일 한도 — MVP 반당 1명 + 숙제·칭찬·생일 1회/일 자동 정정
  safeRun('notifyDailyAwards', notifyDailyAwards); // [v7.6] 유효 MVP·시냅스 학부모 알림(한·몽 통합 1통)
  const dyN = new Date().getDay(); // [v7.3] 금=평일반 정산 · 일=주말반 정산(주말 수업 데미지 미집계 결함 수정)
  if (dyN === 5 || dyN === 0) safeRun('raidSettle', raidFriday);
  else safeRun('raidStoryDaily', raidStoryDaily); // 월~목·토 일일 전투 리포트
  if (dyN !== 0) safeRun('leagueStoryDaily', leagueStoryDaily_); // [v9.3] 월~토 리그 중계석
  if (dyN === 0) safeRun('leagueSettle', leagueSettle_); // [v9.1] 반 대항 리그 — 주간데미지 확정 후·다이제스트 전
  if (dyN === 0) safeRun('parentWeeklyDigest', parentWeeklyDigest); // [v7.9] 일요일 밤 — 학부모 주간 소식 1통
  safeRun('notifyParents', notifyParents);
  safeRun('checkNoShow', checkNoShow);
  safeRun('checkEvolution', checkEvolution);
  safeRun('checkAchievements', checkAchievements);
}

function weeklyJobs() {    // 매주 월 07시
  safeRun('raidMonday', raidMonday);
  safeRun('healthCheck', healthCheck);
  safeRun('systemWatchdog', systemWatchdog);
  safeRun('weeklyReport', weeklyReport);
  safeRun('checkTuition', checkTuition);         // 미납은 주 1회 (알림 다이어트)
  safeRun('checkReenrollment', checkReenrollment);
  // [v7.0] pruneAppState 제거 — 인자(ss, 월)가 필요한 archiveMonthly 내부 헬퍼였음 (무인자 호출 시 매주 실패)
}

function monthlyJobs() {   // 매월 1일 05시 — 순서 고정이 핵심
  safeRun('monthlyGameBatch', monthlyGameBatch); // ① 지난달 칭호·스냅샷 (로그가 옮겨지기 전에!)
  safeRun('worldRaidMonthly', worldRaidMonthly_); // [v9.6] ①.4 🌍 월드 정산·소환 — 스토리북이 결과를 읽도록 먼저
  safeRun('buildMonthlyStorybook', buildMonthlyStorybook_); // [v9.4] ①.5 📖 싱크 스토리 — 칭호 확보 후·아카이브 전
  safeRun('buildMonthlyCards', buildMonthlyCards_);   // [v9.12] ①.6 🃏 이달의 카드
  safeRun('updateTravelMap', updateTravelMap_);       // [v9.12] ①.7 🗺️ 여행 지도 도장
  safeRun('buildExecReport', buildExecReport_);       // [v9.14] ①.8 📊 경영 리포트
  safeRun('archiveMonthly', archiveMonthly);     // ② 그다음 아카이브
}

function resetAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('parentSweep').timeBased().everyMinutes(10).create(); // [v6.8] 30→10분: 수업 전·퇴근 후 알림 정밀도
  ScriptApp.newTrigger('dailyBackup').timeBased().atHour(3).everyDays(1).create();
  ScriptApp.newTrigger('morningJobs').timeBased().atHour(7).everyDays(1).create();
  ScriptApp.newTrigger('sendMorningDigest').timeBased().atHour(8).everyDays(1).create();
  ScriptApp.newTrigger('calcAll').timeBased().atHour(14).everyDays(1).create();
  ScriptApp.newTrigger('nightJobs').timeBased().atHour(22).everyDays(1).create();
  ScriptApp.newTrigger('weeklyJobs').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
  ScriptApp.newTrigger('monthlyJobs').timeBased().onMonthDay(1).atHour(5).create();
  ScriptApp.newTrigger('monthlyReportCards').timeBased().onMonthDay(1).atHour(6).create();
  ScriptApp.newTrigger('monthlyReport').timeBased().onMonthDay(1).atHour(7).create();
  Logger.log('✅ 트리거 통합 재설치 완료: 10개 (30분 스위프 · 3시 백업 · 7시 아침작업 · 8시 브리핑 · 14/22시 계산 · 월 7시 주간 · 1일 5/6/7시 월간)');
}

/* ===================== [v5.3] 저업데이트 모드 (선택 실행) =====================
 * Glide 업데이트 예산이 빠듯할 때: calcAll을 6시간 4회 → 하루 2회(14시·22시)로 전환.
 * 14시 = 오후 수업 전 최신화 · 22시 = 수업 후 반영 + 오늘의 숙제 게시(21시 조건) 담당.
 * 계산열(게이지·연속출석 등) 갱신이 하루 2번이 되는 대신 시트→Glide 싱크가 절반.
 * 버튼 포인트/출석은 앱에서 즉시 기록되므로 체감 영향은 적음.
 * 되돌리기: Apps Script 트리거 화면에서 calcAll 트리거를 원하는 주기로 재생성.     */

function applyLowUpdateMode() {
  // [v6.3] 통합 리셋에 14시/22시(nightJobs)가 포함 — 이 함수는 리셋으로 위임
  resetAllTriggers();
}