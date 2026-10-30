// 업종 반응 브리핑 · 네이버 데이터랩 읽기 — ego 안에서 돈다(브리핑.js가 globalThis.JOB을 앞에 붙여 `ego-browser nodejs`에 넘긴다).
// 데이터랩은 브라우저 밖 요청을 막아, 그 쪽을 연 뒤 같은 쪽에서 page.fetch로 부른다(docs/현장노트/수집_yt-dlp.md 「네이버 데이터랩」).
// 읽기만 한다 — 로그인·입력 저장 없음. 갈래마다 따로 잡아 하나가 막혀도 나머지는 적는다.
//
// JOB = { out, 공간,
//   쇼핑: { cid, 성별, 순위: [{이름, 시작, 끝, 나이?}], 비중: {시작, 끝}, 하위: [{이름, cid}], 클릭: {시작, 끝} } | null,
//   검색: { 묶음: [{이름, 낱말: []}], 성별, 시작, 끝 } | null }
const fs = await import('node:fs/promises');
const J = globalThis.JOB;
const 결과 = { 받은때: new Date().toISOString(), 상태: {}, 쇼핑: null, 검색: null };
const 쉬기 = (ms) => new Promise((r) => setTimeout(r, ms));
const 폼 = (o) => Object.entries(o).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v ?? '')).join('&');
const 짧게 = (e) => String(e && e.message ? e.message : e).slice(0, 200);
// 갈래가 끝날 때마다 파일에 바로 쓴다 — 부모가 시간 초과로 끊어도 받은 만큼은 남는다
const 저장 = () => fs.writeFile(J.out, JSON.stringify(결과));
async function 쪽열기(주소) {
  await page.goto(주소);
  await page.waitForLoadState();
  const 제목 = await page.title();
  if (/접근 오류|접속할 수 없습니다/.test(제목)) throw new Error('데이터랩 접근 오류 쪽');
}

const task = await taskSpace(J.공간 || '업종 브리핑 · 네이버');
const page = task.page('p1');

async function 보내기(주소, 값) {
  await 쉬기(1500); // 잇달아 빨리 부르면 오류 없이 빈 순위가 온다
  const r = await page.fetch(주소, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest' }, body: 폼(값), timeout: 20000 });
  if (r.status !== 200) throw new Error(`${주소} HTTP ${r.status}`);
  return JSON.parse(r.body || '{}');
}

if (J.쇼핑) {
  const S = J.쇼핑;
  try {
    await 쪽열기('https://datalab.naver.com/shoppingInsight/sCategory.naver');
    const 쇼핑 = { cid: S.cid, 순위: [], 비중: {}, 클릭: [] };
    for (const 칸 of S.순위 || []) {
      const 낱말 = [];
      for (const 쪽 of [1, 2]) {
        const r = await 보내기('/shoppingInsight/getCategoryKeywordRank.naver', { cid: 칸.cid || S.cid, timeUnit: 'date', startDate: 칸.시작, endDate: 칸.끝, age: 칸.나이 || '', gender: 칸.성별 ?? '', device: '', page: 쪽, count: 20 });
        낱말.push(...(r.ranks || []).map((x) => x.keyword));
        if ((r.ranks || []).length < 20) break;
      }
      쇼핑.순위.push({ 이름: 칸.이름, 시작: 칸.시작, 끝: 칸.끝, 낱말 });
    }
    for (const 종류 of ['Age', 'Gender', 'Device']) {
      const r = await 보내기(`/shoppingInsight/getCategory${종류}Rate.naver`, { cid: S.cid, timeUnit: 'date', startDate: S.비중.시작, endDate: S.비중.끝, age: '', gender: '', device: '' });
      쇼핑.비중[종류] = (r.result?.[0]?.data || []).map((x) => ({ 값: x.code, 이름: x.label, 상대: x.ratio }));
    }
    const 하위 = S.하위 || [];
    for (let i = 0; i < 하위.length; i += 3) {
      const 묶음 = 하위.slice(i, i + 3);
      const r = await 보내기('/shoppingInsight/getCategoryClickTrend.naver', { cid: 묶음.map((x) => x.cid).join(','), timeUnit: 'week', startDate: S.클릭.시작, endDate: S.클릭.끝, age: '', gender: '', device: '' });
      쇼핑.클릭.push((r.result || []).map((x) => ({ cid: x.code, 이름: x.title, 값: (x.data || []).map((d) => [d.period, d.value]) })));
    }
    결과.쇼핑 = 쇼핑;
    결과.상태.쇼핑 = '됨';
  } catch (e) {
    결과.상태.쇼핑 = '못 읽음: ' + 짧게(e);
  }
  await 저장();
}

if (J.검색) {
  const Q = J.검색;
  try {
    await 쪽열기('https://datalab.naver.com/keyword/trendSearch.naver');
    // 화면이 보내는 꼴 그대로 — qcType을 넣거나 주·월 단위를 주면 INVALID_PARAMS(현장 노트)
    const queryGroups = Q.묶음.map((g) => g.이름 + '__SZLIG__' + g.낱말.join(',')).join('__OUML__');
    const r = await page.fetch('/qcHash.naver', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest' },
      body: 폼({ queryGroups, startDate: Q.시작.replaceAll('-', ''), endDate: Q.끝.replaceAll('-', ''), timeUnit: 'date', gender: Q.성별 || '', age: '', device: '' }), timeout: 30000 });
    const j = JSON.parse(r.body || '{}');
    if (!j.success) throw new Error('qcHash ' + (j.code || '') + ' ' + String(j.message || '').slice(0, 80));
    await page.goto('https://datalab.naver.com/keyword/trendResult.naver?hashKey=' + j.hashKey);
    await page.waitForLoadState();
    await page.waitForFunction(() => document.querySelectorAll("g[class*='bb-circles-'] circle").length > 0, undefined, { timeout: 30000 });
    // 결과 숫자는 그래프 점에만 있다 — 점의 cy를 y축 눈금으로 값으로 바꾼다
    const 그림 = await page.evaluate(() => ({
      줄: [...document.querySelectorAll("g[class*='bb-circles-']")].map((g) => [...g.querySelectorAll('circle')].map((c) => Number(c.getAttribute('cy')))),
      눈금: [...document.querySelectorAll('.bb-axis-y .tick')].map((t) => ({ y: Number((/translate\([^,]+,\s*([-\d.]+)\)/.exec(t.getAttribute('transform') || '') || [])[1]), 값: Number(t.textContent) })),
    }));
    const 눈 = 그림.눈금.filter((t) => Number.isFinite(t.y) && Number.isFinite(t.값)).sort((a, b) => a.값 - b.값);
    if (눈.length < 2) throw new Error('y축 눈금을 못 읽음');
    const a = 눈[0], b = 눈[눈.length - 1];
    const 값으로 = (cy) => Math.round(((a.값 + ((cy - a.y) * (b.값 - a.값)) / (b.y - a.y)) * 100)) / 100;
    결과.검색 = { 시작: Q.시작, 끝: Q.끝, 성별: Q.성별 || '', 묶음: Q.묶음.map((g, i) => ({ 이름: g.이름, 낱말: g.낱말, 하루: (그림.줄[i] || []).map(값으로) })) };
    결과.상태.검색 = '됨';
  } catch (e) {
    결과.상태.검색 = '못 읽음: ' + 짧게(e);
  }
  await 저장();
}

await 저장();
await task.finish({ keep: [] });
console.log(JSON.stringify({ 끝: true, 상태: 결과.상태 }));
