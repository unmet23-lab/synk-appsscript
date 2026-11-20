// 빌드한 나무의 지도가 공개 전 확인(tools/publish.mjs)의 올리기 목록에 모두 든다(설계 주인 11-20 — 선택 공개 2단계 전).
// 지도가 빠지면 켜진 길의 코치가 지도를 못 받아(MAP_FAILED) 목록의 계정이 모두 지금 판으로 돌아간다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { build } from '../../tools/build.mjs';
import { subjectTool } from '../support/subject.mjs';
import { tempDir } from '../support/temp.mjs';

const { publishItems } = await subjectTool('publish.mjs');
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
