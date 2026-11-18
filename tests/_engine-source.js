const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// 버전 채번과 시험이 공유하는 Apps Script 엔진의 로드 순서다.
const ENGINE_FILES = ['Code.js', '엔진_synkbrief.js'];

// .claspignore가 허용한 루트 JavaScript 파일을 엔진 순서대로 돌려준다.
function liveFiles() {
  const 허용 = fs.readFileSync(path.join(ROOT, '.claspignore'), 'utf8')
    .split(/\r?\n/).filter((l) => l.startsWith('!')).map((l) => l.slice(1).trim())
    .filter((p) => p.endsWith('.js'));
  const 패턴들 = 허용.map((p) => new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'));
  const 실물 = fs.readdirSync(ROOT).filter((f) => f.endsWith('.js') && 패턴들.some((re) => re.test(f)));
  // 순서: 엔진 로드 순 먼저(사람이 읽는 실패 메시지의 안정성) · 나머지는 이름순
  const 뒤 = 실물.filter((f) => !ENGINE_FILES.includes(f)).sort();
  return [...ENGINE_FILES.filter((f) => 실물.includes(f)), ...뒤];
}

module.exports = { ROOT, ENGINE_FILES, liveFiles };
