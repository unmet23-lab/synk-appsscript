'use strict';
// 이번 대청소 자료의 공식 Antigravity 구독 검토. 제품/API/예약에는 연결하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const batch = String(Number(process.argv[2] || 1)).padStart(2, '0');
const input = JSON.parse(fs.readFileSync(path.join(__dirname, `검토묶음-${batch}.json`), 'utf8'));
const data = input.map(({id, text, locations}) => ({id, text, locations}));
const prompt = `당신은 몽골 10대 후반~성인이 읽는 한국어학원 앱의 몽골어 편집자입니다. 다음 코드에서 실제로 조합되어 화면/알림에 나타나는 문맥을 이해하여 각 몽골어 문자열을 검토하세요. 이전 기계판정은 주지 않습니다.
중요: 한국어가 초급인 성인/청소년이지 유아가 아닙니다. 짧고 자연스러운 몽골어를 우선하며 한국어 직역 어순을 강제하지 마세요. 학생을 비웃거나 경쟁/불안으로 몰지 않습니다. 어휘만 무조건 순화하여 사실을 숨기지 마세요. 자연스러운 원문은 그대로 둡니다.
이것들은 문자열 조각입니다. 앞뒤의 변수, 문자열, HTML과 합쳐지는 조각은 그 완성문으로 판단합니다. 제목/버튼/명사 라벨/일부러 가르치는 오답은 완전한 문장이 아니어도 정상입니다. 한국어 혼재 자체는 오타가 아닙니다. 문맥이 부족하면 uncertain으로 남기고 추측 수정하지 않습니다.
각 항목은 valid(자연스럽고 뜻 맞음), fragment_ok(조합/라벨이므로 이전 단문 검사가 오탐일 수 있음), correct(실제 교정 필요), uncertain(뜻/업무맥락 부족) 중 하나. correct면 해당 text를 치환할 newText를 정확히 반환합니다. 한국어 문자/숫자/사실/금액/날짜/조건/이름/브랜드/변수/자리표시자/HTML/이스케이프/열고닫는 괄호 구조는 유지하세요. 실제 사업약속/사용 흐름을 새로 만들지 마세요. 조각 경계에 필요한 공백을 보존하세요. 몽골어 조사/구문 자연스러움만 고칩니다. 사전상 유효하지만 뜻이 다른 몽골어 단어를 경계하세요.
도구, 파일 읽기/쓰기, 인터넷 검색은 하지 마세요. 아래 공개 코드 문안만으로 검토하세요. JSON만 반환하세요. 모든 ${data.length}개 id에 한 항목씩 답하고 누락/합침 금지.
응답 구조: {"reviews":[{"id":"0001","status":"valid|fragment_ok|correct|uncertain","reasonKo":"구체 근거 한 문장", "newText":"correct일 때만", "intendedKo":"correct/uncertain일 때 문맥에서 읽은 의도", "newMeaningKo":"correct일 때 수정문 뜻"}]}.
\n자료:\n${JSON.stringify(data)}`;
const args = ['--add-dir', root, '--model', 'gemini-3.1-pro-high', '--mode', 'plan', '--disable-slash-commands', '--print-timeout', '12m', '--input-format', 'stream-json', '--output-format', 'stream-json'];
const child = spawn('C:/Users/q1212/AppData/Local/agy/bin/agy.exe', args, {cwd: root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});
let stdout = '', stderr = '';
child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
child.stdout.on('data', value => stdout += value);
child.stderr.on('data', value => stderr += value);
child.stdin.end(JSON.stringify({event: 'user', message: {content: prompt}}) + '\n');
console.log(`batch ${batch}: ${data.length} entries started`);
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('close', code => {
  fs.writeFileSync(path.join(__dirname, `구독응답-${batch}.json`), stdout);
  fs.writeFileSync(path.join(__dirname, `구독응답-${batch}.stderr.txt`), stderr);
  let result;
  try {
    const events = stdout.trim().split(/\r?\n/).map(line => JSON.parse(line));
    const envelope = events.findLast(event => event.event === 'result')?.result;
    if (!envelope || envelope.status !== 'SUCCESS') throw new Error(envelope?.error || '성공 결과 없음');
    const body = typeof envelope.response === 'string' ? envelope.response : '';
    const clean = body.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, '');
    result = JSON.parse(clean);
    const ids = new Set(result.reviews.map(row => row.id));
    if (code !== 0 || result.reviews.length !== data.length || ids.size !== data.length || data.some(row => !ids.has(row.id))) throw new Error('불완전 응답/종료코드');
    fs.writeFileSync(path.join(__dirname, `검토결과-${batch}.json`), JSON.stringify(result.reviews, null, 2) + '\n');
    const summary = {}; for (const row of result.reviews) summary[row.status] = (summary[row.status] || 0) + 1;
    console.log(JSON.stringify({batch, code, summary}));
  } catch (error) { console.error(`batch ${batch}: ${error.message}; raw response preserved`); process.exitCode = 1; }
});
