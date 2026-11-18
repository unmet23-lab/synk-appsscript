'use strict';
// 카본 판 심사(tools/카본판심사.js, 11-16 시험 도입) — 관문 판을 넷씩 묶고 끝 판을 붙이는 꼴, 컷표 요약, 지시문이 아르곤웹 점검을
// 넘는지, 미리보기가 보내지 않고 작업 파일만 만드는지 본다. 실제 보내기는 공용 차례 · Gemini가 있어야 해서 PC에서 실제 편으로 확인한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 뿌리 = path.join(__dirname, '..');
const 판심사 = require('../tools/카본판심사.js');
const 웹 = require('../tools/아르곤웹.js');

const 컷표 = {
  편: { 이름: '시험 편', 비율: '9:16', 길이: 20 },
  이기는것: '여운 — 시험',
  한문장: '시험 한 문장',
  인물: { 수아: { 묘사: 'A felt doll.', 옷: 'A red coat.', 설정: { 반복장치: '빨간 우산' } } },
  소품: { 우산: { 생김새: 'A red umbrella.' } },
  장면: { 밤: { 시간대: '밤', 빛: 'Blue hour.' } },
  detail: Array.from({ length: 19 }, (_, i) => ({ cut: `C${i + 1}`, t: i * 2.5, dur: 2.5, 장면: '밤', 인물: i % 2 ? ['수아'] : [], 소품: { 우산: i % 3 ? '화면밖' : '보임' }, line: `컷 ${i + 1} 내용` })),
};

test('컷표 요약 — 컷마다 시각 · 장면 · 인물 · 보이는 소품 · 내용을 한 줄로, 머리에 인물 · 소품 · 장면을 싣는다', () => {
  const 글 = 판심사.컷표요약(컷표);
  assert.match(글, /^컷표 요약/);
  assert.match(글, /- 수아: A felt doll\. A red coat\. · 되풀이 장치: 빨간 우산/);
  assert.match(글, /- 우산: A red umbrella\./);
  assert.match(글, /- 밤: 밤 — Blue hour\./);
  assert.match(글, /^C1 · 0:00\.0~0:02\.5 · 장면 밤 · 인물 없음 · 보이는 소품 우산 · 내용: 컷 1 내용$/m);
  assert.match(글, /^C2 · 0:02\.5~0:05\.0 · 장면 밤 · 인물 수아 · 보이는 소품 없음 · 내용: 컷 2 내용$/m);
  assert.equal(글.split('\n').filter((l) => /^C\d+ · /.test(l)).length, 19);
});

test('묶기 — 전체 판을 넷씩, 끝 판은 자리가 있으면 마지막 묶음에, 없으면 따로(한 대화 그림 4장)', () => {
  const 컷들 = Array.from({ length: 53 }, (_, i) => `K${i + 1}`);
  const 일곱 = 판심사.묶기(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'], '끝', 컷들);
  assert.deepEqual(일곱.map((b) => b.그림), [['p1', 'p2', 'p3', 'p4'], ['p5', 'p6', 'p7', '끝']], '11-16 시험의 대화 A · B 꼴');
  assert.deepEqual([일곱[0].컷[0], 일곱[0].컷.at(-1), 일곱[1].컷[0], 일곱[1].컷.at(-1)], ['K1', 'K32', 'K33', 'K53']);
  const 넷 = 판심사.묶기(['p1', 'p2', 'p3', 'p4'], '끝', 컷들.slice(0, 30));
  assert.deepEqual(넷.map((b) => b.그림), [['p1', 'p2', 'p3', 'p4'], ['끝']]);
  assert.deepEqual(넷[1].컷, []);
  const 끝없음 = 판심사.묶기(['p1', 'p2'], '', 컷들.slice(0, 12));
  assert.deepEqual(끝없음.map((b) => b.그림), [['p1', 'p2']]);
  for (const b of 일곱) assert.ok(b.그림.length <= 웹.그림한도);
});

test('지시문 — 네 물음과 답 꼴을 싣고, 한 줄이며, 아르곤웹 점검(길이 · 낱말)을 넘는다', () => {
  const 묶음들 = 판심사.묶기(['p1', 'p2', 'p3', 'p4', 'p5'], '끝', 컷표.detail.map((d) => d.cut).concat(Array.from({ length: 21 }, (_, i) => `D${i}`)));
  for (const b of 묶음들) {
    const 글 = 판심사.지시문(b, 묶음들.length, '시험 편 · 9:16 · 20초');
    assert.ok(!/\n/.test(글), '빈 줄 · 줄바꿈이 있으면 보내기 전 확인이 멈춘다');
    for (const 낱말 of ['① 자막과 그림이 맞는가', '② 붙은 컷 사이가 이어지는가', '③ 주인공과 헷갈리는', '④ 컷표요약과 그림이 다른 곳', '등급(P1']) assert.ok(글.includes(낱말), 낱말);
    const r = 웹.점검한편({ id: `묶음${b.번호}`, prompt: 글 });
    assert.deepEqual(r.걸림, [], JSON.stringify(r.걸림));
  }
  assert.match(판심사.지시문(묶음들[0], 2, 'x'), /컷은 C1부터 /);
  assert.match(판심사.지시문(묶음들[1], 2, 'x'), /끝 판입니다/);
});

test('미리보기 — 판목록의 전체 판 · 끝 판으로 작업 파일을 만들고 보내지 않는다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '카본판심사-'));
  const 편 = path.join(dir, '편');
  const 판 = path.join(dir, '판');
  fs.mkdirSync(편); fs.mkdirSync(판);
  fs.writeFileSync(path.join(편, '컷표.json'), JSON.stringify(컷표));
  const 그림 = (n) => { const f = path.join(판, n); fs.writeFileSync(f, Buffer.from([0xff, 0xd8, 0xff, 0xd9])); return f; };
  const 전체 = [그림('전체_1.jpg'), 그림('전체_2.jpg'), 그림('전체_3.jpg')];
  const 끝 = 그림('끝.jpg');
  fs.writeFileSync(path.join(판, '판목록.json'), JSON.stringify({ 컷: 컷표.detail.map((d) => ({ cut: d.cut })), 판: { 전체, 끝 } }));
  const 출력 = path.join(dir, '출력');
  const r = spawnSync(process.execPath, [path.join(뿌리, 'tools', '카본판심사.js'), 편, '--판', 판, '--출력', 출력, '--미리보기'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /대화 1개\(4장\)/);
  const 작업 = JSON.parse(fs.readFileSync(path.join(출력, '카본', '작업_1.json'), 'utf8'));
  assert.deepEqual(작업.files.map((f) => path.basename(f)), ['전체_1.jpg', '전체_2.jpg', '전체_3.jpg', '끝.jpg', '컷표요약.txt']);
  assert.ok(!fs.existsSync(작업.out), '미리보기는 답을 만들지 않는다');
  assert.ok(!fs.existsSync(`${작업.out}.보냄.json`), '미리보기는 보내지 않는다');
  assert.match(fs.readFileSync(작업.promptFile, 'utf8'), /「시험 편 · 9:16 · 20초」/);
  assert.deepEqual(웹.작업문제(웹.작업읽기(path.join(출력, '카본', '작업_1.json'))), []);
});

test('인자 — --최종이나 --판이 없으면 1, 모르는 선택은 1', () => {
  const r = spawnSync(process.execPath, [path.join(뿌리, 'tools', '카본판심사.js'), 뿌리], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.throws(() => 판심사.인자읽기(['x', '--모름']), /모르는 선택/);
});

test('공유 미리보기는 확인한 마감 자료만 보관하고 다시 실행해도 원문과 수기 기록을 바꾸지 않는다', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'공유마감-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const 판 = path.join(dir,'판'), 표 = path.join(dir,'컷표.json'), 최종 = path.join(dir,'최종.mp4');
  fs.mkdirSync(판);
  fs.writeFileSync(표,JSON.stringify(컷표)); fs.writeFileSync(최종,'합성 영상 A');
  const 컷 = 컷표.detail.map(c=>c.cut), 전체 = [1,2,3].map(n=>path.join(판,'전체_'+n+'.jpg')), 끝 = path.join(판,'끝.jpg');
  const 순서 = [...전체,끝];
  순서.forEach((f,n)=>fs.writeFileSync(f,'합성 그림 '+n));
  const sha = f=>require('node:crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const 입력 = {컷표:sha(표), 최종:sha(최종), 고른컷:'', 그림순서:순서, 그림:Object.fromEntries(순서.map(f=>[f,sha(f)])),
    판배치:[컷.slice(0,8),컷.slice(8,16),컷.slice(16)]};
  const 목록 = {관문:'마감', 컷표:표, 최종, 컷:컷.map(cut=>({cut})), 판:{전체,끝}, 카본입력:입력};
  const 명세 = path.join(판,'판목록.json');
  const 저장 = () => fs.writeFileSync(명세,JSON.stringify(목록));
  저장();
  const 명령 = [path.join(뿌리,'tools','카본판심사.js'),dir,'--판',판,'--최종',최종,'--미리보기'];
  const 실행 = (args=[])=>spawnSync(process.execPath,[...명령,...args],{encoding:'utf8'});
  const 실행동시 = require('node:util').promisify(require('node:child_process').execFile);
  await Promise.all([실행동시(process.execPath,명령),실행동시(process.execPath,명령)]);
  const 폴더 = path.join(판,'공유준비','카본'), json = path.join(폴더,'작업_1.json');
  const job = JSON.parse(fs.readFileSync(json));
  for (const [i,f] of 순서.entries()) {
    assert.notEqual(job.files[i],f);
    assert.deepEqual(fs.readFileSync(job.files[i]),fs.readFileSync(f));
  }
  assert.equal(fs.existsSync(job.out),false);
  const 수기 = path.join(폴더,'보고.md');
  fs.writeFileSync(수기,'담당자의 기존 판단\r\n'); fs.writeFileSync(job.out,'기존에 수신한 원문\n');
  const 지킬파일 = [수기,job.out,...job.files,job.promptFile,json,path.join(폴더,'입력.sha256')];
  const 과거 = new Date('2020-01-01T00:00:00Z');
  지킬파일.forEach(f=>fs.utimesSync(f,과거,과거));
  const 이전 = 지킬파일.map(f=>[sha(f),fs.statSync(f).mtimeMs]);
  assert.equal(실행().status,0);
  for (const f of [최종,표,전체[0],끝]) {
    const 원본 = fs.readFileSync(f); fs.appendFileSync(f,' ');
    assert.equal(실행().status,1,f); fs.writeFileSync(f,원본);
  }
  목록.판.전체 = [...전체].reverse(); 저장(); assert.equal(실행().status,1);
  목록.판.전체 = 전체; 목록.카본입력.고른컷 = 'C1'; 저장(); assert.equal(실행().status,1);
  목록.카본입력.고른컷=''; 목록.판.끝=''; 저장(); assert.equal(실행().status,1);
  목록.판.끝=끝; 저장();
  assert.deepEqual(지킬파일.map(f=>[sha(f),fs.statSync(f).mtimeMs]),이전);
  const 다른 = path.join(dir,'옛 출력'); fs.mkdirSync(path.join(다른,'카본'),{recursive:true});
  const 기존 = path.join(다른,'카본','보고.md'); fs.writeFileSync(기존,'독립 보고');
  assert.equal(실행(['--출력',다른]).status,1);
  assert.deepEqual(fs.readdirSync(path.dirname(기존)),['보고.md']);
  assert.equal(fs.readFileSync(기존,'utf8'),'독립 보고');
  // 원본이 읽힌 직후 바뀌어도 작업 JSON은 대조한 바이트만 참조한다.
  const 주입 = path.join(dir,'파일교체.cjs');
  fs.writeFileSync(주입,"const fs=require('node:fs'),read=fs.readFileSync;fs.readFileSync=function(f,...a){const b=read.call(this,f,...a);if(f==="+JSON.stringify(전체[0])+")fs.writeFileSync(f,'교체된 그림');return b};");
  const 별도 = path.join(dir,'새 출력');
  const r = spawnSync(process.execPath,['-r',주입,...명령,'--출력',별도],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const 새작업 = JSON.parse(fs.readFileSync(path.join(별도,'카본','작업_1.json')));
  assert.equal(sha(새작업.files[0]),입력.그림[전체[0]]);
  assert.notEqual(sha(전체[0]),sha(새작업.files[0]));
});
