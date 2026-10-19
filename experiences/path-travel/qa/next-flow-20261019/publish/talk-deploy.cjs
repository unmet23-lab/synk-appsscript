// talk 배포 도구를 작업 폴더에서 돌린다. 자격은 공용 talk의 .env에서 읽어 환경 변수로만 넘긴다(값은 찍지 않는다).
// 사용: node talk-deploy.cjs <원격배포.js 인자…>
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const talk = 'C:/Users/q1212/Documents/SYNK-talk', wt = 'C:/Users/q1212/Documents/talk-wt-path-20261019';
const env = Object.fromEntries(fs.readFileSync(path.join(talk, '.env'), 'utf8').split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const pass = {};
for (const key of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_REF', 'SUPABASE_TOKEN_EXPIRES']) if (env[key]) pass[key] = env[key];
const run = spawnSync(process.execPath, ['tools/원격배포.js', ...process.argv.slice(2)], { cwd: wt, env: { ...process.env, ...pass }, encoding: 'utf8', maxBuffer: 1 << 26 });
const scrub = text => (text || '').split(pass.SUPABASE_ACCESS_TOKEN || '\u0000').join('<토큰>');
process.stdout.write(scrub(run.stdout)); process.stderr.write(scrub(run.stderr));
process.exit(run.status ?? 1);
