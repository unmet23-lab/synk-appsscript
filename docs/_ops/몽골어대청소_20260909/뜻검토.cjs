'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const batch = Number(process.argv[2] || 1);
const parallel = process.argv[3] === 'parallel';
const suffix = parallel ? `병렬-${batch}` : String(batch);
const inventory = JSON.parse(fs.readFileSync(path.join(__dirname, '조각과문맥.json'), 'utf8'));
const pairs = JSON.parse(fs.readFileSync(path.join(__dirname, '한국어짝.json'), 'utf8')).filter(row => row.koreanRows.length);
const selected = parallel ? JSON.parse(fs.readFileSync(path.join(__dirname, '병렬한국어짝.json'), 'utf8')).slice((batch - 1) * 175, batch * 175) : pairs.slice((batch - 1) * 175, batch * 175).map(row => {
  const item = inventory.find(item => item.id === row.id);
  return {id: item.id, mn: item.text, sourceLine: item.locations[0].line, field: item.locations[0].line >= 4753 && item.locations[0].line <= 4966 ? '숙제 검사포인트/학생 팁(E열)' : '콘텐츠 본문(숙제/퀴즈는D열, 뇌과학팁은C열)', koreanRows: row.koreanRows.map(row => row.source)};
});
if (!selected.length) throw new Error('빈 묶음');
const prompt = `한국어학원 앱의 한국어 콘텐츠와 몽골어를 서로 대조하는 독립 편집자입니다. 파일/도구/인터넷 없이 아래 공개 문안만 검사하세요. 한국어와 몽골어의 어순/직역/동의어/어감 차이는 지적하지 않습니다. 사용자는 약간의 의역보다 몽골어 자연스러움을 선호합니다. 단, 학습할 한국어 표현의 뜻·누가 무엇을 할지·필수/선택·숫자·시간·횟수·긍정/부정·자료받는 방법은 유지되어야 합니다.
각 항목의 field를 보고 한국어 배열행의 정확한 칸과 대조하세요. 숙제 배열 [ID,'homework',종류,본문,팁,요일코드]입니다. 팁과 본문을 서로 오인하지 않습니다. ko 필드가 있으면 그것이 구문 트리에서 같은 배열 위치/객체 키로 정확히 뽑은 한국어 원문입니다. 퀴즈의 일부러 틀린 한국어 예문은 교정하지 않습니다. 몽골어 문자순서만 의역되어도 괜찮습니다. 문맥이 불충분하면 issue에서 needs_context로 표시합니다. 몽골어 문법 검수는 다른 단계이므로 여기서는 학생의 행동/믿음이 실제 달라질 명백한 의미 차이에 집중합니다.
JSON만 답하세요. 출력 {"checkedIds":[모든 id],"issues":[{"id":"...","severity":"meaning|needs_context","reasonKo":"정확히 바뀐 사실/행동","sourceMeaningKo":"한국어가 요구하는것","mnMeaningKo":"몽골어가 실제 뜻하는것","suggestedMn":"명백한 교정이 가능할 때만, 숫자·한국어예문·자리표시자는 보존"}]}.
문제가 없으면 issues는 빈 배열입니다. 모든 ${selected.length}개를 읽고 checkedIds에 빠짐없이 적으세요.\n자료:\n${JSON.stringify(selected)}`;
const child = spawn('C:/Users/q1212/.local/bin/claude.exe', ['-p', '--output-format', 'json', '--model', 'opus', '--effort', 'high', '--tools', '', '--disable-slash-commands'], {cwd: root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});
let stdout = '', stderr = '';
child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
child.stdout.on('data', value => stdout += value);
child.stderr.on('data', value => stderr += value);
child.stdin.end(prompt);
console.log(`meaning ${suffix}: ${selected.length} entries started`);
child.on('error', error => {console.error(error.message); process.exitCode = 1;});
child.on('close', code => {
  fs.writeFileSync(path.join(__dirname, `뜻응답-${suffix}.json`), stdout);
  fs.writeFileSync(path.join(__dirname, `뜻응답-${suffix}.stderr.txt`), stderr);
  try {
    const envelope = JSON.parse(stdout);
    if (envelope.is_error || code !== 0) throw new Error('호출 실패');
    const result = JSON.parse(envelope.result.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, ''));
    const ids = new Set(result.checkedIds);
    if (ids.size !== selected.length || selected.some(row => !ids.has(row.id))) throw new Error('누락된 검토');
    fs.writeFileSync(path.join(__dirname, `뜻결과-${suffix}.json`), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({batch: suffix, checked: ids.size, issues: result.issues.length}));
  } catch (error) {console.error(error.message); process.exitCode = 1;}
});
