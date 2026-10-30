// 업종 반응 브리핑 · 메타 광고 라이브러리 읽기 — ego 안에서 돈다(브리핑.js가 globalThis.JOB을 앞에 붙인다).
// 지금 게재 중인 광고를 노출 많은 순으로 열고, 본문 글을 「라이브러리 ID」로 잘라 카드 글만 돌려준다(나누기는 Node 쪽).
// 영상마다 조상을 거슬러 카드를 찾으면 멈추므로 본문 글 한 번으로 끝낸다(docs/현장노트/수집_yt-dlp.md 「메타 광고 라이브러리」). 읽기만 한다.
//
// JOB = { out, 공간, 나라: 'KR', 검색어: [], 내림: 4 }
const fs = await import('node:fs/promises');
const J = globalThis.JOB;
const 결과 = { 받은때: new Date().toISOString(), 상태: {}, 검색: [] };
const 쉬기 = (ms) => new Promise((r) => setTimeout(r, ms));

const task = await taskSpace(J.공간 || '업종 브리핑 · 메타');
const page = task.page('p1');

for (const q of J.검색어 || []) {
  try {
    const 주소 = 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=' + encodeURIComponent(J.나라 || 'KR')
      + '&is_targeted_country=false&media_type=all&q=' + encodeURIComponent(q)
      + '&search_type=keyword_unordered&sort_data[direction]=desc&sort_data[mode]=total_impressions';
    await page.goto(주소);
    await page.waitForLoadState();
    await 쉬기(5000);
    for (let i = 0; i < (J.내림 ?? 4); i++) {
      await page.evaluate(() => window.scrollBy(0, 4000));
      await 쉬기(2500);
    }
    const 글 = await page.evaluate(() => document.body.innerText);
    const 카드 = 글.split(/라이브러리 ID:|Library ID:/).slice(1).map((c) => c.slice(0, 1200));
    if (!카드.length) {
      결과.검색.push({ 검색어: q, 카드: [] });
      결과.상태[q] = /로그인|log in/i.test(글.slice(0, 3000)) ? '막힘: 로그인 화면' : '0장';
      continue;
    }
    결과.검색.push({ 검색어: q, 카드 });
    결과.상태[q] = '됨';
  } catch (e) {
    결과.상태[q] = '못 읽음: ' + String(e && e.message ? e.message : e).slice(0, 200);
  }
  await fs.writeFile(J.out, JSON.stringify(결과)); // 검색어마다 바로 — 끊겨도 받은 만큼은 남는다
}

await fs.writeFile(J.out, JSON.stringify(결과));
await task.finish({ keep: [] });
console.log(JSON.stringify({ 끝: true, 상태: 결과.상태 }));
