'use strict';
const fs = require('node:fs'), path = require('node:path');
function resolveAuthConfigPath(argv = process.argv, { root = path.resolve(__dirname, '..'), exists = fs.existsSync } = {}) {
  const specified = argv.filter(arg => arg.startsWith('--auth-config='));
  if (specified.length > 1 || specified.length === 1 && !specified[0].slice(14)) throw Error('공개 인증 설정은 --auth-config 경로 하나만 지정해 주세요.');
  if (specified.length) {
    const selected = path.resolve(specified[0].slice(14));
    if (!exists(selected)) throw Error('직접 지정한 공개 인증 설정 파일이 없어요. 경로를 확인해 주세요.');
    return selected;
  }
  const selected = path.resolve(root, 'auth-config.json');
  return exists(selected) ? selected : undefined;
}
module.exports = { resolveAuthConfigPath };
