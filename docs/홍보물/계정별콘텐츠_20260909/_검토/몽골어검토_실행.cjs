'use strict';
// 이 콘텐츠의 공개용 원고만 공식 Antigravity 구독 CLI로 검토한다.
// 제품/API/학생 데이터/예약/원본 수정에는 연결하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const workRoot = path.resolve(__dirname, '../../../..');
const manuscript = path.resolve(__dirname, '../콘텐츠원고.json');
const raw = fs.readFileSync(manuscript, 'utf8');
const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
const expectedHash = process.argv[3];
if (!expectedHash || sha256 !== expectedHash.toLowerCase()) throw new Error('동결 원고 해시 불일치');
const mode = process.argv[2];
if (!['prepare', 'natural', 'meaning'].includes(mode)) throw new Error('prepare/natural/meaning 중 하나 필요');
const input = JSON.parse(raw);
const cyrillic = /\p{Script=Cyrillic}/u;
const records = [];
function collect(value, jsonPath, itemId) {
  if (typeof value === 'string') {
    if (cyrillic.test(value)) records.push({path: jsonPath, itemId, text: value});
  } else if (Array.isArray(value)) {
    value.forEach((entry, index) => collect(entry, `${jsonPath}[${index}]`, itemId));
  } else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) collect(entry, `${jsonPath}.${key}`, itemId);
  }
}
input.items.forEach((item, index) => {
  for (const key of ['title', 'subtitle', 'caption', 'alt', 'cards', 'scenes']) {
    collect(item[key], `items[${index}].${key}`, item.id);
  }
});
const info = {sha256, inputFile: '콘텐츠원고.json', preparedAt: new Date().toISOString(), itemCount: input.items.length, mongolianItemIds: [...new Set(records.map(record => record.itemId))], fieldCount: records.length};
fs.writeFileSync(path.join(__dirname, '몽골어_검토입력.json'), JSON.stringify({info, records}, null, 2) + '\n');
console.log(JSON.stringify(info));
if (mode === 'prepare') process.exit(0);
const shared = `이것은 한국어 학습/문화 브랜드의 새 공개용 원고다. 실제 학생의 개인정보나 기록은 없다. 파일/웹/도구를 사용하지 말고 아래 제공한 원고만 검토하라. 이 작업은 검토만이며 파일 수정이나 게시를 하지 않는다. 이미 생성한 문장을 무조건 더 세련되게 고치지 말고 구체적 문제가 있는 곳만 제안한다. 학생의 생각은 10대 후반 수준이며, 존중하되 유아적인 말투/국적별 성격 단정/불안이나 공개참여 강요를 피한다. 짧은 제목·라벨·문장 조각은 완전한 문장일 필요가 없다. 한글은 가르치는 한국어이므로 몽골어로만 고치지 않는다. 브랜드/계정/숫자/빈칸/한국어/기간/공개여부/권리/자료 받는 방법을 임의 변경하지 않는다. 인간 원어민 감수라고 주장하지 않는다.
정확한 JSON만 반환: {"reviewedPaths":[입력의 모든 path],"issues":[{"path":"실제 입력 path","before":"원문에서 정확히 일치하는 짧은 문제 구절","after":"그 구절을 치환할 몽골어 제안","reasonKo":"뜻/문법/어감의 구체적 문제와 고친 이유","severity":"major|minor","category":"grammar|naturalness|meaning|role|claim|context"}],"limits":["이번 검사로 확인하지 않은 것"]}. before/after는 수정 필요한 부분만 최소로, path는 정확히 일치시켜라. 같은 구절이 카드/영상/캡션에 반복되면 고칠 모든 path를 각각 반환하라. 문제 없으면 issues=[]로 두고 빈 after로 문제를 만들어내지 마라. 모든 ${records.length}개 path를 reviewedPaths에 빠짐없이 넣어라.`;
let prompt;
if (mode === 'natural') {
  const masked = records.map(record => ({path: record.path, itemId: record.itemId, text: record.text.replace(/[\p{Script=Hangul}]+/gu, '[K]')}));
  prompt = `${shared}\n관점: 몽골어만 보고 문법·철자·자연스러운 문장·연령에 맞는 말투를 판단하라. 한국어 원문/한국어 기획은 제공하지 않으며 [K]는 한국어 학습 표현이므로 복원하거나 그 자체를 오류로 세지 마라. 몽골어 자체의 자연스러움이 핵심이다. 뜻이 분명하고 자연스러운 의역은 유지한다.\n자료:\n${JSON.stringify(masked)}`;
} else {
  const context = input.items.filter(item => records.some(record => record.itemId === item.id)).map(item => ({id: item.id, targetKo: item.target, benefitKo: item.benefit, publicTitle: item.title, cards: item.cards, scenes: item.scenes}));
  prompt = `${shared}\n관점: 한국어 학습 문장과 몽골어 풀이, 장면과 발화 방향, 사람의 역할, 실제 받는 자료/기간/권리/공개 여부가 서로 같은 행동을 뜻하는지 대조하라. 이 문구들은 한국어 직역이 아닌 직접 집필이므로 어순/동의어/표현 차이만으로 오역이라 하지 마라. 약속(appointment)와 단순 계획, 자원 역할과 강요, 초대와 명령, 자료를 보내는 방향을 주의해서 보라. 한국어 원문이 없는 광고 문장은 targetKo/benefitKo와 같은 상황을 전달하는지 확인하되 한국어 뜻을 새로 지어 맞추지 마라. 01은 채널을 위해 새로 만든 30초 감상물이고 방송 발췌/현재 라이브/실제 시설이 아니다. 실제 데이터/교사/성과/판매 중 서비스가 있다는 주장을 새로 만들지 않는다.\n문구:\n${JSON.stringify(records)}\n공개 장면 및 한국어 학습 맥락:\n${JSON.stringify(context)}`;
}
fs.writeFileSync(path.join(__dirname, `몽골어_${mode}_프롬프트.txt`), prompt);
const args = ['--add-dir', workRoot, '--model', 'gemini-3.1-pro-high', '--effort', 'high', '--mode', 'plan', '--disable-slash-commands', '--print-timeout', '8m', '--input-format', 'stream-json', '--output-format', 'stream-json'];
const child = spawn('C:/Users/q1212/AppData/Local/agy/bin/agy.exe', args, {cwd: workRoot, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});
let stdout = '', stderr = '';
child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
child.stdout.on('data', value => stdout += value);
child.stderr.on('data', value => stderr += value);
const startedAt = new Date().toISOString();
child.stdin.end(JSON.stringify({event: 'user', message: {content: prompt}}) + '\n');
console.log(`${mode}: 공식 구독 검토 시작, ${records.length}개 공개 문구 위치`);
child.on('error', error => {console.error(error.message); process.exitCode = 1;});
child.on('close', code => {
  fs.writeFileSync(path.join(__dirname, `몽골어_${mode}_응답.jsonl`), stdout);
  fs.writeFileSync(path.join(__dirname, `몽골어_${mode}_stderr.txt`), stderr);
  try {
    const events = stdout.trim().split(/\r?\n/).map(line => JSON.parse(line));
    const envelope = events.findLast(event => event.event === 'result')?.result;
    if (code !== 0 || !envelope || envelope.status !== 'SUCCESS') throw new Error(envelope?.error || `종료/응답 오류 ${code}`);
    const body = String(envelope.response || '').replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, '');
    const result = JSON.parse(body);
    const paths = new Set(result.reviewedPaths || []);
    if (paths.size !== records.length || records.some(record => !paths.has(record.path))) throw new Error('검토 위치 누락 또는 잘못된 경로');
    for (const issue of result.issues || []) {
      const source = records.find(record => record.path === issue.path);
      if (!source || !issue.before || !source.text.includes(issue.before)) throw new Error(`교정 원문 불일치: ${issue.path}`);
    }
    const report = {mode, model: 'gemini-3.1-pro-high', startedAt, completedAt: new Date().toISOString(), exitCode: code, input: info, result};
    fs.writeFileSync(path.join(__dirname, `몽골어_${mode}_결과.json`), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({mode, reviewed: paths.size, issueCount: result.issues.length, sha256}));
  } catch (error) {console.error(error.message); process.exitCode = 1;}
});
