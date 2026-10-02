// 구글 Vertex(무료 체험 크레딧 · synk-bake-unmet27)의 Nano Banana Pro(gemini-3-pro-image)로 굽는다.
// 사용: node gen-gemini.cjs <작업목록.json> [동시실행수] --유료-api
// 작업목록: [{ "name": "F20-fresh-1", "prompt": "...", "aspect": "3:4", "images": ["raw/F20-hero-b.png"] }]
// 결과: raw/<name>.png. 이미 있으면 건너뛴다. 크레딧 벽을 만나면 남은 장은 던지지 않는다.
const fs = require('node:fs'), path = require('node:path');
const here = __dirname;
const 굽기 = require(path.join(here, '../../../tools/lib/이미지굽기.js'));
const list = JSON.parse(fs.readFileSync(path.resolve(process.argv[2]), 'utf8'));
const limit = Number(process.argv.find((a, i) => i > 2 && /^\d+$/.test(a)) || 3);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function one(job) {
  const out = path.join(here, 'raw', `${job.name}.png`);
  if (fs.existsSync(out)) return { name: job.name, skipped: true };
  const 참조 = (job.images || []).map((p) => (path.isAbsolute(p) ? p : path.join(here, p)));
  for (let n = 1; n <= 8; n++) {
    try {
      await 굽기.한컷({ 이름: job.name, 지시: job.prompt, 참조, 비율: job.aspect || '3:4', 크기: job.size || '2K', 저장경로: out });
      return { name: job.name, ok: true };
    } catch (e) {
      if (e.돈벽) return { name: job.name, error: 'credit-wall', 돈벽: true };
      // 분당 한도(429)와 일시 장애는 기다렸다 다시 던진다. 크레딧 벽은 위에서 멈춘다.
      if (n < 8 && (e.몫벽 || /\b5\d\d\b|ECONNRESET|fetch failed/i.test(e.message))) { await wait(30000 + 15000 * n); continue; }
      return { name: job.name, error: e.message.slice(0, 300) };
    }
  }
}

(async () => {
  if (!(await 굽기.배치게이트(list.length, '2K'))) process.exit(2);
  const queue = [...list], results = [];
  await Promise.all(Array.from({ length: limit }, async () => {
    while (queue.length) {
      const j = queue.shift();
      const r = await one(j);
      results.push(r);
      console.log(JSON.stringify(r));
      if (r.돈벽) queue.length = 0;
    }
  }));
  const failed = results.filter((r) => r.error);
  console.log(`done ${results.length - failed.length}/${results.length}`);
  if (failed.length) process.exitCode = 1;
})();
