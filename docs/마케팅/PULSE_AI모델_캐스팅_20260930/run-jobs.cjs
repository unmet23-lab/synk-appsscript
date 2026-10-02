// 사용: node run-jobs.cjs <작업목록.json> [동시실행수]
// 작업목록: [{ "name": "M01-hero-a", "model": "text2image_soul_v2", "prompt": "...", "args": {"aspect_ratio":"3:4"}, "images": ["raw/F01-hero.png"] }]
// 결과: jobs/<name>.json(작업 기록), raw/<name>.png(원본). 이미 받은 원본은 다시 만들지 않는다.
const fs = require('node:fs'), path = require('node:path'), { spawn } = require('node:child_process');
const here = __dirname;
const list = JSON.parse(fs.readFileSync(path.resolve(process.argv[2]), 'utf8'));
const limit = Number(process.argv[3] || 4);
const ext = (m) => (/audio|tts|speech|eleven/.test(m) ? 'mp3' : 'png');

function run(job) {
  const out = path.join(here, 'raw', `${job.name}.${job.ext || ext(job.model)}`);
  if (fs.existsSync(out)) return Promise.resolve({ name: job.name, skipped: true });
  const args = ['generate', 'create', job.model];
  if (job.prompt) args.push('--prompt', job.prompt);
  for (const img of job.images || []) args.push('--image', path.isAbsolute(img) ? img : path.join(here, img));
  for (const [k, v] of Object.entries(job.args || {})) args.push(`--${k}`, String(v));
  args.push('--wait', '--wait-timeout', '15m', '--json');
  return new Promise((resolve) => {
    const attempt = (n) => {
      const p = spawn('higgsfield', args, { shell: process.platform === 'win32' ? false : false });
      let stdout = '', stderr = '';
      p.stdout.on('data', (d) => (stdout += d));
      p.stderr.on('data', (d) => (stderr += d));
      p.on('error', (e) => resolve({ name: job.name, error: e.message }));
      p.on('close', async () => {
        fs.writeFileSync(path.join(here, 'jobs', `${job.name}.json`), stdout || stderr);
        let rec;
        try { const j = JSON.parse(stdout); rec = Array.isArray(j) ? j[0] : j; } catch { rec = null; }
        if (!rec || rec.status !== 'completed' || !rec.result_url) {
          const msg = (stderr || stdout).slice(0, 300).replace(/\s+/g, ' ');
          if (n < 3 && /503|502|504|timeout|ECONNRESET|temporar/i.test(msg)) return setTimeout(() => attempt(n + 1), 4000 * n);
          return resolve({ name: job.name, error: rec ? `status=${rec.status}` : msg });
        }
        try {
          const r = await fetch(rec.result_url);
          if (!r.ok) throw Error(`download ${r.status}`);
          fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
          resolve({ name: job.name, ok: true, bytes: fs.statSync(out).size });
        } catch (e) { resolve({ name: job.name, error: e.message }); }
      });
    };
    attempt(1);
  });
}

(async () => {
  fs.mkdirSync(path.join(here, 'raw'), { recursive: true });
  fs.mkdirSync(path.join(here, 'jobs'), { recursive: true });
  const queue = [...list], results = [];
  await Promise.all(Array.from({ length: limit }, async () => {
    while (queue.length) { const j = queue.shift(); const r = await run(j); results.push(r); console.log(JSON.stringify(r)); }
  }));
  const failed = results.filter((r) => r.error);
  console.log(`done ${results.length - failed.length}/${results.length}`);
  if (failed.length) process.exitCode = 1;
})();
