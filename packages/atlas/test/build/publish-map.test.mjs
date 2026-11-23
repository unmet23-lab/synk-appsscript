// 빌드한 나무의 지도가 공개 전 확인(tools/publish.mjs)의 올리기 목록에 모두 든다(설계 주인 11-20 — 선택 공개 2단계 전).
// 지도가 빠지면 켜진 길의 코치가 지도를 못 받아(MAP_FAILED) 목록의 계정이 모두 지금 판으로 돌아간다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { build } from '../../tools/build.mjs';
import { subjectTool } from '../support/subject.mjs';
import { tempDir } from '../support/temp.mjs';

const { checkPublish, publishItems, mapProblems } = await subjectTool('publish.mjs');
const { mapFileNames } = await subjectTool('map-ship.mjs');
const built = await build({
  out: tempDir('atlas-publish-map-'),
  state: { commit: 'c'.repeat(40), dirty: false },
});
const filesUnder = dir =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap(entry =>
      entry.isDirectory() ? filesUnder(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
    );

test('빌드한 manifest의 지도 파일이 모두 올리기 목록에 있고, 목록은 빌드 나무의 파일과 꼭 같다', () => {
  const items = publishItems(built.manifest, built.edition);
  const mapNames = Object.keys(built.manifest.map?.files ?? {});
  assert.ok(mapNames.length > 0, '빌드에 지도가 없다');
  for (const name of mapNames)
    assert.ok(items.includes(`atlas/${built.edition}/map/${name}`), `map/${name}`);
  const tree = filesUnder(path.join(built.out, 'atlas'))
    .map(file => path.relative(built.out, file).replace(/\\/g, '/'))
    .sort();
  assert.deepEqual([...items].sort(), tree);
});

test('빌드한 지도가 공개 전 확인의 지도 검사를 문제 없이 지난다 — 이름 집합이 빌드 규칙과 같고 조각이 나무의 색인에서 다시 선다(GPT GA2 · GA3 · Fable 설계 검토)', () => {
  const mapDir = path.join(built.out, 'atlas', built.edition, 'map');
  const table = built.manifest.map?.files ?? {};
  assert.deepEqual(mapProblems(mapDir, table), []);
  const index = JSON.parse(fs.readFileSync(path.join(mapDir, 'index.json'), 'utf8'));
  assert.deepEqual(Object.keys(table).sort(), mapFileNames(index).sort());
  // 틀 줄에만 있는 은행(드라마 시범 · 한글 무대)의 조각 — 문항 줄만 읽던 검사가 놓친 갈래(GPT GA3)
  for (const bank of ['drama-pilot', 'hangul-stage'])
    assert.ok(Object.hasOwn(table, `items/${bank}.json`), bank);
});

// 진단의 레이싱 조각(단계 4 계획 §25-4)은 은행 조각이 아니라 이름 붙인 조각이다 — 올리기 목록 · 해시 검사 · 조각 다시 세우기에 함께 든다.
test('진단의 레이싱 조각이 올리기 목록에 들고, 바이트가 바뀌면 해시 검사와 조각 다시 세우기가 잡는다', async () => {
  const name = 'items/korean-racing-diagnostic.json';
  const items = publishItems(built.manifest, built.edition);
  assert.ok(items.includes(`atlas/${built.edition}/map/${name}`));
  const copy = tempDir('atlas-publish-diag-');
  fs.cpSync(path.join(built.out, 'atlas'), path.join(copy, 'atlas'), { recursive: true });
  const file = path.join(copy, 'atlas', built.edition, 'map', name);
  const slice = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...slice, items: slice.items.slice(1) }));
  const { problems } = await checkPublish({
    out: copy,
    fetcher: async () => assert.fail('받지 않는다'),
  });
  assert.ok(problems.includes(`map/${name}이 manifest와 다르다`), problems.join('\n'));
  assert.ok(
    problems.includes(`map/${name}이 map/index.json · words.json에서 나온 조각과 다르다`),
    problems.join('\n'),
  );
});
