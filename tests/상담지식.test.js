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

test('[v9.152] ④ FAQ가 드러낸 구멍 3건이 미확정으로라도 등재돼 있다', () => {
  ['대상 연령', '결석·보강', '반 배정'].forEach(t => {
    assert.ok(지식.includes("주제: '" + t) || 지식.includes(t), `「${t}」가 지식 목록에 아예 없다 — 봇이 근거 없이 인계한다`);
  });
});
