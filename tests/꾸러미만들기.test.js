'use strict';
// 꾸러미 만들기(tools/꾸러미만들기.py · 2026-11-14) — 컷표(틀 2)와 영상지시문/<판>.txt에서 내기 도구가 읽는 꾸러미가 나오는지 본다.
// 왜: 꾸러미 스크립트를 편마다 새로 짜면서(스무 개 넘음) 길이 셈 · 파일 이름 · 대안 판 잇기가 제각각이었다. 이 시험은 예시 컷표(컷표_틀.json)로
//   ① 미리 보기는 쓰지 않는다 ② 지은 꾸러미가 굽기 전 검사와 내기 도구의 관문을 지난다 ③ 그림 · 소리 파일이 내기 도구가 읽는 차례로 놓인다
//   ④ 손으로 만든 꾸러미 · 손으로 넣은 파일을 지우지 않는다 를 묶는다. 파이썬만 있으면 돈다(그림은 바이트만 다른 가짜 파일).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 뿌리 = path.join(__dirname, '..');
const 도구 = path.join(뿌리, 'tools', '꾸러미만들기.py');
const 틀경로 = path.join(뿌리, 'docs', '마케팅', '제작양식', '영상양식', '컷표_틀.json');
const 굽기폴더 = path.join(뿌리, 'docs', '마케팅', 'PULSE_포트폴리오_제작준비_20261012', '시댄스무제한');
const 픽스처 = path.join(__dirname, 'fixtures', '컷연속성검사');
const 파이썬 = spawnSync('python', ['-I', '-X', 'utf8', '-c', 'import sys; print(sys.version_info[0])'], { encoding: 'utf8' }).status === 0;
const 건너뜀 = { skip: !파이썬 && '파이썬 없음' };

const 틀읽기 = () => JSON.parse(fs.readFileSync(틀경로, 'utf8'));
const 빛문장 = 틀읽기().장면.부엌밤.빛;
// 지시문 틀(docs/…/영상양식/지시문_틀.md) 순서대로 쓴 네 판 — 예시 컷표의 연기 박자 · 빛 문장 그대로
const 꼬리 = [`LOOK: ${빛문장} The light and colour stay exactly like this to the last frame. No new people, no new text.`,
  'Indoors: the air is clear and still, nothing falls or drifts anywhere.'];
const 글 = {
  C1: ['@이미지 1 is the exact first frame of this video.', 'ONE SINGLE CONTINUOUS SHOT.', 'WHO: the same woman as in the start image, in the same hoodie.',
    'ACTION: at about 0.4 s she sets the pot on the stove and lets go of the handle; at about 1.6 s her shoulders drop once as she breathes out; at about 2.6 s her eyes go from the pot to the empty table.',
    'CAMERA: a slow push-in of 4% from 0 s to 4.0 s.', ...꼬리, 'SOUND: No sound.'].join('\n'),
  C2: ['@이미지 1 is the exact first frame of this video.', 'ONE SINGLE CONTINUOUS SHOT.', 'WHO: the same woman as in the start image, in the same hoodie.',
    'ACTION: at about 0.8 s she turns her head toward the front door, her eyebrows lifting slightly; at about 1.8 s her lips part and close again and she blinks once.',
    'CAMERA: a very slow push-in of 2% from 0 s to 3.5 s.', ...꼬리, 'SOUND: No sound.'].join('\n'),
  C3: ['@이미지 1 is the exact first frame of this video.', 'ONE SINGLE CONTINUOUS SHOT.', 'WHO: the same woman and the same neighbour\'s hand as in the start image, in the same sleeves.',
    'ACTION: at about 0.5 s the neighbour\'s hand holds the empty bowl out and her hand hesitates, then takes its rim; at about 2.0 s she draws the bowl toward herself with both hands and her fingers relax.',
    'CAMERA: the camera follows the hands toward the right of the frame by 6% from 0 s to 3.9 s.', ...꼬리, 'SOUND: No sound.'].join('\n'),
  C4: ['@이미지 1 is the exact first frame of this video.', 'ONE SINGLE CONTINUOUS SHOT.',
    'MOTION: steam rises steadily from the two bowls from the first frame to the last.',
    'CAMERA: from 0 s to 2.5 s the camera pulls back by 12%, then the frame stays exactly where it is to the last frame: no push-in, no zoom, no pan, no shake.',
    ...꼬리, 'PHYSICS: the two bowls stay exactly where they stand on the table.', 'SOUND: No sound.'].join('\n'),
};

// 편 폴더 하나를 임시로 짓는다 — 고침(seq, 편)으로 컷표 · 파일을 바꾼다
function 편만들기(고침) {
  const 편 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-pack-'));
  const seq = 틀읽기();
  for (const 폴더 of ['정지', 'ref', '영상지시문', '음성']) fs.mkdirSync(path.join(편, 폴더));
  for (const 컷 of ['C1', 'C2', 'C3', 'C4']) {
    fs.writeFileSync(path.join(편, '정지', `${컷}.png`), Buffer.from(`가짜 그림 ${컷}`));
    fs.writeFileSync(path.join(편, '영상지시문', `${컷}.txt`), 글[컷], 'utf8');
  }
  if (고침) 고침(seq, 편);
  fs.writeFileSync(path.join(편, '컷표.json'), JSON.stringify(seq, null, 1), 'utf8');
  return 편;
}
function 돌리기(편, 더 = []) {
  const r = spawnSync('python', ['-I', '-X', 'utf8', 도구, 편, ...더, '--json'], { encoding: 'utf8', maxBuffer: 1 << 24 });
  let 결과 = null;
  try { 결과 = JSON.parse(r.stdout); } catch (e) { /* 멈춤 글(SystemExit)은 stderr로 온다 */ }
  return { 코드: r.status, 결과, stdout: r.stdout, stderr: r.stderr };
}
const 순서 = 편 => JSON.parse(fs.readFileSync(path.join(편, '꾸러미', '_순서.json'), 'utf8'));
const 판 = (줄, id) => 줄.find(b => b.id === id);

test('미리 보기는 편 폴더에 쓰지 않고, 판 표(길이 · 소리 · 폴더)와 굽기 전 검사 결과를 낸다', 건너뜀, () => {
  const 편 = 편만들기();
  const r = 돌리기(편);
  assert.equal(r.코드, 0, r.stdout + r.stderr);
  assert.equal(fs.existsSync(path.join(편, '꾸러미')), false, '미리 보기가 꾸러미 폴더를 만들었다');
  assert.equal(r.결과.쓴것, false);
  assert.deepEqual(r.결과.판.map(b => [b.id, b.폴더, b.길이, b.소리, b.비율]),
    [['C1', '001_C1', 5, '끔', '9:16'], ['C2', '002_C2', 4, '끔', '9:16'], ['C3', '003_C3', 5, '끔', '9:16'], ['C4', '004_C4', 6, '끔', '9:16']],
    '길이 = max(out, (out − in) + 0.8)을 올림 · 최소 4');
  assert.deepEqual(r.결과.걸림, []);
  assert.deepEqual(r.결과.검사.줄.filter(x => x.등급 === '걸림'), [], JSON.stringify(r.결과.검사.줄));
  // --컷은 미리 보기에서 그 판만 보인다, --실행과는 같이 못 쓴다(_순서.json에서 나머지 판이 빠지지 않게)
  assert.deepEqual(돌리기(편, ['--컷', 'C2']).결과.판.map(b => b.id), ['C2']);
  const 막힘 = 돌리기(편, ['--컷', 'C2', '--실행']);
  assert.equal(막힘.코드, 1);
  assert.match(막힘.stderr, /--컷은 미리 보기에서만/);
  assert.equal(fs.existsSync(path.join(편, '꾸러미')), false);
});

test('--실행 — 지시문 틀의 편 폴더 꼴로 쓰고, 지은 꾸러미가 굽기 전 검사와 내기 도구의 관문(굽기전)을 지난다', 건너뜀, () => {
  const 편 = 편만들기();
  const r = 돌리기(편, ['--실행']);
  assert.equal(r.코드, 0, r.stdout + r.stderr);
  const 줄 = 순서(편);
  assert.deepEqual(줄.map(b => b.순서), [1, 2, 3, 4]);
  assert.deepEqual(판(줄, 'C1'), { 순서: 1, id: 'C1', 폴더: '001_C1', 길이: 5, 비율: '9:16', 소리: '끔', 파일: ['1_시작.png'], '빠진 파일': [], 쓰는초: [3.5], '판 수': 1, 실내: true, 인물: ['수아'] });
  assert.deepEqual(판(줄, 'C4').인물, [], '사람 없는 컷은 인물 []로 넘긴다');
  for (const b of 줄) {
    assert.equal(fs.readFileSync(path.join(편, '꾸러미', b.폴더, '지시문.txt'), 'utf8'), 글[b.id]);
    assert.equal(fs.readFileSync(path.join(편, '꾸러미', b.폴더, '1_시작.png'), 'utf8'), `가짜 그림 ${b.id}`);
  }
  const 표식 = JSON.parse(fs.readFileSync(path.join(편, '꾸러미', '_만든것.json'), 'utf8'));
  assert.deepEqual(Object.keys(표식.폴더['001_C1']).sort(), ['1_시작.png', '지시문.txt']);
  assert.match(표식.폴더['001_C1']['지시문.txt'], /^[0-9a-f]{16}$/, '표식에는 파일마다 내용 지문을 적는다');
  assert.match(표식.순서, /^[0-9a-f]{16}$/);
  // 내기 도구의 굽기 전 관문 — 꾸러미 한 층 위의 컷표를 스스로 찾아 표 검사 · 빛 문장 대조까지 돈다
  const g = spawnSync('python', ['-I', '-X', 'utf8', path.join(픽스처, '굽기전_시험.py'), '함수', path.join(편, '꾸러미')], { encoding: 'utf8', maxBuffer: 1 << 24 });
  assert.equal(g.status, 0, g.stdout + g.stderr);
  assert.match(g.stdout, /결과: \{\}/);
  // 같은 입력으로 다시 돌려도 같은 꾸러미다
  const 앞 = fs.readFileSync(path.join(편, '꾸러미', '_순서.json'), 'utf8');
  assert.equal(돌리기(편, ['--실행']).코드, 0);
  assert.equal(fs.readFileSync(path.join(편, '꾸러미', '_순서.json'), 'utf8'), 앞);
});

test('대안 판 · 끝 그림 · 참고 그림 · 목소리 견본 · 대사 판 — 내기 도구가 읽는 차례(시작 · 끝 · 참고 · 소리)로 놓인다', 건너뜀, () => {
  const 대사판 = 글.C2.replace('SOUND: No sound.', 'SOUND: only her natural speaking voice saying this one Korean line, over quiet room tone — no music, no other voices, no sound effects.\nVOICE: follow the tone of @오디오 1.\n「누구세요?」')
    .replace('@이미지 1 is the exact first frame of this video.', '@이미지 1 is the exact first frame of this video. @이미지 2 is the exact last frame. @이미지 3 shows the bowl.');
  const 편 = 편만들기((seq, 편) => {
    const c2 = seq.detail.find(d => d.cut === 'C2');
    Object.assign(c2, { 끝그림: '정지/C2_끝.jpg', 참고그림: ['ref/소품_빈그릇.jpg'], 목소리견본: ['음성/수아.mp3'], 길이: 7 });
    fs.writeFileSync(path.join(편, '정지', 'C2_끝.jpg'), Buffer.from('끝 그림'));
    fs.writeFileSync(path.join(편, 'ref', '소품_빈그릇.jpg'), Buffer.from('그릇'));
    fs.writeFileSync(path.join(편, '음성', '수아.mp3'), Buffer.from('목소리'));
    fs.writeFileSync(path.join(편, '영상지시문', 'C2.txt'), 대사판, 'utf8');
    fs.writeFileSync(path.join(편, '영상지시문', 'C2b.txt'), 대사판.replace('at about 1.8 s', 'at about 2.1 s'), 'utf8');   // 박자를 고쳐 다시 내는 대안 판
    fs.writeFileSync(path.join(편, '영상지시문', '_판.json'), JSON.stringify({ C2b: { '판 수': 2 } }), 'utf8');
  });
  const r = 돌리기(편, ['--실행']);
  assert.notEqual(r.코드, null, r.stderr);
  assert.deepEqual(r.결과.걸림, [], JSON.stringify(r.결과));
  const 줄 = 순서(편);
  assert.deepEqual(줄.map(b => b.id), ['C1', 'C2', 'C2b', 'C3', 'C4'], '대안 판은 그 컷 바로 뒤');
  const c2 = 판(줄, 'C2'), c2b = 판(줄, 'C2b');
  assert.deepEqual(c2.파일, ['1_시작.png', '2_끝.jpg', '3_참고1.jpg', '4_목소리1.mp3']);
  assert.equal(c2.길이, 7, '컷표 「길이」가 셈보다 먼저');
  assert.equal(c2.소리, '켬');
  assert.equal(c2.컷, undefined);
  assert.deepEqual([c2b.폴더, c2b.컷, c2b['판 수'], c2b.파일], ['002_C2b', ['C2'], 2, c2.파일], '대안 판은 그 컷의 그림 · 번호를 그대로 쓰고 "컷"으로 잇는다');
  // 내기 도구(크레딧내기 · 드리미나내기)가 같은 파일을 어떤 자리로 읽는지 — 그 도구의 함수로 직접
  const py = `
import json, sys
sys.path.insert(0, sys.argv[1])
import 크레딧내기, 드리미나내기
pack = sys.argv[2]
b = [x for x in 크레딧내기.boards(pack) if x["id"] == "C2"][0]
print(json.dumps({"자리": 크레딧내기.media(pack, b)[1], "글": 크레딧내기.prompt(pack, b)[:140], "모드": 드리미나내기.mode(b) if hasattr(드리미나내기, "mode") else None}, ensure_ascii=False))
`;
  // import 때 읽는 캔버스 값만 가짜로 둔다. Linux · Windows 모두 실제 로그인 홈을 보지 않는다.
  const 시험홈 = path.join(편, '시험홈');
  const 캔버스폴더 = path.join(시험홈, '.ai-tools', 'dreamina-canvas');
  fs.mkdirSync(캔버스폴더, { recursive: true });
  fs.writeFileSync(path.join(캔버스폴더, '캔버스.txt'), 'test-canvas-not-a-real-project', 'utf8');
  const m = spawnSync('python', ['-I', '-X', 'utf8', '-c', py, 굽기폴더, path.join(편, '꾸러미')], {
    encoding: 'utf8', env: { ...process.env, HOME: 시험홈, USERPROFILE: 시험홈 }
  });
  assert.equal(m.status, 0, m.stderr);
  const 읽음 = JSON.parse(m.stdout.trim().split('\n').pop());
  assert.deepEqual(읽음.자리, ['start_image', 'end_image', 'image', 'audio']);
  assert.match(읽음.글, /<<<image_1>>>.*<<<image_2>>>.*<<<image_3>>>/, '@이미지 N이 시작 · 끝 · 참고 차례의 꼬리표로 바뀐다');
});

test('소리만 쓰는 판(_판.json "소리만": true)은 그림 없이 9로 시작하는 폴더에, 길이는 _판.json에서', 건너뜀, () => {
  const 편 = 편만들기((seq, 편) => {
    fs.writeFileSync(path.join(편, '음성', '수아.mp3'), Buffer.from('목소리'));
    fs.writeFileSync(path.join(편, '영상지시문', 'V1.txt'), 'A voice-only take: follow the tone of @오디오 1.\nSOUND: only her natural speaking voice saying this one Korean line.\n「누구세요?」', 'utf8');
    fs.writeFileSync(path.join(편, '영상지시문', '_판.json'), JSON.stringify({ V1: { 소리만: true, 목소리견본: ['음성/수아.mp3'], 길이: 5 } }), 'utf8');
  });
  const r = 돌리기(편, ['--실행']);
  assert.deepEqual(r.결과.걸림, [], JSON.stringify(r.결과));
  const v1 = 판(순서(편), 'V1');
  assert.deepEqual([v1.순서, v1.폴더, v1.길이, v1.소리, v1.소리만, v1.파일], [5, '901_V1', 5, '켬', true, ['4_목소리1.mp3']]);
  assert.equal(v1.인물, undefined);
  assert.deepEqual(r.결과.검사.줄.filter(x => x.등급 === '걸림'), [], '소리만 쓰는 판은 컷표 대조 · 사람 연기 검사를 건너뛴다');
});

test('걸림이면 쓰지 않는다 — 없는 시작 그림 · 그림보다 많은 @이미지 · 어느 컷인지 모르는 글 · 너무 긴 판 · 옛 틀', 건너뜀, () => {
  const 본다 = (고침, 무늬, 더 = ['--실행']) => {
    const 편 = 편만들기(고침);
    const r = 돌리기(편, 더);
    assert.equal(r.코드, 1, r.stdout + r.stderr);
    assert.ok((r.결과 ? r.결과.걸림.join('\n') : r.stderr).match(무늬), `${무늬} ↔ ${r.결과 ? r.결과.걸림.join(' / ') : r.stderr}`);
    assert.equal(fs.existsSync(path.join(편, '꾸러미')), false, '걸림인데 꾸러미를 썼다');
  };
  본다((seq, 편) => fs.rmSync(path.join(편, '정지', 'C3.png')), /C3: 파일이 없다: 정지\/C3\.png/);
  본다(seq => { delete seq.detail.find(d => d.cut === 'C1').시작그림; }, /C1: 「시작그림」이 없다/);
  본다((seq, 편) => fs.writeFileSync(path.join(편, '영상지시문', 'C1.txt'), 글.C1.replace('first frame of this video.', 'first frame of this video. @이미지 2 is the exact last frame.'), 'utf8'), /C1: 지시문이 @이미지 2을 부르는데 이 판의 그림은 1개다/);
  본다((seq, 편) => fs.writeFileSync(path.join(편, '영상지시문', '끝장면.txt'), 글.C4, 'utf8'), /끝장면: 끝장면\.txt가 어느 컷의 판인지 모른다/);
  본다(seq => { Object.assign(seq.detail.find(d => d.cut === 'C4'), { in: 0.5, out: 15.5 }); }, /C4: 쓰는 구간이 15\.5초까지라 판이 16초가 된다/);
  본다(seq => { seq.detail.find(d => d.cut === 'C2').길이 = 3; }, /C2: 컷표의 「길이」가 3다 — 4~15 사이 정수 초/);
  본다(seq => { seq.틀 = 1; }, /컷표 틀 2에서만 돈다/);
  // 지시문 글이 없는 컷은 주의로 알리고 그 컷만 뺀다(이미지 콘티만 끝난 편)
  const 편 = 편만들기((seq, 편) => fs.rmSync(path.join(편, '영상지시문', 'C4.txt')));
  const r = 돌리기(편);
  assert.equal(r.코드, 0, r.stdout + r.stderr);
  assert.deepEqual(r.결과.판.map(b => b.id), ['C1', 'C2', 'C3']);
  assert.match(r.결과.주의.join('\n'), /C4: 영상지시문\/C4\.txt가 없다/);
});

test('굽기 전 검사의 걸림(사람을 굳히는 말)은 꾸러미를 쓰되 끝 코드 1로 알린다 — 내기 도구도 같은 걸림으로 멈춘다', 건너뜀, () => {
  const 편 = 편만들기((seq, 편) => fs.writeFileSync(path.join(편, '영상지시문', 'C2.txt'), 글.C2.replace(/ACTION: .*/, 'ACTION: she stands still, expressionless.'), 'utf8'));
  const r = 돌리기(편, ['--실행']);
  assert.equal(r.코드, 1, r.stdout + r.stderr);
  assert.equal(r.결과.쓴것, true);
  assert.ok(r.결과.검사.줄.some(x => x.등급 === '걸림' && x.컷 === 'C2'), JSON.stringify(r.결과.검사.줄));
  const g = spawnSync('python', ['-I', '-X', 'utf8', path.join(픽스처, '굽기전_시험.py'), '함수', path.join(편, '꾸러미')], { encoding: 'utf8', maxBuffer: 1 << 24 });
  assert.equal(g.status, 1, g.stdout + g.stderr);
});

test('손으로 만든 꾸러미는 --덮어쓰기 없이 건드리지 않고, 다시 돌릴 때 이 도구가 만든 것만 고치고 지운다', 건너뜀, () => {
  const 편 = 편만들기();
  const pack = path.join(편, '꾸러미');
  fs.mkdirSync(path.join(pack, '001_손판'), { recursive: true });
  fs.writeFileSync(path.join(pack, '001_손판', '지시문.txt'), '손으로 쓴 판', 'utf8');
  const 손순서 = JSON.stringify([{ 순서: 1, id: '손판', 폴더: '001_손판', 길이: 5, 비율: '9:16', 소리: '끔', 파일: [], '빠진 파일': [] }]);
  fs.writeFileSync(path.join(pack, '_순서.json'), 손순서, 'utf8');
  const 막힘 = 돌리기(편, ['--실행']);
  assert.equal(막힘.코드, 1);
  assert.match(막힘.stderr, /이 도구가 만든 꾸러미가 아니다/);
  assert.equal(fs.readFileSync(path.join(pack, '_순서.json'), 'utf8'), 손순서, '거절했는데 _순서.json이 바뀌었다');
  assert.equal(돌리기(편).코드, 0, '미리 보기는 손으로 만든 꾸러미가 있어도 돈다');
  // --덮어쓰기: 앞 _순서.json을 지우지 않고 _앞1/ 로 옮기고, 손으로 만든 판 폴더는 그대로 둔다
  const 덮음 = 돌리기(편, ['--실행', '--덮어쓰기']);
  assert.equal(덮음.코드, 0, 덮음.stdout + 덮음.stderr);
  assert.equal(fs.readFileSync(path.join(pack, '_앞1', '_순서.json'), 'utf8'), 손순서);
  assert.match(덮음.결과.옮김.join('\n'), /_순서\.json → _앞1\//);
  assert.ok(fs.existsSync(path.join(pack, '001_손판', '지시문.txt')));
  assert.deepEqual(순서(편).map(b => b.id), ['C1', 'C2', 'C3', 'C4']);
  // 끝 그림을 넣었다 빼면 그 파일만 사라지고, 손으로 넣은 파일은 남는다
  const 표 = path.join(편, '컷표.json');
  const seq = JSON.parse(fs.readFileSync(표, 'utf8'));
  seq.detail.find(d => d.cut === 'C3').끝그림 = '정지/C4.png';
  fs.writeFileSync(표, JSON.stringify(seq), 'utf8');
  fs.writeFileSync(path.join(편, '영상지시문', 'C3.txt'), 글.C3.replace('first frame of this video.', 'first frame of this video. @이미지 2 is the exact last frame.'), 'utf8');
  돌리기(편, ['--실행']);
  assert.ok(fs.existsSync(path.join(pack, '003_C3', '2_끝.png')));
  fs.writeFileSync(path.join(pack, '003_C3', '메모.txt'), '손 메모', 'utf8');
  delete seq.detail.find(d => d.cut === 'C3').끝그림;
  fs.writeFileSync(표, JSON.stringify(seq), 'utf8');
  fs.writeFileSync(path.join(편, '영상지시문', 'C3.txt'), 글.C3, 'utf8');
  돌리기(편, ['--실행']);
  assert.equal(fs.existsSync(path.join(pack, '003_C3', '2_끝.png')), false, '뺀 끝 그림이 꾸러미에 남았다');
  assert.ok(fs.existsSync(path.join(pack, '003_C3', '메모.txt')));
  // 지시문 글을 지운 컷: 이 도구가 만든 폴더면 지우고, 손으로 넣은 파일이 있으면 남기고 알린다
  fs.rmSync(path.join(편, '영상지시문', 'C4.txt'));
  fs.rmSync(path.join(편, '영상지시문', 'C3.txt'));
  const r = 돌리기(편, ['--실행']);
  assert.deepEqual(순서(편).map(b => b.id), ['C1', 'C2']);
  assert.deepEqual(r.결과.지움, ['004_C4']);
  assert.equal(fs.existsSync(path.join(pack, '004_C4')), false);
  assert.match(r.결과.남김.join('\n'), /003_C3 — 이 도구가 넣지 않았거나 쓴 뒤 바뀐 파일이 있어 지우지 않았다\(메모\.txt\)/);
  assert.ok(fs.existsSync(path.join(pack, '003_C3', '메모.txt')));
});
// ── 11-14 GPT 검수 뒤 — 지우기 · 덮어쓰기가 이 도구가 만든 것을 넘지 않는다 ─────────────────────────────────
const 표식쓰기 = (pack, 내용) => fs.writeFileSync(path.join(pack, '_만든것.json'), typeof 내용 === 'string' ? 내용 : JSON.stringify(내용), 'utf8');
const 나무 = (폴더) => fs.readdirSync(폴더, { recursive: true }).map(String).sort();

test('믿을 수 없는 표식(_만든것.json) — 빈 것 · 폴더가 null · 도구 이름이 다름 · 「..」 · 「C:..」 · 경로 글자 — 은 손으로 만든 꾸러미로 본다', 건너뜀, () => {
  const 손순서 = JSON.stringify([{ 순서: 1, id: '손판', 폴더: '001_손판', 길이: 5, 비율: '9:16', 소리: '끔', 파일: [], '빠진 파일': [] }]);
  const 표식들 = [{}, { 폴더: null }, '깨진 json {', { 도구: '다른도구.py', 폴더: { '001_C1': ['지시문.txt'] } },
    { 도구: 'tools/꾸러미만들기.py', 폴더: { '..': ['지시문.txt', '컷표.json'] } },
    { 도구: 'tools/꾸러미만들기.py', 폴더: { 'C:..': ['지시문.txt'] } },
    { 도구: 'tools/꾸러미만들기.py', 폴더: { '001_C1': ['..\\..\\컷표.json'] } },
    { 도구: 'tools/꾸러미만들기.py', 폴더: { '../영상지시문': ['C1.txt'] } },
    { 도구: 'tools/꾸러미만들기.py', 폴더: { '001_C1': ['지시문.txt', '1_시작.png'] } },            // 옛 꼴(이름 목록) — 지문이 없으면 무엇이 이 도구가 쓴 그대로인지 알 수 없다
    { 도구: 'tools/꾸러미만들기.py', 폴더: { '001_C1': { '지시문.txt': '아무 글' } } },                // 지문 꼴이 아니다
    { 도구: 'tools/꾸러미만들기.py', 순서: 'x', 폴더: { '001_C1': { '지시문.txt': '0123456789abcdef' } } }];
  for (const 표식 of 표식들) {
    const 편 = 편만들기();
    const pack = path.join(편, '꾸러미');
    fs.mkdirSync(pack);
    fs.writeFileSync(path.join(pack, '_순서.json'), 손순서, 'utf8');
    fs.writeFileSync(path.join(편, '지시문.txt'), '편 폴더의 손 파일', 'utf8');   // 「..」이 가리킬 자리 — 지워지면 안 된다
    표식쓰기(pack, 표식);
    const 앞나무 = 나무(편);
    const 막힘 = 돌리기(편, ['--실행']);
    assert.equal(막힘.코드, 1, JSON.stringify(표식) + 막힘.stdout);
    assert.match(막힘.stderr, /이 도구가 만든 꾸러미가 아니다.*아무것도 바꾸지 않았다/, JSON.stringify(표식));
    assert.deepEqual(나무(편), 앞나무, '멈췄는데 파일이 바뀌었다: ' + JSON.stringify(표식));
    assert.equal(fs.readFileSync(path.join(pack, '_순서.json'), 'utf8'), 손순서);
    // --덮어쓰기여도 지우지 않고 옮긴다 — 편 폴더(꾸러미 밖)는 그대로다
    const r = 돌리기(편, ['--실행', '--덮어쓰기']);
    assert.equal(r.코드, 0, JSON.stringify(표식) + r.stdout + r.stderr);
    assert.equal(fs.readFileSync(path.join(pack, '_앞1', '_순서.json'), 'utf8'), 손순서, '앞 _순서.json이 남지 않았다');
    assert.ok(fs.existsSync(path.join(pack, '_앞1', '_만든것.json')));
    for (const 남을 of ['지시문.txt', '컷표.json', path.join('영상지시문', 'C1.txt'), path.join('정지', 'C1.png')]) {
      assert.ok(fs.existsSync(path.join(편, 남을)), `꾸러미 밖의 ${남을}이 사라졌다: ` + JSON.stringify(표식));
    }
    assert.deepEqual(순서(편).map(b => b.id), ['C1', 'C2', 'C3', 'C4']);
  }
});

test('이 도구가 넣지 않은 같은 이름 파일 · 폴더는 덮지 않는다 — 쓰기 전에 멈추고, --덮어쓰기는 지우지 않고 옮긴다', 건너뜀, () => {
  const 편 = 편만들기((seq, 편) => fs.rmSync(path.join(편, '영상지시문', 'C4.txt')));
  const pack = path.join(편, '꾸러미');
  assert.equal(돌리기(편, ['--실행']).코드, 0);
  // 손으로 넣은 끝 그림(관리 목록에 없다) 위에 컷표의 새 끝 그림이 오는 길
  fs.writeFileSync(path.join(pack, '003_C3', '2_끝.png'), '손으로 넣은 끝 그림');
  // 손으로 만든 판 폴더(관리 목록에 없다)와 새 판 폴더 이름이 겹치는 길
  fs.mkdirSync(path.join(pack, '004_C4'));
  fs.writeFileSync(path.join(pack, '004_C4', '지시문.txt'), '손으로 쓴 C4', 'utf8');
  const 표 = path.join(편, '컷표.json');
  const seq = JSON.parse(fs.readFileSync(표, 'utf8'));
  seq.detail.find(d => d.cut === 'C3').끝그림 = '정지/C4.png';
  fs.writeFileSync(표, JSON.stringify(seq), 'utf8');
  fs.writeFileSync(path.join(편, '영상지시문', 'C3.txt'), 글.C3.replace('first frame of this video.', 'first frame of this video. @이미지 2 is the exact last frame.'), 'utf8');
  fs.writeFileSync(path.join(편, '영상지시문', 'C4.txt'), 글.C4, 'utf8');
  const 앞순서 = fs.readFileSync(path.join(pack, '_순서.json'), 'utf8');
  const 앞표식 = fs.readFileSync(path.join(pack, '_만든것.json'), 'utf8');
  const 앞C3글 = fs.readFileSync(path.join(pack, '003_C3', '지시문.txt'), 'utf8');
  const 막힘 = 돌리기(편, ['--실행']);
  assert.equal(막힘.코드, 1, 막힘.stdout);
  assert.match(막힘.stderr, /이 도구가 쓴 그대로가 아닌 것과 이름이 겹친다 — 003_C3\/2_끝\.png\(이 도구가 넣지 않았다\) · 004_C4\/\(이 도구가 만들지 않았다\)/);
  assert.equal(fs.readFileSync(path.join(pack, '003_C3', '2_끝.png'), 'utf8'), '손으로 넣은 끝 그림');
  assert.equal(fs.readFileSync(path.join(pack, '004_C4', '지시문.txt'), 'utf8'), '손으로 쓴 C4');
  assert.equal(fs.readFileSync(path.join(pack, '_순서.json'), 'utf8'), 앞순서, '멈췄는데 _순서.json이 바뀌었다');
  assert.equal(fs.readFileSync(path.join(pack, '_만든것.json'), 'utf8'), 앞표식, '멈췄는데 표식이 바뀌었다');
  assert.equal(fs.readFileSync(path.join(pack, '003_C3', '지시문.txt'), 'utf8'), 앞C3글, '멈췄는데 앞 판의 지시문이 바뀌었다(쓰기 전에 모두 봐야 한다)');
  const r = 돌리기(편, ['--실행', '--덮어쓰기']);
  assert.equal(r.코드, 0, r.stdout + r.stderr);
  assert.equal(fs.readFileSync(path.join(pack, '_앞1', '003_C3', '2_끝.png'), 'utf8'), '손으로 넣은 끝 그림');
  assert.equal(fs.readFileSync(path.join(pack, '_앞1', '004_C4', '지시문.txt'), 'utf8'), '손으로 쓴 C4');
  assert.equal(fs.readFileSync(path.join(pack, '003_C3', '2_끝.png'), 'utf8'), '가짜 그림 C4');
  assert.deepEqual(순서(편).map(b => b.id), ['C1', 'C2', 'C3', 'C4']);
  // 옮긴 자리(_앞1)는 다음 회차에도 건드리지 않는다
  assert.equal(돌리기(편, ['--실행']).코드, 0);
  assert.equal(fs.readFileSync(path.join(pack, '_앞1', '004_C4', '지시문.txt'), 'utf8'), '손으로 쓴 C4');
});

test('안 쓰게 된 판 폴더는 적어 둔 파일만 지운다 — 하위 폴더 · 손 파일이 있으면 폴더를 남긴다(통째 지우기 없음)', 건너뜀, () => {
  const 편 = 편만들기();
  const pack = path.join(편, '꾸러미');
  assert.equal(돌리기(편, ['--실행']).코드, 0);
  fs.mkdirSync(path.join(pack, '004_C4', '손폴더'));
  fs.writeFileSync(path.join(pack, '004_C4', '손폴더', '원본.psd'), '손 자료');
  fs.rmSync(path.join(편, '영상지시문', 'C4.txt'));
  fs.rmSync(path.join(편, '영상지시문', 'C3.txt'));
  const r = 돌리기(편, ['--실행']);
  assert.deepEqual(r.결과.지움, ['003_C3']);
  assert.match(r.결과.남김.join('\n'), /004_C4 — 이 도구가 넣지 않았거나 쓴 뒤 바뀐 파일이 있어 지우지 않았다\(손폴더\)/);
  assert.equal(fs.readFileSync(path.join(pack, '004_C4', '손폴더', '원본.psd'), 'utf8'), '손 자료');
  assert.ok(fs.existsSync(path.join(pack, '004_C4', '지시문.txt')), '남긴 폴더에서는 아무것도 지우지 않는다');
});

test('판 길이는 그 판을 쓰는 모든 구간을 덮는다 — 같은 컷의 둘째 토막 · "컷"으로 이은 컷들 · 컷표에서 「판」으로 가리킨 컷', 건너뜀, () => {
  // 같은 컷 C1이 0.5~4.0에 이어 5~9초로 또 나온다 → 첫 줄만 보면 5초, 모두 보면 9초
  const 두토막 = 편만들기((seq) => { seq.detail.push({ ...seq.detail.find(d => d.cut === 'C1'), t: 20, in: 5, out: 9 }); });
  const a = 돌리기(두토막);
  assert.deepEqual(a.결과.걸림, []);
  assert.deepEqual([판(a.결과.판, 'C1').길이, 판(a.결과.판, 'C1').쓰는초], [9, [3.5, 4]]);
  // 손으로 준 길이가 뒤 토막의 끝보다 짧으면 걸림
  const 짧음 = 편만들기((seq) => { seq.detail.push({ ...seq.detail.find(d => d.cut === 'C1'), t: 20, in: 5, out: 9 }); seq.detail.find(d => d.cut === 'C1').길이 = 6; });
  assert.match(돌리기(짧음).결과.걸림.join('\n'), /C1: 컷표의 「길이」 6초가 쓰는 구간 끝 9초보다 짧다/);
  // 두 컷을 한 판으로("컷": ["C1", "C4"]) — C4가 5.5초까지 쓰니 6초
  const 이음 = 편만들기((seq, 편) => {
    fs.writeFileSync(path.join(편, '영상지시문', 'X7.txt'), 글.C1, 'utf8');
    fs.writeFileSync(path.join(편, '영상지시문', '_판.json'), JSON.stringify({ X7: { 컷: ['C1', 'C4'] } }), 'utf8');
  });
  const b = 돌리기(이음);
  assert.deepEqual(b.결과.걸림, []);
  assert.deepEqual([판(b.결과.판, 'X7').길이, 판(b.결과.판, 'X7').컷, 판(b.결과.판, 'X7').쓰는초], [6, ['C1', 'C4'], [3.5, 5]]);
  // 컷표에서 C2가 C1의 판을 이어 쓴다("판": "C1", 6~8초) — C1 판이 8초를 덮어야 한다
  const 같은판 = 편만들기((seq, 편) => {
    Object.assign(seq.detail.find(d => d.cut === 'C2'), { 판: 'C1', 같은판: '한 방을 둘로 자른 컷', in: 6, out: 8 });
    fs.rmSync(path.join(편, '영상지시문', 'C2.txt'));
  });
  const c = 돌리기(같은판);
  assert.deepEqual(c.결과.걸림, []);
  assert.equal(판(c.결과.판, 'C1').길이, 8);
  // 판 이름에 경로 글자가 있으면 걸림(폴더 이름으로 쓰지 않는다)
  const 경로 = 편만들기((seq, 편) => fs.writeFileSync(path.join(편, '영상지시문', 'C2 .txt'), 글.C2, 'utf8'));
  assert.match(돌리기(경로).결과.걸림.join('\n'), /폴더 이름으로 쓸 수 없다/);
});
// ── 11-14 카본 재검수 뒤 ────────────────────────────────────────────────────────────────────────────
test('컷표 「판」에 다시 낸 파일 이름(C1__2)이 적혀도 그 컷의 구간을 그 판이 덮는다', 건너뜀, () => {
  const 편 = 편만들기((seq, 편) => {
    Object.assign(seq.detail.find(d => d.cut === 'C1'), { 판: 'C1__2' });
    Object.assign(seq.detail.find(d => d.cut === 'C2'), { 판: 'C1__2', 같은판: '한 방을 둘로 자른 컷', in: 6, out: 8 });
    fs.rmSync(path.join(편, '영상지시문', 'C2.txt'));
  });
  const r = 돌리기(편);
  assert.deepEqual(r.결과.걸림, []);
  assert.equal(판(r.결과.판, 'C1').길이, 8, 'C2가 「판」: 「C1__2」로 6~8초를 이어 쓰니 C1 판이 8초를 덮어야 한다');
});

test('손으로 준 「길이」가 여러 줄이면 모두 보고 가장 큰 값을 쓴다 — 틀린 값 · in · out이 없는 줄은 걸림', 건너뜀, () => {
  const 이은편 = (고침) => 편만들기((seq, 편) => {
    fs.writeFileSync(path.join(편, '영상지시문', 'X7.txt'), 글.C1, 'utf8');
    fs.writeFileSync(path.join(편, '영상지시문', '_판.json'), JSON.stringify({ X7: { 컷: ['C1', 'C4'] } }), 'utf8');
    고침(seq, 편);
  });
  const 컷 = (seq, 이름) => seq.detail.find(d => d.cut === 이름);
  // 앞 컷 6 · 뒤 컷 9 → 9(첫 값 6에서 멈추지 않는다)
  const a = 돌리기(이은편((seq) => { 컷(seq, 'C1').길이 = 6; 컷(seq, 'C4').길이 = 9; }));
  assert.deepEqual(a.결과.걸림, []);
  assert.equal(판(a.결과.판, 'X7').길이, 9);
  // 뒤 컷의 틀린 값이 묻히지 않는다
  assert.match(돌리기(이은편((seq) => { 컷(seq, 'C1').길이 = 6; 컷(seq, 'C4').길이 = 99; })).결과.걸림.join('\n'), /X7: 컷표의 「길이」가 99다/);
  // 앞 컷에 길이를 적었어도 뒤 컷의 out이 없으면 걸림(그 구간을 덮는지 볼 수 없다)
  assert.match(돌리기(이은편((seq) => { 컷(seq, 'C1').길이 = 6; delete 컷(seq, 'C4').out; })).결과.걸림.join('\n'), /X7: 컷표 C4의 in · out을 읽을 수 없다/);
  // _판.json의 길이가 컷표의 길이보다 먼저다
  const b = 돌리기(이은편((seq, 편) => { 컷(seq, 'C1').길이 = 9;
    fs.writeFileSync(path.join(편, '영상지시문', '_판.json'), JSON.stringify({ X7: { 컷: ['C1', 'C4'], 길이: 7 } }), 'utf8'); }));
  assert.equal(판(b.결과.판, 'X7').길이, 7);
});
// ── 11-14 GPT 다시 검수 뒤 — 정션 · 링크 ────────────────────────────────────────────────────────────
// 판 폴더가 윈도우 정션(다른 폴더를 가리키는 폴더)이면 그 안의 파일은 가리킨 곳의 것이다. is_symlink()에 안 걸리고 가리킨 곳이 같은 꾸러미 안이면
// 풀어 본 부모도 같아, 표식에 적힌 이름과 같은 손 파일이 지워지거나 덮였다.
const 정션 = (가리킬곳, 자리) => fs.symlinkSync(가리킬곳, 자리, 'junction');   // 윈도우는 관리자 권한 없이 정션, 다른 곳은 폴더 링크

test('정션 · 링크로 바뀐 판 폴더는 이 도구의 것이 아니다 — 안 쓰는 판이어도 그 안을 지우지 않고, 쓰는 판이면 쓰기 전에 멈춘다', 건너뜀, () => {
  const 편 = 편만들기();
  const pack = path.join(편, '꾸러미');
  assert.equal(돌리기(편, ['--실행']).코드, 0);
  // 손으로 둔 원본 폴더 — 표식에 적힌 이름과 같은 파일만 있다(「적어 둔 파일만 있는 폴더」로 보이는 꼴)
  const 손원본 = path.join(pack, '손원본');
  fs.mkdirSync(손원본);
  fs.writeFileSync(path.join(손원본, '지시문.txt'), '손으로 쓴 원본 지시문', 'utf8');
  fs.writeFileSync(path.join(손원본, '1_시작.png'), '손으로 둔 원본 그림');
  // ① 안 쓰게 된 판(C4)의 폴더가 손원본을 가리키는 정션으로 바뀌었다
  fs.rmSync(path.join(pack, '004_C4'), { recursive: true });
  정션(손원본, path.join(pack, '004_C4'));
  fs.rmSync(path.join(편, '영상지시문', 'C4.txt'));
  const r = 돌리기(편, ['--실행']);
  assert.equal(r.코드, 0, r.stdout + r.stderr);
  assert.equal(fs.readFileSync(path.join(손원본, '지시문.txt'), 'utf8'), '손으로 쓴 원본 지시문', '정션을 통해 손 파일이 지워졌다');
  assert.equal(fs.readFileSync(path.join(손원본, '1_시작.png'), 'utf8'), '손으로 둔 원본 그림');
  assert.deepEqual(r.결과.지움, []);
  assert.match(r.결과.남김.join('\n'), /004_C4 — 링크 · 정션이라 건드리지 않았다/);
  // ② 쓰는 판(C3)의 폴더가 정션으로 바뀌었다 — 그 안에 쓰면 손원본이 덮인다. 쓰기 전에 멈추고 아무것도 바꾸지 않는다
  fs.rmSync(path.join(pack, '003_C3'), { recursive: true });
  정션(손원본, path.join(pack, '003_C3'));
  const 앞순서 = fs.readFileSync(path.join(pack, '_순서.json'), 'utf8');
  const 막힘 = 돌리기(편, ['--실행']);
  assert.equal(막힘.코드, 1, 막힘.stdout);
  assert.match(막힘.stderr, /이름이 겹친다 — 003_C3\/\(링크 · 정션이다\)/);
  assert.equal(fs.readFileSync(path.join(손원본, '지시문.txt'), 'utf8'), '손으로 쓴 원본 지시문', '정션을 통해 손 파일이 덮였다');
  assert.equal(fs.readFileSync(path.join(pack, '_순서.json'), 'utf8'), 앞순서);
  // --덮어쓰기: 정션째 _앞<번호>/로 옮기고(가리킨 곳은 그대로) 진짜 폴더를 새로 짓는다
  const 덮음 = 돌리기(편, ['--실행', '--덮어쓰기']);
  assert.equal(덮음.코드, 0, 덮음.stdout + 덮음.stderr);
  assert.equal(fs.readFileSync(path.join(손원본, '지시문.txt'), 'utf8'), '손으로 쓴 원본 지시문');
  assert.equal(fs.readFileSync(path.join(손원본, '1_시작.png'), 'utf8'), '손으로 둔 원본 그림');
  assert.ok(fs.lstatSync(path.join(pack, '003_C3')).isDirectory() && !fs.lstatSync(path.join(pack, '003_C3')).isSymbolicLink(), '새 판 폴더는 진짜 폴더다');
  assert.equal(fs.readFileSync(path.join(pack, '003_C3', '1_시작.png'), 'utf8'), '가짜 그림 C3');
  assert.match(덮음.결과.옮김.join('\n'), /003_C3\/ → _앞1\//);
});

test('링크로 바뀐 관리 파일 · _순서.json에는 쓰지 않는다 — 가리킨 곳(꾸러미 밖)이 덮이지 않게 멈춘다', 건너뜀, (t) => {
  const 편 = 편만들기();
  const pack = path.join(편, '꾸러미');
  assert.equal(돌리기(편, ['--실행']).코드, 0);
  const 밖 = path.join(편, '밖의_원본.txt');
  fs.writeFileSync(밖, '꾸러미 밖의 손 파일', 'utf8');
  fs.rmSync(path.join(pack, '001_C1', '지시문.txt'));
  try { fs.symlinkSync(밖, path.join(pack, '001_C1', '지시문.txt'), 'file'); } catch (e) { return t.skip(`파일 링크를 만들 권한이 없다(${e.code})`); }
  const 막힘 = 돌리기(편, ['--실행']);
  assert.equal(막힘.코드, 1, 막힘.stdout);
  assert.match(막힘.stderr, /이름이 겹친다 — 001_C1\/지시문\.txt\(링크다\)/);
  assert.equal(fs.readFileSync(밖, 'utf8'), '꾸러미 밖의 손 파일', '링크를 통해 꾸러미 밖 파일이 덮였다');
  // _순서.json이 링크면 손 꾸러미로 본다
  fs.rmSync(path.join(pack, '001_C1', '지시문.txt'));
  fs.writeFileSync(path.join(pack, '001_C1', '지시문.txt'), 글.C1, 'utf8');
  fs.rmSync(path.join(pack, '_순서.json'));
  fs.symlinkSync(밖, path.join(pack, '_순서.json'), 'file');
  const 막힘2 = 돌리기(편, ['--실행']);
  assert.equal(막힘2.코드, 1, 막힘2.stdout);
  assert.match(막힘2.stderr, /이름이 겹친다 — _순서\.json\(링크다\)/);
  assert.equal(fs.readFileSync(밖, 'utf8'), '꾸러미 밖의 손 파일');
  assert.equal(돌리기(편, ['--실행', '--덮어쓰기']).코드, 0);
  assert.equal(fs.readFileSync(밖, 'utf8'), '꾸러미 밖의 손 파일', '--덮어쓰기여도 링크째 옮길 뿐 가리킨 곳은 그대로다');
  assert.ok(!fs.lstatSync(path.join(pack, '_순서.json')).isSymbolicLink());
});
test('쓰기는 새 파일을 써서 이름을 바꿔 끼운다 — 하드 링크로 이어진 꾸러미 밖 파일의 내용은 바뀌지 않는다', 건너뜀, () => {
  const 편 = 편만들기();
  const pack = path.join(편, '꾸러미');
  assert.equal(돌리기(편, ['--실행']).코드, 0);
  // 이 도구가 쓴 파일을 꾸러미 밖에서 하드 링크로 같이 쥐고 있다(같은 내용을 나눠 가진 다른 이름) — 그 자리를 열어 덮으면 밖의 이름으로 봐도 내용이 바뀐다
  const 밖지시문 = path.join(편, '밖에서_쥔_지시문.txt'), 밖순서 = path.join(편, '밖에서_쥔_순서.json');
  fs.linkSync(path.join(pack, '001_C1', '지시문.txt'), 밖지시문);
  fs.linkSync(path.join(pack, '_순서.json'), 밖순서);
  const 앞순서 = fs.readFileSync(밖순서, 'utf8');
  // 원고를 고쳐 다시 짓는다 — 판 길이도 바뀌게 컷표의 쓰는 구간을 늘린다
  fs.writeFileSync(path.join(편, '영상지시문', 'C1.txt'), 글.C1 + '\nPHYSICS: the pot stays exactly where she set it.', 'utf8');
  const 표 = path.join(편, '컷표.json');
  const seq = JSON.parse(fs.readFileSync(표, 'utf8'));
  seq.detail.find(d => d.cut === 'C1').out = 6.5;
  fs.writeFileSync(표, JSON.stringify(seq), 'utf8');
  const r = 돌리기(편, ['--실행']);
  assert.equal(r.결과.쓴것, true, r.stdout + r.stderr);
  assert.equal(fs.readFileSync(밖지시문, 'utf8'), 글.C1, '하드 링크를 통해 꾸러미 밖 이름의 내용이 바뀌었다');
  assert.equal(fs.readFileSync(밖순서, 'utf8'), 앞순서, '하드 링크를 통해 꾸러미 밖 이름의 _순서.json이 바뀌었다');
  assert.match(fs.readFileSync(path.join(pack, '001_C1', '지시문.txt'), 'utf8'), /PHYSICS: the pot stays/);
  assert.equal(판(순서(편), 'C1').길이, 7);
  assert.deepEqual(fs.readdirSync(path.join(pack, '001_C1')).sort(), ['1_시작.png', '지시문.txt'], '쓰다 만 임시 파일이 남지 않는다');
});

test('꾸러미 안에서 손으로 고친 관리 파일 · _순서.json은 덮지 않는다 — 이름이 같아도 쓴 그대로가 아니면 멈춘다', 건너뜀, () => {
  const 편 = 편만들기();
  const pack = path.join(편, '꾸러미');
  assert.equal(돌리기(편, ['--실행']).코드, 0);
  assert.equal(돌리기(편, ['--실행']).코드, 0, '아무것도 안 바꾸고 다시 돌리면 그대로 지나간다');
  // 꾸러미 안의 지시문을 손으로 고쳤다(원고 영상지시문/C2.txt가 아니라) — 다시 지으면 그 고침이 사라진다
  const 손고침 = 글.C2 + '\n(꾸러미 안에서 손으로 덧붙인 줄)';
  fs.writeFileSync(path.join(pack, '002_C2', '지시문.txt'), 손고침, 'utf8');
  const 막힘 = 돌리기(편, ['--실행']);
  assert.equal(막힘.코드, 1, 막힘.stdout);
  assert.match(막힘.stderr, /이름이 겹친다 — 002_C2\/지시문\.txt\(쓴 뒤 바뀌었다\)/);
  assert.match(막힘.stderr, /꾸러미 안에서 손으로 고친 것은 영상지시문 · 컷표로 옮긴 뒤 다시 돌린다/);
  assert.equal(fs.readFileSync(path.join(pack, '002_C2', '지시문.txt'), 'utf8'), 손고침);
  // 그 고침을 원고로 옮기면(꾸러미의 내용 = 새로 쓸 내용) 잃을 것이 없으니 지나간다
  fs.writeFileSync(path.join(편, '영상지시문', 'C2.txt'), 손고침, 'utf8');
  assert.equal(돌리기(편, ['--실행']).코드, 0);
  // _순서.json의 길이를 손으로 고쳤다
  const 순서파일 = path.join(pack, '_순서.json');
  const 손순서 = fs.readFileSync(순서파일, 'utf8').replace('"길이": 5', '"길이": 9');
  fs.writeFileSync(순서파일, 손순서, 'utf8');
  const 막힘2 = 돌리기(편, ['--실행']);
  assert.equal(막힘2.코드, 1, 막힘2.stdout);
  assert.match(막힘2.stderr, /이름이 겹친다 — _순서\.json\(쓴 뒤 바뀌었다\)/);
  assert.equal(fs.readFileSync(순서파일, 'utf8'), 손순서);
  // --덮어쓰기: 손으로 고친 판을 _앞1/로 옮기고 새로 쓴다
  const 덮음 = 돌리기(편, ['--실행', '--덮어쓰기']);
  assert.equal(덮음.코드, 0, 덮음.stdout + 덮음.stderr);
  assert.equal(fs.readFileSync(path.join(pack, '_앞1', '_순서.json'), 'utf8'), 손순서);
  assert.equal(판(순서(편), 'C1').길이, 5);
  // 이번 판에는 안 쓰는 관리 파일도 쓴 뒤 바뀌었으면 지우지 않고 알린다
  const 표 = path.join(편, '컷표.json');
  const seq = JSON.parse(fs.readFileSync(표, 'utf8'));
  seq.detail.find(d => d.cut === 'C3').끝그림 = '정지/C4.png';
  fs.writeFileSync(표, JSON.stringify(seq), 'utf8');
  fs.writeFileSync(path.join(편, '영상지시문', 'C3.txt'), 글.C3.replace('first frame of this video.', 'first frame of this video. @이미지 2 is the exact last frame.'), 'utf8');
  assert.equal(돌리기(편, ['--실행']).코드, 0);
  fs.writeFileSync(path.join(pack, '003_C3', '2_끝.png'), '손으로 바꾼 끝 그림');
  delete seq.detail.find(d => d.cut === 'C3').끝그림;
  fs.writeFileSync(표, JSON.stringify(seq), 'utf8');
  fs.writeFileSync(path.join(편, '영상지시문', 'C3.txt'), 글.C3, 'utf8');
  const r = 돌리기(편, ['--실행']);
  assert.equal(r.코드, 0, r.stdout + r.stderr);
  assert.equal(fs.readFileSync(path.join(pack, '003_C3', '2_끝.png'), 'utf8'), '손으로 바꾼 끝 그림');
  assert.match(r.결과.남김.join('\n'), /003_C3\/2_끝\.png — 쓴 뒤 바뀌어 지우지 않았다/);
});

test('임시 파일은 배타적으로 새로 만든다 — 같은 이름으로 미리 있던 파일(꾸러미 밖 하드 링크)을 열어 덮지 않는다', 건너뜀, () => {
  const 뿌리폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-pack-tmp-'));
  const py = `
import importlib.util, os, sys
from pathlib import Path
spec = importlib.util.spec_from_file_location("꾸러미", sys.argv[1])
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
뿌리 = Path(sys.argv[2]); 판 = 뿌리 / "판"; 판.mkdir()
밖 = 뿌리 / "밖의_원본.txt"; 밖.write_text("꾸러미 밖의 손 파일", encoding="utf-8")
자리 = 판 / "지시문.txt"
미리 = 판 / f"지시문.txt.쓰는중-{os.getpid()}"   # 예전 판이 쓰던 예측할 수 있는 임시 이름 — 밖의 원본과 하드 링크로 이어 둔다
os.link(밖, 미리)
m.바꿔쓰기(자리, "새 지시문".encode("utf-8"))
print(자리.read_text(encoding="utf-8"), "|", 밖.read_text(encoding="utf-8"), "|", 미리.read_text(encoding="utf-8"), "|", sorted(x.name.split("-")[0] for x in 판.iterdir()))
`;
  const r = spawnSync('python', ['-I', '-X', 'utf8', '-c', py, 도구, 뿌리폴더], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout.trim(), "새 지시문 | 꾸러미 밖의 손 파일 | 꾸러미 밖의 손 파일 | ['지시문.txt', '지시문.txt.쓰는중']");
  fs.rmSync(뿌리폴더, { recursive: true, force: true });
});
