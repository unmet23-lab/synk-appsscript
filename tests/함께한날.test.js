/* [함께한날] 회귀 — 설계 §4-8 「회귀가 지켜야 할 것 9」의 이 저장소 몫.
 * 정본 = docs/함께한날_설계_v1.md. 순수 함수(사다리)는 «실행»으로, 배선은 «소스 앵커»로 잰다.
 * ⚠ 이 검사가 «안» 보는 것(§4-8 정직 조항 그대로): 라이브 시트의 실값 · Glide/talk 바인딩 ·
 *   scene_log 실행 멱등(막5 checkScene 검사 몫) · profiles 열 레지스트리 31·32 편입. */
const test = require('node:test');
const assert = require('node:assert');
const { engineSource } = require('./_engine-source');

const code = engineSource();

// ── 사다리(순수 함수) — 소스에서 그대로 실행한다 ──
function ladderCtx() {
  const start = code.indexOf('const SCENE_LADDER_');
  const end = code.indexOf('/* 가이드 대사');
  assert.ok(start > -1 && end > start, '사다리 구간 표식을 못 찾았다');
  const ctx = {};
  new Function('ctx', code.slice(start, end) +
    '\nctx.sceneOf = sceneOf; ctx.sceneLadderAt_ = sceneLadderAt_; ctx.SCENE_LADDER_ = SCENE_LADDER_;')(ctx);
  return ctx;
}

test('①⑨ 사다리 — 단조 증가·문턱 간격 확대·첫 4주 안 장면 4(주4 만남 가정)', () => {
  const { sceneOf, sceneLadderAt_, SCENE_LADDER_ } = ladderCtx();
  // 단조: 날이 늘면 장면은 절대 안 준다(같은 맞힌 말에서)
  let prev = 0;
  for (let d = 0; d <= 400; d++) {
    const s = sceneOf(d, 72).idx;
    assert.ok(s >= prev, `함께한 날 ${d}에서 장면이 줄었다(${prev}→${s})`);
    prev = s;
  }
  // 문턱 간격은 매번 커진다(설계 §2 「간격 규칙」)
  for (let k = 3; k <= 16; k++) {
    const gap1 = sceneLadderAt_(k)[1] - sceneLadderAt_(k - 1)[1];
    const gap0 = sceneLadderAt_(k - 1)[1] - sceneLadderAt_(k - 2)[1];
    assert.ok(gap1 >= gap0, `장면 ${k}의 날 간격(${gap1})이 직전(${gap0})보다 좁다`);
  }
  // 첫 4주(주 4일 만남 = 함께한 날 16) 안에 장면 4 — 「3주 내 훅」 정신(설계 §2)
  assert.equal(sceneOf(16, 2).idx, 4, '주 4일 한 달이면 장면 4까지 열려야 한다(1·3·7·14)');
  // 장면 1~3은 게이트 없음 — 맞힌 말 0으로도 열린다
  assert.equal(sceneOf(7, 0).idx, 3, '첫 세 장면은 무게이트여야 한다');
  // 게이트: 날이 차도 맞힌 말이 모자라면 안 열린다(장면 4 = 14일 AND 2개)
  assert.equal(sceneOf(14, 1).idx, 3, '맞힌 말 게이트가 안 걸린다');
  assert.equal(sceneOf(14, 2).idx, 4);
  // 30·60·100 회피(스트릭 업적과 같은 날 이중 축하 방지 — 설계 §2)
  const dayThresholds = SCENE_LADDER_.map(r => r[1]);
  [30, 60, 100].forEach(n => assert.ok(dayThresholds.indexOf(n) === -1, `날 문턱에 ${n}이 있다 — 스트릭 업적과 겹친다`));
  // 말 문턱은 뱅크(72)를 안 넘는다 — 넘으면 영영 안 열리는 장면이 된다
  for (let k = 1; k <= 30; k++) assert.ok(sceneLadderAt_(k)[2] <= 72, `장면 ${k} 말 문턱이 뱅크 72를 넘는다`);
});

test('① 함께한 날 — 증분·단조·결석 무해(소스 앵커)', () => {
  // 하루 최대 +1: 거리(날짜) 기준 증분 — 같은 날 사건 여럿이어도 날짜 Set 이라 +1
  assert.ok(code.includes('daysNow = prevDays9 + add9'), '함께한날이 증분(prevAE 기반)이 아니다');
  assert.ok(code.includes('ds9 > lastYmd9'), '마지막만남일 래칫(하루 +1)이 없다');
  // 감소 경로 0: aeOut 에 빼기·리셋이 없다(단조) — 결석은 벌이 아니다(철학 Ⅲ-2)
  const aeSeg = code.slice(code.indexOf('AE31·AF32 증분'), code.indexOf('const mastANow'));
  assert.ok(aeSeg.length > 0 && !/prevDays9\s*-/.test(aeSeg), '함께한날에 감소 경로가 생겼다');
});

test('② 함께한 날이 point_logs «전수 재계산» 위에 서지 않는다(당월 아카이빙 함정 — 설계 §4-2)', () => {
  // point_logs 는 「첨삭확인」 사유의 «오늘 근방» 만남 판정에만 쓰고, 원장(AE31)은 시트 증분이다.
  // 전수 재계산이면 매월 1일 아카이빙 때 리셋된 것처럼 보인다 — 증분 앵커(위 ①)가 그 방벽이다.
  const meetSeg = code.slice(code.indexOf('«서버가 본 만남» 수집'), code.indexOf('되돌아보기 재료 셋'));
  assert.ok(meetSeg.includes("'첨삭확인'"), '첨삭 확인 만남 판정이 사라졌다');
  assert.ok(!meetSeg.includes('point_logs_archive'), '만남 수집이 아카이브까지 전수 스캔한다 — 증분 설계 위반');
});

test('③④ 학생 노출 새 카드에 남 이름·순위 0 · profiles 열 삭제 코드 0', () => {
  ['function buildTogetherCard_', 'function buildFilmStripHtml_', 'function buildWalkedRoadHtml_'].forEach(fn => {
    const s = code.indexOf(fn);
    assert.ok(s > -1, fn + ' 없음');
    const body = code.slice(s, code.indexOf('\nfunction', s + 10));
    ['랭킹', '순위', '평균', '상위'].forEach(w => assert.ok(body.indexOf(w) === -1, fn + ' 안에 비교 낱말 «' + w + '»'));
  });
  assert.ok(!/pf\.deleteColumns?\(/.test(code), 'profiles 열 삭제 코드가 생겼다(인덱스 고정 계약 위반)');
});

test('⑦ «내가 맞힌 말»에 수업 일괄(lesson) 단독 도달이 안 섞인다', () => {
  // 눈금 쪽: 출처 화이트리스트 셋(교재연동 masteryApply_ 이름 그대로)
  assert.ok(code.includes("srcM === 'AI첨삭' || srcM === 'AI음성' || srcM === 'AI대화'"),
    '맞힌 말 눈금의 출처 화이트리스트가 사라졌다');
  // 생산 쪽: 수업 전개는 '연습'까지만 — '도달'을 쓰는 통로가 되살아나면 눈금이 다시 오염된다
  const seg = code.slice(code.indexOf('function expandMasteryLog_'), code.indexOf('function seedMasteryForExisting'));
  assert.ok(seg.includes("newRows.push([sid, gid, '연습'"), '수업 전개가 연습 고정이 아니다');
  assert.ok(!seg.includes("'도달' 기존") || true, '');
  assert.ok(!/newRows\.push\(\[sid, gid, '도달'/.test(seg), '수업 전개가 도달을 쓴다 — §4-3 처방 ① 붕괴');
});

test('막4 배선 — 장면 축이 화면 여덟 자리를 실제로 잡았다(한 화면 두 체계 금지)', () => {
  [['우리 카드(BD56)', 'buildTogetherCard_({'],
   ['필름스트립(CE83)', 'buildFilmStripHtml_({'],
   ['걸어온길(BY77)', 'buildWalkedRoadHtml_({'],
   ['가이드 한마디(BF58)', 'sceneSpeak_(guideNm'],
   ['장면 내레이터(BX76)', 'NARRATE_SCENE, id + todayYmd0'],
   ['다음장면 남은 날(AG33)', 'evoRemOut.push([isStu9 ? sceneNow.toDays'],
   ['지나온장면수(AP42)', 'stageNumOut.push([isStu9 ? sceneIdx'],
   ['맞힌말수(CC81)', 'ccOut.push([isStu9 ? mastANow']].forEach(([nm, anchor]) => {
    assert.ok(code.includes(anchor), nm + ' 배선이 장면 축이 아니다: ' + anchor);
  });
  // 구 축이 화면에 남으면 「한 화면 두 체계」 — 액자·도감·구 한마디 «호출부»는 0이어야 한다
  // (⚠ 함수 «정의»는 막6 소각 전까지 남아 있어도 된다 — 앵커는 호출 꼴로 잰다: 정의의 매개변수 목록과 안 겹치게)
  ['frameOut.push([buildMonsterFrame_', '? buildDexHtml_(', 'speakTone_(mon'].forEach(dead => {
    assert.ok(!code.includes(dead), '구 몬스터 축 호출부가 살아 있다: ' + dead);
  });
});

test('⑤ 막5 checkScene — 멱등키(잠금 창)·마커 발화·기입→알림→마커→개명 순서·밤 배치 편입', () => {
  const s = code.indexOf('function checkScene()');
  assert.ok(s > -1, 'checkScene 없음');
  const body = code.slice(s, code.indexOf('/* ===================== 강사 케어 지수', s));
  assert.ok(body.includes("has[c.sid + '|' + k]"), '장면 멱등키(sid|장면번호)가 본진이 아니다 — 한 칸 덮어쓰기 병 재발 경로');
  // 멱등맵 로드와 append 는 «같은 잠금 창» — 넓히면 안의 adminMail 이 비재진입 잠금을 재획득하다 죽는다(codex P1 ebee661a)
  const iLock = body.indexOf('lock.tryLock');
  const iHas = body.indexOf("has[c.sid + '|' + k]");
  const iRel = body.indexOf('lock.releaseLock()');
  assert.ok(iLock > -1 && iHas > iLock && iRel > iHas, '멱등맵→append 가 잠금 창 밖이다(동시 실행 중복 append)');
  assert.ok(body.indexOf('adminMail(') > iRel, 'adminMail 이 잠금 안이다 — DIGEST_MODE 재진입 교착(codex P1)');
  // 발화는 scene_log «존재»가 아니라 AD 마커 기준 — 기입 뒤 죽어도 재실행이 알림을 되살린다(codex P2 004e4ddf)
  assert.ok(body.includes('nSc > adPrev'), '발화 판정이 마커 기준이 아니다(기입 후 크래시 = 알림 영구 유실)');
  // v9.34 교훈 — 마커(AA/AD) 갱신은 기입·발송 «뒤» · 헤더 개명은 마커 직전(전환 원자성 fedb767e)
  const iLog = body.indexOf('writeIfChanged(log, log.getLastRow()');
  const iMail = body.indexOf('adminMail(');
  const iRename = body.indexOf("pf.getRange('AA1').setValue('이전장면')");
  const iMark = body.indexOf('writeIfChanged(pf, 2, 27');
  assert.ok(iLog > -1 && iMail > iLog && iRename > iMail && iMark > iRename, '순서가 기입→알림→개명→마커가 아니다');
  // D-1 쿼터 유실 보존 — 못 나간 반은 원장 다이제스트로(codex P2 e7787886)
  assert.ok(body.includes('d1Missed'), 'D-1 쿼터 유실 반이 어디에도 안 남는다');
  assert.ok(code.includes("safeRun('checkScene', checkScene)"), '밤 배치에 checkScene 이 없다');
  assert.ok(!code.includes("safeRun('checkEvolution'"), '밤 배치가 아직 checkEvolution 을 부른다 — 한 밤 두 체계');
});

test('한마디 규격 — 결석·끊김 언급 분기 0(발화표 S19 · 재촉 장치 금지)', () => {
  const s = code.indexOf('function sceneSpeak_');
  const body = code.slice(s, code.indexOf('\nfunction', s + 10));
  ['miss3', 'miss7', 'daysSince'].forEach(w => assert.ok(body.indexOf(w) === -1, '한마디에 결석 축 «' + w + '»이 산다'));
  // 몽골어 미러는 같은 분기(만족도팩) — 새 분기를 한쪽만 고치면 초급 병기가 조용히 어긋난다
  assert.ok(code.includes('MJ_sceneSpeakMirror_'), '가이드 한마디 몽골어 미러 배선이 없다');
});
