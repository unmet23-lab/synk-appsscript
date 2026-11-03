// 레이싱 첫 장면 준비 중 WebGL 컨텍스트 손실: 실제 브라우저 확인은 강제 손실 시험으로 했고, 여기서는 되돌아가면 안 되는 것만 지킨다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareFirstFrame } from '../experiences/korean-racing/startup.js';

const app = readFileSync(new URL('../experiences/korean-racing/app.js', import.meta.url), 'utf8');

test('레이싱: 컴파일 중 컨텍스트가 바뀌면 그린 장면을 내보이지 않고 처음부터 다시 준비한다', async () => {
  let epoch = 0, compiles = 0; const log = [];
  await prepareFirstFrame({
    getState: () => [epoch],
    prepare: () => log.push('prepare'),
    compile: async () => { compiles++; log.push('compile'); if (compiles === 1) epoch += 2; },   // 잃음·복구
    render: () => log.push('render'),
    nextFrame: async () => {},
  });
  assert.deepEqual(log, ['prepare', 'compile', 'prepare', 'compile', 'render']);
});
test('레이싱: 복구 때 예외를 내는 compileAsync를 쓰지 않고, 준비 상태가 컨텍스트 변화를 함께 본다', () => {
  assert.doesNotMatch(app, /\.compileAsync\(/);
  assert.match(app, /devicePixelRatio, glEpoch\]/);
  assert.match(app, /addEventListener\('webglcontextrestored', onContextRestored\)/);
  // 시험용 고침이 예외를 삼키거나 강제로 새로 열지 않는다.
  assert.doesNotMatch(app, /addEventListener\('(error|unhandledrejection)'/);
  assert.doesNotMatch(app.match(/function onContextRestored\(\) \{[\s\S]*?\n\}/)[0], /location\.reload/);
});
