'use strict';
module.exports = async function* (source) {
  for await (const event of source) {
    if (!['test:pass', 'test:fail', 'test:summary'].includes(event.type)) continue;
    const data = event.data || {}, error = data.details?.error;
    yield JSON.stringify({ event: event.type, name: data.name, file: data.file, nesting: data.nesting,
      skip: data.skip || false, todo: data.todo || false, duration_ms: data.details?.duration_ms, counts: data.counts,
      error: error ? { code: error.code, message: error.message } : undefined }) + '\n';
  }
};
