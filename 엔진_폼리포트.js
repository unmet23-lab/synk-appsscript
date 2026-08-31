// SYNK 엔진 분할부 — 폼·리포트 — 상담 구글폼·출석/숙제 폼·스토어·과잠 워처·헬스체크·리포트 카드·명예의 전당·자동 공지.
// 원본은 Code.js 단일 파일이었다. 로드 순서 정본 = .clasp.json filePushOrder(상수 정본 Code.js가 선두). 표식 기반 테스트는 tests/_engine-source.js가 전 파일을 합본해 본다.
/* ===================== 상담 구글폼 ===================== */

// [v9.66] 상담 정본 v18.4 증분 열 — Crew Dossier(오프라인 상담지)와 온라인 폼·상담데이터입력 시트 문항 통일.
//   importFormResponses가 '헤더 이름 매칭'으로 기입하므로 열 위치 무관(60~62열 = 학생ID·자동열 보호 구간만 회피).
//   앞으로 문항을 늘릴 땐 ① 이 배열에 헤더 추가 ② migrateConsultV184의 spec에 한 줄 ③ tests/safety.test.js의 동결 배열 문자열 갱신 ④ ▶ 1회.
//   서술형(문단형) 신규 문항은 여기 넣지 않는다 — 대응 헤더가 없으면 규칙대로 📝자유서술→노션 칸에 모인다.
const CONSULT_EXT_HEADERS = ['학교명/전공', '방문상세', '거절정황', '선호그룹', '인생드라마', '취미관심사'];

function createConsultForm() { // [v9.19] 상담지 시트 v18.3 정합 — 문항 제목=시트 헤더명(19개 재정렬), 서술형→📝자유서술→노션. (구 v8.4=v18.1) · [v9.66] v18.4 — Crew Dossier 문항 통일(증분 8문항+관심K분야 '예능') + 재실행 안전 가드
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  // [v9.66] 재실행 안전 — 연결된 상담폼이 살아 있으면 새로 만들지 않는다(레벨테스트 v9.60·출석/숙제 v9.62와 같은 계급:
  //   재실행마다 새 폼이 생기고 상담폼ID가 갈아끼워지면 배포된 링크·QR 응답이 미아가 된다). 문항 증분은 migrateConsultV184 ▶ 1회.
  const exId = String(getState(st, '상담폼ID').val || '');
  if (exId) {
    try {
      const exForm = FormApp.openById(exId);
      const msg0 = '✅ 상담폼이 이미 연결돼 있어 새로 만들지 않았습니다.\n학생용: ' + exForm.getPublishedUrl() + '\n문항 업그레이드(v18.4)는 migrateConsultV184 ▶ 1회.';
      Logger.log(msg0);
      return msg0;
    } catch (eGuard) {
      // [리뷰 M1] 일시 장애·권한 순간 오류도 이 catch로 온다 — 여기서 새 폼을 만들면 배포된 링크·QR가 구 폼을
      // 가리킨 채 응답이 미아가 되고(무감시 단절), 폼 생존 점검은 새 폼을 보고 통과해버린다. 진짜 삭제됐을 때만
      // 사람 손으로 app_state '상담폼ID' 키를 지우고 재실행하는 것이 재생성 경로다(5708행 안내와 동일 관례).
      const msgG = '⚠️ 연결된 상담폼ID를 열지 못했습니다(' + eGuard + ').\n일시 오류일 수 있어 새 폼을 만들지 않았습니다 — 폼이 정말 삭제된 게 맞으면 app_state 시트에서 상담폼ID 행을 지운 뒤 다시 실행하세요.';
      Logger.log(msgG);
      return msgG;
    }
  }
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
  txt('학교명/전공').setHelpText('재학·졸업 학교명과 전공 (선택)'); // [v9.66] v18.4 — 진학 로드맵·비자 소명 재료
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
  txt('방문상세').setHelpText('방문 기간·목적 (한국 방문 경험이 있을 때만)'); // [v9.66] v18.4
  mc('비자신청이력', ['없음', '승인', '거절'], true); // [v9.19] v18.3
  mc('거절비자종류', ['C-3', 'D-4', 'D-2', '기타']).setHelpText('비자 거절 경험이 있을 때만'); // [v9.19] v18.3
  txt('거절정황').setHelpText('거절 시기·영사 지적 사유 (거절 경험이 있을 때만)'); // [v9.66] v18.4 — 비자 전략 설계의 핵심 재료
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
  txt('취미관심사').setHelpText('운동·음악·요리·게임·여행 등 자유롭게'); // [v9.66] v18.4 — 케어 대화·콘텐츠 개인화 재료
  para('한국어고충').setHelpText('암기·집중·발음·문법·말하기 울렁증 등 — 수업 설계에 그대로 반영됩니다'); // [v9.66] v18.4 서술형 → 노션
  mc('관심K분야', ['KPOP', '드라마', '뷰티패션', '음식', '예능']).setHelpText('가장 관심 있는 것 하나만'); // [v9.66] '예능' 증분(Crew Dossier 정합)
  txt('선호그룹').setHelpText('K-POP 최애 그룹 (있다면)'); // [v9.66] v18.4
  txt('인생드라마').setHelpText('인생 K-드라마·작품 (있다면)'); // [v9.66] v18.4
  mc('KPOP댄스희망', ['매우희망', '보통', '없음']);
  mc('보컬트레이닝', ['매우희망', '보통', '없음']);
  mc('연기체험', ['매우희망', '보통', '없음']);
  mc('K뷰티메이크업', ['매우희망', '보통', '없음']);
  mc('영어수업관심', ['매우희망', '보통', '없음']).setHelpText('SYNK 영어 수업 (GLOBAL ENGLISH) 참여 희망'); // [v9.19] v18.3: 영어수업→영어수업관심
  para('영어 학습 목표 (선택)');

  form.addSectionHeaderItem().setTitle('PART 6 — 기대와 건의');
  mc('인지채널', ['페이스북', '인스타', '틱톡', '추천', '오픈데이', '학교제휴', '워크인', '기타'], true); // [v9.33] leads 유입경로 8버킷과 통일 — 어트리뷰션 분류 정합('광고' 단일 버킷→플랫폼 분리)
  para('SYNK선택이유').setHelpText('SYNK를 선택한 결정적 이유 (예: 비자 관리 · 확실한 성적 향상 · K컬처 클래스)'); // [v9.66] v18.4 서술형 → 노션 — 전환 결정타 수집
  para('SYNK 기대사항');
  para('이전 학원 경험');
  para('담당크루께 바라는 점');
  para('기타 질문');

  setState(st, '상담폼ID', form.getId());
  const doneMsg = '✅ 폼 생성 완료! (v18.4)\n학생용: ' + form.getPublishedUrl() + '\n편집용: ' + form.getEditUrl();
  Logger.log(doneMsg);
  return doneMsg;
}

/* [v9.66] 상담 정본 v18.4 통합 마이그레이션 — ▶ 1회 실행(재실행 안전 · 멱등).
 * 유호님 2026-07-26 지시(구글폼+상담데이터입력 시트를 오프라인 Crew Dossier 기준 단일 정본으로 통합)의 실행부.
 * ① 상담데이터입력 2행 헤더 끝(63열~)에 CONSULT_EXT_HEADERS 중 없는 것만 추가 — 기존 62열·데이터·행은 불변
 *    (syncProfiles r[59] 학생ID·KPI·워치독 전부 열 '추가'에는 무영향. 60열=학생ID가 아니면 스키마 어긋남으로 중단).
 * ② 라이브 상담폼에 v18.4 신규 문항(제목=헤더명)을 같은 제목이 없을 때만 추가하고 파트 내 제자리로 이동.
 *    기존 문항·제목·응답·URL은 건드리지 않는다(v9.64 '제자리 업그레이드' 계보 — 응답 이력·배포 링크 보존).
 *    '관심K분야'에는 '예능' 선택지만 증분(기존 응답값 불변).
 * ③ 결과를 로그+원장 메일로 보고. 끝나면 checkFormMapping ▶로 매핑을 눈으로 확인하는 것을 권장. */
function migrateConsultV184() {
  const out = [];
  let sheetOk = false; // [리뷰 M5] 시트 증분 성공 시 app_state '상담정본'=v18.4 선언 — 워치독 감시 게이트
  // ① 시트 헤더 증분
  try {
    const consult = SpreadsheetApp.openById(CONSULT_SHEET_ID).getSheetByName('상담데이터입력');
    if (!consult) out.push("⚠️ 시트: '상담데이터입력' 탭 없음 — 탭 이름 확인, 증분 중단");
    else {
      const w0 = consult.getLastColumn();
      const hdr = w0 >= 1 ? consult.getRange(2, 1, 1, w0).getValues()[0].map(h => String(h || '').trim()) : [];
      if (w0 < 62 || hdr[59] !== '학생ID') {
        out.push('⚠️ 시트: 스키마 어긋남(폭 ' + w0 + '열 · 60열="' + (hdr[59] || '빈칸') + '") — 60열(BH)=학생ID 전제가 깨져 있어 증분을 중단합니다. dumpConsultHeaders ▶로 확인하세요.');
      } else {
        const have = {}; hdr.forEach(h => { if (h) have[h] = 1; });
        const added = [], kept = [];
        let wH = 0; hdr.forEach((h, i) => { if (h) wH = i + 1; }); // [리뷰 L1] 시트 lastColumn이 아니라 '헤더 행의 끝' 기준 — 오른쪽 데이터 잔재가 있어도 63열부터 정확히 붙는다
        let col = Math.max(62, wH) + 1; // 항상 뒤에만 추가 — 기존 열 위치(인덱스 참조)가 절대 안 밀린다
        const firstNew = col;
        CONSULT_EXT_HEADERS.forEach(h => {
          if (have[h]) { kept.push(h); return; }
          if (consult.getMaxColumns() < col) consult.insertColumnsAfter(consult.getMaxColumns(), col - consult.getMaxColumns());
          consult.getRange(2, col).setValue(h);
          added.push(h + '(' + col + '열)');
          col++;
        });
        if (added.length) consult.showColumns(firstNew, added.length); // [리뷰 M3] 숨김 열(62열=반조회순번) 옆 삽입은 숨김을 상속할 수 있다 — 강사 눈에 보이게 강제
        sheetOk = true;
        out.push('시트: 추가 ' + (added.length ? added.join(', ') : '없음') + (kept.length ? ' · 이미 있음 ' + kept.length + '개' : ''));
      }
    }
  } catch (e) { out.push('⚠️ 시트 접근 실패 — CONSULT_SHEET_ID/권한 확인: ' + e); }

  // ② 라이브 폼 제자리 증분
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const st = ensureSheet(ss, 'app_state', ['key', 'value']);
    if (sheetOk) setState(st, '상담정본', 'v18.4'); // [리뷰 M5] 적용 선언 — 워치독이 열 폭이 아니라 이 플래그로 감시(6열 전량 삭제로 폭이 62로 돌아와도 잡힌다)
    const fid = String(getState(st, '상담폼ID').val || '');
    if (!fid) out.push('폼: 상담폼ID 미연결 — createConsultForm ▶ 먼저(새 폼은 v18.4 문항 포함으로 생성됩니다)');
    else {
      const form = FormApp.openById(fid);
      let titleIdx = {};
      const rebuild = () => { titleIdx = {}; form.getItems().forEach(x => { titleIdx[String(x.getTitle()).trim()] = x.getIndex(); }); };
      rebuild();
      // [제목, 종류, 도움말, 위치 앵커(이 문항 바로 뒤에 배치)] — 제목=시트 헤더명 규칙 유지
      const spec = [
        ['학교명/전공', 'text', '재학·졸업 학교명과 전공 (선택)', '최종학력'],
        ['방문상세', 'text', '방문 기간·목적 (한국 방문 경험이 있을 때만)', '한국방문경험'],
        ['거절정황', 'text', '거절 시기·영사 지적 사유 (거절 경험이 있을 때만)', '거절비자종류'],
        ['취미관심사', 'text', '운동·음악·요리·게임·여행 등 자유롭게', '대표강점'],
        ['한국어고충', 'para', '암기·집중·발음·문법·말하기 울렁증 등 — 수업 설계에 그대로 반영됩니다', '취미관심사'],
        ['선호그룹', 'text', 'K-POP 최애 그룹 (있다면)', '관심K분야'],
        ['인생드라마', 'text', '인생 K-드라마·작품 (있다면)', '선호그룹'],
        ['SYNK선택이유', 'para', 'SYNK를 선택한 결정적 이유 (예: 비자 관리 · 확실한 성적 향상 · K컬처 클래스)', '인지채널']
      ];
      const fAdded = [], fKept = [];
      spec.forEach(q => {
        if (titleIdx[q[0]] !== undefined) { fKept.push(q[0]); return; } // 멱등 — 같은 제목이 있으면 스킵
        const it = q[1] === 'para' ? form.addParagraphTextItem() : form.addTextItem();
        it.setTitle(q[0]).setHelpText(q[2]);
        const anchor = titleIdx[q[3]];
        if (anchor !== undefined) form.moveItem(it.getIndex(), anchor + 1);
        rebuild(); // 이동 후 인덱스가 전부 밀리므로 다음 앵커 계산 전에 재구축
        fAdded.push(q[0] + (anchor === undefined ? '(앵커 "' + q[3] + '" 미발견 — 맨 끝 배치)' : '')); // [리뷰 L4] 조용한 끝 배치를 리포트에 노출
      });
      // '관심K분야' 선택지 '예능' 증분(기존 선택지·응답 보존)
      const kItems = form.getItems().filter(x => String(x.getTitle()).trim() === '관심K분야' && x.getType() === FormApp.ItemType.MULTIPLE_CHOICE);
      if (kItems.length) {
        const mcIt = kItems[0].asMultipleChoiceItem();
        const vals = mcIt.getChoices().map(ch => ch.getValue());
        if (vals.indexOf('예능') === -1) { vals.push('예능'); mcIt.setChoiceValues(vals); fAdded.push("관심K분야+'예능'"); }
        else fKept.push("관심K분야 '예능'");
      } else out.push("폼: '관심K분야' 객관식 문항을 못 찾음 — 제목 변경 여부 확인");
      out.push('폼: 추가 ' + (fAdded.length ? fAdded.join(', ') : '없음') + (fKept.length ? ' · 이미 있음 ' + fKept.length + '개' : ''));
    }
  } catch (e) { out.push('⚠️ 폼 증분 실패 — 상담폼ID/권한 확인: ' + e); }

  const report = '🔀 상담 정본 v18.4 마이그레이션 결과\n' + out.join('\n') +
    '\n\n다음 확인: checkFormMapping ▶ — 증분 6문항이 열에 매핑되고, 서술형 2문항(한국어고충·SYNK선택이유)이 노션이관으로 표시되면 정상입니다.';
  Logger.log(report);
  if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 🔀 상담 정본 v18.4 마이그레이션', report);
  return report;
}

// [v9.90] 음성·면접 녹음 동의가 받는 시트 열 — 문항 B는 blob이 아니라 '열'로 받는다(아래 설계 ③).
const CONSENT_EXT_HEADERS = ['음성동의'];
/* [v9.104] 음성 보관 기간 = **기간 제한 없음**(유호님 08-01 재확정 — 08-01 오전 1년 → 오후 무제한).
 *   0 = 무기한. 데이터 축적이 전략 축이라는 판단(오래된 녹음일수록 "처음 목소리 vs 오늘" 대비가 커진다).
 *   ⚠ 무기한은 **시간 기반 자동 삭제가 없다**는 뜻이고, 그래서 삭제의 유일한 트리거가 **철회**가 된다.
 *     즉 1년 설계보다 오히려 철회 경로가 더 중요해진다 — 학생이 지워 달라고 했을 때 실제로 지울 수
 *     있어야 그 문장이 참이 된다(voice_log·Drive 파일·성장 카드 세 곳).
 *   ⚠ 1년→무기한은 **학생에게 불리한 방향**이라 소급 적용이 불가하다. 다행히 1년 문구는 아직 라이브
 *     폼에 반영된 적이 없어(migrateConsentV186 재실행 전) 그 문장으로 동의한 사람이 0명이다.
 *     이후에 기간을 다시 늘리려면 그때는 재동의를 받아야 한다.
 *   ⓘ 몽골법상 음성은 생체정보 계열로 읽힐 수 있어, 무기한 보관은 '동의 철회 시까지'라는 통제권과
 *     한 쌍으로 제시해야 방어된다 — 그래서 문구가 기간과 철회를 같은 문장에 담는다. */
const VOICE_RETENTION_MONTHS = 0;

/* ===================== [v9.138] 🔏 동의 범위 조각 — 두 문구의 공유 정본 =====================
 * 배경: 유호님 확정 계획 = 「2년간 학원 앱으로 학습 데이터를 축적 → AI 한국어 회화 앱 출시」.
 *   그런데 구 문구는 용도가 **학원 운영으로만** 한정돼 있었고 '제3자 제공 없음'이 붙어 있어,
 *   회화 앱을 SYNK LAB이 아닌 **별도 제품·법인으로 내는 순간 2년치를 통째로 못 쓰게** 된다.
 *   동의는 **소급이 불가능**하다 — 첫 실학생이 서명하면 그 문장으로 굳는다(=개원 전이 마지막 기회).
 * 설계: ① 범위·비식별 문장을 상수로 빼 두 문구(A·B)가 어긋날 수 없게 한다(구 구조는 각자 하드코딩이라
 *   한쪽만 고치면 조용히 갈라졌다). ② '제3자 제공 없음'은 **지우지 않는다** — 학생 신뢰의 핵심이라,
 *   대신 처리 **주체 범위**를 넓히고 '그 밖의'를 붙여 관계를 명확히 한다(제3자에게 판다는 뜻이 아니다).
 *   ③ 넓힌 대가로 **비식별 약속을 함께 준다** — 회화 앱에 필요한 건 오류 패턴이지 이름이 아니므로
 *   내주는 것이 없고, 방어력은 크게 오른다. ④ '관계·승계 사업체'는 법인 분리·양수도까지 덮는 표현. */
const CONSENT_SERVICE_SCOPE = 'SYNK LAB과 그 관계·승계 사업체가 만드는 한국어 학습 서비스(앱·AI 학습 도구)의 개발과 개선';
const CONSENT_DEIDENT = '학습 서비스 개발에 쓸 때는 이름·연락처를 지운 형태로만 사용합니다';

/* [v18.8 · 2026-08-03 유호 D4] 철회의 한계 — **지킬 수 없는 약속을 지운다.**
 *   구 문구는 "철회하시면 보관 중인 녹음을 모두 삭제합니다"로 끝났다. 그런데 이미 AI 학습에 들어간
 *   데이터는 학습이 끝난 모델에서 특정 사람의 목소리만 빼낼 방법이 없다. 학생은 "지워진다"로 읽었는데
 *   실제로는 못 지우면, 그건 동의를 받은 게 아니라 분쟁을 예약한 것이다(다투는 쪽은 학원이 된다).
 *   ⚠ 이 문장은 SYNK-talk 앱 내 동의(`docs/동의_문구_v1.md`)와 **같은 문장을 쓴다** — 두 창구가
 *     갈라지면 「학생이 무엇에 동의했는가」가 창구마다 달라진다. 고칠 때는 반드시 양쪽을 함께. */
const CONSENT_IRREVERSIBLE = '다만 이미 AI 학습에 사용된 부분은 되돌릴 수 없습니다 — '
  + '학습이 끝난 모델에서 특정 사람의 목소리만 빼낼 방법이 없기 때문입니다. 철회 이후로는 사용하지 않습니다';

/* [v9.138] 문항 A(개인정보·학습데이터) 문구도 B와 대칭으로 상수화 — 구 구조는 migrateConsentV186 **함수 안**에서
 *   조립돼, 테스트가 "조각이 소스에 있는가"만 볼 수 있었고 **완성된 문장**은 아무도 못 봤다. 동의는 학생이 읽은
 *   문장이 정본이라, 검사해야 하는 것은 조각이 아니라 조립 결과다(guard-must-check-result). */
/* ===================== [v19.0 · 2026-08-07 유호님 확정] 동의문 정본 =====================
 * 유호님 상시 지시: **모든 동의문을 이 두 문장으로 쓴다.** 열거(수집 항목·용도·보관 기간·
 *   철회 안내)는 **넣지 않는다** — 유호님이 두 갈래를 보고 「두 문장만 남긴다」로 고르셨다.
 *
 * 🔑 **주어는 자리마다 맞춘다**(유호님 확정). 앱(SYNK-talk `docs/동의_문구_v1.md`)은
 *   「이 앱은 …」 그대로, 여기 학원 창구(상담폼·크루카드)는 「SYNK LAB…」으로 바꿔 쓴다.
 *   뜻과 문장 구조는 같다 — 크루카드는 **학원 등록 신청서**라 「앱」이라고 하면 학생이
 *   무엇에 동의하는지 헷갈린다.
 *
 * ⚠ 이 개정으로 사라진 것: 수집 항목 열거 · `CONSENT_SERVICE_SCOPE`(관계·승계 사업체) ·
 *   `CONSENT_DEIDENT`(비식별 약속) · `CONSENT_IRREVERSIBLE`(철회해도 기학습분은 못 지운다).
 *   **유호님이 알고 고르신 것이다**(선택지에 그 대가를 적어 드렸다). 상수는 지우지 않고
 *   남겨 둔다 — 되돌리기로 판정이 뒤집히는 날 문장을 다시 짓지 않아도 되게.
 *
 * 🇲🇳 몽골어는 **비어 있다**(아래 `CONSENT_HELP_*_MN`). 옛 번역은 이 두 문장이 아니라
 *   지워진 열거문을 옮긴 것이라, 그대로 두면 게이트를 켜는 날 **한국어와 다른 뜻**이 나간다.
 *   빈 값이면 `동의문구_()` 가 한국어만 낸다. 🚫 기계 번역으로 채우지 않는다. */
const CONSENT_KO_1 = 'SYNK LAB에서 배우시면서 쌓이는 것 가운데 저희가 배우는 데 도움이 되는 것은, '
  + '여러분 한 사람 한 사람에게 맞추는 데 씁니다.';
const CONSENT_KO_2 = 'SYNK LAB의 말하기 수업은 여러분의 목소리로 배워서 여러분을 고쳐 주는 방식입니다.';

const CONSULT_CONSENT_HELP = CONSENT_KO_1 + '\n' + CONSENT_KO_2;

/* ※ 필수 표시는 동의 **내용**이 아니라 폼 구조 안내다 — 없으면 학생이 건너뛸 수 있다고 읽는다. */
const VOICE_CONSENT_HELP = '※ 필수 문항입니다.\n' + CONSENT_KO_1 + '\n' + CONSENT_KO_2;

/* ===================== [v9.138] 🇲🇳 동의 문구 몽골어 병기 — 검수 게이트 =====================
 * 문제: v9.90부터 코드가 스스로 "몽골어 병기 없음 — 학생이 못 읽는 동의는 효력을 다툴 수 있다"고
 *   경고만 하고 있었다. 경고는 아무것도 막지 못한다(=프로즈 조항). 그래서 **틀을 지금 만들고 잠근다.**
 * 설계: 번역문은 **AI 초안**이고 법률 문구라 원어민+법률 검수 전에는 라이브 폼에 실리면 안 된다.
 *   그래서 기본값이 false인 게이트를 둔다 — 검수가 끝나면 유호님이 **이 한 줄만 true로** 바꾸고
 *   migrateConsentV186 ▶ 하면 라이브 폼 두 문항의 도움말이 한·몽 병기로 갱신된다(syncHelp가 이미 그 일을 한다).
 *   ⚠ 게이트를 켜기 전에 번역문을 반드시 사람이 읽어야 한다 — 틀린 번역으로 받은 동의는
 *     없느니만 못하다(학생은 읽은 문장으로 동의한 것이고, 두 문장이 다르면 다투는 쪽은 학원이 된다).
 *   ⓘ 검수 시 특히 볼 것: '관계·승계 사업체'(залгамжлагч)·'비식별'(нэр устгасан)·'철회'(цуцлах) 세 단어. */
const CONSENT_MN_APPROVED = false; // ← 원어민·법률 검수 완료 후 true (유호님)
/* 🔴 **[v19.0] 비웠다.** 여기 있던 번역은 v18.9 의 **열거문**을 옮긴 것이고, 그 열거는 유호님
 *   확정으로 사라졌다. 그대로 두면 `CONSENT_MN_APPROVED` 를 켜는 날 한국어와 **다른 뜻**이
 *   라이브 폼에 선다 — 학생은 자기가 읽은 문장으로 동의한 것이라, 두 문장이 다르면 다투는
 *   쪽은 학원이 된다. 빈 값이면 `동의문구_()` 가 한국어만 낸다(구조가 이미 그렇다).
 * 🚫 기계 번역으로 채우지 않는다 — 새 두 문장의 몽골어는 **원어민 검수를 거쳐** 들어온다.
 *   채우는 날 `tools/몽골어대조.js` 로 역번역 대조까지 하고 `CONSENT_MN_APPROVED = true`. */
const CONSENT_HELP_A_MN = '';
const CONSENT_HELP_B_MN = '';

/* 한·몽 병기 조립 — 게이트가 꺼져 있으면 한국어만 돌려준다(구 동작과 바이트 동일). */
function 동의문구_(ko, mn) {
  return (CONSENT_MN_APPROVED && mn) ? ko + '\n\n— — — — —\n[Монгол хэл]\n' + mn : ko;
}

/* [v9.138] 동의 문구 판 단일 소스 — 구 구조는 'v18.6'이 5곳(마이그레이션 선언·워치독·노션 게이트·
 *   리포트 제목·메일 제목)에 하드코딩돼 있어 개정할 때마다 한 곳을 빠뜨리면 게이트가 영구히 닫히거나
 *   반대로 구 문구를 "적용됨"으로 오인했다. 함수명(migrateConsentV186)은 **일부러 안 바꾼다** — 유호님이
 *   실행하는 이름이자 문서·메뉴에 박힌 이름이라, 재번호가 그쪽까지 번지면 손해가 더 크다(파일명 규칙과 같은 논리).
 * ⚠ 이 값을 올리면 노션 상담서술 이관이 **자동으로 보류된다**(fail-closed) — 새 문구가 라이브 폼에 닿기
 *   전까지는 "구 문장으로 받은 동의"로 새 용도를 쓰면 안 되기 때문이다. migrateConsentV186 ▶ 1회로 풀린다. */
const CONSENT_VERSION = 'v19.0';

// [v9.84·204 → v9.90·205 → v9.138·207] ▶ 1회(유호 문구 검토 후) — 온라인 상담폼 동의 문항 (정본 = CONSENT_VERSION).
//   오프라인 도시에 v3.3 동의·서명 블록(상담통합_실행지_v966 §5)의 온라인 짝 — 지금까지 온라인 폼엔 동의가 0개였다.
//   설계: ① 문항 A(개인정보·학습데이터, 필수)는 시트 헤더를 만들지 않는다 → '📝자유서술→노션' blob에 접수
//   타임스탬프와 함께 보존(=동의 증빙, 노션 상담서술로도 주간 이관). ② 멱등 — 같은 제목이 있으면 스킵(V184와 같은 계급).
//   ③ [v9.90] 문항 B(음성·AI 학습, 선택)는 **열로 받는다** — blob에만 있으면 "누가 거부했는지"를 코드가 못 읽어
//   녹음·AI 학습 기능이 거부자까지 삼킨다. 제목=헤더명 규칙(CONSENT_EXT_HEADERS)으로 상담시트 열에 착지시켜
//   voiceConsentStat_·후속 녹음 기능이 기계 게이트로 쓴다. 필수 응답이되 '아니요' 선택지를 둬 거부가 가능하게 —
//   끼워팔기 동의(거부 불가)는 동의 자체가 무효화될 수 있고, 무응답 허용은 게이트가 침묵으로 통과된다.
//   ④ 문구는 초안 — 보관 기간·법률 수위는 유호님+원어민 검수 몫. 음성은 몽골법상 생체정보 계열이라
//   목적란에 'AI 학습'이 없으면 나중에 모은 것을 전부 못 쓰고 **소급 동의가 불가능**하다(=녹음 시작 전에 박아야 함).
//   ⑤ [v9.138] 몽골어 병기는 상수·게이트로 실장됐다(CONSENT_MN_APPROVED) — 검수 후 그 한 줄만 true.
//   ⑥ [v9.138] 용도에 「SYNK LAB과 그 관계·승계 사업체가 만드는 한국어 학습 서비스」를 넣었다 —
//   2년 축적 → AI 회화 앱 출시 계획에서, 회화 앱을 별도 제품·법인으로 내면 구 문구('제3자 제공 없음' +
//   학원 운영 한정)로는 **2년치를 통째로 못 쓴다**. 넓힌 대가로 비식별 사용 약속을 함께 준다(CONSENT_DEIDENT).
function migrateConsentV186() {
  const out = [];
  let sheetOk = false;
  // ① 시트 헤더 증분 — 음성동의 열(migrateConsultV184와 동일 규약: 항상 헤더 행 끝에만 추가, 기존 열 위치 불변)
  try {
    const consult = SpreadsheetApp.openById(CONSULT_SHEET_ID).getSheetByName('상담데이터입력');
    if (!consult) out.push("⚠️ 시트: '상담데이터입력' 탭 없음 — 탭 이름 확인, 증분 중단");
    else {
      const w0 = consult.getLastColumn();
      const hdr = w0 >= 1 ? consult.getRange(2, 1, 1, w0).getValues()[0].map(h => String(h || '').trim()) : [];
      if (w0 < 62 || hdr[59] !== '학생ID') {
        out.push('⚠️ 시트: 스키마 어긋남(폭 ' + w0 + '열 · 60열="' + (hdr[59] || '빈칸') + '") — 증분 중단. dumpConsultHeaders ▶로 확인하세요.');
      } else {
        const have = {}; hdr.forEach(h => { if (h) have[h] = 1; });
        const added = [];
        let wH = 0; hdr.forEach((h, i) => { if (h) wH = i + 1; });
        let col = Math.max(62, wH) + 1;
        const firstNew = col;
        CONSENT_EXT_HEADERS.forEach(h => {
          if (have[h]) return;
          if (consult.getMaxColumns() < col) consult.insertColumnsAfter(consult.getMaxColumns(), col - consult.getMaxColumns());
          consult.getRange(2, col).setValue(h);
          added.push(h + '(' + col + '열)');
          col++;
        });
        if (added.length) consult.showColumns(firstNew, added.length); // 숨김 열 옆 삽입의 숨김 상속 차단(V184 리뷰 M3와 동일)
        sheetOk = true;
        out.push('시트: ' + (added.length ? '추가 ' + added.join(', ') : '이미 있음 — 스킵(멱등)'));
      }
    }
  } catch (e) { out.push('⚠️ 시트 접근 실패 — CONSULT_SHEET_ID/권한 확인: ' + e); }

  // ② 폼 문항 2종 증분
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const st = ensureSheet(ss, 'app_state', ['key', 'value']);
    const fid = String(getState(st, '상담폼ID').val || '');
    if (!fid) { const m0 = '⚠️ 상담폼ID 미연결 — createConsultForm ▶ 먼저'; Logger.log(m0); return m0; }
    const form = FormApp.openById(fid);
    const fItems = form.getItems();
    const titles = fItems.map(x => String(x.getTitle()).trim());
    /* [v9.103] 도움말 동기화 — 제목만 보고 스킵하던 구 로직에서는 **문구 개정이 라이브 폼에 영원히 닿지 않는다.**
     *   보관 기간처럼 나중에 확정되는 값이 코드에만 바뀌고 학생이 실제로 읽는 문장은 옛것으로 남는 구멍이었다
     *   (동의는 학생이 읽은 문장이 정본이므로, 어긋나면 코드가 가진 근거가 무효가 된다).
     *   제목·선택지·시트 착지는 그대로 두고 도움말만 정본과 맞춘다 — 기존 응답은 손대지 않는다. */
    /* [v18.9] 도움말만 맞추면 **선택지는 옛날 그대로 남는다.** v18.9는 문항 B의 '아니요'를 없애는
     *   개정인데, 이미 라이브에 선 폼은 이 경로로만 지나가므로 도움말만 고치면 화면에는 여전히 거부
     *   선택지가 있고 함수는 "갱신했습니다"라고 보고한다 — 참인 채 거짓을 말하는 그 형태.
     *   그래서 선택지도 정본과 대조해 함께 맞춘다(같으면 건드리지 않는다 = 멱등). */
    const syncHelp = (idx, help, label, choices) => {
      const it = fItems[idx].asMultipleChoiceItem();
      const 현재선택 = it.getChoices().map(c => c.getValue());
      const 문구같음 = String(it.getHelpText() || '') === help;
      const 선택같음 = 현재선택.length === choices.length && 현재선택.every((v, i) => v === choices[i]);
      if (문구같음 && 선택같음) { out.push(label + ': 이미 있음 · 문구·선택지 최신'); return; }
      if (!문구같음) it.setHelpText(help);
      if (!선택같음) it.setChoiceValues(choices);
      out.push(label + ': 이미 있음 — 📝 ' + [!문구같음 ? '문구' : '', !선택같음 ? '선택지(' + 현재선택.join('/') + ' → ' + choices.join('/') + ')' : '']
        .filter(Boolean).join('·') + '를 정본으로 갱신했습니다');
    };
    const 동의선택 = ['네, 동의합니다']; // A·B 공통 — v18.9부터 거부 선택지 없음

    const A = CONSENT_Q_TITLE; // [v9.98] 제목 하드코딩 2곳 → 단일 소스. 이 제목이 곧 blob의 행 단위 동의 마커라 어긋나면 전 행이 미동의로 분류된다
    // [v9.138] 용도에 학습 서비스 개발 + 비식별 약속을 넣는다(문장 정본 = CONSULT_CONSENT_HELP · 병기만 여기서 감싼다)
    const HELP_A = 동의문구_(CONSULT_CONSENT_HELP, CONSENT_HELP_A_MN);
    if (titles.indexOf(A) !== -1) syncHelp(titles.indexOf(A), HELP_A, '폼 A(개인정보·필수)', 동의선택);
    else {
      form.addMultipleChoiceItem().setTitle(A).setHelpText(HELP_A)
        .setChoiceValues(동의선택).setRequired(true);
      out.push('폼 A(개인정보·필수): 추가 — 응답은 자유서술 칸에 타임스탬프와 함께 보존됩니다');
    }

    // 문항 B — 제목이 곧 시트 헤더명이어야 열에 착지한다(importFormResponses 헤더 이름 매칭)
    const B = CONSENT_EXT_HEADERS[0]; // '음성동의'
    const HELP_B = 동의문구_(VOICE_CONSENT_HELP, CONSENT_HELP_B_MN); // [v9.138] 단일 소스는 그대로, 병기만 감싼다
    /* [v18.9 · 2026-08-03 유호 결정] 문항 B를 **필수·거부 선택지 없음**으로 전환.
     *   구 구조(v9.90)는 '아니요' 선택지를 둬 끼워팔기 무효 리스크를 피했지만, 유호님이 방향을 바꿨다 —
     *   **처음 만나는 사용자부터 전부, 목적·기간 제한 없이 받는다.** 정당성의 근거는 문구로 세운다:
     *   음성 학습은 부수 목적이 아니라 이 학원 말하기 수업의 본질이라, 동의하지 않으면 제공할 서비스가 없다.
     *   ⚠ 기존 '아니요' 응답자와 종이 동의서 학생을 위해 **게이트(voiceConsentMap_)는 그대로 둔다** —
     *     선택지가 사라져도 셀에 남은 'no'는 여전히 읽히고 voiceWithdraw도 그 값을 계속 쓴다. */
    if (titles.indexOf(B) !== -1) syncHelp(titles.indexOf(B), HELP_B, '폼 B(음성·AI 학습·필수)', 동의선택);
    else {
      form.addMultipleChoiceItem().setTitle(B).setHelpText(HELP_B)
        .setChoiceValues(동의선택).setRequired(true);
      out.push('폼 B(음성·AI 학습·필수): 추가 — 응답이 상담시트 "' + B + '" 열에 착지합니다');
    }
    if (sheetOk) setState(st, '상담동의', CONSENT_VERSION); // 워치독 감시 게이트 — 시트 열까지 성립했을 때만 적용 선언
    else out.push('⚠️ 시트 열 증분이 실패해 ' + CONSENT_VERSION + ' 선언을 보류했습니다 — 폼 문항만으로는 거부자를 못 읽습니다');
  } catch (e) { out.push('⚠️ 폼 접근 실패 — 상담폼ID/권한 확인: ' + e); }

  const report = '🔏 상담 동의 ' + CONSENT_VERSION + ' 결과\n' + out.join('\n')
    + '\n\n다음 확인: checkFormMapping ▶ — "음성동의"가 열 매핑으로 표시되면 정상입니다.'
    + (CONSENT_MN_APPROVED
      ? '\n🇲🇳 몽골어 병기: 적용됨(검수 완료 선언 — CONSENT_MN_APPROVED=true).'
      : '\n⚠️ 몽골어 병기: 번역 초안은 코드에 들어 있으나 **아직 폼에 실리지 않았습니다**(검수 대기).'
        + '\n   원어민+법률 검수를 마치면 엔진_폼리포트.js의 CONSENT_MN_APPROVED를 true로 바꾸고 이 함수를 다시 ▶ 하세요.'
        + '\n   학생이 못 읽는 동의는 효력을 다툴 수 있습니다.')
    + '\n📌 [v9.138] 용도에 「' + CONSENT_SERVICE_SCOPE + '」가 추가됐습니다(회화 앱 출시 대비 · 소급 불가라 개원 전 반영이 필수).';
  Logger.log(report);
  if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 🔏 상담폼 동의 문항(' + CONSENT_VERSION + ')', report);
  return report;
}

/* [v9.90] 음성·AI 학습 동의 현황 — 상담시트 '음성동의' 열 집계(동의/거부/미응답).
 * 녹음·AI 학습 기능이 붙기 전까지는 워치독 표기용이고, 붙은 뒤에는 같은 열이 그대로 기계 게이트가 된다
 * ('동의' 행만 녹음 대상 — 거부자를 삼키면 되돌릴 수 없다). 실패는 빈 결과로 격리한다(워치독 한 줄이 전체를 깨지 않게). */
/* [v9.104] 🔒 학생별 음성 동의 맵 — sid → 'yes' | 'no' | ''(미응답).
 *   v9.90은 이 열을 만들며 "후속 녹음 기능이 기계 게이트로 쓴다"고 적었지만, **정작 이미 존재하던
 *   목소리 레일(교재연동.js v9.59)에는 배선되지 않았다**(08-01 발견 — ROLE_TALK 미배선과 같은 계급:
 *   약속은 주석에, 배선은 없음). 그 사이 voiceSweep_는 동의 여부와 무관하게 전원의 녹음을 적재하고
 *   포인트까지 지급하고 있었다. 보관이 무기한이 되면서 이 구멍의 비용은 "영구 보관"으로 커진다.
 *   종이 동의서 학생은 상담시트 그 칸에 수기로 '네, 동의합니다'를 넣으면 그대로 통과한다.
 *   실패는 null로 격리 — 시트를 못 읽었을 때 전원 통과시키면 게이트가 침묵으로 열린다(호출부는 보류를 택한다). */
function voiceConsentMap_() {
  try {
    const consult = SpreadsheetApp.openById(CONSULT_SHEET_ID).getSheetByName('상담데이터입력');
    if (!consult) return null;
    const w = consult.getLastColumn(), lastRow = consult.getLastRow();
    if (w < 1 || lastRow < 3) return {};
    const hdr = consult.getRange(2, 1, 1, w).getValues()[0].map(h => String(h || '').trim());
    const ci = hdr.indexOf(CONSENT_EXT_HEADERS[0]);
    const si = hdr.indexOf('학생ID');
    if (ci === -1 || si === -1) return null;                 // 열 자체가 없으면 판정 불가 — 통과가 아니라 보류
    const out = {};
    consult.getRange(3, 1, lastRow - 2, w).getValues().forEach(r => {
      const sid = String(r[si] || '').trim();
      if (!sid) return;
      const v = String(r[ci] || '').trim();
      // [v9.125] 화이트리스트 판정 — 구 코드는 「'아니'로 시작하지 않으면 전부 yes」(fail-open)라
      //   수기 칸의 '거부'·'보류'·'확인중'·'X'가 모두 동의로 통과했다. 무동의 녹음은 영구 보관이라 되돌릴 수 없다.
      //   명시적 긍정만 yes, 명시적 부정만 no, 그 외 전부 ''(보류) — v9.104 원칙(판정 불가는 통과가 아니라 보류).
      out[sid] = !v ? ''
        : (v.indexOf('아니') === 0 || v.indexOf('거부') === 0 || v.indexOf('미동의') === 0) ? 'no'
        : (v.indexOf('네') === 0 || v.indexOf('동의') === 0) ? 'yes'
        : '';
    });
    return out;
  } catch (e) { Logger.log('voiceConsentMap_ 실패: ' + e); return null; }
}

function voiceConsentStat_() {
  const r = { yes: 0, no: 0, blank: 0, total: 0, ok: false };
  try {
    const consult = SpreadsheetApp.openById(CONSULT_SHEET_ID).getSheetByName('상담데이터입력');
    if (!consult) return r;
    const w = consult.getLastColumn(), lastRow = consult.getLastRow();
    if (w < 1 || lastRow < 3) return r;
    const hdr = consult.getRange(2, 1, 1, w).getValues()[0].map(h => String(h || '').trim());
    const ci = hdr.indexOf(CONSENT_EXT_HEADERS[0]);
    if (ci === -1) return r;
    const vals = consult.getRange(3, ci + 1, lastRow - 2, 1).getValues();
    vals.forEach(row => {
      const v = String(row[0] || '').trim();
      r.total++;
      if (!v) r.blank++;
      else if (v.indexOf('아니') === 0) r.no++;
      else r.yes++;
    });
    r.ok = true;
  } catch (e) { /* 격리 */ }
  return r;
}

/* [v9.151] 소급 불가 수리 ① — 동의의 행 단위 결합 (판정 정본 = memory masterplan-v3-2026-08-04).
 * 지금까지 동의 버전은 app_state 전역 1값('상담동의'=CONSENT_VERSION)뿐이라, 「이 학생이 어느 판 문구에
 * 동의했는지」가 행에 남지 않았다. v18.5(선택)→v18.9(필수)처럼 문구가 갈린 뒤에는 이미 받은 응답이 무엇에
 * 대한 동의였는지 되돌아가 알 수 없다 — 소급 불가. 그래서 응답이 **처음 관측된 날**의 정본 판을 행에 찍는다.
 *   · 스탬프는 불변 — 이미 찍힌 행은 재실행·문구 개정이 덮지 않는다(그 행의 근거는 그날의 판이다).
 *   · 가동 전부터 있던 응답에는 버전을 지어내지 않는다 — '기록전(≤현재판)'으로 정직하게 남긴다
 *     (소급 기재는 「참인 채 거짓을 말하는 코드」가 된다).
 *   · 헤더 증분 규약 = migrateConsentV186과 동일(항상 끝에만 추가 · 기존 열 위치 불변 · 숨김 상속 차단).
 *   · 발동 = syncProfiles가 매일 부른다(스스로 발화하지 않는 장치는 안 돈다). 실패는 격리 — 동기화를 못 깬다. */
function 동의버전스탬프_(consultSh) {
  try {
    const consult = consultSh || SpreadsheetApp.openById(CONSULT_SHEET_ID).getSheetByName('상담데이터입력');
    if (!consult) return;
    const w0 = consult.getLastColumn(), lastRow = consult.getLastRow();
    if (w0 < 1 || lastRow < 3) return;
    let hdr = consult.getRange(2, 1, 1, w0).getValues()[0].map(h => String(h || '').trim());
    if (hdr.indexOf(CONSENT_EXT_HEADERS[0]) === -1) return; // 음성동의 열 자체가 없으면 대상이 없다(migrateConsentV186 미실행)
    const need = ['음성동의버전', '버전확인일'];
    let wH = 0; hdr.forEach((h, i) => { if (h) wH = i + 1; });
    let col = Math.max(62, wH) + 1;
    const firstNew = col; let addedN = 0;
    need.forEach(h => {
      if (hdr.indexOf(h) !== -1) return;
      if (consult.getMaxColumns() < col) consult.insertColumnsAfter(consult.getMaxColumns(), col - consult.getMaxColumns());
      consult.getRange(2, col).setValue(h);
      addedN++; col++;
    });
    if (addedN) consult.showColumns(firstNew, addedN); // 숨김 열 옆 삽입의 숨김 상속 차단(V184 리뷰 M3와 동일)
    const w1 = consult.getLastColumn();
    hdr = consult.getRange(2, 1, 1, w1).getValues()[0].map(h => String(h || '').trim());
    const ci = hdr.indexOf(CONSENT_EXT_HEADERS[0]), vi = hdr.indexOf('음성동의버전'), di = hdr.indexOf('버전확인일');
    if (ci === -1 || vi === -1 || di === -1) return;
    const st = ensureSheet(SpreadsheetApp.getActiveSpreadsheet(), 'app_state', ['key', 'value']);
    const first = String(getState(st, '동의스탬프_가동').val || '') === '';
    const ver = first ? '기록전(≤' + CONSENT_VERSION + ')' : CONSENT_VERSION;
    const today = Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    const rows = consult.getRange(3, 1, lastRow - 2, w1).getValues();
    let stamped = 0;
    rows.forEach((r, i) => {
      if (!String(r[ci] || '').trim()) return; // 무응답은 찍지 않는다 — 응답이 생기는 날, 그날의 판이 찍힌다
      if (String(r[vi] || '').trim()) return;  // 이미 찍힘 — 불변
      consult.getRange(i + 3, vi + 1).setValue(ver);
      consult.getRange(i + 3, di + 1).setValue(today);
      stamped++;
    });
    if (first) setState(st, '동의스탬프_가동', today);
    if (stamped) Logger.log('동의버전스탬프_: ' + stamped + '행 — ' + ver);
  } catch (e) { Logger.log('동의버전스탬프_ 실패(격리 — 동기화는 계속): ' + e); }
}

// [v9.33] 콜드 광고 트래픽용 미니 리드폼 — 이름·연락처·인지채널·관심과정 4문항. 68문항(v18.4) 온보딩 상담폼(createConsultForm)과 완전 별개(그 폼은 건드리지 않음).
//         광고 CTA는 이 폼만 연결. 응답은 이 스프레드시트의 '리드폼_응답' 시트로 떨어지며, 원장이 이름·연락처·인지채널(→유입경로)을 leads 시트로 수기 이관.
function createLeadForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const before = ss.getSheets().map(s => s.getName()); // setDestination이 새로 만드는 응답 시트를 식별하기 위한 스냅샷

  const form = FormApp.create('SYNK LAB 상담 신청')
    .setDescription('SYNK LAB에 관심 가져주셔서 감사합니다! 아래 4가지만 남겨주시면 크루가 곧 연락드립니다 🙂')
    .setCollectEmail(false);
  setState(ensureSheet(ss, 'app_state', ['key', 'value']), '리드폼ID', form.getId()); // [v9.94] 생성 즉시 기록 — 뒤 단계(응답 시트 연결)에서 타임아웃돼도 앱이 이 폼을 잃지 않는다

  function txt(t, req) { const i = form.addTextItem().setTitle(t); if (req) i.setRequired(true); return i; }
  function mc(t, opts, req) { const i = form.addMultipleChoiceItem().setTitle(t).setChoiceValues(opts); if (req) i.setRequired(true); return i; }

  txt('이름', true);
  txt('연락처', true).setHelpText('페이스북 메신저 · 전화번호 등 편하신 방법');
  mc('인지채널', ['페이스북', '인스타', '틱톡', '추천', '오픈데이', '학교제휴', '워크인', '기타'], true).setHelpText('SYNK를 어디서 알게 되셨나요? (leads 유입경로와 동일 분류)');
  mc('관심 과정', ['정규TOPIK', '회화', '영어', '미정'], true);

  // 응답을 이 스프레드시트에 연결하고 시트명을 '리드폼_응답'으로 명시(leads로 수기 이관 편의). 이미 있으면 날짜 접미사로 충돌 회피(재실행 안전).
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  const created = ss.getSheets().find(s => before.indexOf(s.getName()) === -1);
  if (created) {
    const tz = ss.getSpreadsheetTimeZone();
    created.setName(ss.getSheetByName('리드폼_응답') ? '리드폼_응답_' + Utilities.formatDate(new Date(), tz, 'MMdd_HHmm') : '리드폼_응답');
  }

  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  setState(st, '리드폼ID', form.getId());
  Logger.log('✅ 미니 리드폼 생성 완료!');
  Logger.log('광고 랜딩용(공개 URL — 광고 CTA/프로필 링크에 이 주소): ' + form.getPublishedUrl());
  Logger.log('편집용: ' + form.getEditUrl());
  Logger.log('응답 시트: "리드폼_응답" — 이름·연락처·인지채널(→leads 유입경로)·관심 과정(→leads 메모)을 leads 시트로 옮기세요.');
}

/* ===================== [v9.49] 출석 폼 · 숙제 제출 폼 (1회 실행) ===================== */
// 공용: 폼 응답을 이 스프레드시트에 연결하고 응답 탭 이름을 지정(createLeadForm 패턴 — 재실행 시 날짜 접미사로 충돌 회피)
function linkFormTab_(ss, before, tabName) {
  SpreadsheetApp.flush();
  const created = ss.getSheets().find(s => before.indexOf(s.getName()) === -1);
  if (created) {
    const tz = ss.getSpreadsheetTimeZone();
    created.setName(ss.getSheetByName(tabName) ? tabName + '_' + Utilities.formatDate(new Date(), tz, 'MMdd_HHmm') : tabName);
  }
}
// 공용: 학생ID 문항의 미리채움 URL 틀 — SIDTOKEN 자리에 학생ID를 치환해 학생별 원터치 링크를 만든다(writeSharedCols_).
function prefillTemplateOf_(form, itemTitle) {
  const it = form.getItems().find(i => i.getTitle() === itemTitle);
  return form.createResponse().withItemResponse(it.asTextItem().createResponse('SIDTOKEN')).toPrefilledUrl();
}

// [v9.62] 폼 생성 재실행 가드 — 이미 만들어졌으면 새로 만들지 않는다. 두 번 눌러도 안전해야 하는 이유:
//   linkFormTab_이 이름 충돌을 날짜 접미사로 피해주므로 예외는 안 나지만, 재실행마다 **중복 폼 + 유령 응답 시트**가
//   쌓이고 URL 틀이 새 폼으로 갈아끼워져 이미 배포한 링크가 죽는다(v9.60 레벨테스트 실사고와 같은 계급).
//   응답 시트는 있는데 app_state 키만 없으면(사람이 지웠거나 부분 실패) 연결된 폼에서 틀을 되찾아 복구한다.
function formAlreadyMade_(ss, tabName, urlKey, idKey, itemTitle, label) {
  const sh = ss.getSheetByName(tabName);
  if (!sh) return '';
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  let tpl = '';
  try { tpl = String((getState(st, urlKey) || {}).val || '').trim(); } catch (e) {}
  if (!tpl) {
    try {
      const editUrl = sh.getFormUrl();
      if (editUrl) {
        const f = FormApp.openByUrl(editUrl);
        setState(st, idKey, f.getId());
        tpl = prefillTemplateOf_(f, itemTitle);
        setState(st, urlKey, tpl);
        Logger.log(label + ' — URL 틀이 없어 연결된 폼에서 복구했습니다.');
      }
    } catch (e2) { Logger.log(label + ' URL 틀 복구 실패(새로 만듭니다): ' + e2.message); }
  }
  if (!tpl) return ''; // 복구 불가 → 호출부가 정상 생성 경로로 진행
  const msg = '✅ ' + label + ' — 이미 준비돼 있어 새로 만들지 않았습니다. 다음 calcAll(14/22시)이 학생별 링크를 채웁니다.';
  Logger.log(msg);
  return msg;
}

// [v9.49] 출석 폼 — 앱(Glide) 출석의 update-0 대체(docs/glide_업데이트_실측설계.md §3: 앱 출석은 30명 기준 월 ~600 update로 단독 초과).
//   학생 경험: 앱의 [출석] 버튼(Open Link → CX102 출석폼URL, ID 미리채움) → 폼에서 [보내기] 1탭.
//   응답은 '출석폼_응답' 탭 → parentSweep(10분)의 sweepAttendanceForm_가 attendance로 전개 → 알림·보드·달력 기존 그대로.
function createAttendanceForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const doneA = formAlreadyMade_(ss, '출석폼_응답', '출석폼URL틀', '출석폼ID', '학생ID', '출석 폼'); // [v9.62] 두 번 눌러도 안전
  if (doneA) return doneA;
  const before = ss.getSheets().map(s => s.getName());
  const form = FormApp.create('SYNK 출석 체크')
    .setDescription('Ирц бүртгэл ✅ 아래 [보내기]만 누르면 출석 완료!')
    .setCollectEmail(false);
  setState(ensureSheet(ss, 'app_state', ['key', 'value']), '출석폼ID', form.getId()); // [v9.94] 생성 즉시 기록 — 뒤 단계(응답 시트 연결)에서 타임아웃돼도 앱이 이 폼을 잃지 않는다
  form.addTextItem().setTitle('학생ID').setRequired(true).setHelpText('앱에서 열었다면 자동으로 채워져 있어요 — 그대로 [보내기]!');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  linkFormTab_(ss, before, '출석폼_응답');
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  setState(st, '출석폼ID', form.getId());
  setState(st, '출석폼URL틀', prefillTemplateOf_(form, '학생ID'));
  Logger.log('✅ 출석 폼 생성 완료! 다음 calcAll(14/22시)부터 profiles CX102(출석폼URL)에 학생별 링크가 채워집니다.');
  Logger.log('편집용: ' + form.getEditUrl());
}

// [v9.49] 숙제 제출 폼 — AI 첨삭의 입력 통로. 앱 제출(행 추가)이 아닌 폼이라 Glide update 0.
//   응답은 '숙제폼_응답' 탭 → 밤 22시 aiFeedbackBatch_가 Claude API로 첨삭 카드 생성.
function createHwForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const doneH = formAlreadyMade_(ss, '숙제폼_응답', '숙제폼URL틀', '숙제폼ID', '학생ID', '숙제 제출 폼'); // [v9.62] 두 번 눌러도 안전
  if (doneH) return doneH;
  const before = ss.getSheets().map(s => s.getName());
  const form = FormApp.create('SYNK 숙제 제출')
    .setDescription('오늘 숙제로 쓴 한국어 문장을 보내면, 내일 아침 앱에 첨삭 카드가 도착해요 🤖✏️')
    .setCollectEmail(false);
  setState(ensureSheet(ss, 'app_state', ['key', 'value']), '숙제폼ID', form.getId()); // [v9.94] 생성 즉시 기록 — 뒤 단계(응답 시트 연결)에서 타임아웃돼도 앱이 이 폼을 잃지 않는다
  form.addTextItem().setTitle('학생ID').setRequired(true).setHelpText('앱에서 열었다면 자동으로 채워져 있어요');
  form.addParagraphTextItem().setTitle('숙제 문장').setRequired(true).setHelpText('오늘 숙제로 쓴 한국어 문장을 그대로 적어주세요 (여러 문장 가능)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  linkFormTab_(ss, before, '숙제폼_응답');
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  setState(st, '숙제폼ID', form.getId());
  setState(st, '숙제폼URL틀', prefillTemplateOf_(form, '학생ID'));
  Logger.log('✅ 숙제 제출 폼 생성 완료! 다음 calcAll부터 profiles CY103(숙제폼URL)에 학생별 링크가 채워집니다.');
  Logger.log('⚠️ AI 첨삭이 돌려면 Script Properties에 CLAUDE_API_KEY가 있어야 합니다(없으면 배치가 조용히 스킵).');
  Logger.log('편집용: ' + form.getEditUrl());
}

// [v9.55] 강사 연습 포인트(약점 메모) 폼 — student_errors의 입력 레일. 읽기(반 브리핑·수업 전 메일·AI 약점 로더)는
//   v9.47·v9.50에 기배선인데 쓰기 경로가 시트 수기뿐이던 것을 폼 1분 입력으로. Glide update 0.
//   [v9.64] 스마트화 — 폼 스펙의 정본은 아래 코드이고 실제 폼은 여기에 동기화된다(URL·응답 열 불변):
//   ①재실행 = 복제가 아니라 제자리 업그레이드(제목·안내·유형 선택지·강사/반 드롭다운) — 중복 폼·링크 사망 사고 차단
//   ②morningJobs가 매일 로스터 변화를 드롭다운에 반영(개원 때 반 16개·강사 6인이 돼도 사람 손 0)
//   ③항목 추가·삭제는 절대 안 한다 — 응답 시트가 항목별 열이라, 지웠다 다시 만들면 새 열이 생겨
//     sweep의 위치 파싱(1~6열)이 깨진다. 제목·안내·선택지 교체는 열을 보존한다(실측 안전).
const TEACHER_MEMO_TYPES = ['문법', '어휘', '발음', '말하기', '듣기', '읽기', '쓰기', '태도', '기타']; // [v9.64] 말하기·읽기 편입 — 코어=문법·톡=회화 커리큘럼 축 정합
function teacherMemoSpec_(ss) { // 폼 문안 정본 — 생성·업그레이드·아침 동기화가 전부 이것만 읽는다
  const pf = ss.getSheetByName('profiles');
  const teachers = [], clsSet = {};
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
    if (!r[0]) return;
    if (r[3] === 'teacher' && r[1]) teachers.push(String(r[1]));
    if (r[3] === 'student' && r[4]) clsSet[String(r[4])] = 1;
  });
  return {
    title: 'SYNK 연습 포인트 (강사용)',
    desc: '수업 중 보인 학생의 연습 포인트(막히는 지점·발전 지점)를 30초로 남겨주세요. 다음 계산부터 반 브리핑·수업 전 메일에 뜨고, AI가 그 학생 맞춤 퀴즈·예문으로 이어서 연습시킵니다. 같은 포인트가 반복되면 ×N으로 표시돼 패턴이 보입니다.',
    teachers: teachers.concat(['기타']),
    classes: Object.keys(clsSet).sort().concat(['기타']),
    help: {
      '학생 이름': '앱 프로필의 한글 이름 그대로 (동명이인이면 반을 정확히) · 여러 명이면 한 명씩 따로 — 학생별 맞춤이 정확해집니다',
      '유형': '가장 가까운 것 하나 — AI가 이 유형으로 맞춤 연습을 만듭니다',
      '메모': "'무엇을 + 어떤 상황에서' 한 줄이면 충분해요. 예: 은/는 vs 이/가 혼동 — 주어 자리에서 반복 / 받침 ㄹ 과잉적용(살아요→사라요)"
    }
  };
}
// 실제 폼을 스펙에 제자리 동기화 — 다른 곳만 쓴다(반환 = 바꾼 곳 수). 폼이 아예 없으면 -1(호출부가 생성 경로로).
function syncTeacherMemoForm_(ss, st) {
  let formId = '';
  try { formId = String((getState(st, '약점메모폼ID') || {}).val || '').trim(); } catch (eS) {}
  if (!formId) { // ID 유실 시 응답 시트의 연결 폼에서 복구(v9.62 formAlreadyMade_ 패턴)
    try {
      const shR = ss.getSheetByName('약점메모폼_응답');
      const editUrl = shR && shR.getFormUrl();
      if (editUrl) { const f0 = FormApp.openByUrl(editUrl); formId = f0.getId(); setState(st, '약점메모폼ID', formId); setState(st, '약점메모폼URL', f0.getPublishedUrl()); }
    } catch (eR) {}
  }
  if (!formId) return -1;
  const form = FormApp.openById(formId);
  const spec = teacherMemoSpec_(ss);
  let changed = 0;
  if (form.getTitle() !== spec.title) { form.setTitle(spec.title); changed++; }
  if (form.getDescription() !== spec.desc) { form.setDescription(spec.desc); changed++; }
  form.getItems().forEach(it => {
    const t = it.getTitle();
    const wantHelp = spec.help[t];
    if (wantHelp !== undefined && it.getHelpText() !== wantHelp) { it.setHelpText(wantHelp); changed++; }
    if (it.getType() !== FormApp.ItemType.LIST) return;
    const li = it.asListItem();
    const cur = li.getChoices().map(c => c.getValue()).join('|');
    const want = (t === '강사' ? spec.teachers : t === '반' ? spec.classes : t === '유형' ? TEACHER_MEMO_TYPES : null);
    if (want && cur !== want.join('|')) { li.setChoiceValues(want); changed++; }
  });
  if (changed) Logger.log('🧩 연습 포인트 폼 동기화 — ' + changed + '곳 갱신(URL 불변)');
  return changed;
}
function createTeacherMemoForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const synced = syncTeacherMemoForm_(ss, st); // [v9.64] 이미 있으면 복제 대신 제자리 업그레이드
  if (synced >= 0) {
    const msg = '✅ 연습 포인트 폼 — 이미 있어 제자리 업그레이드만 했습니다(' + synced + '곳 갱신 · URL 불변): ' + String((getState(st, '약점메모폼URL') || {}).val || '');
    Logger.log(msg);
    return msg;
  }
  const before = ss.getSheets().map(s => s.getName());
  const spec = teacherMemoSpec_(ss);
  const form = FormApp.create(spec.title).setDescription(spec.desc).setCollectEmail(false);
  setState(ensureSheet(ss, 'app_state', ['key', 'value']), '약점메모폼ID', form.getId()); // [v9.94] 생성 즉시 기록 — 뒤 단계(응답 시트 연결)에서 타임아웃돼도 앱이 이 폼을 잃지 않는다
  if (spec.teachers.length > 1) form.addListItem().setTitle('강사').setRequired(true).setChoiceValues(spec.teachers);
  else form.addTextItem().setTitle('강사').setRequired(true); // 로스터에 강사 0명(재건 직후)이어도 폼은 성립
  if (spec.classes.length > 1) form.addListItem().setTitle('반').setRequired(true).setChoiceValues(spec.classes);
  else form.addTextItem().setTitle('반').setRequired(true);
  form.addTextItem().setTitle('학생 이름').setRequired(true).setHelpText(spec.help['학생 이름']);
  form.addListItem().setTitle('유형').setRequired(true).setChoiceValues(TEACHER_MEMO_TYPES).setHelpText(spec.help['유형']);
  form.addParagraphTextItem().setTitle('메모').setRequired(true).setHelpText(spec.help['메모']);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  linkFormTab_(ss, before, '약점메모폼_응답');
  setState(st, '약점메모폼ID', form.getId());
  setState(st, '약점메모폼URL', form.getPublishedUrl());
  adminMail('[SYNK] 🧩 연습 포인트 폼 생성 완료',
    '강사 단톡·즐겨찾기에 배포할 링크:\n' + form.getPublishedUrl() +
    '\n\nGlide 수업 준비 탭의 버튼(Open Link)에도 이 URL을 넣으면 됩니다.\n편집용: ' + form.getEditUrl() +
    '\n\n※ 재실행해도 안전합니다(제자리 업그레이드 · URL 불변). 반·강사가 바뀌면 다음 날 아침 드롭다운이 자동 갱신됩니다.');
  Logger.log('✅ 연습 포인트 폼 생성 완료: ' + form.getPublishedUrl());
  Logger.log('편집용: ' + form.getEditUrl());
}

/* ── [v9.74] 📊 학업 기록 폼 — "시트에 직접 입력하세요" 안내문의 대체 ──
 * 유호 07-28 보고: 수업준비 탭의 '직접 입력하는 기록'이 어떻게 하라는 건지 알 수 없다 → 버튼 하나로.
 * 구글 폼 경로라 Glide 업데이트 소비 0(약점 메모 폼 v9.55·v9.64 계보 그대로: 제자리 업그레이드·아침 로스터 동기화).
 * 응답은 parentSweep(10분)의 sweepAcademicForm_이 academic_log로 전개(값 검증·이름→sid 매칭·AL 채번). */
const ACADEMIC_TYPES = ['급수 (1~6)', '모의점수 (0~100)'];
function academicFormSpec_(ss) {
  const base = teacherMemoSpec_(ss); // 강사·반 로스터 재사용 — 아침 동기화도 같은 원천을 본다
  return {
    title: 'SYNK 학업 기록 (강사용 · 월 1회)',
    desc: '급수 인증·모의고사 결과를 남기면 학생 홈의 학업 추세 차트·월간 리포트에 자동 반영됩니다. 학생 1명당 1건씩 제출해 주세요.',
    teachers: base.teachers,
    classes: base.classes,
    help: {
      '학생 이름': '앱 프로필의 한글 이름 그대로 (동명이인이면 반을 정확히)',
      '유형': '급수 = TOPIK/자체 급수(1~6) · 모의점수 = 모의고사 점수(0~100)',
      '값': '숫자만 — 급수는 1~6, 모의점수는 0~100 (예: 3 또는 62)',
      '비고': '예: 7월 모의 · 3급 인증 (선택)'
    }
  };
}
// 실제 폼을 스펙에 제자리 동기화 — 반환 = 바꾼 곳 수, 폼이 아예 없으면 -1(호출부가 생성 경로로). syncTeacherMemoForm_와 동형.
function syncAcademicForm_(ss, st) {
  let formId = '';
  try { formId = String((getState(st, '학업폼ID') || {}).val || '').trim(); } catch (eS) {}
  if (!formId) { // ID 유실 시 응답 시트의 연결 폼에서 복구(v9.62 formAlreadyMade_ 패턴)
    try {
      const shR = ss.getSheetByName('학업폼_응답');
      const editUrl = shR && shR.getFormUrl();
      if (editUrl) { const f0 = FormApp.openByUrl(editUrl); formId = f0.getId(); setState(st, '학업폼ID', formId); setState(st, '학업폼URL', f0.getPublishedUrl()); }
    } catch (eR) {}
  }
  if (!formId) return -1;
  const form = FormApp.openById(formId);
  const spec = academicFormSpec_(ss);
  let changed = 0;
  if (form.getTitle() !== spec.title) { form.setTitle(spec.title); changed++; }
  if (form.getDescription() !== spec.desc) { form.setDescription(spec.desc); changed++; }
  form.getItems().forEach(it => {
    const t = it.getTitle();
    const wantHelp = spec.help[t];
    if (wantHelp !== undefined && it.getHelpText() !== wantHelp) { it.setHelpText(wantHelp); changed++; }
    if (it.getType() !== FormApp.ItemType.LIST) return;
    const li = it.asListItem();
    const cur = li.getChoices().map(c => c.getValue()).join('|');
    const want = (t === '강사' ? spec.teachers : t === '반' ? spec.classes : t === '유형' ? ACADEMIC_TYPES : null);
    if (want && cur !== want.join('|')) { li.setChoiceValues(want); changed++; }
  });
  if (changed) Logger.log('📊 학업 기록 폼 동기화 — ' + changed + '곳 갱신(URL 불변)');
  return changed;
}
function createAcademicForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const synced = syncAcademicForm_(ss, st); // 이미 있으면 복제 대신 제자리 업그레이드(재실행 안전)
  if (synced >= 0) {
    const msg = '✅ 학업 기록 폼 — 이미 있어 제자리 업그레이드만 했습니다(' + synced + '곳 갱신 · URL 불변): ' + String((getState(st, '학업폼URL') || {}).val || '');
    Logger.log(msg);
    return msg;
  }
  const before = ss.getSheets().map(s => s.getName());
  const spec = academicFormSpec_(ss);
  const form = FormApp.create(spec.title).setDescription(spec.desc).setCollectEmail(false);
  setState(ensureSheet(ss, 'app_state', ['key', 'value']), '학업폼ID', form.getId()); // [v9.94] 생성 즉시 기록 — 뒤 단계(응답 시트 연결)에서 타임아웃돼도 앱이 이 폼을 잃지 않는다
  if (spec.teachers.length > 1) form.addListItem().setTitle('강사').setRequired(true).setChoiceValues(spec.teachers);
  else form.addTextItem().setTitle('강사').setRequired(true); // 로스터에 강사 0명(재건 직후)이어도 폼은 성립
  if (spec.classes.length > 1) form.addListItem().setTitle('반').setRequired(true).setChoiceValues(spec.classes);
  else form.addTextItem().setTitle('반').setRequired(true);
  form.addTextItem().setTitle('학생 이름').setRequired(true).setHelpText(spec.help['학생 이름']);
  form.addListItem().setTitle('유형').setRequired(true).setChoiceValues(ACADEMIC_TYPES).setHelpText(spec.help['유형']);
  form.addTextItem().setTitle('값').setRequired(true).setHelpText(spec.help['값']);
  form.addTextItem().setTitle('비고').setHelpText(spec.help['비고']);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  linkFormTab_(ss, before, '학업폼_응답');
  setState(st, '학업폼ID', form.getId());
  setState(st, '학업폼URL', form.getPublishedUrl());
  adminMail('[SYNK] 📊 학업 기록 폼 생성 완료',
    '강사 단톡·즐겨찾기에 배포할 링크:\n' + form.getPublishedUrl() +
    '\n\n다음 계산(14/22시, 즉시 원하면 calcAll ▶)부터 강사 수업준비 탭의 📊 버튼에 자동으로 연결됩니다.\n편집용: ' + form.getEditUrl() +
    '\n\n※ 재실행해도 안전합니다(제자리 업그레이드 · URL 불변). 반·강사가 바뀌면 다음 날 아침 드롭다운이 자동 갱신됩니다.');
  Logger.log('✅ 학업 기록 폼 생성 완료: ' + form.getPublishedUrl());
  Logger.log('편집용: ' + form.getEditUrl());
}

/* ── [v9.90·206] 🛂 면접 기록 회수 폼 — VR/AR 면접 시뮬레이터의 0단계 ──
 * 유호 07-31 지시: 비자·취업 면접을 가상현실로 체험시키는 앱을 만든다 → 그 앱의 승부처는 렌더링이 아니라
 * '질문 은행과 채점 기준'이고, 몽골 현지의 실제 질문·재질문·거절 사유는 검색으로 안 나온다. 실제로 면접을 본
 * 사람(졸업생·지원자·재학생)에게서만 나오며 그들을 가진 곳은 학원뿐 = 복제 불가 자산. 헤드셋보다 먼저, 비용 0으로 시작한다.
 * 설계: ① 구글 폼이라 Glide update 소비 0(약점 메모·학업 기록 폼 계보) ② 이름·연락처는 선택 —
 * 익명으로도 남길 수 있어야 회수율이 산다(거절 경험은 특히 밝히기 싫은 정보다) ③ 마지막 문항 = 자료 활용 동의로
 * 필수·거부 가능 — 동의 없이 모은 기록은 후배 연습 자료로도 AI 학습으로도 못 쓴다(소급 불가, migrateConsentV186과 같은 계열)
 * ④ 핵심 칸은 9·11번 — '받은 질문 전부'와 '심사관이 다시 물은 것'. 이 둘이 시뮬레이터의 질문 은행과 모순 탐지 채점표가 된다. */
const INTERVIEW_KINDS = ['한국 유학 비자 인터뷰', 'EPS 취업(E-9) 면접·시험', '한국 기업 취업 면접', '한국 대학·대학원 입학 면접', '한국 방문·기타 비자 인터뷰', '기타'];

/* ── 궤적 연결 고리 — 로드맵 ④(유학 집약 봇)의 재료 ────────────────────────
 * 2026-08-04 대조에서 나온 것: **의도와 결과가 둘 다 쌓이는데 안 이어진다.**
 *   의도 = 크루카드 100+문항(졸업후진로·희망진학과정·비자목표 7종·전공관심 7종) → 상담시트
 *   결과 = 이 면접폼의 「결과(합격·승인/불합격·거절/…)」
 *   그런데 이 폼은 익명이라(이름 선택·setCollectEmail(false)) 둘을 한 사람으로 묶을 키가 없다.
 *   궤적은 「A를 목표한 사람이 실제로 B로 갔다」일 때만 생긴다 — 두 더미로는 안 만들어진다.
 *
 * 🔑 그래서 **필수가 아니라 선택**이다. 익명은 실수가 아니라 값을 하는 설계다 —
 *   이 폼의 1순위 자산은 질문 은행이고(memory vr-interview-sim), 거절 경험은 특히 밝히기 싫은
 *   정보라 실명 강제는 회수율을 깎는다. 적은 사람은 궤적이 되고, 안 적은 사람은 지금처럼
 *   질문 은행에 그대로 기여한다 — 1순위 자산에 비용 0으로 ④의 문만 연다.
 *
 * ⚠ 소급 불가는 「문항」이 아니라 「연결」이었다. 문항은 이미 다 받고 있었고(내 옛 전제가 틀렸다),
 *   지금 키를 안 심으면 **이미 들어온 기록은 영원히 못 잇는다.**
 *
 * 제목은 상담시트 60열 헤더와 같은 '학생ID' — 조인 키라 어긋나면 연결이 통째로 죽는다.
 * 생성부와 마이그레이션 **두 곳이 이 상수를 본다**(두 곳에 적으면 갈라진다 · CONSENT_Q_TITLE과 같은 이유). */
const INTERVIEW_SID_TITLE = '학생ID';
const INTERVIEW_SID_HELP = 'SYNK-001 형식입니다. 모르거나 밝히고 싶지 않으면 비워두세요 — 익명 그대로 접수되고, 자료로도 똑같이 쓰입니다.';
function createInterviewLogForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  // 재실행 안전 — 배포된 링크·QR가 미아가 되지 않도록 살아 있는 폼은 절대 새로 만들지 않는다(createConsultForm 리뷰 M1과 동일 계급).
  let exId = String(getState(st, '면접폼ID').val || '');
  if (!exId) { // ID만 유실된 경우(시트 수기 편집·app_state 정리) 응답 탭의 연결 폼에서 복구 — 없으면 중복 폼이 생기고 회수가 두 곳으로 갈린다(syncAcademicForm_ 패턴)
    try {
      const shR = ss.getSheetByName('면접기록_응답');
      const editUrl = shR && shR.getFormUrl();
      if (editUrl) {
        const f0 = FormApp.openByUrl(editUrl);
        exId = f0.getId();
        setState(st, '면접폼ID', exId);
        setState(st, '면접폼URL', f0.getPublishedUrl());
        Logger.log('면접 기록 폼 — ID가 없어 응답 탭의 연결 폼에서 복구했습니다.');
      }
    } catch (eR) { /* 복구 실패 → 아래 정상 생성 경로 */ }
  }
  if (exId) {
    try {
      const exForm = FormApp.openById(exId);
      const msg0 = '✅ 면접 기록 폼이 이미 있어 새로 만들지 않았습니다.\n배포 링크: ' + exForm.getPublishedUrl();
      Logger.log(msg0);
      return msg0;
    } catch (eG) {
      const msgG = '⚠️ 연결된 면접폼ID를 열지 못했습니다(' + eG + ').\n일시 오류일 수 있어 새 폼을 만들지 않았습니다 — 폼이 정말 삭제됐으면 app_state에서 면접폼ID 행을 지운 뒤 재실행하세요.';
      Logger.log(msgG);
      return msgG;
    }
  }
  const before = ss.getSheets().map(s => s.getName());
  const form = FormApp.create('SYNK 면접 경험 기록 (비자 · 취업)')
    .setDescription('한국 유학 비자나 취업 면접을 실제로 보신 경험을 남겨주세요.\n'
      + '여기 쌓인 질문들이 다음 크루가 연습할 실제 문제가 됩니다 — 합격이든 거절이든, 거절 경험이 오히려 더 큰 도움이 됩니다.\n'
      + '이름은 적지 않으셔도 됩니다. 10분이면 충분합니다 🙂')
    .setCollectEmail(false);

  function txt(t, req, help) { const i = form.addTextItem().setTitle(t); if (req) i.setRequired(true); if (help) i.setHelpText(help); return i; }
  function para(t, req, help) { const i = form.addParagraphTextItem().setTitle(t); if (req) i.setRequired(true); if (help) i.setHelpText(help); return i; }
  function mc(t, opts, req, help) { const i = form.addMultipleChoiceItem().setTitle(t).setChoiceValues(opts); if (req) i.setRequired(true); if (help) i.setHelpText(help); return i; }

  form.addSectionHeaderItem().setTitle('1. 누구의 경험인가요').setHelpText('이 부분은 전부 선택입니다 — 익명으로 남기셔도 자료로 잘 쓰입니다.');
  txt('이름', false, '익명을 원하시면 비워두세요');
  txt(INTERVIEW_SID_TITLE, false, INTERVIEW_SID_HELP); // 궤적 조인 키 — 선택. 라이브 폼은 migrateInterviewSid 가 같은 자리에 넣는다
  mc('지금 신분', ['재학생', '졸업생', '학부모·지인', '기타'], false);
  txt('연락처', false, '내용을 더 여쭤봐도 될 때만 남겨주세요');

  form.addSectionHeaderItem().setTitle('2. 어떤 면접이었나요');
  mc('면접 종류', INTERVIEW_KINDS, true);
  txt('시기', true, '예: 2026-05 (연-월만 적어주세요)');
  txt('장소·기관', false, '예: 주몽골 대한민국 대사관 / ○○ 회사');
  mc('사용 언어', ['한국어', '몽골어', '영어', '섞어서'], false);
  mc('걸린 시간', ['5분 미만', '5~15분', '15~30분', '30분 이상'], false);

  form.addSectionHeaderItem().setTitle('3. 실제로 무슨 일이 있었나요')
    .setHelpText('여기가 가장 중요합니다. 문장이 어색해도 괜찮으니 기억나는 대로 많이 적어주세요.');
  para('받은 질문 전부', true, '순서대로, 짧게라도 전부 적어주세요. 이 칸이 다음 크루의 연습 문제가 됩니다.');
  para('어떻게 답했나요', false, '기억나는 답변을 그대로 (잘 답한 것도, 못 답한 것도)');
  para('다시 물어보거나 서류를 지적한 부분', false, '심사관이 한 번 더 캐물은 것 · 서류와 말이 다르다고 지적한 것 — 합격과 거절을 가르는 지점입니다');
  para('준비하면서 가장 어려웠던 것', false);

  form.addSectionHeaderItem().setTitle('4. 결과');
  mc('결과', ['합격·승인', '불합격·거절', '추가 서류 요청·보류', '아직 기다리는 중'], true);
  para('거절·보류였다면 들은 사유', false, '들은 그대로 (사유를 안 알려준 경우 "안 알려줌"이라고 적어주세요)');
  para('다음 사람에게 한마디', false);

  form.addSectionHeaderItem().setTitle('5. 자료 활용 동의');
  mc('자료활용동의', ['네, 동의합니다', '아니요, 원하지 않습니다'], true,
    '이 기록을 ① 후배 크루의 면접 연습 자료 ② 면접 연습 AI의 학습 자료로 쓰는 것에 동의하시나요?\n'
    + '이름·연락처는 연습 자료에 절대 포함하지 않습니다(질문과 상황만 씁니다). '
    + '"아니요"를 고르셔도 기록은 감사히 받고, 연습 자료로는 쓰지 않습니다 · 철회는 언제든 학원으로 연락 주세요.');

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  linkFormTab_(ss, before, '면접기록_응답');
  setState(st, '면접폼ID', form.getId());
  setState(st, '면접폼URL', form.getPublishedUrl());
  면접URL틀보증_(st, form); // [v9.180] 개인 링크 틀 — 새 폼도 만든 그 자리에서 갖는다(뒤에 따로 눌러야 하면 안 눌린다)
  adminMail('[SYNK] 🛂 면접 기록 폼 생성 완료',
    '배포 링크(공개·익명):\n' + form.getPublishedUrl() +
    '\n\n같은 폼의 개인 링크(학생ID 미리채움)는 시트 메뉴 「🔗 면접폼 개인 링크 만들기」에서 만듭니다 —\n' +
    '신원을 이미 아는 분(개별 연락하는 졸업생·상담 자리·테스트 고객)에게만 보내세요.\n' +
    '\n어디에 뿌리면 좋은지:\n' +
    '① 졸업생·수료생 단톡·페이스북 그룹 (가장 회수율이 높은 곳)\n' +
    '② 상담 온 학생 중 "비자 인터뷰 봤다"는 사람 — 상담 자리에서 QR로\n' +
    '③ 재학생 중 유학·취업 지원 예정자 — 다녀온 직후에 부탁하면 기억이 살아 있습니다\n\n' +
    '⚠️ 몽골어 병기는 아직 없습니다 — 졸업생 대상이면 원어민 검수 후 문항에 병기하는 것이 회수율에 직결됩니다.\n' +
    '편집용: ' + form.getEditUrl());
  Logger.log('✅ 면접 기록 폼 생성 완료: ' + form.getPublishedUrl());
  return '✅ 면접 기록 폼 생성 완료: ' + form.getPublishedUrl();
}

/* ── 🔗 궤적 연결 고리 증분 — 라이브 면접폼에 학생ID 1칸 (멱등) ──────────────
 * 왜 **별도 함수**인가: createInterviewLogForm 은 살아 있는 폼을 절대 건드리지 않는다
 *   (배포된 링크·QR가 미아가 되면 안 되므로 — 그 판단은 옳다). 그래서 생성부만 고치면
 *   이미 선 폼에는 **영원히 안 닿는다.** 「장치와 그 발동 조건은 같은 커밋에서」(CLAUDE.md) —
 *   발동은 시트 메뉴 「🔗 면접폼 학생ID 칸 넣기」(menuMigrateInterviewSid · v9.141 계보).
 *
 * ⚠ 위치를 옮기는 이유: addTextItem 은 **폼 맨 끝**에 붙는다. 그대로 두면 「5. 자료 활용 동의」
 *   뒤에 학생ID가 오는 순서가 된다. 1번 섹션 「이름」 바로 뒤로 옮긴다.
 * ⚠ 문항을 끼워 넣으면 응답 시트에 열이 생긴다 — 안전한지 실측했다: 면접기록_응답을 읽는 곳은
 *   엔진_콘텐츠AI 의 회수량 집계 하나뿐이고 **getLastRow()만 쓴다**(열 위치 파싱 없음).
 *   결석 폼처럼 위치로 파싱하는 폼이었다면 이 증분은 금지였다(그 파일 주석의 경고).
 * ⚠ 기존 응답 행은 손대지 않는다 — 새 열은 빈칸으로 남고, 그게 정확하다(그때는 안 물었다). */
function migrateInterviewSid() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const fid = String(getState(st, '면접폼ID').val || '');
  if (!fid) { const m = '⚠️ 면접폼ID 미연결 — 먼저 「🛂 면접 기록 폼 만들기」를 실행하세요(새로 만들면 학생ID 칸이 처음부터 들어갑니다).'; Logger.log(m); return m; }

  let form;
  try { form = FormApp.openById(fid); }
  catch (e) { const m = '⚠️ 면접폼을 열지 못했습니다(' + e + ') — 폼 삭제·권한을 확인하세요. 새 폼을 만들지 않았습니다.'; Logger.log(m); return m; }

  const items = form.getItems();
  const titles = items.map(x => String(x.getTitle()).trim());
  const at = titles.indexOf(INTERVIEW_SID_TITLE);

  if (at !== -1) {
    /* 이미 있음 — 제목만 보고 스킵하면 문구 개정이 라이브에 영원히 안 닿는다(v9.103과 같은 구멍).
     * 🔑 필수 여부도 본다: 이 칸이 필수로 바뀌면 익명 회수가 죽고, 그건 이 폼의 1순위 자산을
     *   잃는 것이다. 정본은 「선택」이라 발견하면 되돌린다. */
    if (items[at].getType() !== FormApp.ItemType.TEXT) {
      const m = '⚠️ 「' + INTERVIEW_SID_TITLE + '」 문항이 있는데 단답형이 아닙니다 — 손으로 확인하세요(자동 변경하지 않았습니다).';
      Logger.log(m); return m;
    }
    const it = items[at].asTextItem();
    const 문구같음 = String(it.getHelpText() || '') === INTERVIEW_SID_HELP;
    const 선택임 = !it.isRequired();
    if (!선택임) it.setRequired(false);
    if (!문구같음) it.setHelpText(INTERVIEW_SID_HELP);
    /* [v9.180] 문항이 이미 있어도 **여기서 빠져나가지 않는다** — 개인 링크 틀은 문항과 별개로
     *   유실될 수 있고(app_state 정리·구 폼 복구), 그때 조용히 스킵하면 「칸은 있는데 링크가 없는」
     *   상태가 영영 안 고쳐진다. 멱등은 「아무것도 안 한다」가 아니라 「같은 결과로 수렴한다」다. */
    const 옮김 = 면접SID자리_(form, items[at].getIndex(), titles.indexOf('이름'));
    const 틀 = 면접URL틀보증_(st, form);
    const 고친것 = [!문구같음 ? '안내 문구' : '', !선택임 ? '필수→선택(익명 회수 보호)' : '', 옮김 ? '자리' : ''].filter(Boolean).join('·');
    const m = (고친것 ? '📝 학생ID 문항: 이미 있음 — ' + 고친것 + '를 정본으로 되돌렸습니다.'
      : '✅ 학생ID 문항: 이미 있음 — 스킵(멱등).') + '\n' + 틀.msg;
    Logger.log(m); return m;
  }

  const item = form.addTextItem().setTitle(INTERVIEW_SID_TITLE).setHelpText(INTERVIEW_SID_HELP);
  const 이름at = titles.indexOf('이름');
  면접SID자리_(form, item.getIndex(), 이름at);
  const 틀2 = 면접URL틀보증_(st, form); // 칸을 넣은 그 자리에서 개인 링크 틀도 만든다(문항이 있어야 만들 수 있다)
  const m = '✅ 학생ID 칸을 넣었습니다' + (이름at !== -1 ? '(1번 섹션 「이름」 바로 뒤)' : ' — 다만 「이름」 문항을 못 찾아 맨 끝에 붙었습니다. 폼 편집기에서 위로 올려 주세요.')
    + '\n**선택 문항입니다** — 익명으로 남기던 회수는 그대로입니다.'
    + '\n이 칸이 채워진 기록만 「무엇을 목표했고 실제로 어디로 갔는지」로 이어집니다(로드맵 ④ 재료).'
    + '\n' + 틀2.msg
    + '\n공개 링크(익명·지금까지 뿌린 그것): ' + form.getPublishedUrl();
  Logger.log(m); return m;
}

/* ── 🔗 링크 둘로 — 공개는 익명 그대로, 아는 사람에게만 개인 링크 ────────────────
 * 유호님 확정(2026-08-04): 「처음 테스트하는 고객도 필요하고, 정규 인원 말고도 쓸 일이 분명 있다.」
 *
 * 왜 공개 링크에 프리필을 안 넣나: 그러면 기본값이 익명→실명으로 **뒤집힌다.** 이 폼의 1순위
 *   자산은 질문 은행이고 거절 경험은 특히 밝히기 싫은 정보라, 실명이 기본이 되는 순간 회수율이 깎인다.
 * 그래서 링크를 둘로 나눈다 — **같은 폼·같은 응답 시트**라 회수가 갈리지 않는다.
 *   ① 공개 링크(면접폼URL) = 지금까지 뿌린 그것. 학생ID 빈칸. 졸업생 그룹·QR.
 *   ② 개인 링크(면접폼URL틀) = 신원을 이미 아는 사람에게 1:1로. 학생ID가 채워진 채 열린다.
 * 🔑 ②로 온 사람만 궤적이 되고, ①로 온 사람은 지금처럼 질문 은행에 기여한다. 잃는 것이 없다.
 * ⚠ ②도 **지우고 보낼 수 있다** — 미리채움은 잠금이 아니다. 그게 맞다(강제였다면 ①과 같은 문제다). */
function 면접URL틀보증_(st, form) {
  const 있던것 = String(getState(st, '면접폼URL틀').val || '');
  let tpl = '';
  try { tpl = prefillTemplateOf_(form, INTERVIEW_SID_TITLE); }
  catch (e) { return { tpl: '', msg: '⚠️ 개인 링크 틀을 못 만들었습니다(' + e + ') — 공개 링크는 그대로 씁니다.' }; }
  if (tpl !== 있던것) setState(st, '면접폼URL틀', tpl);
  return { tpl: tpl, msg: '🔗 개인 링크 틀 ' + (있던것 ? (tpl === 있던것 ? '확인됨' : '갱신됨') : '생성됨')
    + ' — 시트 메뉴 「🔗 면접폼 개인 링크 만들기」에서 학생ID를 넣으면 그 사람 링크가 나옵니다.' };
}

/* 학생ID 문항을 「이름」 바로 뒤로 — **인덱스 두 개로만 부른다.**
 * 🔴 라이브가 잡은 결함(2026-08-04 18:53 실행 로그): `moveItem(item, toIndex)` 오버로드는 제네릭
 *   `Item`을 받는데 `addTextItem()`이 돌려주는 것은 `TextItem`이라 그대로 넘기면 던진다 —
 *   "The parameters (FormApp.TextItem,number) don't match the method signature".
 *   회귀 17건·변이 15/15가 전부 초록이었는데도 살아남았다: **시그니처는 실행해야만 보이는 층**이고
 *   이 저장소의 폼 검사는 전부 소스 텍스트층이다(그 한계를 알고 쓰는 것이지 대체재가 아니다).
 * ⚠ 앞에서 뒤로 옮길 때와 뒤에서 앞으로 옮길 때 목표 인덱스가 다르다 — 빼는 순간 뒤가 한 칸 당겨진다.
 * ⚠ 이 함수는 **양쪽 경로에서 부른다.** 새로 넣을 때만 자리를 잡으면, 이미 맨 끝에 박힌 폼
 *   (= 위 예외로 이동만 실패한 라이브가 정확히 그 상태다)은 영영 안 고쳐진다.
 * 반환 = 실제로 옮겼는가(호출부 보고 문구용). */
function 면접SID자리_(form, 현재, 이름at) {
  if (이름at === -1) return false;                  // 기준이 없으면 맨 끝에 그대로 둔다
  const 목표 = 현재 < 이름at ? 이름at : 이름at + 1;  // 앞에서 빼면 「이름」이 한 칸 당겨진다
  if (현재 === 목표) return false;
  form.moveItem(현재, 목표);                        // ← 인덱스·인덱스 오버로드
  return true;
}

/* 입력 → 정규 학생ID. 못 알아보면 ''.
 * ⚠ MJ_extractSid_(만족도팩)를 안 쓴 이유는 **정반대 요구**여서다 — 그건 유효 집합에 있는 것만
 *   돌려준다(제3자 추측 차단이 목적). 여기서 반드시 통해야 하는 건 「아직 명단에 없는 사람」이다.
 * 🔑 조립은 채번과 **같은 통로**(학생ID_포맷_)를 쓴다 — 'SYNK-' + 번호를 여기서 따로 이으면
 *   상담시트가 만든 것과 한 글자만 달라도 조인이 통째로 죽는다(같은 파일 L1099의 경고). */
function 면접학생ID정규화_(입력) {
  const s = String(입력 || '').trim().toUpperCase();
  if (/^\d{1,4}$/.test(s)) return 학생ID_포맷_(s);            // 「1」·「001」 — 유호님이 번호만 칠 때
  const m = s.match(/^SYNK[\s_-]*(\d{1,4})$/);                // 「synk 1」·「SYNK001」·「SYNK-001」
  return m ? 학생ID_포맷_(m[1]) : '';
}

/* 메뉴: 학생ID 하나를 받아 그 사람의 개인 링크를 돌려준다.
 * ⚠ 명단에 없는 ID도 **거절하지 않는다** — 상담만 하고 앱에 아직 안 들어온 사람·테스트 고객이
 *   정확히 그 상태이고, 그들을 막으면 이 기능이 존재할 이유가 없어진다. 대신 상태를 말해 준다. */
function interviewPersonalLink() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const tpl = String(getState(st, '면접폼URL틀').val || '');
  if (!tpl) return '⚠️ 개인 링크 틀이 아직 없습니다 — 먼저 「🔗 면접폼에 학생ID 칸 넣기」를 한 번 누르세요.';

  const ui = SpreadsheetApp.getUi();
  const a = ui.prompt('🔗 면접폼 개인 링크', '학생ID를 입력하세요 (예: SYNK-001 · 번호만 쳐도 됩니다)', ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return '취소했습니다.';
  const sid = 면접학생ID정규화_(a.getResponseText());
  if (!sid) return '⚠️ 학생ID 형식이 아닙니다(SYNK-001 형태여야 합니다).\n'
    + '학생ID가 없는 분에게는 **공개 링크**를 그대로 보내세요 — 익명으로 접수되고 질문 은행에는 똑같이 기여합니다.\n'
    + '공개 링크: ' + String(getState(st, '면접폼URL').val || '(app_state 면접폼URL 없음)');

  /* 명단 대조는 알림용이다(차단용이 아니다). profiles A=학생ID·B=이름. */
  let 누구 = '⚠️ 아직 앱 명단에 없는 ID입니다 — 상담만 하신 분·테스트 고객이면 정상입니다.';
  try {
    const pf = ss.getSheetByName('profiles');
    if (pf && pf.getLastRow() >= 2) {
      const rows = pf.getRange(2, 1, pf.getLastRow() - 1, 2).getValues();
      const hit = rows.filter(r => String(r[0]).trim() === sid)[0];
      if (hit) 누구 = '✅ 명단 확인: ' + sid + ' ' + String(hit[1] || '').trim();
    }
  } catch (e) { 누구 = '(명단 대조 실패: ' + e + ' — 링크 자체는 정상입니다)'; }

  return 누구 + '\n\n개인 링크 (이 분에게만 보내세요):\n' + tpl.replace(/SIDTOKEN/g, encodeURIComponent(sid))
    + '\n\n· 열면 학생ID가 채워진 채로 뜹니다. 본인이 지우고 보낼 수도 있습니다(익명 선택권은 그대로).\n'
    + '· 여러 사람에게 뿌릴 때는 공개 링크를 쓰세요 — 개인 링크를 단톡에 올리면 남의 ID로 제출됩니다.';
}

/* ── [v9.268] 🧰 한국 직장 경험 회수 폼 — VR 직업체험(SYNK 인증 실기)의 0단계 ──
 * 설계 정본 = docs/SHIFT/VR직업체험_설계_v1.md (유호 채택 08-27) · 상위 = docs/SHIFT/설계_v1.md §3-⑧
 *
 * 왜 면접 폼과 «따로»인가: 면접은 「들어가는가」를 묻고 직업체험은 「들어가서 할 수 있는가」를 묻는다.
 *   질문지가 다르고 응답자도 다르다(면접 = 본 사람 / 직장 = 일해 본 사람). 한 폼에 합치면 둘 다
 *   길어져 회수율이 죽고, 면접 폼의 1순위 자산(질문 은행)까지 같이 깎인다.
 *
 * 이 폼이 파는 광산 = 실기 회차의 «과업·방해·감점 기준»(설계 §5):
 *   · 「시킨 일 그대로」   → 과업
 *   · 「예정에 없던 일」   → 🔑 방해 — 회차의 급소다. 지시대로만 하면 만점인 시험은 「할 수 있는가」를 못 잰다
 *   · 「지적받은 일」      → 감점 기준(채점 축이 실제로 어디서 깨지는가)
 *   셋 다 검색으로 안 나온다. 일해 본 사람에게서만 나오고, 그 사람들을 가진 곳은 학원뿐이다 — 복제 불가 자산.
 *
 * 문항은 설계 §3 의 채점 축 넷과 1:1이다 — ①지시 수용(못 알아들었을 때 되묻는가) ②보고 ③안전·규칙 ④관계 언어.
 *   문항을 늘리거나 줄일 때 이 대응을 먼저 본다. 축에 안 닿는 문항은 회수율만 먹는다.
 *
 * 🔒 지금 `직장기록_응답` 을 읽는 곳은 워치독의 `getLastRow()` 하나뿐이라 **값이 다른 시트로 옮겨 가지 않는다.**
 *   ⚠ 훗날 궤적 수확기(엔진_궤적.js 가 면접기록_응답에 하듯) 이 탭을 읽어 다른 시트에 쓰게 되면
 *   그 쓰기는 반드시 `행소독_`/`셀안전_` 를 지나야 한다 — 폼은 누구나 열 수 있어 응답이 남의 글이다(v9.157 계보).
 *
 * ⚠ 익명·동의는 면접 폼과 «같은 계급»이다 — 이름·연락처는 선택(혼난 경험일수록 밝히기 싫다),
 *   자료활용동의는 필수·거부 가능(없으면 모은 기록을 연습 자료로도 AI 학습으로도 못 쓴다 · 소급 불가).
 * 학생ID 는 면접 폼과 «같은 상수»를 쓴다(INTERVIEW_SID_*) — 조인 키라 두 곳에 적으면 갈라진다. */
const WORK_KINDS = ['편의점·마트', '카페·식당', '물류·상하차·택배', '공장·제조 라인', '건설·현장', '농장·축산', '매장 판매·서비스', '사무·서무 보조', '통역·번역', '기타'];
const WORK_PLACES = ['한국에서', '몽골의 한국 회사·한국 사람과 함께', '둘 다 있음'];
const WORK_STATUSES = ['유학 중 아르바이트(D-2·D-4)', '고용허가제(E-9)', '유학 후 취업(E-7 등)', '기타·잘 모르겠음'];
/* 학생ID 안내는 «이 폼 전용»이다 — 제목(조인 키)은 면접 폼과 같은 상수를 쓰되 안내만 갈라진다.
 * 까닭(①배포 검수 41a05e993ae4): 이 폼의 배포처에 **한국 근무 경험이 있는 학부모·지인**이 들어 있다.
 *   면접 폼은 「본인이 면접 본 경험」이라 응답자가 곧 학생이지만, 여기서는 학부모가 «자기» 직장 경험을
 *   적으면서 «자녀의» 학생ID를 적을 여지가 있다 — 그러면 남의 경험이 그 학생의 궤적으로 조인된다.
 *   조인 키를 없애는 대신(그러면 궤적이 끊긴다) 안내에서 못을 박는다. */
/* 폼 제목과 응답 탭 이름은 «식별자»다 — 복구 경로가 제목으로 「이게 그 폼인가」를 판정하고,
 * 워치독은 탭 이름으로 회수량을 읽는다. 리터럴로 흩뿌리면 한쪽만 바뀌어 조용히 갈린다. */
const WORK_FORM_TITLE = 'SYNK 한국 직장 경험 기록';
const WORK_TAB = '직장기록_응답';
/* ── 🇲🇳 안내문 정본 — 한국어 + 몽골어 병기 [v9.270] ────────────────────────────
 * 왜 «안내문»에만 몽골어를 넣나: **문항 제목은 기계가 읽는 키**다(응답 시트 헤더 · 복구 경로의 폼 서명 ·
 *   궤적 조인 키). 제목을 병기로 바꾸면 그 셋이 한꺼번에 갈린다. 사람이 읽는 곳은 안내문이므로 거기 넣는다.
 * 🔑 그리고 진짜 급소는 «읽기»가 아니라 «쓰기»였다 — 이 폼이 받아내야 하는 것은 「혼났던 일」·「말투 때문에
 *   곤란했던 순간」처럼 미묘한 이야기다. 한국어로 써야 한다고 생각하면 한 줄로 줄어든다. 그래서 폼 설명
 *   맨 끝에 **「몽골어로 답해도 된다」**를 박았다 — 병기보다 이 한 줄이 회수 «품질»을 더 바꾼다.
 * ⚠ 생성부와 마이그레이션이 **같은 상수**를 본다 — 두 곳에 적으면 「새로 만든 폼」과 「고친 폼」이 갈린다.
 * ✅ 몽골어는 `node tools/몽골어대조.js` 검문을 지났다(08-27 · 역번역+문법 층 · 지적 3건 반영해 재통과).
 *   ⚠ 말투 층은 voice-guard 철거로 «미측정»이다 — 0건이 아니라 안 잰 것이다. 원어민 눈이 한 번 더 필요하다. */
const WORK_DESC = '한국에서, 또는 한국 회사에서 일해 본 경험을 나눠주세요.\n'
  + '여기 쓰신 것이 다음 크루의 연습이 됩니다 — 잘한 일보다 혼났던 일이 더 큰 도움이 됩니다.\n'
  + '이름은 적지 않으셔도 됩니다. 10분이면 충분합니다 🙂\n\n'
  + 'Солонгост, эсвэл солонгос компанид ажиллаж байсан туршлагаасаа хуваалцана уу.\n'
  + 'Таны бичсэн зүйл дараагийн сурагчдын дадлага болно. Сайн хийсэн зүйлээс загнуулсан зүйл нь илүү их тус болно.\n'
  + 'Нэрээ бичихгүй байж болно. 10 минут хангалттай.\n\n'
  + '🇲🇳 몽골어로 답하셔도 됩니다 · Монголоор хариулж болно. Солонгосоор бичих шаардлагагүй.';
/* 키 = 문항 제목(정확히 일치해야 마이그레이션이 찾는다) · 값 = 안내문 전체(한국어 + 몽골어). */
const WORK_HELP = {
  /* 학생ID 안내가 «이 폼 전용»인 까닭(①배포 검수 41a05e993ae4): 배포처에 **한국 근무 경험이 있는 학부모·지인**이
   * 들어 있다. 면접 폼은 「본인이 면접 본 경험」이라 응답자가 곧 학생이지만, 여기서는 학부모가 «자기» 경험을
   * 적으면서 «자녀의» 학생ID 를 적을 여지가 있다 — 그러면 남의 경험이 그 학생 궤적으로 조인된다. */
  '학생ID': '본인이 SYNK 크루(학생)일 때만 적어주세요 — SYNK-001 형식입니다. 자녀·지인의 번호는 적지 마세요(다른 사람의 기록으로 섞입니다). 모르거나 밝히고 싶지 않으면 비워두세요.\n'
    + 'Зөвхөн өөрөө SYNK-ийн сурагч бол бичээрэй. Хүүхэд эсвэл танилынхаа дугаарыг бүү бичээрэй. Мэдэхгүй бол хоосон орхиж болно.',
  '시킨 일 그대로': '첫날, 그리고 평소에 시킨 일을 순서대로 적어주세요. 이 칸이 다음 크루가 연습할 실제 과제가 됩니다.\n'
    + 'Эхний өдөр болон өдөр тутам танд юу хийхийг даалгаж байсныг дарааллаар нь бичээрэй.',
  '못 알아들었을 때 어떻게 했나요': '다시 물어봤는지 · 그냥 했는지 · 옆 사람에게 물었는지 — 있는 그대로 적어주세요. 틀린 답이 없는 질문입니다.\n'
    + 'Дахин асуусан уу, эсвэл дуугүй хийсэн үү, хажуугийн хүнээсээ асуусан уу — байгаагаар нь бичээрэй. Энд буруу хариулт гэж байхгүй.',
  '예정에 없던 일이 생긴 적': '물건이 없거나 · 기계가 멈추거나 · 손님이 화를 내거나 · 알려줄 사람이 자리에 없거나. 없었으면 "없었음"이라고 적어주세요.\n'
    + 'Бараа дуусах, машин зогсох, үйлчлүүлэгч уурлах, заах хүн байхгүй байх гэх мэт. Байгаагүй бол байгаагүй гэж бичээрэй.',
  '그때 누구에게 어떻게 알렸나요': '바로 말했는지 · 혼자 해결하려 했는지 · 퇴근할 때 말했는지\n'
    + 'Тэр даруй хэлсэн үү, дангаараа шийдэх гэсэн үү, ажил тарахдаа хэлсэн үү гэдгийг бичээрэй.',
  '혼나거나 지적받은 일': '무엇 때문이었는지 그대로 적어주세요.\n'
    + 'Юунаас болсныг байгаагаар нь бичээрэй.',
  '하지 말라고 들은 것': '안전·규칙 — "이건 절대 하지 마라"고 들은 것을 적어주세요.\n'
    + 'Аюулгүй байдал, дүрэм журам. Үүнийг хэзээ ч бүү хий гэж хэлсэн зүйлийг бичээрэй.',
  '말투·호칭 때문에 곤란했던 일': '존댓말 · 부르는 말 · 거절하거나 부탁할 때 — 한국어는 맞는데 분위기가 이상해졌던 순간을 적어주세요.\n'
    + 'Хүндэтгэлийн үг, дуудах нэр, татгалзах эсвэл хүсэлт гаргах үе. Солонгос хэл нь зөв атлаа уур амьсгал хачин болсон мөчийг бичээрэй.',
  '그만둔 사람을 봤다면, 왜 그만뒀나요': '본인 이야기여도 괜찮습니다.\n'
    + 'Өөрийнхөө тухай байсан ч зүгээр.',
  '자료활용동의': '이 기록을 ① 후배 크루의 직업 체험 연습 자료 ② 그 연습을 만드는 AI의 학습 자료로 쓰는 것에 동의하시나요?\n'
    + '이름·연락처·회사 이름은 연습 자료에 절대 포함하지 않습니다(상황과 일만 씁니다). '
    + '"아니요"를 고르셔도 기록은 감사히 받고, 연습 자료로는 쓰지 않습니다 · 철회는 언제든 학원으로 연락 주세요.\n\n'
    + 'Энэ бичлэгийг дараагийн сурагчдын ажил мэргэжлийн дадлагын материал болгон, мөн тэр дадлагыг бүтээх AI-н сургалтын материал болгон ашиглахыг зөвшөөрч байна уу?\n'
    + 'Нэр, утасны дугаар, компанийн нэрийг дадлагын материалд огт оруулахгүй. Зөвхөн нөхцөл байдал, ажлыг ашиглана.\n'
    + 'Үгүй гэж сонгосон ч бичлэгийг талархан хүлээж авах бөгөөд дадлагын материалд ашиглахгүй. Цуцлахыг хүсвэл хүссэн үедээ сургуультай холбогдоно уу.'
};
/* 복구·완료 판정의 «필수 문항» 단일 소스 — 생성부의 required=true 다섯과 복구 검증이 같은 목록을 본다
 * (codex P2 d7c9f6f6: 구판 검증은 WORK_HELP 키 = «도움말 있는» 문항이라, 도움말 없는 필수 「일한 곳」·
 * 「무슨 일」이 빠진 반쪽 폼을 완료로 찍을 수 있었다). 생성부에서 필수를 바꾸면 이 목록도 같은 커밋. */
const WORK_REQUIRED_ = ['일한 곳', '무슨 일', '시킨 일 그대로', '예정에 없던 일이 생긴 적', '자료활용동의'];
/* 이 폼을 «이 폼이게 하는» 서명 — 제목은 고유하지 않다(복사본·손으로 만든 동명 폼이 있을 수 있다).
 * 🔑 **자를 하나로 둔다**(①배포 검수 550ba898c5dd): 응답 탭에서 폼을 «찾는» 자리와, 라이브 폼을 «고치는»
 *   자리가 서로 다른 자를 쓰면 느슨한 쪽 문으로 남의 폼이 들어온다. 실제로 마이그레이션이 제목만 보고 있었다.
 * ⚠ 「기존 폼 반환」 경로는 이 자를 **안 쓴다** — 거기엔 「문항을 붙이다 끊긴 폼」도 들어와야 하고,
 *   그런 폼은 서명이 없어 여기서 «남의 폼»으로 판정된다. 그 경로는 제목만 보고 완료 표식으로 가른다. */
function 직장폼서명_(form) {
  if (String(form.getTitle()).trim() !== WORK_FORM_TITLE) return false;
  const t = form.getItems().map(function (i) { return String(i.getTitle()).trim(); });
  return t.indexOf('시킨 일 그대로') !== -1 && t.indexOf('예정에 없던 일이 생긴 적') !== -1;
}
/* ⚠ 잠금이 «이 폼에만» 있고 면접 폼에 없는 것은 갈린 게 아니라 위험 창이 다른 자리다(①배포 검수 c2e5cccfcc26):
 *   면접 폼은 이미 라이브에 서 있어 재실행이 「기존 폼 반환」으로 끝나지만, 이 폼은 아직 «첫 생성»이 남아
 *   빈 ID 를 둘이 동시에 읽는 창이 실제로 열려 있다. 첫 생성이 끝나면 이 락은 사실상 무해한 통과 지점이 된다. */
function createWorkLogForm() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    const mL = '⚠️ 다른 실행이 직장 경험 폼을 만들고 있어 30초 기다리다 멈췄습니다 — 중복 폼이 생기지 않도록 일부러 멈춥니다. 잠시 뒤 다시 실행하세요.';
    Logger.log(mL);
    return mL;
  }
  /* 알림은 잠금 «해제 뒤» — adminMail 은 DIGEST_MODE 에서 같은 비재진입 ScriptLock 을 다시 잡는다
   * (codex P1 34a174bc — 첫 생성이 쓰기를 다 마치고도 30초 대기 끝 실패로 «보고»되던 자리). */
  let 지연알림 = null;
  try { return createWorkLogForm_(m => { 지연알림 = m; }); }
  finally {
    lock.releaseLock();
    if (지연알림) adminMail(지연알림.제목, 지연알림.본문);
  }
}
function createWorkLogForm_(알림기록) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  // 재실행 안전 — 배포된 링크·QR가 미아가 되지 않도록 살아 있는 폼은 절대 새로 만들지 않는다(createInterviewLogForm 과 같은 계급).
  let exId = String(getState(st, '직장폼ID').val || '');
  if (!exId) { // ID만 유실된 경우(시트 수기 편집·app_state 정리) 응답 탭의 연결 폼에서 복구 — 없으면 중복 폼이 생기고 회수가 두 곳으로 갈린다
    try {
      const shR = ss.getSheetByName(WORK_TAB);
      const editUrl = shR && shR.getFormUrl();
      if (editUrl) {
        const f0 = FormApp.openByUrl(editUrl);
        /* 🔑 제목을 «검증하고» 채택한다(①배포 검수 695480e24333) — 탭 이름은 사람이 바꿀 수 있어서
         *   엉뚱한 폼이 이 이름 아래 붙어 있을 수 있다. 검증 없이 채택하면 그 뒤의 모든 실행과 워치독이
         *   «남의 폼»을 직장 폼으로 취급한다. 어긋나면 고치지 말고 멈춘다 — 사람이 볼 자리다. */
        // 제목은 «고유하지 않다»(①배포 검수 728e50c7d939) — 이 폼을 이 폼이게 하는 필수 두 칸까지 본다(공용 자)
        if (직장폼서명_(f0)) {
          exId = f0.getId();
          setState(st, '직장폼ID', exId);
          setState(st, '직장폼URL', f0.getPublishedUrl());
          /* 🔑 «서명 통과 = 완성»이 아니다(codex P1 3898bacd) — 서명은 두 문항이라, 문항을 붙이다
           * 끊긴 폼(동의 섹션 없음)도 지난다. 완료 도장은 **필수 문항 전수**가 있어야 찍는다 —
           * 특히 「자료활용동의」가 빠진 채 y 를 찍으면 동의 없는 응답이 조용히 쌓인다.
           * 빠졌으면 ID·URL 만 복구하고 완료는 안 찍는다 → 아래 「만들다 만 상태」 안내가 그대로 받는다. */
          const 있는문항 = f0.getItems().map(function (i) { return String(i.getTitle()).trim(); });
          const 빠진필수 = WORK_REQUIRED_.filter(function (t) { return 있는문항.indexOf(t) === -1; });
          if (빠진필수.length === 0) {
            setState(st, '직장폼완료', 'y');
            Logger.log('직장 경험 폼 — ID가 없어 응답 탭의 연결 폼에서 복구했습니다(필수 문항 전수 확인).');
          } else {
            Logger.log('직장 경험 폼 — ID는 복구했지만 필수 문항이 빠져 완료 도장은 안 찍었습니다: ' + 빠진필수.join(' · '));
          }
        } else {
          const mX = '⚠️ 탭 「' + WORK_TAB + '」에 연결된 폼이 직장 경험 폼이 아닙니다(제목 「' + f0.getTitle() + '」'
            + (String(f0.getTitle()).trim() === WORK_FORM_TITLE ? ' · 제목은 같지만 필수 문항 「시킨 일 그대로」·「예정에 없던 일이 생긴 적」이 없습니다' : '') + ').\n'
            + '엉뚱한 폼을 채택하지 않으려고 멈췄습니다. 탭 이름을 바꾸거나(예: ' + WORK_TAB + '_옛것) 올바른 폼 ID를 app_state 「직장폼ID」에 넣은 뒤 다시 실행하세요.';
          Logger.log(mX);
          return mX;
        }
      }
    } catch (eR) { /* 복구 실패 → 아래 정상 생성 경로 */ }
  }
  if (exId) {
    try {
      const exForm = FormApp.openById(exId);
      /* 🔑 «ID 가 읽힌다»를 완료로 취급하지 않는다(①배포 검수 257ac0b6fe00·0b240aac65cc) — 폼 생성 뒤
       *   setDestination 이 실패했으면 폼은 사는데 제출이 어디에도 안 쌓인다. 그리고 탭이 «있어도»
       *   그게 이 폼의 탭이라는 보장이 없다(옛 탭·재생성된 탭). 그래서 탭의 연결 폼 URL 로 대조한다. */
      /* 🔑 순서가 곧 판정이다(①배포 검수 9675a3471a43·132ede0b00a2) — ①이게 그 폼인가 ②완성됐나 ③탭이 붙었나.
       *   완성 여부를 먼저 보지 않고 라우팅부터 고치면 «문항이 빠진 폼»에 응답 탭만 예쁘게 달아 놓고
       *   「복구했습니다」로 보고하게 된다. 그리고 저장된 ID 도 늙는다 — 제목으로 한 번 대조한다. */
      if (String(exForm.getTitle()).trim() !== WORK_FORM_TITLE) {
        const mI = '⚠️ app_state 의 「직장폼ID」가 가리키는 폼의 제목이 「' + exForm.getTitle() + '」입니다 — 직장 경험 폼이 아닙니다.\n'
          + '낡은 ID 이거나 다른 폼을 가리키고 있습니다. 그 행을 지운 뒤 다시 실행하면 새로 만들거나 응답 탭에서 복구합니다.';
        Logger.log(mI);
        return mI;
      }
      if (String(getState(st, '직장폼완료').val || '') !== 'y') {
        const mP = '⚠️ 직장 경험 폼이 «만들다 만 상태»일 수 있습니다 — 폼은 있는데 완료 표식이 없습니다(문항을 붙이는 도중에 실행이 끊긴 자리).\n'
          + '폼을 열어 섹션 7개(누구·어떤 일·시킨 일·예정에 없던 일·지적받은 것·끝으로·동의)가 다 있는지 보세요.\n'
          + '· 다 있으면: app_state 의 「직장폼완료」 값을 y 로 적으면 됩니다.\n'
          + '· 비어 있으면: 그 폼을 휴지통에 넣고 app_state 의 「직장폼ID」 행을 지운 뒤 다시 실행하세요.\n배포 링크: ' + exForm.getPublishedUrl();
        Logger.log(mP);
        return mP;
      }
      const shT = ss.getSheetByName(WORK_TAB);
      let tabOk = false;
      if (shT) { try { tabOk = String(shT.getFormUrl() || '').indexOf(exForm.getId()) !== -1; } catch (eU) { tabOk = false; } }
      if (!shT) {
        const before0 = ss.getSheets().map(s => s.getName());
        exForm.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
        linkFormTab_(ss, before0, WORK_TAB);
        setState(st, '직장폼URL', exForm.getPublishedUrl());
        const mR = '🔧 직장 경험 폼은 있었지만 응답 탭이 없어 «응답 라우팅을 다시 걸었습니다».\n배포 링크: ' + exForm.getPublishedUrl();
        Logger.log(mR);
        return mR;
      }
      if (!tabOk) {
        const mM = '⚠️ 탭 「' + WORK_TAB + '」이 직장폼ID 와 «다른 폼»에 연결돼 있습니다 — 제출이 쌓이는 곳과 워치독이 세는 곳이 갈라져 있습니다.\n'
          + '자동으로 고치면 어느 쪽 응답이든 잃을 수 있어 멈췄습니다. 탭의 「양식」 메뉴로 어느 폼인지 확인하신 뒤, 옛 탭 이름을 바꾸고(예: ' + WORK_TAB + '_옛것) 다시 실행하세요.';
        Logger.log(mM);
        return mM;
      }
      const msg0 = '✅ 직장 경험 폼이 이미 있어 새로 만들지 않았습니다.\n배포 링크: ' + exForm.getPublishedUrl();
      Logger.log(msg0);
      return msg0;
    } catch (eG) {
      const msgG = '⚠️ 연결된 직장폼ID를 열지 못했습니다(' + eG + ').\n일시 오류일 수 있어 새 폼을 만들지 않았습니다 — 폼이 정말 삭제됐으면 app_state에서 직장폼ID 행을 지운 뒤 재실행하세요.';
      Logger.log(msgG);
      return msgG;
    }
  }
  /* 🔑 여기 도달 = 폼 ID 도 없고 복구도 못 했다. 그런데 탭 이름이 이미 차 있으면 새 폼의 응답 탭에
   *   날짜 접미사가 붙고(linkFormTab_), 워치독은 «표준 이름»만 읽으므로 새 제출이 통째로 안 보이게 된다
   *   (①배포 검수 10a5f2f323f0). 이름을 자동으로 밀지 않고 멈춘다 — 남의 데이터를 옮기는 판단은 사람 몫이다. */
  if (ss.getSheetByName(WORK_TAB)) {
    const mT = '⚠️ 탭 「' + WORK_TAB + '」이 이미 있는데 연결된 직장 경험 폼을 찾지 못했습니다.\n'
      + '이대로 새 폼을 만들면 응답 탭에 날짜 접미사가 붙어 «회수량이 워치독에서 사라집니다».\n'
      + '옛 탭의 이름을 바꾸신 뒤(예: ' + WORK_TAB + '_옛것) 다시 실행하세요 — 옛 응답은 그대로 보존됩니다.';
    Logger.log(mT);
    return mT;
  }
  const before = ss.getSheets().map(s => s.getName());
  const form = FormApp.create(WORK_FORM_TITLE);
  /* 🔑 ID 를 «만든 그 다음 줄에서» 저장한다(①배포 검수 ec3700ebc0eb·e21f3cec0b41) — 설명·문항·라우팅 중
   *   어디서 끊겨도, ID 를 안 적어 둔 폼은 아무도 그 존재를 모르는 고아가 되고 다음 실행이 또 만든다.
   *   ⚠ 그래서 create 에 «체이닝을 붙이지 않는다» — 체인 안에서 실패하면 이 줄에 도달하지 못한다. */
  setState(st, '직장폼ID', form.getId());
  form.setDescription(WORK_DESC).setCollectEmail(false);

  function txt(t, req, help) { const i = form.addTextItem().setTitle(t); if (req) i.setRequired(true); if (help) i.setHelpText(help); return i; }
  function para(t, req, help) { const i = form.addParagraphTextItem().setTitle(t); if (req) i.setRequired(true); if (help) i.setHelpText(help); return i; }
  function mc(t, opts, req, help) { const i = form.addMultipleChoiceItem().setTitle(t).setChoiceValues(opts); if (req) i.setRequired(true); if (help) i.setHelpText(help); return i; }

  form.addSectionHeaderItem().setTitle('1. 누구의 경험인가요').setHelpText('이 부분은 전부 선택입니다 — 익명으로 남기셔도 자료로 잘 쓰입니다.');
  txt('이름', false, '익명을 원하시면 비워두세요');
  txt(INTERVIEW_SID_TITLE, false, WORK_HELP['학생ID']); // 제목 = 궤적 조인 키(면접폼과 같은 상수라야 한 사람으로 대조된다) · 안내는 이 폼 전용
  mc('지금 신분', ['재학생', '졸업생', '학부모·지인', '기타'], false);
  txt('연락처', false, '내용을 더 여쭤봐도 될 때만 남겨주세요');

  form.addSectionHeaderItem().setTitle('2. 어떤 일이었나요');
  mc('일한 곳', WORK_PLACES, true);
  mc('무슨 일', WORK_KINDS, true);
  mc('어떤 자격으로', WORK_STATUSES, false, '모르시면 "기타·잘 모르겠음"을 고르세요');
  mc('일한 기간', ['하루~일주일', '1개월 미만', '1~6개월', '6개월~1년', '1년 이상'], false);
  txt('시기', false, '예: 2025-06 (연-월만 적어주세요)');

  form.addSectionHeaderItem().setTitle('3. 무슨 일을 시켰나요')
    .setHelpText('여기가 가장 중요합니다. 문장이 어색해도 괜찮으니 기억나는 대로 많이 적어주세요.');
  para('시킨 일 그대로', true, WORK_HELP['시킨 일 그대로']);
  mc('지시를 어떻게 받았나요', ['말로', '문자·메모로', '보여주면서', '섞어서'], false);
  para('못 알아들었을 때 어떻게 했나요', false, WORK_HELP['못 알아들었을 때 어떻게 했나요']);

  form.addSectionHeaderItem().setTitle('4. 예정에 없던 일')
    .setHelpText('시킨 일만 하면 되는 날은 거의 없습니다. 그런 순간이 이 기록의 핵심입니다.');
  para('예정에 없던 일이 생긴 적', true, WORK_HELP['예정에 없던 일이 생긴 적']);
  para('그때 누구에게 어떻게 알렸나요', false, WORK_HELP['그때 누구에게 어떻게 알렸나요']);

  form.addSectionHeaderItem().setTitle('5. 지적받은 것')
    .setHelpText('창피한 이야기가 아닙니다 — 이 칸이 다음 크루를 가장 많이 구합니다.');
  para('혼나거나 지적받은 일', false, WORK_HELP['혼나거나 지적받은 일']);
  para('하지 말라고 들은 것', false, WORK_HELP['하지 말라고 들은 것']);
  para('말투·호칭 때문에 곤란했던 일', false, WORK_HELP['말투·호칭 때문에 곤란했던 일']);

  form.addSectionHeaderItem().setTitle('6. 끝으로');
  para('가장 힘들었던 것', false);
  para('그만둔 사람을 봤다면, 왜 그만뒀나요', false, WORK_HELP['그만둔 사람을 봤다면, 왜 그만뒀나요']);
  para('다음 사람에게 한마디', false);

  form.addSectionHeaderItem().setTitle('7. 자료 활용 동의');
  mc('자료활용동의', ['네, 동의합니다', '아니요, 원하지 않습니다'], true, WORK_HELP['자료활용동의']);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  linkFormTab_(ss, before, WORK_TAB);
  setState(st, '직장폼URL', form.getPublishedUrl());
  // 🔑 완료 표식은 «맨 마지막»에 찍는다 — 이 줄에 도달했다는 것만이 「문항·라우팅이 다 섰다」의 증거다.
  setState(st, '직장폼완료', 'y');
  // 알림은 래퍼가 잠금 해제 «뒤» 발송한다(P1 34a174bc) — 이 함수의 유일 호출자가 그 래퍼다.
  알림기록({
    제목: '[SYNK] 🧰 직장 경험 기록 폼 생성 완료',
    본문: '배포 링크(공개·익명):\n' + form.getPublishedUrl() +
    '\n\n무엇에 쓰나: VR 직업체험(= SYNK 인증의 실기 검정)의 장면·과업·«방해»가 전부 여기서 나옵니다.\n' +
    '설계 = docs/SHIFT/VR직업체험_설계_v1.md\n' +
    '\n어디에 뿌리면 좋은지:\n' +
    '① 한국에서 일해 본 졸업생·수료생 — 가장 회수율이 높은 곳\n' +
    '② 몽골의 한국 회사에 다니는 지인 — 관계 언어·보고 문화는 여기서도 똑같이 나옵니다\n' +
    '③ 학부모 중 한국 근무 경험자 — 상담 자리에서 QR로\n\n' +
    '⚠️ 몽골어 병기는 아직 없습니다 — 졸업생·학부모 대상이면 원어민 검수 후 병기하는 것이 회수율에 직결됩니다.\n' +
    '편집용: ' + form.getEditUrl() });
  Logger.log('✅ 직장 경험 기록 폼 생성 완료: ' + form.getPublishedUrl());
  return '✅ 직장 경험 기록 폼 생성 완료: ' + form.getPublishedUrl();
}

/* ── 🇲🇳 [v9.270] 라이브 직장 폼에 몽골어 안내 넣기 (멱등) ──────────────────────
 * 왜 «별도 함수»인가: createWorkLogForm 은 살아 있는 폼을 절대 건드리지 않는다(배포된 링크·QR 보호 —
 *   그 판단은 옳다). 그래서 생성부만 고치면 **이미 선 폼에는 영원히 안 닿는다** — 유호님이 08-27 에
 *   이미 만드셨다. 「장치와 그 발동 조건은 같은 커밋에서」(CLAUDE.md) — 발동 = 시트 메뉴 「🇲🇳 …」.
 *
 * 🔑 「이미 있으면 스킵」이 아니라 **«정본과 다르면 갱신»**이다 — v9.103 이 정확히 그 구멍이었다
 *   (제목만 보고 스킵해서 문구 개정이 라이브 폼에 영영 안 닿았고, 학생이 읽는 문장은 옛것으로 남았다).
 *
 * ⚠ **제목·선택지·기존 응답은 건드리지 않는다** — 제목은 응답 시트 헤더이자 복구 경로의 폼 서명이고
 *   궤적 조인 키다. 안내문(HelpText)만 간다. 그래서 이 함수는 응답이 쌓인 뒤에 돌려도 안전하다. */
function migrateWorkFormMn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const fid = String(getState(st, '직장폼ID').val || '');
  if (!fid) { const m = '⚠️ 직장폼ID 미연결 — 먼저 시트 메뉴 「🧰 직장 경험 회수 폼 만들기」를 실행하세요(새로 만들면 몽골어가 처음부터 들어갑니다).'; Logger.log(m); return m; }

  let form;
  try { form = FormApp.openById(fid); }
  catch (e) { const m = '⚠️ 직장 폼을 열지 못했습니다(' + e + ') — 폼 삭제·권한을 확인하세요. 아무것도 고치지 않았습니다.'; Logger.log(m); return m; }

  /* 엉뚱한 폼을 고치지 않는다 — 낡은 ID 가 다른 폼을 가리킬 수 있고, **제목은 고유하지 않다**.
   * 그래서 «찾는 자리»와 같은 자를 쓴다(①배포 검수 550ba898c5dd) — 여기가 느슨하면 그 문으로 남의 폼의
   * 설명과 안내가 통째로 덮어써진다. 되돌릴 수 없는 쓰기라 «판정이 서지 않으면 아무것도 안 한다». */
  if (!직장폼서명_(form)) {
    const m = '⚠️ 직장폼ID 가 가리키는 폼이 직장 경험 폼이 아닙니다(제목 「' + form.getTitle() + '」'
      + (String(form.getTitle()).trim() === WORK_FORM_TITLE ? ' · 제목은 같지만 필수 문항 「시킨 일 그대로」·「예정에 없던 일이 생긴 적」이 없습니다' : '') + ').\n'
      + '남의 폼을 덮어쓰지 않으려고 아무것도 고치지 않았습니다.';
    Logger.log(m);
    return m;
  }

  const 바뀐것 = [];
  if (String(form.getDescription() || '') !== WORK_DESC) { form.setDescription(WORK_DESC); 바뀐것.push('폼 설명(맨 위)'); }

  const items = form.getItems();
  const 못찾음 = [];
  Object.keys(WORK_HELP).forEach(function (title) {
    const it = items.filter(function (x) { return String(x.getTitle()).trim() === title; })[0];
    if (!it) { 못찾음.push(title); return; }   // 제목이 갈렸다는 신호 — 조용히 넘기면 그 문항만 한국어로 남는다
    if (String(it.getHelpText() || '') !== WORK_HELP[title]) { it.setHelpText(WORK_HELP[title]); 바뀐것.push(title); }
  });

  const 요약 = (바뀐것.length ? '✅ 몽골어 안내를 넣었습니다 — ' + 바뀐것.length + '곳 갱신:\n· ' + 바뀐것.join('\n· ')
    : '✅ 이미 정본과 같습니다 — 고칠 것이 없었습니다(이 함수는 몇 번 눌러도 안전합니다).')
    + (못찾음.length ? '\n\n⚠️ 폼에서 못 찾은 문항 ' + 못찾음.length + '개: ' + 못찾음.join(' · ')
      + '\n   → 제목이 바뀌었거나 문항이 지워진 자리입니다. 그 문항은 한국어 안내로 남습니다.' : '')
    + '\n\n제목·선택지·기존 응답은 건드리지 않았습니다.\n배포 링크: ' + form.getPublishedUrl();
  Logger.log(요약);
  adminMail('[SYNK] 🇲🇳 직장 경험 폼 몽골어 안내 반영', 요약
    + '\n\n왜 넣었나: 이 폼이 받아내야 하는 것은 「혼났던 일」·「말투 때문에 곤란했던 순간」처럼 미묘한 이야기입니다.'
    + '\n한국어로 써야 한다고 생각하면 한 줄로 줄어듭니다 — 그래서 폼 설명 끝에 「몽골어로 답해도 된다」를 박았습니다.'
    + '\n\n⚠️ 몽골어는 기계 검문(역번역·문법)만 지났습니다. 말투 층은 도구가 없어 «미측정»입니다 — 대외로 크게 뿌리기 전에 원어민 눈이 한 번 더 보면 좋습니다.');
  return 요약;
}

/* ── 문구 다듬기 재적용(09-01 유호 지시 「애매한 문구 전수 교정」) — 라이브 폼에 코드 정본 문구를 다시 민다.
 * 코드만 고치면 이미 생성된 폼은 옛 문구를 계속 낸다(배포 ≠ 반영) — 이 함수가 그 반쪽을 갚는다.
 * 멱등: 값이 다를 때만 쓴다. 미생성 폼은 스킵(만들 때 새 문구로 태어난다). 동의·직장 폼은
 * 이미 «상수를 다시 미는» 기존 마이그레이션이 있어 위임한다(한 값 한 곳 — WORK_DESC 관례). */
function migrateFormCopy0901() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const out = [];
  const 폼문항고치기 = (라벨, 폼ID키, 고치기) => {
    const fid = String(getState(st, 폼ID키).val || '');
    if (!fid) { out.push(라벨 + ': 미생성 — 코드가 정본, 만들 때 새 문구로 생성됩니다'); return; }
    try { out.push(라벨 + ': ' + 고치기(FormApp.openById(fid))); }
    catch (e) { out.push('⚠️ ' + 라벨 + ': 폼 접근 실패(' + e + ') — 아무것도 고치지 않았습니다'); }
  };
  폼문항고치기('퀴즈폼 확신도 도움말', '퀴즈폼ID', (form) => {
    const it = form.getItems().filter((x) => String(x.getTitle()).trim() === '얼마나 확신하나요?')[0];
    if (!it) return '⚠️ 문항을 못 찾아 안 고쳤습니다(제목 「얼마나 확신하나요?」 부재)';
    if (String(it.getHelpText() || '') === QUIZ_CONFIDENCE_HELP) return '이미 최신';
    it.setHelpText(QUIZ_CONFIDENCE_HELP);
    return '도움말 갱신';
  });
  폼문항고치기('설문폼 설명', '설문폼ID', (form) => {
    /* 자유 문항 «제목»은 여기서 안 민다 — 제목은 응답 시트 헤더·서명이라 마이그레이션 setTitle 금지
     * 자(직장 폼 회귀)가 지키는 선이다. 이미 생성된 폼의 제목은 옛 한국어 괄호로 남되, 학부모가
     * 실제로 읽는 본체는 몽골어라 실해가 없고, 새로 만드는 폼은 SURVEY_FREE_TITLE 로 태어난다. */
    // 서명 — 낡은 ID 가 소유자의 «다른» 폼을 가리키면 안 고친다(migrateWorkFormMn :1413 전례).
    // 학생ID 문항은 여러 폼에 있어 그것만으로는 못 가른다(codex fa962adc66e1 수용) — 몽골어 자유 문항까지 둘이 서명이다.
    const 제목들 = form.getItems().map((x) => String(x.getTitle()).trim());
    const 서명 = 제목들.indexOf('학생ID') !== -1
      && 제목들.some((t) => t.indexOf('Нэг зүйлийг өөрчилж болох бол юу вэ?') === 0);
    if (!서명) return '⚠️ 설문폼ID 가 가리키는 폼이 만족도 설문이 아닙니다(서명 문항 둘 중 하나 부재) — 남의 폼을 덮지 않으려고 안 고쳤습니다';
    if (String(form.getDescription() || '') === SURVEY_DESC) return '이미 최신';
    form.setDescription(SURVEY_DESC);
    return '설명 갱신';
  });
  let 직장보고;
  try { 직장보고 = migrateWorkFormMn(); } catch (e) { 직장보고 = '⚠️ 직장 폼 재적용 실패: ' + e; }
  const report = '📝 폼 문구 다듬기 재적용(09-01)\n' + out.join('\n')
    + '\n— 직장 폼: 기존 migrateWorkFormMn 위임\n' + String(직장보고).split('\n')[0];
  Logger.log(report);
  return report;
}

/* ── [v9.89] 🔁 결석 연락 기록 폼 — 「결석 복귀율」의 입력 레일(약점 메모 폼 v9.55·v9.64 계보) ──
 * 왜 폼인가: Glide에서 입력받으면 update를 소비한다(Maker 월 500 제약). 폼은 0. — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md)
 * ⚠ 항목 수는 여기서 확정이다 — 나중에 추가·삭제하면 응답 시트에 새 열이 생기거나 밀려
 *   sweepAbsenceForm_의 위치 파싱(1~7열)이 깨진다. 동기화는 제목·안내·선택지만 바꾸고 항목은 건드리지 않는다.
 *   고정 6문항 = 강사 · 반 · 학생 이름 · 연락 수단 · 결과 · 메모 → 응답 7열(타임스탬프 포함). */
const ABSENCE_CONTACT_METHODS = ['메신저', '전화', '학부모 전화', '직접 만남', '기타'];
const ABSENCE_CONTACT_RESULTS = ['연결됨 — 다음 시간에 온다고 함', '연결됨 — 사유만 확인', '답장 없음(메시지는 남김)', '학부모에게 전달', '장기 결석 — 원장 보고 필요'];
function absenceFormSpec_(ss) {
  const base = teacherMemoSpec_(ss); // 강사·반 로스터 재사용 — 아침 동기화도 같은 원천을 본다
  return {
    title: 'SYNK 결석 연락 기록 (강사용 · 24시간)',
    desc: '결석한 학생에게 연락했으면 30초로 남겨주세요. 이 기록이 시즌 등급 심사 「결석 복귀율」의 원본입니다(수업 규칙 「결석자 복귀」). 복귀 여부는 앱이 출석으로 자동 판정하니 따로 적지 않아도 됩니다.',
    teachers: base.teachers,
    classes: base.classes,
    help: {
      '학생 이름': '앱 프로필의 한글 이름 그대로 (동명이인이면 반을 정확히) · 한 명씩 따로 제출',
      '연락 수단': '기본은 메신저 · 2회 연속 결석이면 전화(수업 규칙 「결석자 복귀」)',
      '결과': '연결이 안 됐어도 제출해 주세요 — 시도 자체가 이행 기록입니다',
      '메모': '선택 · 한 줄이면 충분해요. 예: 가족 행사로 몽골 지방 다녀옴, 목요일부터 나온다고 함'
    }
  };
}
// 실제 폼을 스펙에 제자리 동기화 — 반환 = 바꾼 곳 수, 폼이 아예 없으면 -1(호출부가 생성 경로로). syncTeacherMemoForm_와 동형.
function syncAbsenceForm_(ss, st) {
  let formId = '';
  try { formId = String((getState(st, '결석폼ID') || {}).val || '').trim(); } catch (eS) {}
  if (!formId) { // ID 유실 시 응답 시트의 연결 폼에서 복구(v9.62 formAlreadyMade_ 패턴)
    try {
      const shR = ss.getSheetByName('결석폼_응답');
      const editUrl = shR && shR.getFormUrl();
      if (editUrl) { const f0 = FormApp.openByUrl(editUrl); formId = f0.getId(); setState(st, '결석폼ID', formId); setState(st, '결석폼URL', f0.getPublishedUrl()); }
    } catch (eR) {}
  }
  if (!formId) return -1;
  const form = FormApp.openById(formId);
  const spec = absenceFormSpec_(ss);
  let changed = 0;
  if (form.getTitle() !== spec.title) { form.setTitle(spec.title); changed++; }
  if (form.getDescription() !== spec.desc) { form.setDescription(spec.desc); changed++; }
  form.getItems().forEach(it => {
    const t = it.getTitle();
    const wantHelp = spec.help[t];
    if (wantHelp !== undefined && it.getHelpText() !== wantHelp) { it.setHelpText(wantHelp); changed++; }
    if (it.getType() !== FormApp.ItemType.LIST) return;
    const li = it.asListItem();
    const cur = li.getChoices().map(c => c.getValue()).join('|');
    const want = (t === '강사' ? spec.teachers : t === '반' ? spec.classes : t === '연락 수단' ? ABSENCE_CONTACT_METHODS : t === '결과' ? ABSENCE_CONTACT_RESULTS : null);
    if (want && cur !== want.join('|')) { li.setChoiceValues(want); changed++; }
  });
  if (changed) Logger.log('🔁 결석 연락 폼 동기화 — ' + changed + '곳 갱신(URL 불변)');
  return changed;
}
function createAbsenceForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  const synced = syncAbsenceForm_(ss, st); // 이미 있으면 복제 대신 제자리 업그레이드(재실행 안전)
  if (synced >= 0) {
    const msg = '✅ 결석 연락 폼 — 이미 있어 제자리 업그레이드만 했습니다(' + synced + '곳 갱신 · URL 불변): ' + String((getState(st, '결석폼URL') || {}).val || '');
    Logger.log(msg);
    return msg;
  }
  const before = ss.getSheets().map(s => s.getName());
  const spec = absenceFormSpec_(ss);
  const form = FormApp.create(spec.title).setDescription(spec.desc).setCollectEmail(false);
  setState(ensureSheet(ss, 'app_state', ['key', 'value']), '결석폼ID', form.getId()); // [v9.94] 생성 즉시 기록 — 뒤 단계(응답 시트 연결)에서 타임아웃돼도 앱이 이 폼을 잃지 않는다
  if (spec.teachers.length > 1) form.addListItem().setTitle('강사').setRequired(true).setChoiceValues(spec.teachers);
  else form.addTextItem().setTitle('강사').setRequired(true); // 로스터에 강사 0명(재건 직후)이어도 폼은 성립
  if (spec.classes.length > 1) form.addListItem().setTitle('반').setRequired(true).setChoiceValues(spec.classes);
  else form.addTextItem().setTitle('반').setRequired(true);
  form.addTextItem().setTitle('학생 이름').setRequired(true).setHelpText(spec.help['학생 이름']);
  form.addListItem().setTitle('연락 수단').setRequired(true).setChoiceValues(ABSENCE_CONTACT_METHODS).setHelpText(spec.help['연락 수단']);
  form.addListItem().setTitle('결과').setRequired(true).setChoiceValues(ABSENCE_CONTACT_RESULTS).setHelpText(spec.help['결과']);
  form.addParagraphTextItem().setTitle('메모').setHelpText(spec.help['메모']);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  linkFormTab_(ss, before, '결석폼_응답');
  setState(st, '결석폼ID', form.getId());
  setState(st, '결석폼URL', form.getPublishedUrl());
  ensureSheet(ss, 'absence_followup', ABSENCE_FOLLOWUP_HEADERS); // Glide는 "존재하는 시트"만 테이블로 잡는다 — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md)
  adminMail('[SYNK] 🔁 결석 연락 기록 폼 생성 완료',
    '강사 단톡·즐겨찾기에 배포할 링크:\n' + form.getPublishedUrl() +
    '\n\n다음 계산(14/22시, 즉시 원하면 calcAll ▶)부터 강사 수업준비 탭의 🔁 버튼과 미등원 알림 메일에 자동으로 붙습니다.\n편집용: ' + form.getEditUrl() +
    '\n\n※ 재실행해도 안전합니다(제자리 업그레이드 · URL 불변). 반·강사가 바뀌면 다음 날 아침 드롭다운이 자동 갱신됩니다.' +
    '\n⚠ 전제: 강사가 출석 1탭을 안 하면 결석 감지 자체가 열리지 않습니다(휴강 오경보 차단 가드) — 1탭이 이 지표의 유일한 입구입니다.');
  Logger.log('✅ 결석 연락 기록 폼 생성 완료: ' + form.getPublishedUrl());
  Logger.log('편집용: ' + form.getEditUrl());
}

/* ═══════════════════════════════════════════════════════════════════
 * 학생ID(SYNK-NNN) 채번 — 번호를 만드는 곳은 여기 하나다 [v9.164]
 *   상담시트에는 유일성 제약이 없다. 'SYNK-' + 번호를 다른 데서 조립하면 같은 번호가
 *   두 번 나가고, 그 순간 앱에서 두 학생이 한 사람이 된다(profiles 키가 학생ID다).
 *   ⚠ **ScriptLock은 프로젝트마다 별개다** — 그래서 채번은 이 프로젝트에서만 한다.
 *     크루카드 웹앱(별도 프로젝트)은 학생ID를 비운 채 넘기고, 채우는 건 여기뿐이다.
 * ═══════════════════════════════════════════════════════════════════ */
const 학생ID_열_ = 60;                          // BH · 상담데이터입력 v18.1~ (syncProfiles의 row[59])
const 학생ID_패턴_ = /^SYNK-(\d+)$/;
const 학생ID_발급상태_ = ['반배정', '앱편입'];   // crewcard/상담시트.js 처리상태_와 같은 낱말을 쓴다

function 학생ID_최대번호_(consult) {
  const last = consult.getLastRow();
  if (last < 3) return 0;
  const col = consult.getRange(3, 학생ID_열_, last - 2, 1).getValues();
  let max = 0;
  for (let i = 0; i < col.length; i++) {
    const m = String(col[i][0]).match(학생ID_패턴_);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

/* [v5] slice → padStart: SYNK-1000 이후 ID 중복 방지 */
function 학생ID_포맷_(n) { return 'SYNK-' + String(n).padStart(3, '0'); }

/* 처리상태가 「반배정」·「앱편입」인데 학생ID가 빈 행에 ID를 발급한다 [v9.164]
 *   유호님 요청(08-04): 「드롭다운만 바꾸면 ID가 알아서 붙게」. 손 타이핑은 없애되
 *   **사람이 결정한다는 게이트는 남긴다** — 공개 링크(크루카드) 접수가 스스로 로스터에
 *   들어오면 장난 제출 한 번이 학생 계정이 된다.
 *   재실행 안전: 이미 ID가 있으면 손대지 않는다. 이름이 빈 행에는 발급하지 않는다
 *   (syncProfiles가 row[0]을 이름으로 그대로 쓰므로 무명 학생이 생긴다).
 *   반환 = 발급 목록 [{row, name, id}] */
function 학생ID_발급_() {
  let consult;
  try {
    consult = SpreadsheetApp.openById(CONSULT_SHEET_ID).getSheetByName('상담데이터입력');
  } catch (e) { Logger.log('학생ID 발급 — 상담시트 열기 실패: ' + e); return []; }
  if (!consult) { Logger.log("학생ID 발급 — '상담데이터입력' 탭 없음"); return []; }

  const lock = LockService.getScriptLock();
  // 대기 초과는 실패가 아니다 — 다른 배치가 상담시트를 쥔 것뿐이고, morningJobs 백스톱이 다음에 잡는다.
  if (!lock.tryLock(30000)) { Logger.log('학생ID 발급 — 락 대기 초과(다음 스위프가 처리)'); return []; }
  try {
    const last = consult.getLastRow();
    if (last < 3) return [];
    const width = Math.max(학생ID_열_, consult.getLastColumn());
    const hdr = consult.getRange(2, 1, 1, width).getValues()[0];
    const colOf = {};
    hdr.forEach(function (h, i) { const k = String(h).trim(); if (k && colOf[k] === undefined) colOf[k] = i; });
    const c상태 = colOf['처리상태'];
    // 「처리상태」는 크루카드 증분 열이다 — 상담시트 업그레이드 전이면 발급 자체를 열지 않는다.
    if (c상태 === undefined) { Logger.log('학생ID 발급 — 「처리상태」 열 없음(상담시트 증분 전)'); return []; }
    const c이름 = colOf['이름(한국어)'] === undefined ? 0 : colOf['이름(한국어)'];

    const rows = consult.getRange(3, 1, last - 2, width).getValues();
    let next = 학생ID_최대번호_(consult);   // 채번 정본 — 여기서 따로 스캔하지 않는다
    const 발급 = [];
    for (let i = 0; i < rows.length; i++) {
      if (학생ID_발급상태_.indexOf(String(rows[i][c상태] || '').trim()) === -1) continue;
      if (String(rows[i][학생ID_열_ - 1] || '').trim()) continue;   // 이미 있으면 그대로 둔다
      const 이름 = String(rows[i][c이름] || '').trim();
      if (!이름) continue;                                          // 무명 행에는 발급하지 않는다
      next++;
      const id = 학생ID_포맷_(next);
      consult.getRange(3 + i, 학생ID_열_).setValue(id);
      발급.push({ row: 3 + i, name: 이름, id: id });
    }
    if (발급.length) {
      Logger.log('학생ID 발급 %s건: %s', 발급.length,
        발급.map(function (x) { return x.id + '(' + x.name + '·' + x.row + '행)'; }).join(', '));
    }
    return 발급;
  } finally { lock.releaseLock(); }
}

/* 상담시트 설치형 onEdit — 드롭다운을 바꾼 그 자리에서 ID가 보이게 한다 [v9.164]
 *   ⚠ 이름에 밑줄을 붙이지 않는다 — 트리거 핸들러·메뉴는 밑줄 종결 함수를 못 부른다(조용히 안 돈다).
 *   ⚠ 상담시트의 **모든 편집**이 이 함수를 때린다 → 시트·행·열을 좁게 확인하고 즉시 return.
 *   ⚠ 트리거가 죽어도 morningJobs의 학생ID_발급_이 같은 일을 한다(발동층 2겹). */
function onConsultEdit(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    if (sh.getName() !== '상담데이터입력') return;
    if (e.range.getLastRow() < 3) return;                 // 헤더 구역 편집은 무시
    const c상태 = sh.getRange(2, 1, 1, sh.getLastColumn()).getValues()[0].indexOf('처리상태');
    if (c상태 === -1) return;
    // 붙여넣기로 여러 열이 한꺼번에 바뀔 수 있으므로 «범위가 처리상태 열을 포함하는가»로 본다
    if (e.range.getColumn() > c상태 + 1 || e.range.getLastColumn() < c상태 + 1) return;
    const 발급 = 학생ID_발급_();
    if (발급.length) {
      sh.getParent().toast(발급.map(function (x) { return x.name + ' → ' + x.id; }).join(', '), '학생ID 발급', 8);
    }
  } catch (err) {
    Logger.log('onConsultEdit 실패(삼킴): ' + err);   // 트리거 예외가 시트 편집을 막지 않게 한다
  }
}

/* 설치형 트리거 생성 — 상담시트는 이 프로젝트의 컨테이너가 아니라 **외부 파일**이라
 * 단순 트리거(onEdit)로는 절대 안 걸린다. 재실행 안전(같은 핸들러가 있으면 안 만든다). */
function setupConsultTrigger() {
  const 있음 = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'onConsultEdit'; });
  if (있음) { Logger.log('상담시트 onEdit 트리거 이미 있음 — 새로 만들지 않는다'); return; }
  ScriptApp.newTrigger('onConsultEdit').forSpreadsheet(CONSULT_SHEET_ID).onEdit().create();
  Logger.log('✅ 상담시트 onEdit 트리거 생성 — 「처리상태」를 반배정/앱편입으로 바꾸면 학생ID가 즉시 발급됩니다');
}

/* ═══════════════════════════════════════════════════════════════════
 * 크루카드 접수 감시 [v9.171] — 접수를 「알리는」 층
 * ───────────────────────────────────────────────────────────────────
 * 왜 필요한가: 접수 알림은 `importFormResponses` 안에만 있었다(구글폼 경로). 08-04에 폼을
 *   닫으면서 그 함수는 영원히 「신규 응답 없음」으로 조기 return하게 됐고, 크루카드 doPost에는
 *   알림이 없다 → **접수가 들어와도 아무도 부르지 않는 상태**가 됐다. 쌓이기만 하는 건 자동화가 아니다.
 *
 * 🔴 왜 웹앱이 아니라 여기인가: 크루카드 doPost에서 메일을 쏘면 **익명 POST가 메일을 발사**한다
 *   — 반복 제출로 메일 폭탄을 만들 수 있는 스팸 벡터다. 그래서 알림은 «쓰는 쪽»이 아니라
 *   «읽는 쪽»에 둔다. 이미 10분마다 도는 parentSweep이 상담시트를 읽어 판단한다(새 트리거 0개).
 *
 * 판정의 축 = **「행별 최신 크루카드번호」 집합의 증가분**. 하나의 집합이 세 가지를 다 잡는다:
 *   ①새 행 등장 = 신규접수 ②미착수 재제출(그 행의 최신 번호가 교체됨) ③착수 이후 재제출
 *   (덮지 않고 번호만 앞에 붙으므로 역시 새 번호가 등장한다 — [v9.168] 잠금 케이스가
 *    「원장이 그 칸을 안 보면 영원히 모른다」였던 구멍이 여기서 메워진다).
 *   **줄어드는 것은 알리지 않는다** — 원장이 처리해서 빠진 것이지 사건이 아니다.
 * ⚠ 마지막 serial을 마커로 쓰지 않는다 — crew_cards를 비우면 채번이 001부터 다시 시작해
 *   마커보다 작아지고 그때부터 **영원히 침묵**한다(08-04 정리 때 실제로 그 상태를 만들었다).
 * ═══════════════════════════════════════════════════════════════════ */
const CREW_TAB_ = 'crew_cards';
const CREW_TZ_ = 'Asia/Ulaanbaatar';        // 채번 기준(crewcard/크루카드.js TZ_)과 같아야 «오늘»이 갈리지 않는다
const CREW_CAP_ = 300;                      // crewcard/크루카드.js DAILY_CAP 사본 — 회귀가 동치를 잠근다
const CREW_CAP_WARN_ = 0.8;                 // 상한의 80%에서 미리 알린다(막힌 뒤에 아는 건 늦다)
const CREW_WATCH_KEY_ = '크루접수_통보지문';
const CREW_CAP_KEY_ = '크루접수_상한경고일';
const CREW_WATCH_MAX_ = 200;                // 지문 보관 상한 — 넘치면 오래된 쪽이 잘린다(잘림의 대가는 오탐 1통이지 미탐이 아니다)
const CREW_ERR_TAB_ = 'crew_errors';        // 웹앱 doPost가 삼킨 오류의 착지 탭(crewcard/크루카드.js ERR_TAB 사본)

function crewIntakeWatch_(ss) {
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);

  let consult, crew, errs;
  try {
    const book = SpreadsheetApp.openById(CONSULT_SHEET_ID);
    consult = book.getSheetByName('상담데이터입력');
    crew = book.getSheetByName(CREW_TAB_);
    errs = book.getSheetByName(CREW_ERR_TAB_);   // 첫 오류 전엔 탭 자체가 없다 — 없으면 오류 0건으로 본다
  } catch (e) { Logger.log('크루접수 감시 — 상담 스프레드시트 열기 실패(조용히 스킵): ' + e); return; }

  /* 🔴 웹앱 오류 수확은 아래 두 전제조건보다 **먼저** 한다(적대 리뷰 H3).
   *   오류 알림은 상담시트 스키마와 논리적으로 무관한데, 전에는 그 가드 뒤에 있어
   *   **상담시트가 흔들리는 날 — 즉 오류가 가장 많은 날 — 감시가 먼저 죽었다.**
   *   조기 반환 경로에서도 오류만으로 1통을 보낸다. */
  const 오류행 = crewErrRows_(errs);
  if (!consult || !crew) {
    Logger.log('크루접수 감시 — 탭 없음(상담데이터입력/' + CREW_TAB_ + ')');
    crewErrOnly_(errs, 오류행);
    return;
  }

  const width = consult.getLastColumn();
  const hdr = consult.getRange(2, 1, 1, width).getValues()[0];
  const col = {};
  hdr.forEach(function (h, i) { const k = String(h).trim(); if (k && col[k] === undefined) col[k] = i; });
  const c번호 = col['크루카드번호'], c상태 = col['처리상태'];
  // 증분 전 시트면 감시할 열 자체가 없다 — 조용히 스킵하되 로그로 드러낸다(통과와 미실행이 같은 모양이면 안 된다)
  if (c번호 === undefined || c상태 === undefined) {
    Logger.log('크루접수 감시 — 상담시트 증분 전(크루카드번호/처리상태 열 없음)');
    crewErrOnly_(errs, 오류행);
    return;
  }
  const c이름 = col['이름(한국어)'] === undefined ? 0 : col['이름(한국어)'];

  const lastR = consult.getLastRow();
  const rows = lastR >= 3 ? consult.getRange(3, 1, lastR - 2, width).getValues() : [];
  const 최신 = {};              // 최신 serial → 그 행의 요약
  const 이력전문 = [];          // 유실 판정용 — 이력 문자열 전문(직전 번호까지 들어 있다)
  rows.forEach(function (r) {
    const 이력 = String(r[c번호] || '').trim();
    if (!이력) return;
    이력전문.push(이력);
    const s = (이력.match(/^SL-\d{8}-\d{3}/) || [''])[0];
    if (!s) return;
    최신[s] = {
      /* 🔒 이름은 **무토큰 익명 제출자가 지은 문자열**이고, 이 경보 메일의 본문 구조는 줄바꿈이다.
       *   그대로 실으면 이름 한 칸에 개행을 넣어 «🔴 이관 유실 의심 99건» 같은 가짜 절을 만들어
       *   원장을 오도할 수 있다(메일이 평문이라 XSS는 아니지만 «내용 위조»는 성립한다).
       *   → 공백류를 한 칸으로 접고 길이를 자른다. 원본은 crew_cards에 온전히 남는다. */
      name: (String(r[c이름] || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 40)) || '(무명)',
      상태: String(r[c상태] || '').trim(),
      재제출: 이력.indexOf('←') !== -1
    };
  });

  const 현재 = Object.keys(최신).sort();
  const 이전문 = String(getState(st, CREW_WATCH_KEY_).val || '');
  /* 🔴 접두어 `v1:`가 «저장된 적 있음»의 표식이다 — 없으면 첫 실행.
   *   처음엔 목록만 저장했는데, 접수가 0건이면 지문이 **빈 문자열**이라 「저장된 적 없음」과
   *   구별되지 않았다. 그 상태에선 초회 판정이 영영 참이라 **개원 후 첫 접수 1건이 침묵**한다
   *   — 이 장치가 막으려던 바로 그 실패다(회귀가 잡았다). 접두어는 포맷 버전 표시도 겸한다. */
  const 초회 = 이전문.indexOf('v1:') !== 0;
  const 이전 = 초회 ? [] : (이전문.slice(3) ? 이전문.slice(3).split(',') : []);
  const 새것 = 초회 ? [] : 현재.filter(function (s) { return 이전.indexOf(s) === -1; });

  // ── 유실: crew_cards에 있는데 상담시트 어디에도 안 보이는 번호 ──
  //   doPost는 이관 실패를 삼키고 로그만 남긴다(접수 자체는 성립시키려는 의도) → 그 행은
  //   원장 큐에서 «보이지 않는 채로» 사라진다. 막는 것과 유실시키는 것은 다르다.
  //   ⚠ 최근 2시간으로 좁힌다 — 세 번 이상 재제출하면 옛 번호가 이력에서 밀려나 오탐이 된다.
  const 유실 = [];
  const crewLast = crew.getLastRow();
  let 오늘건수 = 0;
  const 오늘 = Utilities.formatDate(new Date(), CREW_TZ_, 'yyyyMMdd');
  if (crewLast >= 2) {
    const n = Math.min(CREW_WATCH_MAX_, crewLast - 1);
    const vals = crew.getRange(crewLast - n + 1, 1, n, 2).getValues();   // A=submitted_at · B=ref_serial
    const 기준 = Date.now() - 2 * 60 * 60 * 1000;
    const 전문 = 이력전문.join('|');
    vals.forEach(function (v) {
      const m = /^SL-(\d{8})-(\d{3})$/.exec(String(v[1] || ''));
      if (!m) return;
      if (m[1] === 오늘) 오늘건수 = Math.max(오늘건수, Number(m[2]));   // 채번은 1부터 증가 → 최대값이 오늘 건수
      const t = v[0] instanceof Date ? v[0].getTime() : 0;
      if (t && t < 기준) return;
      if (전문.indexOf(m[0]) === -1) 유실.push(m[0]);
    });
  }

  // ── 상한 근접: 막히면 학생은 실패 화면을 보고 원장은 모른다. 하루 1회만 알린다 ──
  const capLine = (오늘건수 >= Math.floor(CREW_CAP_ * CREW_CAP_WARN_) &&
    String(getState(st, CREW_CAP_KEY_).val || '') !== 오늘)
    ? '⚠️ 오늘 접수 ' + 오늘건수 + '건 / 상한 ' + CREW_CAP_ + '건 — 상한에 닿으면 새 제출이 거부됩니다.'
    : '';

  // 지문은 알릴 게 없어도 항상 갱신한다(감소분 반영). 알림 실패로 손실되는 건 통보 1회뿐.
  setState(st, CREW_WATCH_KEY_, 'v1:' + 현재.slice(-CREW_WATCH_MAX_).join(','));
  if (초회) { Logger.log('크루접수 감시 — 기준선 %s건 저장(첫 실행은 침묵)', 현재.length); return; }
  if (!새것.length && !유실.length && !capLine && !오류행.length) return;   // 침묵이 기본값

  const 신규 = [], 갱신 = [], 잠김 = [];
  새것.forEach(function (s) {
    const r = 최신[s];
    const line = '· ' + r.name + ' (' + s + (r.상태 ? ' · ' + r.상태 : '') + ')';
    if (!r.재제출) 신규.push(line);
    else if (r.상태 === '신규접수' || r.상태 === '검토중' || !r.상태) 갱신.push(line);
    else 잠김.push(line);
  });

  const body = [];
  if (신규.length) body.push('📝 신규 접수 ' + 신규.length + '건\n' + 신규.join('\n') +
    '\n→ 상담데이터입력의 「처리상태」를 「반배정」으로 바꾸면 학생ID가 자동 발급됩니다.');
  if (갱신.length) body.push('🔄 재제출 ' + 갱신.length + '건 — 아직 착수 전이라 **최신 내용으로 갱신됐습니다**\n' + 갱신.join('\n') +
    '\n→ 따로 하실 일은 없습니다.');
  if (잠김.length) body.push('🔴 재제출 ' + 잠김.length + '건 — 이미 진행 중인 행이라 **반영하지 않았습니다**\n' + 잠김.join('\n') +
    '\n→ crew_cards 탭에서 그 번호의 원본을 열어, 바뀐 것 중 필요한 것만 손으로 옮기세요.\n' +
    '   (자동으로 덮으면 반·담당자·학생ID가 날아갑니다.)');
  if (유실.length) body.push('🔴 이관 유실 의심 ' + 유실.length + '건 — crew_cards에는 있는데 상담데이터입력에 없습니다\n' +
    유실.map(function (s) { return '· ' + s; }).join('\n') +
    '\n→ 이 접수는 원장 큐에 안 보입니다. crew_cards에서 내용을 확인해 수기로 넣거나 재제출을 안내하세요.');
  if (오류행.length) body.push(crewErr절_(오류행));
  if (capLine) body.push(capLine);

  if (quotaOk(1)) {
    const 제목 = (유실.length || 오류행.length) ? '[SYNK] 🔴 크루카드 접수 — 확인 필요'
      : (신규.length ? '[SYNK] 📝 크루카드 신규 접수 ' + 신규.length + '건' : '[SYNK] 🔄 크루카드 재제출 알림');
    MailApp.sendEmail(ADMIN_EMAIL, 제목, body.join('\n\n'));
    /* 상한 경고를 «보낸 뒤에» 오늘 표식을 남긴다 — 읽기만 하고 안 남기면 하루 1회 가드가
     * 선언만 있고 발동하지 않아 10분마다 같은 경고가 나간다(회귀가 잡은 실수).
     * 쿼터로 못 보냈을 땐 표식도 남기지 않는다 — 다음 틱이 다시 시도해야 경고가 유실되지 않는다. */
    if (capLine) setState(st, CREW_CAP_KEY_, 오늘);
    crewErrMark_(errs, 오류행);
  }
  Logger.log('크루접수 감시 — 신규 %s · 갱신 %s · 잠김 %s · 유실 %s · 웹앱오류 %s', 신규.length, 갱신.length, 잠김.length, 유실.length, 오류행.length);
}

/* ── 웹앱 오류 회수 3종 ─────────────────────────────────────────────────
 * doPost가 'internal'로 삼킨 실패는 호출자(제출자)에게만 보이고 트리거 실패 자동 메일 층
 * 밖이다 — 이 통로가 유일한 감시다. 「통보」 칸이 빈 행만 사건이고, 표식은 지문이 아니라
 * **행에** 남기므로 탭을 통째로 비워도 침묵에 빠지지 않는다.
 * 셋으로 가른 이유: 상담시트 전제조건에 걸려 조기 반환하는 경로에서도 같은 절·같은 표식
 * 규약을 써야 하는데, 본문에 인라인으로 두면 그 경로가 사본을 갖게 된다(둘은 반드시 갈라진다). */
function crewErrRows_(errs) {
  const out = [];
  if (!errs || errs.getLastRow() < 2) return out;
  const vals = errs.getRange(2, 1, errs.getLastRow() - 1, 4).getValues();
  vals.forEach(function (v, i) {
    if (String(v[3] || '').trim()) return;                        // 이미 통보한 행
    // 세 칸이 다 비면 사건이 아니라 빈 행이다 — 원장이 이 탭을 손보면(경보가 그리로 부른다)
    // 빈 행이 생기고, 그걸 오류로 세면 「🔴 웹앱 오류 498건」 같은 거짓 경보가 나간다(적대 리뷰 M1).
    if (!String(v[0] || '').trim() && !String(v[1] || '').trim() && !String(v[2] || '').trim()) return;
    out.push({
      row: i + 2,
      키: String(v[0] instanceof Date ? v[0].getTime() : (v[0] || '')),  // 표식 직전 대조용(행 밀림 방지)
      at: v[0] instanceof Date ? Utilities.formatDate(v[0], CREW_TZ_, 'MM-dd HH:mm') : String(v[0] || '').slice(0, 16),
      // 웹앱이 이미 접지만, 이 메일의 본문 구조가 줄바꿈이라 읽는 쪽에서도 접는다(2겹 — 이름 칸과 같은 계열)
      요약: (String(v[1] || '') + ' · ' + String(v[2] || '')).replace(/[\s﻿]+/g, ' ').trim().slice(0, 120)
    });
  });
  return out;
}

function crewErr절_(오류행) {
  const 보임 = 오류행.slice(0, 10);   // 폭주해도 메일은 읽을 수 있는 길이로 — 전량은 탭에 있다
  return '🔴 접수 웹앱 오류 ' + 오류행.length + '건 — 제출자가 실패 화면을 봤고, 그 접수는 시트에 없을 수 있습니다\n' +
    보임.map(function (o) { return '· ' + o.at + ' · ' + o.요약; }).join('\n') +
    (오류행.length > 보임.length ? '\n· … 외 ' + (오류행.length - 보임.length) + '건' : '') +
    '\n→ crew_errors 탭에서 원인을 보세요. 같은 시각 접수가 crew_cards에 없으면 그 지원자에게 재제출을 안내해야 합니다.';
}

/* 표식은 **보낸 뒤에만** 남긴다 — 못 보낸 틱은 표식이 없어 다음 틱이 다시 문다.
 * 10건 초과분도 남긴다(건수로 세어 알렸으므로 「통보됨」이 맞고, 안 남기면 매 틱 재경보).
 * ⚠ 스냅샷과 도장 사이(메일 발송 1~3초)에 사람이 행을 지우거나 정렬하면 인덱스가 밀려
 *   **안 알린 행에 「통보」가 찍힌다**(그 오류는 영원히 침묵). 그래서 찍기 직전 그 행의
 *   1열을 다시 읽어 스냅샷과 대조하고, 다르면 건너뛴다 — 대가는 재경보 1통이지 미탐이 아니다. */
function crewErrMark_(errs, 오류행) {
  오류행.forEach(function (o) {
    try {
      const 지금 = errs.getRange(o.row, 1).getValue();
      if (String(지금 instanceof Date ? 지금.getTime() : (지금 || '')) !== o.키) return;
      errs.getRange(o.row, 4).setValue(new Date());
    } catch (e) { Logger.log('크루접수 감시 — 오류 통보 표식 실패(행 %s): %s', o.row, e); }
  });
}

/* 상담시트 전제조건에 걸린 경로 전용 — 웹앱 오류만으로 1통. */
function crewErrOnly_(errs, 오류행) {
  if (!오류행.length || !quotaOk(1)) return;
  MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 🔴 크루카드 접수 — 확인 필요', crewErr절_(오류행));
  crewErrMark_(errs, 오류행);
  Logger.log('크루접수 감시 — 상담시트를 못 읽었지만 웹앱 오류 %s건은 알렸다', 오류행.length);
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

  // [v9.19] 상담시트 열기도 가드 — 시트 삭제/권한없음/탭명 변경 시 크래시→10분 스팸 재발 방지 (폼 가드와 대칭)
  let consult;
  try {
    consult = SpreadsheetApp.openById(CONSULT_SHEET_ID).getSheetByName('상담데이터입력');
  } catch (e) { Logger.log('상담시트 열기 실패 — CONSULT_SHEET_ID/권한 확인: ' + e); return; }
  if (!consult) { Logger.log("상담시트에 '상담데이터입력' 탭 없음 — 탭 이름 확인"); return; }

  const lock = LockService.getScriptLock();
  lock.waitLock(60000);
  try {
    const lastC = Math.max(62, consult.getLastColumn()); // [v9.66] v18.4 — 증분 열(63~)도 이름 매칭 대상
    const headers = consult.getRange(2, 1, 1, lastC).getValues()[0]; // [v8.4] v18.1 · 헤더 2행
    const colOf = {};
    headers.forEach((h, i) => { const k = String(h).trim(); if (k && !colOf[k]) colOf[k] = i + 1; }); // [v9.66·리뷰 M2] 중복 헤더는 첫 열 우선 — 시트 오른쪽에 같은 이름의 보조 열이 생겨도 정본 열이 이긴다

    const fr = ensureSheet(ss, 'form_responses', ['접수ID', '타임스탬프', '이름', '경로', '처리상태']); // [v9.34] 무가드 참조 → 시트 부재 시 채번 후 크래시·같은 응답 10분마다 재기입(증식) 차단
    let newTs = lastTs;

    /* [v9.167] 이 함수는 더 이상 학생ID를 발급하지 않는다 — 게이트를 크루카드와 통일한다.
     *   실측(08-04): app_state '상담폼ID'가 살아 있고 폼은 「게시됨」이다 → 이 경로는 지금도 10분마다 돈다.
     *   구 동작은 «폼 제출 = 즉시 학생ID = 앱 로스터»였다. 크루카드는 정반대로 사람이 처리상태를
     *   「반배정」으로 바꿔야 발급된다([v9.164]). 같은 시트에 정책이 둘이면 느슨한 쪽이 실질 정책이다.
     *   → 폼 행도 「신규접수」로 큐에 넣고 발급은 학생ID_발급_ 하나에 맡긴다(채번 통로 = 정말로 한 곳). */
    const c처리상태 = colOf['처리상태'], c접수출처 = colOf['접수출처'];
    if (c처리상태 === undefined) {
      // 상담시트 증분(크루카드 업그레이드) 전 상태. 발급도 큐잉도 못 하므로 눈에 보이게 남긴다.
      Logger.log('⚠️ 상담시트에 「처리상태」 열이 없다 — 폼 접수 행이 발급 큐에 안 잡힌다(크루카드 시트 업그레이드 필요)');
    }

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

      // 빈 행 찾기 (A열 기준) — [v9.19] 600행 창이 꽉 차면 3행 덮어쓰기 대신 시트 끝에 append
      // [v9.54] 창을 시트 물리 행수로 클램프 — 외부 상담시트에서 누가 빈 행을 지워 총 행<602가 되면
      //   고정 600행 읽기가 Range 예외를 던져 10분 스위프가 반복 실패하던 위험 제거
      const winRows = Math.min(600, consult.getMaxRows() - 2);
      let newRow = -1;
      if (winRows > 0) {
        const colA = consult.getRange(3, 1, winRows, 1).getValues();
        for (let i = 0; i < colA.length; i++) {
          if (!colA[i][0]) { newRow = i + 3; break; }
        }
      }
      if (newRow === -1) newRow = consult.getLastRow() + 1;

      // 행 데이터 배열(1~60열) 한 번에 구성 → 일괄 쓰기
      const rowArr = new Array(59).fill(''); // [v8.4] 입력 A~BG(59열)
      const extArr = lastC > 62 ? new Array(lastC - 62).fill('') : null; // [v9.66·리뷰 H1] v18.4 증분(63~lastC)은 조밀 배치 — 무응답 칸도 ''로 덮어 재사용 행의 이전 학생 잔재(비자·재정 민감정보)를 차단. 60~62열(학생ID·자동열)은 보호 구간
      Object.keys(ans).forEach(title => {
        const c = colOf[title];
        if (c && c <= 59) rowArr[c - 1] = ans[title];
        else if (extArr && c >= 63) extArr[c - 63] = ans[title];
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
      // [v9.157] 폼 답 = 외부인의 글 — '='·'+'·'-' 선두는 상담시트(수강·납입 동거)에서 라이브 수식이 된다.
      //   행소독_(Code.js 공용 통로)로 문자열만 소독 — 생년월일 Date·등록일 ts는 타입 보존(Date 변환이 위에서
      //   먼저 끝난 뒤라 파싱과 간섭 없음). profiles는 writeIfChanged 채널이 막지만 이 시트는 직기입이라
      //   이 함수의 관문이 여기다(같은 시트에 쓰는 다른 경로는 각자의 관문을 통과해야 한다 — 크루카드 웹앱 등).
      // [v9.167] 운영 흐름 열은 응답이 아니라 **이 경로가** 채운다 — 폼에는 해당 문항이 없다.
      //   행 재사용 시 옛 값이 남지 않도록 extArr 안에서 덮는다(60~62 보호 구간은 그대로 건너뜀).
      if (extArr && c처리상태 !== undefined && c처리상태 >= 63) extArr[c처리상태 - 63] = '신규접수';
      if (extArr && c접수출처 !== undefined && c접수출처 >= 63) extArr[c접수출처 - 63] = '구글폼';

      consult.getRange(newRow, 1, 1, 59).setValues(행소독_([rowArr]));
      if (extArr) consult.getRange(newRow, 63, 1, extArr.length).setValues(행소독_([extArr])); // [v9.66·리뷰 H1] 증분 구간 통째 1회 쓰기(60~62 건너뜀) — 개별 setValue였다면 행 재사용 시 옛 학생 값이 남았다

      // ⚠ 학생ID는 여기서 채우지 않는다 — 채우는 순간 공개 폼 제출이 곧 앱 로스터가 된다.
      //   발급 통로는 학생ID_발급_ 하나(처리상태 「반배정」·「앱편입」 · onConsultEdit + morningJobs 백스톱).

      // form_responses 기록
      const frRow = fr.getLastRow() + 1;
      fr.getRange(frRow, 1, 1, 4).setValues(행소독_([[
        'R' + String(frRow).padStart(3, '0'), ts,
        ans['이름(한국어)'] || ans['이름(몽골어)'] || '(무명)', '폼 자동접수' // [v9.157] 이름도 폼 유래 — form_responses(본 시트, profiles 동거)도 같은 관문
      ]]));
    });

    setState(st, '폼처리시각', newTs);
  } finally { lock.releaseLock(); }

  if (quotaOk(1)) {
    MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 📝 신규 상담 접수 ' + responses.length + '건',
      '새 상담 설문이 상담시트에 「신규접수」로 기록되었습니다.\n' +
      '앱에 넣으려면 상담데이터입력의 「처리상태」를 「반배정」으로 바꾸세요 — 학생ID가 자동 발급됩니다.'); // [v9.167] 크루카드와 같은 게이트
  }
  syncProfiles();
  Logger.log('폼 응답 ' + responses.length + '건 처리');
}

/* ===================== 스토어 상품 (contents) ===================== */

function setupStore() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // [v9.54] 구 6열 clear/압축 패턴 폐기 → replaceContentType 위임(전체 열 폭 보존).
  //   구 패턴은 A~F만 지우고 위로 압축해, 라이브 시트의 몽골어(G)·영어(H)·Glide Row ID가 옛 행 위치에
  //   남아 생존 행 전체가 오정렬됐다(다른 15개 유형은 v5.2부터 위임인데 이 함수만 잔존).
  //   preflight 자동복구가 store 0개일 때 이 함수를 자동 실행하므로 손 실행 없이도 밟힐 수 있던 지뢰.
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
    // [v9.83] ST18 싱크 과잠 — 스토어에서 하차(판매 중단). 유호 07-31 확정: 포인트로 사는 상품이 아니라
    //   **재원 12개월 + 누계 하한 = 무료 지급 자격**(JACKET_* 상수 · jacketWatch_). point_logs에 구매 음수 행이
    //   생기지 않으므로 학생은 과잠을 기다리면서도 간식·굿즈를 마음껏 산다.
    ['ST19','store','가족 외식 상품권','가족','',1500],
    ['ST20','store','어버이날 K-플라워 박스 배달','가족','',1500],
    ['ST21','store','스튜디오 스타일 가족사진 촬영','체험','',2000],
    ['ST22','store','K-아이돌 메이크업+프로필 촬영','체험','',2000]
  ];
  replaceContentType(ss, 'store', items);
}

/* ===================== [v9.83] 🧥 과잠 자격 워처 ===================== */
// 매일 아침(morningJobs). 재원 JACKET_TENURE_MONTHS개월 + 누적 획득 JACKET_MIN_POINTS 도달 학생을
// jacket_grants 시트에 1회만 적재하고 원장에게 지급 명단을 알린다.
// 멱등: 시트에 이미 있는 학생은 건너뛴다(신규 0명이면 쓰기·메일 모두 없음 = 무비용).
// 잔액(AQ)은 건드리지 않는다 — 무료 지급이자, 학생이 그동안 간식·굿즈를 산 것과 무관하게 자격이 유지되는 이유.
function jacketWatch_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // [v9.83·리뷰 B2] 이중 경로 감시 — setupStore()는 코드 정본을 바꿀 뿐 라이브 contents 시트를 자동으로 고치지 않는다.
  //   ▶ 실행 전까지 학생 화면에는 과잠이 1,700P 상품으로 남아, 사서도 받고 자격으로도 받는 두 경로가 동시에 열린다.
  //   store는 CONTENT_CUSTOM_TYPES(사람이 채운 값이 정본)라 preflight 자동복구가 0개일 때만 도므로 여기서 잡는다.
  //   문서에 "배포 후 setupStore ▶"라고 적어두는 것으로는 안 지켜지므로, 남아 있는 동안 매일 알린다(내용 같으면 dedup).
  try {
    const ctJ = ss.getSheetByName('contents');
    const stJ = ss.getSheetByName('app_state');
    if (ctJ && stJ && ctJ.getLastRow() >= 2) {
      const live = ctJ.getRange(2, 1, ctJ.getLastRow() - 1, 3).getValues()
        .some(r => String(r[1]) === 'store' && String(r[2]).trim() === JACKET_ITEM_NAME);
      const sig = live ? 'ON' : '';
      if (String((getState(stJ, '과잠_스토어잔존').val || '')) !== sig) {
        if (live && quotaOk(1)) {
          adminMail('[SYNK] ⚠️ ' + JACKET_ITEM_NAME + '이 아직 스토어에 남아 있습니다',
            'v9.83에서 과잠은 판매 상품이 아니라 **재원 ' + JACKET_TENURE_MONTHS + '개월 무료 지급 자격**으로 바뀌었지만,\n' +
            '라이브 contents 시트에는 옛 상품 행이 그대로 있어 학생이 포인트로도 살 수 있는 상태입니다(이중 경로).\n\n' +
            '고치는 법: Apps Script에서 setupStore ▶ 1회 실행 → 이어서 translateContents ▶ 1회(몽골어 복원).\n' +
            '실행하면 이 알림은 자동으로 멈춥니다.');
        }
        setState(stJ, '과잠_스토어잔존', sig);
      }
    }
  } catch (eJ) { Logger.log('과잠 스토어 잔존 검사 실패(무해·다음 실행 재시도): ' + eJ); }

  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return; // 콜드 가드 — 로스터 없으면 판정 자체를 열지 않는다
  const gr = ensureSheet(ss, 'jacket_grants', ['student_id', '이름', '자격도달일', '재원개월', '누적P', '지급상태']);
  const already = new Set();
  if (gr.getLastRow() >= 2) gr.getRange(2, 1, gr.getLastRow() - 1, 1).getValues()
    .forEach(r => { if (r[0]) already.add(String(r[0]).trim()); });

  const tz = ss.getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const now = new Date();
  const rows = pf.getRange(2, 1, pf.getLastRow() - 1, 16).getValues();
  const out = [];
  rows.forEach(r => {
    const sid = String(r[0] || '').trim();
    if (!sid || r[3] !== 'student' || already.has(sid)) return;
    if (!r[14]) return;                                   // created_at 없는 행은 재원 개월을 셀 수 없다
    const joined = asDate_(r[14]);
    if (!joined || isNaN(joined.getTime())) return;
    const months = (now.getFullYear() - joined.getFullYear()) * 12 + (now.getMonth() - joined.getMonth())
      - (now.getDate() < joined.getDate() ? 1 : 0);        // 만 개월(일자 미달이면 1개월 차감)
    const pts = Number(r[15]) || 0;                       // P열 = 획득 누계(잔액 AQ 아님 — 소비해도 안 깎인다)
    if (months >= JACKET_TENURE_MONTHS && pts >= JACKET_MIN_POINTS)
      out.push([sid, r[1] || sid, today, months, pts, '지급대기']);
  });
  if (!out.length) return;

  gr.getRange(gr.getLastRow() + 1, 1, out.length, 6).setValues(out);
  if (quotaOk(1)) {
    adminMail('[SYNK] 🧥 ' + JACKET_ITEM_NAME + ' 지급 대상 ' + out.length + '명',
      out.map(o => '· ' + o[1] + ' (' + o[0] + ') — 재원 ' + o[3] + '개월 · 누적 ' + o[4] + 'P').join('\n') +
      '\n\n조건: 재원 ' + JACKET_TENURE_MONTHS + '개월 이상 + 누적 획득 ' + JACKET_MIN_POINTS + 'P 이상.' +
      '\n포인트 차감 없는 무료 지급입니다. 실물을 전달한 뒤 jacket_grants 시트의 「지급상태」를 「지급완료」로 바꿔주세요.');
  }
  Logger.log('🧥 과잠 자격 신규 ' + out.length + '명');
}

/* ===================== 시스템 헬스체크 (일요일) ===================== */

function healthCheck() {
  // [v9.25] 점검 항목(누락 시트·point_logs 행수·메일 쿼터)은 systemWatchdog로 흡수됨.
  //          수동 실행·구 트리거 호환을 위해 얇은 위임만 남긴다.
  systemWatchdog();
}

/* ===================== 1회용 유틸 ===================== */

function cleanupFormTest() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const consult = SpreadsheetApp.openById(CONSULT_SHEET_ID).getSheetByName('상담데이터입력');
  const winRows2 = Math.min(600, consult.getMaxRows() - 7); // [v9.54] 물리 행수 클램프(importFormResponses와 동일 처방)
  /* [v9.167] ⚠ 이 함수는 「A열에 값이 있으면 지운다」였다 — 상담시트가 테스트판이던 시절의 전제다.
   *   지금 이 시트에는 크루카드 실접수와 발급된 학생이 함께 산다. 편집기 함수 드롭다운은 합성 클릭에
   *   미끄러지는 것으로 실측됐고(08-04), 한 번 잘못 고르면 8행 아래가 통째로 지워진다 — 되돌릴 수 없다.
   *   → **자기 것만 지운다**: 학생ID가 붙은 행(실학생)과 크루카드 접수 행은 건드리지 않는다. */
  const width = Math.max(68, consult.getLastColumn());
  const hdr = consult.getRange(2, 1, 1, width).getValues()[0];
  const idx = {};
  hdr.forEach((h, i) => { const k = String(h).trim(); if (k && idx[k] === undefined) idx[k] = i; });
  const c출처 = idx['접수출처'];
  const rows = winRows2 > 0 ? consult.getRange(8, 1, winRows2, width).getValues() : [];
  let cleaned = 0, 보호 = 0;
  rows.forEach((r, i) => {
    if (!r[0]) return;
    const 실학생 = String(r[학생ID_열_ - 1] || '').trim();
    const 출처 = c출처 === undefined ? '' : String(r[c출처] || '').trim();
    if (실학생 || (출처 && 출처 !== '구글폼')) { 보호++; return; }   // 폼 테스트 잔재만 지운다
    consult.getRange(8 + i, 1, 1, width).clearContent(); cleaned++; // [v9.66] v18.4 증분 열까지 청소(폭 동적)
  });
  const st = ensureSheet(ss, 'app_state', ['key', 'value']);
  setState(st, '폼처리시각', 0);
  const fr = ensureSheet(ss, 'form_responses', ['접수ID', '타임스탬프', '이름', '경로', '처리상태']); // [v9.34] 무가드 정리(3곳 일괄)
  const frLast = fr.getLastRow();
  if (frLast >= 2) {
    fr.getRange(2, 1, frLast - 1, 4).getValues().forEach((r, i) => {
      if (String(r[3]) === '폼 자동접수') fr.getRange(2 + i, 1, 1, 5).clearContent();
    });
  }
  Logger.log('정리: %s건 · 보호(실학생·크루카드 접수): %s건', cleaned, 보호); // [v9.167] 안 지운 것도 세어 보여준다 — 「0건 정리」가 성공으로 읽히면 안 된다
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
// [v9.19] 죽은 최상단 nickOf 블록 삭제 — 리포트카드 v2는 별명을 profiles AO(r[40])에서 직접 읽음.
//          (구 블록은 미사용 + 매 트리거 실행마다 profiles 조회 + safeRun 밖 크래시 위험이었음)

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
  const w = Math.min(pf.getLastColumn(), 81); // [v9.19→함께한날 막4] CC81(맞힌말수)까지 — 카드가 「함께한 날·맞힌 말」을 싣는다
  const pfData = pf.getRange(2, 1, pf.getLastRow() - 1, w).getValues();
  const students = pfData.filter(r => r[0] && r[3] === 'student');
  const logsById = readAcademicLogs_(ss, tz); // [v9.19] academic_log — 급수변화·모의 점수 차트
  const monMap = monsterImgMap_(ss);          // [v9.19] 단계명 → 이미지URL

  const rc = ensureSheet(ss, 'report_cards',
    ['card_id', 'student_id', '월', 'image_url', '칭호', '코멘트', 'created_at']);
  /* [v9.126] 🔴 월 열 Date 오염 = 이 멱등 가드의 사망 지점 — 08-02 라이브에서 37행(정상 9행)이 발견됐다.
   *   `setValues`로 '2026-08' 문자열을 쓰면 시트가 날짜로 자동 파싱해 Date로 되읽히고, 셀 표시는 여전히
   *   '2026-08'이라 눈으로는 멀쩡하다. 그런데 String(Date)='Fri Aug 01 2026…' ≠ ym → **가드가 영영 안 맞고
   *   매 실행이 전원 카드를 다시 만든다**(Slides 복제·Drive 파일·학부모 메일이 매번 중복). 학부모 화면엔
   *   같은 카드가 6장 쌓여 있었다. v9.97이 스토리북에서 잡은 것과 같은 계급인데 이 시트만 배선이 빠져 있었다.
   *   ①열을 텍스트로 정상화 ②비교값도 ymTextOf_로 정규화 — 둘 다 해야 과거 오염분까지 산다. */
  ymTextColFix_(rc, 3, tz);
  const done = new Set();
  if (rc.getLastRow() >= 2) {
    rc.getRange(2, 1, rc.getLastRow() - 1, 3).getValues().forEach(r => {
      done.add(ymTextOf_(r[2], tz) + '|' + r[1]);
    });
  }
  const pendingAll = students.filter(r => !done.has(ym + '|' + r[0]));
  if (!pendingAll.length) { Logger.log('리포트카드: ' + ym + ' 전원 생성 완료'); return; }
  const pending = pendingAll.slice(0, MAX_CARDS_PER_RUN);

  // [v9.19b] Phase 1a: 복제만 (구조 변경) → saveAndClose
  const pres = SlidesApp.openById(REPORT_TEMPLATE_ID);
  const tpl = reportTemplateSlide_(pres); // [v9.19b] 빈 슬라이드가 아니라 자리표시자 디자인 슬라이드를 복제
  const made = [];
  pending.forEach(r => {
    const d = reportCardData_(r, logsById[r[0]], monMap, now);
    d.month = label;
    made.push({ d: d, pageId: tpl.duplicate().getObjectId() });
  });
  pres.saveAndClose();
  // [v9.19b] Phase 1b: 재열기 후 채우기 (복제+편집 동일 배치의 "This request cannot be applied" 회피)
  const presF = SlidesApp.openById(REPORT_TEMPLATE_ID);
  const slById = {};
  presF.getSlides().forEach(s => { slById[s.getObjectId()] = s; });
  made.forEach(m => { const s = slById[m.pageId]; if (s) fillReportCardSlide_(s, m.d); });
  presF.saveAndClose();

  // Phase 2: PNG 추출 → Drive 저장 → 시트 기록 (+옵션: 학부모 메일)
  const it = DriveApp.getFoldersByName(REPORT_FOLDER_NAME);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(REPORT_FOLDER_NAME);
  const rows = [], mails = [];
  // [v9.155] shareFail/shareFirstErr 제거 — 공개 공유를 하지 않으므로 실패할 대상이 없다(감시는 미발송으로 이관)
  made.forEach(m => {
    Utilities.sleep(350); // [v5.3] 연속 export 429 방지
    try { // [v9.19] 카드별 격리 — 1건(429 등) 실패가 배치 전체를 중단·중복 생성시키지 않도록
      const blob = exportSlidePng(REPORT_TEMPLATE_ID, m.pageId)
        .setName(ym + '_' + m.d.sid + '_' + m.d.name + '.png');
      const file = folder.createFile(blob);
      /* [v9.138] ⚠ 여기의 공개 공유는 **의도적으로 남긴다** — 지우면 학부모 화면이 빈다.
       *   이 URL은 아래 report_cards.image_url(D열)에 박히고, Glide 학부모 「성장 리포트」 탭의
       *   Image 컴포넌트가 그 주소로 그림을 읽는다. Glide는 이 Drive 파일에 로그인할 수단이 없어서
       *   비공개로 바꾸면 카드가 전부 깨진 이미지가 된다. 게다가 SEND_REPORT_EMAIL=false라
       *   **지금은 메일도 안 나가므로 이 탭이 학부모에게 카드가 닿는 유일한 통로**다.
       *   같은 세션에서 previewOneReportCard의 공개 공유는 없앴는데(그건 호출자가 0이라 아무것도
       *   사지 못하는 공유였다) 여기를 남긴 건 봐준 게 아니라 **기능이 매달려 있어서**다.
       *   ▣ 남은 위험(축소했지만 0은 아니다): 링크를 아는 사람은 인증 없이 카드를 본다. Drive
       *     공개 링크에는 만료가 없어서 한 번 새면 영구다. 완화책은 둘이고 성격이 다르다 —
       *     ①**폴더를 「제한됨」으로 잠근다** — 2026-08-03 실행 결과로 **손실 0이 아님이 판명**됐다.
       *       잠그기 전 이 폴더는 익명으로 목록 조회·전체 다운로드까지 됐고, 잠그자 유출은 닫혔지만
       *       **학부모 카드도 함께 죽었다.** 원인: 아래 setSharing이 「액세스가 거부됨: DriveApp」으로
       *       **줄곧 실패해 catch로 빠지고 있었고**, 카드의 공개는 전부 폴더 상속이었다(카드마다
       *       자기 공유가 있다는 것은 코드의 의도였을 뿐 라이브의 사실이 아니었다 — 잠근 뒤
       *       `2026-08_SYNK-001_*.png`가 「비공개」로 바뀌는 것으로 확인). 그러니 폴더를 잠근 상태를
       *       유지하려면 **이 setSharing이 실제로 성공하도록 고치는 일이 선행**돼야 한다.
       *     ②「N개월 지난 카드는 공유 해제」: 그만큼 과거 달 카드가 앱에서 사라진다 —
       *       보안과 학부모 편의의 교환이라 유호님 결정 사안으로 올렸다(2026-08-03).
       *   ▣ 여기를 고치려는 다음 세션에게: 먼저 Glide 「성장 리포트」 탭이 이 URL을 안 쓰게
       *     바꾼 다음에 닫아라. 순서가 반대면 라이브 화면이 먼저 죽는다. — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md) */
      /* [v9.140] 실패를 세고 **알린다**. 구 코드는 '폴더 공유 설정으로 대체'라고만 로그했는데,
       *   그 문장이 문제를 몇 달 숨겼다 — 실제로 이 호출은 줄곧 실패하고 있었고, 카드가 열려 보인 건
       *   폴더가 공개였기 때문이다. 폴더를 잠근 지금 그 대체 수단은 **존재하지 않으므로**,
       *   조용히 넘어가면 학부모 화면이 이유 없이 빈 채로 남는다. */
      /* [v9.155] 🔒 공개 공유를 **하지 않는다**(유호님 08-04 「B로 가자」 결정 · 근거·경위 = docs/개인정보처리방침_초안_v1.md §0-B).
       *   구 설계는 학생 실명·급수·포인트가 박힌 PNG를 ANYONE_WITH_LINK로 열어 Glide 학부모 탭이 읽게 했다.
       *   Drive 공개 링크에는 만료가 없어 한 번 새면 영구이고, 그 상태를 개인정보처리방침에 정직하게 적으려니
       *   「링크를 아는 사람은 누구나 봅니다」가 되어 — 유호님이 그 문장을 쓰는 대신 구조를 바꾸기로 했다.
       *   ⚠ **지금이 가장 싼 시점이다**: 실학생 0명(카드는 데모·테스트분뿐)이라 깨질 학부모 화면이 없다.
       *   대체 통로 = **메일 PNG 첨부**(SEND_REPORT_EMAIL을 기본 true로 승격 · Code.js).
       *   ⚠ url은 계속 기록한다 — 원장이 로그인 상태로 열어 확인하는 내부 경로이고, 학부모 화면은
       *     Glide에서 이미지 컴포넌트를 걷어내는 것으로 정리한다(유호님 몫 · 설치 문서에 안내). */
      const url = 'https://lh3.googleusercontent.com/d/' + file.getId();
      rows.push([ym + '-' + m.d.sid, m.d.sid, ym, url,
        m.d.title, m.d.comment, new Date()]);
      if (SEND_REPORT_EMAIL && m.d.pEmail.indexOf('@') > -1) {
        // [v9.31] 공개 URL 링크 대신 PNG를 메일 첨부로 — 미성년 실명·성적이 메일 전달·캡처로 새는 경로 차단
        mails.push({ to: m.d.pEmail, name: m.d.name, blob: blob.copyBlob(), pts: m.d.pointsText, attend: m.d.attendText });
      }
    } catch (e) { Logger.log('카드 생성 실패(' + m.d.name + ') — 스킵, 다음 실행 때 재시도: ' + e); }
  });
  if (rows.length) rc.getRange(rc.getLastRow() + 1, 1, rows.length, 7).setValues(rows);

  /* [v9.155] 감시 대상 교체 — 「공유 실패」에서 **「카드가 학부모에게 못 간 학생」**으로.
   *   구 감시(v9.140·143)는 공개 공유가 실패하면 학부모 탭이 빈다는 것을 잡았다. 이제 공개 공유를
   *   하지 않으므로 그 실패는 존재하지 않고, 대신 **보낼 이메일이 없으면 카드가 아무에게도 닿지 않는다**
   *   — 조용한 실패의 자리가 그리로 옮겨간 것이다(장치를 지울 때는 그 장치가 지키던 것이 어디로
   *   갔는지 함께 옮긴다). 카드는 만들어지고 시트에도 적히므로 배치는 여전히 "성공"이라 말한다. */
  const noMail = rows.length - mails.length;
  if (noMail > 0) {
    Logger.log('⚠ 리포트카드 ' + noMail + '장이 발송되지 않았습니다(보호자 이메일 없음)');
    adminMail('[SYNK] ⚠️ 리포트카드 ' + noMail + '장 미발송 — 보호자 이메일 없음',
      '이번 ' + label + ' 카드 ' + rows.length + '장 중 ' + noMail + '장을 **보내지 못했습니다.**\n' +
      '보호자 이메일(profiles Z열)이 비어 있는 학생입니다.\n\n' +
      '[v9.155] 카드는 이제 **메일 첨부로만** 전달됩니다(공개 링크 폐지 — 유호님 08-04 결정).\n' +
      '즉 이메일이 없는 학생의 카드는 만들어져도 보호자에게 닿지 않습니다.\n\n' +
      '조치: 상담시트에서 그 학생의 보호자 이메일을 채우면 다음 배치부터 자동 발송됩니다.\n' +
      '(원장님은 Drive ' + REPORT_FOLDER_NAME + ' 폴더에서 로그인 상태로 직접 보실 수 있습니다.)');
  }

  if (mails.length && quotaOk(mails.length)) {
    mails.forEach(m => {
      MailApp.sendEmail(m.to, '[SYNK] 📮 ' + m.name + ' 학생 ' + label + ' 성장 리포트',
        m.name + ' 학생의 ' + label + ' 성장 리포트가 도착했어요!\n\n' +
        '포인트 ' + m.pts + ' · 출석 ' + m.attend + '\n' +
        '리포트 카드는 첨부된 이미지로 확인해 주세요. 📎\n\n' +
        '한 달 동안 수고 많았습니다. 다음 달도 함께 성장해요!\n- 뇌과학으로 배우는 한국어, SYNK',
        { attachments: [m.blob] });
    });
  }

  // Phase 3: 임시 슬라이드 정리 (템플릿 1장만 유지)
  const pres2 = SlidesApp.openById(REPORT_TEMPLATE_ID);
  const rm = new Set(made.map(m => m.pageId));
  pres2.getSlides().forEach(sl => { if (rm.has(sl.getObjectId())) sl.remove(); });
  pres2.saveAndClose();

  // [v9.34] 잔여에 이번 배치 실패분(pending - rows)도 가산 — 마지막 배치에서 실패하면 remaining=0으로 굳어
  //   '전원 완료' 거짓 메일 + 그달 카드 영구 미생성(다음 달 ym이 바뀌어 재시도 없음)되던 결함 수정
  const remaining = pendingAll.length - rows.length;
  const propsRC = PropertiesService.getScriptProperties();
  if (rows.length === 0 && pending.length > 0) { // [v9.34] 연속 0장 = 영구 오류(권한·템플릿) 의심 → 무한 4분 재시도 루프 차단
    const zeroN = (Number(propsRC.getProperty('리포트카드_연속0장')) || 0) + 1;
    propsRC.setProperty('리포트카드_연속0장', String(zeroN));
    if (zeroN >= 2) {
      adminMail('[SYNK] ⚠️ 리포트카드 생성 중단 (' + label + ')',
        '연속 ' + zeroN + '회 실행에서 카드가 1장도 생성되지 않아 자동 이어하기를 중단했습니다. 잔여 ' + remaining + '장.\n' +
        '실행 로그·Drive 권한·리포트 템플릿(REPORT_TEMPLATE_ID)을 확인한 뒤 monthlyReportCards()를 수동 실행하세요.');
      Logger.log('리포트카드: 연속 ' + zeroN + '회 0장 — 체인 중단');
      return;
    }
  } else if (rows.length > 0) propsRC.setProperty('리포트카드_연속0장', '0');
  if (remaining > 0) {
    ScriptApp.newTrigger('reportCardsContinue').timeBased().after(4 * 60 * 1000).create();
    Logger.log('카드 ' + rows.length + '장 생성 · 잔여 ' + remaining + '장(실패 재시도 포함) — 4분 후 자동 이어하기');
  } else {
    if (quotaOk(1)) {
      MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 📮 ' + label + ' 리포트카드 생성 완료',
        '이번 실행 ' + rows.length + '장 생성 — ' + label + ' 카드 전원 완료.\n' +
        'Drive 폴더: ' + REPORT_FOLDER_NAME + '\n앱의 report_cards에서 확인하세요.');
    }
    Logger.log('리포트카드 완료: ' + rows.length + '장');
  }
}
// [v9.20] 죽은 코드 정리: reportComment 삭제 — v9.19 리포트카드 v2가 reportCardComment_로 대체(호출부 0).

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
function monsterImgMap_(ss) { // [함께한날 막4] 이름은 그대로(소비자 둘) — 내용은 «가이드» 이름→이미지다
  const ct = ss.getSheetByName('contents'), map = {};
  if (ct && ct.getLastRow() >= 2) ct.getRange(2, 1, ct.getLastRow() - 1, 6).getValues().forEach(r => {
    if (r[1] === 'guide' && r[2]) map[String(r[2])] = String(r[4] || '');
  });
  return map;
}

// [함께한날 막7] 구 monsterOrder_(단계명→순서) 소각 — 마지막 소비자(진화 업적 티어)가 «맞힌 말» 문턱으로 갈렸다.

// [v9.22] point_logs + point_logs_archive 병합 읽기 (cols 열까지) — 아카이브 병합 규칙 단일 소스
function readPointLogs_(ss, cols) {
  return ['point_logs', 'point_logs_archive'].reduce((acc, name) => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return acc;
    return acc.concat(sh.getRange(2, 1, sh.getLastRow() - 1, cols).getValues());
  }, []);
}

// 이번 달 시작~오늘까지 반유형(평일/주말) 예정 수업일 수 (개근 판정용 · calcAll의 수업일 개념과 동일)
function scheduledSoFar_(type, now) {
  const y = now.getFullYear(), m = now.getMonth(), today = now.getDate();
  let c = 0;
  for (let dd = 1; dd <= today; dd++) {
    if (classDowOk_(type, new Date(y, m, dd).getDay())) c++; // [v9.46] 주말반=토요일만 — 일요일이 분모를 부풀려 주말반이 불리하던 것 해소
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
  // [v9.19] 모의점수·Δ는 academic_log에서 직접 산출 — 차트·급수와 일관 + calcAll(BP/BQ 갱신) 전에도 정확
  const curMock = mocks.length ? (Number(mocks[mocks.length - 1].val) || 0) : null;
  const prevMock = mocks.length >= 2 ? (Number(mocks[mocks.length - 2].val) || 0) : null;
  const bp = curMock;
  const delta = (curMock != null && prevMock != null) ? (curMock - prevMock) : null;
  const type = String(r[35] || '평일'); // AJ 반유형
  const schSoFar = scheduledSoFar_(type, now);
  const attendCount = Number(r[21]) || 0; // V 이번달출석
  const gaegeun = schSoFar >= 1 && attendCount >= schSoFar;
  // [함께한날 막4] 카드의 성장 줄 = 함께한 날 + 내가 맞힌 말(설계 §4-6 — 「스파키 · 2단계」의 자리).
  //   🔴 「함께한 날」은 성취 블록이 아니라 «사실 눈금»으로만 싣는다 — 시간의 흐름을 성취처럼 배치하면
  //   학부모가 과장으로 읽는다(설계 §3). 여기 stageText 는 눈금 줄이라 그 금지에 안 걸린다.
  const guideNm = String(r[54] || '') || '몽글'; // BC 고른가이드(미선택 = 몽글)
  const daysTogether = Number(r[30]) || 0;       // AE 함께한날
  const mastered = Number(r[80]) || 0;           // CC 맞힌말수(AI 출처 도달)
  const d = {
    sid: r[0], name: r[1] || r[0], cls: String(r[4] || 'SYNK'), pEmail: String(r[25] || '').trim(),
    nickname: String(r[40] || '') || guideNm, // AO 애칭 (없으면 고른 가이드 이름)
    levelText: levelText, levelUp: levelUp, fromLv: prevLv, toLv: curLv,
    mockText: (bp != null && !isNaN(bp)) ? String(bp) : '—', hasMock: mocks.length > 0,
    scoreText: (delta == null) ? '—' : (delta > 0 ? '+' + delta : String(delta)), delta: delta,
    attendText: attendCount + '일' + (gaegeun ? ' · 개근' : ''), attendCount: attendCount, gaegeun: gaegeun,
    stageText: '함께한 날 ' + daysTogether + ' · 맞힌 말 ' + mastered, // {{몬스터단계}} 마커 이름은 코드 밖(Slides 템플릿)이라 유지 — 라벨 갱신은 유호님 몫(Code.js 「남은 빚」)
    title: String(r[33] || '') || '이달도 화이팅 💪', // AH 대표칭호
    pointsText: (Number(r[16]) || 0) + 'P', // Q 월간포인트
    monImg: monMap[guideNm] || '',
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
    tb.getText().getTextStyle().setFontSize(13).setBold(true).setForegroundColor('#262626'); // [v9.35] 토큰 잉크
    return;
  }
  const use = scores.slice(-5), n = use.length;
  const slot = W / n, barW = slot * 0.6;
  for (let i = 0; i < n; i++) {
    const sc = Math.max(0, Math.min(100, Number(use[i]) || 0));
    const bh = Math.max(H * (sc / 100), 2);
    const bar = sl.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE, L + i * slot + (slot - barW) / 2, T + H - bh, barW, bh);
    bar.getFill().setSolidFill(i === n - 1 ? '#F96859' : '#262626'); // [v9.35] 토큰 정렬 — 막대=인디고 · 최신 끝점=코랄 강조 (레이아웃 무변경)
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
    try { sl.insertImage(url, L, T, W, H); } catch (e) { Logger.log('캐릭터 이미지 삽입 실패: ' + e); }
  }
}

// [v9.19b] 디자인(자리표시자) 슬라이드를 자동 탐색 — 템플릿에 빈 슬라이드가 앞에 있어도 안전.
//  '{{학생이름}}'을 담은 첫 슬라이드를 반환(도형·표 모두 검색), 없으면 첫 슬라이드로 폴백.
function reportTemplateSlide_(pres) {
  const slides = pres.getSlides();
  const hasMarker = sl => {
    let hit = false;
    try { sl.getShapes().forEach(sh => { try { if (sh.getText().asString().indexOf('{{학생이름}}') > -1) hit = true; } catch (e) {} }); } catch (e) {}
    if (!hit) { try { (sl.getTables() || []).forEach(tb => { for (let r = 0; r < tb.getNumRows(); r++) for (let c = 0; c < tb.getNumColumns(); c++) { try { if (tb.getCell(r, c).getText().asString().indexOf('{{학생이름}}') > -1) hit = true; } catch (e) {} } }); } catch (e) {} }
    return hit;
  };
  for (let i = 0; i < slides.length; i++) if (hasMarker(slides[i])) return slides[i];
  return slides[0];
}

// [v9.19b] 이미 존재하는(복제 후 저장·재열기된) 슬라이드를 채움 — 치환/차트/이미지 각각 try/catch로 격리.
//  복제와 편집을 같은 배치에서 하면 Slides가 "This request cannot be applied"를 던지므로,
//  호출부에서 [복제 → saveAndClose → 재열기 → fill] 2단계로 분리한다.
function fillReportCardSlide_(sl, d) {
  const rep = {
    '{{월}}': d.month, '{{학생이름}}': d.name, '{{반이름}}': d.cls, '{{몬스터이름}}': d.nickname,
    '{{급수변화}}': d.levelText, '{{모의점수}}': d.mockText, '{{점수변화}}': d.scoreText,
    '{{출석}}': d.attendText, '{{몬스터단계}}': d.stageText, '{{칭호}}': d.title,
    '{{포인트}}': d.pointsText, '{{코멘트}}': d.comment
  };
  // [v9.19b] 도형·표 셀 단위로 치환 — 슬라이드 단위 replaceAllText는 표 안 자리표시자에서
  //  "This request cannot be applied"를 던짐. 셀 단위 TextRange로 격리하고, 그래도 실패하면 setText 폴백.
  const ranges = [];
  try { sl.getShapes().forEach(sh => { try { ranges.push(sh.getText()); } catch (e) {} }); } catch (e) {}
  try { (sl.getTables() || []).forEach(tb => {
    for (let r = 0; r < tb.getNumRows(); r++) for (let c = 0; c < tb.getNumColumns(); c++) {
      try { ranges.push(tb.getCell(r, c).getText()); } catch (e) {}
    }
  }); } catch (e) {}
  ranges.forEach(tr => {
    if (!tr) return;
    let s = ''; try { s = tr.asString(); } catch (e) { return; }
    if (s.indexOf('{{') === -1) return;
    Object.keys(rep).forEach(k => {
      if (s.indexOf(k) === -1) return;
      const v = String(rep[k] == null ? '' : rep[k]);
      try { tr.replaceAllText(k, v); }
      catch (e) { // 폴백: 전체 텍스트 문자열 치환 (서식은 첫 런으로 평탄화될 수 있음)
        try { tr.setText(tr.asString().split(k).join(v)); }
        catch (e2) { Logger.log('치환 실패 ' + k + ': ' + e2); }
      }
    });
  });
  try { drawScoreChart_(sl, d.mockScores); } catch (e) { Logger.log('차트 실패: ' + e); }   // {{CHART}}
  try { insertMonsterImage_(sl, d.monImg); } catch (e) { Logger.log('이미지 실패: ' + e); } // {{MONIMG}}
}

/* [v9.138] 프리뷰 파일 접두어 — 정리 함수가 「내가 만든 프리뷰」만 골라내는 손잡이다.
 * 배치 카드(ym_sid_name.png)는 report_cards.image_url로 Glide가 읽으므로 절대 섞이면 안 된다. — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md) */
const PREVIEW_CARD_PREFIX = 'PREVIEW_';

/* 테스트: 학생 1명만 카드 생성 → PNG 로그·반환 (report_cards 미기록 · 임시 슬라이드 정리)
 *
 * [v9.138] 🔒 공개 공유 제거 — 이 함수는 **공유할 이유가 처음부터 없었다**.
 *   카드 한 장에 미성년 실명·급수·모의점수·출결·포인트·강사 코멘트가 모여 있는데, 구 코드는
 *   그걸 ANYONE_WITH_LINK로 열고 lh3 공개 URL을 반환했다. 링크가 한 번이라도 새면
 *   (채팅 붙여넣기·로그 캡처·화면 공유) 인증 없이 그대로 열린다. Drive 공개 링크에는 만료가 없다.
 *   호출부를 전부 훑은 결과 **프로그램 호출자는 0개**다 — Apps Script 편집기에서 유호님이 손으로
 *   돌리는 점검용이고(GLIDE_조립_마스터보드 0-4), URL은 Logger와 반환값으로만 간다. 즉 공개 공유가
 *   사주던 기능은 **아무것도 없었다**. 소유자 인증 Drive 링크면 충분하다 — 유호님은 파일 소유자라
 *   그냥 열리고, 남에게는 애초에 열리지 않는다.
 *   ⚠ 배치(runReportCards_)의 공개 공유는 성격이 다르다 — 그건 Glide가 읽는 화면 배선이라
 *     여기서 함께 끄면 학부모 성장 리포트 탭이 통째로 빈다. 판단 근거는 그쪽 주석에 적었다. — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md)
 *   ⚠ **코드를 고쳐도 이미 나간 프리뷰 파일은 계속 공개다**(2026-08-02 배포 보안 게이트의 교훈과
 *     같은 계급 — 코드를 지워도 라이브는 안 닫힌다). closePreviewCardLinks()가 그걸 닫는다.
 *   파일명에서도 이름을 뺐다(sid만) — 로그에 이름이 남으니 식별엔 지장이 없고, Drive 목록·공유
 *   화면에 실명이 뜨는 표면만 하나 줄어든다. */
function previewOneReportCard(studentId) {
  if (!REPORT_TEMPLATE_ID) { Logger.log('REPORT_TEMPLATE_ID 미설정'); return; }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const ym = Utilities.formatDate(now, tz, 'yyyy-MM');
  const label = Number(ym.substring(0, 4)) + '년 ' + Number(ym.substring(5, 7)) + '월';
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) { Logger.log('profiles 없음'); return; }
  const w = Math.min(pf.getLastColumn(), 81); // [함께한날 막4 후속] 배치와 같은 폭(CC81 맞힌말수) — 프리뷰만 74로 남아 카드가 늘 0을 보이던 갈림(codex P2 ef209df0)
  const rowsP = pf.getRange(2, 1, pf.getLastRow() - 1, w).getValues();
  // [v9.19] 드롭다운 ▶실행은 인자를 못 넘기므로, 학생ID 미지정 시 자동으로 첫 학생으로 프리뷰
  let r;
  if (studentId) r = rowsP.find(x => String(x[0]) === String(studentId));
  else { r = rowsP.find(x => x[0] && x[3] === 'student'); if (r) Logger.log('학생ID 미지정 → 첫 학생으로 프리뷰: ' + r[0] + ' (' + (r[1] || '') + ')'); }
  if (!r) { Logger.log('학생 없음: ' + studentId + ' — profiles user_id(A열) 확인 (인자 없이 실행하면 첫 학생 자동 선택)'); return; }
  const d = reportCardData_(r, readAcademicLogs_(ss, tz)[r[0]], monsterImgMap_(ss), now);
  d.month = label;

  // [v9.19b] 복제 → 저장 → 재열기 → 채우기 (같은 배치 복제+편집의 "This request cannot be applied" 회피)
  const pres = SlidesApp.openById(REPORT_TEMPLATE_ID);
  const pageId = reportTemplateSlide_(pres).duplicate().getObjectId(); // 빈 슬라이드 아닌 디자인 슬라이드 복제
  pres.saveAndClose();
  const presF = SlidesApp.openById(REPORT_TEMPLATE_ID);
  const slF = presF.getSlides().find(s => s.getObjectId() === pageId);
  fillReportCardSlide_(slF, d);
  presF.saveAndClose();

  Utilities.sleep(1500);
  const blob = exportSlidePng(REPORT_TEMPLATE_ID, pageId)
    .setName(PREVIEW_CARD_PREFIX + ym + '_' + d.sid + '.png');
  const it = DriveApp.getFoldersByName(REPORT_FOLDER_NAME);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(REPORT_FOLDER_NAME);
  const file = folder.createFile(blob);
  const pngUrl = file.getUrl(); // [v9.138] 소유자 인증 링크 — setSharing 없음(공개하지 않는다)

  // 프리뷰 임시 슬라이드 제거 (템플릿 원본 보존)
  const pres2 = SlidesApp.openById(REPORT_TEMPLATE_ID);
  pres2.getSlides().forEach(s2 => { if (s2.getObjectId() === pageId) s2.remove(); });
  pres2.saveAndClose();

  Logger.log('📇 리포트카드 프리뷰 — ' + d.name + ' (' + d.sid + ')\n🖼️ PNG(비공개 · 본인 계정에서만 열림): ' + pngUrl +
    '\n데이터: 급수 ' + d.levelText + ' · 모의 ' + d.mockText + '(' + d.scoreText + ') · ' +
    d.attendText + ' · ' + d.stageText + ' · ' + d.pointsText + '\n코멘트: ' + d.comment);
  return pngUrl;
}

/* [v9.138] 🔒 이미 새어 있는 프리뷰 공개 링크 닫기 — 코드 수정만으로는 안 닫히는 것을 닫는다.
 *
 * 위 previewOneReportCard가 v9.138 전까지 실행될 때마다 학생 카드 PNG 한 장을 ANYONE_WITH_LINK로
 * 열어 놓고 Drive에 영구히 남겼다. 공유 설정은 **파일에 붙어 있지 코드에 붙어 있지 않으므로**,
 * 코드에서 setSharing을 지워도 과거 파일들은 오늘도 링크만 알면 열린다. 그래서 닫는 실행 경로가 없으면
 * 이번 수정은 「앞으로 안 샌다」까지만이고 「지금 새는 것」은 그대로다.
 *
 * ▣ 왜 PREVIEW_ 접두어만 건드리는가 — 배치 카드는 끄면 안 된다
 *   runReportCards_가 만든 카드(ym_sid_name.png)는 report_cards.image_url에 박혀 Glide 학부모
 *   「성장 리포트」 탭의 Image 컴포넌트가 그 URL로 읽는다. 여기서 같이 닫으면 학부모 화면이 통째로
 *   빈 이미지가 된다. 접두어 필터가 그 사고를 막는 유일한 경계라 테스트가 이걸 직접 검사한다. — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md)
 *
 * ▣ 판정 불가는 통과가 아니다
 *   getSharingAccess()가 예외를 던지면 「공개 아님」이 아니라 「모름」이다. 모르면 닫는다 —
 *   침묵으로 열어두는 쪽이 사고다(음성 동의 게이트가 맵을 못 읽을 때 전원 보류하는 것과 같은 원칙).
 *
 * ▣ 되돌릴 수 있다 — 파일을 지우지 않고 공유만 되돌린다. 잘못 닫았으면 다시 공유하면 그만이라
 *   미리보기 확인 단계를 두지 않았다(비가역이 아니다). 프리뷰는 어차피 버리는 산출물이다. */
function closePreviewCardLinks() {
  const it = DriveApp.getFoldersByName(REPORT_FOLDER_NAME);
  if (!it.hasNext()) {
    const none = '📁 ' + REPORT_FOLDER_NAME + ' 폴더가 없습니다 — 닫을 프리뷰가 없습니다.';
    Logger.log(none); return none;
  }
  const folder = it.next();
  /* [v9.138] 🔴 폴더 상속을 먼저 본다 — 이 보고서가 거짓말할 수 있는 유일한 자리다.
   *   Drive는 폴더 권한을 자식에게 **상속**시키고, 자식 쪽에서 그 상속분을 뗄 수 없다. 그런데
   *   getSharingAccess()는 그 파일 **자신의** 설정만 돌려주므로, 상속으로 열려 있는 파일도
   *   PRIVATE로 읽혀 아래에서 「이미 비공개」로 세어진다. 그러면 유호님은 "닫을 게 없었네"를 보는데
   *   실제로는 전부 열려 있다 — 08-02 「초록은 층에 대한 진술이다」와 같은 함정이다.
   *   폴더가 공개면 파일별 닫기로는 못 닫으므로, 숫자 대신 **무엇을 해야 하는지**를 말한다. */
  let folderWarn = '';
  try {
    const fa = folder.getSharingAccess();
    if (fa === DriveApp.Access.ANYONE_WITH_LINK || fa === DriveApp.Access.ANYONE) {
      folderWarn = '🔴 폴더 자체가 공개입니다 — 파일별로 닫아도 상속으로 계속 열립니다.\n' +
        '   Drive에서 「' + REPORT_FOLDER_NAME + '」 폴더 공유를 「제한됨」으로 바꿔야 닫힙니다.\n' +
        '   ⚠ 다만 그 순간 학부모 앱 「성장 리포트」 탭의 카드 이미지가 함께 깨집니다.\n' +
        '     2026-08-03 실측 — 배치 카드에는 **자기 공유가 하나도 없었고** 공개는 전부 폴더 상속이었습니다\n' +
        '     (runReportCards_의 setSharing이 「액세스가 거부됨: DriveApp」으로 계속 실패해 catch로 빠지고\n' +
        '      있었습니다). 그러니 순서는 ①폴더 잠금 ②파일별 공유를 되살리는 수리 ③탭 확인입니다.';
    }
  } catch (e) {
    folderWarn = '⚠ 폴더 공유 상태를 읽지 못했습니다 — 아래 숫자가 상속분을 놓쳤을 수 있으니 Drive에서 직접 확인하세요.';
  }
  const files = folder.getFiles();
  let found = 0, closed = 0, already = 0;
  const failed = [];
  while (files.hasNext()) {
    const f = files.next();
    let name = '';
    try { name = String(f.getName() || ''); } catch (e) { continue; }
    if (name.indexOf(PREVIEW_CARD_PREFIX) !== 0) continue; // 배치 카드는 절대 건드리지 않는다
    found++;
    let acc = null, known = false;
    try { acc = f.getSharingAccess(); known = true; } catch (e) {} // 못 읽으면 known=false → 닫는다
    /* [v9.138] 건너뛰는 조건은 **PRIVATE임이 증명된 것 하나뿐**이다(화이트리스트가 아니라).
     *   구 코드는 "ANYONE도 ANYONE_WITH_LINK도 아니면 비공개"로 봤는데, Access는 5종이라
     *   DOMAIN·DOMAIN_WITH_LINK가 그 틈으로 빠져 「이미 비공개」로 집계됐다 — 도메인 전체에
     *   열린 파일을 닫힌 것으로 세는 fail-open이다. 지금 계정은 개인 Gmail이라 그 값이 설정될 수
     *   없지만, 운영 도메인 계정으로 이관하는 순간 실재한다. 위의 「판정 불가는 닫는다」와
     *   같은 방향으로 맞춘다 — 확실히 닫힌 것만 넘기고 나머지는 전부 닫는다. */
    if (known && acc === DriveApp.Access.PRIVATE) { already++; continue; }
    try { f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); closed++; }
    catch (e) { failed.push(name + ' — ' + e); }
  }
  const msg = ['🔒 리포트카드 프리뷰 공개 링크 정리',
    '프리뷰 파일 ' + found + '개 검사 → 공개였던 ' + closed + '개를 비공개로 닫았습니다.',
    '이미 비공개: ' + already + '개' + (failed.length ? ' · 실패: ' + failed.length + '개' : ''),
    '배치 카드(학부모 성장 리포트용)는 건드리지 않았습니다.'];
  failed.slice(0, 5).forEach(x => msg.push('  ⚠ ' + x));
  if (folderWarn) msg.push('', folderWarn); // 폴더가 열려 있으면 위 숫자만으로는 끝이 아니다
  const out = msg.join('\n');
  Logger.log(out);
  return out;
}

// 메뉴용 래퍼 — 유호님이 편집기를 열지 않고 시트에서 바로 돌릴 수 있게
function menuClosePreviewCardLinks() {
  SpreadsheetApp.getUi().alert(closePreviewCardLinks());
}

/* [v9.155] 🔒 학생 파일 공개 링크 **닫기** — 유호님 08-04 「B로 가자」 결정의 실행부.
 *
 * ▣ 무엇이 바뀌었나
 *   구 함수(v9.142 `repairReportCardSharing`)는 반대 방향이었다 — 폴더를 잠근 뒤 카드를 **여는**
 *   수단이었고, 그때는 그게 옳았다(공개 링크가 학부모에게 카드가 닿는 유일한 통로였다).
 *   이제 통로가 **메일 첨부**로 바뀌었으므로 여는 함수는 남겨두면 안 된다 — 남기면 언젠가
 *   누군가 실행해서 방금 닫은 것을 되연다. **그래서 지우지 않고 방향을 뒤집어 교체한다.**
 *
 * ▣ 왜 코드 수정만으로는 안 끝나는가 (08-03 교훈)
 *   **공유 설정은 파일에 붙지 코드에 붙지 않는다.** `setSharing` 호출을 지운 것은 「앞으로 안 연다」
 *   까지고, **이미 열린 파일은 오늘도 열린다.** 그래서 닫는 실행 경로를 함께 낸다.
 *
 * ▣ 대상 — 학생이 식별되는 파일 두 종류
 *   ① 리포트카드: `report_cards.image_url`의 Drive 파일(실명·급수·포인트가 박힌 PNG)
 *   ② 음성 녹음: `voice_log.file_id`(미성년 목소리 = 몽골법상 생체정보 계열로 읽힐 수 있다)
 *   폴더를 훑지 않고 **시트에 기록된 것만** 건드린다(남의 파일이 섞일 수 없다).
 *
 * ▣ fail-open 방지 (v9.138 교훈)
 *   `DriveApp.Access`는 5종이라 「ANYONE 계열만 공개」로 보면 DOMAIN 계열이 틈으로 빠진다.
 *   → **PRIVATE임이 증명된 것만 건너뛴다**(상태를 못 읽으면 닫기를 시도한다 = 안전측).
 *   멱등이라 여러 번 눌러도 안전하다. */
function closeStudentFileLinks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const 대상 = []; // {id, 종류}

  const rc = ss.getSheetByName('report_cards');
  if (rc && rc.getLastRow() >= 2) {
    rc.getRange(2, 1, rc.getLastRow() - 1, 4).getValues().forEach(r => {
      const u = String(r[3] || '');
      const m = u.match(/googleusercontent\.com\/d\/([-\w]+)/) || u.match(/[?&]id=([-\w]+)/) || u.match(/\/d\/([-\w]+)/);
      if (m && !대상.some(x => x.id === m[1])) 대상.push({ id: m[1], 종류: '리포트카드' });
    });
  }
  const vl = ss.getSheetByName('voice_log');
  if (vl && vl.getLastRow() >= 2) {
    vl.getRange(2, 1, vl.getLastRow() - 1, 5).getValues().forEach(r => {
      const fid = String(r[4] || '').trim(); // file_id 열
      if (fid && !대상.some(x => x.id === fid)) 대상.push({ id: fid, 종류: '음성' });
    });
  }
  if (!대상.length) {
    const none = '닫을 파일이 없습니다(report_cards·voice_log에 Drive 파일 기록 없음).';
    Logger.log(none); return none;
  }

  let closed = 0, already = 0, fail = 0, firstErr = '';
  const 종류별 = {};
  대상.forEach(t => {
    let f = null;
    try { f = DriveApp.getFileById(t.id); } catch (e) { fail++; if (!firstErr) firstErr = '파일 열기 실패: ' + e; return; }
    let acc = null, known = false;
    try { acc = f.getSharingAccess(); known = true; } catch (e) {}
    if (known && acc === DriveApp.Access.PRIVATE) { already++; return; } // PRIVATE 증명된 것만 스킵
    try {
      f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      closed++; 종류별[t.종류] = (종류별[t.종류] || 0) + 1;
    } catch (e) { fail++; if (!firstErr) firstErr = String(e); }
  });

  const msg = ['🔒 학생 파일 공개 링크 닫기',
    '대상 ' + 대상.length + '개 → 닫음 ' + closed + '개 · 이미 비공개 ' + already + '개 · 실패 ' + fail + '개'];
  if (closed) msg.push('  (' + Object.keys(종류별).map(k => k + ' ' + 종류별[k]).join(' · ') + ')');
  if (fail) {
    msg.push('', '⚠ 첫 오류: ' + firstErr,
      '「액세스가 거부됨」이면 폴더 상속과 충돌하는 것입니다 — 폴더 공유 상태를 먼저 확인하세요.');
  } else if (closed) {
    msg.push('', '✅ 닫혔습니다. 이제 이 파일들은 로그인한 소유자만 볼 수 있습니다.',
      '⚠ Glide 학부모 「성장 리포트」 탭의 이미지가 비게 됩니다 — 그 컴포넌트를 걷어내세요.',
      '   카드는 이제 보호자 이메일로 PNG 첨부 발송됩니다(SEND_REPORT_EMAIL=true).');
  }
  const out = msg.join('\n');
  Logger.log(out);
  return out;
}

function menuCloseStudentFileLinks() {
  SpreadsheetApp.getUi().alert(closeStudentFileLinks());
}

/* ===================== [v5] 명예의 전당 (monthlyGameBatch가 호출) ===================== */

// [v5.7] 이달의 보스 — contents type='boss' 순번(F열) 월 로테이션. D열 = "등장대사|격파대사"
// [v9.4] 📖 싱크 스토리 — 월간 스토리북 자동 발간 (한 달의 실화 × TOPIK 문법)
/* ===================== [v9.219] STORY_GRAMMAR 급수 태그 (칸 3) =====================
 * 유호님 지시 2026-08-12 「4~5급 문법 보강해줘」 — **새로 짓지 않고 이미 있는 것을 열었다.**
 *
 * ■ 왜 여기였나 (08-12 당시 GRAMMAR_BANK 를 «안» 늘린 이유)
 *   그때 진화 게이트는 「각 단계 문법 12개 중 9개(75%) 도달」이 문서화된 확정이었다
 *   (`docs/몬스터_진화_임계값_v1.md` §2-2). 뱅크에 4~5급을 «더하면» 그 조항이 깨지고,
 *   3급을 «빼면» 학습 손실이라 둘 다 못 했다. 그런데 이 배열에 **3~5급 문형이 96개,
 *   몽골어판(MN_STORY_GRAMMAR)까지 1:1로** 이미 있었다 — 급수만 안 붙어 있었을 뿐이다.
 *   🔴 **08-31 정정 — 그 제약은 죽었다.** `GRAMMAR_GATE_NEED` 는 함께한날 막6 에서 소각됐고
 *   (`엔진_콘텐츠AI.js` L128 · 설계 §4-3), 문턱은 층 비율이 아니라 **맞힌 말 누계 절대수**다.
 *   그래서 같은 날 커리큘럼 요목 Lv1~5 의 빈 자리가 통째로 **뱅크로 올라갔다**(G313 · G613~G617 ·
 *   G713~G725 · 뱅크 72→91 · 유호 판정 네 차례). 요목 직결 문형이 출제 풀에만 있으면 «맞힌 말»로
 *   안 세어지기 때문이다. 여기 남는 것은 요목 밖 문형과 문학적 변형 — 그건 계속 골격·출제 풀 몫이다.
 *
 * ■ 칸 = [문형, 의미, 급수] · 급수 = TOPIK 1~5 (6급은 자체 콘텐츠 상한 밖)
 *   🔑 **근거 칸(`요`/`표`)을 GRAMMAR_BANK 와 달리 «안» 둔다** — 이 배열의 표기는 문학적 변형이
 *     많아(요목 「-느니」 ↔ 여기 「-느니 차라리」) 요목 실재를 기계로 대조하면 거짓양성이 난다.
 *     검증할 수 없는 근거 표시는 근거가 아니라 장식이다. 대신 **뱅크와 겹치는 20문형은 뱅크 값을
 *     그대로 따르고 그 일치를 회귀가 못박는다**(같은 판정이 두 곳에서 갈라지는 것이 진짜 위험).
 *   🔑 **재출현급도 안 둔다** — 여기는 월 로테이션 자리라 「상위 급에서 다시 다룬다」가 성립하지 않는다.
 *
 * ■ 🔴 이 태그로 열린 것: 4급 38 · 5급 29 = **67문형**. GRAMMAR_BANK 의 4~5급 7개와 합쳐 74다.
 *   ⚠ 다만 이 배열은 **스토리북 월 로테이션**이라 지금은 학생 레벨과 «무관»하게 나간다
 *   (`STORY_GRAMMAR[sIdx]` · sIdx = 월). Lv1 학생도 5급 문형이 든 챕터를 받는다.
 *   급수 태그는 그 레벨 대응을 «가능하게» 만들 뿐 스스로 고치지 않는다 — 그건 별도 설계 판정이다.
 * ⚠ 주석 정정: 「월(1~12)」은 낡았다 — 실측 **24행**(24개월 로테이션)이고 MN 판도 24행이다.
 * ==================================================================================== */
const STORY_GRAMMAR = [ // 월(1~24) 로테이션 · TOPIK 2~5급 문형 4개/월 — 챕터 문장의 골격
  [['-느라고','이유·핑계',3],['-았/었더니','경험 후 결과',3],['-는 바람에','뜻밖의 원인',3],['-기 마련이다','당연한 이치',3]],
  [['-(으)ㄹ 뻔하다','아슬아슬',3],['-고 말다','결국 그렇게 됨',3],['-도록','목적·정도',3],['-는 김에','겸사겸사',3]],
  [['-자마자','직후',3],['-(으)ㄹ수록','비례',5],['-는 대신에','대체',4],['-기만 하면','조건 반복',3]],
  [['-다 보니','하다 보니 알게 됨',4],['-(으)ㄹ 만하다','가치',4],['-는 척하다','거짓 행동',4],['-거든요','이유 설명',3]],
  [['-(으)ㄴ 지','시간 경과',3],['-을/를 통해','수단',4],['-는 데다가','추가',4],['-기 나름이다','하기에 달림',5]],
  [['-던','회상',3],['-(으)ㄹ 리가 없다','강한 부정 추측',4],['-곤 하다','습관',4],['-(으)면서도','대조 동시',4]],
  [['-느니 차라리','선택',5],['-는 통에','시끄러운 원인',4],['-기는커녕','부정 강조',4],['-(으)ㄹ 겸','두 목적',4]],
  [['-다가','전환',3],['-(으)ㄴ 채로','상태 유지',4],['-을 뿐만 아니라','추가 강조',4],['-기 십상이다','되기 쉬움',5]],
  [['-더니','관찰 후 변화',4],['-(으)ㄹ 정도로','정도',4],['-는 한','조건 한계',4],['-기에','이유 문어',5]],
  [['-고 나서','순서',2],['-(으)ㄹ 테니까','추측 근거',3],['-는 반면에','대조',4],['-을 비롯해서','대표 예시',5]],
  [['-자','즉시 계기',5],['-(으)므로','문어 이유',5],['-든지','선택 나열',3],['-기 위해서','목적',3]],
  [['-았/었더라면','과거 가정',4],['-(으)ㄹ 겸 해서','겸사',4],['-는 데 비해','비교',4],['-고서야','그제야',5]],
  [['-는 길에','오가는 도중',4],['-(으)ㄴ/는 덕분에','고마운 원인',3],['-기로 하다','결심·약속',3],['-게 되다','상황 변화의 결과',3]],
  [['-(으)ㄴ/는 편이다','대체적인 경향',3],['-(으)ㄹ까 봐','걱정 섞인 추측',3],['-아/어 놓다','해 둔 상태 유지',3],['-잖아요','아는 사실 확인',3]],
  [['-더라고요','직접 경험 전달',3],['-나 보다','보고 느낀 추측',4],['-는 대로','하는 즉시·그대로',4],['-아/어 버리다','완전히 끝냄',3]],
  [['-다 보면','계속하면 생기는 결과',4],['-(으)려던 참이다','마침 하려던 때',4],['-고 해서','여러 이유 중 하나',4],['-은/는 물론이고','당연한 포함',4]],
  [['-던데','경험한 배경 제시',4],['-(이)야말로','바로 그것 강조',5],['-만 해도','하나만 예로 들어도',5],['-게 하다','하게 만듦(사동)',3]],
  [['-(으)려다가','의도를 바꿈',4],['-는 셈이다','따져 보면 마찬가지',4],['-에 달려 있다','그것이 좌우함',5],['-다니','뜻밖의 감탄',4]],
  [['-더라도','양보 가정',4],['-(으)로 인해','원인(문어)',5],['-에 따라','기준·비례',4],['-고자','목적(문어)',5]],
  [['-(으)ㄴ 끝에','오랜 과정 끝의 결과',5],['-기가 무섭게','하자마자 곧바로',5],['-(으)며','나열·동시(문어)',4],['-(으)ㅁ으로써','수단·방법(문어)',5]],
  [['-는가 하면','한편의 대조 나열',5],['-(으)ㄹ 뿐이다','오직 그것뿐',4],['-다시피','아는 바와 같이',5],['-(으)ㄴ 나머지','지나친 나머지의 결과',5]],
  [['-에도 불구하고','그럼에도(양보)',4],['-(으)ㄹ 지경이다','매우 심한 정도',5],['-기에 앞서','하기 전에 먼저',5],['-는 가운데','진행되는 배경 속에',5]],
  [['-(으)ㄹ 법하다','그럴 만한 추측',5],['-다 못해','정도를 넘어서',5],['-아/어 내다','끝까지 해냄',4],['-치고','예외 없이·기준 밖 의외',3]],
  [['-(으)ㄹ 따름이다','오직 그러할 뿐(문어)',5],['-기 그지없다','더없이 그러함',5],['-(으)ㄹ지언정','강한 양보 선택',5],['-(으)리라','굳은 의지·추측(문어)',5]],
];
const STORY_TITLES = ['{boss}와 시냅스의 불꽃','{boss}가 남긴 것','우리가 {boss}를 만났을 때','{boss}보다 빛난 아이들','{boss}의 계절, 성장의 계절','안녕, {boss} — 우리는 자랐다','{boss} 너머의 아침','{boss}가 가르쳐 준 문장들','{boss}의 밤을 건너는 법','한 뼘 더 자란 우리와 {boss}'];

// [v9.5] 배경 12경 — 한국 생활·문화의 무대 (월 로테이션): [이름, 도착 묘사, 문화 디테일, 보스 등장 연출]
const STORY_SCENES = [
  ['눈 내리는 덕수궁 돌담길','첫눈이 내리는 덕수궁 돌담길을 크루들이 걸었습니다. 입김이 하얗게 피어오르고, 돌담 위에 눈이 소복이 쌓였습니다.','붕어빵을 반으로 쪼개 나눠 먹으며 "머리부터? 꼬리부터?" 하고 웃었습니다. 한국의 겨울은 붕어빵 냄새로 시작된다는 걸 크루들은 알게 되었습니다.','그때, 돌담 그림자가 이상하게 길어지더니 눈발이 거꾸로 솟구쳤습니다.'],
  ['광장시장 먹자골목','설 연휴의 광장시장은 사람들의 웃음소리로 가득했습니다. 크루들은 빈대떡 부치는 소리를 따라 골목 깊숙이 들어갔습니다.','꼬마김밥과 육회를 앞에 두고, 꼬마 크루가 "이모, 여기 하나 더요!"를 완벽한 발음으로 외치자 모두가 박수를 쳤습니다.','그런데 시장의 불빛이 하나둘 꺼지더니, 골목 끝에서 무거운 그림자가 스멀스멀 기어 나왔습니다.'],
  ['여의도 벚꽃길','4월의 여의도, 벚꽃이 눈처럼 흩날렸습니다. 크루들은 꽃잎을 손바닥에 받으며 윤중로를 걸었습니다.','돗자리를 펴고 김밥을 나눠 먹는데, 지나가던 할머니가 "학생들 한국말 참 잘하네" 하고 웃어주셨습니다. 그 한마디에 어깨가 으쓱해졌습니다.','갑자기 바람이 멈추고, 흩날리던 벚꽃잎이 공중에 그대로 얼어붙었습니다.'],
  ['경복궁 한복 나들이','크루들은 색색의 한복을 입고 경복궁 근정전 앞에 섰습니다. 옷고름을 서로 매어주며 한참을 웃었습니다.','수문장 교대식의 북소리에 맞춰 걷다가, 외국인 관광객이 사진을 부탁하자 "김치~" 하고 포즈까지 취해주었습니다.','그 순간, 근정전 지붕 위 잡상들 사이로 낯선 실루엣 하나가 스르륵 일어났습니다.'],
  ['한강 치킨 피크닉','5월의 한강공원, 크루들은 돗자리 위에 치킨과 라면을 펼쳤습니다. 강바람이 시원하게 불어왔습니다.','배달 앱으로 주문한 치킨이 정확히 돗자리 앞까지 온 것을 보고 다들 "한국 최고!"를 외쳤습니다. 편의점 라면 끓이는 기계 앞에선 작은 줄다툼도 있었습니다.','그런데 잔잔하던 한강 물결이 뚝 멈추더니, 수면 아래에서 거대한 그림자가 떠올랐습니다.'],
  ['남산 노을 전망대','케이블카를 타고 오른 남산, 크루들은 노을에 물드는 서울을 내려다보았습니다. 사랑의 자물쇠 앞에서 소원도 하나씩 걸었습니다.','"서울이 이렇게 넓었어?" 누군가 중얼거리자, 다른 크루가 "우리가 배운 한국어로 저 도시 전부랑 이야기할 수 있는 거야"라고 답했습니다.','노을이 절정에 달한 순간, 타워의 그림자가 갑자기 두 배로 길어지며 꿈틀거렸습니다.'],
  ['부산 해운대 바다','여름방학, 크루들은 KTX를 타고 부산으로 떠났습니다. 해운대 모래사장에 발을 딛자마자 파도가 발목을 간질였습니다.','밀면과 씨앗호떡을 사 들고, 부산 사투리로 "마, 억수로 맛있네!"를 따라 하다 다 같이 웃음이 터졌습니다.','그때 수평선 너머 하늘이 먹물처럼 어두워지더니, 파도가 이상한 리듬으로 출렁이기 시작했습니다.'],
  ['홍대 버스킹 거리','금요일 밤의 홍대 걷고싶은거리, 크루들은 버스킹 무대 앞에 모였습니다. 기타 소리와 박수 소리가 골목을 채웠습니다.','즉석에서 마이크를 넘겨받은 크루가 한국 노래 한 소절을 불렀고, 지나가던 사람들이 함성을 질러주었습니다. 떡볶이 컵을 든 손이 떨릴 만큼 짜릿했습니다.','그 순간 스피커가 지직거리더니, 무대 뒤 어둠 속에서 낮게 웃는 소리가 들려왔습니다.'],
  ['북촌 한옥마을 골목','가을 오후의 북촌, 크루들은 기와지붕 사이 좁은 골목을 탐험했습니다. 골목마다 다른 서울이 숨어 있었습니다.','한옥 카페에서 대추차를 마시며, 창호지 문으로 스며드는 햇살에 다들 말을 잃었습니다. "옛날 사람들은 이런 집에서 공부했구나."','그런데 골목 끝 담벼락의 그림자가, 아무도 걷지 않는데 혼자 움직이기 시작했습니다.'],
  ['설악산 단풍 산행','단풍이 절정인 설악산, 크루들은 서로를 끌어주며 흔들바위까지 올랐습니다. 산 전체가 붉게 타오르고 있었습니다.','정상 근처 매점에서 컵라면을 후후 불어 먹으며 "산에서 먹는 라면이 세상에서 제일 맛있다"는 한국의 진리를 몸으로 배웠습니다.','그때 단풍잎들이 일제히 떨어지기를 멈추고, 공중에서 소용돌이치기 시작했습니다.'],
  ['롯데월드 자유이용권','기말고사가 끝난 기념으로 크루들은 롯데월드에 갔습니다. 머리띠를 하나씩 나눠 쓰고 회전목마 앞에서 단체 사진도 찍었습니다.','자이로드롭 앞에서 "먼저 타" "네가 먼저 타"를 반복하다 결국 다 같이 탔고, 내려온 뒤엔 다리가 풀려 한참을 웃었습니다.','퍼레이드 음악이 뚝 끊기더니, 아이스링크 한가운데 조명이 꺼지며 냉기가 확 퍼졌습니다.'],
  ['보신각 제야의 종','한 해의 마지막 밤, 크루들은 보신각 앞 인파 속에 섰습니다. 입김과 함성이 뒤섞여 밤하늘로 올라갔습니다.','"쓰리, 투, 원!" 카운트다운을 한국어로 목이 터져라 외치고, 종소리가 울리자 서로를 끌어안았습니다. 낯선 나라의 새해가 우리의 새해가 된 밤이었습니다.','서른세 번째 종소리가 울리려는 순간 — 종소리가 멈췄습니다. 광장의 대형 전광판이 지직거리며 검게 물들었습니다.'],
  ['전주 한옥마을 비빔밥 골목','겨울 아침의 전주 한옥마을, 크루들은 기와 처마 아래 골목을 천천히 걸었습니다. 돌바닥 위로 하얀 입김이 번졌습니다.','유기그릇에 담긴 전주비빔밥을 비비며 "이렇게 색이 많은 밥은 처음이야" 하고 웃었습니다. 한 그릇 속 색의 조화를 크루들은 눈으로 먼저 배웠습니다.','그때 처마 끝 풍경 소리가 뚝 멈추더니, 골목 안개가 한 덩어리로 뭉쳐 일어섰습니다.'],
  ['강릉 안목해변 커피거리','2월의 강릉, 크루들은 안목해변 커피거리에 도착했습니다. 겨울 바다가 유리처럼 반짝이고, 갓 볶은 원두 향이 파도 소리와 섞여 왔습니다.','따뜻한 커피와 커피콩빵을 손에 쥐고 방파제에 나란히 앉았습니다. "바다를 보면서 마시는 커피가 진짜 강릉의 맛이래." 갈매기가 끼룩거리며 다가오자 다들 빵을 꼭 끌어안았습니다.','그런데 수평선의 물안개가 스르르 몰려오더니, 방파제 앞에서 커다란 거품 덩어리로 부풀어 올랐습니다.'],
  ['경주 대릉원 돌담과 첨성대','초봄의 경주, 크루들은 대릉원의 부드러운 능선 사이 오솔길을 걸었습니다. 담장 너머로 목련이 하얗게 피어나고 있었습니다.','천 년 전 별을 보던 첨성대 앞에서 갓 구운 황남빵을 나눠 먹으며 "신라 사람들도 이 하늘을 봤겠지?" 하고 속삭였습니다. 오래된 도시가 갑자기 아주 가깝게 느껴졌습니다.','그 순간 첨성대의 그림자가 해와 반대 방향으로 돌기 시작하더니, 이끼 낀 돌덩이들이 데굴데굴 한곳으로 모여들었습니다.'],
  ['보성 녹차밭 초록 계단','4월의 보성, 크루들은 초록 물결이 계단처럼 이어진 녹차밭 언덕에 올랐습니다. 곡우를 앞둔 찻잎들이 연둣빛으로 반짝였습니다.','갓 딴 첫물 찻잎을 손바닥에 올려 향을 맡고, 전망대에서 녹차 아이스크림을 나눠 먹었습니다. "우전, 세작 — 찻잎 한 장에도 계절 이름이 붙는구나." 크루들은 새 단어를 아이스크림처럼 천천히 음미했습니다.','그런데 밭고랑 사이 안개가 초록빛으로 물들더니, 언덕 하나만큼 커다란 덩어리로 뭉치기 시작했습니다.'],
  ['담양 죽녹원 대나무숲','5월의 담양, 크루들은 하늘까지 뻗은 대나무 사이 오솔길로 들어섰습니다. 바람이 지나갈 때마다 댓잎이 사각사각 파도 소리를 냈습니다.','대통밥 뚜껑을 열자 김이 확 올라왔고, 죽순 반찬을 맛본 크루가 "대나무를 먹는 거야?" 하고 눈이 동그래졌습니다. 죽순은 하루에 1미터씩도 자란다는 이야기에 다들 "우리 같네!" 하고 웃었습니다.','그때 바람도 없는데 대숲 전체가 출렁이더니, 흙을 밀어 올리며 집채만 한 죽순이 불쑥 솟아났습니다.'],
  ['여수 밤바다 낭만포차','초여름 저녁의 여수, 크루들은 바닷가를 따라 늘어선 낭만포차 거리에 도착했습니다. 항구의 불빛이 까만 바다 위에 금가루처럼 떠 있었습니다.','포차에서 갓김치와 딱새우를 맛보며 "맵지만 자꾸 손이 가!"를 외쳤습니다. 주인아주머니가 "우리 여수 밤바다가 노래보다 예쁘지?" 하시자 크루들이 크게 고개를 끄덕였습니다.','그런데 바다 위 불빛들이 일렁이며 한곳으로 모이더니, 말랑말랑한 젤리처럼 부풀어 둥실 떠올랐습니다.'],
  ['보령 대천해변 머드축제','한여름의 대천해변, 크루들은 머드축제 한복판으로 뛰어들었습니다. 회색 진흙을 뒤집어쓴 사람들이 모두 똑같은 얼굴로 웃고 있었습니다.','서로의 얼굴에 머드를 발라주다 보니 누가 누군지 알 수 없게 되었고, "이 진흙이 피부에 좋대!" 하며 더 신나게 발랐습니다. 진흙 미끄럼틀에서는 목소리만으로 서로를 찾아냈습니다.','그때 갯벌 한가운데가 부글부글 끓더니, 진흙 거품이 산처럼 쌓이며 꿈틀 일어났습니다.'],
  ['제주 우도 돌담과 해녀','8월의 제주, 크루들은 배를 타고 우도로 건너갔습니다. 에메랄드빛 바다와 까만 현무암 돌담이 그림처럼 이어졌습니다.','물질을 마친 해녀 할머니의 "호오이—" 숨비소리에 다들 조용히 귀를 기울였습니다. 우도 명물 땅콩 아이스크림을 하나씩 들고, 돌하르방 옆에서 똑같은 표정을 지으며 사진도 찍었습니다.','그런데 해안가 돌담이 드르륵드르륵 저절로 움직이더니, 커다란 돌덩이 하나로 차곡차곡 쌓여 올라갔습니다.'],
  ['안동 하회마을 탈춤 마당','가을 초입의 안동 하회마을, 크루들은 강이 마을을 한 바퀴 감싸 도는 풍경에 감탄하며 탈춤 공연 마당에 자리를 잡았습니다.','하회탈의 웃는 얼굴을 따라 그려보고, 덩실덩실 어깨춤도 배웠습니다. "탈을 쓰면 부끄러움이 사라진대!" 한 크루가 탈을 쓰고 한국어 인사말을 외치자 마당 가득 박수가 쏟아졌습니다.','그 순간 공연 마당의 북소리가 뚝 멈추고, 나무탈 하나가 저 혼자 데굴데굴 굴러 나오며 점점 커졌습니다.'],
  ['진주 남강 유등축제','10월의 진주, 크루들은 남강 위를 가득 메운 유등 불빛 사이를 걸었습니다. 강물이 수천 개의 소원으로 반짝였습니다.','크루들도 소망 유등에 한국어로 또박또박 소원을 적어 강물에 띄웠습니다. "내년의 나에게 보내는 편지 같아." 유등이 멀어질수록 마음속 소원은 더 또렷해졌습니다.','그런데 강바람이 빙그르르 돌기 시작하더니, 통통한 소용돌이 하나가 강 위로 내려와 유등 사이를 장난스럽게 헤집었습니다.'],
  ['순천만 갈대밭 노을','11월의 순천만, 크루들은 끝없이 펼쳐진 갈대밭 데크길을 걸었습니다. 바람이 지나가면 은빛 갈대가 한 방향으로 물결쳤습니다.','전망대에 오르자 노을 속에서 흑두루미 떼가 브이 자를 그리며 날아올랐습니다. "겨울을 나러 시베리아에서 여기까지 온대." 수천 킬로미터를 날아온 새들 앞에서 크루들은 한참 동안 하늘만 바라보았습니다.','그때 갈대밭 한가운데가 동그랗게 눕더니, 갈대 뭉치가 데굴데굴 구르며 점점 커다란 공처럼 불어났습니다.'],
  ['명동 크리스마스 빛거리','12월의 명동, 크루들은 캐럴이 흐르는 빛의 거리로 들어섰습니다. 상점마다 반짝이는 트리와 사람들의 들뜬 발걸음이 겨울밤을 환하게 데웠습니다.','노점 군고구마를 호호 불며 껍질을 벗기고, 종이컵에 담긴 어묵 국물로 언 손을 녹였습니다. 명동성당 앞에서 울려 퍼지는 캐럴을 들으며 "한국의 겨울은 손이 따뜻해지는 계절이구나" 하고 웃었습니다.','그 순간 거리의 트리 전구가 일제히 깜빡이더니, 광장 구석의 눈더미가 마시멜로처럼 부풀어 둥실 일어났습니다.'],
];

// [v9.10] 🎬 영상팩 — 씬 프롬프트 자동 생성용 영문 자산
const SCENE_EN = ['snowy Deoksugung palace stone wall road in Seoul, winter','bustling Gwangjang traditional market food alley at night','Yeouido cherry blossom road in full bloom','Gyeongbokgung palace courtyard, students in colorful hanbok','Han river park picnic at dusk, food delivery on mats','N Seoul Tower observatory at sunset, city skyline below','Haeundae beach in Busan, summer waves','Hongdae busking street at night, neon and guitar crowd','Bukchon hanok village narrow alley, autumn afternoon','Seoraksan mountain trail in peak autumn foliage','Lotte World theme park, carousel and ice rink','Bosingak bell pavilion on New Year\'s Eve, festival crowd','Jeonju hanok village bibimbap alley, winter morning','Anmok beach coffee street in Gangneung, sparkling winter sea','Gyeongju Daereungwon royal mound path and Cheomseongdae observatory, early spring magnolia','Boseong green tea field terraced hills, fresh spring leaves','Juknokwon bamboo forest path in Damyang, fresh green May light','Yeosu night sea pocha street, harbor lights on dark water, early summer evening','Daecheon beach mud festival in Boryeong, midsummer splash','Udo island in Jeju, emerald sea and black basalt stone walls, midsummer','Andong Hahoe folk village mask dance yard, early autumn river bend','Jinju Namgang river lantern festival, thousands of floating wish lanterns, autumn night','Suncheonman bay silver reed field at sunset, migrating cranes, late autumn','Myeongdong shopping street with Christmas lights and carols, snowy December night'];
const BOSS_EN = ['a giant sleepy hibernating bear monster','a lazy holiday slime monster','a mesmerizing spring butterfly monster','a hazy yellow-dust sphinx of fog','a daydream cloud monster','a tempting grassland wolf monster','a giant memory-devouring kraken rising from water','a procrastination skeleton monster','an autumn drowsiness goblin monster','a shadowy exam-anxiety phantom','a freezing yeti monster in a blizzard','a distraction phantom ghost in year-end lights','a giant swirling gochujang mist monster','a fluffy giant sea-foam latte monster','a dozy moss-covered stone tortoise monster','a giant rolling matcha fog monster','a springy giant bamboo-shoot monster','a wobbly glowing neon jellyfish monster','a giant bouncy mud-bubble monster','a giant waddling basalt dol hareubang monster','a goofy tumbling wooden-mask monster','a plump mischievous whirlwind monster','a fluffy giant reed-tumbleweed monster','a giant puffy marshmallow snowman monster'];
const WB_EN = 'ZERO, the colossal Overlord of Oblivion — a vast void-black entity with a glowing crown, looming over the sky';
const STYLE_EN = 'vibrant Korean coming-of-age webtoon style, clean flat vector illustration, warm indigo and coral palette, expressive teenage students with small glowing neuron companion monsters, cinematic composition';

const STORY_EMOTIONS = [ // [v9.7] 감정 표현 배지 — 막의 감정 곡선과 1:1 (한국어 감정 관용구 학습)
  ['설레다','기대로 마음이 두근거리다'],['심장이 쿵 내려앉다','갑작스러운 충격을 받다'],
  ['입술을 깨물다','분함이나 결심을 참아 누르다'],['소름이 돋다','놀라움·감동으로 피부가 오싹해지다'],
  ['가슴이 벅차오르다','기쁨과 감동이 가득 차다'],['목이 메다','감동으로 말이 잘 나오지 않다'],
  ['어깨가 으쓱해지다','자랑스러워지다'],['속이 후련하다','걱정이 풀려 시원하다'],
  ['눈이 반짝이다','기대와 호기심으로 빛나다'],['숨이 턱 막히다','놀라움과 긴장으로 숨이 멎는 듯하다'],
  ['주먹을 불끈 쥐다','결심과 의지를 다지다'],['손에 땀을 쥐다','조마조마하여 마음을 졸이다'],
  ['가슴이 뭉클하다','감동이 조용히 밀려오다'],['눈시울이 붉어지다','감동으로 눈가가 뜨거워지다'],
  ['가슴을 펴다','당당하고 자랑스러워지다'],['가슴을 쓸어내리다','안심하여 마음을 놓다']];

function buildMonthlyStorybook_() {
  if (!STORYBOOK_ON) return; // [v9.147] 월간 스토리북 시즌 오프 — 읽기 노출이나 로그 0(월간 카드 synk_cards는 유지)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const ym = Utilities.formatDate(lastM, tz, 'yyyy-MM');
  const mNum = lastM.getMonth() + 1;
  // [v9.27] 연도 로테이션: 짝수해(2026 등)=1년차 슬롯0~11 · 홀수해=2년차 슬롯12~23 (2026 출력 불변)
  const sIdx = (mNum - 1) + (lastM.getFullYear() % 2 === 1 ? 12 : 0);
  const sb = ensureSheet(ss, 'synk_stories', ['월','호수','제목','챕터','챕터제목','본문','문법포인트','씬프롬프트']);
  if (sb.getMaxColumns() < 8) sb.insertColumnsAfter(sb.getMaxColumns(), 8 - sb.getMaxColumns()); // [v9.10]
  if (String(sb.getRange(1, 8).getValue()) !== '씬프롬프트') sb.getRange(1, 8).setValue('씬프롬프트');
  // [v9.97] 월 열을 텍스트로 고정 — 이 줄이 없으면 아래 멱등 가드가 Date 오염 셀에서 영구 실패해 매달 중복 발간된다
  ymTextColFix_(sb, 1, tz);
  if (sb.getLastRow() >= 2 && sb.getRange(2, 1, sb.getLastRow() - 1, 1).getValues()
    .some(r => ymTextOf_(r[0], tz) === ym)) { Logger.log('스토리북: ' + ym + '호 기발간'); return; }
  const issue = 1 + new Set(sb.getLastRow() < 2 ? [] : sb.getRange(2, 1, sb.getLastRow() - 1, 1).getValues().map(r => ymTextOf_(r[0], tz)).filter(String)).size;
  const G = STORY_GRAMMAR[sIdx];
  const boss = bossOfMonth(ss, mNum) || { name: '이달의 보스', open: '', win: '' };
  const wb = worldBossOf(ss);
  const SC = STORY_SCENES[sIdx];

  // ── 캐스팅 (전부 실데이터, 5역 체계: 주연1·조연2·단역2·엑스트라) ──
  const pf = ss.getSheetByName('profiles');
  const nmB = {}, clsB = {}, evolvedMap = {};
  let stuCnt = 0;
  if (pf && pf.getLastRow() >= 2) {
    const wide = Math.min(54, pf.getMaxColumns());
    pf.getRange(2, 1, pf.getLastRow() - 1, wide).getValues().forEach(r => {
      if (!r[0] || r[3] !== 'student') return;
      stuCnt++; nmB[r[0]] = r[1] || r[0]; clsB[r[0]] = String(r[4] || '');
      // [함께한날 막7] BB54 = 최근장면일 · S19 = 현재장면(숫자) — 그 달 새 장면이 열린 크루를 캐스팅 재료로
      if (wide >= 54 && String(r[53] || '').indexOf(ym) === 0) evolvedMap[r[0]] = '장면 ' + (Number(r[18]) || 1);
    });
  }
  // [함께한날 막7] 주연 축 = 「지난달 «처음» 넘은 문형 수」 상위(설계 §4-6) — 월간 P 정렬(ranked)을 주연
  //   선정에서 뺐다. 이것이 「조용한 학생도 주인공」의 기계 장치다: 포인트가 적어도 제 손으로 맞힌 달이면 주연이 된다.
  const newMastered = {};
  {
    const mlS = ss.getSheetByName('mastery_log');
    if (mlS && mlS.getLastRow() >= 2) mlS.getRange(2, 1, mlS.getLastRow() - 1, 6).getValues().forEach(r => {
      const sidS = String(r[0] || '').trim(), srcS = String(r[5] || '');
      if (!sidS || String(r[2]) !== '도달') return;
      if (!(srcS === 'AI첨삭' || srcS === 'AI음성' || srcS === 'AI대화')) return;
      if (r[4] && dstr(r[4], tz).indexOf(ym) === 0) newMastered[sidS] = (newMastered[sidS] || 0) + 1;
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
    // [08-27] 「이달의 스타」·「시냅스 챔피언」은 1등 시상이라 폐지됐다. 남은 넷은 전부 자기 기준이라
    //   스토리북 재료로 그대로 쓴다 — 안 바꾸면 이 칸이 «영영 비어» 스토리북 한 축이 조용히 죽는다.
    if (['🌟 하루도 안 빠진 달', '🤝 레이드 개근', '🔥 불꽃 출석러', '⏰ 지각 제로']
        .some(n => String(r[2]).indexOf(n) > -1)) crownSid[r[1]] = String(r[2]);
  });
  const ranked = Object.keys(nmB).filter(s => (newMastered[s] || 0) > 0 || (perM[s] || 0) > 0)
    .sort((a, b) => ((newMastered[b] || 0) - (newMastered[a] || 0)) || ((perM[b] || 0) - (perM[a] || 0)) || (nmB[a] < nmB[b] ? -1 : 1)); // [함께한날 막7] 1축 = 새로 맞힌 문형 수 · 동점만 월간 P · 그다음 이름순
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
  /* [08-27] 칭호가 바뀌면 «그 칭호를 말로 옮기는 자리»도 같이 바뀐다 — 안 따라가면 조용히 틀린 문장이 난다.
   *   구판은 `t.indexOf('스타')` 하나로 갈랐고, 새 넷에는 「스타」가 없어 전부 「가장 많이 성장한」이 됐다
   *   (codex ①검수가 잡았다 — 지각 제로 보유자가 성장 최다로 서술되던 자리). */
  const 칭호말_ = { '하루도 안 빠진 달': '이달 하루도 빠지지 않은 목소리', '레이드 개근': '레이드마다 자리를 지킨 목소리',
    '불꽃 출석러': '끊기지 않고 이어 온 목소리', '지각 제로': '한 번도 늦지 않은 목소리' };
  const 칭호말of_ = (t) => { const k = Object.keys(칭호말_).find(n => String(t || '').indexOf(n) > -1); return k ? 칭호말_[k] : '이달을 함께 걸어온 목소리'; };
  const C1 = cameoPool[0] ? { n: nmB[cameoPool[0]], t: crownSid[cameoPool[0]] } : null;
  const evoActor = M.evo ? M : (S1.evo ? S1 : (S2 && S2.evo ? S2 : null));
  /* [08-27 유호 지시 A] 리그 폐지 — league_pairs 를 읽어 「명승부(duel)」를 뽑던 블록을 통째로 걷었다.
   *   그 재료가 제1·2화의 «라이벌 서사»와 사건 요약의 「명승부 A vs B」를 채웠다.
   *   ⚠ 껍데기만 남기면(빈 변수 + 죽은 if) 다음 손이 되살리기 쉽고 const 재대입 같은 잔재가 남는다. */
  let world = null;
  const wrS = ss.getSheetByName('world_raid');
  if (wrS && wrS.getLastRow() >= 2) wrS.getRange(2, 1, wrS.getLastRow() - 1, 5).getValues().forEach(r => {
    if (String(r[0]) === ym) world = { hp: Number(r[2]) || 0, dmg: Number(r[3]) || 0, win: String(r[4]) === '격파' };
  });
  const rvA = '옆 반'; // [08-27] 구판은 리그 명승부 상대 반 이름을 썼다 — 리그 폐지로 «옆 반» 하나로 선다
  // [v9.69] 변형 선택자(U+FE0E/FE0F)·ZWJ(U+200D)까지 함께 제거 — 🕳️처럼 "이모지+FE0F" 조합에서 FE0F만 남아
  //   제목이 "제로 ️와"로 렌더되던 고아 문자 결함 수리(기발간 행은 sheetSelfHeal_이 청소)
  const bN = boss.name.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0E\uFE0F\u200D]/gu, '').trim();
  const wN = wb.name.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0E\uFE0F\u200D]/gu, '').trim();
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
  const tY2 = (lastM.getFullYear() % 2 === 1); // [v9.27] 홀수해=2년차 타이틀(6~9)·짝수해=1년차(0~5), 2026 출력 불변
  const title = STORY_TITLES[(tY2 ? 6 : 0) + (issue - 1) % (tY2 ? 4 : 6)].replace('{boss}', wN);
  const rows = [];
  // [v9.70] 스토리북 문법·감정 용어줄 한·몽 병기 — 스토리북은 반 공유물이라 학생별이 아닌 전역 스위치(MJ_BILINGUAL)로.
  //   몽골어판 구조: MN_STORY_GRAMMAR[월][i] = [문형(한국어 유지), 의미(몽골어)] · MN_STORY_EMOTIONS[i] = [관용구, 뜻(몽골어)]
  const bi9 = (typeof MJ_BILINGUAL !== 'undefined' && MJ_BILINGUAL !== 'off');
  const gB = i => '📖 ' + G[i][0] + ' — ' + G[i][1] + (bi9 && typeof MN_STORY_GRAMMAR !== 'undefined' && MN_STORY_GRAMMAR[sIdx] && MN_STORY_GRAMMAR[sIdx][i] ? ' / ' + MN_STORY_GRAMMAR[sIdx][i][1] : '');
  const eB = i => '💗 ' + STORY_EMOTIONS[i][0] + ' — ' + STORY_EMOTIONS[i][1] + (bi9 && typeof MN_STORY_EMOTIONS !== 'undefined' && MN_STORY_EMOTIONS[i] ? ' / ' + MN_STORY_EMOTIONS[i][1] : '');
  const SEn = SCENE_EN[sIdx], BEn = BOSS_EN[sIdx];
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
    IMG('poster cover: two class groups meeting at ' + SEn + ', curious and friendly') + ' || MOT: split-screen slide-in, warm light between them', // [08-27] rival → meeting (리그 폐지)
    IMG('two student groups spotting each other across ' + SEn + ', surprised then smiling') + ' || MOT: whip-pan between the two groups', // [08-27] rival 걷음
    IMG('both classes sharing snacks at one table, awkward then warming up, ' + SEn + ' background') + ' || MOT: slow push-in as smiles appear', // [08-27] rivals 걷음
    IMG(BEn + ' erupting between the two groups, splitting them apart, dark energy wall') + ' || MOT: shockwave burst, camera shake',
    IMG('the hero student reaching a hand toward the other class') + ' || MOT: intimate close-up, hand meeting hand, light igniting', // [08-27] rival 걷음
    IMG('two class monsters roaring side by side above joined hands') + ' || MOT: twin energy auras merging into one new color',
    IMG('the sky splitting open, ' + WB_EN + ', both classes standing together below') + ' || MOT: massive slow reveal, dust swirling',
    IMG('combined chant of both classes, glowing letter-chains from two directions binding the overlord') + ' || MOT: dual spiral camera, chains crossing',
    IMG('crown-wearing students leading the final chant, all monsters glowing') + ' || MOT: heroic slow push through the front line',
    IMG('the overlord falling, both classes high-fiving in golden light rain') + ' || MOT: slow-motion high-five, sparkles', // [08-27] rivals 걷음
    IMG('sunset group photo of both classes together at ' + SEn) + ' || MOT: freeze-frame with camera flash white-out',
    IMG('empty classroom at night, faint shadow at the window, distant whisper') + ' || MOT: slow creep, single light flickering'
  ];
  const push = (ch, cTitle, body, badge) => rows.push([ym, issue, title, ch, cTitle, body, badge || '', scenePrompts[ch] || '']);

  push(0, '표지', 'SYNK LAB 청춘 실록 제' + issue + '호 — ' + mNum + '월의 무대: ' + SC[0] + '\n이 이야기의 인물과 기록은 크루들이 이번 달 실제로 만든 것입니다. 배경과 모험은 상상이지만, 주인공은 상상이 아닙니다.', '');

  // ═══ 기 ═══
  if (arcA) {
    push(1, '제1화 — 아침', '약속 장소에 가장 먼저 나온 사람은 ' + M.n + '였다. 가방 안에는 어젯밤 미리 사 둔 간식이 들어 있었다. 하나둘 모여드는 크루들의 얼굴에는 같은 표정이 떠 있었다. 오늘만큼은 공부가 아니라는 표정. 버스가 출발하자 누군가 창문을 열었고, ' + S1.n + '이(가) 이어폰 한쪽을 ' + M.n + '에게 건넸다. 창밖의 간판들이 빠르게 지나갔다. ' + M.n + '은(는) 그것들을 하나씩 소리 내지 않고 읽어 보았다. 전부 읽을 수 있었다.', gB(0));
    push(2, '제2화 — ' + SC[0], SC[1] + ' ' + SC[2] + ' ' + M.n + '이(가) 주문을 맡았다. 조금 떨렸지만, 점원은 한 번에 알아들었다. 돌아서는 ' + M.n + '의 입꼬리가 *슬며시 올라갔다*. ' + S1.n + '이(가) 그걸 보고 웃었다. "잘하네." "당연하지."', eB(0));
  } else {
    /* [08-27 유호 지시 A] 구판은 「매주 리그에서 겨루던 라이벌」·「지난주 승부」·「스코어」로 열었다 —
     *   리그가 폐지됐으므로 없는 일이 되고, 애초에 「학생끼리 비교하지 않는다」(철학 §48)와도 어긋났다.
     *   같은 자리를 «옆 반과 같이 걷는» 서사로 바꾼다. 만나는 장면은 그대로 살린다. */
    push(1, '제1화 — 마주침', SC[1] + ' 먼저 알아본 쪽은 ' + M.n + '였다. 길 건너편, 낯익은 얼굴들. 같은 보스를 같은 주에 두드리던 ' + rvA + ' 크루들이었다. 잠깐 어색한 정적이 흘렀다. 그 정적을 깬 것은 양쪽의 막내들이었다. "안녕!" 아이들의 인사는 언제나 소개보다 빠르다.', gB(0));
    push(2, '제2화 — 같은 테이블', SC[2] + ' 간식을 나누다 보니 자리가 섞였다. ' + M.n + '은(는) ' + rvA + ' 크루와 지난주 이야기를 했다. 어디서 막혔고 어떻게 넘었는지. 같은 자리에서 막혔다는 걸 알고 둘 다 웃었다.' + cameo(), eB(0));
  }

  // ═══ 승 ═══
  push(3, '제3화 — 정적', SC[3] + ' 웃음소리가 끊겼다. 공기가 한 단계 무거워졌다. "' + (boss.open || '...') + '" ' + bN + '였다. 매일 밤 전투 리포트에서만 보던 그 이름이, 지금 눈앞에 있었다. ' + M.n + '의 *심장이 쿵 내려앉았다*. 그러나 물러선 크루는 없었다.', eB(1));
  push(4, '제4화 — 선봉', '먼저 움직인 것은 ' + M.n + '였다. 이번 달 기록 ' + M.d + '. 반에서 가장 높은 숫자였고, 그 숫자만큼의 밤이 있었다. 외운 단어가 화살이 되고, 발표했던 문장이 방패가 되었다. ' + S1.n + '이(가) 옆에 붙었다. 둘의 호흡은 오래 맞춰 온 것처럼 정확했다.' + cameo(), gB(1));
  push(5, '제5화 — 그림자', bN + J(bN, '이', '가') + ' 비틀거렸다. ' + (raidWins > 0 ? '이번 달에만 ' + raidWins + '번 무릎 꿇었던 상대다.' : '매일 쌓인 데미지는 거짓말을 하지 않는다.') + ' 승리가 눈앞이었다. 그때, 쓰러지던 보스가 웃었다. "나는… 그림자일 뿐." 보스의 몸이 검은 안개가 되어 하늘로 빨려 올라갔다. ' + M.n + '은(는) *입술을 깨물었다*. 이긴 것이 아니었다.' + cameo(), eB(2));

  // ═══ 전 ═══
  push(6, '제6화 — 대군주', '하늘이 갈라졌다. "' + (wb.open || '...') + '" ' + wN + '. 매달의 보스들을 뒤에서 부리던 존재가 처음으로 모습을 드러냈다. 한 반의 힘으로 어찌할 상대가 아니라는 것은, 그 그림자의 크기만으로 알 수 있었다.', gB(2));
  push(7, '제7화 — 집결', '멀리서 발소리가 들려왔다. ' + rvA + '이(가) 오고 있었다. 평일반이, 주말반이, ' + stuCnt + '명의 크루 전원이 한 전장에 모이고 있었다. ' + (evoActor
    ? '그 한가운데서 빛이 터졌다. ' + evoActor.n + '의 가이드가 한 걸음 성큼 다가온 순간이었다 — ' + evoActor.evo + '까지 함께 걸어온 날들이 가장 필요한 순간에 형태를 갖춘 것이다.'
    : '크루들의 가이드가 일제히 몸을 낮췄다. 대군주의 그림자가 처음으로 흔들렸다.') + cameo() + cameo(), eB(3));
  push(8, '제8화 — 총공세', (C1 ? C1.n + '이(가) 앞으로 나섰다. ' + 칭호말of_(C1.t) + '가 첫 문장을 열었다.' : M.n + '이(가) 첫 문장을 열었다.') + ' 다음 크루가 이어받고, 또 다음 크루가 이어받았다. ' + stuCnt + '명의 한국어가 하나의 사슬이 되어 대군주를 감았다. ' + (world ? '이번 달 전교의 기록, ' + world.dmg + '. 그 전부가 지금 한 점을 향하고 있었다.' : '한 달의 기록 전부가 한 점을 향하고 있었다.') + cameo() + cameo(), gB(3));

  // ═══ 결 ═══
  if (world && world.win) {
    push(9, '제9화 — 끝', '"' + (wb.win || '...') + '" 대군주가 무너졌다. 잠깐의 정적 뒤, 함성이 터졌다. ' + M.n + '은(는) 소리를 지르는 대신 하늘을 올려다보았다. 반짝이는 가루가 내리고 있었다. *가슴이 벅차올랐다*. 매일의 숙제가, 매일의 출석이, 여기까지 온 것이다.' + cameo(), eB(4));
  } else {
    push(9, '제9화 — 봉인', '전교의 총공세에 대군주가 밀려났다. "기억하는 자들이… 이렇게 많다니…" 어둠 속으로 사라지는 목소리는 처음보다 훨씬 작았다. 완전한 끝은 아니었다. 그러나 고개를 떨군 크루는 없었다. 오늘의 데미지는 남고, 대군주는 매달 약해진다. ' + M.n + '이(가) 먼저 웃었다. "다음 달엔 끝내자." *속이 후련한* 함성이 뒤따랐다.' + cameo(), eB(7));
  }
  push(10, '제10화 — 귀갓길', '돌아가는 버스 안, 크루들은 하나둘 잠들었다. ' + S1.n + '은(는) ' + M.n + '의 어깨에 기대어 있었다. 창밖의 불빛을 오래 바라보던 ' + M.n + '이(가) 낮게 중얼거렸다. "다음 달에도, 다 같이 오자." 대답 대신 고른 숨소리가 들렸다. 그것으로 충분했다.' + cameo(), eB(6));
  push(11, '에필로그', '그날 밤, 불 꺼진 교실. 창밖 어둠 저편에서 희미한 목소리가 울렸다. "다음 달… 다시…" 크루들은 이제 그 목소리가 두렵지 않다. 내일 완료할 숙제가 다음 호의 화살이 되고, 내일의 도전이 다음 호의 첫 문장이 된다. 이 책의 다음 주인공은, 지금 이 페이지를 덮는 당신이다.', '');

  { // [v9.17] 🎬 크레딧 롤 — 활동 전원 출연 · 무활동자는 다음 호 예고 (소외 0)
    const cast = Object.keys(perM).filter(s => nmB[s] && (perM[s] || 0) > 0).sort((a, b) => perM[b] - perM[a]).map(s => nmB[s]);
    const nextUp = Object.keys(nmB).filter(s => !(perM[s] > 0)).map(s => nmB[s]);
    push(12, '🎬 크레딧', '― 출연 · 이 이야기를 실제로 만든 크루들 ―\n' + cast.join(' · ') +
      (nextUp.length ? '\n\n― 다음 호 출연 예정 ―\n' + nextUp.join(' · ') : '') +
      '\n\n각본·주연·제작: SYNK LAB 크루 전원 | 이 이야기의 모든 기록은 실화입니다.', '');
  }
  // [v9.44] 📏 독서 분량 시스템 — 유호님 정책: 전체 독서 5~15분(학습자 300자/분 ≈ 1,500~4,500자 밴드).
  //   본문(1~11화)만 계측(표지·크레딧 제외). 데이터가 빈 달엔 무대 감각 묘사 4종으로 하한을 자동 보강 —
  //   "짧아서 허전한 호"가 구조적으로 없다. 상한 초과는 카메오 화당 ≤2 규율상 사실상 불가(초과 시 로그 경고만).
  const STORY_BOOST = [
    '바람의 온도, 발밑의 감촉, 스쳐 가는 냄새까지 — 크루들은 이 계절의 한국을 온몸으로 기억하기로 했다. 배운 단어 하나가 풍경 하나와 짝을 이루는 순간마다, 한국어는 교재 밖으로 한 뼘씩 걸어 나왔다.',
    '싸움의 한가운데서도 크루들은 서로의 이름을 불렀다. 이름을 부르면 힘이 났다. 그것이 이 반의 오래된 비밀이었다. 넘어질 뻔한 순간마다 누군가의 목소리가 등을 받쳐 주었다.',
    '전장의 소음 사이로, 각자의 한 달이 스쳐 지나갔다. 처음으로 손을 들었던 날. 틀렸지만 끝까지 말했던 날. 아무도 몰래 단어장을 한 바퀴 더 돌았던 밤. 그 모든 날들이 지금 이 순간을 위한 준비였다.',
    '창밖으로 도시의 불빛이 강물처럼 흘렀다. 누군가는 오늘 배운 문장을 입안에서 굴려 보았고, 누군가는 다음 달의 자신에게 조용히 약속을 걸었다. 버스는 천천히, 그러나 분명히 집을 향해 달렸다.'
  ];
  let bodyChars = rows.filter(r => r[3] >= 1 && r[3] <= 11).reduce((a, r) => a + String(r[5]).length, 0);
  if (bodyChars < 1500) {
    const boostAt = [2, 4, 7, 10];
    for (let bi = 0; bi < STORY_BOOST.length && bodyChars < 1500; bi++) {
      const row = rows.find(r => r[3] === boostAt[bi]);
      if (row) { row[5] += ' ' + STORY_BOOST[bi]; bodyChars += STORY_BOOST[bi].length + 1; }
    }
  }
  if (bodyChars > 4500) Logger.log('⚠ 스토리북 본문 ' + bodyChars + '자 — 상한(15분) 초과, 카메오 규율 점검 권장');
  const readMin = Math.max(5, Math.min(15, Math.round(bodyChars / 300)));
  // 표지에 주인공 예고 + 읽는 시간 — 펼치기 전의 설렘("이번 달 주인공이 누구지?")이 몰입의 첫 문장
  rows[0][5] += '\n\n🎬 이번 호의 주인공: ' + M.n + ' · 함께한 크루: ' + S1.n + (S2 ? ', ' + S2.n : '') +
    '\n🕐 읽는 시간 약 ' + readMin + '분 — 따뜻한 차 한 잔과 함께';
  setAppState_(ss, '전호주연', pick[0] || '');
  // [v9.50] 단일본 발간 — 유호 지시 "한 번에 읽히게": 13행 분할(소식탭에 챕터가 파편으로 흩어짐) 대신
  //   챕터를 이어 붙인 전문 1행으로 발간한다. 월키 멱등(A열)·여행지도(월만 읽음)·데모 마커(월 행 존재)·
  //   clearDemoData(월 일치 행 회수) 전부 호환. 씬프롬프트는 영상팩 메일이 rows에서 직접 읽으므로 시트엔 비운다.
  const fullBody = rows.map(r =>
    (r[3] >= 1 && r[3] <= 11 ? '― ' + r[4] + ' ―\n' : (r[3] === 12 ? '\n' : '')) + r[5]).join('\n\n');
  const badgesAll = rows.map(r => String(r[6] || '')).filter(String);
  const uniqBadges = badgesAll.filter((b, i) => badgesAll.indexOf(b) === i).join('  ·  ');
  sb.getRange(sb.getLastRow() + 1, 1, 1, 8).setValues([[ym, issue, title, 1, '전문', fullBody, uniqBadges, '']]);
  if (SEND_SCENE_PACK && quotaOk(1)) { // [v9.10] 🎬 원장 영상팩 — 즉발(브리핑 큐 미경유: 복사용 독립 메일, 월 1통) · [v9.47·A2] 영상 제작 루틴 시작 전 OFF(발간·공지·데이터는 그대로, 메일만 잠금)
    const pLines = rows.map(r => '── 씬 ' + r[3] + ' · ' + r[4] + ' ──\n' + r[7]).join('\n\n');
    MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 🎬 싱크 스토리 제' + issue + '호 영상팩 — 씬 프롬프트 12',
      '「' + title + '」 발간과 함께 영상 제작용 프롬프트가 준비됐습니다.\n\n사용법: ① IMG 부분을 Recraft(또는 이미지 AI)에 넣어 씬 일러스트 생성 → ② 그 이미지를 Kling 등 영상 AI에 올리고 MOT 부분만 프롬프트로 입력.\n\n' + pLines +
      '\n\n════ ✍️ 집필 브리프 (수기 각색용 — 원할 때만) ════' + // [v9.34] '\\n' 이스케이프 화석 → 실제 개행(브리프가 한 덩어리+리터럴 \n 노출로 발송되던 결함)
      '\n무대: ' + SC[0] + ' | 아크: ' + (arcA ? '원정 편' : '만남 편') + ' | 문법: ' + G.map(g => g[0]).join(', ') +
      '\n주연: ' + (pick[0] ? nmB[pick[0]] + ' (' + (perM[pick[0]] || 0) + 'P)' : '-') + (rookie ? ' | 🌟 이달의 신인: ' + nmB[rookie.s] : '') +
      '\n조연: ' + pick.slice(1).map(s => nmB[s]).join(', ') +
      // [08-27] 「명승부 A vs B」를 걷었다 — 리그 폐지로 duel 이 없어졌다
      '\n사건: 격파 ' + raidWins + '회 | ' + (world ? (world.win ? '월드 격파' : '월드 봉인') : '월드 진행중') +
      '\n카메오 본문 출연(' + Math.min(cameoIdx, cameoCand.length) + '명): ' + cameoCand.slice(0, cameoIdx).map(c => c.n).join(', ') +
      '\n\n✍️ 수기 각색법: 위 브리프를 Claude에 붙여넣고 "싱크 스토리를 이 사실 그대로 12장 기승전결·해피엔딩으로 다시 써줘" → 나온 챕터를 synk_stories 해당 월 행의 F열(본문)에 붙여넣기. 자동 재발간은 월키 멱등이라 수기본을 절대 덮어쓰지 않습니다.');
  }
  // [v9.44] 직접 쓰기 → addNotice — 구 스키마 notices 열 어긋남 재발 지점(leagueSettle_·worldRaid와 동일 수리의 누락분)
  addNotice(ss, '📖 싱크 스토리 제' + issue + '호 발간!',
    '「' + title + '」 — ' + SC[0] + '에서 펼쳐진 우리들의 ' + mNum + '월 이야기. 앱의 싱크 스토리에서 읽어보세요.');
  Logger.log('스토리북 ' + ym + ' 제' + issue + '호(v5 단일본·주연 ' + M.n + '): 전문 1행 · 본문 ' + bodyChars + '자 ≈ ' + readMin + '분');
}

// [v9.69] 🩹 시트 자기치유 — 매일 밤 1회(nightJobs 편승·멱등·변경 없으면 쓰기 0):
//   ① 스토리북 구형 분권 호 병합 — v9.50이 "전문 1행" 발간으로 바꿨지만 기발간 호(13행 분권)는 마이그레이션이
//      없어 소식탭에 표지·제1화…크레딧이 파편으로 늘어서던 잔재(유호 07-27 실관찰)를 v9.50 조립식 그대로
//      전문 1행으로 병합한다. 챕터 오름차순 정렬·수기 각색 본문 보존·문법 배지 dedupe. 첫 행에 덮어쓰고
//      나머지 행은 물리 삭제(Row ID 등 코드 밖 열은 행 단위로 함께 정리되어 정합 유지).
//   ② 고아 변형 선택자 청소 — 구 이모지 제거 정규식이 U+FE0E/FE0F를 남겨 "제로 ️와"처럼 렌더되던 잔재를
//      제목·본문·공지에서 제거(이모지 뒤의 정상 변형 선택자는 보존 — 비이모지 문자 뒤 고아만).
//   ③ world_raid 같은 달 중복 행 정리 — 데모 로스터 시절 소환·재실행 잔재로 월 행이 여러 개 쌓인 것을
//      1행으로 줄인다(누적데미지는 최대값 보존). 이번 달 진행중 행은 HP를 현재 재적 기준으로 재산정 —
//      중복이 있었을 때만 손대므로 정상 단일 행의 "소환 시 HP 고정" 설계는 불변.
function orphanVsClean_(v) { // 비이모지 문자 뒤에 남은 변형 선택자만 제거(한글·숫자·공백·닫는따옴표 등)
  return String(v == null ? '' : v).replace(/([\uAC00-\uD7A3\w\s.,\u00B7\u300D\u300F\u201D\x22\x27)\]])[\uFE0E\uFE0F]+/g, '$1');
}
// [v9.97] 'yyyy-MM' 월 키 정규화 — 셀이 Date로 자동 변환돼 있어도 항상 문자열 월키를 돌려준다.
//   Date 판정은 asDate_가 아니라 instanceof로 한다("2026-06" 문자열을 다시 Date로 만들면 tz 경계에서 전달로 밀린다).
function ymTextOf_(v, tz) {
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, tz || Session.getScriptTimeZone(), 'yyyy-MM');
  // [v9.125] 시리얼 숫자 분기 — 텍스트 서식('@')이 먼저 걸린 셀은 Date가 아니라 시리얼(예: 46173)로 읽힌다.
  //   1899-12-30 기준 일수 → yyyy-MM. 범위 가드(1954~2119년)로 포인트·카운트 숫자 오변환을 막는다.
  const sn = (typeof v === 'number') ? v : (/^\d{5}$/.test(String(v || '').trim()) ? Number(String(v).trim()) : NaN);
  if (isFinite(sn) && sn > 20000 && sn < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(sn) * 86400000);
    const m = d.getUTCMonth() + 1;
    return d.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m;
  }
  const s = String(v == null ? '' : v).trim();
  /* [v9.129] 🔴 세 번째 오염 형태 — **`String(Date)` 결과가 텍스트로 굳은 셀**.
   *   `Wed Jul 01 2026 00:00:00 GMT+0800 (Ulaanbaatar Standard Time)` 같은 값이 문자열로 들어 있으면
   *   Date 분기도 시리얼 분기도 안 걸려 **정규화를 그대로 통과한다.** 08-02 라이브에서 운영 탭의 이 값이
   *   순서를 고친 v9.128을 두 번 돌리고도 살아남아 발각됐다(그래서 화면이 안 바뀐 것이지, 순서가 틀린 게 아니었다).
   *   요일·영문 월로 시작하는 형태만 되돌린다 — 사람이 쓴 일반 텍스트를 날짜로 오변환하지 않기 위해. */
  if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{4}/.test(s)) {
    const p = new Date(s);
    // 로컬 게터 금지 — 런타임 시간대(GAS=스크립트 tz, CI=UTC)에 따라 월이 밀린다. tz 인자가 결정해야 한다.
    if (!isNaN(p.getTime())) return Utilities.formatDate(p, tz || Session.getScriptTimeZone(), 'yyyy-MM');
  }
  return s;
}
/* 월 열을 텍스트 서식으로 고정하고 기존 Date·시리얼 오염 행을 'yyyy-MM' 문자열로 되돌린다(변경 행만 쓰기 — 멱등).
 * 🔴 [v9.128] 순서가 이 함수의 전부다 — **읽기 → 서식('@') → 쓰기**. 세 번 틀렸고 세 번 다 조용히 실패했다:
 *   ① 구 v9.97: 서식 → 읽기 → 쓰기. 서식을 먼저 걸면 Date 셀이 **시리얼 숫자**로 읽혀 instanceof Date를 빠져나간다
 *      (치유 0건 + 화면엔 46173 노출 = 치유 전보다 악화).
 *   ② v9.125: 읽기 → 쓰기 → 서식. 읽기는 고쳤지만 **쓰기가 아직 날짜 서식인 열에 떨어져 시트가 '2026-07'을
 *      다시 Date로 파싱**한다. 08-02 라이브 실측 — 자기치유를 돌린 직후에도 운영 탭에 `Wed Jul 01 2026`가 그대로였다.
 *   ③ 정답: 날짜 서식일 때 **먼저 읽어** Date를 Date로 잡고, 그 다음 열을 '@'로 굳히고, 마지막에 문자열을 쓴다.
 *      그래야 쓰는 값이 재파싱되지 않는다. 빈 시트에도 서식은 걸어 둔다(첫 쓰기부터 오염 예방). */
function ymTextColFix_(sh, col, tz, norm) {
  if (!sh) return 0;
  const toKey = norm || ymTextOf_; // 기본은 'yyyy-MM'. 시즌 열은 seasonKeyOf_('yyyy-MM-dd')를 넘긴다
  const n = sh.getLastRow() - 1;
  let fixed = 0;
  let vals = null;
  if (n >= 1) {
    vals = sh.getRange(2, col, n, 1).getValues();          // ① 읽기 — 날짜 서식일 때라야 Date가 Date로 온다
    for (let i = 0; i < n; i++) {
      const raw = vals[i][0];
      if (raw == null || raw === '') continue;
      const norm2 = toKey(raw, tz);
      if (typeof raw !== 'string' || norm2 !== raw) { vals[i][0] = norm2; fixed++; }
    }
  }
  if (sh.getRange(2, col).getNumberFormat() !== '@') {      // ② 서식 고정 — 쓰기보다 반드시 먼저
    sh.getRange(1, col, sh.getMaxRows(), 1).setNumberFormat('@');
  }
  if (fixed) {                                             // ③ 쓰기 — 이제 '@'라 재파싱되지 않는다
    sh.getRange(2, col, n, 1).setValues(vals);
    Logger.log('자기치유: ' + sh.getName() + ' 월 열 오염 ' + fixed + '행 → yyyy-MM 텍스트');
  }
  return fixed;
}
/* [v9.144] 🔴 날짜형 키 열 목록을 **골격에서 도출한다** — 월키 Date 오염의 원인 차단.
 *
 * 왜 네 번이나 재발했나: 통로(`ymTextColFix_`)는 v9.97에 이미 있었다. 없었던 건 **어느 열에 그
 * 통로를 태울지**였고, 그게 호출부에 흩어진 **손 목록**이었다. 새 시트에 '월'·'시즌' 열이 생길
 * 때마다 누군가 한 줄을 기억해 넣어야 했고, 네 번 다 잊었다 —
 *   스토리북(v9.97) · world_raid + report_cards(v9.126) · groups(v9.132).
 * 매번 다른 화면·다른 증상이었지만 원인은 하나였다: **목록이 선언과 떨어져 있었다.**
 * 그래서 네 번 모두 처방이 「그 자리에 한 줄 더」였고, 그건 다섯 번째를 막지 못한다.
 *
 * `sheetSkeleton_()`은 새 시트를 선언하는 **바로 그 자리**다. 여기서 도출하면 목록이 낡을 수 없다 —
 * 시트를 만들며 '월'·'시즌' 열을 넣는 순간 자동으로 치유 대상이 된다.
 *
 * ⚠ 08-03 실측: 키 열 12개 중 **6개가 한 번도 처치된 적이 없었다**
 *   (point_logs·titles·story·crew_projects·kpi_monthly·groups). 다섯 번째 재발이 이미 대기 중이었다. */
const TEXT_KEY_HEADS_ = { '월': 'ym', 'month': 'ym', '기준월': 'ym', '시즌': 'season' };
function textKeyCols_() {
  const out = [];
  (sheetSkeleton_() || []).forEach(function (row) {
    const name = row[0];
    const heads = row[1] || [];
    for (let i = 0; i < heads.length; i++) {
      const kind = TEXT_KEY_HEADS_[String(heads[i] == null ? '' : heads[i]).trim()];
      // break하지 않는다 — league_history처럼 '월'과 '시즌'을 **둘 다** 가진 시트가 있다.
      if (kind) out.push({ sheet: name, col: i + 1, head: String(heads[i]).trim(), kind: kind });
    }
  });
  return out;
}
/* 전 키 열 일괄 치유 — 멱등이고 변경이 없으면 쓰기 0. `sheetSelfHeal_`이 **가장 먼저** 부른다
 * (뒤따르는 중복 정리·재발간 판정이 전부 이 열을 키로 비교하므로, 정규화가 먼저여야 한다).
 * 시즌 열은 'yyyy-MM-dd'라 `seasonKeyOf_`를, 월 열은 'yyyy-MM'이라 `ymTextOf_`를 쓴다.
 * 둘 다 **Date·String(Date) 형태만** 되돌리고 사람이 쓴 일반 텍스트는 건드리지 않는다. */
function healTextKeyCols_(ss, tz) {
  const zone = tz || ss.getSpreadsheetTimeZone();
  const cols = textKeyCols_();
  const touched = [];
  let fixed = 0;
  cols.forEach(function (k) {
    const sh = ss.getSheetByName(k.sheet);
    if (!sh) return; // 아직 안 만들어진 시트는 건너뛴다(골격은 선언이지 실재가 아니다)
    const n = ymTextColFix_(sh, k.col, zone, k.kind === 'season' ? seasonKeyOf_ : ymTextOf_);
    if (n) { fixed += n; touched.push(k.sheet + '.' + k.head + ' ' + n + '행'); }
  });
  if (fixed) Logger.log('자기치유: 날짜형 키 열 오염 ' + fixed + '행 정상화 — ' + touched.join(' · '));
  return { fixed: fixed, cols: cols.length, touched: touched };
}
/* [v9.127] ▶ 공개 래퍼 — `sheetSelfHeal_`은 언더바 private이라 Apps Script 편집기 드롭다운에 **아예 안 뜬다**
 *   (GAS 규약). 그래서 밤을 기다리지 않고 지금 고치려면 시트 메뉴가 유일한 경로였는데, 원격 세션은 시트
 *   메뉴를 누를 수 없다. 인자 없음·멱등이라 아무 때나 눌러도 안전한 함수이므로 공개 진입점을 둔다.
 *   반환 문구는 메뉴(menuRun_)가 그대로 alert에 띄운다. */
function sheetSelfHealNow() {
  sheetSelfHeal_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cnt = n => { const s = ss.getSheetByName(n); return s ? Math.max(s.getLastRow() - 1, 0) : -1; };
  const msg = '🩹 시트 자기치유 완료\n' +
    '   report_cards ' + cnt('report_cards') + '행 · world_raid ' + cnt('world_raid') + '행 · synk_stories ' + cnt('synk_stories') + '행\n' +
    '   (월 열 Date 오염 정상화 + 같은 달·같은 학생 중복 정리 — 상세는 실행 로그)';
  Logger.log(msg);
  return msg;
}
function sheetSelfHeal_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  /* ⓪ [v9.144] 날짜형 키 열 전수 치유 — **가장 먼저** 돈다. 아래 ①~③의 중복 정리·재발간 판정이
   *   전부 이 열을 키로 비교하므로, 정규화가 뒤에 오면 그 판정들이 오염된 값으로 돌아간다.
   *   대상은 골격에서 도출한다(손 목록이 재발의 원인이었다 — textKeyCols_ 주석 참조).
   *   아래 개별 ymTextColFix_ 호출은 남겨 둔다: 멱등이라 여기서 치유됐으면 무비용이고,
   *   그 자리에서 「이 열은 키다」를 읽는 사람에게 알려 준다. */
  healTextKeyCols_(ss);

  /* [08-27 유호 지시 A · codex ①검수 26bf3dcbbe9a] 🚫 옛 «리그 공지»를 빈 칸으로 덮는다.
   * 왜 필요한가: 리그를 걷으면 «쓰는 쪽»은 멈추지만 notices 에 이미 쌓인 행은 그대로 남고,
   *   그 시트를 앱이 «직접» 읽는다(코드 쪽 소비 필터가 없다). 그러면 폐지한 비교 공지가
   *   소식탭에 계속 뜬다 — 순위표·「지난달의전당」에서 겪은 것과 같은 무늬다.
   * 왜 «지우지» 않고 비우나: 행 삭제는 비가역이고 뒤 행이 밀려 다른 멱등 가드가 흔들린다.
   *   제목·본문만 비우면 카드가 사라지고 구조는 그대로다(순위표 DO119 와 같은 처방).
   * 과녁은 «옛 리그 공지가 실제로 쓰던 제목» 셋뿐이다 — 넓게 잡으면 멀쩡한 공지를 지운다. */
  const ntH = ss.getSheetByName('notices');
  if (ntH && ntH.getLastRow() >= 2) {
    const lcH = Math.max(ntH.getLastColumn(), 3);
    const hdH = ntH.getRange(1, 1, 1, lcH).getValues()[0].map(h => String(h).trim().toLowerCase());
    /* 🔴 [08-27] 열 찾기는 addNotice 와 «같은 규약»이어야 한다 — 거긴 first-match(find 가 첫 일치를 낸다)다.
     *   Math.max 를 쓰면 title 과 title_ko 가 둘 다 있는 시트에서 «뒤쪽»을 골라, 쓰는 쪽과 비우는 쪽이
     *   서로 다른 열을 잡는다 — 그러면 옛 공지가 안 지워지고 멀쩡한 열이 비워진다. */
    const 첫열_ = (cands, fb) => { for (let i = 0; i < hdH.length; i++) if (cands.indexOf(hdH[i]) > -1) return i; return fb; };
    const iTH = 첫열_(['title', 'title_ko', '제목'], 0);
    const iBH = 첫열_(['body', 'body_ko', 'content', '내용', '본문'], 1);
    const 옛리그제목_ = ['🏆 주간 리그 결과', '🎙️ 리그 중계석', '🏆 이번 주 리듬왕', '리그 결과!', '주간 반 활동'];
    const ntV = ntH.getRange(2, 1, ntH.getLastRow() - 1, lcH).getValues();
    let 비운수 = 0;
    ntV.forEach((r, i) => {
      const ti = String(r[iTH] || '');
      if (!ti) return;
      if (!옛리그제목_.some(k => ti.indexOf(k) > -1)) return;
      ntH.getRange(i + 2, iTH + 1).setValue('');
      ntH.getRange(i + 2, iBH + 1).setValue('');
      비운수++;
    });
    if (비운수) Logger.log('자기치유: 옛 리그 공지 ' + 비운수 + '건을 비웠다(08-27 리그 폐지)');
  }

  /* [08-27 · codex ①검수 df9ce0ed0dc4] 옛 raid_story 의 「리그」·「리그중계」 행도 같은 처방.
   *   생산 함수를 지우면 «새 쓰기»만 멈춘다 — 이미 쌓인 행은 학생 스토리 소비 경로가 계속 읽는다.
   *   C열(구분)이 정확히 그 둘인 행만 과녁으로 잡는다(레이드 행은 안 건드린다). */
  const rsH = ss.getSheetByName('raid_story');
  if (rsH && rsH.getLastRow() >= 2 && rsH.getLastColumn() >= 5) {
    const rsV = rsH.getRange(2, 1, rsH.getLastRow() - 1, 5).getValues();
    let 지운수 = 0;
    rsV.forEach((r, i) => {
      const 구분 = String(r[2] || '');
      if (구분 !== '리그' && 구분 !== '리그중계') return;
      rsH.getRange(i + 2, 4, 1, 2).setValues([['', '']]); // 제목·본문만 비운다(행은 남긴다 — 삭제는 비가역)
      지운수++;
    });
    if (지운수) Logger.log('자기치유: 옛 리그 서사 ' + 지운수 + '건을 비웠다(08-27 리그 폐지)');
  }

  // ①+② 스토리북
  const sb = ss.getSheetByName('synk_stories');
  if (sb && sb.getLastRow() >= 2) {
    // [v9.97] ⓪ 월(A열) Date 오염 정상화 — 시트가 'yyyy-MM'을 날짜로 자동 변환해 두면
    //   ⓐ학생 소식탭 카드에 원시 Date 문자열이 노출되고 ⓑ발간 멱등 가드(String(r[0])===ym)가 영구 실패해
    //   같은 달 스토리가 매달 재발간된다(중복 병합이 그 증상을 가려 왔다 — v9.68 시각 Date 오염과 같은 계급).
    ymTextColFix_(sb, 1, ss.getSpreadsheetTimeZone());
    const n = sb.getLastRow() - 1;
    const data = sb.getRange(2, 1, n, 8).getValues();
    const byYm = {};
    data.forEach((r, i) => { const ym = ymTextOf_(r[0], ss.getSpreadsheetTimeZone()); if (ym) (byYm[ym] = byYm[ym] || []).push(i); });
    const dupMonths = Object.keys(byYm).filter(ym => byYm[ym].length >= 2).sort();
    const delRows = []; // 시트 실제 행 번호(2-base)
    dupMonths.forEach(ym => {
      const idxs = byYm[ym];
      const rows = idxs.map(i => data[i]).sort((a, b) => (Number(a[3]) || 0) - (Number(b[3]) || 0));
      const full = rows.map(r => { const ch = Number(r[3]) || 0;
        return (ch >= 1 && ch <= 11 ? '― ' + r[4] + ' ―\n' : (ch === 12 ? '\n' : '')) + String(r[5] || ''); }).join('\n\n');
      const badges = rows.map(r => String(r[6] || '')).filter(String);
      const uniq = badges.filter((b, k) => badges.indexOf(b) === k).join('  ·  ');
      const keep = Math.min.apply(null, idxs); // 물리적으로 가장 위 행에 병합본을 쓴다
      sb.getRange(keep + 2, 1, 1, 8).setValues([[ym, rows[0][1], orphanVsClean_(rows[0][2]), 1, '전문', orphanVsClean_(full), uniq, '']]);
      idxs.forEach(i => { if (i !== keep) delRows.push(i + 2); });
      Logger.log('자기치유: 스토리북 ' + ym + '호 ' + idxs.length + '행 → 전문 1행 병합');
    });
    delRows.sort((a, b) => b - a).forEach(rn => sb.deleteRow(rn)); // 아래부터 삭제(행번호 밀림 방지)
    // ② 병합 대상이 아니어도 제목·본문의 고아 선택자는 청소(변경분만 쓰기)
    if (sb.getLastRow() >= 2) {
      const n2 = sb.getLastRow() - 1;
      const tv = sb.getRange(2, 3, n2, 1).getValues(); const bv = sb.getRange(2, 6, n2, 1).getValues();
      let chT = false, chB = false;
      for (let i = 0; i < n2; i++) {
        const t2 = orphanVsClean_(tv[i][0]); if (t2 !== String(tv[i][0] || '')) { tv[i][0] = t2; chT = true; }
        const b2 = orphanVsClean_(bv[i][0]); if (b2 !== String(bv[i][0] || '')) { bv[i][0] = b2; chB = true; }
      }
      if (chT) sb.getRange(2, 3, n2, 1).setValues(tv);
      if (chB) sb.getRange(2, 6, n2, 1).setValues(bv);
    }
  }
  // ② 공지 제목·본문 고아 선택자 청소(헤더 이름 기반 — 한/몽 4열)
  const nt = ss.getSheetByName('notices');
  if (nt && nt.getLastRow() >= 2) {
    const hdr = nt.getRange(1, 1, 1, nt.getLastColumn()).getValues()[0].map(String);
    ['title_ko', 'body_ko', 'title_mn', 'body_mn'].forEach(cn => {
      const c = hdr.indexOf(cn) + 1; if (!c) return;
      const nv = nt.getRange(2, c, nt.getLastRow() - 1, 1).getValues();
      let ch = false;
      nv.forEach(r => { const v2 = orphanVsClean_(r[0]); if (v2 !== String(r[0] || '')) { r[0] = v2; ch = true; } });
      if (ch) nt.getRange(2, c, nt.getLastRow() - 1, 1).setValues(nv);
    });
  }
  // ③ world_raid 월 중복 정리
  const wr = ss.getSheetByName('world_raid');
  if (wr && wr.getLastRow() >= 2) {
    const tz = ss.getSpreadsheetTimeZone();
    /* [v9.126] 월 열 Date 오염 정상화 — 08-02 라이브 실측: 운영 탭 월드 레이드 표에
     *   `Wed Jul 01 2026 00:00:00 GMT+0800 (Ulaanbaatar Standard Time)`가 원장 화면에 그대로 노출됐고,
     *   그 행은 String(Date) 키라 '2026-07'과 다른 버킷이 되어 **중복 정리에서도 영영 안 묶였다.**
     *   report_cards와 같은 계급(v9.97 보호 목록에서 누락된 시트). 읽기 전에 고친다. */
    ymTextColFix_(wr, 1, tz);
    const ymNow = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
    const n3 = wr.getLastRow() - 1;
    const wd = wr.getRange(2, 1, n3, 5).getValues();
    const byM = {};
    wd.forEach((r, i) => { const ym = ymTextOf_(r[0], tz); if (ym) (byM[ym] = byM[ym] || []).push(i); });
    const del2 = [];
    Object.keys(byM).filter(ym => byM[ym].length >= 2).forEach(ym => {
      const idxs = byM[ym];
      const rows = idxs.map(i => wd[i]);
      const maxDmg = Math.max.apply(null, rows.map(r => Number(r[3]) || 0));
      const won = rows.some(r => String(r[4]) === '격파');
      const keep = Math.min.apply(null, idxs);
      let hp = Number(wd[keep][2]) || 0, st = won ? '격파' : String(wd[keep][4] || '진행중'), nm = String(wd[keep][1] || '');
      if (ym === ymNow && !won) { // 진행중인 이번 달만 현재 재적으로 HP 재산정(중복 존재 시 한정)
        let stu = 0;
        const pfH = ss.getSheetByName('profiles');
        if (pfH && pfH.getLastRow() >= 2) pfH.getRange(2, 1, pfH.getLastRow() - 1, 5).getValues()
          .forEach(pr => { if (pr[0] && pr[3] === 'student') stu++; });
        hp = Math.max(stu, 1) * WORLD_HP_PER; st = '진행중';
        const wbH = worldBossOf(ss); if (wbH && wbH.name) nm = wbH.name;
      }
      wr.getRange(keep + 2, 1, 1, 5).setValues([[ym, nm, hp, maxDmg, st]]);
      idxs.forEach(i => { if (i !== keep) del2.push(i + 2); });
      Logger.log('자기치유: world_raid ' + ym + ' ' + idxs.length + '행 → 1행(HP ' + hp + '·데미지 ' + maxDmg + ')');
    });
    del2.sort((a, b) => b - a).forEach(rn => wr.deleteRow(rn));
  }
  /* ④ [v9.126] report_cards 「같은 달·같은 학생」 중복 정리 — 위 가드 수리는 **새 중복을 막을 뿐**이고
   *   이미 쌓인 것은 스스로 사라지지 않는다(08-02 실측 37행 · 학부모 화면에 같은 카드 6장).
   *   남길 행 = image_url이 살아 있는 것 중 가장 최근(created_at) — 카드 이미지가 없는 행은 학부모 화면에서
   *   빈 카드가 되므로 우선순위가 낮다. 하나도 없으면 첫 행을 남긴다(전멸 방지). */
  const rcH = ss.getSheetByName('report_cards');
  if (rcH && rcH.getLastRow() >= 2) {
    const tzR = ss.getSpreadsheetTimeZone();
    ymTextColFix_(rcH, 3, tzR);
    const nR = rcH.getLastRow() - 1;
    const rd = rcH.getRange(2, 1, nR, 7).getValues();
    const byKey = {};
    rd.forEach((r, i) => {
      const sid = String(r[1] || '').trim(), ym = ymTextOf_(r[2], tzR);
      if (!sid || !ym) return;
      (byKey[ym + '|' + sid] = byKey[ym + '|' + sid] || []).push(i);
    });
    const delR = [];
    Object.keys(byKey).filter(k => byKey[k].length >= 2).forEach(k => {
      const idxs = byKey[k];
      const scored = idxs.slice().sort((a, b) => {
        const ua = String(rd[a][3] || '') ? 1 : 0, ub = String(rd[b][3] || '') ? 1 : 0;
        if (ua !== ub) return ub - ua;                       // image_url 있는 쪽 우선
        const ta = new Date(rd[a][6]).getTime() || 0, tb = new Date(rd[b][6]).getTime() || 0;
        return tb - ta;                                       // 그 다음 최신 우선
      });
      const keepI = scored[0];
      idxs.forEach(i => { if (i !== keepI) delR.push(i + 2); });
      Logger.log('자기치유: report_cards ' + k + ' ' + idxs.length + '행 → 1행');
    });
    if (delR.length) {
      delR.sort((a, b) => b - a).forEach(rn => rcH.deleteRow(rn));
      Logger.log('자기치유: report_cards 중복 ' + delR.length + '행 삭제(남은 ' + (nR - delR.length) + '행)');
    }
  }
  /* ⑤ [v9.127] teacher_checkins 연타 중복 정리 — 08-02 실측: 같은 강사의 「출근」이 3초 안에 3건,
   *   「퇴근」이 2건 쌓여 있었다(버튼 연타·네트워크 재시도). today_board는 최소/최대만 쓰므로 집계는
   *   무해하지만 출퇴근 이력 화면이 지저분해지고, 근무 시간을 사람이 셀 때 오독을 부른다.
   *   **같은 이름·같은 유형·60초 이내**만 묶어 가장 이른 1건을 남긴다(정상 출근/퇴근은 몇 시간 간격이라 안 걸린다). */
  const tcH = ss.getSheetByName('teacher_checkins');
  /* [v9.133] 시각 열 표시 형식 보증 — **행 수 가드 밖**에 둔다. 08-02 실측에서 「ISO 원시 타임스탬프」로
   *   보고된 것의 정체가 이것이다: 셀 값은 정상 Date였고 **서식이 없어서** `2026-07-24T04:22:17.691Z`로
   *   렌더되고 있었다(데이터 결함 아님). 그런데 사람은 그 화면을 보고 「데이터가 깨졌다」고 읽는다.
   *   빈 시트일수록 반드시 걸어야 한다 — 서식을 미리 깔아 둬야 **첫 출근 기록이 처음부터 제대로 보인다**.
   *   아래 중복 정리 가드(행 2개 이상) 안에 두면 갓 비운 시트를 영영 건너뛴다(수리 직후 실측으로 발각). */
  if (tcH) {
    const tf = tcH.getRange(2, TC_TIME_COL, Math.max(tcH.getMaxRows() - 1, 1), 1);
    if (tf.getNumberFormat() !== 'yyyy-mm-dd hh:mm') tf.setNumberFormat('yyyy-mm-dd hh:mm');
  }
  if (tcH && tcH.getLastRow() >= 2) {
    const nT = tcH.getLastRow() - 1;
    const td = tcH.getRange(2, 1, nT, 3).getValues();
    const parsed = td.map((r, i) => {
      const nm = String(r[TC_NAME_COL - 1] || '').trim();
      const tp = String(r[TC_TYPE_COL - 1] || '').trim();
      const d = r[TC_TIME_COL - 1];
      const t = (d instanceof Date) ? d.getTime() : new Date(d).getTime();
      return { i: i, nm: nm, tp: tp, t: isFinite(t) ? t : 0 };
    }).filter(x => x.nm && x.tp && x.t);
    const byNT = {};
    parsed.forEach(x => { (byNT[x.nm + '|' + x.tp] = byNT[x.nm + '|' + x.tp] || []).push(x); });
    const delT = [];
    Object.keys(byNT).forEach(k => {
      const list = byNT[k].slice().sort((a, b) => a.t - b.t);
      let anchor = null;
      list.forEach(x => {
        if (anchor && x.t - anchor.t <= 60000) { delT.push(x.i + 2); return; } // 60초 이내 = 연타
        anchor = x;
      });
    });
    if (delT.length) {
      delT.sort((a, b) => b - a).forEach(rn => tcH.deleteRow(rn));
      Logger.log('자기치유: teacher_checkins 연타 중복 ' + delT.length + '행 삭제(60초 이내 같은 이름·유형)');
    }
  }
}

// [v9.6] 🌍 월드 레이드 — 학원 전체 vs 망각의 대군주 (월간 · 반 보스들의 배후 = 스토리북 최종 보스)
const WORLD_HP_PER = 150; // [v9.83] 100→150. 재적 1인당 HP 계수 — 데미지 = 전교 이번 달 획득 총합이라 지급 단가의 종속 변수(구 100은 "1인당 월 ~100P" 가정이었는데 실측이 그 3~5배였다)
function worldBossOf(ss) {
  const ct = ss.getSheetByName('contents');
  let w = null;
  if (ct && ct.getLastRow() >= 2) ct.getRange(2, 1, ct.getLastRow() - 1, 5).getValues().forEach(r => {
    if (r[1] === 'worldboss' && r[2] && !w) w = { name: String(r[2]), open: String(r[3] || '').split('|')[0] || '', win: String(r[3] || '').split('|')[1] || '', img: r[4] || '' };
  });
  return w || { name: '망각의 대군주 제로', open: '너희가 배운 모든 것을... 0으로 되돌려주마...', win: '기억하는 자들 앞에서, 망각은 이름을 잃었다!', img: '' };
}

function worldRaidMonthly_() { // 매월 1일: 지난달 판정·보상 → 이번 달 소환 (멱등)
  // [v9.147] 월드레이드 시즌 오프 — 집단 이벤트를 레이드 1종으로 압축(유호 08-03). 호출부는 유지.
  //   ⚠ 되살릴 때 주의: 이 함수는 「지난달 판정 → 이번 달 소환」 2단이라, 끈 기간의 world_raid 행은
  //   판정되지 않은 채 남는다. true로 돌리면 그달치부터 다시 도는 것이 맞고 과거 행 소급 판정은 하지 않는다.
  if (!WORLD_RAID_ON) return;
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
      .forEach(pr => { if (pr[0] && pr[3] === 'student') winRows.push([pr[0], PT.월드, '월드레이드', 'SYSTEM']); });
    if (winRows.length) appendPoints(ss, winRows);
    // [v9.40] 직접 쓰기 → addNotice(헤더 자동 인식) — 구 스키마 notices에서 열이 어긋나던 결함 수정(leagueSettle_와 동일)
    addNotice(ss,
      win ? '🌍 월드 레이드 대승리! ' + wb.name + ' 격파!' : '🌍 월드 레이드 — ' + wb.name + ' 봉인 성공!',
      win ? '"' + wb.win + '" 전교 크루의 ' + dmg + ' 데미지가 대군주를 쓰러뜨렸습니다! 전원 +' + PT.월드 + 'P!'
          : '전교 크루가 ' + dmg + ' 데미지로 대군주를 한 달 더 봉인했습니다. 다음 달, 완전한 승리를 향해!');
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
const CARD_TIERS = [[200,'플래티나','linear-gradient(135deg,#E4E4E7,#D1D2D4,#FEF0E9)','💎'],[100,'골드','linear-gradient(135deg,#F5A623,#FDE68A)','🥇'],[50,'실버','linear-gradient(135deg,#CBD5E1,#F1F5F9)','🥈'],[0,'브론즈','linear-gradient(135deg,#D6A67C,#F3E3CF)','🥉']];
function buildMonthlyCards_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const ym = Utilities.formatDate(lastM, tz, 'yyyy-MM');
  const cd = ensureSheet(ss, 'synk_cards', ['월','student_id','카드HTML']);
  ymTextColFix_(cd, 1, tz); // [v9.97]
  if (cd.getLastRow() >= 2 && cd.getRange(2, 1, cd.getLastRow() - 1, 1).getValues().some(r => ymTextOf_(r[0], tz) === ym)) return; // 멱등
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return;
  // [v9.28] 주말반 보정 — 반유형(AJ36)별 지난달 예정 수업일로 카드 티어를 정규화(랭킹은 그대로, 카드만 공정 보정)
  const lastDayOfLastM = new Date(now.getFullYear(), now.getMonth(), 0);
  const schWeekday = scheduledSoFar_('평일', lastDayOfLastM) || 1;
  const schWeekend = scheduledSoFar_('주말', lastDayOfLastM) || 1;
  const stus = [];
  pf.getRange(2, 1, pf.getLastRow() - 1, 36).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') stus.push({ id: r[0], nm: r[1] || r[0], mon: r[18] || '뉴로', type: String(r[35] || '평일') });
  });
  const mP = {}, crowns = {}, raids = {}, cardLogs = {};
  const plC = ss.getSheetByName('point_logs');
  if (plC && plC.getLastRow() >= 2) plC.getRange(2, 1, plC.getLastRow() - 1, 6).getValues().forEach(r => {
    if (!r[1] || !r[5] || dstr(r[5], tz).indexOf(ym) !== 0) return;
    const pts = Number(r[2]) || 0, rs = String(r[3] || '');
    if (pts > 0) (cardLogs[r[1]] = cardLogs[r[1]] || []).push({ d: parseInt(dstr(r[5], tz).slice(8), 10), rs: rs, pts: pts });
    if (pts > 0 || rs.indexOf('정정') > -1) mP[r[1]] = (mP[r[1]] || 0) + pts;
    if (rs === '오늘의 도전' || rs === '오늘의 MVP' || rs === '오늘의 성장' || rs === '오늘의 시냅스') crowns[r[1]] = (crowns[r[1]] || 0) + 1;
    if (rs === '레이드보상' || rs === '월드레이드') raids[r[1]] = (raids[r[1]] || 0) + 1;
  });
  const monMapC = monsterImgMap_(ss); // [v9.35] 단계명→이미지 — 카드에 몬스터 1장 삽입
  const rows = stus.map(s => {
    const pts = mP[s.id] || 0;
    const sch = s.type === '주말' ? schWeekend : schWeekday;
    const normPts = Math.round(pts / sch * schWeekday); // [v9.28] 수업일당 환산 — 주말반도 같은 기준으로 티어 판정
    const tier = CARD_TIERS.find(tt => normPts >= tt[0]);
    const stat = pts > 0
      ? '⚡ ' + pts + 'P · 🔥 ' + (crowns[s.id] || 0) + ' · ⚔️ ' + (raids[s.id] || 0)
      : '🌟 다음 달 주인공 예약';
    const mi = String(monMapC[s.mon] || ''); // [v9.35]
    // [v9.35] 골격을 소프트 글로우 축으로 정렬(보더 #C4B5FD 2px·라운드 18/12·섀도) — 티어 그라디언트는 유지
    return [ym, s.id, CARD_WEBFONT + '<div style="' + CARD_FONT + 'background:' + tier[2] + ';border:2px solid #FBB7A3;border-radius:18px;padding:10px;max-width:230px;box-shadow:0 6px 18px rgba(249,104,89,.14);">' +
      '<div style="background:#fff;border-radius:12px;padding:10px 12px;text-align:center;">' +
      '<div style="font-size:11px;color:#6B7280;">SYNK ' + ym + ' · ' + tier[3] + ' ' + tier[1] + '</div>' +
      '<div style="font-size:17px;font-weight:800;padding:3px 0;">' + s.nm + '</div>' +
      (mi.indexOf('http') === 0 ? '<img src="' + mi + '" style="width:72px;image-rendering:pixelated;display:block;margin:2px auto 0;"/>' : '') + // [v9.35] A안 이미지에도 무해
      '<div style="font-size:12px;color:#1D1D1C;">' + s.mon + '와 함께한 한 달</div>' +
      '<div style="font-size:11px;color:#6B7280;padding-top:2px;">' + (function(){ const ps2 = playStyleOf_(cardLogs[s.id] || []); return ps2[0] + ' ' + ps2[1]; })() + '</div>' +
      '<div style="font-size:13px;padding-top:6px;border-top:1px dashed #E5E7EB;margin-top:6px;">' + stat + '</div>' +
      '</div></div>'];
  });
  if (rows.length) cd.getRange(cd.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
  Logger.log('이달의 카드 ' + ym + ': ' + rows.length + '장');
}

// [v9.56] 🖨️ 이달의 카드 실물 인쇄(도전안④ 물성화) — ▶ 수동 실행(월례 세리머니 직전 1회).
//   synk_cards 최신 발간월을 A4용 그리드 HTML로 Drive 'SYNK_인쇄' 폴더에 저장(가능하면 PDF도)
//   + 원장 메일로 링크. 앱·Glide 변경 0 — 디지털 카드의 물성화라 원격 앱이 못 베끼는 리텐션 표면.
function printMonthlyCards() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cd = ss.getSheetByName('synk_cards');
  if (!cd || cd.getLastRow() < 2) return '카드 없음 — 매월 1일 발간 후 실행하세요';
  const rowsP = cd.getRange(2, 1, cd.getLastRow() - 1, 3).getValues();
  let ymP = '';
  rowsP.forEach(r => { const y6 = String(r[0] || ''); if (y6 > ymP) ymP = y6; });
  const cards = rowsP.filter(r => String(r[0]) === ymP && r[2]).map(r => String(r[2]));
  if (!cards.length) return ymP + ' 발간분 없음';
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>SYNK 이달의 카드 ' + ymP + '</title>' +
    '<style>body{margin:0;padding:8mm;background:#fff;}.g{display:flex;flex-wrap:wrap;gap:5mm;}.c{width:62mm;}@media print{.c{page-break-inside:avoid;}}</style></head>' +
    '<body><div class="g">' + cards.map(c => '<div class="c">' + c + '</div>').join('') + '</div></body></html>';
  const blob = Utilities.newBlob(html, 'text/html', 'SYNK_이달의카드_' + ymP + '.html');
  const it = DriveApp.getFoldersByName('SYNK_인쇄');
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder('SYNK_인쇄');
  const fHtml = folder.createFile(blob);
  let pdfUrl = '';
  try { const pdf = blob.getAs('application/pdf'); pdf.setName('SYNK_이달의카드_' + ymP + '.pdf'); pdfUrl = folder.createFile(pdf).getUrl(); } catch (eP) {}
  const msg = ymP + ' 카드 ' + cards.length + '장\nHTML: ' + fHtml.getUrl() + (pdfUrl ? '\nPDF: ' + pdfUrl : '\n(PDF 자동 변환 실패 — HTML 파일을 열어 Ctrl+P로 인쇄)');
  if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 🖨️ 이달의 카드 인쇄 파일 (' + ymP + ')', msg + '\n\n인쇄 팁: A4 가로 방향 + "배경 그래픽" 옵션 켜기. 이름 인쇄 지급 전 학생·학부모 동의 확인.');
  Logger.log(msg);
  return msg;
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
      ? '<div style="width:31%;margin:1%;background:linear-gradient(135deg,#FBF7F0,#E4E4E7);border:2px solid #D1D2D4;border-radius:12px;text-align:center;padding:8px 0;float:left;"><div style="font-size:22px;">' + MAP_EMOJI[i] + '</div><div style="font-size:11px;font-weight:700;">' + nm + '</div><div style="font-size:10px;color:#1D1D1C;">⭕ 정복!</div></div>'
      : '<div style="width:31%;margin:1%;background:#F3F4F6;border:2px dashed #D1D5DB;border-radius:12px;text-align:center;padding:8px 0;float:left;opacity:.75;"><div style="font-size:22px;">🌫️</div><div style="font-size:11px;color:#9CA3AF;">???</div><div style="font-size:10px;color:#9CA3AF;">' + (i + 1) + '월의 무대</div></div>';
  }
  const html = CARD_WEBFONT + '<div style="' + CARD_FONT + 'background:#fff;border:2px solid #D1D2D4;border-radius:16px;padding:12px;"><div style="font-size:14px;font-weight:800;padding-bottom:6px;">🗺️ 시냅스 여행 지도 — 한국 12경 <span style="color:#1D1D1C;">' + n + '/12곳 정복</span></div><div style="overflow:hidden;">' + cells + '</div><div style="clear:both;font-size:11px;color:#6B7280;padding-top:6px;">매달 싱크 스토리가 발간되면 새로운 무대에 도장이 찍혀요 📖</div></div>';
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

/* [08-27 유호 지시 A] 🚫 writeLeagueHistory 를 통째로 걷었다 — 반 대항 리그 폐지.
 *   이것이 내던 것: league_history 행(챔피언반·준우승) · 학생 홈 고정 배너 「🏛 N월의 전당 —
 *   챔피언 (반) · MVP (실명)」 · 전교 공지 「챔피언: (반) (N P) — 명예의 전당에 기록되었습니다!」.
 *   1차에서는 «호출만» 껐는데 codex ①검수가 「배너 값이 시트에 굳어 무기한 노출된다」를 잡았다 —
 *   소비도 끊었고(Code.js), 이제 함수 자체도 없앤다. 껍데기를 남기면 다음 손이 되살린다. */

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
  let iT = find(['title', 'title_ko', '제목']); // [v9.40] 라이브 구 스키마(notice_id·title_ko·body_ko…) 인식 — 없으면 공지가 notice_id 열에 오기록되던 실버그 수정
  let iB = find(['body', 'body_ko', 'content', '내용', '본문']);
  let iC = find(['created_at', 'date', '날짜', '작성일']);
  if (iT === -1 && iB === -1) { iT = 0; iB = 1; if (iC === -1) iC = 2; }
  const row = new Array(lastCol).fill('');
  if (iT > -1) row[iT] = title;
  if (iB > -1) row[iB] = body;
  if (iC > -1) row[iC] = new Date();
  sh.getRange(sh.getLastRow() + 1, 1, 1, lastCol).setValues([row]);
}

