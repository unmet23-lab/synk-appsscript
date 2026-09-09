'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const load = file => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
const inventory = load('조각과문맥.json');
const korean = new Map(load('한국어짝.json').map(row => [row.id, row.koreanRows]));
const source = fs.readFileSync(path.join(root, '엔진_콘텐츠AI.js'), 'utf8');
const current = new Set([...require('../../../tools/몽골어출구.js').모으기().values()].map(row => row.글));
const data = inventory.filter(row => current.has(row.text) && /сурах бичг/i.test(row.text)).map(row => ({id: row.id, mn: row.text, ko: korean.get(row.id).map(row => row.source), context: row.locations.map(row => row.context)}));
fs.writeFileSync(path.join(__dirname, '출처정밀입력.json'), JSON.stringify(data, null, 2) + '\n');
const prompt = `한국어학원 몽골어 숙제 번역의 누락 교정입니다. 이전 전체 대조가 '교재'와 '오늘 읽은 글/배운 문장'의 다른 자료 출처를 동의어로 보아 놓쳤습니다. 이제 최신 한국어 원문 ko가 정확한 과제 조건입니다. mn에 남은 교재(сурах бичиг)를 원문과 대조해 원문이 요구하는 자료로 정확히 고치세요. '오늘 읽은 글'은 өнөөдөр уншсан эх бичвэр, '오늘 배운 문장'은 өнөөдөр сурсан өгүүлбэр로 자연스러운 격어미를 붙입니다. 원문이 진짜 교재를 요구하면 유지하고 valid로 둡니다. 숫자/시간/횟수/과제행동/한국어 학습 예문은 보존하고 다른 불필요한 문체 변경은 하지 않습니다. 28개라는 추측이 아니라 아래 자료의 모든 ${data.length}개 실제 ID 각각을 읽습니다. 파일/도구/검색 없이 아래 자료만 읽습니다. JSON만: {"reviews":[{"id":"...","decision":"valid|correct","reasonKo":"한국어 출처와 현재 몽골어 차이","newText":"correct일 때 완전한 새 몽골어"}]}\n자료:\n${JSON.stringify(data)}`;
const child = spawn('C:/Users/q1212/AppData/Local/agy/bin/agy.exe', ['--add-dir',root,'--model','gemini-3.1-pro-high','--mode','plan','--disable-slash-commands','--print-timeout','12m','--input-format','stream-json','--output-format','stream-json'], {cwd: root, windowsHide: true, stdio: ['pipe','pipe','pipe']});
let stdout = '', stderr = '';
child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
child.stdout.on('data', value => stdout += value); child.stderr.on('data', value => stderr += value);
child.stdin.end(JSON.stringify({event:'user',message:{content:prompt}}) + '\n');
console.log(`출처 ${data.length}개 시작`);
child.on('error', error => {console.error(error.message); process.exitCode=1;});
child.on('close', code => {
  fs.writeFileSync(path.join(__dirname, '출처정밀응답.json'), stdout);
  fs.writeFileSync(path.join(__dirname, '출처정밀응답.stderr.txt'), stderr);
  try {
    const envelope = stdout.trim().split(/\r?\n/).map(line=>JSON.parse(line)).findLast(row=>row.event==='result')?.result;
    if (code !== 0 || envelope?.status !== 'SUCCESS') throw new Error('공식 호출 실패');
    const result = JSON.parse(envelope.response.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, ''));
    if (result.reviews.length !== data.length || new Set(result.reviews.map(row=>row.id)).size !== data.length || data.some(row=>!result.reviews.some(verdict=>verdict.id===row.id))) throw new Error('누락된 ID');
    fs.writeFileSync(path.join(__dirname, '출처정밀결과.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
  } catch(error) {console.error(error.message); process.exitCode=1;}
});
