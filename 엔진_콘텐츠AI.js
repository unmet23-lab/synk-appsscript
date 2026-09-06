// SYNK 엔진 분할부 — 콘텐츠·AI — 콘텐츠 셋업·문법 커리큘럼·워치독·매니페스트·진단·원장 브리핑·강사 알림·학부모 스위프·폼 출석 전개·AI 첨삭·AI 스튜디오·번역·콘텐츠 뱅크·온보딩·노션 동기화.
// 원본은 Code.js 단일 파일이었다. 로드 순서 정본 = .clasp.json filePushOrder(상수 정본 Code.js가 선두). 표식 기반 테스트는 tests/_engine-source.js가 전 파일을 합본해 본다.
/* ===================== [v5] 콘텐츠 셋업 (contents 6열 v4 스키마) =====================
 * 스키마: [id, type, name(C), text(D), extra(E), value(F)]
 * 같은 type만 교체하고 나머지(store·quote 등)는 그대로 유지.                */

function replaceContentType(ss, type, items) {
  // [v5.2] 전체 열 보존 — G열(몽골어)/H열(영어) 번역이 다른 type의 setup 재실행에도 밀리지 않음
  //        단, 같은 type을 재실행하면 그 type의 번역은 초기화됨 → translateContents 재실행
  const ct = ss.getSheetByName('contents') ||
    ensureSheet(ss, 'contents', CONTENTS_HEADERS); // [v9.9] 무에서 재건 대응 · [v9.241] 헤더 정본 공유(골격 등재)
  const last = ct.getLastRow();
  const width = Math.max(ct.getLastColumn(), 8);
  if (ct.getMaxColumns() < width) ct.insertColumnsAfter(ct.getMaxColumns(), width - ct.getMaxColumns()); // [v9.40] 그리드 폭 가드 — Glide가 열을 줄인 시트에서 8열 접근 예외 방지
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

/* [함께한날 막7] 구 setupMonsters(7단계 씨앗) 소각 — 씨앗 원문은 git 이력에 있다.
 * contents 시트의 type='monster' 7행도 08-27 에 물리 삭제했다(purgeLegacyMonsterRows_ · 유호 지시).
 * 라이브 E열 이미지 7개(막0 실측 스냅샷)는 드라이브 파일이 살아 있어 삭제 뒤에도 복구 가능하다. */

/* ===================== [함께한날 막1] 가이드 셋 — 7단계 캐릭터의 자리를 잇는다 =====================
 * 유호 확정 08-26 「7단계 캐릭터는 이제 없어. 마스코트로 대체될거야」 · 설계 정본 = docs/함께한날_설계_v1.md.
 * 성장의 «몸»은 게이지(함께한 날·내가 맞힌 말)고 가이드는 «옷»이다(설계 §0-㉡ — 꺼도 게이지는 돈다).
 * F열(임계) = 0 셋 — 가이드는 선택제라 «자격»이 없다(도달 임계 축 자체가 없다).
 * E열(이미지)는 시트 커스텀(CONTENT_CUSTOM_TYPES) — 사람이 채운 URL 이 정본이라 재실행이 덮지 않게
 * 아래 setupGuides 가 기존 값을 씨앗 위에 얹는다. 씨앗 URL 은 «비었을 때의 기본값»이다.
 * 소개 문장은 가이드_정본.md §2 성격 규격(까몽=한 낱말·몸짓, 마린=시작과 끝에만)을 그대로 딴다. */

/* 아바타 그림이 사는 곳 — 저장소 자신이다(08-27).
 * 왜 드라이브가 아닌가: ①구 몬스터 7장은 드라이브 lh3 였고 «파일을 공개로 돌려놓는» 손이 매번 들었다
 *   ②이 저장소는 public 이라 raw 가 그대로 열린다(실측 200 · image/jpeg) ③자산 정본이 git 안에 있어
 *   「어느 그림이 현행인가」를 파일 하나가 안다 — 굽기를 다시 하면 URL 을 안 건드려도 그림이 바뀐다.
 * ⚠ 한글 경로는 «퍼센트 인코딩»으로 박는다 — 시트 셀 → HTML → 앱을 거치며 어디서 인코딩이 갈릴지
 *   모른다. 인코딩판도 실측 200 이다(둘 다 재봤다).
 * 굽는 자 = tools/가이드아바타굽기.py */
const GUIDE_IMG_BASE_ = 'https://raw.githubusercontent.com/unmet23-lab/synk-appsscript/master/docs/'
  + '%EC%BA%90%EB%A6%AD%ED%84%B0/%EA%B0%80%EC%9D%B4%EB%93%9C_%EC%95%84%EB%B0%94%ED%83%80/';
const GUIDE_IMG_ = {
  몽글: GUIDE_IMG_BASE_ + '%EB%AA%BD%EA%B8%80_%EC%95%84%EB%B0%94%ED%83%80_%EB%B0%B0%ED%8F%AC.jpg',
  까몽: GUIDE_IMG_BASE_ + '%EA%B9%8C%EB%AA%BD_%EC%95%84%EB%B0%94%ED%83%80_%EB%B0%B0%ED%8F%AC.jpg',
  /* 마린도 08-28 에 섰다(유호 「해골 빼고 아바타까지」). 08-27 에 비워 뒀던 까닭 — 렌더 전량이
   * 총과 해골을 정면에 들었다 — 은 두 갈래로 풀렸다: ①우주복판이 갑옷을 통째로 대신해 가슴
   * 독수리+해골이 사라졌고 ②헬멧 해골은 «조각째» 걷었다(tools/마린에셋들이기.py 의 빼기=상자). */
  마린: GUIDE_IMG_BASE_ + '%EB%A7%88%EB%A6%B0_%EC%95%84%EB%B0%94%ED%83%80_%EB%B0%B0%ED%8F%AC.jpg'
};
function GUIDE_ROWS_() {
  return [
    ['G01', 'guide', '몽글', '곁에 오는 펠트 친구 🧶 말을 걸고, 웃고, 네가 맞힌 문장을 기억해요.', GUIDE_IMG_.몽글, 0],
    ['G02', 'guide', '까몽', '말수가 적은 단짝 🖤 한 낱말과 몸짓으로 곁을 지켜요.', GUIDE_IMG_.까몽, 0],
    ['G03', 'guide', '마린', '시작과 끝에만 나타나는 미니어처 ⚓ 조용히 너의 길을 봐 두어요.', GUIDE_IMG_.마린, 0]
  ];
}
function setupGuides() {
  /* 보존 병합(codex P1 600dc085·9e34ff3d) — replaceContentType 은 그 type 을 «통째 교체»라, 유호님이
   * 채운 E열 이미지·G/H 번역이 재실행마다 '' 로 덮이던 자리(CONTENT_CUSTOM_TYPES 에 guide 를 넣은
   * 보존 «의도»와 실행 경로가 모순). 이름 기준으로 기존 커스텀 셋(E·G·H)을 씨앗 위에 얹고 교체한다 —
   * bootstrapSynk 의 무조건 호출도 이제 무해하다. */
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const keep = {};
  const ct0 = ss.getSheetByName('contents');
  if (ct0 && ct0.getLastRow() >= 2) {
    const w0 = Math.min(ct0.getLastColumn(), 8);
    ct0.getRange(2, 1, ct0.getLastRow() - 1, w0).getValues().forEach(r => {
      if (r[1] === 'guide' && r[2]) keep[String(r[2]).trim()] = { img: String(r[4] || ''), mn: String(r[6] || ''), en: String(r[7] || '') };
    });
  }
  const rows = GUIDE_ROWS_().map(r => {
    const k = keep[String(r[2]).trim()];
    if (!k) return r;
    const m = r.slice();
    while (m.length < 8) m.push('');
    /* 🔑 보존하는 값은 «렌더 가능한» 것만이다(codex P2 1eb51d89 · 자가 둘이면 반드시 갈린다).
     *   「비어 있지 않으면 보존」이던 때, E열에 오타 URL 같은 렌더 불가 값이 들어가면 그것이 커스텀으로
     *   보존돼 **시트에 영영 남았다** — 화면은 http 로 시작하는 것만 그리니 그 가이드는 계속 점으로 뜨고,
     *   자가보장은 「그림 있음」으로 세어 복구를 건너뛴다. 판정자는 guideDotHtml_ 과 «같은 함수»다.
     *   ⚠ 렌더 불가 값은 씨앗으로 되돌아간다(씨앗이 비었으면 빈 채로) — E열은 image_url 자리라
     *     URL 아닌 값은 어차피 쓰이지 않는다. */
    if (guideImgOk_(k.img)) m[4] = k.img;
    if (k.mn) m[6] = k.mn;
    if (k.en) m[7] = k.en;
    return m;
  });
  replaceContentType(ss, 'guide', rows);
  /* 무엇이 실제로 섰는지 돌려준다 — 메뉴가 이 문자열을 alert 로 띄운다(bootstrapSynk 은 안 읽는다).
   * 「눌렀는데 뭐가 됐는지 모른다」를 없애는 자리다: 그림이 붙은 이름과 빈 이름이 갈려 보인다. */
  const 요약 = rows.map(r => String(r[2]) + (guideImgOk_(r[4]) ? ' 🖼' : ' (그림 없음)')).join(' · ');
  return '가이드 ' + rows.length + '행 세움 — ' + 요약;
}


/* [함께한날 막7 마감] 구 몬스터 씨앗 «행» 물리 삭제 — setupMonsters 소각(함수)의 짝(데이터).
 * 코드는 이미 monster type 을 안 읽는다(막6·막7 · 진단 monThr·상세카드는 0행에 안전 — 전수 확인 08-27).
 * 멱등: 이미 0행이면 0행 삭제. 삭제 전 스냅샷(id:E열이미지)을 반환·로그로 남긴다(설계 문서 끝에도 박혀 있다).
 * 왜 함수인가: 「비가역 운영 삭제」라 유호님 승인 자리였고, 08-27 유호 「직접 지워줘」로 실행 — 이력에 남긴다. */
function purgeLegacyMonsterRows_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ct = ss.getSheetByName('contents');
  if (!ct || ct.getLastRow() < 2) return 'contents 비어 있음 — 삭제 0';
  const before = ct.getRange(2, 1, ct.getLastRow() - 1, 6).getValues().filter(r => String(r[1]) === 'monster');
  const snap = before.map(r => String(r[0]) + ':' + String(r[4] || '')).join(' · ');
  replaceContentType(ss, 'monster', []); // monster type 만 제거 · 나머지 type·번역열 보존(replaceContentType 규약)
  const msg = 'monster 행 ' + before.length + '개 삭제(스냅샷 ' + before.length + ': ' + snap + ')';
  Logger.log('[purgeLegacyMonsterRows_] ' + msg);
  return msg;
}

/* ===================== [v9.36] 학습추적(W3) — 문법 커리큘럼 정본 (진화 게이트) =====================
 * ⚠️ 유호님·강사 검수 대상 초안 — 문형·설명은 교육 전문 영역, 코드 반영 후에도 교체 자유.
 *    (구 표기 「TOPIK 1~2급 기준 선정」은 낡았다 — 08-12 급수 태그 실측 결과 1~5급에 걸친다. ↓ 태그 절)
 * 정본 = 이 상수 → setupGrammarBank()가 contents type='grammar'로 재건(단일 파일 복구 철학).
 * ID G단계번호+순번 2자리(G201~G712) · 게이트단계 = 도착 단계 번호(2~7) · contents F열 = 단계×100+순번.
 * STORY_GRAMMAR(3~4급·월 로테이션)와는 급수·용도·구조가 달라 별도 정본 유지 — G7xx 일부 겹침은 무방. */
// [함께한날 막6] 구 GRAMMAR_GATE_NEED(층별 진화 게이트 임계) 소각 — 게이트는 «층»에서 «누계»로 옮겨 갔다
//   (Code.js SCENE_LADDER_ 맞힌 말 문턱 · 설계 §4-3: 층 6 vs 장면 12 불일치·첫 층 공짜 문제의 처방).

/* ===================== [v9.218] TOPIK 급수 태그 (칸 4·5·6) =====================
 * 🔴 [09-04 정정] 이 자리의 옛 주석은 「유호님 확정 2026-08-12 — 레벨별 «교재 진도»에 맞게 TOPIK을
 *   앱에 반영한다」였다. 둘 다 걷는다: ① 그 문구를 `docs/_ops/결정.md` 에서 찾으면 **0건**이다
 *   (출처를 못 찾은 인용) ② 유호 확정 2026-09-03 「교재와 앱은 아예 별개다 · 앱·엔진 설계는
 *   교재를 전제하지 않는다」가 교재 전제를 통째로 걷었다.
 *   ⇒ 이 칸이 실제로 붙는 곳은 교재가 아니라 **급수 요목과 문법 뱅크**(우리 것)다.
 *   채택 갈래 = ㉡ **기출을 문항 소스로 싣지 않고, 급수 판정 «기준»으로만 쓴다**
 *   (㉠ 기출 탑재는 철학 ①기본의 「신선」 미달 + 저작권 축이라 기각).
 *
 * ■ 칸 규격 — [id, 이름, 설명, 도입급, 재출현급, 근거]
 *   **도입급** = 그 문형을 처음 다루는 TOPIK 급(1~5). 6급은 없다 — 자체 콘텐츠 상한이 5급이다
 *     (커리큘럼 정본 v1.2 ⓪ · 「6급 반은 열지 않는다」). 회귀가 6 이상을 막는다.
 *   **재출현급** = 상위 급에서 심화·확장·복습으로 «다시» 다루는 급 · 없으면 null.
 *     🔑 두 칸인 이유: TOPIK은 같은 문형이 급을 걸쳐 반복되고, 커리큘럼도 Lv3=2~3급·Lv5=3~4급으로
 *     **일부러 겹치게** 설계했다(정본 v1.2 🚫「중복이니 정리하자」). 한 칸이면 그 겹침을 못 적고,
 *     못 적으면 Lv5 학생에게 3급 복습을 줄 근거가 사라진다.
 *   **근거** = 이 «도입급»이 어디서 왔나. `요` = 커리큘럼 정본 §3 문법 요목에 그 문형이 직접
 *     적혀 있다(그 절의 [도입]/[심화]/[확장] 태그를 그대로 옮겼다) · `표` = 요목에 문형이 없어
 *     국제통용 한국어 표준 교육과정 기준으로 배정했다.
 *     🔑 이 칸을 두는 이유는 **지어낸 것과 정본을 옮긴 것이 같은 모양이면 안 되기 때문**이다
 *     (팩 주석 `contents/토픽퀴즈문항.js` — 「급수 대응을 지어내지 않는다 · 교재·급수 담당 몫」 ⚠ 09-03 확정으로 교재는 재헌님 몫이 됐다 — 우리 몫은 급수뿐이다).
 *     우리 급수 여섯(Lv1~6)의 뜻이 바뀌면 **`표` 만 재검토**하면 된다. 재출현급은 요목 직결분만 적는다(추정 금지).
 *   ⚠ 요목과 표준이 갈리면 **정본이 이긴다** — 예: `-(으)ㄹ수록` 은 표준으론 3급이지만 커리큘럼
 *     Lv5 요목이 「5급/6급 경계 문법의 5급 배분」으로 명시해 5급이다.
 *
 * ■ 소비자는 칸을 늘려도 안 깨진다 — 기존 자리는 전부 g[0]·g[1]·g[2] 만 읽는다
 *   (`setupGrammarBank` 시트 재건 6칸 고정 · `grammarNameMap_` · 교재연동 판정 프롬프트).
 *   급수는 **시트에 안 싣는다** — contents E열은 이미 이미지 칸이고(replaceContentType 보존 병합),
 *   새 열을 여는 것은 소비자가 생길 때다(지금 소비자는 아래 순수 함수뿐).
 *
 * ■ 🔴 이 태그가 붙어서 «셀 수 있게» 됐다 — 그리고 **세는 자는 이 주석이 아니다**
 *   ⇒ **`node tools/급수커버리지.js`** (신설 2026-08-31 · 유호 지시). 급수별 보유·근거 갈래와
 *     **커리큘럼 정본 요목 대비 커버리지**를 낸다. 🔑 **수를 여기 다시 적지 않는다** —
 *     08-31 까지 이 자리에 손으로 센 수("1급 21 · 2급 23 · 3급 21 · 4급 6 · 5급 1")가 적혀 있었고,
 *     자가 없는 수는 ①다음 사람에게 실측으로 보이고 ②뱅크가 자라는 순간 조용히 거짓이 된다.
 *   ⚠ 머리 주석의 「TOPIK 1~2급 기준 선정」은 낡았고(실제로는 1~5급에 걸친다), G7xx 주석의
 *     「2급 상단+3급 진입」도 낡았다(G704=5급·G705·G710~712=4급).
 *   🔴 **유호님이 겨냥한 4~5급 구간이 바로 이 뱅크의 빈 곳**이다 — 08-31 확정 보장선이 **4급**이라
 *     그 갭은 그대로 부채가 된다. 지금 크기는 위 도구가 낸다(`--급 4`).
 * ================================================================================ */
const GRAMMAR_BANK = [
  // G2xx — 뉴로→스파키 (게이트 비활성 · 노출용 커리큘럼)
  ['G201', '이/가', '주격 조사 — 주어 표시', 1, null, '요'],
  ['G202', '은/는', '화제·대조 조사', 1, null, '요'],
  ['G203', '을/를', '목적격 조사', 1, null, '요'],
  ['G204', '-이에요/예요', '명사 서술 (~입니다의 해요체)', 1, null, '표'], // 요목 Lv1 종결형은 -ㅂ니다·-아/어요만 적고 명사 서술은 빠져 있다

  ['G205', '-아/어요', '현재 시제 해요체', 1, null, '요'],
  ['G206', '에', '장소·시간 조사', 1, null, '요'],
  ['G207', '에서', '동작이 일어나는 장소', 1, null, '요'],
  ['G208', '-았/었어요', '과거 시제', 1, null, '요'],
  ['G209', '안 부정', '안 + 동사/형용사 부정', 1, null, '요'],
  ['G210', '하고/와/과', '나열·함께', 1, null, '요'],
  ['G211', '-(으)세요', '요청·존대 명령', 1, null, '요'],
  ['G212', '숫자/시간 표현', '한자어·고유어 수 읽기', 1, null, '요'],
  // G3xx — 스파키→링커
  ['G301', '-고 싶다', '희망·바람', 1, null, '표'],
  ['G302', '-(으)ㄹ 거예요', '미래·계획', 1, 2, '요'],       // Lv1 근접미래 도입 → Lv2 추측으로 의미 확장
  ['G303', '-(으)러 가다', '이동의 목적', 2, null, '요'],
  ['G304', '-지 않다', '긴 부정', 1, null, '요'],
  ['G305', '못 부정', '능력 밖 부정', 1, null, '요'],
  ['G306', '-고', '동작·상태 나열', 1, 2, '요'],             // Lv2 「복습·문맥 확대만, 재도입 아님」
  ['G307', '-지만', '대조·역접', 1, 2, '요'],
  ['G308', '-아/어서', '이유·순차', 1, 2, '요'],             // Lv2 에서 -(으)니까와 대조 지도
  ['G309', '(으)로', '수단·방향', 1, null, '표'],
  ['G310', '에게/한테', '행위의 대상', 1, null, '표'],
  ['G311', '-(으)ㄹ까요?', '제안·추측 질문', 2, null, '표'],
  ['G312', '보다', '비교', 2, null, '표'],
  /* [08-31] Lv1 부정 체계의 마지막 칸(유호 「Lv1 남은 것도 다 넣어줘」). 요목 「부정 [도입]:
   *   안, 못, -지 않다, -지 못하다」의 넷 중 셋만 있었다(G209 안 · G305 못 · G304 -지 않다).
   *   빈 칸은 «긴 부정 × 능력» 하나 — 짧은 `못`(G305)이 이것의 대체가 아니다(문어·격식에서
   *   갈리고, TOPIK 은 둘을 갈라 묻는다). G3xx 에 둔 것은 제 짝 G304·G305 바로 뒤라서다. */
  ['G313', '-지 못하다', '긴 부정(능력)', 1, null, '요'],
  // G4xx — 링커→서킷
  ['G401', '-(으)면', '조건·가정', 2, null, '요'],
  ['G402', '-(으)ㄹ 수 있다/없다', '능력·가능성', 2, null, '요'],
  ['G403', '-아/어야 하다', '의무·필요', 2, null, '요'],
  ['G404', '-아/어 주세요', '요청·부탁', 2, null, '요'],
  ['G405', '-(으)려고 하다', '의도·계획', 2, null, '요'],
  ['G406', '-기 전에/-(으)ㄴ 후에', '시간의 앞뒤', 2, null, '표'],
  ['G407', '-는 것', '동사의 명사화', 2, null, '표'],
  ['G408', '-아/어 보다', '시도·경험', 2, null, '요'],
  ['G409', '-고 있다', '진행', 2, null, '요'],
  ['G410', '-(으)니까', '이유·발견', 2, null, '요'],
  ['G411', '-네요', '감탄·새로 앎', 2, null, '표'],
  ['G412', '-지요?', '확인 질문', 2, null, '표'],
  // G5xx — 서킷→미엘로
  ['G501', '관형형 -(으)ㄴ/는/(으)ㄹ', '명사 수식', 2, null, '표'],
  ['G502', '-(으)면서', '동시 동작', 3, null, '표'],
  ['G503', '-기 때문에', '이유 강조', 3, null, '표'],
  ['G504', '-게 되다', '상황 변화', 3, null, '표'],
  ['G505', '-아/어도 되다', '허락', 2, null, '요'],
  ['G506', '-(으)면 안 되다', '금지', 2, null, '표'],
  ['G507', '-아/어 있다', '상태 지속', 3, null, '요'],       // Lv3 [도입](결과상태)
  ['G508', '-기로 하다', '결심·약속', 3, null, '표'],
  ['G509', '-(으)ㄴ 적이 있다', '경험 유무', 2, null, '요'],
  ['G510', '-는 게 좋겠다', '권유·조언', 3, null, '표'],
  ['G511', '-군요', '깨달음 감탄', 3, null, '표'],
  ['G512', '-다고/-냐고/-라고/-자고 하다', '간접화법 기초', 3, 4, '요'], // [08-31] 이름을 요목 한 줄 그대로 넓혔다 — 뱅크는 갈래 변이를 한 행에 묶는 규약이다(G402·G609 와 같다). ID·설명 불변이라 mastery_log 과거 행과 몽골어 번역이 다 산다. Lv3 도입 → Lv4 인용 복합·축약 확장
  // G6xx — 미엘로→플로우
  ['G601', '-거든요', '이유 설명(구어)', 3, null, '표'],
  ['G602', '-잖아요', '상기시키기', 3, null, '표'],
  ['G603', '-(으)ㄹ 때', '시점·때', 2, null, '표'],
  ['G604', '-던', '회상 수식', 3, 5, '표'],                  // 도입=표준 3급 · 재출현=Lv5 요목 「회상·단절 -더- 계열: -더니, -던, -았/었더라면」(유호 지시 08-31)
  ['G605', '-아/어지다', '변화·피동', 3, 5, '요'],           // Lv3 피동 도입 → Lv5 이중·의미차 심화
  ['G606', '-게 하다', '사동', 3, 5, '요'],                  // Lv3 사동 도입 → Lv5 심화
  ['G607', '-도록', '목적·정도', 3, null, '요'],
  ['G608', '-(으)ㄹ 것 같다', '추측', 2, null, '표'],
  ['G609', '-대(요)/-래(요)/-냬(요)', '축약 간접화법', 4, 5, '표'], // [08-31] 셋째 갈래 `-냬` 를 이름에 넣었다 — Lv5 요목이 「-대/-래/-냬」 셋을 요구하는데 둘만 적혀 있었다. 괄호로 요체를 품은 것은 도입급 4 가 요체(-대요)이고 재출현 5 가 구어 축약(-대)이라 한 행이 둘 다 져야 하기 때문이다. 도입=표준 4급 · 재출현=Lv5 요목
  ['G610', '-(으)ㄴ/는데', '배경 설명', 2, null, '표'],
  ['G611', '-다가', '동작 전환', 3, null, '표'],
  ['G612', '-(으)ㄹ게요/-(으)ㄹ래요', '의지·의향', 2, null, '요'],
  /* [08-31] Lv3 요목 직결 다섯(유호 「Lv3 빠진 문형들도 뱅크에 넣어줘」). Lv3 은 보장선 4급으로
   *   가는 «통과 구간»이라 여기 빈 자리는 그대로 4급 부채가 된다. 층을 G6xx 로 고른 것은
   *   3급 도입의 집이 여기이고(G601·602·604·605·606·607·611), 특히 접미사 피동·사동은
   *   제 통사적 짝(G605·G606) 바로 뒤에 서야 읽는 사람이 넷을 한눈에 보기 때문이다.
   * 🔑 층 크기(12)는 이제 아무것도 안 묶는다 — 진화 게이트는 막6 에서 소각됐고 G코드는
   *   커리큘럼 내부 순서로만 남았다(`Code.js` calcAll 주석 · 설계 §4-3). */
  ['G613', '-이/히/리/기-', '접미사 피동', 3, 5, '요'],       // 🔴 G605 `-아/어지다`(통사적)의 대체가 아니다 — 다른 문법이다
  ['G614', '-이/히/리/기/우-', '접미사 사동', 3, 5, '요'],    // 🔴 G606 `-게 하다`(통사적)의 대체가 아니다
  ['G615', '-더라고요', '직접 경험 전달', 3, null, '요'],     // 요목 표기 `-더라고(요)` · 스토리 골격 15월과 같은 키로 적어 풀에 둘이 안 선다
  ['G616', '-(으)ㄹ 수밖에 없다', '유일한 선택', 3, null, '요'],
  ['G617', '-치고', '예외 없이·기준 밖 의외', 3, null, '요'], // 요목 `-도록/-치고(는)` 의 뒷갈래(앞갈래 -도록 = G607)
  // G7xx — 플로우→싱크마스터 (⚠ 옛 주석 「2급 상단+3급 진입」은 낡았다 — 실측 3~5급)
  ['G701', '-자마자', '직후', 3, null, '표'],
  ['G702', '-느라고', '이유·핑계', 3, null, '표'],
  ['G703', '-는 바람에', '뜻밖의 원인', 3, null, '요'],
  ['G704', '-(으)ㄹ수록', '비례', 5, null, '요'],            // ⚠ 표준은 3급 · Lv5 요목이 「5급 배분」 명시 → 정본 우선
  ['G705', '-나 보다', '추측', 4, null, '요'],
  ['G706', '-(으)ㄹ 뻔하다', '아슬아슬', 3, null, '표'],
  ['G707', '-기/-게 마련이다', '당연한 이치', 3, null, '요'], // [08-31] 요목 한 줄 그대로 — `-게` 는 순수 이형태라 새 행이 아니라 이름 확장이 맞다. Lv4 중복 제거 → Lv3 «전용» 확정이라 재출현 없음
  ['G708', '-는 대신에', '대체', 4, null, '표'],
  ['G709', '-(으)ㄴ 지', '시간 경과', 3, null, '표'],
  ['G710', '-을/를 통해', '수단·경로', 4, null, '표'],
  ['G711', '-곤 하다', '습관', 4, null, '표'],
  ['G712', '-(으)면서도', '대조 동시', 4, null, '표'],
  /* [08-31] Lv4 대조·양보 셋 — 보장선의 요목 직결분(유호 판정). 근거 = 커리큘럼 정본 Lv4 요목
   *   「대조·양보 [도입]: -는 반면에, -더라도, -음에도 불구하고」. 셋 다 `STORY_GRAMMAR` 에 급수 4로
   *   이미 있었지만 그건 **출제 풀**이라 `mastery_log` 로 «맞힌 말»이 되지 않았다 — 가르친다고 적어
   *   둔 것과 숙달을 세는 것이 갈려 있던 자리다. 이제 정본 한 곳(뱅크)이 둘 다 진다.
   * 🔑 표기는 **요목 그대로** 적는다(`-음에도 불구하고`) — 스토리 골격의 `-에도 불구하고` 와 키가
   *   갈려 `급수문형풀_` 풀에 둘이 같이 서지만, 그 둘은 결합 대상이 다르다(명사 뒤 vs 용언 명사형 뒤)
   *   라 중복이 아니다. 반대로 키를 맞추려고 표기를 바꾸면 근거 칸 `요` 가 거짓이 되고
   *   `급수커버리지` 가 이 문형을 영영 🔴 로 센다 — 자를 속이는 쪽이 더 비싸다. */
  ['G713', '-는 반면에', '대조', 4, null, '요'],
  ['G714', '-더라도', '양보 가정', 4, null, '요'],
  ['G715', '-음에도 불구하고', '양보(그럼에도)', 4, null, '요'],
  /* [08-31] 그리고 넷째 — 같은 판정, 같은 근거(유호 「-는 셈이다도 넣어줘」). 요목 Lv4
   *   「추측·근거 [도입]: -는 셈이다, -나 보다」 — 짝인 `-나 보다` 는 G705 로 이미 있었다.
   *   이 한 줄로 **보장선 Lv4 요목이 5/5 로 닫힌다**(뱅크가 그 급을 다 쥔 유일한 급). */
  ['G716', '-는 셈이다', '따져 보면 마찬가지', 4, null, '요'],
  /* [08-31] Lv5 요목 아홉(유호 「Lv5 남은 것도 다 넣어줘」). 보장 «밖» 재량 구간이지만
   *   커리큘럼 정본이 Lv6=4~5급까지 가므로 여기 빈 자리는 상한을 스스로 깎는 것이었다.
   * 🔑 뒤의 둘(`-더니`·`-았/었더라면`)만 도입급이 4다 — Lv5 요목이 「회상·단절 -더- 계열
   *   [도입]」으로 묶었지만 **표준·스토리 골격 실측이 4급**이라, `-던`(G604)과 같은 꼴로
   *   «도입 4 + 재출현 5»로 적었다. 근거 칸이 `표` 인 것은 도입급의 출처가 요목이 아니라
   *   표준이기 때문이다(재출현 5 는 요목 직결). 뱅크와 스토리 급수를 일부러 맞췄다 —
   *   갈라지면 `급수문형풀_` 에서 같은 문형이 두 레벨로 흩어진다. */
  ['G717', '-(으)ㅁ', '명사화(문어체)', 5, null, '요'],
  ['G718', '-기', '명사화(일반)', 5, null, '요'],
  ['G719', '-(으)ㄴ/는 바', '문어 명사구', 5, null, '요'],
  ['G720', '-느니', '차라리 쪽을 고름', 5, null, '요'],
  ['G721', '-을망정', '극단적 양보', 5, null, '요'],
  ['G722', '-기에', '이유(문어)', 5, null, '요'],
  ['G723', '-다시피', '아는 바와 같이', 5, null, '요'],
  ['G724', '-더니', '관찰 후 변화', 4, 5, '표'],
  ['G725', '-았/었더라면', '과거 가정', 4, 5, '표']
];

/* 레벨(Lv1~6) → 그 레벨이 다루는 TOPIK 급 밴드. 정본 = `docs/커리큘럼_정본_v1.md` v1.2 ⓪표.
 * 🚫 Lv3=2~3급·Lv5=3~4급의 겹침은 오기가 아니라 설계다(정본 명시 · 「정리하자」 재제안 금지). */
const LEVEL_TOPIK_BAND = { 1: [1], 2: [2], 3: [2, 3], 4: [3], 5: [3, 4], 6: [4, 5] };
function grammarStageOf_(gid) { const m = String(gid || '').trim().match(/^G([2-7])\d{2}$/); return m ? Number(m[1]) : 0; } // ID → 게이트단계(검증 겸용)
function grammarBankCounts_() { const c = {}; GRAMMAR_BANK.forEach(g => { const k = grammarStageOf_(g[0]); if (k) c[k] = (c[k] || 0) + 1; }); return c; }
function grammarNameMap_() { const m = {}; GRAMMAR_BANK.forEach(g => { m[g[0]] = g[1]; }); return m; }

/* ── TOPIK 급수 조회 (순수 · 위 칸 4·5·6의 유일한 소비 통로) ──────────────────
 * 호출부가 g[3]·g[4] 를 직접 집지 않게 한 이유: 칸 위치를 두 곳에 적으면 갈라진다.
 * 뱅크에 없는 ID 는 **null 을 낸다** — 0 이나 빈 객체로 접으면 「모르는 문법」과
 * 「급수가 안 붙은 문법」이 같은 모양이 된다(둘은 다른 사고다). */
function grammarGrade_(gid) {
  const row = GRAMMAR_BANK.filter(g => g[0] === String(gid || '').trim())[0];
  return row ? { 도입: row[3], 재출현: row[4], 근거: row[5] } : null;
}

/* 레벨(1~6)이 다루는 문법 ID — 도입급이 밴드 안이면 «새로 배우는 것», 재출현급이 밴드 안이면
 * «다시 만나는 것». 둘을 갈라 내는 이유: 같은 목록으로 합치면 Lv5 학생에게 3급 복습을 줄 때
 * 그것이 신규인지 복습인지 앱이 못 가른다(미니게임 배정·출제 비율의 재료).
 * 모르는 레벨은 빈 밴드 → 두 배열 모두 빈 배열(예외 아님 — 배정이 통째로 죽지 않게). */
function grammarsForLevel_(lv) {
  const band = LEVEL_TOPIK_BAND[Number(lv)] || [];
  const inBand = (g) => band.indexOf(g) >= 0;
  return {
    신규: GRAMMAR_BANK.filter(g => inBand(g[3])).map(g => g[0]),
    복습: GRAMMAR_BANK.filter(g => g[4] != null && inBand(g[4])).map(g => g[0])
  };
}

/* 급수별 문항 커버리지 — 「Lv N 학생이 받을 수 있는 문법이 몇 급에 몇 개인가」의 분모.
 * 이 함수가 있어야 철학 ①기본의 「실사용 도움」을 TOPIK 트랙에서 실제로 «잰다»(감이 아니라). */
function grammarGradeCounts_() {
  const c = {};
  GRAMMAR_BANK.forEach(g => { c[g[3]] = (c[g[3]] || 0) + 1; });
  return c;
}

/* ═══════════════ [v9.279] 토픽 등반 — 급수 «좌표»를 학생에게 돌려준다 ═══════════════
 *
 * 유호 지시 2026-08-31 「철학정본에 빗대서 재밌고 자동화되게 TOPIK 시험에 꼭 도움이 되도록」.
 *
 * ■ 왜 이 자리인가 — **분모와 분자가 둘 다 이미 있었는데 «나누는 자»가 없었다.**
 *   분모 = 바로 위 `grammarGradeCounts_`(급수별 문형 수) · 분자 = `mastery_log` 의 '도달' 행.
 *   그런데 08-31 전수 실측에서 「급수 도달률」을 내는 자리는 저장소에 **0건**이었다. 학생이 듣던
 *   말은 「내가 맞힌 말 12개」라는 **누계 하나뿐**이고, 그 12개가 **몇 급의 몇 %인지**는
 *   한 번도 안 나왔다. 이 절이 그 나눗셈이고, 그래서 새 수집도 새 칸도 필요 없다.
 *
 * ■ 철학 정본에 대어 본 자리(유호 지시의 「빗대서」) — `docs/SYNK_철학.md`
 *   · ①기본 셋 = 재미 · 실사용 도움 · 신선함. **TOPIK 트랙 콘텐츠는 여기에 「급수 직결」까지** 든다.
 *     이 카드가 정확히 그 급수 직결이다 — 오늘 넘은 한 문형이 **몇 급의 몇 %p 인지**로 환산돼 보인다.
 *   · Ⅱ-2 「재미는 합격의 반대말이 아니라 **합격으로 가는 가장 빠른 길**이다」 —
 *     그래서 재미 층을 «따로» 얹지 않았다. 재미와 급수가 **같은 한 장**이다(봉우리·한 걸음의 무게).
 *   · Ⅱ-2 발화 규격 = 사실만 · 평가어 안 얹기 · **비교 없음** · 없는 성공 없음.
 *     ⇒ 이 절에 「합격」·「부족」·「남들보다」·「분발」이 **한 줄도 없다.** 남은 것은 «남은 문형의 이름»뿐이다.
 *   · ③운영 = 사람 손이 거의 안 가는가 ⇒ **손 0.** 밤 배치가 이미 채우는 `mastery_log` 를 나누기만 한다.
 *   · ⑤자기설명 = 처음 본 사람이 ①이게 뭔지 ②뭘 하면 되는지 아는가 ⇒ 카드가 **자기 자를 직접 말한다**(맨 아랫줄).
 *
 * ■ 자를 값과 같이 적는다 — 이 수는 **TOPIK 점수 예측이 아니다.** 재는 것은
 *   「우리 문법 뱅크의 그 급 문형 중, 이 학생이 «서로 다른 날 두 번 스스로» 맞게 쓴/말한 것」이다.
 *   분모가 TOPIK 전체가 아니라 **뱅크**라는 사실을 카드 맨 아랫줄이 말한다. 안 적으면 다음 사람이
 *   이 %를 「합격 확률」로 읽는다 — 수는 자와 함께 적혀야 다음 사람에게 거짓말을 안 한다.
 *
 * ■ 출처 화이트리스트는 «함께한 날»과 **같은 것을 쓴다**(AI첨삭·AI음성·AI대화 — Code.js 막2·막6).
 *   두 지면이 다른 자를 쓰면 학생이 한 화면에서 **서로 다른 두 수**를 보게 되고, 그 갈림은
 *   오류를 안 낸다(조용히 어긋난다). 곁의 실익 하나 — 데모 씨앗이 'lesson' 출처로 '도달' 61행을
 *   깔아 두는데(엔진_셋업확장 stg2) 화이트리스트가 그것을 **원리상 안 센다.**
 *   ⚠ 운영에서 'lesson' 이 쓰는 것은 '연습'뿐이다(엔진_운영배치) — 지금 갈리는 것은 데모 층뿐이다.
 */
const TOPIK_PEAK_MAX = 5;      // 봉우리 수 = 뱅크 도입급 상한. 6급은 없다(자체 콘텐츠 상한이 5급 · 위 §급수 태그)
const TOPIK_PEAK_GATE = 0.8;   // 「그 봉우리에 올랐다」로 부르는 비율
const TOPIK_PEAK_TARGET = 4;   // 과녁 — 유호 확정 08-31 「몽골에서 TOPIK 4급까지 끌고 간다」(docs/_ops/결정.md)

/* 순수 — 도달한 문법 ID 집합 → 급수 좌표. 시트를 안 읽는다(회귀가 직접 태운다).
 *
 * 🔑 «연속»으로 문턱을 넘은 최고 급만 「오른 봉우리」로 센다 — 5급 문형 하나를 우연히 맞혔다고
 *   5급 봉우리에 세우면 그건 **없는 성공**이다(철학 Ⅱ-2). 중간이 비면 거기서 멈춘다.
 *
 * @param {Object} 도달 - { [grammar_id]: true } — `토픽등반_도달맵_` 이 낸다
 * @param {number} [lv] - 학생 급수(Lv1~6) · 없으면 0. 급수 구간 표기에만 쓴다(판정엔 안 쓴다)
 */
function 토픽등반_(도달, lv) {
  const 있음 = 도달 || {};
  const 이름 = grammarNameMap_();
  const 급수들 = [];
  for (let g = 1; g <= TOPIK_PEAK_MAX; g++) {
    const 그급 = GRAMMAR_BANK.filter(row => row[3] === g);
    const 넘은 = 그급.filter(row => 있음[row[0]]);
    급수들.push({
      급: g,
      분모: 그급.length,
      분자: 넘은.length,
      비율: 그급.length ? 넘은.length / 그급.length : 0,
      남은: 그급.filter(row => !있음[row[0]]).map(row => ({ id: row[0], 이름: 이름[row[0]] || row[0] }))
    });
  }
  let 오른 = 0;
  for (let g = 1; g <= TOPIK_PEAK_MAX; g++) {
    const s = 급수들[g - 1];
    if (s.분모 > 0 && s.비율 >= TOPIK_PEAK_GATE) 오른 = g; else break;
  }
  const 다 = 오른 >= TOPIK_PEAK_MAX;
  const 다음 = 다 ? TOPIK_PEAK_MAX : 오른 + 1;
  const 지금 = 급수들[다음 - 1];
  const band = LEVEL_TOPIK_BAND[Number(lv)] || [];
  return {
    급수들: 급수들, 오른봉우리: 오른, 다음봉우리: 다음, 다올랐나: 다,
    지금: 지금, 남은문형: 지금.남은,
    한걸음: 지금.분모 ? 1 / 지금.분모 : 0,   // 하나 더 넘으면 오르는 비율(소수)
    과녁: TOPIK_PEAK_TARGET,
    급수: Number(lv) || 0, 토픽밴드: band
  };
}

/* mastery_log → 학생별 «스스로 넘은» 문법 집합. 시트 1패스(호출부가 학생마다 읽지 않게).
 * 출처 화이트리스트의 근거는 위 머리말 §출처 — 함께한 날과 같은 자다. */
function 토픽등반_도달맵_(ss) {
  const out = {};
  const ml = ss.getSheetByName('mastery_log');
  if (!ml || ml.getLastRow() < 2) return out;
  ml.getRange(2, 1, ml.getLastRow() - 1, 6).getValues().forEach(r => {
    if (String(r[2]) !== '도달') return;
    const src = String(r[5] || '');
    if (src !== 'AI첨삭' && src !== 'AI음성' && src !== 'AI대화') return;
    const sid = String(r[0] || '').trim(), gid = String(r[1] || '').trim();
    if (!sid || !gid) return;
    (out[sid] = out[sid] || {})[gid] = true;
  });
  return out;
}

/* 등반 카드(EA131) — 순수 함수. 회귀가 직접 로드한다.
 * 색은 카드 계열 그대로(#FBF7F0 바탕 · #F96859 코랄 · #8D857A 잔글) — 새 색을 안 만든다. */
function 등반카드HTML_(c) {
  if (!c || !c.급수들) return '';
  const s = c.지금;
  const pct = Math.round(s.비율 * 100);
  const stepP = Math.round(c.한걸음 * 100);
  const peaks = c.급수들.map(p => {
    const done = p.급 <= c.오른봉우리;
    const here = !done && p.급 === c.다음봉우리;
    const tgt = p.급 === c.과녁;
    const dot = 'display:block;margin:0 auto;width:' + (here ? 15 : 12) + 'px;height:' + (here ? 15 : 12) + 'px;border-radius:50%;'
      + 'background:' + (done ? '#F96859' : here ? '#FEF0E9' : '#EDE7DC') + ';'
      + 'border:' + (tgt ? '3px solid #AE322A' : (done || here) ? '2px solid #F96859' : '2px dashed #C7BFB2') + ';';
    return '<span style="display:inline-block;width:19.5%;text-align:center;vertical-align:top;">'
      + '<span style="' + dot + '"></span>'
      + '<span style="display:block;font-size:10px;padding-top:4px;color:' + ((done || here) ? '#2B2320' : '#8D857A') + ';">' + p.급 + '급</span>'
      + '</span>';
  }).join('');
  /* 머리줄 — 사실만. 다 오른 학생에게는 「다음」이 없으므로 문장 자체를 갈아 끼운다
   *   (남은 0개인데 「남은 것」 칸을 비워 두면 화면에 «빈 약속»이 남는다). */
  const head = c.다올랐나
    ? '다섯 봉우리를 다 올랐다'
    : s.급 + '급 문형 <b style="color:#AE322A;">' + s.분자 + '</b> / ' + s.분모;
  const stepLine = (!c.다올랐나 && stepP > 0)
    ? '<div style="font-size:12px;color:#2B2320;padding-top:5px;">지금 한 개를 더 넘으면 <b style="color:#F96859;">' + pct + '% → ' + Math.min(pct + stepP, 100) + '%</b></div>'
    : '';
  /* 가까이 온 것 — 다음 봉우리에서 아직 안 넘은 문형의 «이름» 셋. 이 카드가 「도움」이 되는 자리는
   *   %가 아니라 여기다: 학생이 **다음에 무엇을 써 보면 되는지**를 이름으로 안다. */
  const near = (c.남은문형 || []).slice(0, 3).map(g => escHtml_(g.이름)).join(' · ');
  const nearLine = near
    ? '<div style="font-size:11.5px;color:#8D857A;padding-top:6px;">가까이 온 것 — <span style="color:#2B2320;">' + near + '</span></div>'
    : '';
  const bandLine = (c.급수 && c.토픽밴드.length)
    ? '<div style="font-size:11px;color:#8D857A;padding-top:4px;">지금 Lv' + c.급수 + ' · ' + c.토픽밴드.join('~') + '급 구간 · 함께 가는 곳 ' + c.과녁 + '급</div>'
    : '<div style="font-size:11px;color:#8D857A;padding-top:4px;">함께 가는 곳 ' + c.과녁 + '급</div>';
  return CARD_WEBFONT + '<div style="' + CARD_FONT + 'background:#FBF7F0;border:2px solid #F0E3C8;border-radius:16px;padding:12px 14px;color:#2B2320;">'
    + '<div style="font-size:12.5px;font-weight:800;padding-bottom:8px;">⛰ 토픽 등반</div>'
    + '<div style="padding-bottom:9px;">' + peaks + '</div>'
    + '<div style="height:9px;background:#EDE7DC;border-radius:99px;overflow:hidden;">'
    + '<div style="height:9px;width:' + Math.max(pct, 2) + '%;background:#F96859;border-radius:99px;"></div></div>'
    + '<div style="font-size:13.5px;padding-top:7px;">' + head + '<span style="color:#8D857A;font-size:12px;"> · ' + pct + '%</span></div>'
    + stepLine + nearLine + bandLine
    + '<div style="font-size:10.5px;color:#8D857A;padding-top:8px;line-height:1.6;border-top:1px dashed #F0E3C8;margin-top:8px;">'
    + '이 줄이 세는 것 — 서로 다른 날 <b>두 번</b>, 내가 직접 쓰거나 말해서 맞은 문형.<br/>'
    + '분모는 우리 문법 목록의 그 급 문형 수다(시험 점수 예측이 아니다).</div>'
    + '</div>';
}

/* 그 레벨이 실제로 **출제할 수 있는** 문형 풀 — 급수 정본 뱅크(91) + 스토리 골격(96)을 합친다.
 *
 * 🔑 **게이트 판정에는 쓰지 않는다** — 그건 `grammarsForLevel_` 이고 뱅크만 본다.
 *   이 함수의 자리는 **문항·미니게임 출제**다 — 두 축을 한 함수로 합치지 않는 것이 요점이다.
 *   ⚠ 08-31 정정: 여기 있던 「각 단계 12개 중 9개가 무너진다」는 낡았다. 그 게이트(`GRAMMAR_GATE_NEED`)는
 *   함께한날 막6 에서 소각됐고(L128), 문턱은 층 비율이 아니라 **맞힌 말 누계 절대수**(설계 §2 사다리)라
 *   뱅크가 자라도 안 깨진다. 두 축을 가르는 진짜 이유는 위 한 줄 — 급수 «정본»과 출제 «풀»은 다른 것이다.
 * 🔑 겹치는 20문형은 **뱅크가 이긴다**(먼저 담는다) — 뱅크가 급수 정본이고, 두 값의 일치는
 *   회귀 ⑨가 이미 보증한다. 여기서 또 판정하면 같은 판정이 세 곳이 된다.
 * ⚠ `STORY_GRAMMAR` 는 다른 파일(엔진_폼리포트.js)의 전역이라 **함수 안에서** 참조한다
 *   (교재연동.js 와 같은 규칙 — 파일 로드 순서에 기대지 않는다). 없으면 뱅크만으로 돈다. */
function 급수문형풀_(lv) {
  const band = LEVEL_TOPIK_BAND[Number(lv)] || [];
  const inBand = (급) => band.indexOf(급) >= 0;
  const out = [], 본 = {};
  const 담기 = (문형, 의미, 급, 출처) => {
    const key = String(문형).replace(/\s+/g, '');
    if (본[key]) return;
    본[key] = 1;
    out.push({ 문형: 문형, 의미: 의미, 급: 급, 출처: 출처 });
  };
  GRAMMAR_BANK.forEach(g => { if (inBand(g[3])) 담기(g[1], g[2], g[3], 'bank:' + g[0]); });
  if (typeof STORY_GRAMMAR !== 'undefined') {
    STORY_GRAMMAR.forEach((월, mi) => 월.forEach(g => { if (inBand(g[2])) 담기(g[0], g[1], g[2], 'story:' + (mi + 1) + '월'); }));
  }
  return out;
}

function setupGrammarBank() { // contents type='grammar' 재건 — replaceContentType이 E/G/H(이미지·번역) 보존 병합
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  replaceContentType(ss, 'grammar', GRAMMAR_BANK.map(g =>
    [g[0], 'grammar', g[1], g[2], '', Number(String(g[0]).slice(1))])); // F = 단계×100+순번 (setupHomework 요일코드 패턴)
  // [v9.38d] 마감폼 '전체도달도' 드롭다운 소스 — Glide Choice가 테이블 소스 전용이라 도달/더연습 2행을 contents에 둔다. — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md)
  //   value_ko('도달'/'더연습')를 그대로 저장(expandMasteryLog_이 문자열 '도달' 접두 매칭). 재건 시 이 2행도 자동 복원.
  replaceContentType(ss, 'reach', [['REACH1', 'reach', '도달', '수업 목표 대부분 도달', '', 1], ['REACH2', 'reach', '더연습', '더 연습 필요', '', 2]]);
  // G열 몽골어는 translateContents(대상 type에 grammar 포함)가 초벌 번역 — 재실행 시 번역 초기화되면 translateContents 재실행
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
    ['BT30','braintip','매일 한 걸음 — 시냅스는 폭발이 아니라 누적으로 자란다 🌱','','',30] // [v9.83] 지급 단가가 바뀌면 틀리는 숫자를 문구에서 제거
  ]);
  Logger.log('브레인팁 30종 OK');
}

function setupSeasons() {
  // 시즌명 12종 (K-컬처 테마 · 창작명) — 「N월의 무대」 배너가 쓴다.
  //   [08-27] 구 「리그 시즌명」 — 반 대항 리그는 폐지됐지만(유호 지시 A) 이 이름들은 «무대» 쪽에서 산다.
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

// [v9.28] 강사 오타 방어 3선 공용 스캐너 — point_logs의 reason이 알려진 키워드에 하나도 안 걸리면 수집.
//   systemWatchdog(주간 요약)과 nightJobs(당일 신규만 admin 알림)가 함께 사용해 발각 지연을 7일→1일로 단축.
function unknownReasonScan_(ss) {
  /* 🔑 이 목록의 «분모»는 이 파일 안 사유 정본 표(아래 `['R01','reason',…]` 9행)다 — 거기 있는 사유는
   *   전부 여기 걸려야 한다. 지금 짝은 R01숙제완료→'숙제' · R02·R06→그대로 · R03칭찬 · R04생일 ·
   *   R05레이드보상·R08월드레이드→'레이드' · R07리그승리→'리그' · R09오늘의다짐. 나머지 낱말은
   *   표 밖 강사 버튼·스토어·정정 문구를 받는다. **정본 표에 사유를 늘리면 여기도 같은 커밋에서 늘린다.** */
  const KNOWN_RS = ['숙제', 'MVP', '시냅스', '오늘의 도전', '오늘의 성장', '칭찬', '정정', '생일', '레이드', '리그', '발표', '일일한도',
    '출석', '이월', '스토어', '구매', '교환', '퀴즈', '챌린지', '연료', '보너스', '참여', '이벤트', '오늘의다짐', '첨삭',
    '재작성']; // [v9.263] '리그' — 사유 정본 R07 '리그승리'(주간 반대항 · 엔진_운영배치 1374행 SYSTEM 지급)가 목록에 없어 워치독이 매주 「미인식 1종」을 울렸다(08-24 원격 실측). 낡은 쪽은 버튼이 아니라 이 목록이었다 // [v9.147] 재작성 보상 — '퀴즈응답'은 기존 '퀴즈' 키워드에 이미 걸린다(중복 등재 불필요) // [v9.49] 첨삭확인(+5P) — '숙제'를 포함하면 숙제왕 카운트(4689행 indexOf('숙제'))가 오염되므로 별도 키워드
  const plW = ss.getSheetByName('point_logs');
  const unknown = {};
  if (plW && plW.getLastRow() >= 2) {
    plW.getRange(2, 1, plW.getLastRow() - 1, 4).getValues().forEach(function (r) {
      const rs = String(r[3] || '').trim();
      if (!r[1] || !rs) return;
      if (!KNOWN_RS.some(function (k) { return rs.indexOf(k) > -1; })) unknown[rs] = (unknown[rs] || 0) + 1;
    });
  }
  return unknown;
}

// [v9.28] 미인식 reason 야간 점검 — 워치독 주간 요약을 기다리지 않고 당일 새 오타를 admin에 알림(목록 동일하면 dedup)
function checkUnknownReasonsNightly_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const unknown = unknownReasonScan_(ss);
  const uKeys = Object.keys(unknown).sort();
  if (!uKeys.length) return;
  const props = PropertiesService.getScriptProperties();
  const sig = uKeys.map(function (k) { return k + ':' + unknown[k]; }).join('|');
  if (props.getProperty('미인식사유_상태') === sig) return; // 어제와 동일 목록이면 재알림 생략
  props.setProperty('미인식사유_상태', sig);
  if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] ⚠️ 미인식 포인트 사유 ' + uKeys.length + '종',
    '아래 사유 문구가 알려진 키워드에 안 걸립니다 — 강사 버튼 오타이면 분류(도전·성장·숙제·업적)가 누락될 수 있어요.\n\n' +
    uKeys.map(function (k) { return '· "' + k + '" (' + unknown[k] + '건)'; }).join('\n'));
}

// [v9.67] 교재연동(교재연동.js) 개통 판별 — setupTextbookLink가 세팅하는 profiles '목소리폼URL' 헤더가 영속 발자국.
//   app_state '목소리폼URL틀'은 목소리 폼(STEP 1~3) 전용 키라 폼 없이 문법판정만 개통한 경우를 놓친다 — 헤더가 정확한 기준.
//   resetAllTriggers·preflightGlide·systemWatchdog·buildSystemManifest 4곳 공용: 미개통 시스템에선 교재연동Nightly를
//   요구하지 않아 오경보 0, 개통 후엔 트리거 실종(전체 삭제 재설치 사고)을 즉시 잡는다(2026-07-26 진단 결함 ①).
function textbookLinkOn_(ssOpt) {
  try {
    const ss = ssOpt || SpreadsheetApp.getActiveSpreadsheet();
    const pf = ss.getSheetByName('profiles');
    if (!pf || pf.getLastColumn() < 1) return false;
    return pf.getRange(1, 1, 1, pf.getLastColumn()).getValues()[0].some(h => String(h) === '목소리폼URL');
  } catch (e) { return false; }
}

// [v9.67] AI 첨삭 파이프라인 계기(워치독·preflight 공용) — 키 휴면·적체가 완전 침묵이던 결함 ②의 계기판.
//   키가 없으면 aiFeedbackBatch_가 포인터 전진 없이 0초 리턴하므로 '숙제폼_응답 포인터 뒤 신규 행 수'가 곧 적체량.
//   oldestAge = 큐 머리(가장 오래된 미처리 제출)의 나이(일) — 경보 기준. 마지막 생성 나이(fbAge)로 판정하면
//   "조용한 주간 + 오늘 새 제출"(정상)이 낮 preflight에서 허위 경보가 된다 · >1 = 밤 배치를 최소 1회 지나쳤는데 미처리.
//   fbAge = hw_feedback 마지막 행 생성 나이(일 · ID 'FByyyyMMdd-'에 생성일이 박힘) — 메일 문맥용 · -1=이력/판독 없음.
//   키 값 자체는 절대 반환·기록하지 않는다(존재 여부 boolean만) — 로그·메일 노출 금지 원칙.
/* [v9.77] profiles 무결성 코어 — Glide 상세 화면 Edit/Add 잔재 사고(2026-07-28 유호 실측: 반 상세에서
 *   강사가 profiles 생 행 추가·class_stats 편집 가능) 후속. 레이아웃 구멍은 편집기에서 막았지만
 *   "다시 열려도 오염을 기계가 잡는" 층이 없었다: 기존 preflight 루프는 `if (!r[0]) return`이라
 *   user_id 공란 유령 행을 영원히 못 보고, user_id 중복은 어디에도 없었으며, 전부 수동 ▶ 전용이었다.
 *   순수 함수(시트 미접촉) — tests/safety.test.js가 직접 실행 검증. rows = profiles 2행~ 원시값. */
function profilesIntegrityCore_(rows) {
  const ROLES = { student: 1, parent: 1, teacher: 1, director: 1 };
  const ghost = [], dupId = [], badRole = [];
  const seen = {};
  (rows || []).forEach(function (r, i) {
    const id = String(r[0] || '').trim(), nm = String(r[1] || '').trim();
    const role = String(r[3] || '').trim(), em = String(r[6] || '').trim();
    if (!id) {
      if (nm || role || em) ghost.push((i + 2) + '행(' + (nm || role || em) + ')'); // 완전 빈 행은 무해 — 내용 있는 무ID 행만
      return;
    }
    if (seen[id]) dupId.push(id); else seen[id] = 1;
    if (!ROLES[role]) badRole.push((nm || id) + '(' + (role || '빈값') + ')');
  });
  return { ghost: ghost, dupId: dupId, badRole: badRole,
    clean: !ghost.length && !dupId.length && !badRole.length };
}

// [v9.77] 시트 래퍼 + 야간 자동 통보(nightJobs 편입). 이상 시그니처를 scriptProperty에 저장해
//   같은 이상은 하루 1통으로 끝(매일 반복 소음 0) · 내용이 변하면 즉시 재통보 · 해소되면 키 삭제.
function profilesIntegrityScan_(ss) {
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return profilesIntegrityCore_([]);
  return profilesIntegrityCore_(pf.getRange(2, 1, pf.getLastRow() - 1, 10).getValues());
}
function profilesIntegrityNightly_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const chk = profilesIntegrityScan_(ss);
  const props = PropertiesService.getScriptProperties();
  const KEY = '프로필무결성통보';
  if (chk.clean) { if (props.getProperty(KEY)) props.deleteProperty(KEY); return; }
  const lines = [];
  if (chk.ghost.length) lines.push('· 유령 행(user_id 공란인데 내용 있음 — 앱 Add 폼/수기 추가 흔적): ' + chk.ghost.join(', ') + ' → profiles에서 해당 행 삭제(또는 user_id 채움)');
  if (chk.dupId.length) lines.push('· user_id 중복(로그인·집계가 첫 행만 물어 나머지는 유실): ' + chk.dupId.join(', ') + ' → 중복 행 정리');
  if (chk.badRole.length) lines.push('· 무효 role(그 사람 탭 Visibility 전멸): ' + chk.badRole.join(', ') + ' → student/parent/teacher/director로 교정');
  const sig = lines.join('|').slice(0, 8000); // 9KB 보호
  if (props.getProperty(KEY) === sig) return; // 동일 이상은 재통보 안 함
  adminMail('[SYNK] 🧬 profiles 무결성 이상 ' + (chk.ghost.length + chk.dupId.length + chk.badRole.length) + '건',
    lines.join('\n') + '\n\n학생 등록 정본은 상담시트→syncProfiles입니다. 앱/시트에서 직접 만든 행이 의심돼요. (같은 내용이면 다시 알리지 않습니다 — 내용이 바뀌거나 해소되면 자동 갱신)');
  props.setProperty(KEY, sig);
}

/* [v9.197] 자기선언 이력 — 학생이 «스스로» 쓰는 3칸은 셀이라 바뀌면 이전 값이 영구 소멸한다.
 *   드림한줄(CB80)·최애(DA105)·몬스터이름(AO41). 셋 다 앱이 Set Column 으로 직기입하는 자리라
 *   onEdit 이 안 뜬다(시트 API 쓰기는 트리거를 발화시키지 않는다) — 그래서 밤에 「직전 기록과 다른가」로 잰다.
 *   엔진도달 전수감사 ㉠ = *「셀 덮어쓰기라 이력이 0 — 도달 이전에 보존조차 안 된다. 수집의 최악 형태」*.
 *   처방(append 교체)이 문서에만 있고 미실행이던 자리다.
 *   🔴 이 수리가 여는 것은 «보존»뿐이고 **엔진 도달은 그대로 0**이다 — 소비자는 성향 축이 서는 판에서 정한다
 *     (계약 `preference.stated` · SYNK-talk `lib/이벤트검증.js` 생산자 장부에서 지금 생산자 0).
 *   ponytail: 하루 1회 표본이라 같은 날 두 번 바꾸면 마지막 값만 남는다. 분 단위가 필요해지면
 *     셀 감시로는 못 잰다 — 앱이 사건을 내는 쪽(`preference.stated`)으로 올린다. */
const SELF_DECLARE_TAB_ = 'self_declare_log';
const SELF_DECLARE_HEADERS = ['student_id', '필드', '값', '기록일'];
const SELF_DECLARE_COLS_ = [['드림한줄', 80], ['최애', 105], ['애칭', 41], ['고른가이드', 55]]; // [함께한날 막1·4] 가이드를 바꾼 날이 한 줄 남는다(교체 무제한 §7-⑥) · 41열 라벨은 AO1 헤더 개명(몬스터이름→애칭)과 같은 커밋

/* 순수 판정 — 「무엇을 새로 적을 것인가」(profilesIntegrityCore_ 와 같은 무늬: 코어=순수·래퍼=시트).
 *   rows = [{sid, 필드, 값}] · last = {'sid|필드': 마지막 기록값} — last 는 제자리에서 갱신된다.
 *   ⚠ 첫 관측이 빈칸이면 안 적는다(안 그러면 전 학생 × 3줄이 의미 없이 깔린다).
 *      값이 있던 칸을 «비운 것»은 되돌림이 아니라 선언이라 빈 값 한 줄로 남긴다. */
function selfDeclareDiff_(rows, last, today) {
  const out = [];
  rows.forEach(r => {
    const sid = String(r.sid == null ? '' : r.sid).trim();
    if (!sid) return;
    const cur = String(r.값 == null ? '' : r.값).trim();
    const key = sid + '|' + r.필드;
    const prev = last[key];
    if (prev === undefined ? cur === '' : prev === cur) return;
    last[key] = cur;
    out.push([sid, r.필드, cur, today]);
  });
  return out;
}

function selfDeclareLogNightly_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return 0;
  const n = pf.getLastRow() - 1;
  const maxCol = pf.getMaxColumns();
  /* A~D 만 읽는다 — id 와 **role**(D열). profiles 에는 학부모·강사·원장 행과 `DEMO-` 시연 행이 함께 산다
   * (syncProfiles 가 일부러 보존한다). 그 값까지 학습자 선언으로 적으면 나중에 원료가 조용히 오염된다. */
  const meta = pf.getRange(2, 1, n, 4).getValues();
  const log = ensureSheet(ss, SELF_DECLARE_TAB_, SELF_DECLARE_HEADERS);
  /* ⚠ 줄어듦 감시는 **잠금 밖**에서 돈다 — 그 안의 `adminMail` 이 DIGEST_MODE 에서 같은 스크립트
   *   잠금을 다시 잡는데 GAS 스크립트 잠금은 **비재진입**이라, 안에서 부르면 30초 대기 후 실패하고
   *   경고도 HWM 갱신도 매일 밤 같은 자리에서 죽는다(①배포 검수 P1). 이 감시는 읽기뿐이라 잠금이 필요 없다. */
  selfDeclareShrinkGuard_(log); // 탭이 지워졌다 되살아난 것을 여기서 잡는다(워치독은 주간이라 매일 밤 되살아나면 영영 못 본다)
  /* 읽기→차이→쓰기 전 구간을 잠근다 — 야간 배치와 손 실행이 겹치면 둘이 같은 `getLastRow()+1` 을 잡아
   * 뒤엣것이 앞엣것을 덮는다. 덮이는 대상이 「다시 물어볼 수 없는 선언」이라 여기만은 append 를 직렬화한다. */
  const lock = LockService.getScriptLock();
  /* 못 잡으면 **조용히 0 을 돌려주지 않는다** — 잠금 보유자가 이 함수라는 보장이 없어(같은 밤의 다른
   * 작업일 수 있다) 그 밤의 관측이 아무 기록 없이 사라진다. 던져서 safeRun 의 실패 통로(로그+관리자
   * 메일·하루 1통 dedup)로 드러낸다: 「안 돌았다」와 「바뀐 게 없었다」가 같은 모양이면 안 된다. */
  if (!lock.tryLock(30000)) throw new Error('자기선언 이력 — 스크립트 잠금 획득 실패(이 밤의 관측을 건너뛴다)');
  try {
    const last = {};
    if (log.getLastRow() >= 2) log.getRange(2, 1, log.getLastRow() - 1, 3).getValues()
      .forEach(r => { if (r[0]) last[String(r[0]).trim() + '|' + r[1]] = String(r[2] == null ? '' : r[2]).trim(); });
    const rows = [];
    SELF_DECLARE_COLS_.forEach(fc => {
      if (maxCol < fc[1]) return; // 아직 그 열이 없는 구판 시트 — 조용히 건너뛴다(열은 calcAll 이 보장한다)
      pf.getRange(2, fc[1], n, 1).getValues().forEach((v, i) => {
        const sid = String(meta[i][0] || '').trim();
        if (String(meta[i][3] || '').trim() !== 'student' || sid.indexOf('DEMO-') === 0) return;
        rows.push({ sid: sid, 필드: fc[0], 값: v[0] });
      });
    });
    const add = selfDeclareDiff_(rows, last, Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd'));
    // 학생이 직접 친 글이라 소독 통로(writeIfChanged→행소독_)로 append 한다 — `=` 시작 문자열이 라이브 수식이 되는 것을 채널에서 차단.
    if (add.length) writeIfChanged(log, log.getLastRow() + 1, 1, add);
    /* 기준선은 **쓴 뒤 시트를 다시 세어** 올린다 — 감시가 재는 단위와 같아야 하고(행 인덱스로 올리면
     * 다음 밤이 늘 헐겁다), 잠금 밖에서 읽어 둔 수에 더하면 그 사이 남이 적은 줄만큼 **모자라게** 박혀
     * 그만큼의 삭제가 다음 밤에 안 보인다(①배포 검수 3차 P2). 세는 곳이 둘이면 갈라지므로 함수 하나로 판다. */
    /* [v9.241] **쓰는 쪽도 새 키를 쓴다** — 읽는 쪽만 갈아탔더니 이 줄이 밤마다 옛 키를 되살려
     *   「승계는 한 번뿐」이 무효가 됐다(①배포 검수 2회차 P2 · 7f91b9dad177). 기준선이 두 키로
     *   갈라지면 append 뒤의 삭제를 놓치고, 새 키를 지우면 옛 키가 또 승계돼 같은 경보가 반복된다. */
    if (add.length) PropertiesService.getScriptProperties().setProperty(탭수축키_(SELF_DECLARE_TAB_), String(selfDeclareCount_(log)));
    return add.length;
  } finally { lock.releaseLock(); }
}

/* 줄어들면 외친다 — append-only 장부의 유일한 자기검사. 워치독의 「누락 시트」로는 이 사고를 못 본다:
 *   야간 배치가 매일 ensureSheet 로 빈 시트를 되살리므로, 주간 워치독이 볼 때는 «탭이 있다».
 *   그래서 「탭이 있나」가 아니라 «몇 줄이 남았나»를 잰다(지워짐·이름 바뀜·잘림이 전부 같은 증상이다).
 * ⚠ 세는 것은 `getLastRow()` 가 **아니라 실제 기록 수**다 — 마지막 행은 «중간»을 지워도 그대로라
 *   행 인덱스로 재면 가운데를 파낸 삭제가 통째로 안 보인다(①배포 검수 P2). 잠금 밖에서 도는 읽기다. */
const SELF_DECLARE_HWM_ = '자기선언이력_최고건수';
/* [v9.241] 위 통로를 **수집 장부 전체**로 넓혔다 — 자기선언 하나에만 달려 있던 자를 공용으로 판다.
 *   왜: 같은 노출을 가진 탭이 아홉인데(골격 `수집표식_`) 감시는 하나였다. 호출부마다 같은 코드를
 *   베끼면 세는 법이 갈라지고, 갈라진 쪽은 언제나 「통과」로 샌다.
 *   ⚠ 정책(경보를 어디로 보내나·기준선을 도로 내리나)은 **부르는 쪽**이 정한다 — 밤마다 도는
 *   자기선언은 한 번 알리고 새 기준으로 가고(매일 같은 메일 금지), 주간 워치독은 안 내린다
 *   (고칠 때까지 리포트에 남아야 한다). 세는 법만 공용이다. */
const 탭수축키_ = (탭) => '탭최고건수_' + 탭;
/** [v9.241] «한 번이라도 있었던» 골격 탭 명부(줄바꿈 구분) — 워치독이 「지워짐」과 「안 태어남」을 가른다. */
const SEEN_TABS_ = '본적있는탭';
/* [v9.241] 명부의 **첫 줄** = v9.240 까지 워치독이 손 목록으로 요구하던 35종.
 *
 * 🔴 왜 필요한가(①배포 검수 P1 · 866317b868f8·fceb49ea3d20): 명부가 빈 채로 첫 실행을 맞으면
 *   **그때 이미 없는 탭**이 전부 「아직 안 태어남」(정보)으로 접힌다 — 옛 판이 「누락 시트」로
 *   외치던 경보가 교체 순간 조용히 사라진다. 즉 이 판의 첫 실행이 **경보를 지우는 마이그레이션**이
 *   될 뻔했다. 옛 판이 필수로 요구했다는 것은 「있어야 한다고 이미 판정했다」는 뜻이므로
 *   본 적 있음으로 깔고 시작하는 것이 옳다 — 없으면 그대로 «지워짐» 경보가 이어진다.
 * 🔑 이 목록은 **역사다 — 늘리지 마라.** 새 탭은 골격에 적고, 명부는 실행이 채운다.
 *   `tests/수집탭워치독.test.js` 가 같은 35종을 픽스처로 들고 대조한다(갈리면 빨개진다).
 * ⚠ **톱레벨 const 가 아니라 함수인 이유**(v9.135 와 같은 계급 · 이번에 실제로 밟았다):
 *   `OUTCOME_TAB_`·`TRAJECTORY_TAB_` 는 `엔진_궤적.js`(로드 **마지막**)에 산다. 톱레벨 상수로 두면
 *   초기화 시점에 `ReferenceError: Cannot access 'OUTCOME_TAB_' before initialization` 로
 *   **전 트리거가 즉사한다**(07-24 상담AI.gs:27 실사고와 같은 자리). 호출 시점엔 전 파일이 로드돼 있다. */
function 옛필수탭_() {
  return ['profiles', 'point_logs', 'attendance', 'teacher_checkins', 'notices',
    'form_responses', 'contents', 'class_stats', 'app_state', 'raid', 'schedule',
    'monthly_snapshot', 'titles', 'achievements', 'story', 'manual_titles', 'teacher_stats',
    'report_cards', 'league_history', 'class_fuel', 'weekly_topics', 'hw_batch', 'today_board',
    'league_pairs', 'world_raid', 'synk_stories', 'synk_cards', 'academic_log',
    'exit_log', 'absence_notice', 'inquiries', 'payments',
    OUTCOME_TAB_, TRAJECTORY_TAB_, SELF_DECLARE_TAB_];
}
/** [v9.241] 「없다」를 두 뜻으로 가른다 — 순수 함수라 픽스처로 탐지력을 못박을 수 있다(회귀 `수집탭워치독`).
 * @param {string[]} 골격탭 골격 정본의 탭 이름들
 * @param {!Object} 산탭 지금 스프레드시트에 있는 이름 집합(`{이름:true}`)
 * @param {!Object} 본적 한 번이라도 있었던 이름 집합(`{이름:true}`)
 * @returns {{지워짐: string[], 미출생: string[]}} */
/** [v9.241] 명부 원문 → «본 적 있는» 집합. **첫 실행(`null`)은 옛 필수 35종으로 깔린다.**
 * 순수 함수로 뽑은 이유: 이 한 줄이 「교체가 기존 경보를 지우는가」를 통째로 가르는데, 워치독 안에
 * 인라인으로 두면 회귀가 못 잡는다(①배포 검수 P1 변이가 실제로 그 구멍으로 통과했다).
 * ⚠ 빈 문자열(`''`)은 `null` 과 다르다 — 「명부를 의도적으로 비웠다」이므로 씨앗을 다시 깔지 않는다.
 * @param {?string} 원문 스크립트 속성 값(없으면 null)
 * @returns {!Object} `{탭이름: true}` */
function 본적명부_(원문) {
  const 본적 = {};
  (원문 == null ? 옛필수탭_() : String(원문).split('\n')).forEach(n => { if (n) 본적[n] = true; });
  return 본적;
}
function 탭없음가르기_(골격탭, 산탭, 본적) {
  const 없음 = 골격탭.filter(n => !산탭[n]);
  return { 지워짐: 없음.filter(n => !!본적[n]), 미출생: 없음.filter(n => !본적[n]) };
}
/** 남은 기록 수 — 감시와 기준선 갱신이 **같은 자를 쓴다**. `getLastRow()` 가 아닌 이유는 위 주석. */
function 탭기록수_(sh) {
  const 끝 = sh.getLastRow();
  return 끝 < 2 ? 0 : sh.getRange(2, 1, 끝 - 1, 1).getValues().filter(r => String(r[0] || '').trim()).length;
}
/** 기준선 대비 지금. 늘었으면 기준선을 올리고, 줄었으면 **그대로 두고 알린다**(내리는 것은 부르는 쪽 몫). */
function 탭수축_(sh) {
  const 탭 = sh.getName();
  const props = PropertiesService.getScriptProperties();
  /* [v9.241] 구 키 승계 — 자기선언은 v9.197부터 제 이름의 키에 기준선을 쌓아 왔다. 새 키로 갈아타며
   *   그 값을 안 옮기면 감시가 0에서 다시 시작해 **그 사이의 삭제를 못 본다**(가드 자신의 조용한 실패). */
  const 키 = 탭수축키_(탭);
  let raw = props.getProperty(키);
  if (raw == null && 탭 === SELF_DECLARE_TAB_) {
    raw = props.getProperty(SELF_DECLARE_HWM_);
    /* 승계는 **한 번뿐이다** — 옛 키를 남겨 두면 처방이 자기 발등을 찍는다: 경보문이 시키는 대로
     * 새 키를 지워도 다음 실행이 옛 키에서 같은 기준선을 다시 물어 와 **같은 경보가 영원히 반복**된다
     * (①배포 검수 P2 · fc1dbb715f44). 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103). */
    if (raw != null) { props.setProperty(키, raw); props.deleteProperty(SELF_DECLARE_HWM_); }
  }
  /* 오염된 속성(사람 손·부분 쓰기)은 `Number` 가 NaN 을 낸다 — 그러면 비교가 전부 false 라
   * 감시가 «조용히» 꺼진다. 0으로 접어 첫 실행처럼 기준을 새로 깐다(①배포 검수 P3 · f84cc19e7eba). */
  const hwm = Number(raw || 0) || 0;
  const 지금 = 탭기록수_(sh);
  if (지금 > hwm) props.setProperty(키, String(지금));
  return { 탭: 탭, hwm: hwm, 지금: 지금, 줄었나: !!hwm && 지금 < hwm };
}
/** 의도한 축소(데모 퇴장 등) — 기준선을 지운다. 다음 실행이 지금 값을 새 기준으로 잡는다. */
function 탭수축기준선지움_(탭) {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(탭수축키_(탭));
  if (탭 === SELF_DECLARE_TAB_) props.deleteProperty(SELF_DECLARE_HWM_);
}
/** 남은 기록 수(자기선언) — 옛 이름은 호출부 3곳이 쓰므로 공용 통로로 넘기는 얇은 껍질로 남긴다. */
function selfDeclareCount_(log) { return 탭기록수_(log); }
function selfDeclareShrinkGuard_(log) {
  const props = PropertiesService.getScriptProperties();
  const r = 탭수축_(log);
  const hwm = r.hwm, now = r.지금;
  if (!r.줄었나) return now;
  adminMail('[SYNK] 🌱 자기선언 이력이 줄었다 — ' + hwm + '건 → ' + now + '건',
    '학생이 스스로 쓴 선언(드림한줄·최애·몬스터이름)의 이력 탭 `' + SELF_DECLARE_TAB_ + '` 이 줄었습니다.\n'
    + '이 데이터는 소급이 안 됩니다 — 탭을 지우셨거나 이름을 바꾸셨다면 되돌려 주세요.\n'
    + '의도한 정리였다면 스크립트 속성 `' + 탭수축키_(SELF_DECLARE_TAB_) + '` 를 지우면 이 알림이 새 기준으로 재설정됩니다.');
  props.setProperty(탭수축키_(SELF_DECLARE_TAB_), String(now)); // 매일 같은 메일을 보내지 않는다 — 한 번 알리고 새 기준으로 간다
  return now;
}

function aiFeedbackHealth_(ss) {
  const props = PropertiesService.getScriptProperties();
  const hasKey = !!props.getProperty('CLAUDE_API_KEY');
  const tz = ss.getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  let backlog = 0, oldestAge = -1;
  const src = ss.getSheetByName('숙제폼_응답');
  if (src && src.getLastRow() >= 2) {
    const last = src.getLastRow();
    const from = Math.min(Number(props.getProperty('숙제폼_포인터')) || 1, last);
    backlog = last - from;
    if (backlog > 0) {
      const ts = src.getRange(from + 1, 1).getValue(); // 큐 머리의 폼 타임스탬프 1셀만
      if (ts instanceof Date) oldestAge = Math.max(0, Math.round((new Date(today) - new Date(Utilities.formatDate(ts, tz, 'yyyy-MM-dd'))) / 86400000));
    }
  }
  let fbAge = -1;
  const fb = ss.getSheetByName('hw_feedback');
  if (fb && fb.getLastRow() >= 2) {
    const m = String(fb.getRange(fb.getLastRow(), 1).getValue() || '').match(/^FB(\d{4})(\d{2})(\d{2})-/);
    if (m) fbAge = Math.max(0, Math.round((new Date(today) - new Date(m[1] + '-' + m[2] + '-' + m[3])) / 86400000));
  }
  return { hasKey: hasKey, backlog: backlog, oldestAge: oldestAge, fbAge: fbAge };
}

function systemWatchdog(asText) {
  const wantText = asText === true; // [v9.25] 텍스트 반환 모드(주간 통합) — 트리거 이벤트객체는 false로 강제
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const out = [];
  /* 상태는 «셋»이다 — 정상 · 경보 · 정보. 셋째가 없으면 「의도된 미개통」이 ✅ 통에 들어가
   *   기계적으로 정상과 안 갈리고, 제목이 「전부 정상」으로 나간다(codex 지적 9e616375d292 · 08-24).
   *   ⓘ 를 «메시지 글자»로 붙이는 것으로는 못 푼다 — 눈은 속아 넘어가도 세는 자는 여전히 ✅ 로 센다. */
  function add(ok, msg) { out.push((ok === 'ⓘ' ? 'ⓘ ' : ok ? '✅ ' : '⚠️ ') + msg); }

  // 1) 필수 트리거 생존
  const have = {};
  ScriptApp.getProjectTriggers().forEach(t => { have[t.getHandlerFunction()] = true; });
  // [v9.25] A5에서 일부 핸들러가 safeRun 보호 래퍼(dailyBackupJob·sendMorningDigestJob·
  //   monthlyReportCardsJob·monthlyReportJob)로 재등록됐다. 점검 목록은 원 함수명 그대로 두되,
  //   bare/‘…Job’ 두 이름 중 하나라도 살아 있으면 정상으로 취급해 개명에도 오탐(실종! 허위경보)이
  //   안 나게 한다 — 앞으로 다른 핸들러가 Job 래퍼로 바뀌어도 이 매칭이 자동으로 흡수한다.
  // [v9.202] 흡수를 양방향으로 넓혔다 — 매니페스트가 **등록명**(…Job)을 주므로 접미를 떼고도 본다.
  const bare = f => String(f).replace(/Job$/, '');
  const alive = f => !!(have[bare(f)] || have[bare(f) + 'Job']);
  // [v9.202] 목록은 triggerManifest_(정본)에서 파생한다. 손으로 적어 두던 시절엔 v9.164가 더한
  //   onConsultEdit 이 이 감시망 **밖**이었다 — 실종해도 주간 메일이 「전부 등록됨」이라고 답했다.
  const 필수 = ['calcAllJob', 'parentSweep', 'sendMorningDigestJob']; // 이름은 매니페스트 표기로 — 아래 filter가 대조한다
  필수.forEach(f => {
    add(alive(f), '필수 트리거 ' + bare(f) + (alive(f) ? ' 정상' : ' 실종! — resetAllTriggers()/트리거 화면 확인'));
  });
  // [v9.67] 교재연동Nightly는 개통 후에만 요구(미개통 오경보 0) — 그 조건도 매니페스트가 들고 있다
  const recommended = triggerManifest_(textbookLinkOn_(ss)).filter(f => 필수.indexOf(f) < 0);
  const missing = recommended.filter(f => !alive(f));
  add(missing.length === 0, '권장 트리거: ' + (missing.length ? missing.join(', ') + ' 미등록 (의도적이면 무시)' : '전부 등록됨'));
  // [심문 G9 · 08-24] 미개통은 «침묵»이 아니라 **정보**로 낸다 — 종전엔 감시가 요구 자체를 접어
  //   「전부 등록됨」이 됐고, 그 초록 아래에서 mastery 판정관 4종(첨삭·음성·대화·적용)이 실행 0회였다.
  //   미개통 자체는 의도된 상태(유령 트리거 금지)라 적색이 아니다 — 상태를 이름으로 부르기만 한다
  //   (T12 동의격리 «정보 채널»과 같은 가름: 적색도 침묵도 아닌 세 번째 칸).
  if (!textbookLinkOn_(ss)) add('ⓘ', '교재연동 미개통 — mastery 판정관 4종·야간 트리거 실행 0회(의도된 상태 · 개통 = setupTextbookLink ▶ 1회)');

  // [v9.19] 1-b) 백업 실제 생성 여부 — 트리거는 살아있어도 makeCopy가 조용히 실패할 수 있어 최신 백업 나이 점검
  try {
    const bIt = DriveApp.getFoldersByName('SYNK_백업');
    if (!bIt.hasNext()) add(false, '백업 폴더(SYNK_백업) 없음 — dailyBackup 1회 실행 확인');
    else {
      // [v9.32] 접두사별 최신 나이 점검 — 폴더 전체 최신만 보면 상담 백업이 앱 백업 실패를 가린다(반대도).
      const files = bIt.next().getFiles();
      const newest = { app: 0, consult: 0 };
      while (files.hasNext()) {
        const f = files.next(); const nm = f.getName(); const t = f.getDateCreated().getTime();
        if (nm.indexOf('SYNK_앱데이터_백업_') === 0) { if (t > newest.app) newest.app = t; }
        else if (nm.indexOf('SYNK_상담백업_') === 0) { if (t > newest.consult) newest.consult = t; }
      }
      [['앱데이터', newest.app], ['상담시트', newest.consult]].forEach(function (p) {
        const ageDays = p[1] ? Math.floor((Date.now() - p[1]) / 86400000) : 999;
        add(ageDays <= 2, '최신 ' + p[0] + ' 백업: ' + (p[1] ? ageDays + '일 전' : '없음') + (ageDays > 2 ? ' ⚠️ 백업 멈춤 의심 — dailyBackup/Drive 용량/CONSULT_SHEET_ID 확인' : ''));
      });
    }
  } catch (e) { add(false, '백업 점검 실패: ' + e); }

  // [v9.82·리뷰 H4] 결석 사전신고 무결성 — preflight에만 두면 사람이 돌릴 때만 걸린다 → 주간 자동 감시 편입.
  //   다자녀 parent_of 통짜 기록('A,B')이 미출석 제외·강사 브리핑·접수 카드 3곳을 조용히 불발시키는 회귀 감시.
  try {
    const anW = ss.getSheetByName('absence_notice');
    if (anW && anW.getLastRow() >= 2) {
      const pfW = ss.getSheetByName('profiles');
      const idsW = {};
      if (pfW && pfW.getLastRow() >= 2) pfW.getRange(2, 1, pfW.getLastRow() - 1, 1).getValues().forEach(r => { if (r[0]) idsW[String(r[0]).trim()] = 1; });
      let badW = 0;
      anW.getRange(2, 1, anW.getLastRow() - 1, 1).getValues().forEach(r => {
        const v = String(r[0] || '').trim();
        if (v && (v.indexOf(',') > -1 || !idsW[v])) badW++;
      });
      add(badW === 0, '결석 사전신고 student_id ' + (badW ? '불일치 ' + badW + '건 — 폼 "자녀"를 Choice(value=user_id)로 재조립(억제·브리핑·카드 불발 중)' : '전건 유효'));
    }
  } catch (e) { add(false, '결석 신고 점검 실패: ' + e); }

  // 2) 데일리 로테이션 생존 (멈춤 = 트리거/시간대 문제 신호)
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const hw = props.getProperty('숙제기준일') || '(없음)';
  const daysOld = hw === '(없음)' ? 99 :
    Math.round((new Date(today) - new Date(hw)) / 86400000);
  add(daysOld <= 2, '오늘의 숙제 게시: 마지막 ' + hw +
    (daysOld > 2 ? ' — 21~23시 calcAll 트리거가 없거나 시간대가 어긋났을 가능성!' : ' (정상)'));

  // [v9.28] 2-c) 야간배치(nightJobs) 완주 마커 — 6분 타임아웃으로 뒷부분이 증발해도 앞부분(calcAll 등)은
  //   끝난 것처럼 보일 수 있어, nightJobs 맨 마지막 줄에서만 찍는 완주 마커로 "끝까지 돌았는지"를 별도 확인.
  const nbDone = props.getProperty('야간배치완료일') || '(없음)';
  const nbDaysOld = nbDone === '(없음)' ? 99 : Math.round((new Date(today) - new Date(nbDone.slice(0, 10))) / 86400000);
  add(nbDaysOld <= 1, '야간배치(nightJobs) 완주: 마지막 ' + nbDone +
    (nbDaysOld > 1 ? ' — 6분 타임아웃으로 중도 증발했을 가능성! 트리거 실행 기록을 확인하세요.' : ' (정상)'));

  // [v9.32] 2-d) 월간배치(monthlyJobs) 완주 마커 점검 — 매월 1일 05시 8개 직렬 체인의 중도 증발 감지.
  //   워치독이 주 1회(월요일)라 감지가 최대 ~9일 지연되지만 마커가 없으면 영영 못 잡는다. 3일부터 당월 점검.
  const domW = Number(Utilities.formatDate(new Date(), tz, 'd'));
  const curYmW = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
  const mbDone = props.getProperty('월간배치완료월') || '(없음)';
  if (domW >= 3) {
    add(mbDone === curYmW, '월간배치(monthlyJobs) 완주: ' + mbDone +
      (mbDone === curYmW ? ' (정상)' : ' — 이달(' + curYmW + ') 미완주! 스토리북·카드·경영리포트 증발 의심, 트리거 실행 기록 확인'));
  } else {
    add(true, '월간배치(monthlyJobs) 완주: ' + mbDone + ' (매월 3일부터 당월 점검)');
  }

  // [v9.25→v9.28] 2-b) 미인식 reason 스캔 — 강사 오타 방어 3선. unknownReasonScan_로 공용화(nightJobs 일일 점검과 공유).
  //   포인트 합산은 reason과 무관하게 정상이지만, 분류(숙제카운트·도전·성장·업적·일일한도)는 키워드로 잡는다.
  try {
    const unknown = unknownReasonScan_(ss);
    const uKeys = Object.keys(unknown);
    add(uKeys.length === 0, '포인트 사유(reason) 인식: ' + (uKeys.length === 0 ? '전부 정상'
      : uKeys.length + '종 미인식 — 분류(도전·성장·숙제·업적) 누락 위험. 버튼 문구 확인: '
        + uKeys.slice(0, 5).map(function (k) { return '"' + k + '"(' + unknown[k] + '건)'; }).join(' · ')
        + (uKeys.length > 5 ? ' 외 ' + (uKeys.length - 5) + '종' : '')));
  } catch (e) { add(false, 'reason 스캔 실패: ' + e); }

  const stW = ss.getSheetByName('app_state');
  const keys = {};
  if (stW && stW.getLastRow() >= 2) {
    stW.getRange(2, 1, stW.getLastRow() - 1, 2).getValues().forEach(r => { keys[r[0]] = r[1]; });
  }
  add(!!keys['오늘의퀴즈'], 'app_state 오늘의퀴즈: ' + (keys['오늘의퀴즈'] ? '있음' : '없음 — setupQuiz 실행 여부 확인'));
  add(!!keys['오늘의팁'], 'app_state 오늘의팁: ' + (keys['오늘의팁'] ? '있음' : '없음 — setupBrainTips 실행 여부 확인')); // [v8.6]

  // 3) 셋업 실행 상태 (contents 수량 대조 — 부분 실행 감지)
  const expect = CONTENT_EXPECT; // [v9.37] 모듈 정본(수동 숫자 승격) — grammar:91 포함, buildSystemManifest와 단일 소스. 세부 이력은 CONTENT_EXPECT 선언부 참조
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
    : Object.keys(expect).length + '종 전부 정상')); // [v9.34] '10종' 화석 문구 → 키 수 동적화
  const sortedOk = monThr.length < 2 || monThr.every((v, i) => i === 0 || v >= monThr[i - 1]);
  add(sortedOk, '캐릭터 임계값 오름차순: ' + (sortedOk ? '정상' : '순서 꼬임! 진화 오작동 위험'));
  add(bossImg === 12, '보스 이미지 URL: ' + bossImg + '/12' + (bossImg < 12 ? ' — contents boss E열 입력(시즌 보스 12종)' : '')); // [v7.8]
  add(loreTier === 0, '칭호 로어 등급(E열): ' + loreTier + '/0 — [08-27] 등급 폐지. 0이 아니면 옛 등급이 되살아난 것이다');

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

  // [v9.25] 5) 시트 구조·용량·쿼터 — 구 healthCheck 흡수 (월요일 정기 메일 통합)
  /* [v9.241] 목록을 **골격 정본에서 도출한다.** 실측(교체 직전): 손 목록 35종 · 골격 53종 ·
   *   손이 **한 번도 못 보던 22종**. 그 22종에 수집 장부 6종(voice_log·talk_index_log·mastery_log·
   *   quiz_log·hw_feedback·teacher_gold)이 전부 들어 있었다. 이 함수는 같은 병을 이미 두 번 앓았고(v9.144 월키 열 ·
   *   v9.202 트리거 목록) 처방은 매번 같았다: **선언하는 자리에서 도출한다.** 세 번째라 목록을
   *   손으로 다시 적을 수 없게 만든다 — 골격에 시트를 더하면 그 순간 감시에 든다.
   *   (반대 방향도 실측했다: 손 목록에만 있던 contents·class_stats·schedule·trajectory 는 골격에
   *    편입해 데려왔다 — 도출로 갈아타며 감시가 **좁아지는** 것이 이 교체의 유일한 사고 모양이다.)
   *
   * 🔑 「없다」를 두 뜻으로 가른다 — 안 가르면 미개원 상태에서 여러 탭이 매주 «누락»으로 떠서
   *   사람이 이 점검을 통째로 무시한다(v9.202 가 트리거 숫자에서 겪은 그 자리다).
   *     · 한 번이라도 있었는데 지금 없다 = **지워졌다**(경보 — 되살릴 사람은 원장뿐)
   *     · 한 번도 없었다              = **아직 안 태어났다**(정보 — 골격 보장이 만든다)
   *   가르는 자 = 스크립트 속성에 누적하는 «본 적 있는 탭» 명부(줄이지 않는다).
   * ⚠ 틀릴 때의 모습 둘: ①이 판이 서기 **전에** 지워진 탭은 영영 「안 태어남」으로 읽힌다(명부의
   *   첫 줄이 «지금 있는 것»이라 그렇다) ②의도적으로 없앤 탭은 명부에서 이름을 지울 때까지 매주
   *   경보로 남는다 — 그 처방을 메시지에 함께 적는다(따를 수 없는 경보는 세우지 않는다). */
  const 골격탭 = sheetSkeleton_().map(k => k[0]);
  const 산탭 = {}; ss.getSheets().forEach(s => { 산탭[s.getName()] = true; });
  const propsW = PropertiesService.getScriptProperties();
  /* 첫 실행은 **빈 명부가 아니라 옛 필수 35종**으로 시작한다 — 안 그러면 이 판의 첫 실행이
   * 기존 「누락 시트」 경보를 정보 줄로 바꿔 지운다(①배포 검수 P1). 근거·주의 = `옛필수탭_` 선언부. */
  const 본적 = 본적명부_(propsW.getProperty(SEEN_TABS_));
  const 갈림 = 탭없음가르기_(골격탭, 산탭, 본적);
  const 지워짐 = 갈림.지워짐, 미출생 = 갈림.미출생;
  add(지워짐.length === 0, 지워짐.length
    ? '지워진 시트: ' + 지워짐.join(', ') + ' — 되살리세요(bootstrapSynk). 의도한 삭제였다면 스크립트 속성 `' + SEEN_TABS_ + '` 에서 그 이름 줄을 지우면 이 경보가 멎습니다'
    : '시트 구조 정상 (골격 ' + 골격탭.length + '종 · 지워진 것 없음)');
  if (미출생.length) add(true, '아직 안 태어난 시트 ' + 미출생.length + '종(경보 아님 — 필요해지면 bootstrapSynk ▶ 1회): ' + 미출생.join(', '));
  /* 명부는 **첫 실행에 반드시 한 번 저장한다** — 씨앗 35종이 마침 전부 살아 있으면 새 이름이 0이라
   * 옛 판은 아무것도 안 썼고, 그러면 「명부에서 그 이름 줄을 지우세요」 처방이 지울 대상조차 없다
   * (그리고 다음 실행이 또 씨앗을 깔아 되돌린다 · ①배포 검수 2회차 P2 · 54ff60d02fa9 · F103). */
  const 새이름 = 골격탭.filter(n => 산탭[n] && !본적[n]);
  if (새이름.length || propsW.getProperty(SEEN_TABS_) == null) {
    propsW.setProperty(SEEN_TABS_, Object.keys(본적).concat(새이름).join('\n'));
  }

  /* [v9.241] «탭이 있나»로는 원리상 못 보는 사고 — 탭을 지워도 야간 배치의 ensureSheet 가 빈 시트로
   *   되살리므로 주간 워치독이 볼 때는 «있다»(v9.197 이 자기선언 한 탭에서 이미 적어 둔 말이다).
   *   그래서 수집 장부는 «몇 줄 남았나»로 잰다 — 되살아난 빈 시트는 행 수가 안 되살아난다.
   *   목록은 골격의 세 번째 칸에서 도출한다(`수집장부탭_`). */
  const 줄어든 = [];
  const 수집탭 = 수집장부탭_();
  수집탭.forEach(n => {
    const shC = ss.getSheetByName(n);
    if (!shC) return; // 없는 것은 위 존재 축이 이미 말했다 — 두 번 외치지 않는다
    const rC = 탭수축_(shC);
    if (rC.줄었나) 줄어든.push(n + ' ' + rC.hwm + '→' + rC.지금 + '건');
  });
  /* 처방엔 **실제 속성 키**를 적는다 — `탭수축키_('<탭이름>')` 처럼 자리표를 그대로 내보내면
   * 원장은 무엇을 지워야 하는지 알 수 없다(①배포 검수 P3 · eb2fb8b5be83 · F103 계열). */
  const 줄어든키 = 줄어든.map(s => 탭수축키_(s.split(' ')[0]));
  add(줄어든.length === 0, 줄어든.length
    ? '수집 장부가 줄었다: ' + 줄어든.join(' · ') + ' — 소급이 안 되는 데이터입니다. 되돌리거나, 의도한 정리였다면 스크립트 속성 ' + 줄어든키.map(k => '`' + k + '`').join(' · ') + ' 를 지우세요'
    : '수집 장부 ' + 수집탭.length + '종 줄지 않음');
  const plRows = pl ? pl.getLastRow() - 1 : 0; // pl = point_logs (섹션 4에서 조회)
  add(plRows <= 8000, 'point_logs ' + plRows + '행' + (plRows > 8000 ? ' — 아카이빙 확인 필요' : ''));
  const mailQ = MailApp.getRemainingDailyQuota();
  add(mailQ >= 30, '오늘 남은 메일 쿼터: ' + mailQ + '건' + (mailQ < 30 ? ' — 부족' : ''));

  // [v9.25] 6) 상담폼 스키마 경량 점검 — 폼/시트 구조가 바뀌면 수동 진단(checkConsultSync·
  //   dumpConsultHeaders·checkFormMapping) 전까지 몇 주간 조용히 어긋날 수 있어 워치독이 조기 감지.
  //   기대 스키마: '상담데이터입력' 탭 · 헤더 2행 · 폭 62열 · 학생ID = 60열(BH, syncProfiles가 r[59]로 참조).
  //   비용 최소화: openById 1회 + 헤더행 1회 읽기만. 접근 실패·불일치는 경고 줄로만 남기고 절대 throw하지 않음.
  try {
    const csrc = SpreadsheetApp.openById(CONSULT_SHEET_ID).getSheetByName('상담데이터입력');
    if (!csrc) {
      add(false, "상담시트 스키마: '상담데이터입력' 탭 없음 — 탭 이름 변경 의심(checkConsultSync 확인)");
    } else {
      const cw = csrc.getLastColumn();
      const chdr = cw >= 1 ? csrc.getRange(2, 1, 1, cw).getValues()[0].map(h => String(h || '').trim()) : [];
      const widthOk = cw >= 62;
      const idOk = chdr[59] === '학생ID'; // BH열(60열) = syncProfiles가 학생ID로 읽는 핵심 열
      add(widthOk && idOk, '상담시트 스키마: 폭 ' + cw + '열' +
        (widthOk ? '' : '(<62 ⚠️ 열 삭제 의심)') +
        ' · 학생ID(60열)=' + (idOk ? 'OK' : '"' + (chdr[59] || '(빈칸)') + '" ⚠️ 헤더 어긋남 — dumpConsultHeaders/checkFormMapping 실행'));
      const stV = ss.getSheetByName('app_state'); // [v9.66·리뷰 M5] 감시 게이트 = 열 폭이 아니라 마이그레이션 '적용 선언'(상담정본=v18.4) — 6열 전량 삭제(폭 62 복귀)도, 미실행 방치도 잡힌다
      const v184on = stV ? String(getState(stV, '상담정본').val || '') === 'v18.4' : false;
      const hasCForm = stV ? !!String(getState(stV, '상담폼ID').val || '') : false;
      if (v184on) {
        const missE = CONSULT_EXT_HEADERS.filter(h => chdr.indexOf(h) === -1);
        add(missE.length === 0, '상담시트 v18.4 증분 헤더: ' + (missE.length ? missE.join(', ') + ' 유실 — migrateConsultV184 재실행' : CONSULT_EXT_HEADERS.length + '종 정상'));
      } else if (hasCForm) {
        add(false, '상담 v18.4 마이그레이션 미실행 — 증분 문항 응답이 시트 열 없이 노션이관으로만 쌓입니다. migrateConsultV184 ▶ 1회');
      }
      // [v9.84·리뷰 H3] 상담 배선 소스 헤더 6종(v18.1 기본 열) — 이름 완전 일치로 읽으므로 개명되면 DT124~DX128이
      //   "조용히 전부 빈칸"이 된다. 증분 3종(선호그룹 등)은 위 v18.4 검사가 담당, 여기는 기본 열 몫.
      const srcNeed = ['TOPIK목표', 'TOPIK목표기한', 'TOPIK급수', 'TOPIK점수', '학습가능시간', '📝자유서술→노션'];
      const srcMiss = srcNeed.filter(h => chdr.indexOf(h) === -1);
      add(srcMiss.length === 0, '상담 배선 소스 헤더: ' + (srcMiss.length ? srcMiss.join(', ') + ' 미발견 — 상담시트 2행 헤더 개명 여부 확인(취향·목표·페이스라인이 빈칸으로 착지 중)' : srcNeed.length + '종 정상'));
      // [v9.84→v9.90] 동의 문항 적용 여부 — AI 인용·노션 이관 확대의 선행 조건(소급 불가 계열)이라 적용 전까지 주간 안내.
      //   v9.90부터 음성·AI 학습 동의(선택)가 붙었다 — 이게 없으면 나중에 모은 녹음을 한 건도 못 쓴다.
      //   [v9.138] 판 번호를 CONSENT_VERSION 단일 소스로 — 하드코딩이면 개정 때 이 줄이 남아 구 문구를 "적용됨"으로 오인한다.
      if (hasCForm) {
        const consentOn = stV ? String(getState(stV, '상담동의').val || '') === CONSENT_VERSION : false;
        add(consentOn, '상담폼 동의 문항(' + CONSENT_VERSION + '): ' + (consentOn ? '적용됨(개인정보 필수 + 음성·AI 학습 선택)' : '미적용 — 문구 검토 후 migrateConsentV186 ▶ 1회'));
        if (consentOn) {
          const vMiss = CONSENT_EXT_HEADERS.filter(h => chdr.indexOf(h) === -1);
          add(vMiss.length === 0, '음성동의 착지 열: ' + (vMiss.length ? vMiss.join(', ') + ' 유실 — migrateConsentV186 재실행(거부자를 못 읽는 상태)' : '정상'));
          const vs = voiceConsentStat_();
          if (vs.ok) add(true, '음성·AI 학습 동의 회수: 동의 ' + vs.yes + ' · 거부 ' + vs.no + ' · 미응답 ' + vs.blank + ' (총 ' + vs.total + '행 · 녹음은 "동의" 행만 대상)');
        }
      }
      // [v9.84] 상담 디테일 착지 열(DT124~DX128) 생존 — syncProfiles 배선의 도착지. 헤더 개명·열 삭제 시 폴백·페이스라인이 조용히 꺼진다
      try {
        const pfDT = ss.getSheetByName('profiles');
        const dtOk = pfDT && pfDT.getMaxColumns() >= 128 && String(pfDT.getRange('DT1').getValue()) === '상담취향' && String(pfDT.getRange('DX1').getValue()) === '페이스라인';
        add(!!dtOk, '상담 디테일 열(DT124~DX128): ' + (dtOk ? '정상' : '유실/미생성 — syncProfiles 1회 실행(첫 동기화 전이면 정상)'));
      } catch (eDT) { add(false, '상담 디테일 열 점검 실패: ' + eDT); }
    }
  } catch (e) { add(false, '상담시트 스키마 점검 실패 — CONSULT_SHEET_ID/권한 확인: ' + e); }

  // [v9.34] 7) 폼 생존 점검 — 상담폼·리드폼이 삭제·권한 상실되면 응답이 폼 안에 미아로 적체되고
  //   form_responses 행이 안 생겨 checkConsultDelay도 무반응(입학 퍼널 무감시 단절)이던 지대 해소.
  try {
    const stF = ss.getSheetByName('app_state');
    [['상담폼ID', '상담폼(입학 퍼널)', 'createConsultForm 재실행 또는 app_state 키 교정'],
     ['리드폼ID', '리드폼(광고 유입)', 'createLeadForm 재실행'],
     ['면접폼ID', '면접 기록 폼(비자·취업)', 'createInterviewLogForm 재실행'],
     // 직장폼만 서명(제목+필수 두 문항)까지 — ID 가 «다른 폼»으로 바뀌어도 openById 는 성공이라
     // 생존 검사가 초록인 채 무관 응답을 직장 경험으로 세던 구멍(codex P2 5b85e75e).
     /* ⚠ 둘째 인자를 «안» 넘긴다 = 엄격(설문지 제목 하나만 본다). 문서 제목(Drive 파일 이름)은 남이 제 폼에
      *   붙일 수 있는 값이라 곁다리 증거일 뿐이고, 그 곁다리는 「우리 응답 탭이 그 폼에 붙었다」를 이미
      *   확인한 자리에서만 켠다(①배포 검수 6ae0f9351269). 여기는 읽기 전용 점검이라 엄격이 안전하다 —
      *   설문지 제목이 빈 옛 폼은 폼 고치기 메뉴가 한 번 돌면 제목이 채워져 이 검사도 함께 풀린다. */
     ['직장폼ID', '직장 경험 폼(VR 직업체험 0단계)', 'createWorkLogForm 재실행', function (f) { return (typeof 직장폼서명_ !== 'function') || 직장폼서명_(f); }]].forEach(p => {
      const fid = stF ? String(getState(stF, p[0]).val || '') : '';
      if (!fid) { add(true, p[1] + ': 미연결 — ID 없음(도입 전이면 정상)'); return; }
      try {
        const f = FormApp.openById(fid);
        if (p[3] && !p[3](f)) { add(false, p[1] + ' ID가 «다른 폼»을 가리킨다(서명 불일치 — 제목·필수 문항이 아니다) — app_state ' + p[0] + ' 교정 필요'); return; }
        add(true, p[1] + ' 생존: 정상');
      }
      catch (e) { add(false, p[1] + ' 열기 실패 — 폼 삭제/권한 상실 의심! ' + p[2]); }
    });
    // [v9.90] 면접 기록 회수량 — 시뮬레이터 질문 은행의 원천이라 "몇 건 모였나"가 곧 개발 준비도.
    //   0건이어도 경보가 아니다(배포 직후가 정상) — 상태만 상시 노출해 회수 활동을 잊지 않게 한다.
    const shIv = ss.getSheetByName('면접기록_응답');
    if (shIv) add(true, '면접 기록 회수: ' + Math.max(0, shIv.getLastRow() - 1) + '건 (질문 은행 원천 · 배포처는 졸업생 그룹·상담 자리)');
    // [v9.268] 직장 경험 회수량 — VR 직업체험(SYNK 인증 실기)의 장면·과업·«방해»가 여기서 나온다.
    //   면접 회수량과 같은 계급: 0건도 경보가 아니고(배포 직후가 정상) 상태만 상시 노출해 회수를 잊지 않게 한다.
    /* 🔑 「이름이 같은 탭」을 그 폼의 탭으로 믿지 않는다(①배포 검수 b073a11c3a3e) — 탭이 다른 폼으로
     *   갈아 끼워지면 폼 생존 검사는 초록인 채로 «무관한 행»을 직장 경험으로 세게 된다.
     *   그래서 탭의 연결 폼 URL 에 직장폼ID 가 들어 있는지 대조하고, 셋을 갈라서 말한다. */
    const shWk = ss.getSheetByName('직장기록_응답');
    const wkId = stF ? String(getState(stF, '직장폼ID').val || '') : '';
    if (shWk && !wkId) {
      // 🔑 ID 가 없으면 «검증 못 한 것»이지 정상이 아니다(①배포 검수 12f7d19f598f) — 옛 탭·손으로 만든 탭의
      //   행이 그럴듯한 회수량으로 찍히면 「모으고 있다」는 거짓 초록이 된다. 세지 말고 그렇게 말한다.
      add(false, '직장 경험 회수: 탭 「직장기록_응답」은 있는데 app_state 에 직장폼ID 가 없어 «이 탭이 우리 폼의 것인지 확인하지 못했습니다» — 행 수를 세지 않았습니다. 시트 메뉴에서 「🧰 직장 경험 회수 폼 만들기」를 눌러 연결을 세우세요');
    } else if (shWk) {
      let 소속 = false;
      try { 소속 = String(shWk.getFormUrl() || '').indexOf(wkId) !== -1; } catch (eW) { 소속 = false; }
      if (소속) add(true, '직장 경험 회수: ' + Math.max(0, shWk.getLastRow() - 1) + '건 (실기 장면·과업·방해의 원천 · 배포처는 한국 근무 경험자)');
      else add(false, '직장 경험 회수: 탭 「직장기록_응답」이 app_state 의 직장폼ID 와 «다른 폼»에 붙어 있습니다 — 지금 세는 행이 직장 경험이 아닐 수 있습니다. 탭의 「양식」 메뉴로 어느 폼인지 확인하세요');
    } else if (wkId) {
      // 폼은 사는데 탭이 없으면 «회수량 줄 자체»가 사라져 조용한 초록이 된다(①배포 검수 76f9a4508be9)
      add(false, '직장 경험 회수: 응답 탭 「직장기록_응답」이 없습니다 — 폼은 살아 있는데 시트 연결이 끊겼거나 탭 이름이 갈렸습니다(회수량이 조용히 사라집니다). 시트 메뉴에서 「🧰 직장 경험 회수 폼 만들기」를 다시 누르면 라우팅을 되겁니다');
    }
  } catch (e) { add(false, '폼 생존 점검 실패: ' + e); }

  // [v9.67] 8) AI 첨삭 파이프라인 — CLAUDE_API_KEY 휴면·적체가 어디에도 안 뜨던 결함 해소(2026-07-26 진단 ②).
  //   키 값은 절대 노출하지 않는다(존재 여부만). 적체 = 숙제폼_응답 신규 누적 vs hw_feedback 최근 생성 대조.
  try {
    const ai = aiFeedbackHealth_(ss);
    add(ai.hasKey, 'CLAUDE_API_KEY: ' + (ai.hasKey ? '설정됨 — AI 첨삭·문법판정·스튜디오 활성'
      : '미설정 — AI 기능 전부 휴면(첨삭·문법판정·스튜디오·레벨진단 0초 스킵). 개원 전 의도적 휴면이면 무시'));
    const stale = ai.backlog > 0 && (!ai.hasKey || ai.oldestAge > 1); // 밤 배치를 확실히 1회+ 지나친 큐 머리만 경보(허위 경보 차단)
    add(!stale, '숙제 첨삭 적체: ' + (ai.backlog === 0 ? '없음(신규 제출 전부 소진)'
      : ai.backlog + '건 누적(가장 오래된 제출 ' + (ai.oldestAge < 0 ? '나이 미상' : ai.oldestAge + '일 전') + ' · hw_feedback 최근 생성 ' + (ai.fbAge < 0 ? '이력 없음' : ai.fbAge + '일 전') + ')'
        + (stale ? (ai.hasKey ? ' — 밤 배치가 지나쳤는데 남아 있음, 실패 의심(aiFeedbackBatch 실행 기록·키 유효성 확인)' : ' — 키 미설정이 원인, 설정 즉시 다음 밤 자동 소진')
          : ' (다음 밤 자동 소진 예정)')));
  } catch (e) { add(false, 'AI 첨삭 계기 점검 실패: ' + e); }

  // [v9.77] 9) profiles 무결성 — 앱 Edit/Add 잔재·수기 오염이 만든 유령 행/중복 ID/무효 role.
  //   야간 통보(profilesIntegrityNightly_)는 이상 시에만 오므로, 주간 리포트에는 상태를 상시 표기.
  try {
    const pi = profilesIntegrityScan_(ss);
    add(pi.clean, 'profiles 무결성: ' + (pi.clean ? '유령 행·중복 ID·무효 role 없음'
      : (pi.ghost.length ? '유령 행 ' + pi.ghost.length + '건(' + pi.ghost.join(', ') + ') ' : '')
      + (pi.dupId.length ? 'user_id 중복 ' + pi.dupId.length + '건(' + pi.dupId.join(', ') + ') ' : '')
      + (pi.badRole.length ? '무효 role ' + pi.badRole.length + '건(' + pi.badRole.join(', ') + ')' : '')
      + '— 정본은 상담시트→syncProfiles, 직접 만든 행 정리 필요'));
  } catch (e) { add(false, 'profiles 무결성 점검 실패: ' + e); }

  const report = '🛡️ SYNK 시스템 워치독 · ' +
    Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm') + '\n\n' + out.join('\n') +
    '\n\n⚠️가 하나라도 있으면 그 줄만 공유해주세요 — 나머지는 건강합니다.';
  Logger.log(report);
  if (wantText) return out.join('\n'); // [v9.25] 통합 리포트용 본문 — 제목/타임스탬프는 weeklyJobs가 부여
  const warn = out.filter(l => l.indexOf('⚠️') === 0).length;
  /* 정보 줄은 «따로» 센다 — 경보가 0 이어도 「전부 정상」이 아니다. 의도된 미개통이 몇 건인지
   *   제목에서 보여야 「아무 일 없음」과 「일부러 꺼 둔 것이 있음」이 갈린다(지적 9e616375d292). */
  const info = out.filter(l => l.indexOf('ⓘ') === 0).length;
  const 제목상태 = warn ? '⚠️ ' + warn + '건' + (info ? ' · ⓘ ' + info + '건' : '')
    : (info ? '✅ 정상 · ⓘ ' + info + '건' : '✅ 전부 정상');
  if (quotaOk(1)) {
    MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 🛡️ 주간 워치독 ' + 제목상태, report);
  }
}

/* ===================== [v9.37] 🧭 시스템 매니페스트 — 코드↔실제 드리프트 실측 =====================
 * 헤더·주석의 수동 숫자(시트 수·콘텐츠 수·버전)를 코드에 박지 않고, 실행 시점의 실제 값을
 * system_manifest 시트에 출력한다. 정본(SYNK_VERSION·sheetSkeleton_()·CONTENT_EXPECT)과
 * 라이브 스프레드시트를 대조해 누락·잉여·스키마 드리프트를 한 장에서 드러낸다.
 * 실행: 수동 buildSystemManifest() · 주간 weeklyJobs 자동 · 재건 직후 bootstrapSynk.
 * 쓰기: writeIfChanged만(변경 시에만) — Glide 미바인딩 시트라 update 쿼터 소비 0. 각 접근은 null 가드. */
function buildSystemManifest() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const rows = []; // 각 [지표, 값, 상태]
  const OK = '정상', WARN = '⚠️ 확인';
  function push(k, v, s) { rows.push([k, String(v), s || OK]); }
  const sh = ensureSheet(ss, 'system_manifest', ['지표', '값', '상태']); // 소유 시트 — getSheets() 집계 전에 보장(첫 실행 자기 '누락' 오탐 방지)

  // 1) 버전
  push('버전', SYNK_VERSION, OK);

  // 2) 시트 수 + 스켈레톤 대비 누락/잉여
  const liveSheets = ss.getSheets().map(function (s) { return s.getName(); });
  const skel = sheetSkeleton_(); // [v9.135] 골격 정본이 지연 평가 함수로 바뀜(엔진_셋업확장.js) — 런타임 호출이라 파일 순서 무관
  const skelNames = skel.map(function (k) { return k[0]; });
  const missing = skelNames.filter(function (n) { return liveSheets.indexOf(n) === -1; });
  const surplus = liveSheets.filter(function (n) { return skelNames.indexOf(n) === -1; });
  push('시트 수(실측)', liveSheets.length + '장 · 스켈레톤 정본 ' + skelNames.length + '종', missing.length ? WARN : OK);
  push('스켈레톤 누락(재건 필요)', missing.length ? missing.join(', ') : '없음', missing.length ? WARN : OK);
  push('스켈레톤 외 시트(setup·수동 탭)', surplus.length ? surplus.join(', ') : '없음', OK); // 잉여는 경보 아님(setup 생성·수동 탭 포함)

  // 3) 스키마 드리프트 — 스켈레톤 각 시트 1행 헤더의 앞부분이 실제와 일치하는지(확장열 허용)
  const drift = [];
  skel.forEach(function (k) {
    const name = k[0], want = k[1] || [];
    const sh = ss.getSheetByName(name);
    if (!sh) return; // 누락은 2)에서 보고
    const lastCol = sh.getLastColumn();
    if (lastCol < 1) { if (want.length) drift.push(name + '(빈 헤더)'); return; }
    const have = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h == null ? '' : h).trim(); });
    const mismatch = want.some(function (h, i) { return String(h).trim() !== (have[i] || ''); });
    if (mismatch) drift.push(name);
  });
  push('스키마 드리프트(1행 헤더)', drift.length ? drift.join(', ') + ' — 라이브가 구 스키마 의심' : '없음', drift.length ? WARN : OK);

  // 4) 콘텐츠 유형별 실측 vs CONTENT_EXPECT
  const cnt = {};
  const ct = ss.getSheetByName('contents');
  if (ct && ct.getLastRow() >= 2) {
    ct.getRange(2, 2, ct.getLastRow() - 1, 1).getValues().forEach(function (r) { // B열 = 콘텐츠 유형
      const t = String(r[0] || ''); if (t) cnt[t] = (cnt[t] || 0) + 1;
    });
  }
  const bad = Object.keys(CONTENT_EXPECT).filter(function (kk) { return (cnt[kk] || 0) !== CONTENT_EXPECT[kk]; });
  const totalContent = Object.keys(cnt).reduce(function (a, kk) { return a + cnt[kk]; }, 0);
  push('콘텐츠 총계(실측)', totalContent + '개 · ' + Object.keys(CONTENT_EXPECT).length + '유형 기대', OK);
  push('콘텐츠 유형 불일치', bad.length
    ? bad.map(function (kk) { return kk + ' ' + (cnt[kk] || 0) + '/' + CONTENT_EXPECT[kk]; }).join(', ') + ' — 해당 setup 재실행'
    : '전부 일치', bad.length ? WARN : OK);

  // 5) 트리거 — 실측 수·핸들러 vs 기대치. [v9.202] 기대치를 triggerManifest_(정본)에서 파생한다.
  //   (고정 10이던 시절엔 정상 설치된 11개를 ⚠로 오판했다 — 2026-07-26 진단 결함 ①의 매니페스트 축.
  //    v9.67이 교재연동 1을 조건부로 더해 닫았지만, v9.164가 onConsultEdit을 더할 때 이 숫자를 안 올려
  //    **정상 상태에서 영구 WARN**으로 되살아났다. 여기서 숫자를 또 손으로 올리면 같은 자리가 세 번째로
  //    갈라진다 — 상시 거짓경보는 사람이 이 점검을 통째로 무시하게 만든다.)
  const tbOnM = textbookLinkOn_(ss);
  const 기대핸들러 = triggerManifest_(tbOnM);
  const EXPECT_TRIGGERS = 기대핸들러.length;
  let handlers = [];
  try { handlers = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }); } catch (e) { handlers = []; }
  const uniqH = handlers.filter(function (h, i) { return handlers.indexOf(h) === i; }).sort();
  push('트리거 수(실측)', handlers.length + '개 / 기대 ' + EXPECT_TRIGGERS + (tbOnM ? ' (통합 ' + triggerManifest_(false).length + '+교재연동 1)' : ' (통합 ' + EXPECT_TRIGGERS + ' · 교재연동 미개통)'), handlers.length === EXPECT_TRIGGERS ? OK : WARN);
  push('트리거 핸들러', uniqH.length ? uniqH.join(', ') : '(없음)', uniqH.length ? OK : WARN);
  // [v9.202] 개수만 대조하면 「하나 죽고 하나 생긴」 상태가 통과한다. 매니페스트가 이름을 들고 있으니 실종을 **지목**한다 —
  //   수만 어긋나던 시절엔 무엇이 빠졌는지 사람이 트리거 화면을 직접 세어 봐야 했다.
  const 실종T = 기대핸들러.filter(function (h) { return uniqH.indexOf(h) < 0; });
  if (실종T.length) push('트리거 실종(매니페스트 대조)', 실종T.join(', ') + ' → resetAllTriggers() 1회', WARN);

  // 6) 외부 의존성
  const props = PropertiesService.getScriptProperties();
  push('NOTION_TOKEN', props.getProperty('NOTION_TOKEN') ? '있음 — 노션 동기화 활성' : '없음 — 노션 동기화 스킵(무해)', OK);
  push('CLAUDE_API_KEY', props.getProperty('CLAUDE_API_KEY') ? '있음 — AI 첨삭·문법판정·스튜디오 활성'
    : '없음 — AI 기능 휴면(첨삭·문법판정·스튜디오·레벨진단 스킵)', props.getProperty('CLAUDE_API_KEY') ? OK : WARN); // [v9.67] 값은 절대 미출력(존재 여부만) — 휴면 무감시 결함 해소

  let consultVal, consultStat = WARN;
  try {
    const csrc = SpreadsheetApp.openById(CONSULT_SHEET_ID).getSheetByName('상담데이터입력');
    if (csrc) { consultVal = '접근 OK · 폭 ' + csrc.getLastColumn() + '열'; consultStat = OK; }
    else consultVal = "열림 · '상담데이터입력' 탭 없음";
  } catch (e) { consultVal = '접근 실패 — ID/권한 확인'; }
  push('상담시트(CONSULT_SHEET_ID)', consultVal, consultStat);

  push('리포트 템플릿(REPORT_TEMPLATE_ID)',
    (REPORT_TEMPLATE_ID && String(REPORT_TEMPLATE_ID).trim()) ? '설정됨 — 리포트카드 활성' : '비어있음 — 리포트카드 스킵', OK);

  // 백업 최신성 — SYNK_백업 폴더의 앱데이터 백업 최신 나이(dailyBackup 로직 참고)
  let bkVal = '폴더 없음 — dailyBackup 1회 실행', bkStat = WARN;
  try {
    const bIt = DriveApp.getFoldersByName('SYNK_백업');
    if (bIt.hasNext()) {
      const files = bIt.next().getFiles(); let newest = 0;
      while (files.hasNext()) {
        const f = files.next();
        if (f.getName().indexOf('SYNK_앱데이터_백업_') === 0) { const t = f.getDateCreated().getTime(); if (t > newest) newest = t; }
      }
      if (newest) { const ageD = Math.floor((Date.now() - newest) / 86400000); bkVal = '최신 앱백업 ' + ageD + '일 전'; bkStat = ageD <= 2 ? OK : WARN; }
      else { bkVal = '앱데이터 백업 파일 없음'; }
    }
  } catch (e) { bkVal = '백업 점검 실패: ' + e; }
  push('백업 최신성(SYNK_백업)', bkVal, bkStat);

  // 완주 마커 신선도 — 야간·월간 배치(Script Properties)
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const nb = props.getProperty('야간배치완료일') || '';
  const nbAge = nb ? Math.round((new Date(today) - new Date(nb.slice(0, 10))) / 86400000) : 999;
  push('야간배치 완주(nightJobs)', nb ? nb + ' (' + nbAge + '일 전)' : '없음', (nb && nbAge <= 1) ? OK : WARN);
  const curYm = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
  const dom = Number(Utilities.formatDate(new Date(), tz, 'd'));
  const mb = props.getProperty('월간배치완료월') || '';
  push('월간배치 완주(monthlyJobs)', mb || '없음', (dom < 3 || mb === curYm) ? OK : WARN); // 매월 3일부터 당월 점검

  // 7) 생성 메타
  push('생성 시각', Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'), OK);
  push('생성 경로', '수동 buildSystemManifest() · 주간 weeklyJobs · 재건 bootstrapSynk', OK);
  push('앱 바인딩', '미바인딩(진단 전용) — update 쿼터 소비 0', OK);

  // 출력 — writeIfChanged로 변경 시에만(쿼터 절약). 이전 실행이 더 길었으면 초과 행 정리
  const prevLast = sh.getLastRow();
  const body = [['지표', '값', '상태']].concat(rows);
  writeIfChanged(sh, 1, 1, body);
  if (prevLast > body.length) sh.getRange(body.length + 1, 1, prevLast - body.length, 3).clearContent();
  try { sh.setFrozenRows(1); } catch (e) {}
  Logger.log('🧭 system_manifest 갱신: ' + rows.length + '지표');
  return 'system_manifest 갱신: ' + rows.length + '지표 (' + Utilities.formatDate(new Date(), tz, 'HH:mm') + ')';
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
 * 무인자 호출은 app_state '상담폼ID'(현재 연결된 폼)를 검사. 데이터는 절대 수정하지 않음.
 * [v9.66] v18.4 — 증분 열(63~)도 매핑 대상(60~62열 보호 구간만 노션이관 처리), 헤더 폭 동적화. */
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
    headers = consult.getRange(2, 1, 1, Math.max(62, consult.getLastColumn())).getValues()[0].map(h => String(h || '').trim()); // [v8.4] v18.1 헤더 2행 · [v9.66] 폭 동적
  } catch (e) { Logger.log('상담시트 열기 실패 — ID/권한 확인: ' + e); return; }
  const colOf = {}, hdrDup = []; // [v9.66·리뷰 M2] 중복 헤더는 첫 열 우선(importFormResponses와 동일 규칙) + 진단에 노출
  headers.forEach((h, i) => { if (!h) return; if (colOf[h]) hdrDup.push(h + '(' + colOf[h] + '↔' + (i + 1) + '열)'); else colOf[h] = i + 1; });

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
    if (c && (c <= 59 || c >= 63)) matched.push('  · ' + t + ' → ' + c + '열' + (c >= 63 ? ' (v18.4 증분)' : '')); // importFormResponses와 동일 규칙(60~62열 보호 구간만 제외)
    else narrative.push('  · ' + t + (c ? ' (보호 구간 ' + c + '열(60~62) → 노션이관)' : ' → 노션이관(대응 헤더 없음)'));
  });

  // [v9.19] v18.3 기준 — 폼이 안 채워도 정상인 칸(자동 채번·타임스탬프·서술형 모음·강사 배정·자동 계산)
  const autoCols = { '학생ID': 1, '등록일': 1, '📝자유서술→노션': 1, '나이(자동)': 1, '반': 1, '비고': 1, '⚠위험신호(자동)': 1, '반조회순번(숨김)': 1 };
  const uncovered = [];
  headers.forEach((h, i) => { if (h && !seen[h] && !autoCols[h]) uncovered.push(h + '(' + (i + 1) + '열)'); }); // [v9.66] 증분 열(63~)도 폼 미대응이면 경고 — 60~62열은 autoCols가 제외

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
    (hdrDup.length ? '\n⚠️ 시트 중복 헤더(첫 열에만 기입됨): ' + hdrDup.join(', ') : ''),
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
  // [v9.125] 리허설 격리 — 구 코드는 다이제스트 큐 적재가 quotaOk를 안 지나, 리허설 산출물("AI 차단" 등)이
  //   다음 아침 진짜 장애 보고로 발송됐다. 리허설 중엔 큐 대신 리허설 리포트에 남긴다.
  if (isRehearsal_()) { rehearsalNote_('원장 브리핑: ' + String(subject || '').replace('[SYNK] ', '')); return; }
  if (!DIGEST_MODE) { if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, subject, body); return; }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const p = PropertiesService.getScriptProperties();
    const cur = p.getProperty('브리핑큐') || '';
    const item = '■ ' + subject.replace('[SYNK] ', '') + '\n' + body + '\n\n';
    if ((cur + item).length > 8500) { // Properties 9KB 한계 보호 — 넘치면 즉시 발송
      if (quotaOk(1)) MailApp.sendEmail(ADMIN_EMAIL, subject, body);
      return;
    }
    p.setProperty('브리핑큐', cur + item);
  } finally { lock.releaseLock(); }
}

// [v9.32] 아침 하트비트용 마커 신선도 — Script Properties의 완주/게시 마커 나이만 경량 점검(Drive 접근 없음).
//   systemWatchdog와 같은 임계값(야간 ≤1일 · 숙제 ≤2일 · 월간 = 당월)을 쓴다.
function markerFreshness_(props, tz) {
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const curYm = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
  const ageOf = function (v) { return v ? Math.round((new Date(today) - new Date(String(v).slice(0, 10))) / 86400000) : 999; };
  const checks = [];
  const nb = props.getProperty('야간배치완료일');
  checks.push({ ok: ageOf(nb) <= 1, s: '야간배치 완주: ' + (nb || '(없음)') });
  const hw = props.getProperty('숙제기준일');
  checks.push({ ok: ageOf(hw) <= 2, s: '오늘의 숙제 게시: ' + (hw || '(없음)') });
  const mb = props.getProperty('월간배치완료월');
  const domN = Number(Utilities.formatDate(new Date(), tz, 'd'));
  checks.push({ ok: domN < 3 || mb === curYm, s: '월간배치 완주: ' + (mb || '(없음)') });
  return { stale: checks.some(function (c) { return !c.ok; }), lines: checks.map(function (c) { return (c.ok ? '✅ ' : '⚠️ ') + c.s; }) };
}

function sendMorningDigest() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const p = PropertiesService.getScriptProperties();
    const q = p.getProperty('브리핑큐');
    if (!q) {
      // [v9.32] 데드맨 스위치 — 큐가 비어도 매일 08시 하트비트 1통. 메일이 '안 오는 것' 자체가 트리거
      //   전체 사망(재인증 만료·권한 상실) 신호가 되게 한다. 마커가 오래됐으면 제목을 ⚠️로 바꿔 정상일과
      //   구분(매일 ✅는 배경소음이 되어 부재 감지가 약해지므로).
      if (!DAILY_HEARTBEAT || !quotaOk(1)) return;
      const tzH = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
      const fr = markerFreshness_(p, tzH);
      MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] ' + (fr.stale ? '⚠️ 신선도 경고' : '☀️ 시스템 정상'),
        (fr.stale ? '아래 항목이 오래됐습니다 — 트리거/시간대를 확인하세요.\n\n' : '알릴 운영 소식이 없는 조용한 하루입니다. 시스템은 정상 작동 중입니다.\n\n') +
        fr.lines.join('\n') + '\n\n(이 메일이 아침에 오지 않으면 자동화 트리거가 멈춘 것일 수 있습니다.)');
      return;
    }
    if (!quotaOk(1)) return; // 쿼터 부족이면 큐를 보존해 다음 발송에서 재시도
    MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] ☀️ 오늘의 운영 브리핑',
      q + '— 개별 알림을 아침 1통으로 모았습니다 (DIGEST_MODE)');
    const latest = p.getProperty('브리핑큐');
    if (latest === q) p.deleteProperty('브리핑큐');
    else if (latest && latest.indexOf(q) === 0) p.setProperty('브리핑큐', latest.slice(q.length));
    // 예상 밖 변경이면 삭제하지 않는다. 중복 발송 가능성보다 알림 유실 방지를 우선한다.
  } finally { lock.releaseLock(); }
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
  if (day === 0) return; // [v9.46] 일요일 수업 없음(주말반=토요일만) — 브리핑 발송 창 자체를 안 연다
  const isWknd = (day === 6);
  const todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const props = PropertiesService.getScriptProperties();
  const key = '수업알림_' + todayStr;
  const sent = String(props.getProperty(key) || '');
  let sentNew = sent;

  const sch = scheduleMap(ss);
  // [v9.22] 임박 수업이 하나도 없으면 profiles/emap/state 스캔 없이 조기 종료 (10분 스위프 부담↓)
  const yest = Utilities.formatDate(new Date(now.getTime() - 86400000), tz, 'yyyy-MM-dd');
  const anyImminent = Object.keys(sch).filter(num => sch[num].name === num).some(num => {
    const s = sch[num];
    if ((String(s.type) === '주말') !== isWknd) return false;
    const m = String(s.time || '').match(/(\d{1,2})\s*[:시]?\s*(\d{2})?/);
    if (!m) return false;
    const start = new Date(now); start.setHours(Number(m[1]), Number(m[2] || 0), 0, 0);
    const diff = (start - now) / 60000;
    return diff > 0 && diff <= CLASS_PREP_WINDOW_MIN;
  });
  if (!anyImminent) { props.deleteProperty('수업알림_' + yest); return; }
  const emap = teacherEmailMap_(ss);
  let cheerLine = ''; // [v9.47·B6] ☀️ 출근 치어 7종(cheer·F열=1(일)~7(토)) → 브리핑 첫인사로 환류 — 시트에 잠들어 있던 콘텐츠 소생
  {
    const ctC = ss.getSheetByName('contents');
    if (ctC && ctC.getLastRow() >= 2) {
      const ordC = day + 1; // getDay 0(일)~6(토) → cheer 순번 1~7
      ctC.getRange(2, 1, ctC.getLastRow() - 1, 6).getValues().some(r => {
        if (String(r[1]) === 'cheer' && Number(r[5]) === ordC && r[3]) { cheerLine = String(r[3]); return true; }
        return false;
      });
    }
  }
  const errByClass = {}; // [v9.47·B5] 🧩 연습 포인트 — student_errors(최근 14일·'해결' 제외)를 수업 직전 메일에도
  {
    const seM = ss.getSheetByName('student_errors');
    if (seM && seM.getLastRow() >= 2) {
      const pfM = ss.getSheetByName('profiles');
      const infoM = {};
      if (pfM && pfM.getLastRow() >= 2) pfM.getRange(2, 1, pfM.getLastRow() - 1, 5).getValues().forEach(r => { if (r[0]) infoM[String(r[0]).trim()] = { n: r[1] || r[0], c: String(r[4] || '') }; });
      const cutM = now.getTime() - 14 * 86400000;
      const aggM = {}; // [v9.64] 학생×유형 반복 집계 — ×N 표시 + 반복 우선(브리핑과 동일 규칙)
      seM.getRange(2, 1, seM.getLastRow() - 1, 8).getValues().forEach(r => {
        if (!r[1] || String(r[7] || '') === '해결') return;
        const dM = toDate_(r[0]) || (r[6] instanceof Date ? r[6] : null);
        if (!dM || dM.getTime() < cutM) return;
        const infM = infoM[String(r[1]).trim()];
        const clsM = (infM && infM.c) || String(r[2] || '');
        if (!clsM) return;
        const kM = String(r[1]).trim() + '|' + String(r[3] || r[4] || '');
        const gM = aggM[kM] = aggM[kM] || { c: clsM, n: (infM && infM.n) || r[1], memo: '', t: 0, cnt: 0 };
        gM.cnt++;
        if (dM.getTime() >= gM.t) { gM.t = dM.getTime(); gM.memo = String(r[4] || r[3] || ''); }
      });
      Object.keys(aggM).map(k => aggM[k]).sort((a, b) => (b.cnt - a.cnt) || (b.t - a.t)).forEach(gM => {
        (errByClass[gM.c] = errByClass[gM.c] || []).push(gM.n + ' — ' + gM.memo.slice(0, 30) + (gM.cnt > 1 ? ' ×' + gM.cnt : ''));
      });
    }
  }
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
  const absenceByClass = {}; // [v9.32] 오늘 결석 사전신고 → 강사 브리핑. 학부모가 미리 알렸어도 강사는 수업 준비 때 몰랐다.
  {
    const an = ss.getSheetByName('absence_notice');
    if (an && an.getLastRow() >= 2) {
      const pfN = ss.getSheetByName('profiles');
      const infoById = {};
      if (pfN && pfN.getLastRow() >= 2) {
        pfN.getRange(2, 1, pfN.getLastRow() - 1, 5).getValues().forEach(r => {
          if (r[0]) infoById[String(r[0]).trim()] = { name: r[1] || r[0], cls: String(r[4] || '') };
        });
      }
      an.getRange(2, 1, an.getLastRow() - 1, 4).getValues().forEach(r => {
        if (!r[0] || !r[2] || dstr(r[2], tz) !== todayStr) return;
        const info = infoById[String(r[0]).trim()];
        const cls = info ? info.cls : String(r[1] || ''); // profiles 반 우선, 없으면 신고행의 반
        const nm = info ? info.name : r[0];
        (absenceByClass[cls] = absenceByClass[cls] || []).push(nm + (r[3] ? '(' + String(r[3]) + ')' : ''));
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
    // [v9.80] 🧩 조 편성표 — 규칙서 §9 "대강 강사는 앱에 늘 있는 넷(진도·판서·좌석표·조 편성표)만으로 수업한다".
    //   편성이 없거나 시즌 밖이면 조용히 빈 문자열 — 브리핑 본체는 어떤 경우에도 죽지 않는다.
    const gbText = (function () {
      try { return groupBoardText_(ss, cname, now, tz); } catch (e) { Logger.log('조 편성표 스킵(' + cname + '): ' + e); return ''; }
    })();
    const body = (cheerLine ? cheerLine + '\n\n' : '') + // [v9.47·B6] 요일 출근 치어 첫인사
      cname + ' 수업 시작 ' + Math.round(diff) + '분 전입니다.\n' +
      (bdayByClass[cname] ? '\n🎂 오늘 ' + bdayByClass[cname].join(', ') + ' 생일! 반 전체 축하 한 번 어때요?\n' : '') +
      (absenceByClass[cname] ? '🚫 오늘 결석 예정(학부모 사전신고): ' + absenceByClass[cname].join(', ') + '\n' : '') +
      (errByClass[cname] ? '🧩 연습 포인트(최근 메모): ' + errByClass[cname].slice(0, 3).join(' · ') + '\n' : '') + '\n' + // [v9.47·B5]
      '⚡ 오늘의 루틴: 시작 — 숙제 검사 1탭 · 끝 — 도전·성장 인정(기준을 채운 학생 전원, 각 1회) · 미션 성공 시 연료 1행\n\n' +
      '📚 오늘 검사할 숙제' + (hwT ? ' (' + hwT + ')' : '') + '\n' + (hw || '게시된 숙제 없음') + '\n\n' +
      (quiz ? '⚡ 워밍업 퀴즈: ' + quiz + '\n\n' : '') +
      (gbText ? gbText + '\n' : '') + // [v9.80] 조·역할·짝·오늘 발표자 — ④소그룹 20분을 그대로 들고 들어갑니다
      '🔥 연료 미션을 걸 계획이면 수업 시작 때 선언해 주세요!\n\n좋은 수업 되세요 — SYNK LAB';
    // [v9.125] 발송 성공에만 마킹 — 관문(리허설·쿼터)이 닫힌 채 마킹하면 그 반의 준비 브리핑이 그날 영구 소실된다.
    //   한 명이라도 나갔으면 마킹(같은 반 재발송 폭주 방지), 전원 실패면 다음 스위프가 창 안에서 재시도.
    let prepSent = false;
    teachers.forEach(t => {
      if (quotaOk(1)) { MailApp.sendEmail(t.email, '[SYNK] 🎬 ' + cname + ' 수업 ' + Math.round(diff) + '분 전 — 오늘의 준비', body); prepSent = true; }
    });
    if (prepSent) sentNew += '[' + num + ']';
    else Logger.log('수업 브리핑 보류(' + cname + ') — 발송 관문 닫힘, 다음 스위프 재시도');
  });
  if (sentNew !== sent) props.setProperty(key, sentNew);
  props.deleteProperty('수업알림_' + yest); // 어제 키 정리 ([v9.22] yest는 상단 선언 재사용)
}

function checkoutCheerMail_(ss) {
  const tc = ss.getSheetByName('teacher_checkins');
  if (!tc || tc.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  // [v9.74] 당일 1회/강사 가드 준비 — 어제 키 청소는 조기 return보다 앞(무기록 날에도 청소돼 키 누수 없음, 리뷰 L1)
  const now = new Date();
  const tzCo = ss.getSpreadsheetTimeZone();
  const todayCo = Utilities.formatDate(now, tzCo, 'yyyy-MM-dd');
  const sentKey = '퇴근응원_' + todayCo;
  let sentNames = String(props.getProperty(sentKey) || '');
  props.deleteProperty('퇴근응원_' + Utilities.formatDate(new Date(now.getTime() - 86400000), tzCo, 'yyyy-MM-dd'));
  const ptr = Number(props.getProperty('퇴근메일_포인터')) || 1;
  const last = tc.getLastRow();
  if (ptr > last) { props.setProperty('퇴근메일_포인터', String(last)); return; } // [v9.34] 시트 재건·행 정리 시 클램프 — 퇴근 응원 메일 장기 침묵 방지
  if (ptr >= last) return;
  const width = Math.max(TC_NAME_COL, TC_TYPE_COL, TC_TIME_COL);
  const rows = tc.getRange(ptr + 1, 1, last - ptr, width).getValues();
  const emap = teacherEmailMap_(ss); // now는 상단 가드 블록에서 선언([v9.74])

  const pool = [];
  const ct = ss.getSheetByName('contents');
  if (ct && ct.getLastRow() >= 2) {
    ct.getRange(2, 1, ct.getLastRow() - 1, 6).getValues().forEach(r => {
      if (r[1] === 'cheermail' && r[3]) pool.push(String(r[3]));
    });
  }

  // [v9.74] 당일 1회/강사 가드 — 퇴근 버튼 중복 탭이 같은 날 응원 메일을 2통 내보내던 것 차단(유호 07-28 보고).
  //   마킹은 발송 성공 후에만. 쿼터 소진은 포인터 전진 없이 중단(다음 스위프 재시도), 이메일 미등록은 전진(재시도 무의미).
  let advanced = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const typ = String(r[TC_TYPE_COL - 1] || '');
    if (typ.indexOf('퇴근') === -1) { advanced = i + 1; continue; }
    const tRaw = r[TC_TIME_COL - 1];
    const t = (tRaw instanceof Date) ? tRaw : new Date(tRaw);
    if (!t || isNaN(t.getTime())) { advanced = i + 1; continue; }
    if ((now - t) / 60000 < CHECKOUT_MAIL_DELAY_MIN) break; // 아직 5분 미만 → 다음 스위프에서
    // [v9.32] 당일 가드 — 재건/포인터 리셋 시 과거 퇴근 이력 전체에 응원 메일이 재발송되는 사고 방지.
    //   오늘 기록만 발송하고 지난 기록은 포인터만 전진시켜 조용히 건너뛴다.
    if (Utilities.formatDate(t, tzCo, 'yyyy-MM-dd') !== todayCo) { advanced = i + 1; continue; }
    const who = String(r[TC_NAME_COL - 1] || '').trim();
    if (who && sentNames.indexOf('|' + who + '|') > -1) { advanced = i + 1; continue; } // [v9.74] 같은 강사 당일 2번째 퇴근 탭 — 메일 1회만
    const email = emap.byKey[who] || '';
    if (email && pool.length && !quotaOk(1)) break; // [v9.74·리뷰 H2] 쿼터 소진 — 포인터 전진 없이 중단해 다음 스위프가 재시도
    if (email && pool.length) {
      const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
      const msg = pool[(doy + i) % pool.length];
      MailApp.sendEmail(email, '[SYNK] 🌙 오늘도 수고하셨습니다',
        (who ? who + ' 선생님,\n\n' : '') + msg + '\n\n— SYNK LAB');
      sentNames = (sentNames || '|') + who + '|'; // [v9.74] 발송 성공분만 마킹
      props.setProperty(sentKey, sentNames);
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

// [v9.43·자동화] 리드폼 응답 → leads 자동 편입 — "리드폼_응답 시트를 leads로 옮기세요"(수기)를 10분 스위프로 대체.
//   매핑: 타임스탬프→날짜 · 이름 · 연락처 · 인지채널→유입경로 · 관심과정→메모. 나머지(체험·등록…)는 데스크 후속 기입.
//   포인터 = Script Properties '리드폼_포인터'(등원알림 패턴·클램프 포함) — 시트 쓰기 0·중복 편입 0.
function sweepLeadForm_(ss) {
  const src = ss.getSheetByName('리드폼_응답');
  if (!src || src.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  const last = src.getLastRow();
  let from = Number(props.getProperty('리드폼_포인터')) || 1;
  if (from > last) { props.setProperty('리드폼_포인터', String(last)); return; }
  if (from >= last) return;
  const rows = src.getRange(from + 1, 1, last - from, 5).getValues(); // 타임스탬프·이름·연락처·인지채널·관심과정
  const ld = ensureSheet(ss, 'leads', ['날짜', '이름', '연락처', '유입경로', '추천인', '체험참석', '등록', '등록권종', '등록일', '미등록사유', '메모', '캠페인']);
  const out = [];
  const tz = ss.getSpreadsheetTimeZone();
  rows.forEach(r => {
    if (!r[1]) return;
    out.push([r[0] ? dstr(r[0], tz) : dstr(new Date(), tz), String(r[1]).trim(), String(r[2] || '').trim(),
      String(r[3] || '기타'), '', '', '', '', '', '', String(r[4] || ''), '리드폼']);
  });
  if (out.length) {
    // [v9.157] 광고 리드폼 = 공개 폼(페이스북·인스타 CTA) — 이름·연락처·메모가 응답자의 글 그대로다.
    //   leads는 profiles(학생·보호자 연락처)와 같은 스프레드시트라, '=' 선두 한 줄이면 그 시트가 스스로
    //   IMPORTDATA로 개인정보를 밖으로 보낸다. 10분 스위프라 상시 열린 입구였다.
    ld.getRange(ld.getLastRow() + 1, 1, out.length, 12).setValues(행소독_(out));
    adminMail('[SYNK] 📥 새 리드 ' + out.length + '건(광고 리드폼)', out.map(o => '· ' + o[1] + ' (' + o[3] + ') ' + o[2]).join('\n') + '\n\nleads 시트에서 체험 일정을 잡아주세요.');
  }
  props.setProperty('리드폼_포인터', String(last));
}

/* ===================== [v9.49] 폼 출석 전개 + AI 숙제 첨삭 ===================== */

// [v9.67] 폼 응답 무효 학생ID 드롭 통보 — profiles에 없는 sid 행은 반영 없이 포인터만 전진하는데(동작 유지),
//   그 사실이 로그·메일 어디에도 없어 미리채움 링크 오염·손 입력 오타를 영영 모르던 결함 해소(2026-07-26 진단 ③).
//   약점메모폼 '미매칭' 메일과 동급의 통보만 한다 — 자동 복구는 과설계(정상 운영은 폼 미리채움이라 희귀 사건).
//   같은 폼·같은 sid는 하루 1회만 알림(safeRun 실패 메일 dedup 패턴) · 원본 행은 폼 응답 탭에 그대로 남는다.
//   호출처 3곳: sweepAttendanceForm_(출석폼)·aiFeedbackBatch_(숙제폼)·voiceSweep_(목소리폼, 교재연동.js).
function notifyDroppedSids_(label, sids) {
  if (!sids || !sids.length) return;
  try {
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    const props = PropertiesService.getScriptProperties();
    const key = '무효sid통보_' + label;
    const prev = String(props.getProperty(key) || '').split('|');
    const seen = prev[0] === today ? prev.slice(1) : [];
    const fresh = sids.map(s => String(s).replace(/\|/g, '¦').slice(0, 40)).filter((s, i, a) => a.indexOf(s) === i && seen.indexOf(s) === -1); // '|'는 dedup 구분자라 치환
    if (!fresh.length) return;
    adminMail('[SYNK] 🧩 ' + label + ' 무효 학생ID ' + fresh.length + '건 — 응답 미반영',
      fresh.slice(0, 10).map(s => '· "' + s + '"').join('\n') + (fresh.length > 10 ? '\n· …외 ' + (fresh.length - 10) + '건' : '') +
      '\n\nprofiles에 없는 학생ID라 집계에 반영되지 않았습니다(포인터는 전진 · 원본 행은 ' + label + '_응답 탭에 남아 있음). ' +
      '미리채움 링크가 아닌 손 입력이거나 링크 ID 오염일 수 있어요 — 실제 학생이면 profiles 등록(또는 ID 교정) 후 재제출을 안내하세요. (같은 ID는 오늘 다시 알리지 않습니다)');
    /* 🔴 찍기 «직전»에 다시 읽어 «합친다» (2026-09-03 · codex P2 `68e0f44ff476` 채택 수리).
     *   이 함수는 스위프의 잠금 «해제 뒤»에 불린다(잠금 안에서 adminMail 을 부르면 그 비재진입 락에
     *   자기가 걸린다 — P1 48f070b17495 가 세운 규율). 그래서 위에서 읽은 `seen` 과 여기 사이에
     *   다른 실행이 같은 키를 찍었을 수 있고, 그대로 덮으면 **그쪽이 방금 알린 sid 가 seen 에서
     *   사라져 내일 또 같은 메일이 간다.** 다시 읽어 합치면 그 자리가 닫힌다.
     * 🔒 그리고 그 읽기-병합-쓰기를 **잠금 안에서** 한다(codex P2 `83c20817d737` 채택 수리 · 09-03).
     *   다시 읽는 것만으로는 창이 좁아질 뿐 안 닫힌다 — 두 실행이 `다시` 를 «동시에» 읽으면
     *   마지막 쓰기가 그 사이 남의 sid 를 여전히 덮는다. 여기는 adminMail 을 이미 지난 자리라
     *   그 비재진입 락과 안 겹치므로 잠글 수 있다(위 규율을 어기지 않는다).
     *   못 잡으면 마킹을 건너뛴다 — 그 대가는 「내일 한 통 더」이고, 남의 기록을 덮는 것보다 싸다.
     * ⚠ 남는 것 = «중복 메일» 한 통의 가능성이다. 두 실행이 같은 sid 를 각각 fresh 로 셀 창이
     *   메일 왕복만큼 열려 있다. 그걸 없애려면 마킹을 메일 «앞»으로 옮겨야 하는데, 그러면 큐 적재가
     *   실패한 날 통보가 영영 증발한다(그 순서를 tests/safety.test.js:1303 이 일부러 못 박았다).
     *   손실 없는 시끄러움과 조용한 증발 중에 앞엣것을 고른다. */
    const 마킹잠금 = (typeof LockService !== 'undefined' && LockService) ? LockService.getScriptLock() : null;
    if (마킹잠금 && !마킹잠금.tryLock(3000)) {
      Logger.log('notifyDroppedSids_: 같은 표식을 다른 실행이 쓰고 있다 — 마킹을 건너뛴다(그 sid 는 내일 한 번 더 알린다)');
      return;
    }
    try {
      const 다시 = String(props.getProperty(key) || '').split('|');
      const 그새seen = 다시[0] === today ? 다시.slice(1) : [];
      props.setProperty(key, [today].concat(그새seen, fresh)
        .filter((s, i, a) => a.indexOf(s) === i).slice(0, 200).join('|')); // 발송(큐 적재) 성공분만 마킹 + 9KB 보호 — safeRun 실패 메일 패턴(실패 시 다음 스위프 재시도)
    } finally { if (마킹잠금) 마킹잠금.releaseLock(); }
  } catch (e) { Logger.log('notifyDroppedSids_ 실패: ' + e); }
}

// [v9.49] 출석 폼 응답 → attendance 전개 — 앱 출석(학생당 update 1 소비)의 update-0 대체 경로.
//   등원알림·미등원·보드·달력은 전부 attendance 시트를 읽으므로 입력 채널 무관 동일 동작.
//   포인터 = '출석폼_포인터'(sweepLeadForm_ 패턴·클램프 포함), 당일 중복 = attendance 재조회 스킵(expandAttendanceBatch_ 패턴 — 앱·일괄 출석 병행 안전).
function sweepAttendanceForm_(ss) {
  const src = ss.getSheetByName('출석폼_응답');
  if (!src || src.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  const last = src.getLastRow();
  const from = Number(props.getProperty('출석폼_포인터')) || 1;
  if (from > last) { props.setProperty('출석폼_포인터', String(last)); return; }
  if (from >= last) return;
  const tz = ss.getSpreadsheetTimeZone();
  const rows = src.getRange(from + 1, 1, last - from, 2).getValues(); // 타임스탬프·학생ID
  const valid = new Set();
  const clsOf = {}; // [2026-09-02 걸음1] sid → profiles.class_name — 폼 출석엔 반 칸이 없으므로 **쓰는 시점**에 읽어 얼려 넣는다(조인 시점의 profiles 참조가 금지된 것이지, 스냅샷을 뜨는 읽기는 이 자리가 정답이다)
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') { valid.add(String(r[0]).trim()); clsOf[String(r[0]).trim()] = String(r[4] || '').trim(); }
  });
  const at = ensureSheet(ss, 'attendance', ATTENDANCE_HEADERS);
  헤더보정_(at, ATTENDANCE_HEADERS); // [2026-09-02 걸음1] 구 4열 라이브 시트에 class_snapshot 을 끝에
  const seen = {}; // '날짜|sid' — 같은 날 중복 제출·기존 기록 스킵
  if (at.getLastRow() >= 2) at.getRange(2, 2, at.getLastRow() - 1, 2).getValues().forEach(r => { // B·C = sid·timestamp
    if (r[0] && r[1]) seen[dstr(r[1], tz) + '|' + String(r[0]).trim()] = 1;
  });
  const out = [], badSid = []; // [v9.67] 무효 sid 수집 — 무통보 드롭 결함 수리
  rows.forEach(r => {
    const ts = r[0] instanceof Date ? r[0] : new Date();
    const sid = String(r[1] || '').trim();
    if (!sid) return;
    if (!valid.has(sid)) { badSid.push(sid); return; } // 행은 기존대로 버리되 통보만(notifyDroppedSids_)
    const key = dstr(ts, tz) + '|' + sid;
    if (seen[key]) return;
    seen[key] = 1;
    out.push(['ATF' + Utilities.formatDate(ts, tz, 'yyyyMMdd') + '-' + sid, sid, ts, '출석(폼)', clsOf[sid] || '']); // method에 '출석' 포함 = 보드·레이드 판정 호환 · 5열 = 반 스냅샷
  });
  if (out.length) at.getRange(at.getLastRow() + 1, 1, out.length, ATTENDANCE_HEADERS.length).setValues(out);
  notifyDroppedSids_('출석폼', badSid); // [v9.67] 하루 1회 dedup 내장 — 빈 배열이면 0초
  props.setProperty('출석폼_포인터', String(last));
}

/* ── [09-02 폼 넷] 🙋 반 출석 폼 응답 → attendance_batch ──
 * 한 응답 = 한 행 [날짜, class_name, 출석자 sid 쉼표, 입력자, created_at, 처리상태] — 반 명부(profiles role student · class_name) − 결석자.
 *   전개는 기존 expandAttendanceBatch_(parentSweep 바로 다음 자리 · 같은 틱)가 그대로 한다 — 그 함수는 손대지 않는다.
 * 열은 «헤더 이름»으로 읽는다 — 결석자 열이 반마다 하나씩(체크박스 문항 제목 「결석자 · 반」) + 직접 입력 열(「결석자 (직접 입력)」)이라 위치가 고정이
 *   아니다(섹션이 늘면 열이 끝에 붙는다). 폼 정의·라벨 규칙은 엔진_폼리포트.js(createClassAttendanceForm · classAttLabels_).
 * 결석자 → sid: ①체크박스 라벨은 명부에서 만든 것이라 라벨→sid 역조회가 먼저 ②「이름 (학생ID)」 꼴이면 그 ID ③그 밖은 이름 매칭(matchStudentsByNameClass_ ·
 *   다른 강사 폼과 같은 규칙). 매칭 실패는 버리지 않는다 — 동명이인(후보 2+)은 후보 «전부»를 출석에서 뺀다(누군지 모른 채 출석 처리하면 「안 왔어요」
 *   알림이 조용히 안 나간다 · 보수 쪽으로 틀린다). 명부에 없는 이름은 뺄 사람이 없다 → 행 처리상태에 '미매칭:이름' 표기 + 관리자 메일(그 이름이 오타라면
 *   그 학생은 출석으로 남는다 — 메일이 고치는 손). ⚠ 처리상태의 '미매칭:…' 은 expandAttendanceBatch_ 가 같은 틱에 '전개완료' 로 덮는다 — 남는 기록은 메일이다. */
function sweepClassAttendanceForm_(ss) {
  const src = ss.getSheetByName('반출석폼_응답');
  if (!src || src.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  const last = src.getLastRow();
  const from = Number(props.getProperty('반출석폼_포인터')) || 1;
  if (from > last) { props.setProperty('반출석폼_포인터', String(last)); return; } // 응답 시트 재생성 대비 클램프
  if (from >= last) return;
  const tz = ss.getSpreadsheetTimeZone();
  const width = Math.max(3, src.getLastColumn());
  const hdr = src.getRange(1, 1, 1, width).getValues()[0].map(h => String(h || '').trim());
  const rows = src.getRange(from + 1, 1, last - from, width).getValues();
  const iT = hdr.indexOf('강사'), iC = hdr.indexOf('반');
  const absCols = hdr.map((h, i) => (h.indexOf(CLASS_ATT_ABSENT_PREFIX) === 0 ? i : -1)).filter(i => i >= 0);
  const students = [], roster = {};
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
    if (!r[0] || r[3] !== 'student') return;
    const s = { sid: String(r[0]).trim(), n: String(r[1] || '').trim() || String(r[0]).trim(), c: String(r[4] || '').trim() };
    students.push(s);
    if (s.c) (roster[s.c] = roster[s.c] || []).push(s);
  });
  const labelSid = {}, sidSet = {};
  Object.keys(roster).forEach(c => classAttLabels_(roster[c]).forEach(x => { labelSid[c + '|' + x.label] = x.sid; }));
  students.forEach(s => { sidSet[s.sid] = 1; });
  const hdrA = skeletonHeadersOf_('attendance_batch');
  const ab = ensureSheet(ss, 'attendance_batch', hdrA);
  const out = [], miss = [];
  rows.forEach(r => {
    const ts = r[0] instanceof Date ? r[0] : new Date();
    const cls = String(iC >= 0 ? r[iC] : '').trim();
    if (!cls) return;
    const list = roster[cls];
    if (!list) { miss.push('· 반 「' + cls + '」(' + dstr(ts, tz) + ') — 명부에 학생이 없는 반이라 전개하지 않았습니다(profiles class_name 확인 · 「기타」로 낸 응답도 여기로 옵니다)'); return; }
    const absent = {}, bad = [];
    absCols.forEach(i => String(r[i] || '').split(/[,·\n]/).map(s => s.trim()).filter(Boolean).forEach(tok => {
      if (labelSid[cls + '|' + tok]) { absent[labelSid[cls + '|' + tok]] = 1; return; }
      const m = tok.match(/^(.*?)\s*\(([^()]+)\)$/); // 「이름 (학생ID)」 — 다른 반 라벨을 그대로 적은 경우
      if (m && sidSet[m[2].trim()]) { absent[m[2].trim()] = 1; return; }
      const cands = matchStudentsByNameClass_(students, m ? m[1] : tok, cls);
      if (cands.length === 1) absent[cands[0]] = 1;
      else if (cands.length > 1) { cands.forEach(s => { absent[s] = 1; }); bad.push(tok + '(동명이인 ' + cands.length + '명 — 전부 결석 처리)'); }
      else bad.push(tok);
    }));
    const present = list.map(s => s.sid).filter(sid => !absent[sid]);
    out.push([dstr(ts, tz), cls, present.join(','), String(iT >= 0 ? r[iT] : '').trim() || '폼', ts, bad.length ? '미매칭:' + bad.join(',') : '']);
    if (bad.length) miss.push('· ' + cls + ' ' + dstr(ts, tz) + ' — ' + bad.join(', ') + ' · 명부에서 못 찾은 이름은 «출석»으로 남습니다(오타였다면 attendance 에서 그 학생의 오늘 행을 지우세요)');
  });
  if (out.length) ab.getRange(ab.getLastRow() + 1, 1, out.length, hdrA.length).setValues(행소독_(out)); // [v9.157] 반·결석자 이름은 강사 손입력 — 같은 시트에 profiles 가 산다
  props.setProperty('반출석폼_포인터', String(last)); // 적재 직후·메일 전 마감 — 메일 실패가 같은 응답을 재적재하지 않게
  if (miss.length && quotaOk(1)) adminMail('[SYNK] 🙋 반 출석 폼 — 확인 필요 ' + miss.length + '건', miss.join('\n') + '\n\n처리상태의 「미매칭」 표기는 10분 안에 전개되며 지워집니다 — 이 메일이 기록입니다.');
}

/* ── [09-02 폼 넷] ⏱ 출퇴근 폼 응답 → teacher_checkins [이름, 구분, 시각(Date)] ──
 * 읽는 자 넷(todayBoard_ · teacherInOutMap_ · checkoutCheerMail_ · calcTeacherStats)은 그대로 — 열 위치는 TC_*_COL 하나에서 나온다.
 * 자기치유(엔진_폼리포트 ⑤ · 같은 이름·유형 60초 이내 연타 삭제)의 자를 적재 «전»에 같은 값으로 지킨다 — 이미 실린 같은 이름·유형과 60초 안이면 안 싣는다.
 * 폼 정의 = createTeacherCheckinForm(엔진_폼리포트.js) · 구분 값 정본 = TEACHER_CHECKIN_TYPES. */
function sweepTeacherCheckinForm_(ss) {
  const src = ss.getSheetByName('출퇴근폼_응답');
  if (!src || src.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  const last = src.getLastRow();
  const from = Number(props.getProperty('출퇴근폼_포인터')) || 1;
  if (from > last) { props.setProperty('출퇴근폼_포인터', String(last)); return; } // 응답 시트 재생성 대비 클램프
  if (from >= last) return;
  const rows = src.getRange(from + 1, 1, last - from, 3).getValues(); // 타임스탬프·강사 이름·구분
  const width = Math.max(TC_NAME_COL, TC_TYPE_COL, TC_TIME_COL);
  const tc = ensureSheet(ss, 'teacher_checkins', skeletonHeadersOf_('teacher_checkins'));
  const recent = {}; // '이름|구분' → [ms] — 연타 자(60초). 꼬리 200행이면 오늘치는 충분하다(강사 1~6인)
  const tcLast = tc.getLastRow();
  if (tcLast >= 2) {
    const tail = Math.max(2, tcLast - 199);
    tc.getRange(tail, 1, tcLast - tail + 1, width).getValues().forEach(r => {
      const k = String(r[TC_NAME_COL - 1] || '').trim() + '|' + String(r[TC_TYPE_COL - 1] || '').trim();
      const d = r[TC_TIME_COL - 1], t = d instanceof Date ? d.getTime() : new Date(d).getTime();
      if (isFinite(t)) (recent[k] = recent[k] || []).push(t);
    });
  }
  const out = [];
  rows.forEach(r => {
    const ts = r[0] instanceof Date ? r[0] : new Date();
    const nm = String(r[1] || '').trim(), tp = String(r[2] || '').trim();
    if (!nm || TEACHER_CHECKIN_TYPES.indexOf(tp) === -1) return; // 구분 값은 둘뿐 — 그 밖은 싣지 않는다(indexOf('출근'/'퇴근') 판정을 오염시키지 않게)
    const k = nm + '|' + tp, t = ts.getTime();
    if ((recent[k] || []).some(x => Math.abs(x - t) <= 60000)) return; // 60초 이내 연타 = 한 건
    (recent[k] = recent[k] || []).push(t);
    const row = new Array(width).fill('');
    row[TC_NAME_COL - 1] = nm; row[TC_TYPE_COL - 1] = tp; row[TC_TIME_COL - 1] = ts;
    out.push(row);
  });
  if (out.length) tc.getRange(tc.getLastRow() + 1, 1, out.length, width).setValues(행소독_(out)); // [v9.157] 드롭다운 값이지만 폼 유래 직기입은 전부 이 통로다
  props.setProperty('출퇴근폼_포인터', String(last));
}

// [v9.49] 첨삭 '확인했어요' 정산 — Glide가 hw_feedback J열(학생확인·스크립트 불가침)에 기록하면 10분 스위프가 1회 +5P. — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md)
//   멱등 3중: ①K열 마킹 ②당일 point_logs 재조회(지급 후 마킹 전 크래시 대비 — expandHwBatch v9.31 패턴) ③DAILY_LIMIT 1회/일.
function sweepFeedbackAck_(ss) {
  const fb = ss.getSheetByName('hw_feedback');
  if (!fb || fb.getLastRow() < 2) return;
  const rows = fb.getRange(2, 1, fb.getLastRow() - 1, 11).getValues();
  const tz = ss.getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const valid = new Set();
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 4).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') valid.add(String(r[0]).trim());
  });
  const doneToday = new Set(); // 오늘 이미 지급된 학생(지급→마킹 사이 크래시 재시도 대비)
  const pl = ss.getSheetByName('point_logs');
  if (pl && pl.getLastRow() >= 2) pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => {
    if (r[1] && r[5] && String(r[3] || '') === '첨삭확인' &&
        Utilities.formatDate(asDate_(r[5]), tz, 'yyyy-MM-dd') === today) doneToday.add(String(r[1]).trim());
  });
  rows.forEach((r, i) => {
    const sid = String(r[1] || '').trim();
    if (!sid || !valid.has(sid)) return;
    if (!노출카드_(r[8])) return;   // I 상태: 검수 통과분만 · 판정 정본=노출카드_
    if (!String(r[9] || '')) return;       // J 학생확인: 아직 안 눌렀으면 대기
    if (String(r[10] || '')) return;       // K 포인트지급: 이미 지급
    // [리뷰 M2] 행 단위 지급→즉시 마킹 — 지급과 마킹 사이 크래시 창을 행 하나로 좁혀 날짜 경계를 넘는
    //   재지급을 사실상 차단. 순서는 v9.31 규칙 그대로(지급 먼저 → 마킹은 그 뒤, 실패 시 미마킹 재시도).
    if (!doneToday.has(sid)) {             // 같은 날 두 번째 확인은 마킹만 하고 지급 생략(DAILY_LIMIT 정합)
      doneToday.add(sid);
      appendPoints(ss, [[sid, AI_FEEDBACK_ACK_POINTS, '첨삭확인', '시스템']]);
    }
    fb.getRange(i + 2, 11).setValue('지급완료');
  });
}

// [v9.55] 이름+반 → student_id 매칭(순수 함수 — tests/safety.test.js가 직접 로드해 검증).
//   반이 '기타'/공란이면 이름만으로. 반을 지정했는데 그 반에 없으면 이름 전체로 폴백(반 오기재 구제 —
//   이름이 유일할 때만 확정되므로 안전). 호출부는 결과가 정확히 1명일 때만 매칭 확정.
function matchStudentsByNameClass_(students, name, cls) {
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  const nName = norm(name);
  if (!nName) return [];
  const nCls = norm(cls);
  const byName = students.filter(st => norm(st.n) === nName);
  if (!nCls || nCls === '기타') return byName.map(st => st.sid);
  const both = byName.filter(st => norm(st.c) === nCls);
  return (both.length ? both : byName).map(st => st.sid);
}

// [v9.55] 약점 메모 폼 응답 → student_errors 전개 — 시트 수기 입력은 그대로 두고 폼 통로를 추가.
//   포인터 = '약점메모폼_포인터'(sweepLeadForm_ 클램프 패턴). 매칭 실패(0명·동명이인)는 sid 공란+상태='미매칭'
//   으로 기록 — 소비처 3곳(반 브리핑 errByCls·수업 전 메일 errByClass·aiWeakMap_)이 전부 sid 공란을 스킵하므로
//   화면·메일 오염 0, 관리자 메일이 복구 경로(H열 '미매칭' 지우고 sid 채우면 다음 계산부터 반영)를 안내한다.
function sweepTeacherMemoForm_(ss) {
  /* [v9.299] 이름이 아니라 «폼 연결»로 찾는다 — 09-03 라이브에서 이 통로가 끊겨 있었다.
   *   app_state 약점메모폼ID 가 가리키는 폼은 `약점메모폼_응답_0724_2032` 에 쓰는데 여기서는
   *   `약점메모폼_응답` 을 열고 있었다(7/24 폼 두 번 만들기의 잔해). 까닭·자는 `폼응답탭_` 머리에. */
  let 메모폼ID = '';
  try { 메모폼ID = String((getState(ensureSheet(ss, 'app_state', ['key', 'value']), '약점메모폼ID') || {}).val || '').trim(); } catch (eF) {}
  const src = 폼응답탭_(ss, 메모폼ID, '약점메모폼_응답');
  if (!src || src.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  const last = src.getLastRow();
  /* [v9.299 · codex 배포검수 P1] 포인터는 «어느 탭을 어디까지 읽었나»다 — 탭이 갈리면 그 수가 뜻을 잃는다.
   *   구 탭에서 5까지 읽어 포인터=5 인 채 새 탭(머리글+1행 · last=2)으로 갈아타면 바로 아래 클램프가
   *   포인터를 2로 내리고 return 해 **그 1행을 영원히 안 읽는다**(다음 실행은 from>=last 로 또 return).
   *   위 `폼응답탭_` 이 탭을 갈아탈 수 있게 만든 순간 생긴 자리라 같은 판에서 함께 닫는다.
   *   ⇒ 읽은 탭 이름을 함께 적고, 갈렸으면 **새 탭을 처음부터** 읽는다(새 탭은 아직 한 줄도 안 읽었다). */
  const 읽은탭키 = '약점메모폼_포인터탭';
  const 지금탭 = src.getName();
  const 이전탭 = props.getProperty(읽은탭키) || '';
  /* [codex 재검수 P1] 포인터는 **표식이 지금 탭과 정확히 같을 때만** 믿는다.
   *   첫 판(표식 없음)에 「이전탭 && …」로 가드하면 바로 그 순간을 통과시킨다 — 라이브에는 옛 탭
   *   기준 숫자가 이미 있을 수 있고(포인터 5 · 새 탭 last 2), 그러면 아래 클램프가 그 행을 영원히
   *   건너뛴다. 표식이 없으면 «어느 탭의 수인지 모른다» → 모르는 수는 안 쓴다.
   *   ⚠ 대가 = 표식이 없는 첫 실행에서 그 탭을 처음부터 다시 읽는다(중복 가능). **영구 누락보다
   *   중복이 낫고**, 09-03 라이브 실측에서 양쪽 응답 탭이 모두 0행이라 지금 무는 손해는 없다. */
  let from = (이전탭 === 지금탭) ? (Number(props.getProperty('약점메모폼_포인터')) || 1) : 1;
  props.setProperty(읽은탭키, 지금탭);
  if (from > last) { props.setProperty('약점메모폼_포인터', String(last)); return; }
  if (from >= last) return;
  const tz = ss.getSpreadsheetTimeZone();
  const rows = src.getRange(from + 1, 1, last - from, 6).getValues(); // 타임스탬프·강사·반·학생이름·유형·메모
  const pf = ss.getSheetByName('profiles');
  const students = [];
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') students.push({ sid: String(r[0]).trim(), n: String(r[1] || ''), c: String(r[4] || '') });
  });
  const se = ensureSheet(ss, 'student_errors', ['날짜', 'student_id', '반', '유형', '메모', '입력자', 'created_at', '상태']);
  const out = [], miss = [];
  rows.forEach(r => {
    const ts = r[0] instanceof Date ? r[0] : new Date();
    const name = String(r[3] || '').trim();
    const memo = String(r[5] || '').trim();
    if (!name || !memo) return; // 필수 문항이라 실질 발생 없음 — 빈 응답 방어만
    const cands = matchStudentsByNameClass_(students, name, String(r[2] || ''));
    const ok = cands.length === 1;
    const sid = ok ? cands[0] : '';
    const cls = ok ? ((students.find(s => s.sid === sid) || {}).c || String(r[2] || '')) : String(r[2] || '');
    out.push([dstr(ts, tz), sid, cls, String(r[4] || '기타'), memo, String(r[1] || '폼'), ts, ok ? '' : '미매칭']);
    if (!ok) miss.push('· ' + name + ' (' + (r[2] || '반 미상') + ') — 로스터 후보 ' + cands.length + '명 · 메모: ' + memo.slice(0, 40));
  });
  if (out.length) se.getRange(se.getLastRow() + 1, 1, out.length, 8).setValues(행소독_(out)); // [v9.157] 메모=강사 자유 서술
  props.setProperty('약점메모폼_포인터', String(last)); // [v9.74·리뷰 M5 동반 수리] 적재 직후·메일 전 마감 — 메일 실패 시 중복 적재 차단
  if (miss.length) adminMail('[SYNK] 🧩 약점 메모 미매칭 ' + miss.length + '건',
    miss.join('\n') + '\n\nstudent_errors 시트에서 해당 행의 student_id를 채우고 상태(H열)의 "미매칭"을 지우면 다음 계산부터 브리핑·AI에 반영됩니다.');
}

// [v9.74] 학업 기록 폼 응답 → academic_log 전개 — 약점 메모 폼(v9.55) 패턴 그대로(포인터·클램프·미매칭 통보).
//   값 검증: 급수 1~6 · 모의 0~100 — 범위 밖은 기록하지 않고 메일로만(차트·리포트 원본 오염 방지, 재제출 안내).
//   미매칭 이름은 sid 공란 + 비고 '미매칭:이름'으로 적재 — sid를 채우면 다음 계산부터 차트·월보에 반영.
function sweepAcademicForm_(ss) {
  const src = ss.getSheetByName('학업폼_응답');
  if (!src || src.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  const last = src.getLastRow();
  const from = Number(props.getProperty('학업폼_포인터')) || 1;
  if (from > last) { props.setProperty('학업폼_포인터', String(last)); return; }
  if (from >= last) return;
  const tz = ss.getSpreadsheetTimeZone();
  const rows = src.getRange(from + 1, 1, last - from, 7).getValues(); // 타임스탬프·강사·반·학생이름·유형·값·비고
  const pf = ss.getSheetByName('profiles');
  const students = [];
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') students.push({ sid: String(r[0]).trim(), n: String(r[1] || ''), c: String(r[4] || '') });
  });
  const al = ensureSheet(ss, 'academic_log', ACADEMIC_LOG_HEADERS); // [v9.239] 헤더 정본 공유(엔진_셋업확장)
  let seq = 0; // AL 채번 — 기존 최대 번호를 이어간다(수기 입력 AL001~ 예시와 공존)
  if (al.getLastRow() >= 2) al.getRange(2, 1, al.getLastRow() - 1, 1).getValues().forEach(r => {
    const m = /^AL(\d+)$/.exec(String(r[0] || '')); if (m) seq = Math.max(seq, Number(m[1]));
  });
  const out = [], miss = [];
  rows.forEach(r => {
    const ts = r[0] instanceof Date ? r[0] : new Date();
    const name = String(r[3] || '').trim();
    if (!name) return; // 필수 문항이라 실질 발생 없음 — 빈 응답 방어만
    const typRaw = String(r[4] || '');
    const typ = typRaw.indexOf('급수') > -1 ? 'level' : 'mock';
    const valStr = String(r[5] == null ? '' : r[5]).trim();
    const val = Number(valStr.replace(/[^\d.\-]/g, '')); // [리뷰 M3] 음수 부호 보존 — '-5'가 '5'로 세탁돼 통과하지 않게
    const okVal = valStr !== '' && !isNaN(val) &&
      (typ === 'level' ? (Number.isInteger(val) && val >= 1 && val <= 6) : (val >= 0 && val <= 100));
    if (!okVal) { miss.push('· ' + name + ' — 값 "' + valStr + '"이(가) ' + (typ === 'level' ? '급수(1~6)' : '모의점수(0~100)') + ' 범위를 벗어나 기록하지 않았습니다. 폼으로 재제출해 주세요'); return; }
    const cands = matchStudentsByNameClass_(students, name, String(r[2] || ''));
    const ok = cands.length === 1;
    const sid = ok ? cands[0] : '';
    seq++;
    const memo = String(r[6] || '').trim();
    out.push(['AL' + String(seq).padStart(3, '0'), sid, dstr(ts, tz), typ, val,
      memo + (ok ? '' : (memo ? ' · ' : '') + '미매칭:' + name), String(r[1] || '폼')]);
    if (!ok) miss.push('· ' + name + ' (' + (r[2] || '반 미상') + ') — 로스터 후보 ' + cands.length + '명 · academic_log에 sid 공란으로 적재됨(student_id를 채우면 다음 계산부터 차트·월보 반영)');
  });
  if (out.length) al.getRange(al.getLastRow() + 1, 1, out.length, 7).setValues(행소독_(out)); // [v9.157] 비고=강사 자유 서술
  props.setProperty('학업폼_포인터', String(last)); // [리뷰 M5] 적재 직후·메일 전 마감 — 메일 실패가 같은 응답을 재적재(모의 Δ 왜곡)하지 않게
  if (miss.length) adminMail('[SYNK] 📊 학업 기록 확인 필요 ' + miss.length + '건', miss.join('\n'));
}

// [v9.89] 결석 연락 폼 응답 → absence_followup 마감(약점 메모 폼 계보: 포인터·클램프·미매칭 통보).
//   ① 열린 행(연락여부 빈칸 · 결석일 ≤ 응답일)을 전부 마감한다 — 전화 한 통이 밀린 결석 여러 건을 함께
//      덮는 현실 반영이자, 오래된 1건이 영원히 남아 매일 알림을 부르는 실패 모드 차단.
//   ② 열린 행이 없으면 버리지 않고 '수동기록' 행으로 적재한다. 이 행이 쌓인다는 것 자체가
//      "출석 1탭이 안 들어와 결석 감지가 안 열렸다"는 신호 — 강사의 연락 노력도 보존하고 구멍도 드러낸다.
function sweepAbsenceForm_(ss) {
  const src = ss.getSheetByName('결석폼_응답');
  if (!src || src.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  const last = src.getLastRow();
  const from = Number(props.getProperty('결석폼_포인터')) || 1;
  if (from > last) { props.setProperty('결석폼_포인터', String(last)); return; } // 응답 시트 재생성 대비 클램프
  if (from >= last) return;
  const tz = ss.getSpreadsheetTimeZone();
  const rows = src.getRange(from + 1, 1, last - from, 7).getValues(); // 타임스탬프·강사·반·학생이름·연락수단·결과·메모
  const pf = ss.getSheetByName('profiles');
  const students = [];
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') students.push({ sid: String(r[0]).trim(), n: String(r[1] || ''), c: String(r[4] || '') });
  });
  const W = ABSENCE_FOLLOWUP_HEADERS.length;
  const sh = ensureSheet(ss, 'absence_followup', ABSENCE_FOLLOWUP_HEADERS);
  const cur = sh.getLastRow() >= 2 ? sh.getRange(2, 1, sh.getLastRow() - 1, W).getValues() : [];
  const add = [], miss = [];
  rows.forEach(r => {
    const ts = r[0] instanceof Date ? r[0] : new Date();
    const dayStr = dstr(ts, tz);
    const stamp = dayStr + ' ' + Utilities.formatDate(ts, tz, 'HH:mm');
    const name = String(r[3] || '').trim();
    if (!name) return; // 필수 문항이라 실질 발생 없음 — 빈 응답 방어만
    const method = String(r[4] || '기타');
    const note = [String(r[5] || '').trim(), String(r[6] || '').trim()].filter(Boolean).join(' · ');
    const cands = matchStudentsByNameClass_(students, name, String(r[2] || ''));
    const ok = cands.length === 1;
    const sid = ok ? cands[0] : '';
    // 열린 행(연락여부 빈칸 · 결석일 ≤ 응답일)을 전부 마감. recent = 유예 창 안에 이미 감지된 행이 있었는가
    //   — 수업 규칙 「결석자 복귀」은 "2회 연속이면 전화"라 같은 학생에 두 번째 연락이 정상적으로 들어온다. 그때 새 행을
    //   만들면 결석 1건이 2건으로 세어져 복귀율 분모가 부풀므로, 새 행 대신 최근 행의 비고에 덧붙인다.
    let closed = 0, recentIdx = -1;
    if (sid) cur.forEach((c, ci) => {
      if (String(c[1] || '').trim() !== sid) return;
      const cd = dstr(c[0], tz);
      if (cd > dayStr) return;                        // 응답일보다 나중의 결석은 이 연락으로 덮을 수 없다
      if (Math.round((new Date(dayStr + 'T00:00:00') - new Date(cd + 'T00:00:00')) / 86400000) <= ABSENCE_RETURN_DAYS &&
        (recentIdx < 0 || cd >= dstr(cur[recentIdx][0], tz))) recentIdx = ci;
      if (String(c[5] || '').trim()) return;          // 이미 마감된 행은 건드리지 않는다(첫 연락 시각 보존)
      c[5] = 'O'; c[6] = stamp; c[7] = method;
      c[9] = [String(c[9] || '').trim(), note].filter(Boolean).join(' / ');
      closed++;
    });
    if (!closed && recentIdx >= 0) { // 추가 연락 — 행을 늘리지 않고 기록만 덧붙인다(분모 보호)
      cur[recentIdx][9] = [String(cur[recentIdx][9] || '').trim(), '추가연락 ' + stamp + ' ' + method + (note ? ' · ' + note : '')].filter(Boolean).join(' / ');
    } else if (!closed) {
      add.push([dayStr, sid, String(r[2] || ''), String(r[1] || '폼'), '', 'O', stamp, method, '',
        [ok ? '수동기록(결석 감지 행 없음 — 출석 1탭 확인 필요)' : '미매칭:' + name, note].filter(Boolean).join(' / ')]);
    }
    if (!ok) miss.push('· ' + name + ' (' + (r[2] || '반 미상') + ') — 로스터 후보 ' + cands.length + '명 · absence_followup에 sid 공란으로 적재됨(student_id를 채우면 다음 밤 복귀 판정·집계에 반영)');
    else if (!closed && recentIdx < 0) miss.push('· ' + name + ' (' + (r[2] || '반 미상') + ') — 연락 기록은 남겼으나 대응하는 결석 감지 행이 없습니다. 그 반의 출석 1탭이 그날 들어왔는지 확인하세요(1탭이 없으면 결석 판정 자체가 안 열립니다)');
  });
  if (cur.length) writeIfChanged(sh, 2, 1, cur);                                    // 마감 반영(변경 없으면 쓰기 0)
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, W).setValues(행소독_(add)); // [v9.157] 갱신(writeIfChanged)만 소독되고 신규 append는 무방비였다 — 한 함수 안에서 방어가 갈리던 자리
  props.setProperty('결석폼_포인터', String(last)); // 적재 직후·메일 전 마감 — 메일 실패가 같은 응답을 재적재하지 않게
  if (miss.length) adminMail('[SYNK] 🔁 결석 연락 기록 확인 필요 ' + miss.length + '건', miss.join('\n'));
}

// [v9.63] 첨삭 품질 게이트(순수 함수 — tests/safety.test.js가 직접 로드해 검증) — 무인 발행의 안전판.
//   구조화 출력이 "형태"는 보장해도 "내용"은 보장 못 한다: 빈칸·언어 뒤바뀜(몽골어 칸에 한국어만)·
//   사과/AI 자기언급·브랜드 금칙어(synk-brand 부정 금지)·형식 잔재를 기계로 거른다.
//   통과 → 즉시 '노출'(무인) / 미달 → '격리:사유'로 사람 확인 대기. 오탐(정상 카드 격리)은 메일 링크로
//   복구 가능하지만 미탐(불량 카드 노출)은 학생에게 직행하므로, 규칙은 고정밀 신호만 쓴다(애매하면 통과).
function fbQualityGate_(card, srcText) {
  const f = {
    corrected: String(card && card.corrected || '').trim(),
    point_mn: String(card && card.point_mn || '').trim(),
    praise: String(card && card.praise || '').trim(),
    mission: String(card && card.mission || '').trim()
  };
  const src = String(srcText || '').trim();
  if (!f.corrected) return { ok: false, reason: '빈칸:고친문장' };
  if (!f.point_mn) return { ok: false, reason: '빈칸:오늘의포인트' };
  if (!f.praise) return { ok: false, reason: '빈칸:칭찬' };
  if (!f.mission) return { ok: false, reason: '빈칸:다음미션' };
  // 언어 검증 — 오늘의포인트=몽골어(키릴 필수), 칭찬·미션=한국어(한글 필수).
  // 고친문장은 한글 필수이되, 무의미 제출문을 원문 그대로 되돌린 경우(프롬프트 규칙 ⑤)만 예외.
  if (!/[Ѐ-ӿ]/.test(f.point_mn)) return { ok: false, reason: '몽골어없음:오늘의포인트' };
  if (!/[가-힣]/.test(f.praise)) return { ok: false, reason: '한글없음:칭찬' };
  if (!/[가-힣]/.test(f.mission)) return { ok: false, reason: '한글없음:다음미션' };
  if (!/[가-힣]/.test(f.corrected) && f.corrected !== src) return { ok: false, reason: '한글없음:고친문장' };
  /* [v9.223] 옛 글자(한자·가나) — 위 세 줄과 **같은 축**이다(어느 문자로 쓰였나). 4칸 전부 학생이 읽는다.
   *   🔑 여기서 막으면 처분이 «격리»다 — 행은 그대로 적재되니 수집(엔진 재료)은 안 잃고 학생에게만 안 나간다.
   *      형제 talk 은 같은 자리에서 «행 버림»을 골랐는데, 거긴 격리 칸이 없어 그것이 유일한 선택이었다.
   *   ⚠ 사유에 그 글자를 싣지 않는다(`U+XXXX` 뿐) — 시트 칸이 곧 다음 사람이 읽는 글이다(F298). */
  const 옛 = 옛글자걸림_(f);
  if (옛) return { ok: false, reason: '옛글자:' + 옛.칸 + ':' + 옛.짚음 };
  // 길이 상한 — "최소 수정·1~2문장" 규격의 수 배를 넘으면 폭주(설명문 유입)로 본다. 하한은 두지 않는다(한 단어 교정도 정당).
  if (f.corrected.length > Math.max(300, src.length * 2)) return { ok: false, reason: '길이초과:고친문장' };
  if (f.point_mn.length > 500) return { ok: false, reason: '길이초과:오늘의포인트' };
  if (f.praise.length > 300) return { ok: false, reason: '길이초과:칭찬' };
  if (f.mission.length > 300) return { ok: false, reason: '길이초과:다음미션' };
  const all = f.corrected + '\n' + f.point_mn + '\n' + f.praise + '\n' + f.mission;
  // [v9.65 리뷰 H1] 메타 발언·사과 검사는 AI가 지어내는 칸만 — corrected는 학생 원문 기반이라 사과 단원 숙제
  //   ("늦어서 죄송합니다")·인공지능 주제 숙제가 정당하게 담긴다(금칙어 검사와 같은 원칙). 형식 잔재는 4칸 전체.
  const gen = f.point_mn + '\n' + f.praise + '\n' + f.mission;
  // 🔴 정규식 안 따옴표는 유니코드 이스케이프로 적는다(맨 ' → \u0027 · 매칭 동작 동일)
  //   — tests/safety.test.js 「[v9.57] 톱레벨 크로스파일 참조 금지」의 추출기가 정규식을 몰라 맨 따옴표를 문자열 시작으로 읽는다(이 줄 뒤가 검사에서 사라졌었다).
  if (/죄송|미안하지만|AI로서|인공지능|as an AI|I can(?:no|\u0027)t|도와드릴 수 없|답변할 수 없/i.test(gen)) return { ok: false, reason: '메타문구' };
  if (all.indexOf('```') !== -1 || all.indexOf('{"') !== -1) return { ok: false, reason: '형식잔재' };
  // 브랜드 금칙어(synk-brand "부정 금지") — 학생에게 직접 읽히는 격려 칸(칭찬·미션)만 검사.
  //   고친문장(학생 원문 기반)·오늘의포인트(몽골어 설명)는 제외 — 자기 서술·문법 설명까지 막는 오탐 방지.
  const banned = ['패배', '실패', '불운', '하락', '부족', '늦었'];
  const kor = f.praise + '\n' + f.mission;
  for (let i = 0; i < banned.length; i++) {
    if (kor.indexOf(banned[i]) !== -1) return { ok: false, reason: '금칙어:' + banned[i] };
  }
  return { ok: true, reason: '' };
}

/* [v9.187] 첨삭 시스템 프롬프트 — 상수로 뽑은 이유는 재사용이 아니라 **버전을 기계가 계산하게** 하기 위해서다
 * (talk의 TALK_SYSTEM_PROMPT와 같은 규약 · 인라인으로 되돌리면 prompt_ver가 변경을 못 본다). */
const FB_SYSTEM_PROMPT = 'SYNK LAB(몽골 울란바토르, 뇌과학 기반 게임화 한국어 학원)의 숙제 첨삭 선생님. 학생이 쓴 한국어 문장을 교정한다. ' +
  '학생의 급수(1~6, 0=미정)에 맞춰 어휘 난도를 조절하고, 따뜻하되 과장 없는 존댓말을 쓴다. ' +
  // [v9.63] 무인 발행 규칙 — 검수 없이 학생에게 직행하므로 출력 규격을 여기서 고정(기계 게이트 fbQualityGate_와 쌍)
  '규칙: ①point_mn은 반드시 몽골어(키릴 문자)로 쓰고 한국어 문법 용어만 괄호 병기 ②praise·mission은 한국어 ' +
  '③"패배·실패·부족·늦었다" 같은 부정 단어 금지 — 같은 내용도 성장 프레임("~하면 더 강해져요")으로 말한다 ' +
  '④사과·자기 언급(AI)·메타 발언 금지, 4칸 내용만 채운다 ⑤제출문이 한국어 문장이 아니면(무의미 문자·다른 언어만) ' +
  'corrected에는 원문을 그대로 두고, praise는 제출한 행동 자체를 격려하고, mission은 한국어 한 문장 도전을 유도한다.';

// [v9.206] 첨삭 사용자 메시지 틀 — 이름을 싣지 않는다(방향 불변식 4 · docs/제품방향.md:62 — 식별자는 벤더로 안 나간다).
//   산출 4칸(corrected·point_mn·praise·mission)에 이름 자리가 없어 품질 축이 없고, 틀도 답을 바꾸므로 지문(fbPromptVer_)에 든다.
const FB_USER_TEMPLATE = '급수: {급수}\n제출 문장:\n{제출문}';

/* [v9.187] 첨삭 prompt_ver — talkPromptVer_와 같은 규약(손 번호 금지 · 지문 8자리).
 * 교정문은 모델 출력물이라, 프롬프트·모델이 바뀌면 「학생이 어려워한 것」과 「그때 우리 교정이 나빴던 것」이
 * 한 덩어리로 섞인다 — 지문이 있어야 2년치 병렬쌍을 층으로 가른다. 무엇이 답을 바꾸는가 = 시스템 프롬프트 + 모델.
 * (구조화 schema 서술도 답에 영향을 주지만 talk와 같은 한계로 지문 밖이다 — 지문의 뜻은 「언제 갈렸는가」다.)
 * ⚠ 톱레벨 계산 금지 — AI_FEEDBACK_MODEL은 Code.js에 있고 라이브 파일 로드 순서가 보장되지 않는다. */
function fbPromptVer_() {
  const raw = FB_SYSTEM_PROMPT + '|user=' + FB_USER_TEMPLATE + '|model=' + (typeof AI_FEEDBACK_MODEL === 'undefined' ? '?' : AI_FEEDBACK_MODEL);
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw, Utilities.Charset.UTF_8);
  return d.map(b => ((b & 0xFF) + 0x100).toString(16).slice(1)).join('').slice(0, 8);
}

/* [v9.187] 숙제ID → 문항 본문(contents A=ID · B='homework' · D=본문). 첨삭 행에 문항 **텍스트**를 스냅샷하는 재료 —
 * 엔진_수집.js 머리의 원칙 2(「ID만 저장하면 2년 뒤 해석 불능」)를 quiz_log만 지키고 hw_feedback은 어기고 있었다.
 * 배치당 최대 1회 지연 로드(숙제ID 있는 행이 하나도 없는 밤에는 읽기 0). */
function hwQuestionMap_(ss) {
  const map = {};
  const ct = ss.getSheetByName('contents');
  if (ct && ct.getLastRow() >= 2) ct.getRange(2, 1, ct.getLastRow() - 1, 4).getValues().forEach(r => {
    if (String(r[1] || '') === 'homework' && r[0]) map[String(r[0]).trim()] = String(r[3] || '');
  });
  return map;
}

/* [v9.198] 강의 한줄요약 → 첨삭 대기줄. 엔진도달 전수감사 §4 ㉡ — `lecture_views` F열은 **쌓기만 하고
 *   읽는 코드가 0**이었다(「수집만 있고 도달 0」의 교과서 형태). 새 통로를 파지 않고 숙제와 같은 줄에 세운다:
 *   둘 다 「학생이 쓴 짧은 한국어 문장」이고, 이 저장소에서 엔진까지 실제로 닿는 선은
 *   hw_feedback → 강사 정답 모음 표본(goldenSampleWeekly_) → 평가 픽스처(골든픽스처_) **하나뿐**이며
 *   그 재료가 정확히 원문↔교정 병렬쌍이다. 그 줄에 안 실리면 이 텍스트는 영원히 시트에만 남는다.
 *
 * 🔑 **포인터가 아니라 hw_feedback 실적재분으로 중복을 막는다.** 이름 매칭에 실패한 행은 student_id가
 *   빈 채로 쌓이고 나중에 사람이 채우는데(sweepLectureForm_ 통보 메일), 포인터 방식이면 배치가 이미 그 행을
 *   지나쳐 **영영 안 걸린다** — 미매칭이 곧 영구 유실이 된다. 재적재 방지는 실제로 적재된 것을 보고 판정한다.
 * ⚠ 중복 키 = student_id + 제출일 + 강의ID. 제출일은 dstr 기본이라 **날짜 단위**다 — 같은 날 같은 강의의
 *   재제출은 1건으로 본다(같은 것을 고쳐 낸 것으로 보는 쪽이 카드 2장보다 낫다). 다른 날이면 각각 걸린다. */
function 강의요약대기_(ss, tz) {
  const vw = ss.getSheetByName('lecture_views');
  if (!vw || vw.getLastRow() < 2) return [];
  const cand = [];
  vw.getRange(2, 1, vw.getLastRow() - 1, LECTURE_VIEW_HEADERS.length).getValues().forEach(function (r) {
    const sid = String(r[1] || '').trim(), lid = String(r[4] || '').trim(), text = String(r[5] || '').trim();
    if (sid && lid && text) cand.push({ sid: sid, lid: lid, text: text.slice(0, 2000), d: dstr(r[0], tz) });
  });
  if (!cand.length) return []; // 후보가 없는 밤에는 hw_feedback·lectures 읽기 0
  const done = {};
  const fb = ss.getSheetByName('hw_feedback');
  /* ⚠ 폭을 물리 열수로 클램프한다 — 이 대기줄은 `hwFeedbackEnsureCols_`(15열 증분) **앞**에서 돌아서,
   *   구 11열 시트를 만나면 12열 요구가 그 자리에서 예외를 던져 **첨삭 배치 전체가 죽는다**.
   *   L열이 없으면 '강의:' 행도 있을 수 없으므로 빈 대조표가 정답이다. */
  const fbW = fb ? Math.min(12, fb.getLastColumn()) : 0;
  if (fb && fb.getLastRow() >= 2 && fbW >= 12) fb.getRange(2, 1, fb.getLastRow() - 1, fbW).getValues().forEach(function (r) {
    const 출처 = String(r[11] || '');
    if (출처.indexOf(LECTURE_SRC_PREFIX) === 0) done[String(r[1] || '').trim() + '\t' + dstr(r[2], tz) + '\t' + 출처] = 1;
  });
  const 제목 = {}; // 강의ID → 제목. lectures는 개정되므로 **그날의 제목**을 행에 박는다(ID만 남으면 해석 불능)
  const lec = ss.getSheetByName('lectures');
  if (lec && lec.getLastRow() >= 2) lec.getRange(2, 1, lec.getLastRow() - 1, LECTURE_HEADERS.length).getValues()
    .forEach(function (r) { if (r[0]) 제목[String(r[0]).trim()] = String(r[4] || ''); });
  const out = [];
  cand.forEach(function (c) {
    const hwId = LECTURE_SRC_PREFIX + c.lid;
    if (done[c.sid + '\t' + c.d + '\t' + hwId]) return;
    done[c.sid + '\t' + c.d + '\t' + hwId] = 1; // 같은 배치 안의 동일 행 중복(시트 내 중복 제출)도 1건으로
    out.push({ ts: c.d, sid: c.sid, text: c.text, hwId: hwId, reDo: '', 문항: 제목[c.lid] || '', ptr: 0 });
  });
  return out;
}

// [v9.49] 야간 AI 첨삭 배치 — 숙제폼 제출분을 Claude API로 4칸 카드(고친문장·오늘의포인트MN·칭찬·다음미션)로.
//   비동기 설계 확정(2026-07-21 유호): 실시간 챗은 update 예산·지연으로 불성립, "다음날 아침 도착"형만 성립.
//   실패 시 그 행부터 포인터 유지 → 다음 밤 재시도. 상한·시간예산 가드로 6분 강제종료 안전.
//   [v9.198] 입력이 2원이다(숙제폼 + 강의 한줄요약). 카드 생성·품질 게이트·적재·오류 분류를 두 벌 적으면
//   갈라지므로 **통로는 하나**고, 소스는 대기줄을 만들 때만 갈린다. 숙제가 앞이라 상한(AI_FEEDBACK_MAX_PER_RUN)을
//   강의요약이 먼저 먹는 일이 없다 — 굶는 쪽은 항상 뒤에 붙은 요약이다.
function aiFeedbackBatch_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('CLAUDE_API_KEY');
  if (!apiKey) return; // 키 미설정 = 기능 OFF (NOTION_TOKEN 패턴)
  const tz = ss.getSpreadsheetTimeZone();
  /* 대기줄 한 줄의 모양 = { ts, sid, text, hwId, reDo, 문항, ptr }.
   *   ptr = 처리 성공 시 전진시킬 **숙제폼 포인터 값**이고, 강의요약은 0(포인터를 안 쓴다 — 위 주석).
   *   문항 = 강의요약은 제목 스냅샷을 이미 들고 오고, 숙제는 null이라 루프가 숙제ID로 지연 로드한다. */
  const q = [];
  const src = ss.getSheetByName('숙제폼_응답');
  if (src && src.getLastRow() >= 2) {
    const last = src.getLastRow();
    const from = Number(props.getProperty('숙제폼_포인터')) || 1;
    if (from > last) props.setProperty('숙제폼_포인터', String(last)); // 시트가 줄었다(수동 정리) — 클램프만 하고 계속
    else if (from < last) {
      /* [v9.138] 3열 → 5열. 뒤 2칸(숙제ID·재작성원본)은 migrateHwFormV9138 이전 폼에는 없어 빈칸으로 온다 —
       *   getRange는 시트 폭까지만 요구하면 되지만, 폼이 아직 4·5열을 안 만들었을 수 있으므로 물리 폭으로 클램프한다
       *   (없는 열을 요구하면 배치 전체가 예외로 죽는다). 빈칸은 그대로 빈칸으로 적재된다 — 구 제출분은 문항 연결이 없는 게 사실이다. */
      const wSrc = Math.min(5, src.getLastColumn());
      src.getRange(from + 1, 1, last - from, wSrc).getValues().forEach(function (r, i) { // 타임스탬프·학생ID·숙제 문장·[숙제ID]·[재작성원본]
        q.push({ ts: r[0] instanceof Date ? r[0] : new Date(), sid: String(r[1] || '').trim(),
          text: String(r[2] || '').trim().slice(0, 2000), // 폭주 입력 상한
          hwId: String(r[3] || '').trim().slice(0, 20),   // [v9.138] 어느 과제에 대한 답인지(구 제출분은 빈칸)
          reDo: String(r[4] || '').trim().slice(0, 40),   // [v9.138] 재작성이면 원본 첨삭 id(FB…) — 3단 데이터의 연결 고리
          문항: null, ptr: from + i + 1 });
      });
    }
  }
  Array.prototype.push.apply(q, 강의요약대기_(ss, tz)); // [v9.198] ㉡ 읽기 배선 — 숙제 뒤에 붙인다(상한 우선순위)
  if (!q.length) return;
  // [v9.125] 리허설은 배치 입구에서 통째로 차단 — 구 방식(callClaudeFeedback_ throw)은 첫 행에서 break라
  //   "차단 1건"만 남아 대기량이 안 보였고, permanent로 올리면 반대로 hw_feedback에 '오류' 행이 실적재되고
  //   포인터가 실전진해 진짜 첨삭이 영영 안 되는 함정이 있다. 입구 차단 = 시트·포인터 불변 + 대기량 보고.
  if (isRehearsal_()) { rehearsalNote_('AI 첨삭 배치: 대기 ' + q.length + '건 전량 차단(비용 0·포인터·시트 불변)'); return; }
  const info = {}; // sid → { name, lv(급수 BO67 — 설명 난도 조절) }
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 67).getValues().forEach(r => {
    if (r[0] && r[3] === 'student') info[String(r[0]).trim()] = { name: r[1] || r[0], lv: Number(r[66]) || 0 };
  });
  const fb = ensureSheet(ss, 'hw_feedback', HW_FEEDBACK_HEADERS); // [v9.138] 헤더 하드코딩 2벌 → 단일 정본(시트 골격과 갈라지던 것)
  hwFeedbackEnsureCols_(fb); // [v9.138] 기존 11열 시트를 15열로 증분 — 없으면 append가 뒤 4칸을 조용히 버린다
  const hwTpl = String(getState(ensureSheet(ss, 'app_state', ['key', 'value']), '숙제폼재작성틀').val || ''); // 다시쓰기 링크 틀(미생성이면 빈칸)
  // [v9.187] 출처 2열 + 문항 스냅샷 재료 — talk 배치와 같은 규약(실행 1회 계산 · 배치 중엔 안 바뀐다)
  const model = typeof AI_FEEDBACK_MODEL === 'undefined' ? '' : AI_FEEDBACK_MODEL;
  const pver = fbPromptVer_();
  let hwQ = null; // 숙제ID → 문항 본문 — 숙제ID 있는 행을 처음 만날 때 1회 로드(없는 밤엔 읽기 0)
  const t0 = Date.now();
  const AI_BUDGET_MS = 120000; // [리뷰 H1] nightJobs 뒤쪽에서 돌므로 자체 예산 2분 — 완주 마커·후속 잡을 굶기지 않는다
  let made = 0, held = 0, permFails = 0, lastErr = ''; // [v9.63] held=품질 게이트 격리 수
  let rwPrep = null, rwPaid = 0; // [v9.147] 재작성 보상 — 재작성 제출이 하나도 없는 밤에는 준비조차 하지 않는다(읽기 0)
  const badSid = [], badLec = []; // [v9.67] profiles에 없는 sid 수집 — 무통보 드롭 결함 수리(하루 1회 dedup 통보) · [v9.198] 소스별로 나눈다(메일이 「어느 응답 탭을 보라」를 말한다)
  /* [v9.198] 포인터 전진은 **그 줄이 숙제폼에서 왔을 때만**. 강의요약(ptr=0)이 숙제폼 포인터를 밀면
   *   그 사이 도착한 숙제 제출이 통째로 건너뛰어진다 — 복구 불가능한 조용한 유실이다. */
  const 전진_ = function (it) { if (it.ptr) props.setProperty('숙제폼_포인터', String(it.ptr)); };
  for (let i = 0; i < q.length; i++) {
    if (made >= AI_FEEDBACK_MAX_PER_RUN || Date.now() - t0 > AI_BUDGET_MS) break;
    const it = q[i];
    const sid = it.sid, text = it.text, hwId = it.hwId, reDo = it.reDo, ts = it.ts;
    const stu = info[sid];
    if (!sid || !stu || !text) { if (sid && !stu) (it.ptr ? badSid : badLec).push(sid); 전진_(it); continue; } // 무효 행은 건너뛰고 전진 — [v9.67] 미등록 sid만 통보 수집(빈 ID·빈 문장은 폼 필수문항이라 실질 없음)
    // [v9.187] 문항 텍스트 스냅샷 — contents는 개정되므로 ID만으로는 2년 뒤 "무엇을 시켰는지"가 안 남는다.
    //   실패 행에도 실어야 하므로 try 밖에서 준비한다(재작성 행은 숙제ID가 비어 빈칸 — 원본 첨삭에서 조인).
    let 문항 = it.문항; // [v9.198] 강의요약은 강의 제목을 이미 들고 온다 — null 일 때만 숙제 문항을 지연 로드
    if (문항 === null) {
      if (hwId && !hwQ) hwQ = hwQuestionMap_(ss);
      문항 = hwId && hwQ ? (hwQ[hwId] || '') : '';
    }
    try {
      const card = callClaudeFeedback_(apiKey, stu, text);
      const gate = fbQualityGate_(card, text); // [v9.63] 무인 발행 안전판 — 미달 카드는 학생에게 안 나간다
      if (!gate.ok) held++;
      const fbId = 'FB' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd') + '-' + fb.getLastRow();
      // [v9.138] 🔒 학생 제출문·모델 출력에 셀 수식 인젝션 차단(상담AI 셀안전_ 재사용).
      //   같은 스프레드시트에 profiles(연락처·보호자)가 있어 `=IMPORTDATA(...&profiles!B2:B60)` 한 줄로 유출된다.
      fb.appendRow([fbId, sid,
        dstr(ts, tz), 셀안전_(text), 셀안전_(String(card.corrected || '')), 셀안전_(String(card.point_mn || '')),
        셀안전_(String(card.praise || '')), 셀안전_(String(card.mission || '')),
        gate.ok ? (AI_FEEDBACK_AUTOPUBLISH ? '노출' : '대기') : '격리:' + gate.reason, '', '',
        // [v9.138] 수집 4칸 — 다시쓰기URL은 **이 카드의 id**를 프리필해, 학생이 누르면 그 첨삭에 대한 2차 시도로 들어온다
        셀안전_(hwId), hwTagsClean_(card.error_tags), 셀안전_(reDo), hwRedoUrlOf_(hwTpl, sid, fbId),
        // [v9.187] 감사 4칸 — 문항 스냅샷·급수(제출 시점)·출처 2열(문항은 contents 소유 콘텐츠라 소독 불요 — quiz 스냅샷과 동일)
        // [v9.207] schema_ver — 이 행이 어느 계약 규격으로 쓰였는지 행 스스로 들고 있게(A-8 · 소급 불가)
        // [v9.315] 서명 2칸 — 발행경로는 **이 순간에만 참이다**(아래 `상태`는 사람이 덮어쓴다).
        //   확인자는 빈칸으로 둔다: 지금 카드를 만든 것은 사람이 아니라 배치라, 이름을 적으면 그것이 거짓이다.
        문항, Number(stu.lv) || 0, model, pver, SCHEMA_VER,
        gate.ok ? (AI_FEEDBACK_AUTOPUBLISH ? 발행경로_.무인 : 발행경로_.대기) : 발행경로_.격리, '']);
      made++;
      /* [v9.147] 재작성 보상 — **적재에 성공한 뒤에만** 판정한다(수집이 보상보다 앞선다).
       *   준비(hw_feedback·point_logs 각 1회 읽기)는 첫 재작성에서만 일어난다.
       *   ⚠ 여기서 참조하는 교정문은 **원본 첨삭(reDo)의 것**이지 방금 만든 카드의 것이 아니다 —
       *     "이번에 받은 교정"이 아니라 "지난번 교정을 보고 고쳐 썼는가"를 재는 것이 이 보상의 뜻이다. */
      if (reDo) {
        if (!rwPrep) rwPrep = 재작성준비_(ss, tz);
        if (재작성판정_(rwPrep, sid, text, reDo) === '지급') rwPaid++;
      }
      // [리뷰 H1] 성공분 즉시 포인터 전진 — 6분 하드킬(throw 없는 강제 종료)에도 중복 생성·중복 과금 0
      전진_(it);
      Utilities.sleep(300); // rate-limit 여유(syncToNotion_ 패턴)
    } catch (e) {
      if (e && e.permanent) {
        // [리뷰 M1] 영구 오류(refusal·잘림·파싱·4xx 요청결함) — 재시도해도 같은 결과라 '오류' 행으로 기록하고 건너뛴다(포이즌 필 차단)
        permFails++;
        // [v9.138] 첨삭이 실패해도 제출문·숙제ID·재작성 연결은 남긴다 — AI가 못 고쳤다고 학생이 쓴 문장까지 버릴 이유는 없다
        fb.appendRow(['FB' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd') + '-' + fb.getLastRow(), sid,
          dstr(ts, tz), 셀안전_(text), '', '', '', '', '오류:' + String(e.message || e).slice(0, 80), '', '',
          셀안전_(hwId), '', 셀안전_(reDo), '',
          문항, Number(stu.lv) || 0, model, pver, SCHEMA_VER,
          발행경로_.오류, '']); // [v9.187] 실패 행에도 감사 4칸 — 「어느 버전에서 실패가 몰렸나」의 단서 · [v9.207] schema_ver · [v9.315] 발행경로 = 오류(학생에게 안 나간 행 — 「모른다」와 갈라 둔다)
        전진_(it);
        continue;
      }
      lastErr = String(e && e.message ? e.message : e).slice(0, 200);
      break; // 실패 행부터 포인터 유지 → 다음 밤 재시도 (일시 오류: 429·5xx·네트워크·키 무효)
    }
  }
  재작성지급_(ss, rwPrep); // [v9.147] 지급은 배치 끝에 1회(appendPoints 락 경합·채번 부담 최소화)
  notifyDroppedSids_('숙제폼', badSid); // [v9.67]
  notifyDroppedSids_('강의폼', badLec); // [v9.198] 같은 결함 계급 — 라벨이 「어느 응답 탭에 원본이 있나」를 말한다
  if (rwPrep && (rwPaid || rwPrep.echo)) Logger.log('재작성 ' + rwPaid + '건 보상 · 에코 ' + rwPrep.echo + '건 무지급'); // [v9.147]
  if (made || permFails || lastErr) adminMail('[SYNK] 🤖 AI 첨삭 ' + made + '건 생성' + (held ? '(노출 ' + (made - held) + ' · 격리 ' + held + ')' : '') + (permFails ? ' · 오류 ' + permFails + '건' : '') + (lastErr ? ' · 중단됨' : ''), // [v9.65 리뷰 L2] 격리 있을 때 합산 오독 방지
    (made ? (AI_FEEDBACK_AUTOPUBLISH ? (made - held > 0 ? '게이트 통과 ' + (made - held) + '건은 앱에 바로 노출되었습니다.\n' : '') : "hw_feedback 시트에서 내용 확인 후 '상태'를 '노출'로 바꾸면 학생에게 공개됩니다(AI_FEEDBACK_AUTOPUBLISH=true면 이 단계 생략).\n") : '') +
    (held ? "🚧 품질 게이트 격리 " + held + "건 — 시트 '상태' 열의 '격리:사유'를 확인하고, 내용이 멀쩡하면 '노출'로 바꿔 공개하세요(같은 사유가 반복되면 알려주세요 · 오류사전 집계에는 " + (격리복구창_MS / 86400000) + "일 안의 복구만 실립니다 — 공개 자체는 언제든 됩니다).\n" : '') + // [v9.63] 무인 발행의 사람 백스톱 — 격리만 사람 눈 · [v9.212] 복구 창을 상수에서 파생(문구·판정 갈라짐 방지)
    (held ? "⚠ 단, 사유가 '옛글자:'로 시작하는 행은 예외입니다 — 눈에는 멀쩡한 문장으로 보여도 쓰면 안 되는 문자가 섞인 것이니 '노출'로 바꾸지 말고 알려주세요.\n" : '') + // [v9.224] 옛글자 격리는 육안 판별이 안 돼 「멀쩡하면 공개」 지시가 게이트를 되돌린다(리뷰 P1-2 · 가드 맹점 ③)
    ((held || (made && !AI_FEEDBACK_AUTOPUBLISH)) ? '📎 시트 바로가기: ' + ss.getUrl() + '#gid=' + (ss.getSheetByName('hw_feedback') ? ss.getSheetByName('hw_feedback').getSheetId() : 0) + '\n' : '') + // [v9.56] 메일 1클릭으로 I열 처리 · [v9.63] 격리 복구 공용
    (permFails ? "\n'오류:' 상태 행 " + permFails + '건은 같은 입력 재시도가 무의미해 건너뛰었습니다(hw_feedback에서 확인).' : '') +
    (lastErr ? '\n마지막 오류: ' + lastErr + '\n실패 지점부터 내일 밤 자동 재시도합니다.' : ''));
}

// [v9.49] Claude API 호출 — 구조화 출력(output_config.format json_schema)으로 4칸 스키마를 보장받는다.
//   비-200·refusal·text 블록 부재는 throw → 호출부가 중단·재시도. 모델·톤 규칙은 AI_FEEDBACK_MODEL 주석 참조.
function callClaudeFeedback_(apiKey, stu, text) {
  // [v9.120] 리허설 = 비용 0. throw로 올려야 호출부(aiFeedbackBatch_)의 오류 경로를 함께 리허설한다
  //   — null을 돌려주면 "정상 응답인데 내용이 빈 것"으로 흘러 포인터가 전진해 버린다.
  if (isRehearsal_()) { rehearsalNote_('AI 첨삭 callClaudeFeedback_ (차단·비용 0)'); throw new Error('리허설 모드: AI 호출 차단'); }
  /* [v9.138] error_tags 추가 — **같은 호출에 얹으므로 추가 API 비용이 없다.**
   *   구조: 학생에게 보이는 4칸(교정·포인트·칭찬·미션)은 그대로 두고, 집계용 축 하나를 나란히 받는다.
   *   왜 필요한가: point_mn은 몽골어 자연어 문장이라 3만 건이 쌓여도 "가장 많이 틀리는 오류 50"을 못 뽑는다.
   *   태그는 enum으로 묶어 어휘가 흩어지지 않게 한다(자유 문자열이면 같은 오류가 열 이름으로 갈린다). */
  const schema = {
    type: 'object', additionalProperties: false,
    required: ['corrected', 'point_mn', 'praise', 'mission', 'error_tags'],
    properties: {
      corrected: { type: 'string', description: '교정한 한국어 문장 — 원문을 최대한 살린 최소 수정. 틀린 곳이 없으면 원문 그대로' },
      point_mn: { type: 'string', description: '오늘의 포인트 딱 1개 — 가장 중요한 교정 이유를 몽골어 1~2문장으로(한국어 문법 용어는 괄호 병기). 여러 개 나열 금지' },
      praise: { type: 'string', description: '잘한 점 구체적 칭찬 1문장(한국어 존댓말) — 실제로 잘한 지점을 짚어서, 빈말 금지' },
      mission: { type: 'string', description: '다음 미션 1문장(한국어) — 오늘의 포인트를 써서 새 문장 하나를 만들게 유도' },
      error_tags: {
        type: 'array', maxItems: 4, items: { type: 'string', enum: HW_ERROR_TAGS },
        description: '이 제출문에서 실제로 발견한 오류 유형(최대 4개, 많이 틀렸어도 중요한 것부터). 틀린 곳이 없으면 ["오류없음"]. 집계용이므로 정확도만 본다(완곡화 금지) — 학생에게는 낱개가 아니라 최근 빈도 요약 한 줄로만 닿는다'
      }
    }
  };
  const body = {
    model: AI_FEEDBACK_MODEL,
    max_tokens: 4096, // 이 모델군은 적응형 사고가 기본 ON이고 사고 토큰이 max_tokens에 포함 — 1024면 JSON이 잘릴 수 있다
    system: FB_SYSTEM_PROMPT, // [v9.187] 상수 참조 — 인라인으로 되돌리면 prompt_ver(fbPromptVer_)가 변경을 못 본다
    messages: [{ role: 'user', content: FB_USER_TEMPLATE.replace('{급수}', String(stu.lv || '미정')).replace('{제출문}', () => text) }], // 함수 치환 — 제출문의 $ 패턴이 replace 특수문자로 새는 것 방지
    output_config: { format: { type: 'json_schema', schema: schema } }
  };
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(body), muteHttpExceptions: true
  });
  // [리뷰 M1] 오류 분류: permanent=같은 입력 재시도 무의미(행 건너뜀) / 그 외=일시(배치 중단 후 다음 밤 재시도)
  const permErr = msg => { const e = new Error(msg); e.permanent = true; return e; };
  const rc = res.getResponseCode();
  if (rc !== 200) {
    const e = new Error('Claude API ' + rc + ': ' + res.getContentText().slice(0, 200));
    e.permanent = (rc === 400 || rc === 404 || rc === 413 || rc === 422); // 요청 자체 결함 — 429·5xx·401은 일시 취급(전량 중단이 안전)
    throw e;
  }
  const j = JSON.parse(res.getContentText());
  AI사용_기록_('첨삭', j.usage);   // [T4] 아래 게이트들이 카드를 버려도 이 호출은 이미 과금됐다
  if (j.stop_reason === 'refusal') throw permErr('Claude 거부(refusal)');
  if (j.stop_reason === 'max_tokens') throw permErr('출력 잘림(max_tokens) — 사고 토큰 포함 한도 초과');
  const tb = (j.content || []).filter(b => b.type === 'text')[0]; // thinking 블록이 앞설 수 있어 type으로 선별
  if (!tb || !tb.text) throw permErr('응답에 text 블록 없음(stop_reason=' + j.stop_reason + ')');
  try { return JSON.parse(tb.text); } catch (e) { throw permErr('첨삭 JSON 파싱 실패: ' + String(tb.text).slice(0, 80)); }
}

/* ===================== [v9.50] 🎛️ AI 스튜디오 — 채택 17건 서버측 배선 =====================
 * 정본 목록 = docs/AI기능_아이디어뱅크_v1.md ✅확정 리스트. 원칙:
 *   ① 전부 야간/아침/월간 배치 — 학생·학부모는 읽기만(Glide update 소비 0~미미)
 *   ② CLAUDE_API_KEY 없으면 전부 0초 스킵 또는 템플릿 폴백 — 배포만으로는 아무 일도 안 일어남
 *   ③ 새 화면 0 — 기존 슬롯(운세 BE·퀴즈 CJ/CK·여정 BY·브리핑⑨·레이더)에 얹는다
 *   ④ 호출 수 상한(AI_STUDIO_MAX_CALLS)·시간 예산으로 비용·타임아웃 이중 가드 */

// [함께한날 막4] 장면 내레이터 — {n}=이름 {s}=장면번호 {g}=문형절 {d}=함께한 날. AI 없이 실데이터 결정론 조합.
//   규격: 사실만 · 남과 비교 0 · 재촉 0. (구 NARRATE_EVO 는 소비자 0 — 막6 소각 예정)
const NARRATE_SCENE = [
  '🧶 {n}, {g}함께한 날 {d}일 — 오늘 새 장면이 열렸어요',
  '✨ {n}의 가이드가 한 걸음 가까이 왔어요 — 함께한 날 {d}일의 기록',
  '🎬 장면 {s} — {n}의 이야기가 한 장 넘어갔어요',
  '🪡 {d}일을 함께 걸어 {n}의 새 장면이 꿰매졌어요'];

/* [함께한날 막4] 가이드 한마디 몽골어 뱅크 — 한국어(GUIDE_SPEAK · Code.js)와 «같은 길이»의 빈 자리.
 *   ⚠ 검수 전이라 일부러 '' 다 — MJ_pairPick_ 는 빈 칸이면 병기를 조용히 생략한다(지어내지 않는다).
 *   몽골어 감수(검수 큐 Q)가 채우는 날 초급 병기가 저절로 선다. 길이를 한국어와 다르게 두지 마라. */
const MN_GUIDE_SPEAK = {
  장면: ['', '', ''],
  맞힘: ['', '', ''],
  만남: ['', '', ''],
  고요: ['', '', ''],
  까몽장면: ['', '', ''],
  까몽맞힘: ['', '', ''],
  까몽만남: ['', '', ''],
  마린장면: ['', '']
};

/* ══════════════════════════════════════════════════════════════════════════════════════
 * [T4] AI 토큰 장부 — 밤 배치가 «실제로» 몇 토큰을 보내고 캐시가 도는가
 *
 * 무엇: 배치가 Claude 를 부를 때마다 응답의 `usage` 를 한 실행 동안 모아, 그 실행 끝에 한 줄로 남긴다.
 *
 * 왜 만들었나 — 재는 자리가 없어서 «판정을 못 했다»:
 *   ① 프롬프트 캐싱을 켤 수 있는지는 「공통 앞부분이 몇 토큰인가」가 정한다. 그 선(아래 AI캐시선_)을
 *      못 넘으면 `cache_control` 을 붙여도 캐시가 **조용히 안 만들어진다** — 오류 0, 증상 0, 청구서만 그대로다.
 *      그래서 「캐싱 적용 완료」라고 적어 놓고 실제로는 한 푼도 안 아끼는 상태가 가능하다.
 *   ② 켠 뒤에도 캐시는 조용히 깨진다 — 프롬프트 «앞머리»에 값 하나(날짜·학생 이름)가 끼는 날 히트가 0이 되고
 *      아무 신호도 안 난다. 안 재면 「샌다/안 샌다」를 영영 모른다.
 *
 * 어떻게: 200 을 받아 본문을 읽은 **직후**에 기록한다 — 그 뒤의 게이트(옛글자·스키마·파싱)가 응답을 버려도
 *   그 호출은 **이미 과금됐다**(상담AI `과금실패9` 가 08-28 에 배운 자리와 같은 축). 버린 응답의 토큰을
 *   장부에서 빼면 장부가 실제 지출보다 «적게» 나온다.
 *
 * 🔑 0 을 세 갈래로 가른다 — 셋이 같은 얼굴이면 그 0 은 아무 말도 못 한다:
 *      「호출 자체가 없었다」(호출 0 · 학생 0명인 지금이 여기다) ·
 *      「usage 가 안 실려 왔다」(무계측 — 자가 눈이 먼 것) ·
 *      「정말로 캐시가 0이다」(캐시읽기 0 — 지금의 «정상» 값).
 *
 * ⚠ 한 «실행» 안에서만 모인다(Apps Script 전역은 실행마다 새로 난다). 그래서 보고를 배치 함수가 아니라
 *   실행 진입점(nightJobs·morningJobs·weeklyJobs·monthlyJobs) 끝에 건다.
 *   **새 진입점을 만드는 손이 이 줄도 같이 건다** — 안 걸면 그 실행의 호출은 장부에 「없는 것」이 된다.
 * ⚠ 상담AI·두뇌는 여기 안 든다 — 그 둘은 이미 제 로그(상담로그·두뇌로그)에 토큰을 적는다. 사본 금지.
 * ══════════════════════════════════════════════════════════════════════════════════════ */

/* 모델별 «최소 캐시 프리픽스»(토큰). 정본 = `claude-api` 스킬 shared/prompt-caching.md 「API reference」 표
 *   (2026-08-29 확인). 이 수를 못 넘는 프리픽스는 cache_control 이 붙어도 캐시가 안 생긴다.
 * ⚠ 세대가 올라간다고 내려가지 않는다 — Opus 5 = 512 인데 Opus 4.6 = 4096 이다. 그래서 **모르는 모델의
 *   기본값은 가장 큰 4096**: 모르면 「못 넘는다」로 접혀야 한다(fail-closed). 반대로 접히면 켰다고 착각한다. */
const AI_캐시최소토큰_ = {
  'claude-opus-5': 512, 'claude-fable-5': 512, 'claude-mythos-5': 512,
  'claude-opus-4-8': 1024, 'claude-sonnet-5': 1024, 'claude-sonnet-4-6': 1024,
  'claude-opus-4-7': 2048, 'claude-haiku-3-5': 2048,
  'claude-opus-4-6': 4096, 'claude-opus-4-5': 4096, 'claude-haiku-4-5': 4096
};
// 톱레벨에서 AI_FEEDBACK_MODEL(Code.js)을 안 읽는다 — 라이브 로드 순서가 보장되지 않는다(v9.57 규칙).
function AI캐시선_() {
  const m = (typeof AI_FEEDBACK_MODEL === 'undefined' ? '' : String(AI_FEEDBACK_MODEL));
  return AI_캐시최소토큰_[m] || 4096;
}

const AI사용_장부_ = { 통: {}, 기록실패: 0 };

/* 호출 한 건을 장부에 더한다. **절대 throw 하지 않는다** — 계측이 배치를 죽이면 안 된다.
 * 다만 조용히 삼키지도 않는다: 실패는 `기록실패`로 세어 보고에 그대로 뜬다(안 재본 것을 0으로 접지 않는다). */
function AI사용_기록_(구분, usage) {
  try {
    const 통 = AI사용_장부_.통;
    const t = 통[구분] || (통[구분] = { 호출: 0, 무계측: 0, 입력: 0, 캐시생성: 0, 캐시읽기: 0, 출력: 0 });
    t.호출++;
    if (!usage) { t.무계측++; return; }   // 200 인데 usage 가 없다 = 자가 눈이 먼 것. 0 이 아니라 「모름」이다
    t.입력 += Number(usage.input_tokens) || 0;
    t.캐시생성 += Number(usage.cache_creation_input_tokens) || 0;
    t.캐시읽기 += Number(usage.cache_read_input_tokens) || 0;
    t.출력 += Number(usage.output_tokens) || 0;
  } catch (e) { AI사용_장부_.기록실패++; }
}

/* 실행 끝 보고 — 진입점(nightJobs 등)이 safeRun 으로 부른다.
 * 📮 **평소엔 메일을 안 보낸다**(Logger 만). 매일 밤 토큰 메일이 오면 그 메일은 곧 안 읽힌다.
 *    사람이 «움직여야 하는» 세 경우에만 메일이 뜬다:
 *      ㉠ 무계측·기록실패 > 0 — 자가 눈이 멀었다(이 장부의 다른 0 을 못 믿는다)
 *      ㉡ 캐시 토큰이 0이 아니다 — 지금 이 저장소엔 cache_control 이 배치 네 자리에 «없다».
 *         0 이 아니면 누가 붙였거나 벤더 쪽이 바뀐 것이라, 어느 쪽이든 알아야 한다
 *      ㉢ 평균 입력이 캐시선을 넘었다 — **「캐싱 못 켠다」는 판정이 뒤집힌 날이다.**
 *         이 줄이 그 판정을 «되돌아오는 자리»에 묶는다(사람 암기 0). 프롬프트가 길어지거나 모델이
 *         바뀌면 저절로 여기서 알린다.
 * 반환값은 문자열(빈 문자열 = 이 실행에서 AI 호출 0). 호출부가 로그로 쓴다. */
function AI사용_보고_() {
  const 통 = AI사용_장부_.통;
  const 구분들 = Object.keys(통);
  if (!구분들.length && !AI사용_장부_.기록실패) return '';  // 진짜 0 — 이 실행에서 AI 를 한 번도 안 불렀다
  const 선 = AI캐시선_();
  const 모델 = (typeof AI_FEEDBACK_MODEL === 'undefined' ? '?' : AI_FEEDBACK_MODEL);
  let 눈멂 = AI사용_장부_.기록실패 > 0, 캐시움직임 = false, 선넘음 = [];
  const 줄들 = 구분들.map(k => {
    const t = 통[k];
    const 평균 = t.호출 ? Math.round(t.입력 / t.호출) : 0;
    if (t.무계측) 눈멂 = true;
    if (t.캐시생성 || t.캐시읽기) 캐시움직임 = true;
    if (평균 >= 선) 선넘음.push(k + ' 평균 ' + 평균 + '토큰');
    return '· ' + k + ': 호출 ' + t.호출 + '건(무계측 ' + t.무계측 + ') · 입력 ' + t.입력 +
      '(평균 ' + 평균 + ') · 캐시생성 ' + t.캐시생성 + ' · 캐시읽기 ' + t.캐시읽기 + ' · 출력 ' + t.출력;
  });
  const 본문 = 'AI 토큰 장부 (' + 모델 + ' · 캐시 최소선 ' + 선 + '토큰)\n' + 줄들.join('\n') +
    (AI사용_장부_.기록실패 ? '\n⚠ 장부 기록 자체가 ' + AI사용_장부_.기록실패 + '건 실패 — 위 수는 실제보다 적다' : '');
  Logger.log(본문);
  if (눈멂 || 캐시움직임 || 선넘음.length) {
    adminMail('[SYNK] 🧮 AI 토큰 장부 — 확인이 필요합니다',
      본문 + '\n\n─────\n왜 이 메일이 왔나:\n' +
      (눈멂 ? '· 응답에 usage 가 안 실려 온 호출이 있습니다 — 위의 다른 0 들도 못 믿습니다(계측이 먼 것).\n' : '') +
      (캐시움직임 ? '· 캐시 토큰이 0이 아닙니다. 지금 이 저장소의 배치 네 자리에는 cache_control 이 «없습니다» — 누가 붙였거나 벤더 동작이 바뀐 것입니다.\n' : '') +
      (선넘음.length ? '· 평균 입력이 캐시 최소선(' + 선 + '토큰)을 넘었습니다: ' + 선넘음.join(' · ') +
        '\n  ⇒ 「프롬프트가 짧아서 캐싱을 못 켠다」는 판정이 뒤집혔습니다. 공통 앞부분에 cache_control 을 다시 검토할 때입니다.\n' : ''));
  }
  return 본문;
}

// 공통 API 헬퍼 — callClaudeFeedback_와 동일 규약(구조화 출력·오류 분류). 실패는 throw — 호출부가 폴백 결정
function aiCall_(apiKey, system, user, schema, maxTok) {
  // [v9.125] 리허설 게이트를 이 관문으로 하강 — 구 게이트(aiText_·callClaudeFeedback_)만으론 aiCall_ 직호출
  //   7곳(월보·학부모 편지·마스터리 등)이 리허설 중 그대로 과금됐다. throw(호출부 오류 경로 리허설)로 올린다.
  if (isRehearsal_()) { rehearsalNote_('AI 호출 aiCall_ (차단·비용 0)'); const e = new Error('리허설 모드: AI 호출 차단'); e.permanent = true; throw e; }
  const body = {
    model: AI_FEEDBACK_MODEL, max_tokens: maxTok || 4096, system: system,
    messages: [{ role: 'user', content: user }],
    output_config: { format: { type: 'json_schema', schema: schema } }
  };
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(body), muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('Claude API ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 160));
  const j = JSON.parse(res.getContentText());
  AI사용_기록_('스튜디오', j.usage);   // [T4] 아래 게이트들이 응답을 버려도 이 호출은 이미 과금됐다
  if (j.stop_reason === 'refusal' || j.stop_reason === 'max_tokens') throw new Error('응답 불가(' + j.stop_reason + ')');
  const tb = (j.content || []).filter(b => b.type === 'text')[0];
  if (!tb || !tb.text) throw new Error('text 블록 없음');
  const 값 = JSON.parse(tb.text);
  /* [v9.223] 옛 글자 — 이 반환값은 개인 한문장·칭호·강사 브리핑·FB 콘텐츠 등 «사람이 읽는 글»이 된다
   *   (직호출 실측 7곳 — [v9.224] 리뷰 P2 정정: 「14 호출부」는 낡은 셈이었고 「학부모 편지」는 aiText_ 소비자다).
   *   호출부마다 검사하면 하나가 빠지고 빠진 방향은 언제나 「통과」다. throw 로 올리는 것은 위 오류 경로와
   *   같은 규약이라(호출부는 전부 폴백·스킵을 이미 들고 있다) 새 갈래를 만들지 않는다.
   *   [v9.224] permanent 표시(리뷰 P1-1): 이 throw 는 429·5xx 같은 일시 장애가 아니다 — 청크 배치의 catch 가
   *   이 표시로 「일시=break(백오프) / 옛글자=이 청크만 버리고 진행」을 가른다. 안 가르면 한 청크의 옛 글자가
   *   그날 밤 뒤쪽 학생 전원의 산출물을 지운다(엔진_수집.js callClaudeTalk_ 의 permErr 와 같은 축). */
  const 옛 = 옛글자걸림_(값);
  if (옛) { const e옛 = new Error('옛 글자 감지(' + 옛.칸 + ':' + 옛.짚음 + ') — 응답 폐기(호출부 폴백으로 간다)'); e옛.permanent = true; throw e옛; }
  return 값;
}
/* [v9.205] 사고 OFF 대가의 **결정적** 경계 — v9.204 의 가드 문구는 모델 지시라 확률적이다.
 *   불이행이 한 번만 나도 그 응답은 정제 없이 학부모 메일 4자리로 간다(웰컴·편지·레벨 진단·주간 리포트).
 *   ①배포 검수 P1 (`e7b219ae80da`·`495292f9cc92`): "프롬프트가 아닌 결정적 출력 검증".
 * 🔑 왜 정제가 아니라 **거부**인가 — 태그만 지우면 그 안에 있던 내부 사고가 **본문인 척** 남는다.
 *   태그가 보이는 실패는 눈에 띄지만 그 실패는 아무도 못 알아챈다. 폴백은 4자리 전부 서 있고
 *   (품질 검증된 템플릿) 손실이 눈에 보여 되돌릴 수 있다. 실제 누출 «형태»를 잰 재료가 아직
 *   없으니(STORY_AI_ON=false 라 두 자리는 호출조차 안 한다) 안전한 쪽을 고른다.
 * 🔑 일반형이다 — 태그 «이름»을 목록으로 적지 않는다. 못 적은 이름이 새고, 목록은 늘 낡는다.
 * ⚠ 이 4자리는 전부 평문 메일이라(MailApp 3인자) 마크업이 정당할 자리가 없다 — 거짓양성 재료가 없다. */
function 태그누출_(s) {
  const t = String(s == null ? '' : s);
  return /<\/?[A-Za-z][A-Za-z0-9_:.-]*(\s[^>]*)?>/.test(t) // 여닫는 완성 태그
      || /<\/?[A-Za-z][A-Za-z0-9_:.-]*[^>]*$/.test(t);     // 예산 소진으로 «>» 없이 잘린 꼬리
}

/* [v9.223] 옛 글자(한자·가나) — 유호님 확정(2026-08-07) 「쓰는 문자는 한글·몽골어(키릴)·영어 셋뿐」을
 *   **모델이 내는 글**에 세우는 자리. 그날까지 이 확정을 지키던 장치는 셋 다 «우리가 쓴 글»만 겨눴다 —
 *   저장소 파일 스캔(F351)·커밋 층(F379)·채팅 층. 형제 SYNK-talk 은 08-12 에 런타임 게이트를 세웠으나
 *   (`lib/옛글자.js` + `교정엔진.교정값()`), **이 저장소의 모델 출력은 어느 층에도 안 걸렸다.**
 *
 * 📏 프롬프트로는 안 막힌다 — 실측이 근거다. 형제 eval 출력을 같은 채점기로 재니, 그 글자를 금지하는
 *   규칙을 프롬프트에 실은 뒤에도 v3 2건 · v4 1건 · v5 0건 · v6 1건으로 **네 판 연속 샜다**(분모 ~102).
 *   프로즈는 확률을 낮출 뿐 0으로 못 만든다. 그래서 재는 자리를 프롬프트가 아니라 «내보내기 직전»으로 옮긴다.
 *
 * 🔑 판정은 **한 벌**, 처분은 **깔때기마다 다르다.** 처분을 여기서 정하면(가령 전부 throw) 상담 챗봇이
 *   말을 멈추고 첨삭 배치가 중단된다 — 각 자리엔 이미 검증된 폴백이 서 있다(격리·템플릿·인계).
 *   깔때기가 일곱인 것은 세어 봐야 아는 수라 `tests/옛글자런타임.test.js`(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다) 가 **개수로** 못박았다:
 *   새 깔때기가 검사 없이 생기면 그 회귀가 빨개졌다 — 지금은 그 수를 세는 기계가 없으니 깔때기를 늘리는 손이 여기 수도 같이 고친다. v9.125 가 같은 자리에서 이미 한 번 겪었다
 *   (리허설 게이트를 둘에만 두었더니 `aiCall_` 직호출 7곳이 리허설 중 그대로 과금됐다).
 *
 * 🔴 **이 파일에도 그 글자를 적지 않는다** — 적으면 저장소 문자 스캔이 이 소스에 걸린다. 짚는 것도
 *   언제나 `U+XXXX` 표기뿐이다: 위반을 신고하는 글에 그 글자를 인용하면 그 자리가 새 위반이 된다(F298).
 * 🔑 클래스 문자열은 `.claude/hooks/lib/옛글자.js`·형제 `lib/옛글자.js` 와 **글자로 같아야 한다** —
 *   갈리면 위 회귀의 「단일 출처」가 빨개진다(SQL 도 include 도 없는 자리라 사본은 기계에 문다). */
function 옛글자짚기_(글) {
  // 전역 플래그 정규식을 상수로 들고 다니면 lastIndex 때문에 같은 입력에 번갈아 참·거짓이 난다
  //   — 새는 방향은 거기서도 「통과」다(형제가 회귀 첫 실행에서 실제로 밟았다). 매번 새로 만든다.
  const 걸린 = String(글 == null ? '' : 글).match(new RegExp('[\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF\\uFF66-\\uFF9F\\u{1AFF0}-\\u{1B16F}\\u{20000}-\\u{3FFFF}]', 'gu'));
  if (!걸린) return '';
  const 코드 = [];
  걸린.forEach(function (m) { const c = m.codePointAt(0); if (코드.indexOf(c) === -1) 코드.push(c); });
  return 코드.map(function (c) { return 'U+' + c.toString(16).toUpperCase(); }).join(' · ');
}

/* 값 안의 **모든 문자열**을 훑어 처음 걸린 자리 하나 — `{칸, 짚음}` · 깨끗하면 null.
 * 🔑 구조화 출력(`aiCall_`)은 칸이 중첩·배열이라 평면 검사로는 안 닿는다. 「어느 칸이 학생에게
 *   보이나」를 여기서 가리려 들면 그 목록이 낡는 순간 조용히 새므로, **전부** 잰다 —
 *   이 시스템의 어느 칸에도 그 글자가 정당할 자리가 없어 거짓양성의 재료 자체가 없다.
 * 🔑 처음 하나만 돌려주는 이유: 부르는 쪽은 버릴지 말지만 정하면 되고, 사유는 한 줄이라야 읽힌다. */
function 옛글자걸림_(값, 경로) {
  const 자리 = 경로 || '';
  if (값 === null || 값 === undefined) return null;
  if (typeof 값 === 'string') {
    const 짚음 = 옛글자짚기_(값);
    return 짚음 ? { 칸: 자리 || '값', 짚음: 짚음 } : null;
  }
  if (Array.isArray(값)) {
    for (let i = 0; i < 값.length; i++) {
      const r = 옛글자걸림_(값[i], 자리 + '[' + i + ']');
      if (r) return r;
    }
    return null;
  }
  if (typeof 값 === 'object') {
    const keys = Object.keys(값);
    for (let i = 0; i < keys.length; i++) {
      const r = 옛글자걸림_(값[keys[i]], 자리 ? 자리 + '.' + keys[i] : keys[i]);
      if (r) return r;
    }
    return null;
  }
  return null; // 숫자·불리언 — 글자가 들어갈 자리가 없다
}
// 자유 텍스트 헬퍼 — 키 없음·실패 전부 null(호출부는 null이면 조용히 생략)
function aiText_(prompt, maxTok) {
  if (isRehearsal_()) { rehearsalNote_('AI 호출 aiText_ (차단·비용 0)'); return null; } // [v9.120]
  try {
    const key = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
    if (!key) return null;
    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      // [v9.54] thinking OFF — 이 모델군은 thinking 생략 시 적응형 사고가 기본 ON이고 사고 토큰이 max_tokens를
      //   잠식한다. 짧은 예산(900~1536)의 자유텍스트에서 본문이 잘리거나 비어 폴백률이 오르던 것을,
      //   사고를 꺼 예산 전액을 본문에 쓰게 교정(구조화 호출 aiCall_·첨삭은 품질 우선으로 사고 유지).
      // [v9.204] ⚠ 사고를 끈 대가 — Opus 5는 그 상태에서 내부 XML 태그를 본문에 흘릴 수 있다(벤더 정본 실측 조항).
      //   이 반환값은 정제 없이 웰컴 스토리·「미래의 나」 편지·몽골어 진단 리포트·주간 운영 리포트로 **그대로** 나간다.
      //   🚫 태그 이름을 적지 않는다 — 정본이 「이름을 대면 덜 듣는다」로 못박았다. 🚫 「생각하지 마라」류 금지(누출을 늘린다).
      payload: JSON.stringify({ model: AI_FEEDBACK_MODEL, max_tokens: maxTok || 1024, thinking: { type: 'disabled' },
        system: '응답에는 최종 결과물만 쓴다. 내부 태그나 시스템 태그를 포함하지 않는다.',
        messages: [{ role: 'user', content: prompt }] }),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return null;
    const j = JSON.parse(res.getContentText());
    AI사용_기록_('자유텍스트', j.usage);   // [T4] 아래 폐기(태그누출·옛글자)로 가도 이 호출은 이미 과금됐다
    const tb = (j.content || []).filter(b => b.type === 'text')[0];
    const out = tb && tb.text ? String(tb.text).trim() : null;
    // [v9.205] 가드 문구를 안 지킨 응답은 통째로 못 믿는다 — 폐기하고 호출부 폴백으로 보낸다.
    //   Logger 는 빈도를 «나중에 잴 수 있게» 남기는 재료다(지금은 0회일 것으로 보이나 안 쟀다).
    if (out && 태그누출_(out)) { Logger.log('aiText_ 태그 누출 감지 — 응답 폐기(호출부 폴백으로 간다)'); return null; }
    // [v9.223] 옛 글자 — 바로 윗줄과 **같은 판단**이다(가드 문구를 안 지킨 응답은 통째로 못 믿는다).
    //   이 반환값은 정제 없이 웰컴 스토리·「미래의 나」 편지·몽골어 진단 리포트·주간 운영 리포트로 그대로 나간다.
    //   🔑 정제(그 글자만 지우기)가 아니라 폐기인 이유도 같다 — 글자만 빼면 뜻이 조용히 어긋난 문장이 남는다.
    const 옛 = out ? 옛글자짚기_(out) : '';
    if (옛) { Logger.log('aiText_ 옛 글자 감지(' + 옛 + ') — 응답 폐기(호출부 폴백으로 간다)'); return null; }
    return out;
  } catch (e) { return null; }
}

// 학생 요약 로더 — AI 스튜디오 공용(이름·급수·반·이메일·목표·최애·재원일)
function aiStudents_(ss) {
  const pf = ss.getSheetByName('profiles');
  const list = [];
  if (!pf || pf.getLastRow() < 2) return list;
  const w = Math.min(128, pf.getMaxColumns()); // [v9.84] 상담 디테일(DT124~DX128)까지 — 신규생 콜드스타트 폴백 재료
  pf.getRange(2, 1, pf.getLastRow() - 1, w).getValues().forEach(r => {
    if (!r[0] || r[3] !== 'student' || String(r[0]).indexOf('DEMO-') === 0) return;
    list.push({
      id: String(r[0]).trim(), n: r[1] || r[0], cls: String(r[4] || ''),
      created: r[14] || '', total: Number(r[15]) || 0, stage: String(r[18] || ''), stk: Number(r[20]) || 0,
      pEmail: String(r[25] || '').trim(), vision: String(r[52] || '').trim(),
      lv: w >= 67 ? (Number(r[66]) || 0) : 0, dream: w >= 80 ? String(r[79] || '').trim() : '',
      fav: w >= 105 ? String(r[104] || '').trim() : '',
      // [v9.84] 상담 폴백 4종 — 학생 소유 열(dream CB80·fav DA105)이 비어 있을 때만 소비층이 대신 쓴다(앱 입력이 항상 이긴다)
      taste: w >= 124 ? String(r[123] || '').trim() : '',   // DT124 상담취향(선호그룹·인생드라마·취미)
      cGoal: w >= 125 ? String(r[124] || '').trim() : '',   // DU125 상담목표(TOPIK 급수·기한)
      topik0: w >= 126 ? String(r[125] || '').trim() : '',  // DV126 입학TOPIK(0점 좌표)
      pain: w >= 127 ? String(r[126] || '').trim() : ''     // DW127 상담고충(입학 자기보고)
    });
  });
  return list;
}
/* [v9.250 · #Q99 5/5] 돌아온 학생의 «재료 창»을 그 사람이 떠나기 전까지 넓힌다 — `exit_log` 도달.
 *
 * ■ 원신호가 **구조적으로** 못 보던 것 = 「돌아온 사람」.
 *   아래 두 로더(`aiWeakMap_`·`퀴즈오답맵_`)의 창은 **오늘로부터 14일** 고정이다. 퇴소했다 돌아온
 *   학생은 그 창이 통째로 비어 있다 — 안 오는 동안 오류가 안 쌓이기 때문이다. 그래서 개인 퀴즈가
 *   급수 로테이션으로 떨어진다: **가장 개인화가 필요한 순간에 개인화가 꺼진다.** 그 사람의 기록은
 *   `student_errors`·`quiz_log` 에 그대로 살아 있는데 «창 밖»이라 안 보였을 뿐이다.
 *
 * ■ 왜 `exit_log` 여야 하나 — 「지금 명부에 있는데 나간 적이 있다」는 이 탭에만 있다.
 *   출석 공백으로는 **장기 결석**과 «나갔다 돌아옴»이 안 갈리고, 상담시트 처리상태는 «지금 상태»라
 *   언제 나갔는지가 없다. profiles 는 퇴소자 행을 통째로 지우므로(v9.34 행 정합 불변식) 그쪽엔
 *   재등록자와 신입을 가를 재료가 **원리적으로** 없다.
 *
 * ■ 창은 «옮기지» 않고 «넓힌다» — 옮기면 돌아온 뒤 새로 쌓인 것을 놓친다. 컷을 퇴소 시점 14일 전으로
 *   내리면 「떠나기 전 마지막 14일 + 돌아온 뒤 전부」가 함께 든다. 프롬프트가 안 붓는 이유는 소비처가
 *   이미 상한을 걸어 뒀기 때문이다(약점 `slice(-2)` · 오답맵 한 학생 70자).
 *
 * ⚠ **공백 상한** — 너무 오래된 약점은 그 사람의 «지금»이 아니다. 넘으면 안 넓히고 통상 창으로 둔다.
 *   몇 명이 걸렸는지는 호출부가 분모와 함께 로그에 적는다(유호 확정 08-14 · 0 은 분모와 함께 읽는다).
 * ⚠ 틀릴 때의 모습 = **창이 좁아지는 것**(넓히려다 거꾸로 자르면 통상 학생까지 재료를 잃는데 겉모습은
 *   「재료 없음」과 같다) → 컷은 `Math.min` 으로만 내린다. 아래 두 로더가 그 안전판을 함께 진다.
 * 🚫 학생에게 가는 글에 «나갔다 왔다»를 싣지 않는다 — 재료 창만 조용히 넓힌다. 결석·이탈을 학생 산출의
 *   소재로 쓰지 않는 것은 이미 선 규율이다(`aiMonthlyTitles_` 프롬프트 「지각·결석 등 부정 소재 절대 금지」). */
const 복귀_공백상한일 = 180;
function 복귀창_(ss) {
  const sh = ss.getSheetByName('exit_log');
  if (!sh || sh.getLastRow() < 2) return { 맵: {}, 상한밖: 0 };
  const 최종 = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(r => {
    const sid = String(r[0] == null ? '' : r[0]).trim();
    if (!sid) return;
    const d = toDate_(r[3]) || (r[3] instanceof Date ? r[3] : null); // 퇴소감지일
    if (!d) return;
    /* 두 번 나갔다 온 사람은 **마지막** 퇴소가 창을 정한다 — 더 최근일수록 창이 좁고, 좁은 쪽이 옳다. */
    const t = d.getTime();
    if (!최종[sid] || t > 최종[sid]) 최종[sid] = t;
  });
  const 바닥 = Date.now() - 복귀_공백상한일 * 86400000;
  const 맵 = {}; let 상한밖 = 0;
  Object.keys(최종).forEach(sid => { if (최종[sid] >= 바닥) 맵[sid] = 최종[sid]; else 상한밖++; });
  return { 맵: 맵, 상한밖: 상한밖 };
}
/* 위 맵은 «나간 적 있는 사람» 전원이고 「돌아온 사람」은 그중 지금 명부에 있는 부분집합이다. 여기서
 * 교집합을 안 뜨는 이유: 로더는 자기가 실제로 만난 학생 행에만 컷을 적용하고, 명부에 없는 사람의
 * 집계는 아무도 안 읽는다. 「돌아온 N명」이라는 **분모는 명부를 쥔 호출부**가 센다(여기서 세면 틀린다). */

// 최근 약점 로더 — student_errors(14일·미해결) + 첨삭 '오늘의포인트' 최근 1건 + 오류태그 빈도(14일·보조)
// ⚠ 이 약점맵은 개원용 시트층이다 — 앱 이관 때 은퇴 예정(불변식 5 격리). 약점 계산을 앱 사슬에 세울 때
//   이 로직을 복사하지 않는다(⛔짓는 동안 복제 금지) — 그쪽 정본은 엔진 교정 이력에서 새로 선다(철학정합 §3-A·B).
// [v9.250 · #Q99 5/5] `복귀` = `복귀창_()` 산출(선택). 없으면 종전과 똑같이 «오늘 14일» 하나로 돈다.
function aiWeakMap_(ss, 복귀) {
  const weak = {};
  const se = ss.getSheetByName('student_errors');
  const cut = Date.now() - 14 * 86400000;
  const 복귀맵 = (복귀 && 복귀.맵) || {};
  /* 컷은 **내리기만** 한다 — 퇴소가 오늘이면 퇴소-14일 = 통상 컷이라 같아지고, 그보다 이르면 넓어진다.
   * `Math.min` 은 그 성질을 코드로 못박은 안전판이다(위 「틀릴 때의 모습」). */
  const 컷_ = (sid) => (복귀맵[sid] ? Math.min(cut, 복귀맵[sid] - 14 * 86400000) : cut);
  const aggW = {}; // [v9.64] 학생×유형 집계 — 반복 많은 포인트를 앞세워 AI가 끈질긴 약점부터 공략(유형 태그로 표적도 선명)
  if (se && se.getLastRow() >= 2) se.getRange(2, 1, se.getLastRow() - 1, 8).getValues().forEach(r => {
    if (!r[1] || String(r[7] || '') === '해결') return;
    const d = toDate_(r[0]) || (r[6] instanceof Date ? r[6] : null);
    const k = String(r[1]).trim();
    if (!d || d.getTime() < 컷_(k)) return;
    const gS = (aggW[k] = aggW[k] || {});
    const tK = String(r[3] || r[4] || '').slice(0, 10);
    const eW = gS[tK] = gS[tK] || { type: String(r[3] || ''), memo: '', t: 0, cnt: 0 };
    eW.cnt++;
    if (d.getTime() >= eW.t) { eW.t = d.getTime(); eW.memo = String(r[4] || r[3] || ''); }
  });
  Object.keys(aggW).forEach(k => {
    weak[k] = Object.keys(aggW[k]).map(x => aggW[k][x]).sort((a, b) => (b.cnt - a.cnt) || (b.t - a.t))
      .map(eW => (eW.type ? eW.type + ': ' : '') + eW.memo.slice(0, 30) + (eW.cnt > 1 ? ' (반복 ' + eW.cnt + '회)' : ''));
  });
  const fb = ss.getSheetByName('hw_feedback');
  /* [v9.209] 오류태그(13열) 빈도 합류 — 철학 Ⅰ-1 「23유형 기록」이 처음으로 학생에게 되돌아가는 배선(철학정합 §3-B).
   *   강사 손메모가 우선이고 태그는 보조 신호라, 별도 항목을 늘리지 않고 첨삭 항목의 꼬리로만 싣는다 —
   *   소비처 2곳(퀴즈 프롬프트 slice(-2)·반브리핑 slice(-1))의 항목 수가 안 변해 손메모 자리가 안 밀린다.
   *   ([09-04] 셋째였던 «연습노트»가 걷혀 3곳 → 2곳.)
   *   태그 폭은 시트 물리 폭으로 클램프(구 시트에서 13열 요구가 예외를 던지면 약점맵 전체가 죽는다 — 1710 교훈). */
  const tagW = {}; // 학생 → 태그 → {cnt, t}
  const fbW = fb ? Math.min(13, fb.getLastColumn()) : 0;
  if (fb && fb.getLastRow() >= 2) fb.getRange(2, 1, fb.getLastRow() - 1, fbW).getValues().forEach(r => {
    if (!r[1] || !노출카드_(r[8])) return; // [v9.63→v9.210] 게이트 미달분이 AI 퀴즈로 새는 것 차단(태그 집계도 같은 문 안) · 판정 정본=노출카드_ (구 거부목록은 '대기'를 통과시켰다)
    const k = String(r[1]).trim();
    if (String(r[5] || '')) (weak[k] = weak[k] || [])._fb = String(r[5]).slice(0, 60); // 마지막 것이 최근(행 순서)
    if (fbW < 13) return;
    const d = toDate_(r[2]);
    if (!d || d.getTime() < cut) return; // 태그 「최근」 = 손메모와 같은 14일 창(한 함수에 창 하나)
    String(r[12] || '').split(',').forEach(t => {
      const tag = t.trim();
      if (!tag || tag === '오류없음') return; // 「오류없음」은 약점이 아니다 — 세면 무오류가 약점으로 둔갑
      const gT = (tagW[k] = tagW[k] || {});
      const eT = gT[tag] = gT[tag] || { cnt: 0, t: 0 };
      eT.cnt++;
      if (d.getTime() > eT.t) eT.t = d.getTime();
    });
  });
  Object.keys(tagW).forEach(k => { weak[k] = weak[k] || []; }); // 태그만 있는 학생도 항목을 받는다
  Object.keys(weak).forEach(k => {
    const gT = tagW[k];
    const top = gT ? Object.keys(gT).sort((a, b) => (gT[b].cnt - gT[a].cnt) || (gT[b].t - gT[a].t)).slice(0, 2)
      .map(t => t + (gT[t].cnt > 1 ? ' ×' + gT[t].cnt : '')).join(' · ') : '';
    const line = weak[k]._fb ? weak[k]._fb + (top ? ' | 자주 틀리는 곳: ' + top : '')
      : (top ? '자주 틀리는 곳: ' + top : '');
    if (line) weak[k].push(line);
    delete weak[k]._fb;
  });
  return weak;
}

/* [v9.211]→[v9.212] 오류뱅크 커서 걸음 — 슬라이스의 상태열(I)·제출일(C)을 보고 「집을 행」과 「전진 폭」을 가른다.
 * 노출은 집고 지나간다 · 닫힘(오류: 즉시 · 격리: 복구 창 경과 후 — 판정 정본=닫힌카드_)은 안 집고 지나간다 ·
 * 판정 전(대기·빈칸·낯선 값·복구 창 안의 격리)은 **멈춘다** — 지나가면 검토자가 나중에 승인·복구해도
 * 커서 뒤라 error_bank 에서 영구 누락이다(재검수 P1 #9c7967e921d4=대기 · af5a106f507d 계열=격리:
 * 커서는 카드 생성과 같은 밤에 돌아, 즉시 닫힘이면 다음 날 아침의 격리 오탐 복구가 전부 유실됐다).
 * 멈춤의 대가는 유실이 아니라 지연이다 — 확정(승인·복구 또는 창 경과)되면 다음 밤 같은 자리부터 다시 걷는다.
 * (멈춘 행 뒤의 노출까지 먼저 집으면 커서가 못 넘어가 다음 밤 같은 행을 두 번 집는다 — 그래서 접두까지만.) */
function 오류뱅크전진_(상태들, 제출일들, 기준시각) {
  const 집을행 = [];
  let 전진 = 0;
  for (let i = 0; i < 상태들.length; i++) {
    if (노출카드_(상태들[i])) { 집을행.push(i); 전진 = i + 1; continue; }
    if (닫힌카드_(상태들[i], 제출일들 && 제출일들[i], 기준시각)) { 전진 = i + 1; continue; }
    break;
  }
  return { 집을행, 전진 };
}

/* [v9.226] 오류사전 포이즌 필 판정 — 「성공 시에만 전진」의 그림자를 닫는다(리뷰 P2-④).
 * aiCall_ 이 같은 슬라이스에서 밤마다 던지면(영구 오류·재료 유도형 옛글자) 커서가 영원히 서고
 * error_bank 만 조용히 성장을 멈춘다 — 관리자 메일엔 같은 오류가 매밤 쌓이지만 「커서가 섰다」는
 * 어디에도 없다. 연속 3밤 실패면 그 슬라이스의 확정 접두를 재료에서 포기하고 전진한다:
 * 원본 hw_feedback 행은 그대로라 잃는 것은 파생 집계 재료 ≤40행, 얻는 것은 그 뒤 전체의 생존이다
 * (aiFeedbackBatch_ 리뷰 M1 포이즌 필과 같은 축 — 그쪽은 행 단위, 이쪽은 호출이 슬라이스 단위라 슬라이스 단위).
 * ⚠ 전진 폭은 커서.전진(확정 접두)까지만 — 판정 전(대기·격리 복구 창) 행을 넘으면 v9.212 불변식
 *   (승인·복구 뒤 재수집)이 깨진다. 전진 폭 0이면 집을 행도 없어 애초에 호출이 없다. */
function 오류뱅크포이즌_(연속실패, 전진폭) {
  const n = (Number(연속실패) || 0) + 1;
  if (n >= 3 && 전진폭 > 0) return { 전진: true, 카운터: 0 };
  return { 전진: false, 카운터: n };
}

/* [v9.247 · #Q99] 문항 라벨 — 「무엇을」 틀렸나를 한 조각으로 줄인다.
 * 유형(quiz_log 4열)은 contents 의 **분류**(문법 카테고리)라 가장 짧고 정확한 라벨이다.
 * ⚠ 그런데 **개인 퀴즈는 유형이 전부 '개인퀴즈'**다(엔진_수집.js `quizSweep_` 의 qMap AIQ 가지가
 *   `cat: '개인퀴즈'` 를 박는다). 그대로 세면 「개인퀴즈 ×5」라는, 맞는 얼굴로 아무것도 안 말하는
 *   라벨이 나온다 — 그리고 카드가 개인 퀴즈를 **우선** 띄우므로(Code.js `pq ? pq.q : q[0]`)
 *   활동 중인 학생의 응답은 대부분 이쪽이다. 즉 유형만 믿으면 재료가 통째로 무의미해진다.
 *   그 경우엔 문제 원문의 앞머리를 쓴다(문항 스냅샷은 quizSweep_ 이 이미 행에 박아 둔다). */
function 퀴즈라벨_(유형, 문제) {
  const t = String(유형 || '').trim();
  if (t && t !== '개인퀴즈') return t.slice(0, 12);
  const q = String(문제 || '').trim().replace(/\s+/g, ' ');
  return q ? q.slice(0, 24) : '';
}

/* [v9.247 · #Q99] 🔁 지난 퀴즈 되읽기 — 개인 퀴즈 출제가 **자기 결과**를 재료로 받는다.
 * 시트층 도달 장부(`엔진_셋업확장.js` `수집도달_`)에서 `quiz_log` 는 「읽는 곳이 진단 리포트뿐」이었다.
 * 매일 약점으로 문제를 내면서 그 답이 맞았는지를 한 번도 안 돌려받았다 — 출제 → 응답 → **재출제**의
 * 마지막 칸이 비어 있었고, 그래서 엔진은 자기 개입이 먹혔는지 원리상 알 수 없었다.
 *
 * ■ 축이 둘인 이유 — 하나는 원신호(hw_feedback)가 **구조적으로 못 보는 것**이다
 *   ㉠ 오답 — 낸 문제를 틀렸다. 재출제 재료.
 *   ㉡ **찍어서 맞힘**(정답 + 확신도 '찍었어요') — 다른 어느 층에서도 이 학생은 「맞은 학생」이다.
 *      첨삭은 제출한 글만 보므로 이 축이 아예 없다. 확신도가 quiz_log 에서 가장 값비싼 열인
 *      이유가 이것이고(엔진_수집.js `퀴즈응답포인트_` ①), 정답에도 포인트를 주는 설계가 이 축을
 *      살려 둔 대가다 — 살려 둔 값을 여기서 처음 쓴다.
 *   ⚠ '판정보류'는 **어느 축에도 안 넣는다**(`quizGrade_` 의 세 갈래 원칙 — 모르는 것과 틀린 것은
 *      다르다). 보류를 오답으로 뭉개면 정답 미등록 문항이 영원한 약점으로 둔갑한다.
 *
 * ■ 창은 14일 — `aiWeakMap_` 과 같다(한 재료에 창 하나. 갈리면 「최근」이 자리마다 다른 뜻이 된다).
 * ■ 왜 `aiWeakMap_` 에 합류시키지 않았나 — 그 배열은 소비처 셋이 `slice(-2)`·`slice(-1)` 로 집어
 *   항목을 늘리면 **강사 손메모가 밀려난다**(v9.209 가 태그를 꼬리로만 실은 이유). 그리고 이 재료의
 *   과녁은 개인 퀴즈 출제 한 곳이지 반 브리핑이 아니다([09-04] 함께 적혀 있던 «연습 노트»는 걷혔다).
 *
 * ■ 대가 (지침 신뢰성 맹점④)
 *   · 틀릴 때의 모습 = **조용히 적은 재료**. 문항 스냅샷이 빈 행(ai_daily 가 이틀 넘게 지연된 응답을
 *     못 채우는 자리 — `quizSweep_` 이 스스로 적어 둔 한계)은 라벨을 못 만들어 빠지는데, 겉으로는
 *     그냥 「재료 없음」과 같은 모양이다. → 그래서 버린 행 수를 세어 함께 돌려주고 호출부가 로그에 적는다.
 *   · 닫을 것 = 한 학생 재료를 **70자로 못박는다**. 재료가 늘어도 배치 프롬프트 토큰이 안 는다.
 *   · 새 시트·새 배치·새 속성 0 — 이미 쌓이는 탭을 읽기만 한다. */
// [v9.250 · #Q99 5/5] `복귀` = `복귀창_()` 산출(선택) — 돌아온 학생만 컷을 내린다. 없으면 종전 그대로.
function 퀴즈오답맵_(ss, 복귀) {
  const 맵 = {};
  let 버린행 = 0;
  const ql = ss.getSheetByName('quiz_log');
  if (!ql || ql.getLastRow() < 2) return { 맵: 맵, 버린행: 0 };
  /* 폭은 시트 물리 폭으로 클램프한다 — 구 시트(11열)에서 13열을 요구하면 예외가 나고,
   *   그러면 이 재료가 아니라 ① 절 전체가 죽는다(v9.209 의 1710 교훈과 같은 자리).
   * ⚠ 이 한 줄은 **흉내로는 못 재는 자리**다(시트흉내 계약 ⑥은 요청한 폭을 늘 채워 준다) —
   *   라이브 Range 만 던진다. 변이로 증명 못 하는 줄이라 여기 적어 둔다(초록의 근거가 아니다).
   *   폭이 모자라 제출일 칸이 없으면 아래 날짜 게이트가 그 행을 통째로 버린다 — 별도 분기 불필요. */
  const w = Math.min(QUIZ_LOG_HEADERS.length, ql.getLastColumn());
  const cut = Date.now() - 14 * 86400000;
  /* [v9.250 · #Q99 5/5] 돌아온 학생은 통상 14일 창이 통째로 비어 있다 — 컷을 그 사람이 떠나기
   *   14일 전으로 내려 «떠나기 전 마지막 + 돌아온 뒤 전부»를 함께 본다. `Math.min` = 좁아짐 방지. */
  const 복귀맵 = (복귀 && 복귀.맵) || {};
  const 컷_ = (sid) => (복귀맵[sid] ? Math.min(cut, 복귀맵[sid] - 14 * 86400000) : cut);
  const agg = {}; // 학생 → 라벨 → { 오답, 찍맞, t }
  const 시도칸 = QUIZ_LOG_HEADERS.indexOf('시도');
  ql.getRange(2, 1, ql.getLastRow() - 1, w).getValues().forEach(r => {
    const sid = String(r[1] || '').trim();
    if (!sid) return;
    /* [v9.312] 「무엇을 골랐나」는 **첫 답**이다 — 둘째 답부터는 시도 번호를 달고 남지만(철학 Ⅲ-2 · 다시 낸 문항의 결과가 판정)
     *   약점 재료로는 안 센다. 옛 행(시도 칸 없음)은 1 이다. */
    if (시도칸 >= 0 && (Number(r[시도칸]) || 1) > 1) return;
    const 판정 = String(r[7] || '').trim();
    /* 🔑 문구를 리터럴로 다시 적지 않는다 — 폼 3택의 정본은 `QUIZ_LOG_HEADERS` 옆 `QUIZ_CONFIDENCE`
     *   하나다. 두 곳에 적으면 갈라지고, 갈라진 쪽은 **조용히 아무것도 안 고른다**(축이 죽어도 초록). */
    const 찍맞 = 판정 === '정답' && String(r[8] || '').trim() === QUIZ_CONFIDENCE[QUIZ_CONFIDENCE.length - 1];
    if (판정 !== '오답' && !찍맞) return;
    const d = toDate_(r[9]) || (r[10] instanceof Date ? r[10] : null);
    if (!d || d.getTime() < 컷_(sid)) return;
    const 라벨 = 퀴즈라벨_(r[3], r[4]);
    if (!라벨) { 버린행++; return; } // 문항 스냅샷이 빈 행 — 세지 않으면 이 손실이 안 보인다
    const g = (agg[sid] = agg[sid] || {});
    const e = g[라벨] = g[라벨] || { 오답: 0, 찍맞: 0, t: 0 };
    if (판정 === '오답') e.오답++; else e.찍맞++;
    if (d.getTime() > e.t) e.t = d.getTime();
  });
  Object.keys(agg).forEach(sid => {
    const g = agg[sid];
    const 순 = Object.keys(g).sort((a, b) =>
      ((g[b].오답 + g[b].찍맞) - (g[a].오답 + g[a].찍맞)) || (g[b].t - g[a].t)); // 반복 많은 것 먼저, 같으면 최근
    const 틀림 = 순.filter(k => g[k].오답).slice(0, 2).map(k => k + (g[k].오답 > 1 ? ' ×' + g[k].오답 : ''));
    const 찍음 = 순.filter(k => g[k].찍맞).slice(0, 1);
    const 조각 = [];
    if (틀림.length) 조각.push('틀림 ' + 틀림.join(' · '));
    if (찍음.length) 조각.push('찍어서 맞힘 ' + 찍음.join(' · '));
    if (조각.length) 맵[sid] = 조각.join(' | ').slice(0, 70);
  });
  return { 맵: 맵, 버린행: 버린행 };
}

/* [v9.252 · #Q104] 성취 이력 → 「오늘의 한 문장」의 **근거**. `achievements` 도달(설계 §8-6).
 *
 * ■ 원신호가 **구조적으로** 못 보는 것 = 「이 학생이 무엇을 해냈나」.
 *   ① 절의 개인화 입력은 전수로 **결핍 축**이다 — 약점(`aiWeakMap_` 오류태그) · 지난 오답
 *   (`퀴즈오답맵_`) · 창이 빈 사람(`복귀창_`) · 입학 자기보고(`pain`). `aiStudents_` 가 profiles
 *   에서 긁는 15칸에도 성취는 없고(최고스트릭 `stk` 는 싣기만 하고 ① 절이 안 쓴다), 칭호는
 *   카드 렌더(`Code.js` titleLine)에서만 산다. 그래서 모델이 그 학생에 대해 아는 사실이 **전부
 *   실패뿐**이었고, 「응원 + 미니미션」은 근거를 못 댄 채 막연할 수밖에 없었다.
 *
 * ■ 왜 `achievements` 여야만 하나 — **히든 3종은 재계산이 원리상 불가능하다.**
 *   `checkAchievements` 는 히든을 라이브 point_logs **당월**로만 잡고 아카이브는 안 본다.
 *   월간 아카이빙이 지나가면 그 사실은 이 탭 말고 어디에도 안 남는다(`getHours()` 는 엔진
 *   전체에서 그 한 곳뿐이다). 「언제 움직이는가」의 유일한 영구 흔적이라, 철학 ㉡(어떤 습관이며
 *   언제 집중이 오르는가 — 대장에서 «돈다» 0인 층)의 실물 재료가 여기 있다.
 *
 * ■ 🚫 **등수에서 나온 업적은 안 싣는다** — 철학 「하지 않는 것 ㉢」(학생끼리 비교하지 않는다).
 *   목록의 정본은 `엔진_운영배치.js` `순위파생업적_()` 하나다(이름을 여기 다시 적으면 갈라지고,
 *   갈라진 쪽은 **거름망이 조용히 비는** 방향으로 샌다 = 위반이 초록으로 돈다).
 *   ⚠ `진짜 주인공`(제 점수 3연속 상승)은 자기 경신이라 대상이 아니다 — 철학이 허용한 유일한
 *   비교가 그것이다.
 *
 * ■ 대가(신뢰성 맹점 ④) — 틀릴 때의 모습 = **조용히 빈 맵**이다. 탭이 없거나·폭이 모자라거나·
 *   전부 걸러지면 겉모습이 「아직 아무도 못 해냄」과 똑같다. 그래서 `거른행` 을 세어 돌려주고
 *   호출부가 분모와 함께 적는다(0 은 분모와 함께 · 유호 확정 08-14).
 *   닫을 것 = **폭 클램프**(구 시트에서 4열을 요구하면 예외가 나고 그러면 ① 절 전체가 죽는다 —
 *   `퀴즈오답맵_` 이 v9.209 에서 배운 그 자리). 안 닫은 것 = 「마지막 이정표 이후 며칠」 같은
 *   정체 판정은 **안 만들었다**(새 판정 축인데 미개원이라 검증 표본이 0이다).
 *
 * @param {!Object} ss 스프레드시트
 * @returns {{맵: !Object, 거른행: number}} 맵 = 학생ID → 프롬프트에 실을 한 줄(70자 컷)
 */
function 성취맵_(ss) {
  const 맵 = {};
  let 거른행 = 0;
  const ach = ss.getSheetByName('achievements');
  if (!ach || ach.getLastRow() < 2) return { 맵: 맵, 거른행: 0 };
  /* 폭 클램프 — 위 「닫을 것」. ⚠ **흉내로는 못 재는 자리다**(`퀴즈오답맵_` 의 같은 줄과 같은 성질):
   *   시트흉내 계약 ⑥ 은 «요청한 폭»을 늘 채워 주므로, 이 `Math.min` 을 지워도 회귀는 초록이다
   *   (실측 — 변이 ⑥ 이 구멍으로 남았다). 던지는 것은 라이브 Range 뿐이다. **초록의 근거가
   *   아니라서 여기 적어 둔다** — 이 줄을 지우면 구 시트에서 ① 절 전체가 그날 밤 안 돈다. */
  const w = Math.min(4, ach.getLastColumn());
  if (w < 3) return { 맵: 맵, 거른행: 0 };    // 등급 칸이 없으면 히든을 못 가른다
  const 금지 = {};
  순위파생업적_().forEach(n => { 금지[n] = 1; });
  const 결 = 히든업적결_();
  const agg = {};
  ach.getRange(2, 1, ach.getLastRow() - 1, w).getValues().forEach(r => {
    const sid = String(r[0] || '').trim();
    const 이름 = String(r[1] || '').trim();
    if (!sid || !이름) return;
    if (금지[이름]) { 거른행++; return; } // 세지 않으면 이 거름이 「원래 없음」과 구분이 안 된다
    const d = w >= 4 ? toDate_(r[3]) : null;
    (agg[sid] = agg[sid] || []).push({ 이름: 이름, 결: 결[이름] || '', t: d ? d.getTime() : 0 });
  });
  Object.keys(agg).forEach(sid => {
    const 다 = agg[sid];
    /* 리듬(히든)은 **뜻**으로 싣는다 — 이름만 주면 모델이 조건을 지어낸다. 이정표는 이름 그대로
     *   싣되 최근 둘까지만(약점이 `slice(-2)` 인 것과 같은 눈금 — 한쪽만 길면 그쪽으로 쏠린다). */
    const 리듬 = 다.filter(x => x.결).map(x => x.결);
    const 이정표 = 다.filter(x => !x.결).sort((a, b) => b.t - a.t).slice(0, 2).map(x => x.이름);
    const 조각 = [];
    if (리듬.length) 조각.push('리듬: ' + 리듬.join(' · '));
    if (이정표.length) 조각.push('이정표: ' + 이정표.join(' · '));
    if (조각.length) 맵[sid] = 조각.join(' | ').slice(0, 70);
  });
  return { 맵: 맵, 거른행: 거른행 };
}

// ── 야간 오케스트레이터: H1 한 문장 + A1/A2/A4 개인 퀴즈 + G 오류사전 + H5 반 브리핑 + E5 리텐션 멘트 ──
function aiStudioBatch_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('CLAUDE_API_KEY');
  if (!apiKey) return;
  const tz = ss.getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const t0 = Date.now(), BUDGET_MS = 100000;
  let calls = 0, made = 0, errs = [];
  const can = () => calls < AI_STUDIO_MAX_CALLS && (Date.now() - t0) < BUDGET_MS;

  const ad = ensureSheet(ss, 'ai_daily', ['student_id', '날짜', '한문장', '퀴즈문제', '퀴즈정답해설']);
  /* 프룬 — 어제 이전 행을 ai_daily에서 내린다(시트 비대·다음날 오독 방지). 남길 것 = 오늘·어제
   * [v9.188] 두 가지를 고쳤다. 구 코드는 **그냥 지웠다** —
   *   ① 아카이브 0: 학생별 맞춤 문제·해설이 매일 밤 영구 소실됐다. 그건 quiz_log 응답이 가리키는
   *      문항 원문이자 3년차 봇 학습 재료다(소급 불가라 하루 지나면 되찾을 방법이 없다).
   *      → ai_daily_archive로 **옮긴 뒤에** 지운다. 옮기기가 실패하면 지우지도 않는다.
   *   ② 순서: clearContent가 setValues보다 **먼저**라, 그 사이 6분 타임아웃이 나면 남겼어야 할
   *      오늘 것까지 사라졌다. → 살릴 것을 먼저 쓰고 **남은 구간만** 지운다(중간에 죽어도 데이터는 온전). */
  if (ad.getLastRow() >= 2) {
    const keepD = {}; keepD[today] = 1;
    keepD[Utilities.formatDate(new Date(Date.now() - 86400000), tz, 'yyyy-MM-dd')] = 1;
    const allD = ad.getRange(2, 1, ad.getLastRow() - 1, 5).getValues().filter(r => String(r[0] || '').trim());
    const oldD = allD.filter(r => !keepD[String(r[1])]);
    if (oldD.length) {
      const arcD = ensureSheet(ss, 'ai_daily_archive', ['student_id', '날짜', '한문장', '퀴즈문제', '퀴즈정답해설']);
      arcD.getRange(arcD.getLastRow() + 1, 1, oldD.length, 5).setValues(oldD); // 실패하면 여기서 던진다 — 아래 삭제에 닿지 않는다
      const rowsD = allD.filter(r => keepD[String(r[1])]);
      if (rowsD.length) ad.getRange(2, 1, rowsD.length, 5).setValues(rowsD);
      const restD = (ad.getLastRow() - 1) - rowsD.length;
      if (restD > 0) ad.getRange(2 + rowsD.length, 1, restD, 5).clearContent();
    }
  }
  const doneToday = {};
  if (ad.getLastRow() >= 2) ad.getRange(2, 1, ad.getLastRow() - 1, 2).getValues().forEach(r => { if (String(r[1]) === today) doneToday[String(r[0]).trim()] = 1; });

  // [v9.54] 학생·약점 로더 지연 메모이즈 — ①(한문장)과 ③(반브리핑)이 profiles·student_errors·hw_feedback
  //   전량을 각각 중복 read하던 것을 1회로. 실패 시 캐시가 남지 않으므로 섹션별 try 격리(뒤 섹션이 재시도)는 유지된다.
  let _stusAll = null, _weakAll = null, _복귀All = null;
  const stusAll_ = () => (_stusAll || (_stusAll = aiStudents_(ss)));
  /* [v9.250 · #Q99 5/5] 재료 창 — 돌아온 학생은 통상 14일 창이 비어 있다(위 `복귀창_`).
   *   약점맵과 같은 메모이즈에 태우는 이유: ①(개인 퀴즈)과 ③(반 브리핑)이 같은 약점맵을 나눠 쓰는데,
   *   창을 한쪽에만 넓히면 **같은 학생이 두 산출에서 다른 사람이 된다.** */
  const 복귀All_ = () => (_복귀All || (_복귀All = 복귀창_(ss)));
  const weakAll_ = () => (_weakAll || (_weakAll = aiWeakMap_(ss, 복귀All_())));

  // ① H1/A1/A2/A4 — 학생별 오늘의 한 문장 + 약점 퀴즈(관심사 반영), 배치 호출
  try {
    const stus = stusAll_().filter(s => !doneToday[s.id]);
    const weak = weakAll_();
    /* [v9.247 · #Q99] 지난 퀴즈 되읽기 — 출제 → 응답 → **재출제**의 마지막 칸(위 `퀴즈오답맵_`).
     *   ① 절에서만 부른다: 이 재료의 과녁은 개인 퀴즈 한 곳이고, ③반브리핑은 안 건드린다.
     *   ([09-04] 함께 적혀 있던 «연습노트»는 걷혔다 — 판단은 그대로다.) */
    const 복귀 = 복귀All_();
    const 지난퀴즈 = 퀴즈오답맵_(ss, 복귀);
    /* [v9.252 · #Q104] 성취 이력 — ① 절에서만 부른다(과녁이 「오늘의 한 문장」 하나다).
     *   ③반브리핑은 안 건드린다: 반 단위 글에 개인 성취를 실으면 그 자리가 곧 비교다.
     *   ([09-04] 함께 적혀 있던 «연습노트»는 걷혔다 — 판단은 그대로다.) */
    const 성취 = 성취맵_(ss);
    /* 0 은 분모와 함께 읽는다(유호 확정 08-14) — 안 그러면 「지난 퀴즈로 재출제한다」가
     *   재료를 받은 학생 0명이어도 참이 된다. 버린 행은 위 «조용한 손실»을 드러내는 자리다. */
    Logger.log('개인 퀴즈 재출제 재료: 대상 ' + stus.length + '명 = 지난 퀴즈 있는 '
      + stus.filter(s => 지난퀴즈.맵[s.id]).length + '명 + 없는 '
      + stus.filter(s => !지난퀴즈.맵[s.id]).length + '명'
      + (지난퀴즈.버린행 ? ' · 문항 스냅샷이 비어 버린 행 ' + 지난퀴즈.버린행 + '건' : ''));
    /* [v9.250 · #Q99 5/5] 같은 규율 — 「돌아온 학생의 창을 넓힌다」가 **넓힌 사람 0명이어도 참**이 되지
     *   않게 분모를 쪼갠다. 「돌아온 사람」은 퇴소 이력과 오늘 명부의 **교집합**이라 여기서만 셀 수 있다. */
    /* [v9.252 · #Q104] 같은 규율 — 「성취를 근거로 쓴다」가 **재료 받은 학생 0명이어도 참**이 되지
     *   않게 분모를 쪼갠다. 거른 행(등수 파생)을 함께 적는 이유는 그 거름이 «원래 없음»과 겉모습이
     *   같아서다 — 안 세면 철학 ㉢ 가드가 도는지 안 도는지 어느 로그에도 안 남는다. */
    Logger.log('성취 근거: 대상 ' + stus.length + '명 = 성취 있는 '
      + stus.filter(s => 성취.맵[s.id]).length + '명 + 없는 '
      + stus.filter(s => !성취.맵[s.id]).length + '명'
      + (성취.거른행 ? ' · 등수 파생이라 뺀 행 ' + 성취.거른행 + '건(철학 ㉢)' : ''));
    const 복귀중 = stus.filter(s => 복귀.맵[s.id]).length;
    Logger.log('복귀 재료 창: 오늘 대상 ' + stus.length + '명 = 창 넓힌 복귀 ' + 복귀중
      + '명 + 통상 ' + (stus.length - 복귀중) + '명'
      + ' · 퇴소 이력 ' + Object.keys(복귀.맵).length + '명(상한 안, 명부 밖 포함) + '
      + 복귀.상한밖 + '명(공백 ' + 복귀_공백상한일 + '일 초과 — 안 넓힘)');
    const schema = {
      type: 'object', additionalProperties: false, required: ['items'],
      properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['i', 's', 'q', 'a'], properties: {
        i: { type: 'integer', description: '입력 목록의 인덱스' },
        s: { type: 'string', description: '오늘의 한 문장 — 그 학생의 약점·관심사를 반영한 짧은 한국어 응원+미니미션 1문장(60자 이내, 몽골어 병기 금지)' },
        /* [v9.221] 보기 마커를 프롬프트가 못박는다 — 채점기가 아는 마커는 ①②③④⑤(원문자)와 맨숫자뿐이다
         *   (quizNorm_ 의 원문자→숫자 치환 · quizAnswerKeys_ 의 '① 에' 분해). 모델이 「(나) 이에요」·「가. 이에요」로
         *   내면 정답 키가 '나이에요' 한 덩이로 굳어, 보기 본문만 쓴 학생이 **판정보류가 아니라 오답**으로 적힌다 —
         *   보류를 오답으로 뭉개지 않으려고 채점기를 세 갈래로 만든 그 원칙(엔진_수집.js:240)이 생산자 쪽에서 뚫린다.
         *   라이브 개인퀴즈 27행이 이미 전부 ①② 2지선다라, 이 줄은 새 규약이 아니라 **이미 도는 모양의 못박기**다.
         *   ⚠ 채점기를 넓혀 푸는 쪽이 아니다 — 마커가 열마다 갈리면 그때부터 소급 파싱이 불가능해진다(L0 §3-3).
         * [v9.222] 금지 목록을 괄호가 아니라 「」로 감싼다 — v9.221 은 `적는다(1) · (1) · … 금지)` 라
         *   적어 **열린 괄호를 목록의 첫 항목 `1)` 이 닫았다**: 모델이 읽는 문장이 「적는다(1)」이 되어
         *   금지하려던 마커가 예시 자리에 붙는다. 길이도 「보기까지 합쳐」로 못박았다 — 보기를 문제 안에
         *   넣게 한 이상 80자가 문제만 뜻하면 아래 slice(0,140)이 **보기를 잘라** 같은 사고가 된다. */
        q: { type: 'string', description: '오늘의 퀴즈 문제 1개 — 약점 문법 기반 빈칸/선택 문제, 한국어(보기까지 합쳐 80자 이내). 선택 문제면 보기를 문제 안에 ①②③④ 마커로 적는다 — 「1)」·「(1)」·「가.」 같은 다른 마커 금지.' },
        a: { type: 'string', description: '정답 — 왜 그런지 해설 1문장(몽골어)을 덧붙인다. 형식: "정답: X — 해설(몽골어)". 선택 문제면 X 는 「② 이에요」처럼 마커와 보기 본문을 함께 적는다' } } } } }
    };
    for (let off = 0; off < stus.length && can(); off += AI_DAILY_BATCH_SIZE) {
      const chunk = stus.slice(off, off + AI_DAILY_BATCH_SIZE);
      // [v9.84] 콜드스타트 폴백 사슬 — 최애=학생 자기선언(DA105)‖상담취향, 목표=드림(CB80)‖상담목표‖핵심비전,
      //   약점=student_errors‖상담 자기보고(입학 첫 주라 앱 기록이 0이어도 상담 답으로 첫날부터 개인화)
      const userMsg = chunk.map((s, i) => {
        const fv = s.fav || s.taste, gl = s.dream || s.cGoal || s.vision;
        const wk = (weak[s.id] || []).slice(-2).join(' / ') || (s.pain ? '입학 자기보고: ' + s.pain.slice(0, 40) : '기록 없음');
        // [v9.247 · #Q99] 별도 칸으로 싣는다 — 약점 칸에 합치면 slice(-2)가 강사 손메모를 밀어낸다
        const qz = 지난퀴즈.맵[s.id] || '';
        // [v9.252 · #Q104] 별도 칸 — 약점 칸에 합치면 slice(-2)가 강사 손메모를 밀어낸다(v9.247 과 같은 이유)
        const ac = 성취.맵[s.id] || '';
        // [v9.206] 이름은 싣지 않는다(방향 불변식 4) — 매칭은 인덱스 i가 지고, 산출 칸(s·q·a)에 이름 자리가 없다
        return i + '. 급수 ' + (s.lv || '미정') +
          ' | 약점: ' + wk +
          (qz ? ' | 지난 퀴즈: ' + qz : '') +
          (ac ? ' | 해낸 것: ' + ac : '') +
          (fv ? ' | 최애: ' + fv.slice(0, 40) : '') + (gl ? ' | 목표: ' + gl.slice(0, 30) : '');
      }).join('\n');
      try {
        calls++;
        const out = aiCall_(apiKey,
          'SYNK LAB(몽골 울란바토르, 뇌과학 기반 게임화 한국어 학원)의 개인화 튜터. 학생마다 오늘의 한 문장(응원+미니미션)과 약점 기반 퀴즈 1문제를 만든다. ' +
          '약점이 있으면 반드시 그 문법을 쓰고, 최애(아이돌·게임)가 있으면 예문 소재로 자연스럽게 쓴다(사실 주장 금지 — 가상 서술만). 따뜻하되 과장 없는 반말 응원 톤. ' +
          /* [v9.247 · #Q99] 재출제 지시 — 재료만 실으면 모델이 무시할 수 있다. 「찍어서 맞힘」을 따로 말해 주는
           *   이유: 그 학생은 채점상 «맞은 학생»이라, 지시가 없으면 모델이 굳이 다시 낼 이유를 못 찾는다. */
          '「지난 퀴즈」가 실려 있으면 그 문법을 다시 낸다 — 같은 문제를 그대로 베끼지 말고 같은 문법의 새 문제로. ' +
          '「찍어서 맞힘」은 맞았어도 아직 모르는 것이니 틀린 것과 똑같이 다시 낸다. ' +
          /* [v9.252 · #Q104] 성취 지시 — 재료만 실으면 모델이 무시한다(v9.247 이 배운 자리).
           *   ⚠ 뒤집힘을 막는 두 줄이 핵심이다: 성취 재료는 그대로 두면 「그때는 했는데 지금은」
           *   이라는 질책으로 쓰이기 쉽고, 그러면 케어 재료가 압박 재료가 된다. 그리고 성취를
           *   말하는 순간이 비교가 새는 자리라 여기서 한 번 더 못박는다(철학 ㉢). */
          '「해낸 것」이 실려 있으면 응원을 그 사실에 **근거해서** 쓴다 — 막연한 칭찬 대신 그 학생이 실제로 해낸 것을 짚는다. ' +
          '그중 「리듬」은 그 사람이 언제·어떻게 움직이는지라, 미니미션을 그 리듬에 맞춰 낸다. ' +
          '🚫 해낸 것을 «지금은 못 한다»는 지적의 재료로 쓰지 않는다. 🚫 다른 학생·평균·등수와 비교하는 말은 어떤 형태로도 쓰지 않는다.',
          '학생 목록:\n' + userMsg, schema, 8096);
        const rowsN = [];
        (out.items || []).forEach(it => {
          const s = chunk[it.i];
          if (!s || !it.s || !it.q) return;
          rowsN.push([s.id, today, String(it.s).slice(0, 90), String(it.q).slice(0, 140), String(it.a || '').slice(0, 180)]);
        });
        if (rowsN.length) { ad.getRange(ad.getLastRow() + 1, 1, rowsN.length, 5).setValues(rowsN); made += rowsN.length; }
        Utilities.sleep(300);
      } catch (e1) { errs.push('한문장 배치: ' + String(e1.message || e1).slice(0, 80)); if (!(e1 && e1.permanent)) break; } // [v9.224] 영구(옛글자)는 이 청크만 버리고 다음 청크 진행 — break 는 일시 장애 백오프 몫(리뷰 P1-1)
    }
  } catch (e) { errs.push('한문장 준비: ' + String(e.message || e).slice(0, 80)); }

  // ② G 오류사전 — 첨삭 신규분에서 몽골어 화자 오류 패턴 축적(학생 식별 정보 저장 안 함 — 비식별 원칙)
  try {
    const fb = ss.getSheetByName('hw_feedback');
    if (fb && fb.getLastRow() >= 2 && can()) {
      const from = Number(props.getProperty('오류뱅크_포인터')) || 1;
      const last = fb.getLastRow();
      if (from < last) {
        const 슬라이스 = fb.getRange(from + 1, 1, Math.min(last - from, 40), 9).getValues();
        /* [v9.63→v9.211]→[v9.212] 게이트 미달분은 오류사전 재료에서 제외(판정 정본=노출카드_, 오류뱅크전진_ 안).
         * 커서는 판정 전(대기·빈칸·복구 창 안의 격리) 행 앞에서 멈춘다 — 필터 전 행 수로 전진하면 수동 검수
         * 모드의 대기 카드가, 격리를 즉시 닫힘으로 접으면 다음 날 아침의 격리 오탐 복구(야간 메일 안내)가
         * 승인 뒤에도 커서 뒤라 영구 누락된다(재검수 P1 두 계열 — 제출일(C)이 격리 복구 창의 기준이다). */
        const 커서 = 오류뱅크전진_(슬라이스.map(r => r[8]), 슬라이스.map(r => r[2]), Date.now());
        const rowsF = 커서.집을행
          .map(i => 슬라이스[i])
          .map(r => ({ sub: String(r[3] || '').slice(0, 120), fix: String(r[4] || '').slice(0, 120), pt: String(r[5] || '').slice(0, 80) }))
          .filter(x => x.sub && x.fix);
        if (rowsF.length) {
          const ebSchema = { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: {
            type: 'object', additionalProperties: false, required: ['type', 'pattern'], properties: {
              type: { type: 'string', description: '오류 유형(조사/어순/시제/어휘/철자/높임 등 짧은 분류)' },
              pattern: { type: 'string', description: '몽골어 화자 특유 패턴 일반화 1문장 — 학생 이름·개인정보 금지' } } } } } };
          calls++;
          let out;
          try {
            out = aiCall_(apiKey,
              '몽골어 화자의 한국어 오류를 분류·일반화하는 언어학 조수. 개별 문장에서 개인 정보를 제거하고 오류 유형과 패턴만 추출한다.',
              '오류 사례(제출→교정):\n' + rowsF.map(x => x.sub + ' → ' + x.fix + (x.pt ? ' (' + x.pt + ')' : '')).join('\n'), ebSchema, 4096);
          } catch (eAi) {
            /* [v9.226] 포이즌 필(리뷰 P2-④) — 판정은 오류뱅크포이즌_ 이 진다. rethrow 하는 이유:
             *   처분(errs 기록·이 갈래 중단)은 바깥 catch 가 이미 지고 있고 손으로 겹쳐 적으면 갈라진다. */
            const 판 = 오류뱅크포이즌_(props.getProperty('오류뱅크_연속실패'), 커서.전진);
            if (판.전진) {
              props.setProperty('오류뱅크_포인터', String(from + 커서.전진));
              props.deleteProperty('오류뱅크_연속실패');
              Logger.log('오류사전 포이즌 필: 연속 3회 실패 — 행 ' + (from + 1) + '~' + (from + 커서.전진) + ' 을 재료에서 제외하고 전진(원본 hw_feedback 행은 그대로다)');
            } else {
              props.setProperty('오류뱅크_연속실패', String(판.카운터));
            }
            throw eAi;
          }
          props.deleteProperty('오류뱅크_연속실패'); // 성공 — 연속 실패 흐름이 끊겼다
          const eb = ensureSheet(ss, 'error_bank', ['월', '오류유형', '패턴', 'created_at']);
          const ym = today.slice(0, 7);
          const rowsE = (out.items || []).slice(0, 20).map(it => [ym, String(it.type || '').slice(0, 20), String(it.pattern || '').slice(0, 160), today]);
          if (rowsE.length) eb.getRange(eb.getLastRow() + 1, 1, rowsE.length, 4).setValues(rowsE);
        }
        if (커서.전진) props.setProperty('오류뱅크_포인터', String(from + 커서.전진)); // 성공 시에만 전진(실패는 throw로 위 catch)
        if (커서.전진 < 슬라이스.length) Logger.log('오류사전 커서 보류: 판정 전(대기·격리 복구 창) 행 앞에서 멈춤 — 확정(승인·복구·창 경과) 뒤 다음 밤에 같은 자리부터 집는다');
      }
    }
  } catch (e) { errs.push('오류사전: ' + String(e.message || e).slice(0, 80)); }

  // ③ H5 반 브리핑 한 줄 — 반별 약점·주간 흐름을 강사용 1문장으로(있으면 calcAll이 브리핑⑨ 최상단에 병합)
  try {
    const cs = ss.getSheetByName('class_stats');
    if (cs && cs.getLastRow() >= 2 && can()) {
      const weak = weakAll_(); // [v9.54] ①에서 로드했으면 재사용
      const stus = stusAll_();
      const wkByCls = {};
      stus.forEach(s => { (weak[s.id] || []).slice(-1).forEach(w => (wkByCls[s.cls] = wkByCls[s.cls] || []).push(w)); });
      const clsRows = cs.getRange(2, 1, cs.getLastRow() - 1, 8).getValues().filter(r => r[0] && Number(r[1]) > 0);
      if (clsRows.length) {
        const bSchema = { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: {
          type: 'object', additionalProperties: false, required: ['c', 'line'], properties: {
            c: { type: 'string' }, line: { type: 'string', description: '그 반 강사에게 주는 오늘의 포인트 1문장(한국어, 100자 이내, 구체적으로)' } } } } } };
        calls++;
        const out = aiCall_(apiKey, 'SYNK LAB 강사 브리핑 조수. 반별 데이터로 오늘 수업에서 챙길 포인트 1문장씩.',
          clsRows.map(r => r[0] + ' | 인원 ' + r[1] + ' | 주간평균 ' + r[7] + 'P | 최근 약점: ' + ((wkByCls[r[0]] || []).slice(0, 3).join(', ') || '없음')).join('\n'),
          bSchema, 4096);
        const map = {};
        (out.items || []).forEach(it => { if (it.c && it.line) map[String(it.c)] = String(it.line).slice(0, 140); });
        setState(ensureSheet(ss, 'app_state', ['key', 'value']), '반브리핑AI', JSON.stringify(map));
      }
    }
  } catch (e) { errs.push('반브리핑: ' + String(e.message || e).slice(0, 80)); }

  // ④ E5 리텐션 개입 멘트 — 감지(규칙·calcAll)가 남긴 목록에 문구만 생성
  try {
    const st = ensureSheet(ss, 'app_state', ['key', 'value']);
    let list = [];
    try { list = JSON.parse(String(getState(st, '리텐션목록').val || '[]')) || []; } catch (eL) { list = []; }
    if (!list.length) setState(st, '리텐션멘트', '{}');
    else if (can()) {
      const rSchema = { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['i', 'line'], properties: {
          i: { type: 'integer', description: '입력 목록의 인덱스' }, line: { type: 'string', description: '원장·강사가 그 학생(또는 학부모)에게 건넬 개입 멘트 1문장(한국어, 80자 이내, 다그침 금지·구체적 다리 놓기)' } } } } } };
      calls++;
      // [v9.206] 이름은 싣지 않는다(방향 불변식 4) — 6자리 중 유일하게 이름이 응답 키였던 자리: 매칭은 인덱스, 이름 키는 되돌릴 때 붙인다(소비자 '리텐션멘트' 모양 불변)
      const out = aiCall_(apiKey, 'SYNK LAB 리텐션 조수. 관심이 필요한 학생별로 부담 없는 개입 멘트 1문장씩. 원인(사유)에 맞춰서.',
        list.map((x, i) => i + '. (' + x.c + ') — ' + x.w).join('\n'), rSchema, 3072);
      const map = {};
      (out.items || []).forEach(it => { const x = list[it.i]; if (x && x.n && it.line) map[String(x.n)] = String(it.line).slice(0, 120); });
      setState(st, '리텐션멘트', JSON.stringify(map));
    }
  } catch (e) { errs.push('리텐션멘트: ' + String(e.message || e).slice(0, 80)); }

  if (made || errs.length) adminMail('[SYNK] 🎛️ AI 스튜디오 야간 — 한문장·퀴즈 ' + made + '건' + (errs.length ? ' · 오류 ' + errs.length : ''),
    '호출 ' + calls + '회 (상한 ' + AI_STUDIO_MAX_CALLS + ')\n' + (errs.length ? '오류:\n' + errs.join('\n') + '\n(실패 항목은 내일 밤 자동 재시도)' : '정상'));
}

// ── F4 웰컴 스토리(아침) — 신규 등록 감지분 중 학부모 이메일이 채워진 학생에게 세계관 입장 편지 ──
function welcomeStoryBatch_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  let queue = [];
  try { queue = JSON.parse(props.getProperty('웰컴대기') || '[]') || []; } catch (e) { queue = []; }
  if (!queue.length) return;
  const tz = ss.getSpreadsheetTimeZone();
  const byId = {};
  aiStudents_(ss).forEach(s => { byId[s.id] = s; });
  const apiKey = props.getProperty('CLAUDE_API_KEY');
  const ledger = ensureSheet(ss, 'ai_ledger', ['유형', 'student_id', '키', '값', 'created_at']);
  const remain = [], today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  let sent = 0;
  queue.forEach(id => {
    const s = byId[id];
    if (!s) return; // 프로필에서 사라짐(퇴소·오입력) — 큐에서 제거
    const ageD = s.created ? Math.floor((Date.now() - new Date(s.created).getTime()) / 86400000) : 0;
    if (ageD > 45) return; // 45일 지난 웰컴은 의미 없음 — 조용히 폐기
    if (!s.pEmail) { remain.push(id); return; } // 이메일 대기(§1-3 입력 전)
    if (!quotaOk(1)) { remain.push(id); return; }
    let story = null;
    // [v9.147] AI 호출만 끈다(STORY_AI_ON=false) — **기능은 유지**. 이 메일은 학부모 첫 접점이라(개원일엔 전원 신규)
    //   연출로 분류해 폐지하면 학원비를 내는 쪽의 첫인상 채널이 사라진다. 아래 템플릿 폴백이 그대로 발송된다.
    if (apiKey && STORY_AI_ON) story = aiText_('SYNK LAB(몽골 울란바토르, 뇌과학 기반 게임화 한국어 학원)의 웰컴 스토리 작가. 신규 학생 "' + s.n + '"' +
      ((s.dream || s.cGoal) ? '(목표: ' + (s.dream || s.cGoal).slice(0, 40) + ')' : '') + (s.vision ? '(비전 메모: ' + s.vision.slice(0, 40) + ')' : '') + // [v9.84] 신규생은 드림 입력 전 — 상담목표 폴백
      '의 세계관 입장 스토리를 5~7문장 한국어로. 시냅스 크루로 임명되는 서사, 성장 파트너와의 첫 만남 예고("몬스터"라는 단어는 쓰지 않기), 따뜻하고 과장 없는 톤. 인사말·서명 없이 본문만.', 1024); // [v9.74] 학부모 수신 편지 — 몬스터→성장 파트너
    if (!story) story = s.n + ' 크루의 시냅스 여정이 시작됩니다. 첫 출석의 순간, 성장 파트너가 깨어나고 매일의 기록이 이야기가 됩니다. ' +
      'SYNK LAB의 모든 스토리는 실제 기록으로 만들어집니다 — 이제 주인공은 ' + s.n + ' 입니다.';
    MailApp.sendEmail(s.pEmail, '[SYNK] 🌟 ' + s.n + ' 크루 임명장',
      s.n + ' 크루의 입학을 환영합니다!\n\n' + story + '\n\n— SYNK LAB 드림\n(앱에서 ' + s.n + '의 여정 카드가 오늘부터 자랍니다)');
    ledger.appendRow(['웰컴', id, today, '', today]);
    sent++;
  });
  props.setProperty('웰컴대기', JSON.stringify(remain));
  if (sent) adminMail('[SYNK] 🌟 웰컴 스토리 ' + sent + '건 발송', '신규 크루 웰컴 편지가 학부모 메일로 나갔습니다. (대기 잔여 ' + remain.length + '건 — 이메일 입력되면 다음 아침 발송)');
}

// ── B3 이달의 AI 유니크 칭호(월간) — 전월 활동 패턴 → 학생별 긍정 전용 칭호 1개, 여정 카드 노출 ──
function aiMonthlyTitles_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('CLAUDE_API_KEY');
  if (!apiKey) return;
  const tz = ss.getSpreadsheetTimeZone();
  const ym = Utilities.formatDate(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), tz, 'yyyy-MM');
  const ledger = ensureSheet(ss, 'ai_ledger', ['유형', 'student_id', '키', '값', 'created_at']);
  if (ledger.getLastRow() >= 2 && ledger.getRange(2, 1, ledger.getLastRow() - 1, 3).getValues()
    .some(r => String(r[0]) === '칭호' && String(r[2]) === ym)) return; // 월키 멱등
  const pl = ss.getSheetByName('point_logs');
  const act = {};
  if (pl && pl.getLastRow() >= 2) pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => {
    if (!r[1] || !r[5] || dstr(r[5], tz).indexOf(ym) !== 0) return;
    const pts = Number(r[2]) || 0;
    if (pts <= 0) return;
    const a = act[String(r[1]).trim()] = act[String(r[1]).trim()] || { p: 0, rs: {} };
    a.p += pts;
    const rs = String(r[3] || '');
    if (rs) a.rs[rs] = (a.rs[rs] || 0) + 1;
  });
  const stus = aiStudents_(ss).filter(s => act[s.id] && act[s.id].p > 0);
  if (!stus.length) return;
  const tSchema = { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['i', 't'], properties: {
      i: { type: 'integer' }, t: { type: 'string', description: '유니크 칭호(한국어 6~12자) — 긍정 전용, 그 학생만의 패턴 반영. 지각·결석 등 부정 소재 절대 금지' } } } } } };
  const rows = [], today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  for (let off = 0; off < stus.length && off < 90; off += 30) {
    const chunk = stus.slice(off, off + 30);
    try {
      const out = aiCall_(apiKey, 'SYNK LAB(게임화 한국어 학원)의 칭호 작명가. 전월 활동 패턴으로 학생마다 겹치지 않는 긍정 칭호 1개씩("새벽의 문법사냥꾼" 같은 톤).',
        chunk.map((s, i) => {
          const a = act[s.id];
          const top = Object.keys(a.rs).sort((x, y) => a.rs[y] - a.rs[x]).slice(0, 2).join('·');
          // [v9.206] 이름은 싣지 않는다(방향 불변식 4) — 매칭은 인덱스 i(it.i → chunk[it.i])가 이미 지고 있다
          return i + '. 월 ' + a.p + 'P | 주활동: ' + (top || '출석') + ' | 캐릭터: ' + (s.stage || '-');
        }).join('\n'), tSchema, 4096);
      (out.items || []).forEach(it => {
        const s = chunk[it.i];
        if (s && it.t) rows.push(['칭호', s.id, ym, String(it.t).slice(0, 16), today]);
      });
      Utilities.sleep(300);
    } catch (e) { Logger.log('AI 칭호 배치 실패: ' + e); if (!(e && e.permanent)) break; } // [v9.224] 동형 — 영구(옛글자)는 다음 청크 진행(리뷰 P1-1)
  }
  if (rows.length) {
    ledger.getRange(ledger.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
    adminMail('[SYNK] 🎖️ 이달의 AI 칭호 ' + rows.length + '건', ym + ' 활동 기반 유니크 칭호가 여정 카드에 반영됩니다(다음 calcAll부터).');
  }
}

// ── B5 미래의 나 편지(월간) — 재원 80~110일 & 목표 보유 & 학부모 이메일 → 입학 목표 대조 편지 ──
function futureLetterBatch_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const tz = ss.getSpreadsheetTimeZone();
  const ym = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const ledger = ensureSheet(ss, 'ai_ledger', ['유형', 'student_id', '키', '값', 'created_at']);
  const sentIds = new Set();
  if (ledger.getLastRow() >= 2) ledger.getRange(2, 1, ledger.getLastRow() - 1, 2).getValues().forEach(r => { if (String(r[0]) === '편지') sentIds.add(String(r[1])); });
  const targets = aiStudents_(ss).filter(s => {
    if (sentIds.has(s.id) || !s.pEmail) return false;
    const goal = s.dream || s.cGoal || s.vision; // [v9.84] 상담목표(TOPIK 급수·기한)가 비전 카테고리보다 구체 — 인용 재료 승격
    if (!goal || !s.created) return false;
    const d = Math.floor((Date.now() - new Date(s.created).getTime()) / 86400000);
    return d >= 80 && d <= 110; // 재등록 결정 시점(3개월) 창
  });
  if (!targets.length) return;
  const apiKey = props.getProperty('CLAUDE_API_KEY');
  let sent = 0;
  targets.slice(0, 20).forEach(s => {
    if (!quotaOk(1)) return;
    const goal = s.dream || s.cGoal || s.vision; // [v9.84] 상담목표(TOPIK 급수·기한)가 비전 카테고리보다 구체 — 인용 재료 승격
    let letter = null;
    // [v9.147] AI 호출만 끈다(STORY_AI_ON=false) — 기능 유지·템플릿 폴백 발송(재등록 결정 시점 3개월 창의 학부모 편지)
    if (apiKey && STORY_AI_ON) letter = aiText_('SYNK LAB의 "미래의 나" 편지 작가. 3개월 전 입학하며 목표를 적은 학생에게, 그 목표를 인용하며 실제 데이터로 성장을 비추는 편지를 8~10문장 한국어로. ' +
      '규칙: "달성/미달" 판정 금지 — "얼마나 왔는지"만. 다정하되 과장 금지. 인사·서명 없이 본문만.\n' +
      '학생: ' + s.n + '\n입학 때 목표: "' + goal.slice(0, 60) + '"' +
      (s.topik0 ? '\n입학 때 TOPIK 실측: ' + s.topik0 + (s.lv ? ' → 지금 앱 급수 ' + s.lv + '급' : '') + ' (이 대조를 성장의 증거로 한 문장 녹일 것 — 급수 체계가 달라 직접 비교 단정은 금지)' : '') + // [v9.84·한수더] 입학 시점 실측 = 0점 좌표
      '\n누적 포인트: ' + s.total + 'P\n성장 파트너 단계: ' + (s.stage || '진행 중') + '\n연속 출석: ' + s.stk + '일', 1536); // [v9.74] 학부모 편지 — 몬스터→성장 파트너
    if (!letter) letter = '3개월 전, ' + s.n + '은(는) 이렇게 적었습니다 — "' + goal.slice(0, 60) + '"\n\n그날부터 지금까지 누적 ' + s.total + 'P, 성장 파트너는 ' +
      (s.stage || '성장 중') + ' 단계까지 왔습니다. 목표를 향해 걸어온 거리는 기록이 증명합니다. 다음 3개월의 이야기가 더 기대되는 이유입니다.';
    MailApp.sendEmail(s.pEmail, '[SYNK] 💌 ' + s.n + '에게 도착한 편지 — 3개월 전의 나로부터',
      '(자녀와 함께 읽어주세요)\n\n' + letter + '\n\n— SYNK LAB · 3개월의 기록으로 쓴 편지');
    ledger.appendRow(['편지', s.id, ym, '', today]);
    sent++;
  });
  if (sent) adminMail('[SYNK] 💌 미래의 나 편지 ' + sent + '건 발송', '3개월차 크루의 입학 목표 대조 편지가 나갔습니다 — 재등록 상담과 묶기 좋은 시점입니다.');
}

// ── H4-라이트 학부모 하이라이트 3장면(월간) — 몽골어는 사전 작성 템플릿만(AI 창작 0 · 원어민 검수 대상) ──
const HL_TPL = [ // [ko, mn] — {n}=이름 {x}=숫자 {t}=칭호. ⚠ 몽골어 문장은 원어민 검수 1회 권장(아이디어뱅크 선행 조건)
  ['{n}이(가) 이번 달 「{t}」 칭호를 받았어요.', '{n} энэ сард "{t}" цол хүртлээ.'],
  ['{n}의 성장 파트너가 새로운 단계로 진화했어요 — 꾸준함의 증거예요.', '{n}-ийн хамтрагч шинэ шатанд хувьслаа — тууштай байдлын баталгаа.'], // [v9.74] 학부모 접점 호칭 교체(성장 파트너·хамтрагч)
  ['이번 달 경험치 +{x}P를 모았어요.', 'Энэ сард +{x} оноо цуглууллаа.'],
  ['연속 출석 {x}일 — 습관이 실력이 되는 중이에요.', 'Дараалан {x} өдөр ирлээ — зуршил чадвар болж байна.'],
  ['이번 달도 교실에서 자기 자리를 지켰어요.', 'Энэ сард ч хичээлдээ тогтмол оролцлоо.']];
function parentHighlightsMail_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const tz = ss.getSpreadsheetTimeZone();
  const ym = Utilities.formatDate(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), tz, 'yyyy-MM');
  if (props.getProperty('하이라이트발송월') === ym) return; // 월키 멱등
  const doneSids = new Set(); // [v9.54] 이번 달 이미 발송된 학생 — 쿼터 보류 이어하기용(아래 quotaShort 참조)
  const holdHl = String(props.getProperty('하이라이트보류') || '');
  if (holdHl.indexOf(ym + '|') === 0) holdHl.slice(ym.length + 1).split(',').forEach(x => { if (x) doneSids.add(x); });
  const pl = ss.getSheetByName('point_logs');
  const ptsM = {};
  if (pl && pl.getLastRow() >= 2) pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => {
    if (!r[1] || !r[5] || dstr(r[5], tz).indexOf(ym) !== 0) return;
    const p = Number(r[2]) || 0;
    if (p > 0) ptsM[String(r[1]).trim()] = (ptsM[String(r[1]).trim()] || 0) + p;
  });
  const titleM = {};
  const tl = ss.getSheetByName('titles');
  if (tl && tl.getLastRow() >= 2) tl.getRange(2, 1, tl.getLastRow() - 1, 3).getValues().forEach(r => {
    if (String(r[0]) === ym && r[1] && !titleM[String(r[1]).trim()]) titleM[String(r[1]).trim()] = String(r[2] || '');
  });
  const pf = ss.getSheetByName('profiles');
  const evoM = {};
  if (pf && pf.getLastRow() >= 2 && pf.getMaxColumns() >= 54) pf.getRange(2, 1, pf.getLastRow() - 1, 54).getValues().forEach(r => {
    if (r[0] && r[3] === 'student' && String(r[53] || '').indexOf(ym) === 0) evoM[String(r[0]).trim()] = 1;
  });
  // [v9.54] 쿼터 보류 이어하기 — 발송 도중 일일 메일 쿼터가 바닥나면 월 마커를 찍지 않고 발송분만
  //   '하이라이트보류'(ym|sid,…)에 남기고, morningJobs가 매일 재호출해 남은 학생만 이어 보낸다
  //   (다이제스트보류 #31과 같은 처방). 구 구현은 쿼터 소진 시에도 마커를 무조건 세팅해
  //   뒤쪽 학생들이 그 달 하이라이트를 영영 못 받았다(조용한 유실).
  let sent = 0, quotaShort = false;
  // [v9.73] 설문 링크 틀 — 폼 미생성이면 빈값(메일은 기존 그대로). 만족도팩 누락에도 안전.
  const svTpl9 = (typeof MJ_surveyLine_ === 'function') ? String((getState(ensureSheet(ss, 'app_state', ['key', 'value']), '설문폼URL틀') || {}).val || '') : '';
  aiStudents_(ss).forEach(s => {
    if (!s.pEmail || doneSids.has(s.id) || quotaShort) return;
    if (!quotaOk(1)) { quotaShort = true; return; }
    const scenes = [];
    const fill = (ti, x, t) => scenes.push(HL_TPL[ti][0].replace('{n}', s.n).replace('{x}', x || '').replace('{t}', t || '') +
      '\n' + HL_TPL[ti][1].replace('{n}', s.n).replace('{x}', x || '').replace('{t}', t || ''));
    if (titleM[s.id]) fill(0, '', titleM[s.id]);
    if (evoM[s.id]) fill(1);
    if ((ptsM[s.id] || 0) >= 20) fill(2, String(ptsM[s.id]));
    if (scenes.length < 3 && s.stk >= 7) fill(3, String(s.stk));
    if (!scenes.length) return; // 데이터 없는 학생에게 지어내지 않는다 — 발송 생략
    while (scenes.length > 3) scenes.pop();
    MailApp.sendEmail(s.pEmail, '[SYNK] ✨ ' + s.n + ' — Энэ сарын гурван агшин (이달의 세 장면)',
      'Энэ сард ' + s.n + '-д ийм агшин байлаа:\n(이번 달 ' + s.n + '에게 이런 순간이 있었어요)\n\n' +
      scenes.map((sc, i) => (i + 1) + '. ' + sc).join('\n\n') + (svTpl9 ? MJ_surveyLine_(svTpl9, s.id) : '') + '\n\n— SYNK LAB'); // [v9.73] 월간 설문 링크 동봉(학생별 프리필)
    sent++; doneSids.add(s.id);
  });
  if (quotaShort) props.setProperty('하이라이트보류', ym + '|' + Array.from(doneSids).join(','));
  else { props.setProperty('하이라이트발송월', ym); props.deleteProperty('하이라이트보류'); }
  if (sent) adminMail('[SYNK] ✨ 학부모 하이라이트 ' + sent + '건 발송', ym + ' 실데이터 장면만 골라 발송(데이터 없는 학생은 생략 — 지어내지 않음).' + (quotaShort ? '\n⚠ 메일 쿼터 도달 — 남은 학생은 내일 아침 자동으로 이어 발송됩니다.' : ''));
}

// ── F2 SNS 성장 스토리 초안(월간) — 익명 집계만 사용(동의 체계 구축 전 개인 식별 정보 미사용) ──
function snsDrafts_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!apiKey) return;
  const tz = ss.getSpreadsheetTimeZone();
  const ym = Utilities.formatDate(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), tz, 'yyyy-MM');
  const sd = ensureSheet(ss, '스토리초안', ['월', '제목', '초안', '상태', 'created_at']);
  ymTextColFix_(sd, 1, tz); // [v9.97] — 여기 멱등이 깨지면 Claude API가 매달 중복 호출된다(비용)
  if (sd.getLastRow() >= 2 && sd.getRange(2, 1, sd.getLastRow() - 1, 1).getValues().some(r => ymTextOf_(r[0], tz) === ym)) return; // 월키 멱등
  const pl = ss.getSheetByName('point_logs');
  let totP = 0, evtN = 0;
  if (pl && pl.getLastRow() >= 2) pl.getRange(2, 1, pl.getLastRow() - 1, 6).getValues().forEach(r => {
    if (!r[5] || dstr(r[5], tz).indexOf(ym) !== 0) return;
    const p = Number(r[2]) || 0;
    if (p > 0) { totP += p; evtN++; }
  });
  if (!evtN) return; // 지난달 데이터 없음(개원 전) — 초안 생성 생략
  const pf = ss.getSheetByName('profiles');
  let evoN = 0, stuN = 0;
  if (pf && pf.getLastRow() >= 2 && pf.getMaxColumns() >= 54) pf.getRange(2, 1, pf.getLastRow() - 1, 54).getValues().forEach(r => {
    if (!r[0] || r[3] !== 'student') return;
    stuN++;
    if (String(r[53] || '').indexOf(ym) === 0) evoN++;
  });
  try {
    const sSchema = { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['t', 'd'], properties: {
        t: { type: 'string', description: '게시물 제목(한국어)' }, d: { type: 'string', description: 'FB 게시용 초안 6~9문장 — 한국어 본문 + 마지막에 몽골어 요약 2문장. 학생 실명·개인정보 금지(집계 숫자만)' } } } } } };
    const out = aiCall_(apiKey, 'SYNK LAB(몽골 울란바토르 게임화 한국어 학원) FB 페이지의 콘텐츠 작가. 과장 광고 톤 금지, 기록·숫자 기반 담백한 자랑.',
      ym + ' 집계: 크루 ' + stuN + '명 · 총 경험치 ' + totP + 'P · 기록 이벤트 ' + evtN + '건 · 캐릭터 진화 ' + evoN + '회.\n이 집계로 서로 다른 각도의 게시물 초안 3개.', sSchema, 4096);
    const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    const rows = (out.items || []).slice(0, 3).map(it => [ym, String(it.t || '').slice(0, 60), String(it.d || ''), '검수대기', today]);
    if (rows.length) {
      sd.getRange(sd.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
      adminMail('[SYNK] 📣 SNS 초안 ' + rows.length + '건 생성', '스토리초안 시트에서 검수 후 발행하세요(발행은 항상 사람 — 자동 게시 없음).');
    }
  } catch (e) { Logger.log('SNS 초안 실패: ' + e); }
}

/* ── F1 AI 레벨 진단 — 무료 테스트 폼 → 채점 → 몽골어 진단 리포트 → leads 편입 ──
 * createLevelTestForm(): 유호님이 에디터에서 1회 ▶ 실행(출석폼 패턴). 문항·정답키는 아래 상수 — 커리큘럼 정본 기준, 유호님 검수 환영. */
const LEVEL_TEST_Q = [ // [문항, 보기4, 정답 인덱스(0~3)]
  ['"안녕하세요"의 뜻은?', ['Баяртай', 'Сайн байна уу', 'Баярлалаа', 'Уучлаарай'], 1],
  ['다음 중 "물"은?', ['ус', 'гал', 'салхи', 'шороо'], 0],
  ['저는 학생___. 빈칸에 맞는 것은?', ['는', '이에요', '가', '를'], 1],
  ['"감사합니다"는 언제 쓰나요?', ['사과할 때', '고마울 때', '헤어질 때', '만날 때'], 1],
  ['숫자 "셋"은?', ['1', '2', '3', '4'], 2],
  ['"밥을 ___" 맞는 것은?', ['마셔요', '먹어요', '입어요', '신어요'], 1],
  ['어제 학교에 ___. 맞는 것은?', ['가요', '갈 거예요', '갔어요', '갑니다'], 2],
  ['"책이 책상 ___ 있어요"', ['위에', '위를', '위가', '위는'], 0],
  ['"바쁘___ 못 갔어요" — 이유를 나타내는 것은?', ['지만', '아서', '거나', '려고'], 1],
  ['높임말이 맞는 문장은?', ['선생님이 밥을 먹어요', '선생님께서 진지를 드세요', '선생님이 잘 자요', '선생님은 집에 가'], 1],
  ['"한국에 ___ 적이 있어요"(경험)', ['가는', '간', '갈', '가던'], 1],
  ['"비가 오___ 우산을 가져가세요"', ['니까', '지만', '거나', '도록'], 0],
  ['"동생은 키가 크___ 저는 작아요"(대조)', ['고', '지만', '아서', '니까'], 1],
  ['"열심히 공부했___ 시험을 잘 봤어요"(결과)', ['지만', '더니', '거나', '려고'], 1],
  ['"시간이 있___ 같이 영화 봐요"(조건)', ['어서', '으면', '지만', '고'], 1]];
function createLevelTestForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // [v9.60] 재실행 안전(멱등) — 구 버전은 무조건 새 폼을 만들고 마지막에 시트 이름만 바꿨다.
  //   그래서 두 번째 실행이 "이름이 '레벨테스트_응답'인 시트가 이미 있습니다"로 죽으면서
  //   ①쓸모없는 중복 폼 ②이름 없는 응답 시트 잔재를 남겼다(2026-07-24 22:23 실사고).
  //   이제 이미 있으면 만들지 않고 기존 URL을 돌려준다. URL 기록이 없으면 시트에 연결된
  //   폼에서 되찾아 app_state에 복구한다(수동 재생성 불필요).
  {
    const stX = ensureSheet(ss, 'app_state', ['key', 'value']);
    const shX = ss.getSheetByName('레벨테스트_응답');
    let urlX = '';
    try { urlX = String((getState(stX, '레벨테스트URL') || {}).val || '').trim(); } catch (eX) {}
    if (shX) {
      if (!urlX) { // 시트는 있는데 URL 기록만 없음 → 연결된 폼에서 회수
        try {
          const editUrl = shX.getFormUrl();
          if (editUrl) { urlX = FormApp.openByUrl(editUrl).getPublishedUrl(); setState(stX, '레벨테스트URL', urlX); }
        } catch (eY) { Logger.log('폼 URL 회수 실패: ' + eY.message); }
      }
      const msgX = urlX
        ? '이미 개통돼 있습니다 — 새로 만들지 않았습니다.\n공유 URL: ' + urlX
        : "'레벨테스트_응답' 시트는 있는데 연결된 폼을 찾지 못했습니다. 그 시트를 지운 뒤 다시 실행하면 새로 만듭니다.";
      Logger.log(msgX);
      return msgX;
    }
  }
  const before = {};
  ss.getSheets().forEach(sh => { before[sh.getName()] = 1; });
  const form = FormApp.create('SYNK LAB — 무료 한국어 레벨 테스트 (Үнэгүй түвшин тогтоох тест)');
  setState(ensureSheet(ss, 'app_state', ['key', 'value']), '레벨테스트URL', form.getPublishedUrl()); // [v9.94] 생성 즉시 기록 — 뒤 단계(응답 시트 연결)에서 타임아웃돼도 앱이 이 폼을 잃지 않는다
  form.setDescription('15문항 · 5분 · 결과는 몽골어 AI 진단 리포트로 이메일에 도착합니다.\n15 асуулт · 5 минут · Танд монгол хэлээр оношилгооны тайлан имэйлээр очно.');
  form.addTextItem().setTitle('이름 / Нэр').setRequired(true);
  form.addTextItem().setTitle('연락처 / Утас').setRequired(true);
  form.addTextItem().setTitle('이메일 / Имэйл (리포트 수신)').setRequired(true);
  LEVEL_TEST_Q.forEach((q, i) => {
    const item = form.addMultipleChoiceItem();
    item.setTitle((i + 1) + '. ' + q[0]).setChoices(q[1].map(c => item.createChoice(c))).setRequired(true);
  });
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  const fresh = ss.getSheets().filter(sh => !before[sh.getName()])[0];
  if (fresh) fresh.setName('레벨테스트_응답');
  setState(ensureSheet(ss, 'app_state', ['key', 'value']), '레벨테스트URL', form.getPublishedUrl());
  Logger.log('레벨 테스트 폼 생성 완료 — 공유 URL: ' + form.getPublishedUrl());
  return '레벨 테스트 준비 완료. FB·상담에 뿌릴 URL: ' + form.getPublishedUrl();
}

// [v9.60] 폼 재실행이 남긴 잔재 청소 — ▶ 수동 실행. 자동 생성 이름('설문지 응답 시트N'·'Form Responses N')이면서
//   **응답이 0건인 시트만** 지운다(이름 붙은 정본 시트·데이터 있는 시트는 절대 건드리지 않는다).
//   연결된 폼 파일 자체는 지우지 않고 편집 URL만 로그로 안내한다 — 유호님이 Drive에서 확인 후 삭제.
function cleanupOrphanFormSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pat = /^(설문지 응답 시트\d+|Form Responses \d+)$/;
  const removed = [], kept = [], forms = [];
  ss.getSheets().forEach(sh => {
    const nm = sh.getName();
    if (!pat.test(nm)) return;
    let furl = '';
    try { furl = sh.getFormUrl() || ''; } catch (e) {}
    if (sh.getLastRow() >= 2) { kept.push(nm + '(응답 ' + (sh.getLastRow() - 1) + '건 — 보존)'); return; }
    if (furl) forms.push(nm + ' → ' + furl);
    ss.deleteSheet(sh);
    removed.push(nm);
  });
  const msg = '잔재 청소: 삭제 ' + removed.length + '개' + (removed.length ? ' (' + removed.join(', ') + ')' : '') +
    (kept.length ? '\n보존(응답 있음): ' + kept.join(', ') : '') +
    (forms.length ? '\n\n⚠ 아래 폼 파일은 그대로 남아 있습니다 — Drive에서 확인 후 삭제하세요:\n' + forms.join('\n') : '');
  Logger.log(msg);
  return msg;
}
function sweepLevelTest_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const src = ss.getSheetByName('레벨테스트_응답');
  if (!src || src.getLastRow() < 2) return;
  const props = PropertiesService.getScriptProperties();
  const from = Number(props.getProperty('레벨테스트_포인터')) || 1;
  const last = src.getLastRow();
  if (from >= last) { if (from > last) props.setProperty('레벨테스트_포인터', String(last)); return; }
  const tz = ss.getSpreadsheetTimeZone();
  const rows = src.getRange(from + 1, 1, last - from, 4 + LEVEL_TEST_Q.length).getValues();
  const ld = ensureSheet(ss, 'leads', ['날짜', '이름', '연락처', '유입경로', '추천인', '체험참석', '등록', '등록권종', '등록일', '미등록사유', '메모', '캠페인']);
  let done = 0;
  const t0L = Date.now(); // [자체 예산] nightJobs 6분 하드킬 보호 — 초과분은 포인터가 남아 다음 밤 이어짐
  for (let i = 0; i < rows.length && done < 10 && Date.now() - t0L < 60000; i++) {
    const r = rows[i];
    const nm = String(r[1] || '').trim(), phone = String(r[2] || '').trim(), email = String(r[3] || '').trim();
    if (!nm) { props.setProperty('레벨테스트_포인터', String(from + i + 1)); continue; }
    let score = 0;
    LEVEL_TEST_Q.forEach((q, qi) => { if (String(r[4 + qi] || '') === q[1][q[2]]) score++; });
    const lvl = score <= 4 ? { n: '입문', d: '한글·기초 표현부터 탄탄하게' } : score <= 7 ? { n: '초급 1', d: '기초 문장 만들기 단계' }
      : score <= 10 ? { n: '초급 2', d: '일상 대화 확장 단계' } : score <= 12 ? { n: '중급 1', d: '이유·대조 등 연결 표현 단계' }
      : { n: '중급 2+', d: '심화 문형·유창성 단계' };
    // [v9.206] 이름은 싣지 않는다(방향 불변식 4) — 갈래②: AI는 이름 없이 쓰고 템플릿이 머리에 끼운다(아래 폴백이 원래 그 꼴)
    let report = aiText_('몽골 학생의 한국어 레벨 테스트 결과로 몽골어 진단 리포트를 써라. 형식: 몽골어 8~10줄(인사→점수와 의미→강점 1개→보완할 것 1개→추천 반→마무리 응원). ' +
      '마지막 줄에 한국어 1줄 요약. 과장 금지. 수신자 이름은 주어지지 않는다 — 이름 없이 써라.\n점수: ' + score + '/15\n판정 레벨: ' + lvl.n + ' (' + lvl.d + ')', 1536);
    if (report) report = nm + ' —\n' + report;
    if (!report) report = nm + ' — Таны оноо: ' + score + '/15\nТүвшин: ' + lvl.n + '\n' +
      'SYNK LAB-д тохирох анги: ' + lvl.n + ' анги.\nДэлгэрэнгүй зөвлөгөөг зөвлөх багштай холбогдоорой!\n\n(한국어 요약) ' + nm + '님의 레벨은 ' + lvl.n + ' — ' + lvl.d + '.';
    if (email && quotaOk(1)) MailApp.sendEmail(email, '[SYNK LAB] 📊 ' + nm + ' — Түвшин тогтоох тестийн үр дүн (레벨 진단 리포트)',
      report + '\n\n—\nSYNK LAB · Улаанбаатар\n무료 상담·체험 신청은 이 메일에 회신하시면 됩니다. (Үнэгүй зөвлөгөө авахыг хүсвэл энэ имэйлд хариулаарай!)');
    // [v9.157] 레벨테스트도 공개 마케팅 폼(FB·상담에 URL 배포) — 리드폼과 목적지(leads)·위협이 같다
    ld.appendRow(행소독_([dstr(r[0] instanceof Date ? r[0] : new Date(), tz), nm, phone, '레벨테스트', '', '', '', '', '', '', '점수 ' + score + '/15 · ' + lvl.n + (email ? ' · ' + email : ''), '레벨테스트']));
    props.setProperty('레벨테스트_포인터', String(from + i + 1));
    done++;
  }
  if (done) adminMail('[SYNK] 📊 레벨 테스트 ' + done + '건 처리', '진단 리포트 발송 + leads 편입 완료. leads 시트에서 상담 연결하세요.');
}

function parentSweep() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // [v9.32] 상단 호출도 safeRun 보호 — 여기서 throw하면 아래 폼 편입·수업 브리핑·출결 보드가
  //   함께 중단되고 구글 기본 실패 요약(최대 하루 지연)에만 의존하게 된다.
  safeRun('sweepAttendanceForm', function () { sweepAttendanceForm_(ss); }); // [v9.49] 출석 폼 → attendance 전개 (등원알림·보드·미등원판정 앞 — 앱 출석의 update-0 대체)
  safeRun('sweepClassAttendanceForm', function () { sweepClassAttendanceForm_(ss); }); // [09-02 폼 넷] 강사 반 출석 폼 → attendance_batch — 바로 아래 전개가 같은 틱에 attendance 로(Glide 1탭의 새 손)
  safeRun('expandAttendanceBatch', function () { expandAttendanceBatch_(ss); }); // [v9.36] 수업 시작 출석 1탭(attendance_batch) → attendance 전개 (등원알림·보드·미등원판정 앞)
  // [v9.230] 숙제 서클 종이 — 위 두 전개가 끝난 «바로 다음» 자리다. 설계 §3 이 「종이는 QR 출석
  //   확정 뒤 인쇄된다」로 못박아 시각 트리거를 못 쓴다(확정 전에 구우면 결석자 칸이 실려 나가고
  //   그 종이는 다시 못 걷는다). 반·날짜당 1회 · 확정 없는 반은 조용히 넘어가 다음 틱에 다시 본다.
  safeRun('circleSheetsAuto', function () { circleSheetsAuto_(ss); });
  if (PARENT_MAIL_ARRIVAL) safeRun('attendanceNotify', function () { attendanceNotify_(ss); }); // [v7.9] 등원 즉시 알림은 기본 OFF
  safeRun('translateNotices', function () { translateNotices_(ss); });
  safeRun('translateTopics', function () { translateTopics_(ss); }); // [v5.7] 이번 주 우리 반 배운 것 → 몽골어
  safeRun('importFormResponses', importFormResponses); // [v6.3] 상담 폼 접수 편입
  safeRun('crewIntakeWatch', function () { crewIntakeWatch_(ss); }); // [v9.171] 크루카드 접수·재제출·이관유실·상한 감시 — 접수를 「알리는」 층(폼을 닫으면서 알림이 0이 됐다)
  safeRun('sweepLeadForm', function () { sweepLeadForm_(ss); }); // [v9.43] 광고 리드폼 → leads 자동 편입(수기 이관 폐지)
  safeRun('msgLinkSweep', function () { MJ_msgLinkSweep_(ss); }); // [v9.71] 학부모 메신저 연결 스위프 — 상담로그 새 수신에서 학생ID를 찾아 messenger_links 자동 연결(새 행 없으면 2읽기 종료)
  safeRun('sweepFeedbackAck', function () { sweepFeedbackAck_(ss); }); // [v9.49] 첨삭 '확인했어요' → +5P 정산(열람 보상 — 10분 내 반응해야 루프가 산다)
  safeRun('sweepTeacherMemoForm', function () { sweepTeacherMemoForm_(ss); }); // [v9.55] 약점 메모 폼 → student_errors — classPrepMail보다 앞(같은 틱의 메모가 수업 전 메일에 실린다)
  safeRun('sweepAcademicForm', function () { sweepAcademicForm_(ss); }); // [v9.74] 학업 기록 폼 → academic_log — 급수·모의 차트 원료(월 빈도라 포인터 조기 종료로 무비용)
  safeRun('sweepAbsenceForm', function () { sweepAbsenceForm_(ss); }); // [v9.89] 결석 연락 폼 → absence_followup 마감 — checkNoShow보다 앞(같은 틱에 들어온 연락이 오늘 감지분에 바로 반영)
  safeRun('sweepLectureForm', function () { sweepLectureForm_(ss); }); // [v9.106] 강의폼_응답 → lecture_views
  safeRun('quizSweep', function () { quizSweep_(ss); }); // [v9.138] 퀴즈폼_응답 → quiz_log — 「무엇을 골랐나」는 그 순간이 지나면 영원히 못 얻는다(소급 불가 축)
  safeRun('sweepLessonCloseForm', function () { sweepLessonCloseForm_(ss); }); // [v9.91] 차시 마감폼 → lesson_close — classPrepMail보다 앞(같은 틱의 마감이 다음 수업 브리핑 조 편성에 반영) · [09-02] + weekly_topics(배운내용·문법태그·연료)
  safeRun('sweepTeacherCheckinForm', function () { sweepTeacherCheckinForm_(ss); }); // [09-02 폼 넷] 출퇴근 폼 → teacher_checkins — 퇴근 응원·출결 보드(아래)보다 앞(같은 틱의 출근이 보드에 뜬다)
  safeRun('classPrepMail', function () { classPrepMail_(ss, ss.getSpreadsheetTimeZone()); }); // [v6.8]
  safeRun('checkoutCheerMail', function () { checkoutCheerMail_(ss); }); // [v6.8]
  safeRun('todayBoard', function () { todayBoard_(ss); }); // [v8.1] 오늘의 출결 보드 (10분 갱신)
  safeRun('queueInquiries', function () { queueNewInquiries_(ss); }); // [v9.32] 신규 학부모 문의 → 아침 브리핑 큐
  safeRun('checkNoShow', checkNoShow); // [v9.34] 부활 — 판정 창(수업 시작+30~90분)은 10분 스위프에서만 실제로 걸린다. 반별 1일 1회 app_state 가드 + 당일 출석 0건 반 스킵으로 오경보 없음
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
  if (from > lastRow) { props.setProperty('등원알림_포인터', String(lastRow)); return; } // [v9.34] 시트 재건·행 정리 시 클램프(플래그 ON 대비 잠복 결함 제거)
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
  let iT = find(['title', 'title_ko', '제목']); // [v9.40] addNotice와 동일 확장 — 구 스키마에서 notice_id를 번역하던 오작동 수정
  let iB = find(['body', 'body_ko', 'content', '내용', '본문']);
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

/* [v9.39] 번역 열 안전 탐색 — Glide가 시트에 심는 '🔒 Row ID' 열이 라이브 contents의 G(일부 행 H)를
 * 차지한다(2026-07-18 실측). 위치(7/8) 고정으로 쓰면 Row ID가 번역으로 덮여 Glide 행 식별이 파괴됨.
 * → 1행에서 label 포함 헤더('몽골어'·'몽골어(G)' 등)를 찾고, 없으면 맨 끝+1 열에 새로 만든다.
 *   'Row ID' 포함 헤더는 절대 반환하지 않는다. */
function langColOf_(ct, label) {
  const w = ct.getLastColumn();
  const heads = ct.getRange(1, 1, 1, w).getValues()[0].map(h => String(h || ''));
  for (let c = 0; c < heads.length; c++) {
    if (heads[c].indexOf('Row ID') > -1) continue;
    if (heads[c].indexOf(label) > -1) return c + 1;
  }
  const col = w + 1;
  if (ct.getMaxColumns() < col) ct.insertColumnsAfter(ct.getMaxColumns(), col - ct.getMaxColumns());
  ct.getRange(1, col).setValue(label);
  return col;
}

function translateContents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ct = ss.getSheetByName('contents');
  if (!ct || ct.getLastRow() < 2) return;
  // [v9.39] G/H 고정 접근 폐기 — langColOf_로 이름 기반 열 탐색(Row ID 열 보호)
  const mnCol = langColOf_(ct, '몽골어');
  const enCol = langColOf_(ct, '영어');
  const last = ct.getLastRow();
  const base = ct.getRange(2, 1, last - 1, 6).getValues(); // A~F
  const mnV = ct.getRange(2, mnCol, last - 1, 1).getValues();
  const enV = ct.getRange(2, enCol, last - 1, 1).getValues();
  const targets = ['quote', 'braintip', 'homework', 'monster', 'season', 'grammar']; // [v9.69] grammar 편입 — setupGrammarBank 주석(v9.38d)은 "포함"이라 했으나 실제 배열에 없어 G열 몽골어 초기화 시 자동 복원 경로가 끊겨 있던 주석-코드 불일치 수리(빈칸만 채우므로 큐레이션 번역은 불변)
  let done = 0;
  for (let i = 0; i < base.length && done < 60; i++) {
    const r = base[i];
    if (targets.indexOf(String(r[1])) === -1) continue;
    const ko = String(r[3] || r[2] || '');
    if (!ko) continue;
    if (String(mnV[i][0] || '') && String(enV[i][0] || '')) continue;
    try {
      if (!String(mnV[i][0] || '')) ct.getRange(i + 2, mnCol).setValue(LanguageApp.translate(ko, 'ko', 'mn'));
      if (!String(enV[i][0] || '')) ct.getRange(i + 2, enCol).setValue(LanguageApp.translate(ko, 'ko', 'en'));
      done++;
    } catch (e) { Logger.log('번역 쿼터 도달 — ' + (i + 2) + '행부터 내일 이어서'); break; }
  }
  Logger.log('translateContents: ' + done + '행 완료 (몽골어=' + mnCol + '열 · 영어=' + enCol + '열)');
}

/* ===================== [v9.26] B1 몽골어 컨텐츠 뱅크 (translateContents 부근 다국어 섹션에 인라인 병합) =====================
 * 원본: scratchpad/b1/final/inject_mongolian.js — 아래 스니펫 헤더·주석 전문 보존(멱등성·setup 재실행 시 G열 초기화 후 재실행 규칙·병렬 상수 배선 후속 결정).
 * 491조각 = contents G열 upsert 340(homework 210·quiz 100·braintip 30) + 병렬 상수 151(운세 36·SPEAK 41·스토리 74).
 * ⚠ 아래 사용법의 '새 파일로 붙여넣고' 문구는 인라인 병합으로 대체됨 — injectMongolianContents()만 1회 실행하면 된다. */

/***********************************************************************************************
 * inject_mongolian.js — SYNK B1 몽골어 컨텐츠 뱅크 주입 스니펫 (생성일 2026-07-10)
 *
 * 출처: scratchpad/b1/final/번역_*.json (몽골어_용어집.md v0.1 준수 · 전 491건 커버리지 검증 완료)
 * 사용법: 이 파일 전체를 Apps Script 프로젝트에 새 파일로 붙여넣고 injectMongolianContents() 1회 실행.
 *
 * ① injectMongolianContents() — contents 시트 G열(몽골어) upsert
 *    · 대상 유형: homework(210) · quiz(100) · braintip(30) — 콘텐츠ID(A열) 매칭
 *    · G열 형식: homework = D열(내용) 번역 1문자열 / quiz = "문제|정답" D열 형식 미러 / braintip = C열(본문) 번역
 *    · 멱등: 값이 이미 같으면 건너뜀 — 재실행 시 "갱신 0"이면 정상
 *    · 기존 G열 값(translateContents 기계번역 초벌 포함)은 큐레이션 번역으로 덮어씀 (의도된 동작)
 *    · 다른 유형(monster·label·reason·quote·store·boss 등)의 행과 H열(영어)은 일절 건드리지 않음
 *    · ⚠ setupHomework·setupQuiz·setupBrainTips 계열 재실행(replaceContentType)은 해당 유형 G열을
 *      초기화하므로, 그 후 이 함수를 다시 1회 실행할 것 (translateContents와 동일한 운용 규칙)
 *
 * ② MN_* 병렬 상수 — contents 시트에 없는 코드 내 상수의 몽골어 대응본
 *    · MN_FORTUNES(36) ↔ FORTUNES (Code.js L713) — 배열 인덱스 1:1
 *    · MN_SPEAK ↔ SPEAK (L734) — 동일 구조 {today/miss3/miss7/idle: [말투3][문장], evosoon/crown/bday: [문장]}
 *    · MN_STORY_TITLES(6)/MN_STORY_SCENES(12)/MN_STORY_EMOTIONS(8)/MN_STORY_GRAMMAR(12×4) ↔ L4412~4467
 *    · MN_HOMEWORK_CATEGORY/MN_QUIZ_CATEGORY/MN_HOMEWORK_CHECKPOINT — 숙제·퀴즈의 부속 필드
 *      (C열 카테고리·E열 검사포인트는 G열 1칸에 담지 않음 — 아래 상수로 무손실 보존)
 *    ⚠ 병렬 상수의 연결 배선(홈 화면·app_state에서 어느 언어를 어떻게 노출할지)은 후속 결정.
 *      이 파일은 데이터만 적재하며 기존 로직(hashPick_·buildStorybook 등)을 일절 수정하지 않는다.
 *
 * ⚠ 원어민 감수: 용어집 §7(15항목) + 각 번역 note의 감수 플래그 20건은 감수 후 일괄 치환 예정.
 *    감수 전에도 주입은 안전 — 치환 시 이 파일의 문자열만 고쳐 재실행하면 된다(멱등).
 ***********************************************************************************************/

/* ===================== ① contents 시트 G열 upsert 데이터 ===================== */

const MN_CONTENTS_G = {
  // ---- homework ----
  "HW101": "Сурах бичгийн өнөөдөр үзсэн хуудсаа 1 удаа чанга уншаад шинэ 3 үгэнд од тавиарай — үг тус бүрээр нэг өгүүлбэр зохиогоод ирээрэй.",
  "HW102": "Сурах бичгийн эх бичвэрээс хамт хэрэглэгддэг 2 хос үг олж бичээрэй (жишээ: 사진을 찍다).",
  "HW103": "Шинэ 3 үгийн эсрэг эсвэл ойролцоо утгатай үгийг толь бичгээс олоод, таалагдсан 1 жишээ өгүүлбэрийг хуулж бичээрэй.",
  "HW104": "Өнөөдөр сурсан 5 үгээр мини үгийн дэвтэр хийгээрэй — жишээ өгүүлбэрийг сурах бичгээс олж хуулаад, зөвхөн 1-ийг нь өөрөө зохиогоорой.",
  "HW105": "Гэртээ байгаа солонгос бүтээгдэхүүний сав баглаа, шошгоноос солонгос 5 үг уншиж бичээрэй (байхгүй бол 5 зүйлийн нэрийг).",
  "HW106": "Сурах бичгийн эх бичвэрт шинэ гарчиг өгөөд, үндэслэл болсон 2 үгийн доогуур зураарай.",
  "HW107": "Өнөөдөр сурсан нэг үгээр эхлээд үгийн сүүл залгах 끝말잇기 тоглоомоор 5 үг залгаад ирээрэй.",
  "HW108": "Сурах бичгийн 1 зурагт таарах 3 үгийг эх бичвэрээс олж бичээрэй.",
  "HW109": "Хамгийн хэцүү 1 үгээ 10 удаа чангаар уншаарай — хэд дэх удаагаас амар болсныг тэмдэглээрэй.",
  "HW110": "Өнөөдөр сурсан 4 үгийг хоёр бүлэгт хувааж, юугаар нь ангилснаа хэлээрэй.",
  "HW111": "Өнөөдөр сурсан үгнээс нэгийг хаяг, сав баглаанаас олж тэмдэглээрэй.",
  "HW112": "Зар, хоолны цэс, аппын дэлгэцээс мэддэг солонгос 3 үгээ дугуйлаарай (зургаар ч болно) — юу зардаг талаар нэг үгээр бичээрэй.",
  "HW113": "Сурах бичгийн эх бичвэрээс 1 өгүүлбэр сонгоод, өөрийнхөө тухай өгүүлбэр болгон өөрчилж бичээрэй.",
  "HW114": "Сурах бичгийн эх бичвэрээс 이·그·저 (эсвэл 여기·거기)-г олж дугуйлаад, юуг зааж байгааг сумаар холбоорой.",
  "HW115": "Утасныхаа солонгос дэлгэцээс (ютүб, тоглоом, апп г.м.) солонгос 3 үг олж бичээрэй.",
  "HW116": "Өнөөдөр сурсан 3 үгийг чанга дуугаар 3 удаа уншаад, хамгийн итгэлтэй хэлсэн үгэндээ од тавиарай.",
  "HW117": "Өнөөдөр сурсан 3 үгэнд таарах бодит зүйлийн зургийг аваад ирээрэй.",
  "HW118": "Сурах бичгийн эх бичвэрээс 2 өгүүлбэр сонгоод, эсрэг утгатай үгээр эсрэгээр нь хувиргаад үзээрэй.",
  "HW119": "Гэр бүлдээ өнөөдөр сурсан 3 үгийг зааж өгөөд, ямар байсныг нь тэмдэглээрэй.",
  "HW120": "Сурах бичгийн эх бичвэрийн агуулгаар үнэн бол O, худал бол X гэсэн 2 асуулт зохиогоорой — хичээл дээр найз чинь бөглөнө.",
  "HW121": "Өнөөдөр сурсан 5 үгийг 가나다 дарааллаар эрэмбэлээрэй — цагаа хэмжиж өөрийн рекордоо тэмдэглээрэй.",
  "HW122": "Өнөөдөр сурсан 1 үгээр өдрөө нэг мөрөнд багтааж бичээрэй.",
  "HW123": "Дуудлага нь төстэй хос үгийг (달/딸 гэх мэт) сурах бичиг эсвэл толь бичгээс олж, ялгааг нь тэмдэглээрэй.",
  "HW124": "Сурах бичгийн эх бичвэрээс нэр үг 3, үйл үг 2-ыг олж тэмдэглээд — 1 үйл үгээр 1 өгүүлбэр зохиогоорой.",
  "HW125": "Өнөөдөр сурсан 3 үгээр хоёр мөр харилцан яриа зохиогоорой.",
  "HW126": "Сурах бичгийн хараахан үзээгүй хуудаснаас мэдэхгүй 1 үг сонгоод — утгыг нь эхлээд агуулгаар нь таамаглаж бичээд, дараа нь толь бичгээс шалгаарай.",
  "HW127": "Өнөөдөр сурсан 5 үгийг эможигоор илэрхийлээд ирээрэй.",
  "HW128": "5 ширхэг үгийн карт хийгээрэй (урд талд нь үг / ард талд нь утга) — ард талд нь сурах бичгийн өгүүлбэрийг шууд хуулж бичээрэй.",
  "HW129": "Өнгөрсөн долоо хоногийн 3 үг + өнөөдөр сурсан 3 үгээр 2 өгүүлбэр зохиогоорой.",
  "HW130": "Өнөөдөр уншсан өгүүлбэрээс хамгийн дуртай 1-ээ хуулж бичээд, од өгч, шалтгаанаа нэг өгүүлбэрээр бичээрэй.",
  "HW201": "Өнөөдөр үзсэн дүрмээрээ өөрийнхөө тухай 3 өгүүлбэр бичээрэй.",
  "HW202": "Сурах бичгийн эх бичвэрээс өнөөдөр үзсэн дүрэм орсон 2 өгүүлбэр олж доогуур нь зураад — 1-ийг нь асуулт болгон өөрчилж, маргааш найзаасаа асуугаарай.",
  "HW203": "Өчигдөр хийсэн зүйлээ 3 өгүүлбэрээр бичээрэй (өнгөрсөн цаг).",
  "HW204": "Маргааш хийх зүйлээ 3 өгүүлбэрээр бичээрэй (төлөвлөгөө илэрхийлэх хэллэг).",
  "HW205": "Сурах бичгийн 2 өгүүлбэрийг үгүйсгэсэн хэлбэрт оруулаарай.",
  "HW206": "Сурах бичгийн нэг догол мөрийг уншихдаа 조사(нөхцөл)-г хуруугаараа халхалж өөрөө нөхөж уншаарай — хэдийг зөв хэлснээ тэмдэглээрэй.",
  "HW207": "Өнөөдөр үзсэн 2 өгүүлбэрээс 조사(нөхцөл)-г олж дугуйлаад, олсон нөхцөлөөсөө 1-ийг сонгож шинэ өгүүлбэр зохиогоорой.",
  "HW208": "Өнөөдөр үзсэн дүрмээр гэр бүлээ танилцуулсан 2 өгүүлбэр бичээрэй.",
  "HW209": "Сурах бичгийн нэг догол мөрийн 3 өгүүлбэрийг цаасан дээр тус тусад нь бичээд дарааллыг нь холиорой — маргааш найз чинь зөв дарааллаар нь эмхлэнэ.",
  "HW210": "Өнөөдөр үзсэн дүрэм + цаг заасан үг (아침·어제 гэх мэт) орсон 2 өгүүлбэр бичээрэй.",
  "HW211": "Өнөөдөр үзсэн өгүүлбэрийг «(으)세요» (эелдэг хүсэлт) болон «-읍시다» (хамтдаа хийе) хэлбэрт оруулаарай.",
  "HW212": "Шалтгаан заасан -아/어서 хэлбэрээр 2 өгүүлбэр зохиогоод — сурах бичгийн эх бичвэрээс шалтгаан орсон 1 өгүүлбэр олж хуулж бичээрэй.",
  "HW213": "Болзол заасан -으면 хэлбэрээр 2 өгүүлбэр бичээрэй.",
  "HW214": "Өнөөдөр үзсэн дүрмээр Монголоо танилцуулсан 1 өгүүлбэр бичээрэй.",
  "HW215": "Сурах бичгээс 반말 хэлбэрийн 2 өгүүлбэр олоод хүндэтгэлийн хэлбэрт оруулаарай.",
  "HW216": "반말 хэлбэрийн 2 өгүүлбэрийг 존댓말 болгож, 존댓말-ын 2 өгүүлбэрийг 반말 болгож хөрвүүлээрэй.",
  "HW217": "Өнөөдөр үзсэн дүрмийг өөрийнхөө үгээр нэг мөрөнд багтааж бичээд, сурах бичгээс 1 жишээ өгүүлбэр хуулж бичээрэй.",
  "HW218": "Сурах бичгийн нэг өгүүлбэрийн үгсийг холиод, дараа нь буцааж зөв дарааллаар нь эмхлээрэй.",
  "HW219": "Эсрэгцүүлсэн -지만 хэлбэрээр 2 өгүүлбэр — 1-ийг нь сурах бичгийн эх бичвэрээс 하지만 эсвэл -지만 орсон өгүүлбэр олж хуулж бичээрэй.",
  "HW220": "Яг одоо хийж байгаа 3 зүйлээ бичээрэй (-고 있다).",
  "HW221": "Сурах бичгийн эх бичвэрийн агуулгаар 누가·언제·어디 гэсэн 3 асуулт зохиогоорой — хариулт нь эх бичвэр дотор байх ёстой.",
  "HW222": "Хийж чаддаг 3 зүйлээ бичээрэй (-(으)ㄹ 수 있다).",
  "HW223": "Өнөөдөр үзсэн дүрмийн 1 жишээ өгүүлбэрийг 3 удаа чанга уншаарай.",
  "HW224": "Хүсэлт гаргах -아/어 주세요 хэлбэрээр 2 өгүүлбэр бичээрэй.",
  "HW225": "Харьцуулсан -보다 хэлбэрээр 2 өгүүлбэр бичээрэй.",
  "HW226": "Сурах бичгийн эх бичвэрээс 그리고·그래서·하지만-г олж дугуйлаад — нэгийг нь өөрөөр сольвол утга яаж өөрчлөгдөхийг нэг мөрөнд бичээрэй.",
  "HW227": "Сурах бичгийн эх бичвэрээс богино 1 өгүүлбэр сонгоод, 3 мэдээлэл багтаасан урт өгүүлбэр болгож өргөжүүлээрэй.",
  "HW228": "Сурах бичгийн эх бичвэрээс урт 1 өгүүлбэр сонгоод 2 өгүүлбэр болгож хуваагаарай.",
  "HW229": "그리고·그래서·하지만 гэсэн үг тус бүрээр өгүүлбэр холбож, тус бүр 1 өгүүлбэр бичээрэй.",
  "HW230": "Сурах бичгээс хамгийн дуртай 1 жишээ өгүүлбэрээ хуулж бичээд, од өгч, шалтгаанаа бичээрэй.",
  "HW301": "Өнөөдөр сурсан хэллэгээрээ 30 секунд ганцаараа ярьж, утсандаа бичээрэй.",
  "HW302": "Толинд харан харилцан яриаг 3 удаа уншаад, дахин дадлага хийх 1 дуудлагаа тэмдэглээрэй.",
  "HW303": "Гэр бүл, найздаа солонгосоор мэндчилж, 1 өгүүлбэр хэлээд, ямар байсныг тэмдэглээрэй.",
  "HW304": "Өнөөдөр үзсэн харилцан яриаг ганцаараа 2 дүрд хувааж уншаарай.",
  "HW305": "Солонгос дууны нэг мөрийг дагаж хэлээрэй (үгийг нь хараад, зөвхөн дуудлагаар).",
  "HW306": "«오늘 뭐 했어요?» гэдэг асуултад 20 секунд зогсолтгүй хариулж дадлага хийгээрэй.",
  "HW307": "Өнөөдөр үзсэн харилцан яриаг харалгүйгээр цээжээр хэлж үзээрэй.",
  "HW308": "Өнөөдрийн он сар өдөр, гараг, цагийг чанга дуугаар 3 удаа хэлээрэй.",
  "HW309": "Өөрийгөө танилцуулсан 15 секундын бичлэг хийгээрэй (илгээх шаардлагагүй).",
  "HW310": "Утсаар ярихад хэрэглэдэг эхний мэндчилгээ 3-ыг (여보세요 гэх мэт) хэлж дадлага хийгээрэй.",
  "HW311": "Дэлгүүрт юм худалдаж авах нөхцөлийг ганцаараа дүрийн тоглолтоор тоглоод үзээрэй.",
  "HW312": "Зам асуух 3 өгүүлбэрийг чангаар дуудаж дасгал хийгээрэй.",
  "HW313": "Өнөөдрийн сэтгэл санаагаа 3 өгүүлбэрээр хэлээд үзээрэй.",
  "HW314": "Сурах бичгийн догол мөрийг 2 дахин хурдан уншиж үзээрэй.",
  "HW315": "Мөн тэр догол мөрөө маш удаан, тод тод 1 удаа уншаарай.",
  "HW316": "Нэг өгүүлбэрийг намуухан·энгийн·чанга гэж 3 удаа хэлээрэй.",
  "HW317": "Өөрөө асуулт зохиож, өөрөө хариулаарай — ийм 2 хос.",
  "HW318": "Өрөөнийхөө 5 эд зүйлийг хуруугаараа зааж хэлээрэй.",
  "HW319": "Өнөөдөр сурсан хэллэгээ тоглоом эсвэл тэжээвэр амьтандаа хэлээд үзээрэй.",
  "HW320": "Богино бичлэгийг 1 минут «сүүдэр яриа» хийж үзээрэй (бичлэгтэй нэгэн зэрэг давтаж ярих).",
  "HW321": "Дуудахад хэл эргэдэг 1 өгүүлбэрийг 5 удаа давтаарай.",
  "HW322": "Холбож дуудагддаг (연음) 5 үгийг чангаар дуудаарай (꽃이·같이 г.м).",
  "HW323": "Өөрийгөө танилцуулах яриагаа шинэчлээд 15 секундэд багтааж хэлээрэй.",
  "HW324": "Дуртай 3 зүйлээ шалтгаантай нь хамт хэлээрэй.",
  "HW325": "Маргаашийн төлөвлөгөөгөө чангаар хэлээрэй.",
  "HW326": "Өнөөдрийн хамгийн сайхан мөчөө нэг өгүүлбэрээр хэлээрэй.",
  "HW327": "Яг одоо хийж буй үйлдлээ 30 секунд шууд дамжуулагч шиг ярьж өгөөрэй.",
  "HW328": "Найзаа магтсан 3 өгүүлбэрийг чангаар хэлээрэй.",
  "HW329": "Ангийнхаа найзын нэрийг оруулсан 2 өгүүлбэр хэлээрэй.",
  "HW330": "Энэ долоо хоногийн хамгийн дуртай өгүүлбэрээ уншиж бичлэг хийгээд ирээрэй.",
  "HW401": "Өнөөдөр үзсэн өгүүлбэрийн загвараар 3 мөр өдрийн тэмдэглэл бичээрэй.",
  "HW402": "Солонгос хоол·драм·дуунаас нэгийг сонгоод 3 өгүүлбэрээр танилцуулаарай.",
  "HW403": "Өнөөдрийн хичээлээс хамгийн санаанд үлдсэн зүйлээ 2 өгүүлбэрээр товчилж бичээрэй.",
  "HW404": "Хамт суудаг найздаа өгөх 2 өгүүлбэртэй жижиг захидал бичээрэй — хичээл дээр солилцоно.",
  "HW405": "Сурах бичгийн нэг зургийг 3 өгүүлбэрээр дүрслээрэй.",
  "HW406": "Энэ долоо хоногийн үгсээр нөхөх 2 дасгал зохиогоорой — найз чинь хийнэ.",
  "HW407": "Найздаа илгээх мессеж хэлбэрээр 3 мөр бичээрэй.",
  "HW408": "Өдрийн хуваариа солонгос хэлээр бичээрэй.",
  "HW409": "Дэлгүүрээс авах 5 зүйлийн жагсаалтыг солонгос хэлээр бичээрэй.",
  "HW410": "Энэ сезон (одоо үзэж буй 1 сурах бичиг) дуусах үеийн өөртөө зориулж 2 өгүүлбэр бичээрэй.",
  "HW411": "Өнөөдрийн хамгийн сайхан мөч 1 өгүүлбэр + шалтгаан 1 өгүүлбэр бичээрэй.",
  "HW412": "Өнөөдрийн цаг агаар болон хувцаслалтаа 2 өгүүлбэрээр бичээрэй.",
  "HW413": "Дуртай хоолоо хийх дарааллыг 3 алхмаар бичээрэй.",
  "HW414": "Талархдаг хүндээ зориулж талархлын 2 өгүүлбэр бичээрэй.",
  "HW415": "Уучлалт гуйх нэг нөхцөл зохиогоод, уучлалтын 2 өгүүлбэр бичээрэй.",
  "HW416": "Найзаа төрсөн өдөртөө урих өгүүлбэр бичээрэй.",
  "HW417": "Дурын нэг зүйлд зориулж нэг мөр зар сурталчилгааны үг зохиогоорой.",
  "HW418": "Өнөөдрөө сошиал постын нэг тайлбар шиг бичээрэй.",
  "HW419": "Таалагдсан хэллэгээ хуулж бичээд, өөрийн өгүүлбэр 1-ийг зохиогоорой.",
  "HW420": "Ангийн найзаасаа авах ярилцлагын 3 асуулт зохиогоорой.",
  "HW421": "Дараа долоо хоногийн төлөвлөгөөгөө 3 мөр бичээрэй.",
  "HW422": "Өрөөгөө 3 өгүүлбэрээр дүрслээрэй.",
  "HW423": "Саяхан зүүдэлсэн зүүдээ (эсвэл зохиомол түүхээ) 2 өгүүлбэрээр бичээрэй.",
  "HW424": "Солонгост очвол хиймээр байгаа 3 зүйлээ бичээрэй.",
  "HW425": "Өнөөдөр үзсэн өгүүлбэрийн загвараар 3 мөр богино захидал бичээрэй (хэнд бичихээ өөрөө сонгоорой).",
  "HW426": "Өнөөдөр сурсан 5 үгээ халхлаад өөрөө цээж бичиг хийгээрэй.",
  "HW427": "Өөрийн байнга хэлдэг 2 монгол өгүүлбэрийг солонгос хэлээр бичиж үзээрэй.",
  "HW428": "Өнөөдрийн хичээлдээ гарчиг өгөөд, шалтгаанаа нэг мөр бичээрэй.",
  "HW429": "Нэг зураг юм уу комиксын кадрт тохирох баатрын үг зохиогоорой.",
  "HW430": "Өнгөрсөн пүрэв гарагт бичсэн нэг зохиолоо улам сайжруулаарай.",
  "HW501": "Энэ долоо хоногийн үгнээс эргэлзэж буй 3 үгээр тус бүр 1 өгүүлбэр зохиогоод, чанга уншиж бичлэг хийгээрэй — сонсоод хамгийн сайхан гарсан өгүүлбэртээ од тавиарай.",
  "HW502": "Энэ долоо хоногийн нэг дүрмийг монголоор тайлбарласан тэмдэглэл бичээрэй.",
  "HW503": "Солонгос бичлэг 1 минут үзээд сонсогдсон 3 үгээ бичээрэй.",
  "HW504": "Даваа~пүрэв гарагийн гэрийн даалгавраас нэгийг нь улам сайжруулаарай.",
  "HW505": "Энэ долоо хоногийн шинэ 10 үгээ сонсож бичих дасгалаар шалгаарай — гэр бүлийн хэн нэг нь уншиж өгөх, эсвэл өөрийн бичлэгээ сонсонгоо бичээрэй.",
  /* [09-04] 한국어를 「공책에 정리」로 고치며 이쪽도 맞췄다(codex P1 — 한 쪽만 고쳐 두 언어가
   *   서로 다른 것을 말하고 있었다). «Миний дасгалын тэмдэглэл»(= 내 연습 노트)은 앱의 옛 칸
   *   이름이라 그 화면이 없어진 뒤엔 학생이 못 찾는다 → дэвтэртээ тэмдэглэх(제 공책에 적기).
   * ⚠ 이 줄은 **기계 검문 전**이다(node tools/몽골어대조.js) — 원어민 눈도 아직이다. */
  "HW506": "Энэ долоо хоногт эргэлзсэн 1 зүйлээ дэвтэртээ тэмдэглээрэй (яагаад эргэлзсэн + зөв өгүүлбэр).",
  "HW507": "Лхагва гарагт хийсэн өөрийн бичлэгээ сонсоод сонссоноо бичээрэй — эх өгүүлбэртэй тулгаж, зөрсөн газрыг тэмдэглээрэй.",
  "HW508": "Үгийн картуудаа хольж өөрийгөө шалгаарай — утгыг нь хараад үгээ чанга хэлсний дараа эргүүлж, оноогоо тэмдэглээрэй.",
  "HW509": "Энэ долоо хоногийн гэрийн даалгавраасаа шилдэг бүтээлээ сонгоод, шалтгаанаа бичээрэй.",
  "HW510": "Энэ долоо хоногт сурсан зүйлээ нэг майнд мап (санааны зураглал) болгон зураарай.",
  "HW511": "Солонгос 1 дууны дахилтыг сонсоод сонсогдсон 2 үгээ бичээрэй — дууны үгийг олж, зөв сонссон эсэхээ шалгаарай.",
  "HW512": "Гэр бүл, найз чинь энэ долоо хоногийн 5 үгийг монголоор хэлэхэд солонгосоор нь шууд хэлээрэй — эсрэгээр нь ч бас нэг удаа.",
  "HW513": "Багшаасаа асуух 1 асуултаа бэлдэж ирээрэй.",
  "HW514": "Найздаа өгөх жижиг квизийн 3 асуулт зохиогоорой — 1 асуултыг нь өөрөө чанга уншиж өгдөг сонсголын асуулт болгоорой.",
  "HW515": "Энэ долоо хоногийн үгсийг сэдвээр нь ангилсан хүснэгт хийгээрэй.",
  "HW516": "Солонгос 1 минутын бичлэг үзээд юуны тухай болохыг нэг мөрөнд бичээрэй — энэ долоо хоногт сурсан үг сонсогдвол од тавиарай.",
  "HW517": "Энэ долоо хоногт өөртөө од өгөөд, шалтгаанаа нэг өгүүлбэрээр бичээрэй.",
  "HW518": "Дараа долоо хоногийн хичээлийн материалыг гүйлгэж хараад, сонирхсон 1 зүйлээ тэмдэглээрэй.",
  "HW519": "Энэ долоо хоногт хамгийн олон тааралдсан \"дараа зөв хариулах асуулт\"-аа сонгоод, зөв өгүүлбэрээр нь бичээрэй.",
  "HW520": "Лхагва гарагийн бичлэгээ дахин сонсоод, сайжирсан 1 зүйлээ тэмдэглээрэй.",
  "HW521": "Энэ долоо хоногийн үгнээс 5-ыг сонгоод, халхалж байгаад цээжээр хэлж үзээрэй.",
  "HW522": "Энэ долоо хоногийн 3 өгүүлбэрийг цээжээр хэлэх сорилт — бичлэг хийж сонсоод, хамгийн сайн болсон 1-д нь од тавиарай.",
  "HW523": "Солонгос бичлэгийн 30 секундыг дэлгэцийг нь халхалж зөвхөн дуугаар нь сонсоорой — хаана болж байгааг, хэдэн хүн байгааг таамаглаад, дэлгэцээ нээж шалгаарай.",
  "HW524": "Сурсан зүйлээсээ 1-ийг ээж аавдаа тайлбарлаж өгөөрэй (монголоор ч болно).",
  "HW525": "Сурах бичгийн энэ долоо хоногийн хуудсыг чангаар бүтнээр нь уншиж бичлэг хийгээрэй — дуусаад дурын 10 секундыг нь сонсоод үзээрэй.",
  "HW526": "Андуурдаг 2 нөхцөлөө жишээ өгүүлбэртэй нь хамт цэгцлээрэй.",
  "HW527": "Энэ долоо хоногт солонгос хэлээ бодитоор хэрэглэсэн 1 мөчөө тэмдэглээрэй.",
  "HW528": "Өөрийн гэсэн 5 нүдтэй давталтын чеклист хийгээрэй.",
  "HW529": "Энэ долоо хоногийн хэллэгүүдээ ашиглаад 4 мөр богино харилцан яриа бичээд — хоёр хүний дуугаар сольж уншаад үзээрэй.",
  "HW530": "Энэ долоо хоногийн сэтгэгдлээ нэг мөр + дараа долоо хоногийн зорилгоо нэг мөр бичээрэй.",
  "HW601": "Солонгос бичлэг 5 минут үзээд — шинээр сонссон 1 хэллэгээ бичиж аваарай.",
  "HW602": "Эргэн тойрныхоо солонгос бүтээгдэхүүн, хаяг самбараас солонгос үг 3-ыг олоорой.",
  "HW603": "Солонгос хоол 5-ыг дуртай дарааллаараа солонгосоор бичээрэй.",
  "HW604": "Драмын нэг үзэгдлээс 1 хэллэгийг сонсоод бичиж аваарай.",
  "HW605": "Дуртай дуучиндаа зориулж солонгосоор дэмжлэгийн 2 өгүүлбэр бичээрэй.",
  "HW606": "Шоу нэвтрүүлгээс реакцын 1 хэллэгийг (대박 г.м.) утгатай нь хамт бичээрэй.",
  "HW607": "Солонгосын газрын зургаас 3 хотын нэрийг уншаад бичээрэй.",
  "HW608": "Солонгос хоол 1: зураг + нэр + амтыг нь нэг үгээр бичээрэй.",
  "HW609": "Вэбтүүн (웹툰)-ий нэг хэсгийг уншаад 1 шинэ үгийн утгыг таамаглаж үзээрэй.",
  "HW610": "Мэддэг солонгос брэнд 3-ыг хангылаар бичээрэй.",
  "HW611": "Драмаас хүндэтгэлийн яриатай 1 үзэгдэл олоорой — хэн хэнд хэлж байна вэ?",
  "HW612": "Солонгосын нэг уламжлалт баярын тухай судлаад нэг мөрөөр тайлбарлаарай.",
  "HW613": "Айдолын өөрийгөө танилцуулдаг хэллэгээс нэгийг дуурайж хэлээрэй.",
  "HW614": "Солонгосын 1 моодны үгийн утгыг олж мэдээрэй.",
  "HW615": "Дуртай драм, киноныхоо 3 нэрийг хангылаар бичээрэй.",
  "HW616": "K-гоо сайхан, загварын 3 үг цуглуулаарай.",
  "HW617": "Солонгосын цаг агаарын аппын дэлгэцийг хараад чангаар уншаарай.",
  "HW618": "Солонгос 1 дуу сонсонгоо мэддэг 1 үгээ бичиж аваарай.",
  "HW619": "Мокбан (먹방) бичлэгээс амтны 2 хэллэг цуглуулаарай.",
  "HW620": "Солонгос, Монголын ижил төстэй 1 зүйлийг нэг өгүүлбэрээр бичээрэй.",
  "HW621": "태극기, 무궁화 гэх мэт Солонгосын бэлгэдлийн 3 нэрийг бичээрэй.",
  "HW622": "Метроны шугамын зургаас 3 буудлын нэрийг уншаарай.",
  "HW623": "Кино постерийн 1 өгүүлбэрийг бичээд ирээрэй.",
  "HW624": "Солонгос мэндлэх ёсны 1 дүрмийг (хоёр гараар өгөх г.м.) цэгцлээрэй.",
  "HW625": "Түгээмэл хэрэглэдэг 2 товчлол, эмотиконы утгыг бичээрэй (ㅋㅋ г.м.).",
  "HW626": "Фандомын 2 үг цуглуулаарай (жишээ: 응원봉).",
  "HW627": "Солонгос үсэг харагдсан 1 зураг аваад, юу гэж бичснийг нь уншаад ирээрэй.",
  "HW628": "Драмын алдартай 1 хэллэг + таалагдсан шалтгаанаа бичээрэй.",
  "HW629": "Энэ улирлын солонгос хоолноос 1-ийг судлаарай.",
  "HW630": "Амралтын өдрийн K-плейлистээс 1 дуу + мэдрэмжээ 1 үгээр бичээрэй.",
  "HW701": "Энэ долоо хоногийн хамгийн дуртай 1 хэллэг + шалтгаанаа 1 өгүүлбэрээр бичээрэй.",
  "HW702": "Дараа долоо хоногийн зорилгоо солонгос хэлээр 1 өгүүлбэрээр бичээрэй.",
  "HW703": "Өнгөрсөн долоо хоногийн үгсээ чангаар 1 удаа бүгдийг уншаарай (тэмдэглэхэд л болно).",
  "HW704": "Ширээгээ цэгцэлж, үгийн дэвтрээ байранд нь тавиарай (1 мөрөөр батлаарай).",
  "HW705": "Энэ долоо хоногийн тэмдэглэлийнхээ 1 зургийг аваад хадгалаарай.",
  "HW706": "Энэ долоо хоногт талархсан 1 зүйлээ солонгос хэлээр бичээрэй.",
  "HW707": "Гийгүүлэгч, эгшгээ бүгдийг нь чангаар 1 удаа уншаарай.",
  "HW708": "Суниалт хийнгээ 1-20 хүртэл солонгос хэлээр тоолоорой.",
  "HW709": "Маргааш авч явах 3 зүйлээ солонгос хэлээр хэлээрэй.",
  "HW710": "Энэ долоо хоногт сайн хийсэн 1 зүйлээ өөрөө магтаж бичээрэй.",
  "HW711": "«Өнөөдрийн синапс»-аас 1 мэргэн үг сонгоод хуулж бичээрэй.",
  "HW712": "Солонгос нэр, гарын үсгээ 3 удаа бичиж дадлага хийгээрэй.",
  "HW713": "Ирээдүйн мөрөөдлөө 1 өгүүлбэрээр шинэчилж бичээрэй.",
  "HW714": "Дуртай солонгос өгүүлбэр эсвэл дууны үгнээс 1 мөр цуглуулаарай.",
  "HW715": "Хамгийн амархан 1 өгүүлбэрээ төгс дуудлагатай 3 удаа хэлээрэй.",
  "HW716": "5 минут нүдээ аниад амарч, мэдрэмжээ 1 үгээр тэмдэглээрэй.",
  "HW717": "Дараагийн хичээл дээр асуух 1 зүйлээ тэмдэглээрэй.",
  "HW718": "Гэр бүлтэйгээ солонгос үг таах тоглоом 1 удаа тоглоорой.",
  "HW719": "Ням гарагийн оройн дэглэмээ 1 мөрөөр бичээрэй.",
  "HW720": "1 сарын өмнөх өөртөө 1 өгүүлбэр бичээрэй.",
  "HW721": "Апп дээрээс оноогоо хараад энэ долоо хоногийн зорилтот оноогоо тогтоорой.",
  "HW722": "Монстроо шалгаад, дараагийн хувьсал хүртэл хэдэн P хэрэгтэйг бичээрэй.",
  "HW723": "Үгийн дэвтрийнхээ хавтсан дээр нэрээ болон зорилгынхоо 1 үгийг солонгосоор бичээд чимээрэй.",
  "HW724": "Пенал доторх 3 зүйлээ солонгос хэлээр хэлээрэй.",
  "HW725": "Энэ долоо хоногт сурсан 1 зүйлээ ээж аавдаа гайхуулаарай.",
  "HW726": "Гэр бүлдээ солонгосоор «잘 자요» гэж хэлээрэй.",
  "HW727": "Сэрүүлэг эсвэл тэмдэглэлийнхээ 1-ийг солонгос хэл рүү солиорой.",
  "HW728": "Ус уунгаа тостын 1 солонгос үг хэлж үзээрэй (жишээ: 건배!).",
  "HW729": "Цонхоор харагдах 3 зүйлээ солонгос хэлээр хэлээрэй.",
  "HW730": "Долоо хоногоо 3 эможи + 1 үгийн сэтгэгдлээр дүгнээрэй.",
  // ---- quiz ----
  "QZ01": "Хоосон зайд аль нь вэ? 학교( ) 가요 — ①에 ②에서|① 에 — очих газар, чиглэлээ 에-гээр заана",
  "QZ02": "Хоосон зайд аль нь вэ? 도서관( ) 공부해요 — ①에 ②에서|② 에서 — үйлдэл хийж буй газраа 에서-гээр заана",
  "QZ03": "Хоосон зайд аль нь вэ? 사과( ) 좋아해요 — ①이 ②를|② 를 — 좋아하다-гийн өмнө «юуг» гэдгийг 를-ээр заана",
  "QZ04": "Хоосон зайд аль нь вэ? 저는 학생( ) — ①이에요 ②예요|① 이에요 — 학생 нь 받침-тай учраас 이에요",
  "QZ05": "Хоосон зайд аль нь вэ? 친구( ) 만나요 — ①을 ②를|② 를 — 친구 нь 받침-гүй учраас 를",
  "QZ06": "크다-гийн эсрэг утгатай үг юу вэ?|작다",
  "QZ07": "덥다-гийн эсрэг утгатай үг юу вэ?|춥다",
  "QZ08": "사다-гийн эсрэг утгатай үг юу вэ?|팔다",
  "QZ09": "아버지-гийн 어머니 нь хэн бэ?|할머니",
  "QZ10": "재미있다-тай ойролцоо утгатай үг аль нь вэ? ①즐겁다 ②슬프다|① 즐겁다",
  "QZ11": "Өнгөрсөн цаг: 어제 밥을 ___ (먹다)|먹었어요",
  "QZ12": "Ирээдүй цаг: 내일 학교에 ___ (가다)|갈 거예요",
  "QZ13": "춥다 + 아/어요 = ?|추워요 — ㅂ дүрмийн бус хувилал",
  "QZ14": "듣다 + 어요 = ?|들어요 — ㄷ дүрмийн бус хувилал",
  "QZ15": "물을 ___ 싶어요 (마시다)|마시고 — V고 싶다 (~хыг хүсэж байна)",
  "QZ16": "안 먹어요 vs 먹지 않아요 — аль нь зөв бэ?|Хоёулаа зөв — аль алиныг нь хэрэглэж болно",
  "QZ17": "Аль нь зөв бичлэг вэ? ①됬어요 ②됐어요|② 됐어요",
  "QZ18": "Аль нь зөв бичлэг вэ? ①안녕히 가세요 ②안녕이 가세요|① 안녕히 가세요",
  "QZ19": "같이-г яаж дууддаг вэ?|가치 — ㅌ нь 이-тэй нийлээд 치 болж дуудагдана",
  "QZ20": "꽃이-г яаж дууддаг вэ?|꼬치",
  "QZ21": "감사합니다-г бодитоор яаж дууддаг вэ?|감사함니다 — ㅂ нь ㄴ-ийн өмнө ㅁ болж дуудагдана",
  "QZ22": "Багшдаа «밥 먹었어?» гэхийн оронд юу гэж хэлэх вэ?|식사하셨어요?",
  "QZ23": "나이-гийн хүндэтгэлийн үг юу вэ?|연세",
  "QZ24": "집-ийн хүндэтгэлийн үг юу вэ?|댁",
  "QZ25": "Анх уулзсан хүнтэй ярихдаа 반말 уу, 존댓말 уу?|존댓말 — 처음 뵙겠습니다",
  "QZ26": "월요일-ийн дараагийн өдөр юу вэ?|화요일",
  "QZ27": "사과 3개 — солонгосоор яаж тоолох вэ?|세 개",
  "QZ28": "Эмнэлэгт ажилладаг хүнийг солонгосоор юу гэдэг вэ?|의사 эсвэл 간호사",
  "QZ29": "설날-д том хүмүүст гүн бөхийж мэндэлдэг ёсыг юу гэдэг вэ?|세배",
  "QZ30": "한글-ийг зохиосон хаан хэн бэ?|세종대왕",
  "QZ31": "Хоосон зайд аль нь вэ? 오늘( ) 날씨가 좋아요 — ①은 ②는|② 는 — 받침-гүй үгэнд 는 залгана",
  "QZ32": "Хоосон зайд аль нь вэ? 동생( ) 키가 커요 — ①이 ②가|② 가 — 받침-гүй үгэнд 가 залгана",
  "QZ33": "Хоосон зайд аль нь вэ? 친구( ) 선물을 줘요 — ①에게 ②에서|① 에게 — хүнд өгөх үед 에게",
  "QZ34": "Хоосон зайд аль нь вэ? 버스( ) 가요 — ①로 ②으로|① 로 — 받침-гүй бол 로",
  "QZ35": "Хоосон зайд аль нь вэ? 지하철( ) 가요 — ①로 ②으로|① 로 — ㄹ 받침 ч бас 로!",
  "QZ36": "9시( ) 6시( ) 일해요 — хоёр хоосон зайд юу орох вэ?|부터, 까지 — «~аас … хүртэл» гэсэн утгатай",
  "QZ37": "형이 나( ) 커요 — харьцуулахад ямар нөхцөл хэрэглэх вэ?|보다 — харьцуулахад «~аас (илүү)» гэсэн утгатай",
  "QZ38": "빵( ) 우유 — ①와 ②과|② 과 — дэвсгэр үсэгтэй үгийн ард 과 залгана",
  "QZ39": "하루에 두 번( ) 드세요 — «тус бүр» гэсэн утгатай нөхцөл юу вэ?|씩 — нэг нэгээр нь хуваасан «тус бүр» гэсэн утга",
  "QZ40": "수영을 ( ) 수 있어요 (하다)|할 — V(으)ㄹ 수 있다 «~ж чадна»",
  "QZ41": "내일 시험이라서 공부( ) 해요 — ①해야 ②하야|① 해야 — 아/어야 하다 «заавал хийх ёстой»",
  "QZ42": "여기서 사진을 찍( ) 마세요|지 — «бүү ~» гэсэн утгатай (–지 마세요)",
  "QZ43": "문 좀 열( ) 주세요 — ①어 ②아|① 어 — 열다 → 열어 болно",
  "QZ44": "지금 밥을 먹( ) 있어요|고 — яг одоо үргэлжилж буй үйл (–고 있다)",
  "QZ45": "이 옷 한번 입( ) 보세요 — ①어 ②아|① 어 — оролдож үзэх утга (–어 보다)",
  "QZ46": "한국에 ( ) 적이 있어요 (가다)|간 — туршлага «~сан удаатай» (–ㄴ 적이 있다)",
  "QZ47": "자( ) 전에 이를 닦아요|기 — V기 전에 «~хийхээс өмнө»",
  "QZ48": "수업이 끝( ) 후에 만나요 — ①난 ②은|① 난 — 끝나 + ㄴ 후에 «~дууссаны дараа»",
  "QZ49": "다리를 다쳐서 ( ) 걸어요 — ①안 ②못|② 못 — «чадахгүй» нөхцөл байдалд 못 хэрэглэнэ",
  "QZ50": "밥을 먹( ) 식당에 가요|으러 — зорилго + явах хөдөлгөөн «~хийхээр (явах)»",
  "QZ51": "한국에서 일하( ) 한국어를 배워요|려고 — санаа зорилго «~х гэж»",
  "QZ52": "비가 오( ) 우산을 가져가세요 — ①니까 ②으니까|① 니까 — 오 + 니까 «учир нь»",
  "QZ53": "김치는 맵( ) 맛있어요|지만 — «~боловч, гэхдээ» гэсэн утга",
  "QZ54": "주말에 영화를 보( ) 집에서 쉬어요 — сонголт заах холбоос юу вэ?|거나 — «эсвэл» гэсэн утга",
  "QZ55": "음악을 들( ) 공부해요 — ①으면서 ②면서|① 으면서 — 듣 → 들으 (ㄷ дүрмийн бус хувирал)",
  "QZ56": "바쁘다 + 기 때문에 = ?|바쁘기 때문에 — шалтгаан заана (бичгийн найруулга)",
  "QZ57": "한국에 살( ) 됐어요|게 — 게 되다 «тийм болох» (өөрчлөлт)",
  "QZ58": "내일부터 운동하( ) 했어요|기로 — шийдвэр «~хийхээр шийдсэн»",
  "QZ59": "와, 눈이 오( )! — ①네요 ②나요|① 네요 — гайхшрал илэрхийлэх өнгө аяс",
  "QZ60": "피곤한데 우리 좀 쉴( )? — санал болгох хэлбэр|까요 — «~уу?» гэж санал болгоно",
  "QZ61": "제가 전화( )게요 — ①할 ②하ㄹ|① 할 — амлалт өгөх хэлбэр (–ㄹ게요)",
  "QZ62": "배가 고픈( ) 같이 먹을래요? — ①데 ②대|① 데 — нөхцөл байдлаа урьдчилж хэлнэ",
  "QZ63": "지금 ( ) 사람이 동생이에요 (자다)|자는 — одоо цагийн тодотгол хэлбэр",
  "QZ64": "어제 ( ) 영화가 재미있었어요 (보다)|본 — өнгөрсөн цагийн тодотгол хэлбэр",
  "QZ65": "내일 ( ) 곳이 어디예요? (가다)|갈 — ирээдүй цагийн тодотгол хэлбэр",
  "QZ66": "밥을 먹( ) 때 말하지 마세요|을 — V(으)ㄹ 때 «~х үед»",
  "QZ67": "여기 앉( ) 돼요? — ①아도 ②어도|① 아도 — зөвшөөрөл асуух хэлбэр (–아도 돼요?)",
  "QZ68": "교실에서 뛰( ) 안 돼요|면 — дүрэм заасан «–면 안 돼요» хэлбэр",
  "QZ69": "한국어를 정말 잘하( )! (гайхшрал · шинээр мэдсэн зүйл)|시는군요/는군요",
  "QZ70": "오늘 정말 춥( )? (батлах · санал нийлэх)|지요 — «тийм биз дээ» гэсэн өнгө аяс",
  "QZ71": "집에 도착하( ) 바로 잤어요|자마자 — яг дараа нь",
  "QZ72": "한국어를 배운 ( ) 1년 됐어요|지 — хугацаа өнгөрснийг заана",
  "QZ73": "제가 요리하( ) 동안 상 좀 차려 주세요|는",
  "QZ74": "숙제를 하( ) 잠들어 버렸어요|다가 — хийж байгаад өөр үйлдэлд шилжих",
  "QZ75": "게임하( ) 숙제를 못 했어요|느라고 — шалтгаан (хүсээгүй үр дагавар)",
  "QZ76": "늦잠 자( ) 바람에 지각했어요|는 — санаандгүй шалтгаан",
  "QZ77": "내일 비가 ( ) 것 같아요 (오다)|올 — таамаглал",
  "QZ78": "밖이 시끄러운 걸 보니 학생들이 왔( ) 봐요|나 — үндэслэлтэй таамаглал",
  "QZ79": "아이스크림을 떨어뜨릴 ( )했어요|뻔 — бараг л болох шахсан",
  "QZ80": "저는 밥을 빨리 먹는 ( )이에요|편 — хандлага",
  "QZ81": "한국어는 배( ) 재미있어요 — ①울수록 ②우면|① 울수록 — улам бүр",
  "QZ82": "건강( ) 위해서 운동해요 — ①을 ②를|① 을 — N을 위해서 (…-ын төлөө)",
  "QZ83": "감기에 걸리지 않( ) 옷을 따뜻하게 입으세요|도록",
  "QZ84": "동생도 형( ) 키가 커요 — ойролцоо хэмжээ|만큼",
  "QZ85": "그 학생은 가수( ) 노래를 잘해요|처럼",
  "QZ86": "친구가 바빠요 → 친구가 바쁘( ) 했어요|다고 — дам яриа",
  "QZ87": "어디 가요? → 어디 가( ) 물었어요|냐고 — дам асуулт",
  "QZ88": "같이 가요! → 같이 가( ) 했어요|자고 — дам санал (хамтдаа хийе гэсэн)",
  "QZ89": "조용히 하세요 → 조용히 하( ) 하셨어요|라고 — дам тушаал",
  "QZ90": "어제 그 식당 가 봤는데 정말 맛있( )|더라고요 — өөрийн үзсэнээ дамжуулах",
  "QZ91": "왜 안 먹어요? — 아까 먹었( )|거든요 — шалтгаанаа хэлэх",
  "QZ92": "내일 시험이( )! 같이 공부해요|잖아요 — хоёулаа мэддэг зүйлээ сануулах",
  "QZ93": "어릴 때 자주 가( ) 공원이에요|던 — өнгөрснөө дурсах",
  "QZ94": "바람에 문이 저절로 ___ (닫다)|닫혔어요 — үйлдэгдэх хэв",
  "QZ95": "엄마가 아기에게 밥을 ___ (먹다)|먹여요 — үйлдүүлэх хэв",
  "QZ96": "따뜻하다 → 날씨가 점점 ___|따뜻해져요 — 아/어지다 (өөрчлөлт)",
  "QZ97": "선생님이 학생들을 웃( ) 해요|게 — 게 하다 (…хийлгэх)",
  "QZ98": "숙제를 드디어 다 끝내 ( )어요! (сэтгэл онгойх мэдрэмж)|버렸 — 아/어 버리다",
  "QZ99": "손을 씻( ) 나서 드세요|고 — дарааллыг онцлох",
  "QZ100": "이 드라마는 정말 ( ) 만해요 (보다)|볼 — санал болгох үнэ цэнэтэй",
  // ---- braintip ----
  "BT01": "Шинэ үгс унтаж байхад чинь тархинд хадгалагддаг — шалгалтын өмнө шөнөжин суухаас 7 цаг унтах нь оноог илүү өсгөдөг 😴",
  "BT02": "Өнөөдөр, маргааш, долоо хоногийн дараа — гурван удаа уулзсан үг насан туршийн найз болдог 📅",
  "BT03": "Дахин уншихын оронд номоо хааж санаад үз — тархи санах бүрдээ хүчтэй болдог 🎯",
  "BT04": "Нэг өгүүлбэрийг чангаар давтах бүрд тархины утсан дээр бүрээс (миелин) ороогддог ⚡",
  "BT05": "Хичээлээ эхлэхэд хэцүү бол «5 минут л» гэж хэлээрэй — нэг эхэлсэн тархи өөрөө урагшилдаг ⏱️",
  "BT06": "20 минут алхах нь тархиа услахтай адил — салхилсны дараа цээжилсэн үг илүү удаан тогтдог 🚶",
  "BT07": "Үгийг зурагтай хамт цээжлээрэй — хоёр замаар хадгалагдсан ой хоёр дахин бат бөх 🖼️",
  "BT08": "Зөвхөн ширээний ард цээжилсэн үг ширээний ард л санагддаг — автобусанд ч нэг өгүүлбэр давтаарай 🚌",
  "BT09": "Инээж байж сурсан зүйл мартагддаггүй — сонирхолтой байх нь ой санамжийн цавуу 😄",
  "BT10": "Чангаар хэлсэн өгүүлбэр л жинхэнэ чинийх — өнөөдөр сурснаа нэг өгүүлбэрээр хэлээд үз 🗣️",
  "BT11": "Утасны дугаар шиг — урт өгүүлбэрийг 3 хэсэгт хуваавал амархан цээжлэгддэг 🧩",
  "BT12": "Андуурсан мөчид тархи хамгийн ихээр сурдаг — энэ бол синапс шинэ гүүр барьж байгаагийн дохио 🚧",
  "BT13": "Найздаа тайлбарлаад үз — зааж чадаж байвал чи үнэхээр мэддэг гэсэн үг 👥",
  "BT14": "Өглөө сэрээд шууд 5 минут давт — шөнөжин цэгцлэгдсэн ой санамж дээр тамга дарна ☀️",
  "BT15": "Шивэхээс илүү гараараа бич — гараар бичсэн үсэг тархинд илүү гүн хадгалагддаг ✍️",
  "BT16": "Үгтэй дуу хичээлийн үед анхаарлыг булааж авдаг — харин хичээлийн дараах шагнал болгоход хамгийн гоё 🎧",
  "BT17": "Тархины 75% нь ус — цангаа бол төвлөрлийн хулгайч 💧",
  "BT18": "Тархи нэг дор хоёр зүйл хийж чаддаггүй — утсаа өөр өрөөнд тавиарай 📵",
  "BT19": "«TOPIK-д тэнцэнэ» гэхээс «өнөөдөр 10 үг» гэж зорь — тархи жижиг ялалтыг түлш болгодог 🔥",
  "BT20": "Хичээлээс харих замдаа өнөөдөр сурсан 3 зүйлээ сана — алхаж яваа тархи ой санамжаа цэгцэлдэг 🌆",
  "BT21": "Унтахын өмнөх 10 минут бол цээжлэх алтан цаг — юу ч саадгүйгээр шууд хадгалагддаг 🌙",
  "BT22": "Дуудлага чинь сайжрахад сонсгол ч нээгддэг — ам, чих хоёр нэг хэлхээ 👂",
  "BT23": "Зөвхөн өчигдрийн өөртэйгөө л харьцуулаарай — бусадтай харьцуулах нь суралцах дааврыг унтраадаг 🪞",
  "BT24": "25 минут төвлөрөөд 5 минут зүгээр амар — амарч байх зуур тархи бүгдийг цэгцэлдэг 🧹",
  "BT25": "Хариултаас илүү асуулт тогтдог — «яагаад?» гэж асуусан зүйл удаан хадгалагддаг ❓",
  "BT26": "5 үгээр богино түүх зохиогоод үз — тархи жагсаалтаас илүү түүхэнд дуртай 📖",
  "BT27": "«Миний солонгос хэл өдөр бүр сайжирч байна» гэж хэлдэг тархи үнэхээр тийм байдлаар холбогддог 🧠",
  "BT28": "Өглөө 10 минут наранд гар — энэ шөнийн сайхан нойрыг захиалдаг товчлуур 🌅",
  "BT29": "Сурснаас хойш 24 цагийн дотор нэг удаа давт — мартах муруйг тэр дороо нугалчихна 📉",
  "BT30": "Өдөр бүр нэг алхам — синапс нэг дор биш, өдөр бүрийн хуримтлалаар ургадаг 🌱",
};

function injectMongolianContents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ct = ss.getSheetByName('contents');
  if (!ct || ct.getLastRow() < 2) { Logger.log('injectMongolianContents: contents 시트 없음/비어 있음 — 중단'); return; }
  const mnCol = langColOf_(ct, '몽골어'); // [v9.39] 고정 7열 폐기 — Glide 'Row ID' 열 보호(translateContents와 동일 규칙)
  const last = ct.getLastRow();
  const ids = ct.getRange(2, 1, last - 1, 1).getValues();      // A열(콘텐츠ID)만
  const mnV = ct.getRange(2, mnCol, last - 1, 1).getValues();  // 기존 번역 열 전체 보존 후 대상만 교체
  let updated = 0, kept = 0;
  const seen = {};
  for (let i = 0; i < ids.length; i++) {
    const id = String(ids[i][0]);
    if (!Object.prototype.hasOwnProperty.call(MN_CONTENTS_G, id)) continue; // 대상 외 행은 그대로
    seen[id] = true;
    const mn = MN_CONTENTS_G[id];
    if (String(mnV[i][0] || '') === mn) { kept++; continue; } // 멱등 가드
    mnV[i][0] = mn; updated++;
  }
  const missing = Object.keys(MN_CONTENTS_G).filter(function (id) { return !seen[id]; });
  if (updated) ct.getRange(2, mnCol, mnV.length, 1).setValues(mnV); // 무변동이면 쓰기 생략
  Logger.log('injectMongolianContents: 갱신 ' + updated + '건 · 이미 최신 ' + kept + '건 · 시트에 없는 id ' + missing.length + '건 (몽골어=' + mnCol + '열)'
    + (missing.length ? ' → ' + missing.join(', ') + ' (setupHomework*/setupQuiz*/setupBrainTips 실행 여부 확인)' : ''));
}

/* ===================== ② 병렬 상수 — contents 시트에 없는 유형 =====================
 * ⚠ 연결 배선은 후속 결정 — 아래 상수는 아직 어디에서도 참조되지 않는다(적재만).            */

// 🔮 운세 — FORTUNES(Code.js L713)와 배열 인덱스 1:1 (FT01~FT36)
const MN_FORTUNES = [
  "Өнөөдөр ярьж хариулах аз хүчтэй өдөр ✨ Гараа өргөх мөч чинь өнөөдрийн сорилт болно",
  "Гэрийн даалгаврын дагина ажиж байгаа өдөр 📝 Дуусгасан тэмдэг чинь ердийнхөөс илүү гялалзана",
  "Сурснаа найздаа тайлбарлаж өгвөл хоёр дахин сайн тогтох өдөр 🤝",
  "Өнөөдөр цээжилсэн нэг үг дараагийн шалгалтад яг тэр чигээрээ гарах шинжтэй 🎯",
  "Багштай харц тулгарах мөчид зөв хариулт санаанд орж ирэх өдөр 👀",
  "Босс чиний цохилтоос онцгой айж байгаа өдөр ⚔️",
  "Чимээгүй сууж байхад л синапс чинь өөрөө холбогдох өдөр 🧠",
  "Нэг асуулт бүхэл ангийг аврах өдөр 🙋 Зоригтой асуугаарай!",
  "Өнөөдрийн хэцүү асуулт маргаашийн нууц мэх болох өдөр 💪",
  "Монстр чинь дуудлагыг чинь дуурайхыг хүсэж байгаа өдөр 🗣️",
  "Солонгосоор өөртэйгөө ярьвал аз дагуулах өдөр 🍀",
  "Найзтайгаа хамтрах аз оргилдоо хүрсэн өдөр — хамтдаа хийвэл бүх юм бүтнэ 👯",
  "Ердийнхөөс яг 5 минут илүү — тэр 5 минут хувьслыг чинь ойртуулах өдөр ⏰",
  "Тэмдэглэл хөтлөх аз гэрэлтэх өдөр ✏️ Өнөөдрийн тэмдэглэл чинь эрдэнэс болно",
  "Монстр чинь харандааны саванд чинь атаархаж байгаа өдөр ✏️",
  "Амттангаа идээд цээжилбэл хоёр дахин сайн тогтох өдөр 🍙",
  "Өнөөдөр анх удаа харсан үгтэйгээ найз болох хувь тавилантай өдөр 📖",
  "Цонхоор гадагш харсан ч зүгээр — таслал байж өгүүлбэр бүтэн болдог шүү дээ ☁️",
  "Намуухан дуу ч чанга сонсогдох өдөр 🎤 Өөртөө итгэлтэй байгаарай!",
  "Өчигдрийн өөрөөсөө яг +1P илүү — энэ бол өнөөдрийн даалгавар 🎯",
  "Монстр чинь өглөөнөөс л сайхан сэтгэлтэй, ая аялж байна 🎵",
  "Баллуураа гээчихсэн ч инээгээд өнгөрөөвөл аз ирэх өдөр 😄",
  "Өнөөдөр үзсэн дүрэм зүүдэнд чинь орж ирэх магадлал 87% 💤",
  "Нэг солонгос дуу өнөөдрийн шилдэг багш чинь болох өдөр 🎧",
  "Лигийн өрсөлдөгч нэрийг чинь сонсоод л сандарч эхлэх өдөр 🔥",
  "Цомгийн дараагийн монстр чамайг сэмхэн ажиж байгаа өдөр 👻",
  "Өнөөдөр инээмсэглэвэл синапс чинь хоёр дахин бат бөх болно 😊",
  "Андуурлын аз уу? Үгүй ээ, туршилтын аз орж ирсэн өдөр 🧪",
  "Хамгийн хэцүү дасгалаа эхэлж хийвэл үлдсэн нь урсаад л бүтэх өдөр 🗝️",
  "Найзынхаа нэг сайхан талыг хэлж өгвөл чамд хоёр болж эргэж ирэх өдөр 💐",
  "Өнөөдрийн орд: Синапсын орд — холбоосын эрч хүчээр дүүрэн өдөр ⭐",
  "Ширээгээ цэгцлэх аз өссөн өдөр — цэвэрхэн ширээн дээр сайхан өдөр бууж ирдэг ✨",
  "Урьд нь хэрэглэж байгаагүй шинэ хэллэг туршвал гайхалтай юм болох өдөр 🎲",
  "Монстр чинь \"Өнөөдөр эзэн минь супер гоё харагдана\" гэж зөгнөжээ 🔮",
  "Нэг аяга ус уугаад эхэлбэл төвлөрөл чинь дээд түвшиндээ хүрэх өдөр 💧",
  "Өнөөдрийн нэг алхам чинь түүхийн номын чинь нэг өгүүлбэр болох өдөр 📖",
];

// 💬 몬스터의 한마디 — SPEAK(L734)와 동일 구조. 말투: [0]=아기말(1-2단계) [1]=친구말(3-5) [2]=현자말(6-7)
//    evosoon의 {n} 플레이스홀더(다음 진화까지 P)는 원문 그대로 유지됨
/* [함께한날 막6] MN_SPEAK — 구 몬스터 한마디 뱅크(today/miss3/miss7/evosoon/idle)를 소각하고 sceneSpeak_ 가
 * 같이 쓰는 둘(생일·도전인정)만 남겼다. miss 계열 소각 근거 = 발화표 S19 「끊김 절대 언급 ✗」.
 * ⚠ 몽골어가 한국어(SPEAK)보다 짧은 것은 의도다 — MJ_pairPick_ 가 빈 자리는 병기를 생략한다(지어내지 않는다). */
const MN_SPEAK = {
  crown: ["Өнөөдөр зориглон оролдсон чинь дэлхийд хамгийн гоё байлаа 🔥 Шөнөжин гайхуулна шүү!","Өчигдрийн өөрийгөө даван гарлаа — үнэхээр гялалзаж байлаа 🌱","Чинийг гараа өргөхийг би хамгийн түрүүнд харсан! ✨"],
  bday: ["Өнөөдөр бол чиний л өдөр! Дэлхийд хамгийн түрүүнд би баяр хүргэе 🎂🎉","Төрсөн өдрийн мэнд — чи мэндэлсэн учраас би ч бас мэндэлж чадсан билээ 🎂"]
};

// 📖 스토리북 — STORY_GRAMMAR(L4412)와 동일 구조: 월(1~12)×4 [문형(한국어 유지), 의미(몽골어)]
const MN_STORY_GRAMMAR = [
  [["-느라고","шалтгаан · шалтаг"],["-았/었더니","өөрөө хийж үзээд гарсан үр дүн"],["-는 바람에","гэнэтийн шалтгаан"],["-기 마련이다","жам ёсны хэрэг"]],  // 1월
  [["-(으)ㄹ 뻔하다","бараг л болох шахсан"],["-고 말다","эцэст нь тэгж болчихсон"],["-도록","зорилго · хэмжээ"],["-는 김에","дашрамд нь"]],  // 2월
  [["-자마자","яг дараа нь шууд (-магц)"],["-(으)ㄹ수록","нэг нь өсөхөд нөгөө нь дагаж өөрчлөгдөх (-х тусам)"],["-는 대신에","оронд нь · орлуулах"],["-기만 하면","давтагдах нөхцөл (…л бол)"]],  // 3월
  [["-다 보니","хийсээр байгаад олж мэдэх"],["-(으)ㄹ 만하다","хийх үнэ цэнэтэй"],["-는 척하다","дүр эсгэх"],["-거든요","шалтгаанаа тайлбарлах"]],  // 4월
  [["-(으)ㄴ 지","өнгөрсөн хугацаа (хэр удсан)"],["-을/를 통해","арга хэрэгсэл (-ээр дамжуулан)"],["-는 데다가","дээр нь нэмэх"],["-기 나름이다","хэрхэн хийхээс л шалтгаална"]],  // 5월
  [["-던","эргэн санах · дурсамж"],["-(으)ㄹ 리가 없다","«тийм байх боломжгүй» гэсэн хүчтэй таамаг"],["-곤 하다","зуршил (байнга хийдэг)"],["-(으)면서도","нэгэн зэрэг боловч эсрэг утгатай (мөртлөө)"]],  // 6월
  [["-느니 차라리","сонголт (…снаас илүү)"],["-는 통에","үймээнээс болсон шалтгаан"],["-기는커녕","«байтугай» гэсэн хүчтэй онцлох утга"],["-(으)ㄹ 겸","хоёр зорилго нэг дор"]],  // 7월
  [["-다가","үйл дундаа солигдох (шилжилт)"],["-(으)ㄴ 채로","байдал хэвээр нь · чигээрээ"],["-을 뿐만 아니라","зөвхөн … төдийгүй"],["-기 십상이다","амархан тэгж болдог"]],  // 8월
  [["-더니","ажигласны дараах өөрчлөлт"],["-(으)ㄹ 정도로","хэмжээ (тийм хэмжээнд)"],["-는 한","нөхцөлийн хязгаар (байгаа л бол)"],["-기에","шалтгаан заана (бичгийн хэллэг)"]],  // 9월
  [["-고 나서","үйлийн дараалал (~хийж дуусаад)"],["-(으)ㄹ 테니까","таамагласан шалтгаан (~байх болохоор)"],["-는 반면에","эсрэгцүүлэл (~байдаг бол харин)"],["-을 비롯해서","төлөөлөх жишээ (~зэргээс эхлээд)"]],  // 10월
  [["-자","болмогц шууд (~мэгц)"],["-(으)므로","шалтгаан (албан бичгийн хэллэг)"],["-든지","сонголт жагсаах (~ч бай, ~ч бай)"],["-기 위해서","зорилго (~хийхийн тулд)"]],  // 11월
  [["-았/었더라면","өнгөрсний таамаглал (хэрэв ~сан бол)"],["-(으)ㄹ 겸 해서","давхар зорилго (~хийхийн зэрэгцээ)"],["-는 데 비해","харьцуулалт (~хийдэгтэй харьцуулбал)"],["-고서야","~сны дараа л сая (тэгж байж)"]],  // 12월
  [["-는 길에","явах ирэх замын зуур"],["-(으)ㄴ/는 덕분에","талархууштай шалтгаан (~ын ачаар)"],["-기로 하다","шийдвэр · амлалт"],["-게 되다","нөхцөл өөрчлөгдсөний үр дүн"]],  // 13월
  [["-(으)ㄴ/는 편이다","ерөнхий хандлага (тийм талдаа)"],["-(으)ㄹ까 봐","болчих вий гэсэн болгоомжтой таамаг"],["-아/어 놓다","урьдчилан хийж бэлдсэн байдлаа хадгалах"],["-잖아요","хоёулаа мэдэх зүйлээ баталгаажуулах (~шүү дээ)"]],  // 14월
  [["-더라고요","өөрөө үзсэнээ ярьж дамжуулах"],["-나 보다","харж мэдэрснээс төрсөн таамаг (бололтой)"],["-는 대로","хиймэгц шууд · байгаа чигээр нь"],["-아/어 버리다","бүрэн дуусгачихах"]],  // 15월
  [["-다 보면","үргэлжлүүлсээр байвал гарах үр дүн"],["-(으)려던 참이다","яг хийх гэж завдаж байсан үе"],["-고 해서","олон шалтгааны нэг нь"],["-은/는 물론이고","мэдээжийн хэрэг дээр нь нэмээд (~төдийгүй)"]],  // 16월
  [["-던데","үзсэн зүйлээ суурь болгон дурдах"],["-(이)야말로","яг л тэр гэж онцлох"],["-만 해도","ганцхан жишээ дурдахад л"],["-게 하다","хийлгэх (үйлдүүлэх хэв)"]],  // 17월
  [["-(으)려다가","санаснаа өөрчлөх"],["-는 셈이다","тооцоод үзвэл адилхан гэсэн үг"],["-에 달려 있다","тэр зүйлээс л шалтгаална"],["-다니","санаанд оромгүй гайхшрал (гэнэ ээ!)"]],  // 18월
  [["-더라도","тэгсэн ч гэсэн гэх буултын таамаг"],["-(으)로 인해","шалтгаан (бичгийн хэллэг)"],["-에 따라","жишиг болгох · дагаж өөрчлөгдөх"],["-고자","зорилго (бичгийн хэллэг)"]],  // 19월
  [["-(으)ㄴ 끝에","урт үйл явцын эцэст гарсан үр дүн"],["-기가 무섭게","хиймэгц тэр даруй"],["-(으)며","жагсаах · зэрэгцүүлэх (бичгийн хэллэг)"],["-(으)ㅁ으로써","арга хэрэгсэл (бичгийн хэллэг)"]],  // 20월
  [["-는가 하면","нөгөө талд нь эсрэгцүүлэн жагсаах"],["-(으)ㄹ 뿐이다","зөвхөн л тэр"],["-다시피","мэдэж байгаачлан"],["-(으)ㄴ 나머지","хэтэрхий их болсноос гарсан үр дүн"]],  // 21월
  [["-에도 불구하고","гэсэн хэдий ч (буулт)"],["-(으)ㄹ 지경이다","тийм болтлоо туйлын хэмжээ"],["-기에 앞서","хийхээсээ өмнө эхлээд"],["-는 가운데","үргэлжилж буй нөхцөл байдлын дунд"]],  // 22월
  [["-(으)ㄹ 법하다","тийм байж болохуйц таамаг"],["-다 못해","хэмжээнээсээ хальж"],["-아/어 내다","эцсийг нь хүртэл хийж чадах"],["-치고","бүгдэд адил хамаатай · жишгээс гадуур санаанд оромгүй"]],  // 23월
  [["-(으)ㄹ 따름이다","ердөө л тийм (бичгийн хэллэг)"],["-기 그지없다","хэмжээлшгүй тийм"],["-(으)ㄹ지언정","тэгэх байлаа ч гэсэн хүчтэй буултын сонголт"],["-(으)리라","бат зориг · таамаг (бичгийн хэллэг)"]],  // 24월
];

// 스토리북 제목 6종 — STORY_TITLES(L4426) 1:1, {boss} 치환 플레이스홀더 유지
const MN_STORY_TITLES = [
  "{boss} ба синапсын оч",
  "{boss} үлдээсэн зүйл",
  "{boss} бидэнтэй уулзсан тэр үе",
  "{boss}-оос ч илүү гэрэлтсэн хүүхдүүд",
  "{boss}-гийн улирал — өсөлтийн улирал",
  "Баяртай, {boss} — бид өслөө",
  "{boss} давж гарсны дараах өглөө",
  "{boss} зааж өгсөн өгүүлбэрүүд",
  "{boss} авчирсан шөнийг туулах арга",
  "Нэг сөөмөөр өссөн бид ба {boss}",
];

// 스토리북 12경 — STORY_SCENES(L4429) 1:1: [장소명, 도착 묘사, 문화 디테일, 보스 등장]
const MN_STORY_SCENES = [
  [ // 1월
    "Цас будран буух Дөксүгүн ордны хэрмэн зам",
    "Анхны цас будрах үеэр кру нар Дөксүгүн ордны чулуун хэрмийн дагуух замаар алхлаа. Амьсгал нь цагаан уур болон дэгдэж, хэрмэн дээр цас зөөлөн хунгарлав.",
    "Загас хэлбэртэй халуун боов бунгоппанг хоёр хувааж идэнгээ \"머리부터? 꼬리부터?\" (Толгойноос нь үү, сүүлнээс нь үү?) гэж инээлдэв. Солонгосын өвөл бунгоппаны үнэрээр эхэлдгийг кру нар тэгэхэд мэдэж авлаа.",
    "Яг тэр үед хэрмийн сүүдэр сонин уртаар сунан, цасан ширхгүүд өөд нь эргэн дүүлэв.",
  ],
  [ // 2월
    "Кванжан захын хоолны гудамж",
    "Соллаль буюу Солонгосын цагаан сарын амралтаар Кванжан зах хүмүүсийн инээд хөөрөөр дүүрэн байлаа. Кру нар биндэтток шарах чимээг дагаад гудамжны гүн рүү орлоо.",
    "Алдарт жижиг кимбап, юкхвэ хэмээх махан хоолоо өмнөө тавиад хамгийн бяцхан кру \"이모, 여기 하나 더요!\" (Эгч ээ, нэгийг нэмээд өгөөч!) гэж төгс дуудлагаар хэлэхэд бүгд алга ташлаа.",
    "Гэтэл захын гэрлүүд нэг нэгээрээ унтарч, гудамжны үзүүрээс хүнд сүүдэр аажуухан мөлхөн гарч ирэв.",
  ],
  [ // 3월
    "Ёыйдогийн интоорын цэцгийн зам",
    "Дөрөвдүгээр сарын Ёыйдод интоорын цэцэг цас мэт будран нисэж байлаа. Кру нар дэлбээг алгандаа тосон Юнжунно замаар алхлаа.",
    "Дэвсгэрээ дэлгээд кимбап хуваан идэж байтал хажуугаар өнгөрч явсан эмээ \"학생들 한국말 참 잘하네\" (Сурагчид солонгосоор үнэхээр сайн ярьж байна шүү) гэж инээмсэглэв. Тэр ганцхан үгэнд бүгдийн мөр тэнийв.",
    "Гэнэт салхи зогсож, будран нисэж байсан интоорын дэлбээнүүд агаарт хөдөлгөөнгүй царцав.",
  ],
  [ // 4월
    "Кёнбоккүн ордонд ханбогтой зугаалга",
    "Кру нар өнгө өнгийн ханбог өмсөөд Кёнбоккүн ордны Кынжонжон танхимын өмнө зогсов. Бие биенийхээ ханбогийн уяаг зангидаж өгөнгөө удаан инээлдлээ.",
    "Хаалгач цэргүүдийн ээлж солих ёслолын хэнгэргийн аяар алхаж явтал гадаад жуулчин зураг авахуулахыг хүсэхэд \"김치~\" (Кимчи~) гээд позоо ч барьж өглөө.",
    "Яг тэр агшин Кынжонжоны дээврийн сахиус барималуудын дундаас үл таних бараан дүрс аажуухан өндийв.",
  ],
  [ // 5월
    "Хан мөрний эрэг дээрх чикен пикник",
    "Тавдугаар сарын Хан мөрний паркад кру нар дэвсгэр дээрээ чикен, рамёнаа дэлгэлээ. Мөрний сэвшээ салхи сэрүүхэн үлээнэ.",
    "Хүргэлтийн аппаар захиалсан чикен яг дэвсгэрийн өмнө ирэхийг хараад бүгд \"한국 최고!\" (Солонгос шилдэг нь!) гэж хашхирлаа. Дэлгүүрийн рамён чанагч машины өмнө хөгжилтэй ээлж булаацалдаан ч болов.",
    "Гэтэл намуухан долгилж байсан Хан мөрөн гэнэт зогсонги болж, усны гүнээс асар том сүүдэр хөвөн гарч ирэв.",
  ],
  [ // 6월
    "Намсан уулын нар жаргах харагдацын тавцан",
    "Дүүжин замаар Намсан уулын оройд гарсан кру нар үдшийн улаан туяанд будагдсан Сөүлийг ширтэв. Хайрын цоожнуудын хажууд хүсэл бүрээ нэг нэгээр үлдээлээ.",
    "\"Сөүл ийм уудам байсан юм уу?\" гэж нэг нь шивнэхэд нөгөө кру нь \"Бидний сурсан солонгос хэлээр энэ том хоттой бүхэлд нь ярилцаж чадна шүү дээ\" гэж хариулав.",
    "Үдшийн туяа оргилдоо хүрэх агшинд цамхгийн сүүдэр гэнэт хоёр дахин уртсан мушгиран хөдөллөө.",
  ],
  [ // 7월
    "Бусаны Хэүндэ далайн эрэг",
    "Зуны амралтаар кру нар KTX-д сууж Бусан руу аяллаа. Хэүндэгийн элсэн эрэгт хөл тавимагц давалгаа шагайг нь гижигдэв.",
    "Мильмён, үртэй хотток авч бариад Бусан аялгаар \"마, 억수로 맛있네!\" (Ёстой аймшигтай амттай юм аа!) гэж дуурайж хэлээд бүгд нэг зэрэг инээлдлээ.",
    "Тэр үед тэнгисийн хаяа бэхэн хар өнгөөр бүрхэгдэж, давалгаа сонин хэмнэлээр хөлбөрч эхэллээ.",
  ],
  [ // 8월
    "Хондэгийн баскинг гудамж",
    "Баасан гарагийн орой, Хондэгийн алхмаар гудамжинд кру нар баскинг тайзны өмнө цугларлаа. Гитарын эгшиг, алга ташилт гудамжийг дүүргэнэ.",
    "Тайзнаас микрофон дамжуулж авсан нэг кру солонгос дууны нэг бадгийг дуулахад хажуугаар өнгөрөгсөд уухайлан дэмжив. Токпокки барьсан гар нь чичрэх шахам догдолмоор мөч байлаа.",
    "Яг тэр мөчид чанга яригч шаржигнаад, тайзны ард харанхуйгаас намуухан инээх чимээ сонсогдов.",
  ],
  [ // 9월
    "Букчон ханок хотхоны гудамж",
    "Намрын нэгэн үдээс хойш кру нар Букчоны вааран дээвэртэй байшингуудын хоорондох нарийн гудамжуудыг судаллаа. Гудамж бүрд өөр өөр Сөүл нуугдаж байв.",
    "Ханок кафед тэчүча буюу чавга цай ууж суутал цаасан хаалгаар нэвт гэрэлтэх наранд бүгд үг дуугүй болов. \"Эрт цагийн хүмүүс ийм байшинд сууж хичээлээ хийдэг байж дээ.\"",
    "Гэтэл гудамжны үзүүрийн хэрмэн дээрх сүүдэр хэн ч алхаагүй байхад өөрөө хөдөлж эхэллээ.",
  ],
  [ // 10월
    "Сораксан уулын алтан намрын авиралт",
    "Навчис хамгийн улаанаар гялалзах үеэр кру нар бие биеэ татан дэмжсээр Ганхдаг хад хүртэл авирлаа. Уул бүхэлдээ улаанаар бадарч байлаа.",
    "Оргилын ойролцоох мухлагт аяган рамёнаа үлээн хооллонгоо \"Ууланд идсэн рамён дэлхийд хамгийн амттай\" гэдэг солонгос үнэнийг биеэрээ мэдэрлээ.",
    "Тэр үед улаан навчис унахаа больж, агаарт эргэлдэн хуйларч эхлэв.",
  ],
  [ // 11월
    "Лотте Уорлдын нэг өдрийн тасалбар",
    "Улирлын шалгалт дууссаныг тэмдэглэж кру нар Лотте Уорлд руу явлаа. Хөөрхөн толгойн боолтуудаа хуваан зүүгээд карусельны өмнө хамтын зургаа ч даруулав.",
    "Жайродропын өмнө \"먼저 타\" \"네가 먼저 타\" (Чи түрүүлж суу! — Үгүй, чи түрүүлж!) гэж хэлэлцсээр эцэст нь бүгд хамт суулаа. Буугаад хөл нь чичирсээр удаан инээлдэв.",
    "Парадын хөгжим гэнэт тасарч, мөсөн гулгуурын талбайн голын гэрэл унтран хүйтэн жавар түгэв.",
  ],
  [ // 12월
    "Босингакийн шинэ жилийн хонх",
    "Оны сүүлчийн шөнө кру нар Босингакийн өмнөх түмэн олны дунд зогсов. Амьсгалын уур, уухайн чимээ хоёр холилдон шөнийн тэнгэр өөд дэгдэнэ.",
    "\"쓰리, 투, 원!\" (Гурав, хоёр, нэг!) гэж солонгосоор хоолой сөөтөл хамт тоолж, хонхны дуу эгшиглэмэгц бие биеэ тэврэлдэв. Танил бус орны шинэ жил бидний шинэ жил болсон шөнө байлаа.",
    "Гучин гурав дахь хонхны дуу эгшиглэх гэж байтал — хонх зогслоо. Талбайн том дэлгэц шаржигнан хар өнгөөр бүрхэгдэв.",
  ],
  [ // 13월
    "Жонжу ханок хотхоны бибимбап гудамж",
    "Өвлийн өглөөний Жонжу ханок хотхонд кру нар вааран дээврийн нөмөр дэх гудамжаар аажуухан алхлаа. Чулуун шалан дээгүүр цагаан амьсгалын уур дэгдэнэ.",
    "Гуулин аяганд хийсэн Жонжу бибимбапаа хутгангаа \"이렇게 색이 많은 밥은 처음이야\" (Ийм олон өнгөтэй хоол анх удаа үзэж байна!) гэж инээлдэв. Нэг аяган доторх өнгөний зохицлыг кру нар эхлээд нүдээрээ сурлаа.",
    "Яг тэр үед дээврийн ирмэг дэх салхин хонхны дуу тэс зогсож, гудамжны манан нэг том бөөгнөрөл болон дүгжирч босов.",
  ],
  [ // 14월
    "Каннын хотын Анмок эргийн кофе гудамж",
    "Хоёрдугаар сарын Канныне кру нар Анмок эргийн кофены гудамжинд хүрч ирлээ. Өвлийн далай шил мэт гялалзаж, дөнгөж хуурсан кофены үнэр давалгааны чимээтэй холилдон ирнэ.",
    "Халуун кофе, кофены буурцаг хэлбэртэй боовоо бариад далан дээр зэрэгцэн суулаа. \"바다를 보면서 마시는 커피가 진짜 강릉의 맛이래.\" (Далай харангаа уух кофе л жинхэнэ Канныны амт гэнэ лээ.) Цахлай ганганан ойртоход бүгд боовоо чанга тэврэв.",
    "Гэтэл тэнгисийн хаяаны манан аажуухан нүүж ирээд, далангийн өмнө асар том хөөсөн бөөн болон хөөж мандав.",
  ],
  [ // 15월
    "Кёнжу хотын Дэрынвоны чулуун хэрэм ба Чомсондэ",
    "Хаврын эхэн үеийн Кёнжуд кру нар Дэрынвоны зөөлөн толгодын хоорондох жимээр алхлаа. Хэрмийн цаана магнолиа цагаанаар дэлбээлж байв.",
    "Мянган жилийн өмнө одод ажигладаг байсан Чомсондэ цамхгийн өмнө дөнгөж жигнэсэн хваннам боов хуваан идэнгээ \"신라 사람들도 이 하늘을 봤겠지?\" (Шилла улсын хүмүүс ч энэ тэнгэрийг харж байсан байх даа?) гэж шивнэлдэв. Эртний хот гэнэт маш ойрхон санагдлаа.",
    "Яг тэр агшин Чомсондэгийн сүүдэр нарны эсрэг зүг рүү эргэж эхлэн, хөвд бүрхсэн чулуунууд өнхрөн нэг тийш цугларав.",
  ],
  [ // 16월
    "Босон хотын ногоон цайны талбайн ногоон шат",
    "Дөрөвдүгээр сарын Босонд кру нар ногоон давалгаа шат мэт үргэлжлэх цайны талбайн толгод өөд гарлаа. Хаврын бороог угтаж буй цайны навчис ногоон туяагаар гялалзана.",
    "Дөнгөж түүсэн анхны ургацын цайны навчийг алгандаа тавьж үнэрлээд, харагдацын тавцан дээр ногоон цайны зайрмаг хуваан идлээ. \"우전, 세작 — 찻잎 한 장에도 계절 이름이 붙는구나.\" (Үжон, Сэжак — цайны нэг навчинд ч улирлын нэр өгдөг юм байна.) Кру нар шинэ үгсийг зайрмаг шиг аажуухан амталлаа.",
    "Гэтэл талбайн зурвасуудын хоорондох манан ногоон өнгөөр будагдаж, толгодын чинээ том бөөн болон нийлж эхлэв.",
  ],
  [ // 17월
    "Тамян хотын Жукногвон хулсан ой",
    "Тавдугаар сарын Тамянд кру нар тэнгэр өөд сүндэрлэх хулснуудын хоорондох жимээр орлоо. Салхи үлээх бүрд хулсны навчис далайн давалгаа мэт шаржигнана.",
    "Хулсан саванд агшаасан будааны тагийг нээмэгц уур савсан гарч, хулсны нахиатай хачир амссан нэг кру \"대나무를 먹는 거야?\" (Хулс иддэг юм уу?) гэж нүдээ бүлтийлгэв. Хулсны нахиа өдөрт нэг метр хүртэл өсдөг гэхийг сонсоод бүгд \"우리 같네!\" (Яг бид шиг юм аа!) гэж инээлдлээ.",
    "Тэр үед салхи ч үгүй атал хулсан ой бүхэлдээ найгаж, хөрсийг сөхөн байшингийн чинээ том хулсны нахиа огцом цухуйв.",
  ],
  [ // 18월
    "Ёсу хотын шөнийн далайн почха гудамж",
    "Зуны эхэн үдэш кру нар Ёсугийн далайн эргийг дагасан почха буюу задгай мухлагуудын романтик гудамжинд хүрч ирлээ. Боомтын гэрэл хар далайн мандал дээр алтан тоос мэт хөвнө.",
    "Почхад каткимчи, тукссэү сам хоёрыг амсангаа \"맵지만 자꾸 손이 가!\" (Халуун ногоотой ч гар аяндаа сунгаад л байна!) гэж дуу алдлаа. Мухлагийн эзэгтэй \"우리 여수 밤바다가 노래보다 예쁘지?\" (Манай Ёсугийн шөнийн далай дуунаас ч илүү үзэсгэлэнтэй биз дээ?) гэхэд кру нар толгой чанга дохив.",
    "Гэтэл далайн мандал дээрх гэрлүүд найган нэг тийш цугларч, зөөлхөн желе мэт хөөж дугтран агаарт хөөрөв.",
  ],
  [ // 19월
    "Борён хотын Дэчон эргийн шаварт наадам",
    "Зуны тэг дундын Дэчон эрэгт кру нар шаварт наадмын яг гол руу үсрэн орлоо. Саарал шавраар хучигдсан хүмүүс бүгд адилхан царайгаар инээж байв.",
    "Бие биенийхээ нүүрэнд шавар түрхэлцсээр хэн нь хэн болохоо танихаа болиод, \"이 진흙이 피부에 좋대!\" (Энэ шавар арьсанд сайн гэнэ лээ!) гэсээр улам ч хөгжилтэй түрхэлцэв. Шавран гулгуур дээр зөвхөн дуу хоолойгоор нь бие биеэ олж байлаа.",
    "Тэр үед далайн татрамын гол хэсэг буцалж, шаврын хөөс уул мэт овоорон гулдран босов.",
  ],
  [ // 20월
    "Жэжү арлын Үдо — чулуун хэрэм ба хэнё",
    "Наймдугаар сарын Жэжүд кру нар завиар Үдо арал руу гарав. Оюу ногоон далай, хар базальт чулуун хэрэм хоёр зураг мэт үргэлжилнэ.",
    "Далайн гүнээс шумбалтаа дуусгаад гарч ирсэн хэнё эмээгийн \"호오이—\" (хоо-ой—) гэх сумбисори буюу амьсгаагаа гаргах эгшгийг бүгд чимээгүйхэн чагнав. Үдогийн алдарт самрын зайрмагаа бариад толхаруван чулуун хөшөөний хажууд яг адилхан царай гарган зургаа даруулав.",
    "Гэтэл эргийн чулуун хэрэм дүр дүр хийн өөрөө хөдөлж, нэг том чулуун биет болон давхарлан өрөгдөж эхлэв.",
  ],
  [ // 21월
    "Андон хотын Хахуэ тосгоны баг бүжгийн талбай",
    "Намрын эхэн үеийн Андонгийн Хахуэ тосгонд кру нар мөрөн тосгоныг бүтэн тойрон урсах үзэсгэлэнт байдлыг гайхан биширч, баг бүжгийн тоглолтын талбайд суудлаа эзэллээ.",
    "Хахуэ багны инээсэн царайг дуурайлган зурж, мөрөө хөдөлгөх солонгос бүжгийг ч сурлаа. \"탈을 쓰면 부끄러움이 사라진대!\" (Баг зүүвэл ичих сэтгэл замхардаг гэнэ лээ!) гээд нэг кру баг зүүж солонгос мэндчилгээ хашхирахад талбай дүүрэн алга ташилт нижигнэв.",
    "Яг тэр агшин талбайн хэнгэргийн чимээ тэс зогсож, нэг модон баг өөрөө өнхрөн гарч ирээд улам улам томорч эхлэв.",
  ],
  [ // 22월
    "Жинжу хотын Намган мөрний усан дэнлүүний наадам",
    "Аравдугаар сарын Жинжуд кру нар Намган мөрнийг дүүргэсэн юдын буюу усан дэнлүүнүүдийн гэрлийн дундуур алхлаа. Мөрний ус мянга мянган хүслээр гялалзана.",
    "Кру нар ч хүслийн дэнлүүн дээрээ солонгосоор нямбай гаргацтай хүслээ бичээд мөрөнд хөвүүлэв. \"내년의 나에게 보내는 편지 같아.\" (Ирэх жилийн өөртөө илгээж буй захидал шиг байна.) Дэнлүү холдох тусам сэтгэл дэх хүсэл нь улам тодорч байлаа.",
    "Гэтэл мөрний салхи эргэлдэж эхлэн, нэг бөөрөнхий жижигхэн хуй мөрөн дээр бууж ирээд дэнлүүнүүдийн дундуур наргиантайгаар сүлжин тоглов.",
  ],
  [ // 23월
    "Сунчонман булангийн зэгсэн талбайн нар жаргалт",
    "Арван нэгдүгээр сарын Сунчонманд кру нар үзүүр хязгааргүй үргэлжлэх зэгсэн талбайн модон замаар алхлаа. Салхи өнгөрөх бүрд мөнгөлөг зэгс нэг зүг рүү давалгаална.",
    "Харагдацын тавцан дээр гарахад жаргах нарны туяан дунд хар тогоруунуудын сүрэг V үсэг зурсаар нисэн хөөрөв. \"겨울을 나러 시베리아에서 여기까지 온대.\" (Өвөлжихөөр Сибирээс энд хүртэл нисэж ирдэг гэнэ.) Мянга мянган километр туулж ирсэн шувуудын өмнө кру нар удтал тэнгэр ширтэн зогсов.",
    "Тэр үед зэгсэн талбайн гол хэсэг дугуй хэлбэртэйгээр налж, зэгсний бөөн өнхөрсөөр улам том бөмбөг мэт хөөж томорлоо.",
  ],
  [ // 24월
    "Мёндон гудамжны зул сарын гэрлэн зам",
    "Арван хоёрдугаар сарын Мёндонд кру нар кэрол эгшиглэх гэрлийн гудамжинд орж ирлээ. Дэлгүүр бүрийн гялалзах гацуур, хүмүүсийн хөгжилтэй алхаа өвлийн шөнийг гэрэл дулаанаар дүүргэнэ.",
    "Задгай мухлагийн шарсан амтат төмсөө үлээнгээ хальслан идэж, цаасан аяга дахь одэны халуун шөлөөр хөрсөн гараа дулаацуулав. Мёндон сүмийн өмнө эгшиглэх кэролыг сонсонгоо \"한국의 겨울은 손이 따뜻해지는 계절이구나\" (Солонгосын өвөл гэдэг гар дулаацдаг улирал юм байна) гэж инээмсэглэв.",
    "Яг тэр агшин гудамжны гацуурын гэрлүүд зэрэг анивчиж, талбайн буланд овоорсон цас маршмеллоу мэт хөөж дугтран өндийв.",
  ],
];

// 감정 표현 배지 8종 — STORY_EMOTIONS(L4450) 1:1: [관용구(한국어 유지 — 학습 대상), 뜻(몽골어)]
const MN_STORY_EMOTIONS = [
  ["설레다","хүлээлтээр зүрх догдлох"],
  ["심장이 쿵 내려앉다","гэнэтийн явдалд зүрх түг хийтэл цочих"],
  ["입술을 깨물다","сэтгэлийн хөдөлгөөнөө дарж, шийдвэрээ хатуу барих"],
  ["소름이 돋다","гайхшрал, сэтгэл хөдлөлөөс бие жирвэгнэх"],
  ["가슴이 벅차오르다","Баяр хөөр, сэтгэл хөдлөлөөр дүүрэх"],
  ["목이 메다","Сэтгэл хөдөлсөндөө үг хэлж чадахгүй болох"],
  ["어깨가 으쓱해지다","Бахархах сэтгэл төрөх"],
  ["속이 후련하다","Санаа зовсон зүйл шийдэгдэж, сэтгэл онгойх"],
  ["눈이 반짝이다","хүлээлт, сониуч сэтгэлээр гялалзах"],
  ["숨이 턱 막히다","гайхшрал, догдлолоос амьсгаа давхцах мэт болох"],
  ["주먹을 불끈 쥐다","шийдвэр, зоригоо бататгах"],
  ["손에 땀을 쥐다","догдлон сэтгэлээ чангалж хүлээх"],
  ["가슴이 뭉클하다","сэтгэл хөдлөл намуухан ундрах"],
  ["눈시울이 붉어지다","сэтгэл хөдөлснөөс нүдний хаяа халуу оргих"],
  ["가슴을 펴다","цээж тэнийж, бахархалтай болох"],
  ["가슴을 쓸어내리다","тайвширч сэтгэл амрах"],
];

// 숙제·퀴즈 부속 필드 — C열(카테고리)·E열(검사포인트)의 몽골어. G열 1칸에 담지 않아 별도 보존
const MN_HOMEWORK_CATEGORY = {
  "어휘": "Үгийн сан",
  "문법·문장": "Дүрэм·өгүүлбэр",
  "말하기": "Ярих",
  "쓰기": "Бичих",
  "복습": "Давталт",
  "K-컬처": "K-соёл",
  "리셋": "Ресет",
};
const MN_QUIZ_CATEGORY = {
  "조사": "Нөхцөл",
  "어휘": "Үгийн сан",
  "문법": "Дүрэм",
  "맞춤법": "Зөв бичих дүрэм",
  "발음": "Дуудлага",
  "높임": "Хүндэтгэлийн үг",
  "표현": "Хэллэг",
  "상식": "Ерөнхий мэдлэг",
  "TOPIK필수": "TOPIK заавал мэдэх",
  "TOPIK중급": "TOPIK дунд түвшин",
};
const MN_HOMEWORK_CHECKPOINT = {
  "HW101": "Нөхцөл (이/가·을/를) зөв эсэхийг шалгах",
  "HW102": "Эх бичвэрээс олсон хос мөн эсэх + эв дүйтэй эсэх",
  "HW103": "Утгыг нь өөрийн үгээр тайлбарлаж үзэх",
  "HW104": "Сурах бичгээс олсон жишээ + өөрийн 1 өгүүлбэр",
  "HW105": "받침-ийн дуудлагыг шалгах",
  "HW106": "Гарчиг ба үндэслэл нь таарч байгаа эсэх",
  "HW107": "Үнэхээр байдаг үг эсэх",
  "HW108": "Зөвхөн зургаа хараад үгээ хэлж үзэх",
  "HW109": "Хэд дэх удаагаас амар болсныг тэмдэглэсэн эсэх + дуудлагын шалгалт",
  "HW110": "Ангиллын үндэслэл логиктой эсэх",
  "HW111": "Бодитоор олсноо хуваалцах",
  "HW112": "Юу зардаг бичвэр болохыг хэлж үзэх",
  "HW113": "Үнэхээр өөрийнх нь тухай эсэх",
  "HW114": "Зааж буй зүйлийг зөв олсон эсэх",
  "HW115": "Хаанаас олсноо ярьж үзэх",
  "HW116": "Од тавьсан үг + дуудлагын шалгалт",
  "HW117": "Зургаа харж үгээ хэлэх",
  "HW118": "Эсрэг үгийг зөв сонгосон эсэх",
  "HW119": "Заасан туршлагаа хуваалцах",
  "HW120": "Хариултын үндэслэл болох өгүүлбэрийг олох",
  "HW121": "Үсгийн дараалал + зарцуулсан хугацаа",
  "HW122": "Үгийг оновчтой хэрэглэсэн эсэх",
  "HW123": "Дуудлагын нарийн ялгааг шалгах",
  "HW124": "Үгийн аймаг + үйл үгтэй 1 өгүүлбэр",
  "HW125": "Яриа эв дүйтэй эсэх",
  "HW126": "Хэрхэн таамагласнаа ярьж үзэх",
  "HW127": "Эможи хараад үгийг нь сэргээж хэлэх",
  "HW128": "Картаар шууд шалгаж үзэх",
  "HW129": "Өмнөх үгсээ давтаж хэрэглэж байгаа эсэх",
  "HW130": "Шалтгаан заасан хэллэг (-아/어서)",
  "HW201": "Хэлбэр зөв эсэх + өөрийнх нь тухай эсэх",
  "HW202": "Асуултын аялгаар унших",
  "HW203": "았/었 хэлбэрийн хэрэглээ",
  "HW204": "(으)ㄹ 거예요",
  "HW205": "안 / -지 않다-г зөв байранд тавьсан эсэх",
  "HW206": "Уншиж дуусаад эх бичвэртэй тулгах",
  "HW207": "조사 олох + шинэ 1 өгүүлбэр",
  "HW208": "Хүнийг дуудах үг (호칭) зөв эсэх",
  "HW209": "Дарааллын үндэслэлээ (эхлээд · дараа нь) хэлж үзэх",
  "HW210": "Цаг заасан үгийн байрлал",
  "HW211": "(으)세요 / -읍시다",
  "HW212": "Учир шалтгааны холбоо зөв эсэх",
  "HW213": "«Хэрэв...» гэсэн утга гарч байгаа эсэх",
  "HW214": "Оноосон нэрийн бичилт зөв эсэх",
  "HW215": "-(으)세요 / 께서",
  "HW216": "Төгсгөлийн нөхцөлийн хувиргалт",
  "HW217": "Өөрөө тайлбарлаж чадаж байгаа эсэх (гүн ойлголт)",
  "HW218": "Үгийн дарааллын мэдрэмж",
  "HW219": "Өмнөх, дараах хэсэг үнэхээр эсрэгцэж байгаа эсэх",
  "HW220": "Үргэлжилж буй цагийн хэлбэр",
  "HW221": "Хариулт нь эх бичвэрт байгаа эсэх",
  "HW222": "Чадварын илэрхийлэл",
  "HW223": "Түгдрэлгүй уншиж чадаж байгаа эсэх",
  "HW224": "Эелдэг өнгө аяс гарч байгаа эсэх",
  "HW225": "Харьцуулж буй зүйл + 조사 зөв эсэх",
  "HW226": "Сольвол утга яагаад өөр болохыг ярьж үзэх",
  "HW227": "Өргөжүүлэх чадвар",
  "HW228": "Хуваасан цэг нь зөв эсэх",
  "HW229": "Холбож буй логик зөв эсэх",
  "HW230": "Өгүүлбэрийг мэдэрч байгаа эсэх",
  "HW301": "Хамгийн сайн болсон 1 өгүүлбэрээ санаж ирэх",
  "HW302": "Тэмдэглэсэн дуудлагаа хичээл дээр хамт засна",
  "HW303": "Бодитоор хэрэглэсэн туршлагаа хуваалцах",
  "HW304": "Дүр тус бүрийн аялгууны ялгаа",
  "HW305": "연음 (холбож дуудах) шалгах",
  "HW306": "Хэдэн удаа түр зогссоныг тэмдэглэнэ",
  "HW307": "Гол өгүүлбэрүүдийг санаж байгаа эсэх",
  "HW308": "Тоо унших чадвар",
  "HW309": "Хийсэн эсэхээ өөрөө тэмдэглэх",
  "HW310": "Утасны ярианы өнгө аяс",
  "HW311": "Үнэ асуух хэллэг",
  "HW312": "어디·어떻게",
  "HW313": "Сэтгэл хөдлөлийн үгс",
  "HW314": "Хурдан уншихдаа ч зөв дуудаж байгаа эсэх",
  "HW315": "받침-г тод дуудах",
  "HW316": "Дуу хоолойгоо тохируулах",
  "HW317": "Асууж-хариулах бүтэц",
  "HW318": "Заах үг (이·그·저)",
  "HW319": "Чөлөөтэй, тайван ярих",
  "HW320": "Хурдыг нь дагаж амжих",
  "HW321": "5 дахь удаад хэр чөлөөтэй хэлснийг шалгах",
  "HW322": "연음 дүрэм (холбож дуудах дүрэм)",
  "HW323": "Шинэ мэдээлэл орсон эсэх",
  "HW324": "-아/어서",
  "HW325": "Ирээдүй цагийн хэллэг",
  "HW326": "Өнгөрсөн цаг + сэтгэл хөдлөл",
  "HW327": "-고 있다",
  "HW328": "Магтаалын үгс",
  "HW329": "Нэр + 조사",
  "HW330": "Уран уншлагын байдал",
  "HW401": "Загвараа ашигласан эсэх + засвар 1~2-хон байхад хангалттай",
  "HW402": "Шалтгаан заасан хэллэг ашиглах",
  "HW403": "Гол санааг олох",
  "HW404": "높임/반말 зөв сонгосон эсэх",
  "HW405": "Байрлал заасан хэллэг",
  "HW406": "Яагаад ийм дасгал зохиосноо тайлбарлах",
  "HW407": "Ярианы хэлний төгсгөл (어미)",
  "HW408": "Цагийг зөв бичих",
  "HW409": "Тоо ширхэг заах үг",
  "HW410": "Ирээдүй цагийн хэллэг",
  "HW411": "-아/어서",
  "HW412": "Цаг агаарын үгс",
  "HW413": "먼저·그다음·마지막",
  "HW414": "Талархал илэрхийлэх хэллэг",
  "HW415": "Уучлалт гуйх хэллэг",
  "HW416": "Урих илэрхийлэл",
  "HW417": "Сонирхол татах илэрхийлэл",
  "HW418": "Богино өгүүлбэрийн мэдрэмж",
  "HW419": "Хэрэглээ",
  "HW420": "Асуух өгүүлбэр",
  "HW421": "-(으)려고 하다",
  "HW422": "있다/없다",
  "HW423": "Өнгөрсөн цагаар өгүүлэх",
  "HW424": "-고 싶다",
  "HW425": "Захидлын хэлбэр",
  "HW426": "Зөв бичсэн тоогоо тэмдэглэх",
  "HW427": "Үгийн дараалал хувиргах",
  "HW428": "Дүгнэх мэдрэмж",
  "HW429": "Ярианы бөмбөлгийн мэдрэмж",
  "HW430": "Бие даан сайжруулах",
  "HW501": "Сонгосон 3 үг + од тавьсан өгүүлбэр",
  "HW502": "Ойлголтоо шалгах (тайлбарлангаа сурах)",
  "HW503": "Жинхэнэ яриа мөн эсэх",
  "HW504": "Сайжруулсан хэсгээ тайлбарлах",
  "HW505": "Зөв бичсэн тоогоо тэмдэглэх",
  "HW506": "Учрыг нь олох",
  "HW507": "Хэдэн газар зөрснийг тоолох",
  "HW508": "Хуримтлуулан цээжлэх",
  "HW509": "Өөрийн үнэлгээ",
  "HW510": "Ойлголтуудыг холбох",
  "HW511": "Сонссон нь дууны үгтэй таарсан эсэх",
  "HW512": "Хэдийг нь шууд хэлж чадсаныг тоолох",
  "HW513": "Асуултын тодорхой байдал",
  "HW514": "Асуултын зорилго",
  "HW515": "Ангилах чадвар",
  "HW516": "Бичсэн мөр нь бичлэгийн агуулгатай таарч байгаа эсэх",
  "HW517": "Өөрийгөө таньж мэдэх",
  "HW518": "Урьдчилан бэлдэх зуршил",
  "HW519": "Сонгосон асуулт + зөв өгүүлбэр",
  "HW520": "Өөртөө өгөх зөвлөгөө",
  "HW521": "Хөнгөн сэргээн санах дасгал",
  "HW522": "Од тавьсан өгүүлбэрээ хичээл дээр хэлж үзэх",
  "HW523": "Зөв таасан эсэх + ямар дуу чимээ сануулга болсныг ярих",
  "HW524": "Бусдад заах нь өөрөө гүнзгий сурах арга",
  "HW525": "Чөлөөтэй унших чадвар",
  "HW526": "Нөхцөл ялгаж таних",
  "HW527": "Бодит хэрэглээгээ мэдрэх",
  "HW528": "Дадлаа өөрөө төлөвлөх",
  "HW529": "Сурснаа нэгтгэн ашиглах",
  "HW530": "Эргэцүүлэн бодох",
  "HW601": "Хэллэгийн утгыг хамт шалгах",
  "HW602": "Өдөр тутмын амьдралаас таних",
  "HW603": "Дараалал, дэс тооны илэрхийлэл",
  "HW604": "Сонссоноо зөв бичих",
  "HW605": "Сэтгэл хөдлөлийн үгс",
  "HW606": "Ярианы хэллэг",
  "HW607": "Газрын нэрийн дуудлага",
  "HW608": "Амтны үгс",
  "HW609": "Агуулгаас нь таамаглах",
  "HW610": "Гадаад үгийг хангылаар бичих",
  "HW611": "Хүндэтгэл хэрэглэх нөхцөлийг таних",
  "HW612": "Соёлын мэдлэг",
  "HW613": "Хэмнэл, аялга",
  "HW614": "Шинэ үг хэллэг",
  "HW615": "Гарчиг унших",
  "HW616": "Салбарын үгс",
  "HW617": "Тоо + нэгж",
  "HW618": "Сонсох дасгалаа хөнгөн эхлүүлэх",
  "HW619": "Мэдрэхүйн үгс",
  "HW620": "Харьцуулсан өгүүлбэр",
  "HW621": "Соёлын ерөнхий мэдлэг",
  "HW622": "Нийлмэл үг унших",
  "HW623": "Сурталчилгааны хэллэг унших",
  "HW624": "Соёлын ёс заншил",
  "HW625": "Дижитал хэллэг",
  "HW626": "Хоббины үгс",
  "HW627": "Зурган дээрх солонгос бичгээ унших",
  "HW628": "Сэтгэгдлээ илэрхийлэх",
  "HW629": "Улирлын үгс",
  "HW630": "Сэтгэл хөдлөлийн үг",
  "HW701": "Дараагийн хичээлийн яриа эхлүүлэх",
  "HW702": "-고 싶다",
  "HW703": "Бүгдийг чангаар уншсаны тэмдэглэгээ",
  "HW704": "Сурах орчин",
  "HW705": "Тэмдэглэх дадал",
  "HW706": "Талархал илэрхийлэх",
  "HW707": "Суурь мэдлэгээ сэргээх",
  "HW708": "Тоо тоолох",
  "HW709": "Өдөр тутмын үгс",
  "HW710": "Өөртэйгөө эерэг ярих",
  "HW711": "Хуулж бичих",
  "HW712": "Хангыль бичих",
  "HW713": "Ирээдүйн тухай хэллэг",
  "HW714": "Сонирхлоо тэмдэглэх",
  "HW715": "Амжилтын мэдрэмж",
  "HW716": "Сэтгэл хөдлөлийн үг",
  "HW717": "Асуулт бэлдэх",
  "HW718": "Гэр бүлийн оролцоо",
  "HW719": "Өдөр тутмаа дүрслэх",
  "HW720": "Өнгөрснөө эргэн харах",
  "HW721": "Зорилго тавих",
  "HW722": "Апп ашиглах",
  "HW723": "Хавтсан дээрх солонгос нэр + зорилгын үг",
  "HW724": "Эд зүйлсийн үгс",
  "HW725": "Гэр бүлтэй холбох",
  "HW726": "Мэндчилгээ хэрэглэх",
  "HW727": "Орчноо солонгосжуулах",
  "HW728": "Хөгжилтэй хэллэг",
  "HW729": "Шууд санаж хэлэх",
  "HW730": "Товч илэрхийлэх",
};

/* ===================== [v5.2] 학부모 화면 라벨 (한·몽·영 직접 큐레이션) =====================
 * type='label' → Glide에서 화면 라벨을 데이터로 바인딩할 때 사용 (C=키, D=한국어, G=몽골어, H=영어) — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md)
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
    ['L14','label','몬스터','내 캐릭터','','','Миний хамтрагч','My character'],
    ['L15','label','언어','언어','','','Хэл','Language']
  ]);
  replaceContentType(ss, 'reason', [
    ['R01','reason','숙제완료','숙제 완료','','','Гэрийн даалгавраа хийсэн','Homework done'],
    ['R02','reason','오늘의 도전','그날 처음 해본 도전(첫 발표·먼저 손 들기) — 기준을 채우면 전원','','','Өнөөдрийн сорилт','Challenge of the day'],
    ['R03','reason','칭찬','칭찬','','','Магтаал','Praise'],
    ['R06','reason','오늘의 성장','어제의 나를 넘은 성장(전에 틀린 것을 오늘 맞힘) — 기준을 채우면 전원','','','Өнөөдрийн өсөлт','Growth of the day'],
    ['R07','reason','리그승리','반 대항 주간 리그 승리','','','Долоо хоногийн ангийн лигийн ялалт','Weekly class league win'],
    ['R08','reason','월드레이드','전교 월드 레이드 승리','','','Бүх сургуулийн ертөнцийн рейдийн ялалт','World raid victory'],
    ['R04','reason','생일','생일 축하','','','Төрсөн өдрийн мэнд','Birthday'],
    ['R05','reason','레이드보상','클래스 레이드 성공','','','Ангийн рейд амжилт','Class raid success'],
    ['R09','reason','오늘의다짐','스스로 오늘의 목표를 다짐','','','Өнөөдрийн зорилгоо өөрөө тодорхойлсон','Self-set daily goal'] // [v9.28] 학생 셀프 미션
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
    ['CM09','cheermail','퇴근','오늘의 피로만큼 누군가가 자랐습니다. 감사합니다.','',9],
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
  // 레이드 연료 미션 — 이름이 Glide 폼 Choice와 정확히 일치해야 함 (raidFriday가 이름→P 매핑) — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md)
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
    ['BOSS06','boss','초원의 유혹 늑대 🐺','나가서 놀자… 초원이 부른다…|공부 끝의 초원이 두 배로 달콤하다는 걸 늑대도 알았다!','',6],
    ['BOSS07','boss','방학 망각 크라켄 🐙','방학 동안 배운 걸 전부 삼켜주마…|매일의 복습 작살이 크라켄을 꿰뚫었다!','',7],
    ['BOSS08','boss','미루기 해골 💀','나중에 해… 내일 해도 돼…|지금 하는 자들 앞에서 미루기는 힘을 잃었다!','',8],
    ['BOSS09','boss','가을 졸음 요괴 😴','스르르… 눈꺼풀이 무겁지…|또렷한 목소리의 발표가 요괴를 쫓아냈다!','',9],
    ['BOSS10','boss','시험 불안 그림자 👤','틀리면 어떡하지… 라는 속삭임…|준비된 자의 자신감이 그림자를 지웠다!','',10],
    ['BOSS11','boss','혹한의 예티 ❄️','영하 30도… 학원은 무리야…|출석 도장의 온기가 예티를 녹였다!','',11],
    ['BOSS12','boss','산만함 팬텀 👻','연말인데… 잠깐 저것 좀 보고 하자…|집중의 빛 앞에서 유령은 흩어졌다!','',12]
  ]);
}

function setupTitleLore() {
  // 칭호 로어 — C열이 대표칭호(AH) 문자열과 정확히 일치 → Glide Relation·Lookup으로 표시 — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // [v6.1] E열 = 등급 라벨 — 착용 칭호의 등급 Pill과 로어를 Relation 하나로 표시
  replaceContentType(ss, 'lore', [
    /* [08-27 유호 지시] 상장 문구 열한 벌 → 넷. 「비교하는거 최대한 없애자 · 일반적으로 과제 점수로
     *   분류하는 랭킹 시스템은 전부 삭제해줘」. 이 줄들은 «학생 상장에 인쇄되어 나가는» 문구다.
     * 걷어낸 일곱은 전부 1등 시상이었다 — 시냅스 챔피언(전교 1위) · 로켓 성장(성장률 1등) ·
     *   다크호스(「랭킹이 너를 따라잡지 못했다」) · 우리 반 캐리(반 1등) · 숙제왕 · 정성왕(「횟수 1위」) ·
     *   이달의 스타. 🔑 이달의 스타는 문구만 08-20 에 「기준을 채우면 누구든」으로 갈고 «부여 로직은
     *   여전히 최다 1등»이었다 — 문구와 기계가 어긋나 있었다(08-27 실측).
     * 등급 칸(E열)도 비웠다 — 레전드·에픽·레어·일반은 서열이고 게임 가챠 낱말이다. */
    ['LR01','lore','🌟 하루도 안 빠진 달','미엘린은 반복을 사랑한다 — 매일 온 너를, 뇌가 기억한다.','',''],
    ['LR04','lore','🤝 레이드 개근','혼자면 빨리 가지만, 함께면 멀리 간다.','',''],
    ['LR06','lore','🔥 불꽃 출석러','끊기지 않은 신호는, 결국 회로가 된다.','',''],
    ['LR11','lore','⏰ 지각 제로','시작을 지키는 사람이 끝도 지킨다.','','']
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
    ['QZ22','quiz','높임','선생님께 「밥 먹었어?」 대신 뭐라고 할까요?|식사하셨어요?',''], // [v9.87] 따옴표 없는 축약이 문장 붕괴(07-31 유호 실측) — 몽골어판(«밥 먹었어?» 완전문)과 동급으로
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

/* ===================== [v6.0] 오늘의 숙제 뱅크 (210개 · 요일당 30 · 30주 무반복) =====================
 * F열 = 요일코드×100 + 순번 (월1 화2 수3 목4 금5 토6 일7)
 * [v6.0 · 2026-08-31 · 유호 확정 「숙제를 듣기·읽기·쓰기 위주로」] 월·화·금 41문항 개작(월18·화11·금12).
 *    까닭: TOPIK I = 듣기100+읽기100 이 전부, II 도 그 둘+쓰기인데 요일 갈래에 듣기·읽기가 0 이었다.
 *    월 어휘·화 문법 = «읽는 실물»(오늘 읽은 글·간판·포장·사전·폰 화면)에 닻 — 지문은 박아 넣지 않는다
 *    (뱅크는 레벨·차시 무관이라 고정 지문은 레벨을 못 타고, 수업에서 읽은 글은 학생 레벨을 저절로 탄다).
 *    금 복습 = «귀»(내 녹음 받아쓰기·노래·영상·가족이 불러 주기). 수 말하기(발음 3축 HW306·311·318)·목 쓰기는 그대로.
 *    빌린 시험 유형: 제목 붙이기(주제)·O/X(내용일치)·조사 가리고 채우기(빈칸)·문장 섞기(순서)·
 *    이·그·저 화살표(지시어)·간판·메뉴(실용문)·소리만 듣고 장소 맞히기(듣기 담화) — ⚠철학 v1.2: 급수
 *    직결 «강조»는 숙제 카피에 안 얹는다. 유형만 빌리고 얼굴은 실사용·재미(별표·퍼즐·출제자 되기·내 목소리).
 *    개작 41건의 몽골어(내용 41·검사포인트 19)는 AI 번역 — 원어민 검수 대상(v9.225·v9.227 과 같은 지위).
 * 월~금 = 평일반(오늘의숙제*), 토·일 = 주말반(주말의숙제*) — calcAll이 저녁 21시 이후 자동 게시.
 * 강사는 검사 포인트(E열)만 보고 5분 체크 → 숙제완료 버튼 +10P.
 * ⚠️ E열은 v9.70부터 학생 화면 「숙제팁」으로도 나간다(초급은 MN 병기) — 강사 전용 사역문("~시키기")을 쓰면
 *    학생이 그 문장을 그대로 읽는다. 학생·강사 둘 다 읽어도 서는 문장으로만 쓴다.
 * ⚠️ D·E를 고치면 MN_CONTENTS_G·MN_HOMEWORK_CHECKPOINT 의 같은 ID 값을 **같은 커밋**에서 갱신한다(안 하면
 *    초급 병기가 딴말이 된다). [v9.225] 품질 패스 24문항(D 13·E 17) — 몽골어는 AI 번역, 원어민 검수 대상.
 *    [v9.227] 적대 리뷰 수리 P1 4+P2 — HW109·115·116·207·321·410·501·519·703·723 (몽골어 신규분도 AI 번역,
 *    원어민 검수 대상). 기계 불변식은 tests/숙제뱅크.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다) 가 지켰다(고아·의문문만 — 짝 «내용» 대조는 원래도 손) — 그것도 걷혀 지금은 전부 손이다.
 * ⚠️ 재실행 순서 = setupHomework → injectMongolianContents(큐레이션 복원) → translateContents(빈칸만).
 *    inject 를 빼면 210행 큐레이션 몽골어가 기계 번역으로 덮인다 — replaceContentType 이 G·H 를 밀고,
 *    translateContents 는 복원기가 아니다(정본 순서 = MN_CONTENTS_G 머리 주석·엔진_셋업확장.js).
 *    clasp push 와 setupHomework 는 같은 작업 창에서(코드 MN 새 판 + 시트 KO 옛 판 = 한·몽 딴말 카드).
 * ⚠️ 재실행 시 contents 행 +174 → 일회성 싱크 ~210 업데이트 (한가한 날 실행 권장) */

function setupHomework() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  replaceContentType(ss, 'homework', [
    ['HW101','homework','어휘','오늘 배운 글을 소리 내어 1번 읽고 새 단어 3개에 별표 — 각 단어로 한 문장씩 만들어 오세요.','조사(이/가·을/를) 확인',101],
    ['HW102','homework','어휘','오늘 읽은 글에서 짝이 되는 말 2쌍을 찾아 적어 오세요(예: 사진을 찍다).','지문에서 찾은 쌍인지 + 자연스러운지',102],
    ['HW103','homework','어휘','새 단어 3개의 반대말이나 비슷한 말을 사전에서 찾고, 마음에 드는 사전 예문 1개를 베껴 쓰세요.','뜻을 내 말로 설명해 보기',103],
    ['HW104','homework','어휘','오늘 배운 단어 5개로 미니 단어장 만들기 — 예문은 글에서 찾아 베끼고 1개만 내 문장으로.','글에서 찾은 예문 + 내 문장 1개',104],
    ['HW105','homework','어휘','집에 있는 한국 제품 포장·라벨에서 한국어 5개를 읽고 적어 오세요(없으면 물건 이름 5개).','받침 발음 확인',105],
    ['HW106','homework','어휘','오늘 읽은 글에 새 제목을 붙이고, 근거가 된 단어 2개에 밑줄.','제목과 근거가 어울리는지',106],
    ['HW107','homework','어휘','오늘 배운 단어 하나로 시작하는 끝말잇기 5개 이어 오기.','실제 있는 단어인지',107],
    ['HW108','homework','어휘','오늘 읽은 글의 그림·사진 1개에 어울리는 단어 3개를 지문에서 찾아 적어 오세요.','그림만 보고 단어 말해 보기',108],
    ['HW109','homework','어휘','제일 어려운 단어 1개를 10번 소리 내어 읽기 — 몇 번째부터 편해지는지 체크.','몇 번째부터 편해졌는지 체크 + 발음 확인',109],
    ['HW110','homework','어휘','오늘 배운 단어 4개를 두 그룹으로 나누고 기준 말하기.','분류 기준의 논리',110],
    ['HW111','homework','어휘','오늘 배운 단어 중 하나를 간판·포장에서 찾아 메모.','실물 발견 공유',111],
    ['HW112','homework','어휘','광고지·메뉴판·앱 화면에서 아는 한국어 단어 3개에 동그라미(사진 OK) — 무엇을 파는지 한 단어로.','무엇을 파는 글인지 말해 보기',112],
    ['HW113','homework','어휘','오늘 읽은 글의 문장 1개를 골라 나에 관한 문장으로 바꿔 쓰기.','진짜 자기 얘기인지',113],
    ['HW114','homework','어휘','오늘 읽은 글에서 이·그·저(또는 여기·거기)를 찾아 동그라미 — 무엇을 가리키는지 화살표로 잇기.','가리키는 것을 맞게 찾았는지',114],
    ['HW115','homework','어휘','폰의 한국어 화면(유튜브·게임·앱 등)에서 한국어 단어 3개를 찾아 적어 오세요.','어디서 찾았는지 말해 보기',115],
    ['HW116','homework','어휘','오늘 배운 단어 3개를 큰 소리로 3번씩 읽고, 제일 자신 있는 단어에 별표.','별표 단어 + 발음 확인',116],
    ['HW117','homework','어휘','오늘 배운 단어 3개에 해당하는 실물 사진 찍어 오기.','사진 보며 단어 말하기',117],
    ['HW118','homework','어휘','오늘 읽은 글에서 문장 2개를 골라 반대말로 뒤집어 보세요.','반의어 정확성',118],
    ['HW119','homework','어휘','가족에게 오늘 배운 단어 3개를 가르쳐 주고 반응 메모.','가르친 경험 공유',119],
    ['HW120','homework','어휘','오늘 읽은 글 내용으로 맞으면 O 틀리면 X 문제 2개 만들기 — 수업에서 친구가 풉니다.','답의 근거 문장 찾기',120],
    ['HW121','homework','어휘','오늘 배운 단어 5개를 가나다순으로 정렬하기 — 시간을 재서 나의 기록 남기기.','자모 순서 + 걸린 시간',121],
    ['HW122','homework','어휘','오늘 배운 단어 1개로 나의 하루를 한 줄 요약.','단어 활용 적절성',122],
    ['HW123','homework','어휘','발음이 비슷한 단어 한 쌍(달/딸 같은)을 사전이나 오늘 읽은 글에서 찾아 차이 메모.','최소대립쌍 확인',123],
    ['HW124','homework','어휘','오늘 읽은 글에서 명사 3개·동사 2개를 찾아 표시 — 동사 1개로 문장 1개 만들기.','품사 나누기 + 동사 문장 1개',124],
    ['HW125','homework','어휘','오늘 배운 단어 3개로 두 줄 대화 만들기.','대화 자연스러움',125],
    ['HW126','homework','어휘','아직 안 배운 글에서 모르는 단어 1개 — 뜻을 문맥으로 먼저 추측해 쓰고 사전으로 확인.','어떻게 추측했는지 말해 보기',126],
    ['HW127','homework','어휘','오늘 배운 단어 5개를 이모지로 표현해 오기.','이모지 보고 단어 복원',127],
    ['HW128','homework','어휘','단어 카드 5장 만들기(앞 단어/뒤 뜻) — 뒤에는 오늘 배운 문장을 그대로 베껴 쓰기.','카드로 즉석 테스트',128],
    ['HW129','homework','어휘','지난주 단어 3개 + 오늘 배운 단어 3개로 문장 2개.','누적 복습 여부',129],
    ['HW130','homework','어휘','오늘 읽은 문장 중 최애 1개를 베껴 쓰고 별점 + 이유 한 문장.','이유 표현(-아/어서)',130],
    ['HW201','homework','문법·문장','오늘 배운 문법으로 나에 대한 문장 3개 쓰기.','형태 정확성 + 자기 얘기',201],
    ['HW202','homework','문법·문장','오늘 읽은 글에서 오늘 배운 문법이 든 문장 2개를 찾아 밑줄 — 1개를 질문으로 바꿔 내일 친구에게 묻기.','질문 억양으로 읽기',202],
    ['HW203','homework','문법·문장','어제 한 일을 3문장으로 쓰기(과거형).','았/었 활용',203],
    ['HW204','homework','문법·문장','내일 할 일을 3문장으로 쓰기(계획 표현).','(으)ㄹ 거예요',204],
    ['HW205','homework','문법·문장','오늘 배운 문장 2개를 부정문으로 바꾸기.','안 / -지 않다 위치',205],
    ['HW206','homework','문법·문장','오늘 읽은 글 한 문단을 읽으며 조사만 손가락으로 가리고 스스로 채워 보기 — 몇 개 맞았는지 기록.','다 읽고 원문과 대조',206],
    ['HW207','homework','문법·문장','오늘 배운 문장 2개에서 조사를 찾아 동그라미 — 찾은 조사 중 1개로 새 문장 1개.','조사 찾기 + 새 문장 1개',207],
    ['HW208','homework','문법·문장','오늘 배운 문법으로 가족 소개 2문장.','호칭 정확성',208],
    ['HW209','homework','문법·문장','오늘 읽은 글 한 문단의 문장 3개를 종이에 한 문장씩 쓰고 순서를 섞기 — 내일 친구가 순서를 복원합니다.','순서의 근거(먼저·그다음) 말하기',209],
    ['HW210','homework','문법·문장','오늘 배운 문법 + 시간 표현(아침·어제 등) 문장 2개.','시간 부사 위치',210],
    ['HW211','homework','문법·문장','오늘 배운 문장을 명령문과 청유문으로 바꾸기.','(으)세요 / -읍시다',211],
    ['HW212','homework','문법·문장','이유 표현(-아/어서) 문장 2개 만들기 — 오늘 읽은 글에서 이유가 든 문장 1개를 찾아 베끼기.','인과 연결',212],
    ['HW213','homework','문법·문장','조건 표현(-으면)으로 문장 2개.','가정 의미',213],
    ['HW214','homework','문법·문장','오늘 배운 문법으로 몽골을 소개하는 문장 1개.','고유명사 표기',214],
    ['HW215','homework','문법·문장','오늘 읽은 글에서 반말 문장 2개를 찾아 높임말로 바꾸기.','-(으)세요 / 께서',215],
    ['HW216','homework','문법·문장','반말 2문장을 존댓말로, 존댓말 2문장을 반말로.','종결어미 전환',216],
    ['HW217','homework','문법·문장','오늘 배운 문법의 규칙을 내 말로 한 줄 정리 + 오늘 배운 예문 1개 베끼기.','메타 이해',217],
    ['HW218','homework','문법·문장','오늘 배운 문장 하나를 단어 순서 섞었다가 복원하기.','어순 감각',218],
    ['HW219','homework','문법·문장','대조 표현(-지만) 문장 2개 — 1개는 오늘 읽은 글에서 하지만·-지만이 든 문장을 찾아 베끼기.','앞뒤 대조 성립',219],
    ['HW220','homework','문법·문장','지금 하고 있는 일 3개 쓰기(-고 있다).','진행형',220],
    ['HW221','homework','문법·문장','오늘 읽은 글 내용으로 누가·언제·어디 질문 각 1개 만들기 — 답이 지문 안에 있어야 합니다.','답이 지문에 있는지',221],
    ['HW222','homework','문법·문장','할 수 있는 것 3개 쓰기(-(으)ㄹ 수 있다).','능력 표현',222],
    ['HW223','homework','문법·문장','오늘 배운 문법 예문 1개를 3번 소리 내어 읽기.','막힘 없이 읽을 수 있는지',223],
    ['HW224','homework','문법·문장','부탁 표현(-아/어 주세요) 문장 2개.','공손한 어감',224],
    ['HW225','homework','문법·문장','비교 표현(-보다) 문장 2개.','비교 대상 + 조사',225],
    ['HW226','homework','문법·문장','오늘 읽은 글에서 그리고·그래서·하지만을 찾아 동그라미 — 하나를 다른 것으로 바꾸면 뜻이 어떻게 변하는지 한 줄.','바꾸면 뜻이 왜 달라지는지 말해 보기',226],
    ['HW227','homework','문법·문장','오늘 읽은 글의 짧은 문장 1개를 정보 3개 담긴 긴 문장으로.','확장 능력',227],
    ['HW228','homework','문법·문장','오늘 읽은 글의 긴 문장 1개를 두 문장으로 나누기.','분리 지점',228],
    ['HW229','homework','문법·문장','그리고·그래서·하지만으로 문장 잇기 각 1개.','접속 논리',229],
    ['HW230','homework','문법·문장','이번 주 최애 예문 1개 베껴 쓰고 별점 + 이유.','문장 감상',230],
    ['HW301','homework','말하기','오늘 배운 표현으로 30초 혼잣말을 폰에 녹음.','제일 잘 나온 문장 1개 기억해 오기',301],
    ['HW302','homework','말하기','거울 보며 대화문 3번 읽고 어려운 발음 1개 메모.','메모한 발음을 수업에서 같이 다듬기',302],
    ['HW303','homework','말하기','가족·친구에게 한국어 인사 + 한 문장, 반응 메모.','실제 사용 경험 공유',303],
    ['HW304','homework','말하기','오늘 배운 대화문을 혼자 두 역할로 바꿔 읽기.','역할별 억양 차이',304],
    ['HW305','homework','말하기','한국 노래 한 소절 따라 말하기(가사 보고 발음만).','연음 확인',305],
    ['HW306','homework','말하기','"오늘 뭐 했어요?"에 20초 멈추지 않고 대답 연습.','멈춤 횟수 체크',306],
    ['HW307','homework','말하기','오늘 배운 대화문을 안 보고 외워 말하기 도전.','핵심 문장 회상',307],
    ['HW308','homework','말하기','오늘 날짜·요일·시간을 소리 내어 3번 말하기.','수 읽기',308],
    ['HW309','homework','말하기','15초 셀프 소개 영상 찍기(제출은 안 해도 됨).','찍었는지 스스로 체크',309],
    ['HW310','homework','말하기','전화 첫인사 3가지(여보세요 등) 연습.','전화 어투',310],
    ['HW311','homework','말하기','가게에서 물건 사는 상황을 혼자 롤플레이.','가격 묻기 표현',311],
    ['HW312','homework','말하기','길 묻는 문장 3개 소리 내어 연습.','어디·어떻게',312],
    ['HW313','homework','말하기','오늘 기분을 문장 3개로 말해 보기.','감정 어휘',313],
    ['HW314','homework','말하기','오늘 읽은 문단을 2배 속도로 읽기 도전.','속도에서도 정확한지',314],
    ['HW315','homework','말하기','같은 문단을 아주 천천히 또박또박 1회.','받침 살리기',315],
    ['HW316','homework','말하기','같은 문장을 작게·보통·크게 3번 말하기.','성량 조절',316],
    ['HW317','homework','말하기','스스로 질문 만들고 스스로 답하기 2세트.','자문자답 구조',317],
    ['HW318','homework','말하기','내 방 물건 5개를 손으로 가리키며 말하기.','지시어(이·그·저)',318],
    ['HW319','homework','말하기','오늘 배운 표현을 인형·반려동물에게 말해 보기.','부담 없는 산출',319],
    ['HW320','homework','말하기','짧은 영상 1분 그림자 스피킹(동시에 따라 말하기).','속도 따라가기',320],
    ['HW321','homework','말하기','발음이 꼬이는 문장 1개를 5번 반복.','다섯 번째에 얼마나 술술 나오는지',321],
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
    ['HW405','homework','쓰기','오늘 본 그림 하나를 3문장으로 묘사.','위치 표현',405],
    ['HW406','homework','쓰기','이번 주 단어로 빈칸 문제 2개 출제 — 친구가 풂.','출제 의도 설명',406],
    ['HW407','homework','쓰기','친구에게 보내는 문자 형식으로 3줄.','구어체 어미',407],
    ['HW408','homework','쓰기','나의 하루 시간표를 한국어로 쓰기.','시간 표기',408],
    ['HW409','homework','쓰기','장보기 목록 5개를 한국어로.','단위 명사',409],
    ['HW410','homework','쓰기','이번 시즌이 끝날 때의 나에게 보내는 2문장.','미래 표현',410],
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
    ['HW425','homework','쓰기','오늘 배운 문형으로 짧은 편지 3줄(받는 사람 자유).','편지 형식',425],
    ['HW426','homework','쓰기','오늘 배운 단어 5개를 가리고 스스로 받아쓰기.','맞은 개수 기록',426],
    ['HW427','homework','쓰기','내가 자주 쓰는 몽골어 문장 2개를 한국어로 바꿔 보기.','어순 전환',427],
    ['HW428','homework','쓰기','오늘 수업에 제목 붙이기 + 이유 한 줄.','요약 감각',428],
    ['HW429','homework','쓰기','그림·만화 한 컷에 어울리는 대사 만들기.','말풍선 감각',429],
    ['HW430','homework','쓰기','지난 목요일에 쓴 글 하나를 더 좋게 고치기.','스스로 교정',430],
    ['HW501','homework','복습','이번 주 단어 중 헷갈리는 3개로 문장 1개씩 만들어 소리 내어 녹음 — 들어 보고 제일 매끄러운 문장에 별표.','고른 단어 3개 + 별표 문장',501],
    ['HW502','homework','복습','이번 주 문법 하나를 몽골어로 설명하는 메모 작성.','개념 이해(설명하며 배우기)',502],
    ['HW503','homework','복습','한국 영상 1분 보고 들리는 단어 3개 적기.','실제 대사인지',503],
    ['HW504','homework','복습','월~목 숙제 중 하나를 더 좋게 업그레이드.','고친 부분 설명',504],
    ['HW505','homework','복습','이번 주 새 단어 10개 받아쓰기 셀프 테스트 — 가족이 불러 주거나, 내 녹음을 들으면서 쓰기.','맞은 개수 기록',505],
    /* [09-04] 「내 연습 노트로」 → 「공책에」. 낱말이 앱의 옛 칸 이름(`연습노트` · 09-04 폐지)과
     *   겹쳐 있었다. 이 숙제가 시키는 것은 «학생이 손으로 쓰는 일»이라 기능 폐지와 무관하지만,
     *   앱에서 그 칸이 사라진 뒤에도 같은 이름을 부르면 학생이 없는 화면을 찾는다. */
    ['HW506','homework','복습','이번 주 헷갈렸던 것 1개를 공책에 정리 — 왜 헷갈렸는지 + 바른 문장.','원인 분석',506],
    ['HW507','homework','복습','수요일에 녹음한 내 목소리를 듣고 받아쓰기 — 원래 문장과 대조해 다른 곳 표시.','다른 곳이 몇 개였는지',507],
    ['HW508','homework','복습','단어 카드 섞어 스스로 테스트 — 뜻을 보고 단어를 소리 내어 말한 뒤 뒤집기, 점수 기록.','누적 암기',508],
    ['HW509','homework','복습','이번 주 숙제 중 최고작 선정 + 이유.','자기 평가',509],
    ['HW510','homework','복습','이번 주 배운 것 마인드맵 한 장 그리기.','개념 연결',510],
    ['HW511','homework','복습','한국 노래 1곡의 후렴을 듣고 들리는 단어 2개 적기 — 가사를 찾아 맞았는지 확인.','들은 것과 가사가 같았는지',511],
    ['HW512','homework','복습','가족·친구가 이번 주 단어 5개를 몽골어로 불러 주면 한국어로 바로 말하기 — 반대로도 한 번.','몇 개나 바로 나왔는지',512],
    ['HW513','homework','복습','선생님께 할 질문 1개 준비해 오기.','질문의 구체성',513],
    ['HW514','homework','복습','짝에게 낼 미니 퀴즈 3문제 만들기 — 1문제는 내가 소리 내어 읽어 주는 듣기 문제로.','출제 의도',514],
    ['HW515','homework','복습','이번 주 단어를 주제별로 분류한 표 만들기.','범주화',515],
    ['HW516','homework','복습','한국 영상 1분을 보고 무슨 이야기인지 한 줄로 쓰기 — 이번 주 배운 단어가 나오면 별표.','한 줄이 영상 내용과 맞는지',516],
    ['HW517','homework','복습','이번 주 나에게 별점 + 이유 한 문장.','메타 인지',517],
    ['HW518','homework','복습','다음 주에 배울 글 훑어보고 궁금한 것 1개 메모.','예습 습관',518],
    ['HW519','homework','복습','이번 주 가장 자주 만난 「다음에 맞힐 문제」 1개를 골라 올바른 문장으로 쓰기.','고른 문제 + 올바른 문장',519],
    ['HW520','homework','복습','수요일 녹음 다시 듣고 좋아진 점 1개 메모.','자기 피드백',520],
    ['HW521','homework','복습','이번 주 단어 5개만 골라 가리고 말해 보기.','가벼운 인출 연습',521],
    ['HW522','homework','복습','이번 주 문장 3개 암송 도전 — 녹음해서 들어 보고 제일 잘된 것 1개에 별표.','별표 문장을 수업에서 말해 보기',522],
    ['HW523','homework','복습','한국 영상 30초를 화면 가리고 소리만 듣기 — 어디인지·몇 명인지 추측하고 화면을 열어 확인.','맞았는지 + 어떤 소리가 힌트였는지',523],
    ['HW524','homework','복습','부모님께 배운 것 1개 설명하기(몽골어 OK).','프로테제 효과',524],
    ['HW525','homework','복습','이번 주에 배운 글을 소리 내어 통독하며 녹음 — 끝나고 아무 데나 10초만 들어 보기.','유창성',525],
    ['HW526','homework','복습','헷갈린 조사 2개 정리(예문 포함).','조사 구분',526],
    ['HW527','homework','복습','이번 주 한국어를 실제로 쓴 순간 1개 기록.','실사용 인식',527],
    ['HW528','homework','복습','나만의 복습 체크리스트 5칸 만들기.','습관 설계',528],
    ['HW529','homework','복습','이번 주 표현으로 짧은 대화 4줄 쓰고 — 혼자 두 사람 목소리로 바꿔 가며 읽어 보기.','종합 산출',529],
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
    ['HW627','homework','K-컬처','한국어가 보이는 사진 1장 찍고, 뭐라고 쓰여 있는지 읽어 오기.','찍은 한국어 읽기',627],
    ['HW628','homework','K-컬처','드라마 명대사 1개 + 좋아하는 이유.','감상 표현',628],
    ['HW629','homework','K-컬처','지금 계절의 한국 음식 1개 조사.','계절 어휘',629],
    ['HW630','homework','K-컬처','주말 K-플레이리스트 1곡 + 느낌 한 단어.','감정 단어',630],
    ['HW701','homework','리셋','이번 주 최애 표현 1개 + 이유 한 문장.','다음 수업 아이스브레이킹',701],
    ['HW702','homework','리셋','다음 주 목표를 한국어 한 문장으로.','-고 싶다',702],
    ['HW703','homework','리셋','지난주 단어장 소리 내어 1번 통독(체크만).','소리 내어 통독 체크 표시',703],
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
    ['HW721','homework','리셋','앱에서 내 포인트 확인 — 이번 주 나의 목표 포인트 정하기.','목표 설정',721],
    ['HW722','homework','리셋','내 캐릭터 확인, 다음 진화까지 몇 P인지 적기.','앱 활용',722],
    ['HW723','homework','리셋','단어장 표지에 내 이름과 목표 한 단어를 한국어로 쓰고 꾸미기.','표지의 한국어 이름 + 목표 단어',723],
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
  const sh = ensureSheet(ss, 'academic_log', ACADEMIC_LOG_HEADERS); // [v9.240] 헤더 정본 공유(엔진_셋업확장)
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

// [v9.20] 📈 실력 성장 카드(HTML) — 급수 + 최근 모의 미니 막대 + 증감. 게임과 실제 실력을 잇는 핵심 카드.
function academicTrendHtml_(logs) {
  logs = logs || [];
  const levels = logs.filter(l => l.type === 'level');
  const mocks = logs.filter(l => l.type === 'mock');
  if (!levels.length && !mocks.length)
    return CARD_WEBFONT + '<div style="' + CARD_FONT + 'background:#F9FAFB;border:2px dashed #E5E7EB;border-radius:14px;padding:12px 13px;font-size:12.5px;color:#6B7280;">📈 한국어 실력 성장 — 첫 평가를 기다리고 있어요 ✨</div>';
  const curLv = levels.length ? levels[levels.length - 1].val : null;
  const series = mocks.slice(-5).map(m => Number(m.val) || 0);
  const curMock = series.length ? series[series.length - 1] : null;
  const prevMock = series.length >= 2 ? series[series.length - 2] : null;
  const delta = (curMock != null && prevMock != null) ? (curMock - prevMock) : null;
  let bars = '';
  series.forEach((sc, i) => {
    const h = Math.max(Math.round((Math.max(0, Math.min(100, sc)) / 100) * 30), 3);
    bars += '<div style="display:inline-block;width:9px;height:' + h + 'px;background:' + (i === series.length - 1 ? '#10B981' : '#CFEDDF') + ';border-radius:2px;margin:0 1.5px;vertical-align:bottom;"></div>';
  });
  const barBox = series.length
    ? '<div style="text-align:center;">' + bars + '<div style="font-size:9px;color:#9CA3AF;padding-top:2px;">최근 ' + series.length + '회 모의</div></div>'
    : '<div style="font-size:11px;color:#9CA3AF;text-align:center;">모의 기록<br>대기 중</div>';
  const deltaTxt = (delta == null) ? '' : (delta > 0 ? '▲ +' + delta : (delta < 0 ? '△ ' + delta : '– 유지'));
  const deltaCol = (delta != null && delta > 0) ? '#0E9F6E' : '#9CA3AF';
  return CARD_WEBFONT + '<div style="' + CARD_FONT + 'background:#F0FDF4;border:2px solid #BBF7D0;border-radius:14px;padding:11px 13px;">' +
    '<div style="font-size:11px;color:#6B7280;">📈 한국어 실력 성장</div>' +
    '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:10px;padding-top:4px;">' +
      '<div><div style="font-size:24px;font-weight:800;color:#0E9F6E;line-height:1;">' + (curLv != null ? curLv + '급' : '—') + '</div><div style="font-size:10px;color:#6B7280;padding-top:2px;">현재 TOPIK 급수</div></div>' +
      '<div style="flex:1;">' + barBox + '</div>' +
      '<div style="text-align:right;"><div style="font-size:20px;font-weight:800;">' + (curMock != null ? curMock : '—') + '<span style="font-size:11px;color:#9CA3AF;">/100</span></div><div style="font-size:11px;font-weight:700;color:' + deltaCol + ';">' + deltaTxt + '</div></div>' +
    '</div></div>';
}

function calcAcademic_(byId, pfData) { // [v9.22] calcAll에서 byId·pfData 재사용(없으면 자체 읽기 — 수동 실행 호환)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return; // 콜드스타트 가드

  byId = byId || readAcademicLogs_(ss, tz);

  // profiles 신규열 BO~BW(67~75) 확장 + 헤더 보장 (기존 66열 계산과 분리)
  if (pf.getMaxColumns() < 75) pf.insertColumnsAfter(pf.getMaxColumns(), 75 - pf.getMaxColumns());
  const heads = ['현재급수','최근모의점수','직전대비Δ','최고모의점수','레벨업누적','마지막평가월','학업한마디_KO','학업한마디_MN','학업추세HTML']; // [v9.20] +학업추세HTML(BW)
  heads.forEach((h, i) => { if (String(pf.getRange(1, 67 + i).getValue()) !== h) pf.getRange(1, 67 + i).setValue(h); });

  const rows = pfData || pf.getRange(2, 1, pf.getLastRow() - 1, 15).getValues(); // [v9.22] id(0)·role(3) 재사용
  const out = rows.map(r => {
    const sid = r[0];
    if (!sid || r[3] !== 'student') return ['', '', '', '', '', '', '', '', ''];
    const snap = academicSnapshot_(byId[sid]);
    // [v9.20] 기록 없어도 BW(학업추세HTML)는 "첫 평가 대기" 카드로 항상 채움 (홈 카드 자리 안 비게)
    if (!snap) return ['', '', '', '', '', '', '', '', academicTrendHtml_(byId[sid])];
    return [snap.curLevel, snap.curMock, snap.delta, snap.bestMock, snap.levelUps, snap.lastMonth, snap.ko, snap.mn, academicTrendHtml_(byId[sid])];
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
 * contents의 monster/boss/worldboss/store 행 중 이미지URL(E열)이 "빈 행만" placehold.co URL로 채움.
 * 이미 URL이 있는 행은 절대 덮어쓰지 않음(진짜 이미지 보존). 진짜 이미지가 오면 그 행은 자동 스킵.
 * 임시 부품이라 bootstrapSynk 재건 목록·healthCheck 시트 점검에는 넣지 않음(academic_log와 반대). */
function setupPlaceholderImages() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ct = ss.getSheetByName('contents');
  if (!ct || ct.getLastRow() < 2) { Logger.log('contents 비어 있음 — 플레이스홀더 스킵'); return; }
  const color = { monster: '3D5AFE', boss: '312E81', worldboss: '1E1B4B', store: 'F5A623' }; // 인디고·다크퍼플·더어둡게·[v9.19]스토어 앰버
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

/* ===================== [v9.25] 🚪 온보딩 콘텐츠 (역할별 첫 화면 안내) =====================
 * 'onboarding' 시트에 역할별 3줄 안내를 세팅. Glide가 role 필터로 홈 최상단에 표시. — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md)
 * 순수 콘텐츠(계산 로직 아님) — 1회 실행. 몽골어는 초벌이라 원어민 검수 권장. */
function setupOnboarding() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureSheet(ss, 'onboarding', ['role', '제목', '안내KO', '안내MN', '아이콘']);
  const rows = [
    /* [08-28] 몽골어 초벌을 제미나이 검문(tools/몽골어대조.js)에 태워 **결함 셋**을 고쳤다 — 이건
     * 학생이 «첫 화면»에서 보는 유일한 몽골어라 초벌 그대로 두면 그 인상이 첫인상이 된다.
     *   ①`гараар зөв хэлсэн`(손으로 말하다) — 몽골어에 없는 결합이다(「손으로 쓰다」와 「입으로 말하다」가
     *     섞인 꼴). 「내가 맞힌 말」의 뜻은 «스스로»라 `өөрөө` 로 간다.
     *   ②`солонгос хэл ч өснө`(한국어가 자란다) — 언어 실력에 «자라다»를 안 쓴다(→ `сайжирна`).
     *     한국어의 「쑥쑥 자라」 은유는 여기서 잃는다 — 안 통하는 은유를 우겨 넣으면 번역투가 된다.
     *   ③`өдөр бүрт чам руу ойртоно` — 조사·연결이 어색해 문장을 둘로 끊고 `тусам` 구문으로 폈다.
     * ⚠ 검문은 «거름망»이지 검수가 아니다 — 사람 검수는 그대로 큐에 있다(발주서 §O). */
    ['student', 'SYNK에 온 걸 환영해! 🧶', '가이드를 하나 고르면, 함께한 날이 쌓일수록 네 곁으로 다가와. 네 손으로 맞힌 말이 늘수록 새 장면이 열리고, 한국어도 쑥쑥 자라!', 'Хөтчөө сонгоод яв. Хамт өнгөрүүлсэн өдөр олшрох тусам тэр чам руу ойртоно. Өөрөө зөв хэлсэн үг чинь нэмэгдэх тусам шинэ дүр зураг нээгдэж, солонгос хэл чинь ч сайжирна!', '🐣'], // [함께한날 막7] 진화·도감 세계관 → 함께한 날
    ['parent', '자녀의 성장을 매주 받아보세요 🌱', '매주 자녀의 한국어 성장 리포트가 몽골어로 도착해요. 출석·급수·칭찬을 한눈에 확인하고 함께 응원해 주세요.', 'Долоо хоног бүр хүүхдийнхээ солонгос хэлний ахицын тайланг монголоор хүлээн авна. Ирц, зэрэг, магтаалыг нэг дороос хараарай.', '💌'],
    ['teacher', '오늘 할 것만 크게 보여요 👩‍🏫', "'오늘의 반' 탭에서 브리핑·체크·기회 밸런스를 확인하고, 버튼 한 번으로 포인트를 주세요. 하루 한도는 자동 정정돼요.", '', '📋'],
    ['director', 'SYNK LAB 콕핏 🛰️', '리텐션 레이더·케어 사각·경영 리포트로 학원 전체를 한 화면에서 관리하세요.', '', '🛰️'], // [v9.38] 'admin'→'director' 실데이터 역할값 정합(Glide Visibility도 director)
  ];
  sh.getRange(2, 1, rows.length, 5).setValues(rows);
  Logger.log('온보딩 콘텐츠 ' + rows.length + '역할 세팅 완료 (onboarding 시트)');
  /* 🔴 이 함수는 bootstrapSynk·preflightGlide 에서만 돈다 — **코드를 고쳐 배포해도 라이브 시트의
   *   기존 행은 안 바뀐다**(codex P1 1033b065). 08-28 에 몽골어 결함 셋을 고치고 「고쳤다」고 적었는데
   *   실제로는 학생이 옛 문구를 계속 볼 뻔했다: 소스가 아니라 «저장된 행»이 화면에 간다.
   *   ⇒ 메뉴 통로(menuSetupOnboarding)를 세우고, 무엇이 섰는지 돌려준다. */
  return '온보딩 안내 ' + rows.length + '역할 세움 — ' + rows.map(r => String(r[0]) + (String(r[3] || '') ? ' (몽골어 있음)' : '')).join(' · ');
}

/* ===================== [v9.38] 🏫 수업 입력 시트·열 물리 생성 (Glide 폼 바인딩 선행) =====================
 * W3(학습추적) 신규 구조는 스켈레톤엔 있으나 '기존' 라이브 시트엔 미반영이다(ensureSheet는 생성 시에만 헤더 기록).
 * 새 앱 조립 전 이 함수를 1회 실행하면 강사 마감폼(weekly_topics F~L)·출석 배치폼(attendance_batch)의
 * 바인딩 대상 열/시트가 정확한 헤더로 물리 생성된다. 멱등 — 이미 있으면 무해. 수동 헤더 입력(오타 위험) 대체. — 구 Glide(08-05 폐기 · 이관 = docs/글라이드_이관대장.md) */
function setupClassroomInputs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tp = ensureSheet(ss, 'weekly_topics', ['class_name', '배운내용', '입력자', 'created_at', '배운내용_mn']);
  ensureLessonCols_(tp); // F~L 승격: 문법태그·전체도달도·예외학생·숙제완료자·연료미션·처리상태·학습전개상태
  ensureSheet(ss, 'attendance_batch', ['날짜', 'class_name', '출석자목록', '입력자', 'created_at', '처리상태']); // 수업 시작 출석 1탭(멀티선택) — parentSweep이 attendance로 전개
  ensureSheet(ss, 'mastery_log', MASTERY_LOG_HEADERS);   // 스크립트 전용(진화 게이트 재료) · [v9.240] 헤더 정본 공유(엔진_셋업확장)
  ensureSheet(ss, 'student_errors', ['날짜', 'student_id', '반', '유형', '메모', '입력자', 'created_at', '상태']);       // 강사 선택 입력(학생 미노출)
  // [v9.38c] Glide 폼 대상 입력 시트 일괄 보장 — 배치 함수가 만들 때까지 안 생겨 Glide 바인딩이 막히던 것 방지(멱등, 기존은 무해)
  ensureSheet(ss, 'hw_batch', ['date', 'class_name', '완료자목록', '입력자', 'created_at', '처리상태']);              // 강사 숙제 멀티체크
  ensureSheet(ss, 'absence_notice', ['student_id', '반', '날짜', '사유', '등록시각']);                                // 학부모 결석 사전신고
  ensureSheet(ss, 'inquiries', ['student_id', '이름', '문의내용', '상태', '접수시각']);                                // 학부모 문의
  // [v9.38] teacher_checkins 헤더 정규화 — 라이브 옛 GPS 스키마(log_id·teacher_id·date·type…)를 코드 기대(이름·구분·시각)로.
  //   TC_NAME/TYPE/TIME_COL=1/2/3이 이 3열을 위치로 읽으므로 헤더가 어긋나면 출퇴근 보드·퇴근응원 오작동. 빈 시트라 데이터 무손실.
  const tc = ensureSheet(ss, 'teacher_checkins', ['이름', '구분', '시각']);
  ['이름', '구분', '시각'].forEach((h, i) => { if (String(tc.getRange(1, i + 1).getValue()) !== h) tc.getRange(1, i + 1).setValue(h); });
  // [v9.80] profiles 학교·동네 — 조 편성의 "같은 학교·동네 친구는 다른 조로"(규칙서 §5) 재료.
  //   선택 입력이라 비어 있어도 편성은 돌아가고 그 기준만 생략된다. 열이 없으면 채울 자리조차 없어 여기서 보장한다.
  //   ⚠ 열 번호를 박지 않는다 — 76·77(BX·BY)은 이미 '오늘의알림'·'나의여정'(v9.20, calcAll이 매일 씀)이고,
  //     공유 열도 v9.74·v9.81에서 계속 늘어나는 중이다. langColOf_로 이름으로 찾고 없으면 끝에 새로 만든다.
  const pfG = ss.getSheetByName('profiles');
  if (pfG) { langColOf_(pfG, '학교'); langColOf_(pfG, '동네'); }
  ensureSheet(ss, 'groups', GROUPS_HEADERS); // [v9.80] 조 편성 — assignGroupsAll이 채운다(강사 입력 아님)
  ensureSheet(ss, 'lectures', LECTURE_HEADERS);           // [v9.106]
  ensureSheet(ss, 'lecture_views', LECTURE_VIEW_HEADERS); // [v9.106]
  ensureSheet(ss, 'lesson_close', LESSON_CLOSE_HEADERS); // [v9.91] 차시 마감폼 적재처(폼 생성 전에도 Glide 바인딩 가능하게 선보장)
  Logger.log('수업 입력 구조 생성 완료: weekly_topics F~L 승격 · attendance_batch · mastery_log · student_errors · teacher_checkins 헤더 정규화 · profiles 학교/동네 · groups');
  return '수업 입력 구조 생성 완료 — 강사 마감폼/출석폼/출퇴근을 이 시트·열에 바인딩하세요.';
}

// [v9.98] 동의 문항 A의 제목 = 자유서술 blob에 남는 동의 마커. migrateConsentV186과 한 벌 — 제목을 바꾸면 여기도 바꾼다
//   (문항 A는 대응 시트 열이 없어 규칙대로 blob에 '[제목] 답'으로 접수 시각과 함께 보존된다 = 행 단위 동의 증빙).
const CONSENT_Q_TITLE = '개인정보·학습데이터 활용 동의';


