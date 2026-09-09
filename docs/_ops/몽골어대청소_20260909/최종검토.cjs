'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const candidates = JSON.parse(fs.readFileSync(path.join(__dirname, '교정후보.json'), 'utf8'));
const data = candidates.map(row => ({id: row.id, mn: row.newText, ko: row.parallelKorean.map(row => row.ko), koreanRows: row.koreanRows.map(row => row.source), context: row.locations.map(row => row.context)}));
const prompt = `몽골 10대 후반~성인이 쓰는 한국어학원 앱 문구의 최종 독립 검토입니다. 작성자의 평가/이유는 주지 않습니다. 파일/도구/검색 없이 아래 자료만 읽고, 몽골어 자연스러움과 정확한 한국어 의미를 판정하세요. 검토 대상은 mn 필드의 새 문구입니다. context의 낡은 몽골어는 앞뒤 변수/HTML 조합만 이해하기 위한 코드 문맥이며 교정대상이 아닙니다.
문장순서/동의어/어감이 한국어와 약간 달라도 몽골어가 자연스러우면 허용합니다. 숫자/횟수/시간/필수선택/예문 한국어/자료의 뜻은 유지합니다. 제목/문자열 조각은 완성문 맥락으로 봅니다. 구어체 사용자에게 불필요하게 학술적 용어를 강요하지 않습니다. 성인에게 아기말로 말하거나 과장된 행동효과를 새로 만들지 않습니다. 기존 한국어 원문의 과장/사업약속은 여기서 임의 변경하지 말고 sourceConcern으로 따로 적습니다.
주의: id0155의 옛 '시즌=교재1권' 설명은 한국어 원문에 없어 삭제했습니다. id0551 대추는 몽골국립대 식물 연구 논문의 нанжин чавга(Ziziphus jujube)라는 표기로 명확히 했습니다. id0544는 이전 한국어 대조의 checkedIds에서 빠져 이번에 반드시 해당 ko와 대조해야 합니다. 맞춤법은 өөрөө 같은 주어·өөрийгөө 같은 목적어, 조사 연결까지 실제 몽골어로 읽고 판단합니다.
응답은 JSON만: {"reviews":[{"id":"...","decision":"accept|revise|uncertain","reasonKo":"구체 근거","newText":"revise일 때 완전한 수정문"}],"sourceConcerns":[]} 모든 ${data.length}개 id에 빠짐없이 답하세요.\n자료:\n${JSON.stringify(data)}`;
const child = spawn('C:/Users/q1212/.local/bin/claude.exe', ['-p', '--output-format', 'json', '--model', 'opus', '--effort', 'high', '--tools', '', '--disable-slash-commands'], {cwd: root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});
let stdout = '', stderr = '';
child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
child.stdout.on('data', value => stdout += value); child.stderr.on('data', value => stderr += value);
child.stdin.end(prompt); console.log(`final: ${data.length} entries started`);
child.on('error', error => {console.error(error.message); process.exitCode = 1;});
child.on('close', code => {
  fs.writeFileSync(path.join(__dirname, '최종응답.json'), stdout);
  fs.writeFileSync(path.join(__dirname, '최종응답.stderr.txt'), stderr);
  try {
    const envelope = JSON.parse(stdout);
    if (envelope.is_error || code !== 0) throw new Error('호출 실패');
    const result = JSON.parse(envelope.result.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, ''));
    const ids = new Set(result.reviews.map(row => row.id));
    if (ids.size !== data.length || data.some(row => !ids.has(row.id))) throw new Error('누락된 검토');
    fs.writeFileSync(path.join(__dirname, '최종결과.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({checked: ids.size, decisions: result.reviews.reduce((out,row) => (out[row.decision] = (out[row.decision] || 0) + 1, out), {}), sourceConcerns: result.sourceConcerns}));
  } catch (error) {console.error(error.message); process.exitCode = 1;}
});
