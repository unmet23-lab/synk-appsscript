'use strict';
// 자산 선택 정의만 검사한다. 영상 생성·렌더·배포·음악 재인코딩은 실행하지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n/g, '\n');
// 10-19: 무대 층(무대.html·미리보기)은 결 셋을 세 친구와 장면째 구운 그림으로 바꿨다(반딧불노을들판은 10-05 거절로 뺌).
// 송출 도구(겹쳐송출.js — 서버가 돌리는 판)와 옛 정지 원본·영상 굽기 도구(아래 keys)는 09-09 선별 네 장 그대로다.
// 송출 쪽 결 이름을 줄이면 서버 조율.json 과 어긋날 때 송출이 시작 전에 멈추므로(보존 목록 검사), 반영할 때 같이 고친다.
const scenes = ['추석보름달마당', '전자네온물가', '거울수면과문'];
const 송출결 = [...scenes, '반딧불노을들판'];
const keys = ['chuseok', 'neon_water', 'dream_water', 'dream_field'];
function constant(file, name, context = {}) {
  const m = read(file).match(new RegExp('const ' + name + ' = (\\{[\\s\\S]*?\\n\\});'));
  assert.ok(m, file + ': ' + name);
  return vm.runInNewContext('(' + m[1] + ')', context);
}
const stage = 'bots/오버레이/무대.html';

test('세 친구 장면 세 장의 경로가 정확하고 삭제·거절한 키를 재사용하지 않는다', () => {
  const paths = constant(stage, '무대파일표');
  assert.deepEqual(Object.keys(paths), scenes);
  for (const scene of scenes) assert.equal(paths[scene], `../../docs/Loom_자산/라디오장면/${scene}/장면.webp`, scene);
  for (const source of Object.values(paths)) assert.ok(fs.existsSync(path.resolve(root, 'bots/오버레이', source)), source);
  for (const removed of ['반딧불노을들판', '드림물결', '드림들판', '드림하늘', '전자밤도시', '시티팝노을휴양지', '차분달빛호수', '집안밤공부']) {
    assert.equal(Object.hasOwn(paths, removed), false, removed);
  }
});

test('미리보기는 동일한 세 장을 표시하고 기본 장면은 한옥 마당(추석보름달마당 열쇠)이다', () => {
  const preview = read('bots/오버레이/방송미리보기.html');
  const table = preview.match(/const 결표 = \[([\s\S]*?)\n\];/)[1];
  assert.deepEqual([...table.matchAll(/\['([^']+)'/g)].map(m => m[1]), scenes);
  assert.match(preview, /src="무대\.html\?결=추석보름달마당"/);
  assert.match(read(stage), /무대세우기\(인자\.get\('결'\) \|\| '추석보름달마당', true\)/);
});

test('옛 그림을 잰 광원 좌표를 새로 구운 장면에 재사용하지 않는다', () => {
  // 10-19: 네온 물가의 등·창·네온, 추석 마당의 달·창 좌표는 옛 그림을 잰 값이라 걷었다. 새 장면을 재면 그때 넣는다.
  const lights = constant(stage, '무대빛');
  assert.deepEqual(Object.keys(lights), []);
});

test('정지 원본·배경 합성 정의는 보존한 실물 네 장만 허용한다', () => {
  const original = constant('tools/라디오무대굽기.js', '무대들');
  const background = constant('tools/라디오배경굽기.js', '장르들', { 색: {} });
  assert.deepEqual(Object.keys(original), keys);
  assert.deepEqual(Object.keys(background), [...keys, '기본']);
  assert.equal(original.neon_water.파일, '보관/전자_네온물가.png');
  assert.equal(background.neon_water.원본, original.neon_water.파일);
  for (const [key, item] of Object.entries(original)) {
    assert.ok(fs.existsSync(path.join(root, 'docs/라디오/무대', item.파일 || `${key}.png`)), key);
  }
});

test('삭제 키와 값 없는 선택은 생성·렌더 시작 전에 실패한다', () => {
  const jobs = [
    ['tools/라디오무대굽기.js', '--장르', 'citypop'],
    ['tools/라디오배경굽기.js', '--장르', 'house'],
    ['tools/무대영상굽기.js', '--결', '드림물결', '--낼', 'unused.mp4'],
    ['tools/라디오무대굽기.js', '--장르'],
    ['tools/라디오배경굽기.js', '--장르'],
  ];
  for (const args of jobs) {
    const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 10000 });
    assert.equal(r.error, undefined, args.join(' '));
    assert.notEqual(r.status, 0, args.join(' '));
    assert.match(r.stdout + r.stderr, /모르는|삭제되었거나/, args.join(' '));
    assert.doesNotMatch(r.stdout + r.stderr, /토큰 갱신|크롬 문|참조 없음|구움 \d/, '입력 검증보다 외부 작업이 먼저 시작됨');
  }
});

test('팩 재굽기는 삭제된 드림 실내 영상과 밤도시 원본을 선택하지 않는다', () => {
  const pack = read('tools/라디오무대만팩.sh');
  assert.match(pack, /chuseok\|neon_water\|house\|dream_water\|dream_field\) ;;/);
  assert.match(pack, /house\|neon_water\) source="\$R\/docs\/라디오\/무대\/보관\/전자_네온물가\.png"/);
  assert.match(pack, /dream_water\) layer="\$R\/docs\/라디오\/무대영상\/층_거울수면과문\.mp4"/);
  assert.match(pack, /dream_field\) layer="\$R\/docs\/라디오\/무대영상\/층_반딧불노을들판\.mp4"/);
  assert.doesNotMatch(pack, /layer="\$R\/docs\/라디오\/무대영상\/층_\$genre\.mp4"/);
  assert.doesNotMatch(pack, /^\s+citypop\|house\)|^\s+calm\)/m);
  assert.match(pack, /out="\$OUT\/_판\/\$\{1\}_선별20260909\.png"/);
  assert.match(pack, /-i "\$OUT\/_판\/\$\{genre\}_선별20260909\.png"/);
});

test('편성 기본 목록과 선택 검수 버튼에 삭제 장면이 남지 않는다', () => {
  const sender = read('bots/오버레이/겹쳐송출.js');
  assert.match(sender, /값\('--장면차례', '추석보름달마당,전자네온물가,거울수면과문,반딧불노을들판'\)/);
  assert.match(sender, /if \(삭제장면\.length\) throw new Error/);
  const names = constant('bots/오버레이/겹쳐송출.js', '결이름');
  assert.deepEqual([...new Set(Object.values(names))].sort(), 송출결.slice().sort());
  for (const file of ['tools/라디오차림검수보기.cjs', 'tools/라디오차림브라우저검수.cjs']) {
    assert.match(read(file), /결:'전자네온물가'/);
    assert.doesNotMatch(read(file), /결:'전자밤도시'/);
  }
});
