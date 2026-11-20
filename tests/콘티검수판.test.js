// 콘티 검수 판(tools/콘티검수판.py) — 이미지 콘티를 「처음 보는 시청자」가 시간 순서대로 보게 만드는 판 · 컷 표 · 지시문.
// 왜 있나: 11-20 공모전 편(제출 전이라 작품 내용은 적지 않는다)이 컷마다 지적을 반영하며 38컷 3분 35초에서 61컷 5분 7초로 늘었는데,
//   편 전체를 시간 순서로 본 눈이 없어 핵심 꺾임이 전체의 76% 자리까지 밀린 것을 아무도 재지 않았다. 처음 보는 시청자에게는 만든 사람의
//   제목 · 감정 낱말 · 메모가 가면 안 된다 — 이 시험은 판이 그 조건을 지키는지 본다(글 정본: 슬롭 점검표 「심사 지시문」의 시청자 검수 문단).
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 도구 = path.join(__dirname, '..', 'tools', '콘티검수판.py');
const 파이 = (인자, 더 = {}) => spawnSync('python', ['-I', '-X', 'utf8', ...인자], { encoding: 'utf8', ...더 });
const 파이썬 = 파이(['-c', 'import PIL; print(1)']).status === 0;
const 건너뜀 = !파이썬 && '파이썬 · PIL 없음';

// 가짜 편 — 컷마다 만든 사람의 글(제목 · 메모 · 넘어옴 · 타당성 · 감정자리 · 앵글 까닭)에 「비밀」 낱말을 넣어 둔다. 판과 컷 표에 그 낱말이 새면 걸린다.
function 가짜편({ 컷수 = 11, 크기 = [320, 180], 없는 = ['C4'], 그림 = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-콘티검수판-'));
  fs.mkdirSync(path.join(dir, '정지'));
  const detail = [];
  for (let i = 1; i <= 컷수; i += 1) {
    detail.push({
      cut: `C${i}`, t: (i - 1) * 4, dur: 4, band: i < 4 ? '기' : '승', 시작그림: `정지/C${i}.png`,
      line: `제목비밀 ${i} — 혼자 우는 사람`, 장면: '부엌', 인물: ['수아'],
      구도: i === 3 ? 'C2와 같은 구도 · 정면' : `허리 위 · 옆 ${i}`,
      앵글: { 크기: '허리 위', 높이: '눈높이', 방향: '옆', 까닭: '까닭비밀' },
      감정자리: '수아 — 감정자리비밀', 카메라: '0~4.5s 고정',
      연기: [{ t: 0.5, 무엇: `숟가락을 든다 ${i}` }, { t: 2, 무엇: '끝 모습 — 내려놓는다' }],
      넘어옴: '넘어옴비밀', 타당성: '타당성비밀', 메모: '메모비밀 유호님 11-20 말씀',
      소리: i === 5 ? '0.5초 C1의 그 소리 · 2초 수아 「잠깐만」' : i === 7 ? '물 끓는 소리 — 유호님 11-20 말씀대로' : '물 끓는 소리',
      소품: { 그릇: '상 위' },
    });
  }
  fs.writeFileSync(path.join(dir, '컷표.json'), JSON.stringify({ 틀: 2, end: 컷수 * 4, detail }), 'utf8');
  if (그림) {
    const 이름 = detail.map((d) => d.cut).filter((c) => !없는.includes(c));
    const r = 파이(['-c', 'import sys\nfrom PIL import Image\nd, w, h = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])\nfor c in sys.argv[4:]:\n    Image.new("RGB", (w, h), (120, 60, 30)).save(d + "/" + c + ".png")',
      path.join(dir, '정지'), String(크기[0]), String(크기[1]), ...이름]);
    assert.equal(r.status, 0, r.stderr);
  }
  return dir;
}
function 돌리기(dir, 더 = []) {
  const 밖 = path.join(dir, '밖');
  const r = 파이([도구, dir, '--밖', 밖, '--json', ...더]);
  return { r, 밖, 결과: r.status === 0 ? JSON.parse(r.stdout) : null };
}

test('판은 시간 순서대로 여럿으로 나뉘고, 컷 표에는 만든 사람의 제목 · 메모 · 넘어옴 · 타당성 · 감정자리 · 앵글 까닭이 없다', { skip: 건너뜀 }, () => {
  const dir = 가짜편();
  const { r, 밖, 결과 } = 돌리기(dir);
  assert.equal(r.status, 0, r.stderr);
  // 11컷 → 한 판 4칸, 판 3장(판 한 장을 보고 바로 적는 읽기가 뜻을 가지려면 판이 여럿이어야 한다)
  assert.equal(결과.컷, 11);
  assert.equal(결과.한판, 4);
  assert.equal(결과.판, 3);
  assert.equal(결과.세로, false);
  for (const n of [1, 2, 3]) assert.ok(fs.existsSync(path.join(밖, `판_${n}.jpg`)), `판_${n}.jpg`);
  assert.ok(!fs.existsSync(path.join(밖, '판_4.jpg')));
  // 그림이 없는 컷은 「그림 없음」으로 두고 목록에 낸다 — 큰 그림도 만들지 않는다
  assert.deepEqual(결과.그림없음, ['4번(C4)']);
  assert.ok(fs.existsSync(path.join(밖, '컷', '03.jpg')) && !fs.existsSync(path.join(밖, '컷', '04.jpg')) && fs.existsSync(path.join(밖, '컷', '11.jpg')));
  const 표 = fs.readFileSync(path.join(밖, '컷표_검수용.md'), 'utf8');
  assert.equal(표.split('\n').filter((l) => /^\| \d+ \|/.test(l)).length, 11);
  for (const 낱 of ['제목비밀', '혼자 우는', '까닭비밀', '감정자리비밀', '넘어옴비밀', '타당성비밀', '메모비밀', '상 위']) assert.ok(!표.includes(낱), `컷 표에 「${낱}」이 샜다`);
  assert.ok(!/\| 기 \||\| 승 \|/.test(표), '기승전결 표시가 샜다');
  // 화면 = 구도 + 카메라 + 연기, 소리는 그대로
  assert.ok(표.includes('허리 위 · 옆 1. 카메라 0~4.5s 고정. 0.5초 숟가락을 든다 1 → 2초 끝 모습 — 내려놓는다'), 표.split('\n')[4]);
  assert.ok(표.includes('수아 「잠깐만」'));
});

test('글 속의 컷 이름은 보는 순서 번호로 바뀌고 조사도 받침에 맞는다 · 화면과 소리 칸에 섞인 메모는 알린다', { skip: 건너뜀 }, () => {
  const { r, 밖, 결과 } = 돌리기(가짜편());
  assert.equal(r.status, 0, r.stderr);
  const 표 = fs.readFileSync(path.join(밖, '컷표_검수용.md'), 'utf8');
  assert.ok(표.includes('2번과 같은 구도'), '「C2와」 → 「2번과」');
  assert.ok(표.includes('1번의 그 소리'), '「C1의」 → 「1번의」');
  assert.ok(!/C\d/.test(표), '컷 이름이 남았다');
  assert.deepEqual(결과.메모의심, ['7번(C7)']);   // 소리 칸에 「유호님 11-20」 — 도구는 지우지 않고 알린다
});

test('지시문 사본에 이 편의 수가 채워진다 — 판 · 컷 · 길이 · 관심 곡선 단위', { skip: 건너뜀 }, () => {
  const { r, 밖, 결과 } = 돌리기(가짜편());
  assert.equal(r.status, 0, r.stderr);
  assert.equal(결과.지시문, true);
  const 글 = fs.readFileSync(path.join(밖, '지시문_시청자.md'), 'utf8');
  assert.ok(글.startsWith('# 처음 보는 시청자 검수'), 글.slice(0, 40));
  assert.ok(!/[{}]/.test(글), '채우지 않은 자리가 남았다');
  assert.ok(글.includes('`판_1.jpg` ~ `판_3.jpg`: 컷 11장'));
  assert.ok(글.includes('`컷/01.jpg` ~ `컷/11.jpg`'));
  assert.ok(글.includes('44초 길이 영상'));
  assert.ok(글.includes('0:00부터 10초 단위로'));
  assert.ok(!글.includes('쓰는 법') && !글.includes('맡기는 글'), '만드는 사람에게 주는 머리말이 검수자 글에 샜다');
});

test('세로 영상은 열 장씩 세로 칸으로 · --그림 폴더의 그림이 시작그림보다 먼저다', { skip: 건너뜀 }, () => {
  const dir = 가짜편({ 컷수: 31, 크기: [180, 320], 없는: [] });
  const 다른 = path.join(dir, '다른그림');
  fs.mkdirSync(다른);
  assert.equal(파이(['-c', 'import sys\nfrom PIL import Image\nImage.new("RGB", (200, 100), (0, 0, 255)).save(sys.argv[1])', path.join(다른, 'C1.jpg')]).status, 0);
  const { r, 밖, 결과 } = 돌리기(dir, ['--그림', 다른]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(결과.세로, true);
  assert.equal(결과.한판, 10);
  assert.equal(결과.판, 4);
  const 크기 = 파이(['-c', 'import sys\nfrom PIL import Image\nprint(*Image.open(sys.argv[1]).size, *Image.open(sys.argv[2]).size)', path.join(밖, '컷', '01.jpg'), path.join(밖, '컷', '02.jpg')]).stdout.trim();
  assert.equal(크기, '200 100 180 320');   // 1번은 --그림 폴더의 가로 그림, 2번은 시작그림의 세로 그림
});

test('그림이 한 장도 없으면 만들지 않는다 · 컷표가 없어도 멈춘다(끝 코드 1)', { skip: 건너뜀 }, () => {
  const a = 돌리기(가짜편({ 그림: false }));
  assert.equal(a.r.status, 1);
  assert.match(a.r.stderr, /그림이 한 장도 없다/);
  assert.ok(!fs.existsSync(path.join(a.밖, '컷표_검수용.md')));
  const 빈 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-콘티검수판-'));
  const b = 돌리기(빈);
  assert.equal(b.r.status, 1);
  assert.match(b.r.stderr, /컷표가 없다/);
});
