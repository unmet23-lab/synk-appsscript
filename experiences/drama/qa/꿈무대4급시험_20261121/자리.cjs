// 꿈 무대 4급 시험판의 파일 자리. 그림과 영상은 git 밖 공용 작업본의 .tmp에 있다(여학생용 촬영 시험판 README).
// 이 저장소 사본에 .tmp 원천이 있으면 그것을, 없으면(워크트리) 공용 작업본(사용자 문서/SYNK-appsscript)을 쓴다. 환경 SYNK_공용작업본으로 바꾼다.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 저장소 = path.resolve(__dirname, '..', '..', '..', '..');
const 원천이름 = path.join('.tmp', '꿈무대촬영시험_여_20261120');
const 공용 = process.env.SYNK_공용작업본
  || (fs.existsSync(path.join(저장소, 원천이름, '영상')) ? 저장소 : path.join(os.homedir(), 'Documents', 'SYNK-appsscript'));
const 원천 = path.join(공용, 원천이름);
const 밖 = path.join(공용, '.tmp', '꿈무대4급시험_20261121', '시험판');

module.exports = { 저장소, 공용, 원천, 밖 };
