// tests/상담지식.test.js — [v9.152] 상담AI 개통 회귀 (원천 = docs/자주묻는질문_정본.md · 파생① 정합)
// 실행: node tests/상담지식.test.js
//
// 지키는 것:
//   ① FAQ 정본이 ✅로 확정한 것(정원 16·수업 요일)이 지식에서 다시 「미확정」으로 낡지 않는다
//   ② FAQ 정본이 ⛔로 잠근 것(수강료·주소·환불)이 값 없이 확정:true로 승격되지 않는다(환각=학원이 약속을 지는 사고)
//   ③ 미성년 연락처 차단(S9 🔴)이 금칙과 시스템 프롬프트 양쪽에 산다 — 한쪽만 있으면 모델이 다른 쪽을 따른다
//   ④ FAQ가 드러낸 구멍 3건(대상 연령·결석 보강·반 배정)이 최소한 「미확정」으로 등재돼 있다
//      (빠진 항목은 「모른다」조차 못 해서 봇이 근거 없이 인계한다)
// ⚠ 상담AI.js·contents_상담AI.js는 tests/_engine-source.js의 ENGINE_FILES 밖이라 직접 읽는다.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 지식 = fs.readFileSync(path.join(ROOT, 'contents_상담AI.js'), 'utf8').replace(/\r\n/g, '\n');
const 엔진 = fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8').replace(/\r\n/g, '\n');

test('[v9.152] ① FAQ ✅ 확정분이 지식에 확정:true로 산다 — 정원 16명·수업 요일', () => {
  assert.ok(/주제: '정원과 소그룹', 확정: true/.test(지식), '정원 블록이 없거나 미확정이다 — 반편성 정본 v2.3(확정)이 지식에서 낡았다');
  assert.ok(지식.includes('정원 16명'), '정원 숫자가 지식 본문에 없다');
  assert.ok(/주제: '수업 요일', 확정: true/.test(지식), '수업 요일 블록이 없거나 미확정이다 — FAQ Q5 확정분');
  assert.ok(지식.includes('정확한 수업 시각은 개원 장소가 확정된 뒤'), '요일 블록이 시각 유보선을 안 긋는다 — 봇이 시각까지 지어낼 여지');
});

test('[v9.152] ② FAQ ⛔ 잠금분은 여전히 확정:false다 — 값 없이 승격되면 환각이 약속이 된다', () => {
  ['수강료', '학원 주소·오시는 길', '환불 규정', '무료 체험·레벨체크 절차'].forEach(t => {
    assert.ok(new RegExp("주제: '" + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "', 확정: false").test(지식),
      `「${t}」가 확정:false가 아니다 — FAQ 정본이 ⛔로 잠근 항목`);
  });
});

test('[v9.152] ③ 미성년 연락처 차단이 금칙·시스템 프롬프트 양쪽에 있다 (FAQ S9 🔴)', () => {
  assert.ok(지식.includes('미성년') && 지식.includes('보호자'), '금칙에 미성년 차단이 없다');
  const sys = 엔진.slice(엔진.indexOf('function 상담_시스템_('), 엔진.indexOf('function 상담_이력_('));
  assert.ok(sys.includes('미성년'), '시스템 프롬프트에 미성년 분기가 없다 — 금칙만으로는 리드 수집 규칙이 이긴다');
  assert.ok(sys.includes('연락처는 채우지 않는다') || sys.includes('연락처를 받지 말'), '리드 정보 규칙에 미성년 제외가 없다');
});

/* [v9.154] 정본→지식 전파 가드. 실제 사고에서 나왔다: 08-04에 개원일이 확정돼 FAQ 정본 Q3는
 * 갱신됐는데 **챗봇 지식은 「2월 개원 예정」인 채로 남아** 봇이 옛 답을 말할 상태였다
 * (이 저장소의 만성 실패 = 「정본 개정이 파생에 전파 안 된다」).
 * ⚠ 날짜 리터럴을 박지 않는다 — 정본이 바뀔 때마다 테스트가 인질이 된다(문서그래프 사건).
 *   대신 **두 파일이 같은 날짜를 말하는지**만 대조한다. 개원일이 또 바뀌어도 이 검사는 안 깨진다. */
test('[v9.154] ⑦ 개원일이 FAQ 정본과 챗봇 지식에서 일치한다', () => {
  const faq = fs.readFileSync(path.join(ROOT, 'docs/자주묻는질문_정본.md'), 'utf8');
  const q3 = faq.slice(faq.indexOf('Q3.'), faq.indexOf('Q4.'));
  const 정본날짜 = (q3.match(/\d{1,2}월\s*\d{1,2}일/g) || []).map(s => s.replace(/\s+/g, ''));
  assert.ok(정본날짜.length, 'FAQ Q3에서 개원 날짜를 읽지 못했다 — 형식이 바뀌었으면 이 검사도 함께 고쳐라');
  const s = 지식.indexOf("주제: '개원 시기'");
  assert.notEqual(s, -1, '개원 시기 지식 블록이 없다');
  const 블록 = 지식.slice(s, 지식.indexOf('},', s)).replace(/\s+/g, '');
  정본날짜.forEach(d => assert.ok(블록.includes(d),
    `정본이 말하는 개원 날짜 「${d}」가 챗봇 지식에 없다 — 봇이 옛 날짜를 말한다`));
});

/* [v9.154] Meta 봇 공개(disclosure) — 플랫폼 정책 요건이자 앱 검수 항목.
 * 이 테스트의 존재 이유: 구 `상담_첫인사`는 「이력이 비었을 때 쓴다」고 주석에 적힌 채
 * **어디에서도 참조되지 않는 죽은 상수**였다. 상수의 존재만 검사하면 그 상태를 통과시킨다
 * — 그래서 「실제로 배선됐는가」를 결과로 본다(guard-must-check-result 계열). */
test('[v9.154] ⑤ 봇 공개 상수가 자동화를 명시하고, 죽은 상수가 아니다(엔진이 실제로 참조한다)', () => {
  assert.ok(/const 상담_봇공개\s*=/.test(지식), '상담_봇공개 상수가 없다');
  assert.ok(/бот|автомат/i.test(지식), '봇 공개 문구에 자동화 표기(бот/автомат)가 없다 — Meta 정책 요건');
  assert.ok(지식.includes('자동 상담 봇'), '한국어 병기에 자동화 표기가 없다 — 한국어로 쓰는 상대는 못 읽는다');
  assert.ok(엔진.includes('상담_봇공개'), '엔진이 상담_봇공개를 참조하지 않는다 — 죽은 상수(구 상담_첫인사의 재발)');
  assert.ok(!지식.includes('const 상담_첫인사'), '죽은 상수 상담_첫인사가 남아 있다 — 두 개가 되면 어느 것이 나가는지 알 수 없다');
});

test('[v9.154] ⑥ 봇 공개가 첫 턴에만, 그리고 **모든** 응답 경로에 붙는다', () => {
  const s = 엔진.indexOf('function 상담응답_(');
  assert.notEqual(s, -1, '상담응답_ 정의를 찾지 못함');
  const fn = 엔진.slice(s, 엔진.indexOf('function 상담_호출_('));
  assert.ok(/const 공개 = \(상담_이력_\(세션\)\.length === 0\)/.test(fn),
    '첫 턴 판정이 없다 — 매 턴 공개가 붙거나(스팸) 한 번도 안 붙는다');
  // 정지·상한·API오류·정상 4경로 전부 — 하나라도 빠지면 그 턴이 정책 위반이다
  const returns = fn.match(/return \{ reply:[^;]*\};/g) || [];
  assert.ok(returns.length >= 4, `응답 경로가 ${returns.length}개로 줄었다 — 경로 구조가 바뀌었으면 이 검사도 함께 고쳐라`);
  returns.forEach((r, i) => assert.ok(r.includes('공개'), `응답 경로 ${i + 1}에 봇 공개가 빠졌다: ${r.slice(0, 60)}`));
});

test('[v9.152] ④ FAQ가 드러낸 구멍 3건이 미확정으로라도 등재돼 있다', () => {
  ['대상 연령', '결석·보강', '반 배정'].forEach(t => {
    assert.ok(지식.includes("주제: '" + t) || 지식.includes(t), `「${t}」가 지식 목록에 아예 없다 — 봇이 근거 없이 인계한다`);
  });
});
