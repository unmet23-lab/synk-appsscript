// Public static assets only. Never reads a save, state API or command endpoint.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const town = path.resolve(__dirname, '../..');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
(async () => {
  const prior = JSON.parse(fs.readFileSync(path.join(town, 'qa/graphics-v7/served-local.json'), 'utf8'));
  const files = prior.sources.map(({name, route}) => ({name, route}));
  for (const name of ['control-neutral', 'control-lapis', 'control-butter']) files.push({name:`assets/ui/${name}.webp`,route:`/assets/ui/${name}.webp`});
  for (const name of ['cafe-owner', 'workshop-owner', 'researcher', 'visitor-tea-reader', 'book-guest', 'companion']) files.push({name:`assets/residents/${name}.png`,route:`/assets/residents/${name}.png`});
  const sources = await Promise.all(files.map(async row => {
    const response = await fetch(`http://127.0.0.1:4288${row.route}`, {cache:'no-store'});
    const bytes = Buffer.from(await response.arrayBuffer()), diskSha256 = hash(fs.readFileSync(path.join(town, row.name))), servedSha256 = hash(bytes);
    return {...row,status:response.status,diskSha256,servedSha256,matches:response.status===200&&diskSha256===servedSha256};
  }));
  const report = {checkedAt:new Date().toISOString(),scope:'Existing4288 public static GET only; no API, user save, commands or server restart',sources,passed:sources.every(r=>r.matches)};
  fs.writeFileSync(path.join(__dirname,'served-local.json'),JSON.stringify(report,null,2));
  console.log(`Static source matches ${sources.filter(r=>r.matches).length}/${sources.length}`);
  if(!report.passed)process.exitCode=1;
})().catch(error => {console.error(error);process.exitCode=1;});
