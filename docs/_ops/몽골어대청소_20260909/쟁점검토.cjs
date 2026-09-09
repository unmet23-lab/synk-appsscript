'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const targets = new Set(['0024','0050','0104','0232','0390','0544','0691']);
const input = JSON.parse(fs.readFileSync(path.join(__dirname, '교정확정.json'), 'utf8')).filter(row => targets.has(row.id));
const data = input.map(row => ({id: row.id, text: row.finalText, ko: row.koreanRows.map(row => row.source).concat(row.parallelKorean.map(row => row.ko)), context: row.locations.map(row => row.context)}));
const prompt = `몽골어 최종 쟁점 7개만 독립 판정하세요. 파일/검색/도구 없이 아래 자료만 읽습니다. 대상은 text 새 문구이고 context의 옛 몽골어는 변수 조합 문맥만 제공합니다. 이름 변수나 한국어 예문/숫자/필수선택 조건을 바꾸지 마세요. 각 새 몽골어의 자연스러움과 정확한 한국어 뜻을 읽고 accept/revise/uncertain을 판정합니다.
확인된 기준: 0390의 실제 세계관은 docs/캐릭터/가이드_정본.md §0 '한 학생에게 가이드는 하나다'이므로 몬스터 대신 Хөтөч로 맞췄습니다. 0544의 파도 철자는 몽골 국가 언어정책위원회 toli.gov.mn/w/P8IPaPPQwBcADxzj 표제어 давлагаа, 속격 давлагааны가 실측 정본입니다. 오래된 давалгаа로 되돌리지 마세요. 0232는 다른 검토자가 -сэн 뒤 모음이 무조건 탈락한다고 주장했지만, 국가 규칙 toli.gov.mn/r §18은 заримдаг+заримдаг 두 번째 자음의 모음을 요구하고 §30은 그 규칙을 위반하며 모음을 탈락시키지 말라고 합니다. бичснийг에서는 ч와 с 다음의 с 앞뒤에 모음이 없어집니다. 첫 몽골어 평가와 spellcheck.mn 모두 бичсэнийг를 제시했습니다. 이 구체 규칙을 적용하여 판단하세요. 0024의 '앞의 이름 + сурагчдаа'가 합쳐진 생일 축하 문장, 0691의 긴 문장 두 개로 나누기(끊어 읽기 아님)를 특히 확인합니다.
JSON만: {"reviews":[{"id":"...","decision":"accept|revise|uncertain","reasonKo":"구체 근거","newText":"revise일 때 완전한 새 문구"}]} 7개 모두 답하세요.\n자료:\n${JSON.stringify(data)}`;
const args = ['--add-dir', root, '--model', 'gemini-3.1-pro-high', '--mode', 'plan', '--disable-slash-commands', '--print-timeout', '12m', '--input-format', 'stream-json', '--output-format', 'stream-json'];
const child = spawn('C:/Users/q1212/AppData/Local/agy/bin/agy.exe', args, {cwd: root, windowsHide: true, stdio: ['pipe','pipe','pipe']});
let stdout = '', stderr = '';
child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
child.stdout.on('data', value => stdout += value); child.stderr.on('data', value => stderr += value);
child.stdin.end(JSON.stringify({event:'user',message:{content:prompt}}) + '\n');
console.log('쟁점 7개 검토 시작');
child.on('error', error => {console.error(error.message); process.exitCode=1;});
child.on('close', code => {
  fs.writeFileSync(path.join(__dirname, '쟁점응답.json'), stdout);
  fs.writeFileSync(path.join(__dirname, '쟁점응답.stderr.txt'), stderr);
  try {
    const envelope = stdout.trim().split(/\r?\n/).map(line => JSON.parse(line)).findLast(row => row.event === 'result')?.result;
    if (code !== 0 || envelope?.status !== 'SUCCESS') throw new Error('호출 실패');
    const result = JSON.parse(envelope.response.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, ''));
    if (result.reviews.length !== 7 || new Set(result.reviews.map(row => row.id)).size !== 7 || result.reviews.some(row => !targets.has(row.id))) throw new Error('불완전 응답');
    fs.writeFileSync(path.join(__dirname, '쟁점결과.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
  } catch(error) {console.error(error.message); process.exitCode=1;}
});
