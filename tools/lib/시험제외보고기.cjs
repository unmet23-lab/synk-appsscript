'use strict';

// node:test의 원래 이벤트에서 제외 이유·위치를 보존한다. 시험 실행이나 판정을 바꾸지 않는다.
const path = require('node:path');

module.exports = async function* 제외보고기(events) {
  for await (const { type, data } of events) {
    if (!['test:pass', 'test:fail'].includes(type) || !data.skip) continue;
    yield JSON.stringify({
      시험: data.name,
      파일: data.file ? path.relative(process.cwd(), data.file).split(path.sep).join('/') : null,
      줄: data.line ?? null,
      열: data.column ?? null,
      까닭: typeof data.skip === 'string' ? data.skip : '명시적 skip',
      종류: data.details?.type || 'test',
    }) + '\n';
  }
};
