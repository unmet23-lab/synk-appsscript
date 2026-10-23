'use strict';
// 배포 통합시험 전용: 실제 증거 포맷을 만들되 LLM·계정·네트워크를 부르지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function 검수증거({ 저장소, 바탕, 배포후보, 폴더 }) {
  const 도구 = await import(pathToFileURL(path.resolve(__dirname, '../../tools/검수묶음.mjs')));
  const 후보 = JSON.parse(fs.readFileSync(path.join(배포후보, '후보.json'), 'utf8'));
  const 기준전용 = 후보.항목.length && 후보.항목.every(x => /^\.github\/site-check\/baseline\/.+\.(?:json|png|jpe?g|webp)$/i.test(x.경로));
  const 종류 = 후보.종류 === 'synk.im' && !기준전용 ? '화면' : '백엔드';
  const { 목록 } = await 도구.준비하기({ 이름: path.basename(폴더), 저장소, 바탕, 배포후보, 폴더, 종류 });
  const call = async ({ prompt }) => ({ text: JSON.stringify({
    findings: [], seen: [...prompt.matchAll(/^### \[([^\]]+)\]/gm)].map(x => x[1]),
    coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] },
    endMarker: /자료 끝 표식: (\S+)\s*$/.exec(prompt)[1],
  }), selectedModel: 'fixture-reviewer' });
  const 몫 = async () => ({ 주간: 0.5, 다섯시간: 0.5 });
  await 도구.아르곤보내기(폴더, 목록, { call, 몫 });
  if (종류 === '백엔드') await 도구.GPT보내기(폴더, 목록, { call, 몫 });
  else {
    await 도구.페이블하기(폴더, { 시험: false, 캡처: false });
    const { 증명 } = JSON.parse(fs.readFileSync(path.join(폴더, '페이블자료.json'), 'utf8'));
    도구.페이블받기(폴더, JSON.stringify({ findings: [], argonReview: [],
      coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] },
      seen: 증명.항목, reviewInputHash: 증명.검토입력해시, endMarker: 증명.표식 }));
  }
  const r = await 도구.검수확인(폴더, { 저장소 });
  if (!r.통과) throw new Error(`시험 검수 증거 생성 실패: ${(r.사유 || []).join(' / ')}`);
  return 폴더;
}

module.exports = { 검수증거 };
