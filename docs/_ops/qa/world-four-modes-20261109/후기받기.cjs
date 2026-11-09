// App Store 공개 후기 RSS(앱당 최신순 최대 500건, 미국 스토어). 개인 정보 없이 앱 번호만 넘긴다.
const fs = require('node:fs'), path = require('node:path');
const OUT = process.argv[2]; if (!OUT) throw Error('저장소 밖 폴더를 첫 인자로 주세요'); fs.mkdirSync(OUT, {recursive: true});
const apps = {Duolingo: 570060128, Babbel: 829587759, Busuu: 379968583, Memrise: 635966718, Speak: 1286609883, ELSA: 1083804886, Mondly: 987873536, LingoDeer: 1261193709, Drops: 939540371};
(async () => {
  for (const [name, id] of Object.entries(apps)) {
    const rows = [];
    for (let page = 1; page <= 10; page++) {
      try {
        const r = await fetch(`https://itunes.apple.com/us/rss/customerreviews/page=${page}/id=${id}/sortby=mostrecent/json`, {headers: {'User-Agent': 'review-reader/1.0'}});
        if (!r.ok) break;
        const j = await r.json(), e = j.feed?.entry || [];
        if (!e.length) break;
        for (const x of e) { if (!x['im:rating']) continue; rows.push({rating: +x['im:rating'].label, title: x.title?.label || '', text: x.content?.label || '', updated: x.updated?.label || ''}); }
      } catch (err) { console.log(name, 'page', page, err.message); break; }
    }
    fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(rows));
    const dates = rows.map(r => r.updated).sort();
    console.log(name, rows.length, '건', dates[0]?.slice(0, 10), '~', dates.at(-1)?.slice(0, 10), '평균', (rows.reduce((a, b) => a + b.rating, 0) / (rows.length || 1)).toFixed(2));
  }
})();
