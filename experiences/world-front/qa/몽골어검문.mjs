// 첫날 끝 · 맞춤 앞면 몽골어 문안 검문: 글 표를 12줄씩 묶어 tools/몽골어대조.js에 넘긴다(서울행 qa/몽골어검문.mjs와 같은 꼴).
//   node experiences/world-front/qa/몽골어검문.mjs [--부터 0] [--크기 6] [--구독]   (무료 문은 한 호출 60초라 6줄 묶음, 현장 노트 AI_CLI)   → .tmp/world-front-mn/결과.jsonl
// 대상: 틀 글 표(strings.mjs의 T.mn)와, 앞면 때문에 서울행에 더한 글 둘(seoul-arrival/strings.mjs의 「오늘 마무리하기」 · 「오늘은 여기까지」).
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
globalThis.location ??= {search: ''};
const {T} = await import('../strings.mjs');
const {TEXT_TABLES} = await import('../../seoul-arrival/strings.mjs');
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const clean = s => String(s).replace(/<br>/g, ' ').replace(/<\/?(?:b|em|i)>/g, '').replace(/\{[a-z]+\}/g, 'N').replace(/\s+/g, ' ').trim();
const rows = Object.entries(T.mn).map(([k, v]) => [clean(k), clean(v)]);
for (const k of ['오늘 마무리하기', '오늘은 여기까지']) if (TEXT_TABLES.UI.mn[k]) rows.push([k, clean(TEXT_TABLES.UI.mn[k])]);
const seen = new Set(), uniq = rows.filter(([, mn]) => { if (!/[А-Яа-яӨөҮү]/.test(mn) || seen.has(mn)) return false; seen.add(mn); return true; });
const OUT = path.join(ROOT, '.tmp', 'world-front-mn'); fs.mkdirSync(OUT, {recursive: true});
const SIZE = Number(opt('--크기', '6')), from = Number(opt('--부터', '0'));
const results = path.join(OUT, '결과.jsonl');
console.log('줄', uniq.length, '묶음', Math.ceil(uniq.length / SIZE));
for (let i = from; i * SIZE < uniq.length; i++) {
  const part = uniq.slice(i * SIZE, (i + 1) * SIZE), file = path.join(OUT, `묶음${String(i).padStart(2, '0')}.txt`);
  fs.writeFileSync(file, part.map(r => r[0]).join('\n') + '\n---\n' + part.map(r => r[1]).join('\n') + '\n');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/몽골어대조.js'), '--파일', file, ...(args.includes('--구독') ? ['--구독'] : [])], {encoding: 'utf8', env: {...process.env, SYNK_장부올리기: '나중'}, timeout: 300000});
  fs.appendFileSync(results, JSON.stringify({i, code: r.status, out: (r.stdout || '').slice(-6000), err: (r.stderr || '').slice(-800)}) + '\n');
  console.log('묶음', i, '종료', r.status);
}
