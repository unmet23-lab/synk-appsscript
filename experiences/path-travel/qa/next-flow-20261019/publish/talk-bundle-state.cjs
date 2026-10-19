// 읽기 전용: 운영·리허설 synk-personal 본문에 v48 묶음과 후보 묶음 중 어느 것이 들어 있는지 본다(토큰·REF 값은 찍지 않는다).
const fs = require('fs');
const path = require('path');
const talk = 'C:/Users/q1212/Documents/SYNK-talk';
const env = Object.fromEntries(fs.readFileSync(path.join(talk, '.env'), 'utf8').split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const { 운영REF, 리허설REF } = require(path.join(talk, 'lib/자격증명'));
const get = async (url, binary) => { const r = await fetch(url, { headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` } }); if (!r.ok) throw new Error(String(r.status)); return binary ? Buffer.from(await r.arrayBuffer()) : r.json(); };
const v48 = fs.readFileSync(path.join(__dirname, 'v48-bundle.js')), candidate = fs.readFileSync(path.join(__dirname, 'synk-personal-runtime.candidate.js'));
const which = (process.argv[2] || '운영,리허설').split(',');
(async () => {
  for (const [name, ref] of [['운영', 운영REF], ['리허설', 리허설REF]].filter(([n]) => which.includes(n))) {
    const meta = await get(`https://api.supabase.com/v1/projects/${ref}/functions/synk-personal`);
    const body = await get(`https://api.supabase.com/v1/projects/${ref}/functions/synk-personal/body`, true);
    console.log(name, '판', meta.version, meta.status, '갱신', new Date(meta.updated_at).toISOString(), '본문', body.length + 'B', '· v48 묶음', body.indexOf(v48) >= 0, '· 후보 묶음', body.indexOf(candidate) >= 0);
  }
})().catch(e => { console.error('실패', e.message); process.exit(1); });
