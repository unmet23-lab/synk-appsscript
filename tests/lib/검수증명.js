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
  // 백엔드는 GPT 하나(2026-10-24), 화면은 아르곤 → Fable 최종
  if (종류 === '백엔드') await 도구.GPT보내기(폴더, 목록, { call, 몫 });
  else {
    await 도구.아르곤보내기(폴더, 목록, { call, 몫 });
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

/** 고친 뒤 바뀐 diff만 다시 본 증거(검수묶음 다시): 다시 볼 지적은 모두 풀렸다고, 새 지적은 없다고 답한다. 끝 폴더를 돌려준다. */
async function 다시증거({ 앞, 저장소, 배포후보 = null, 폴더 }) {
  const 도구 = await import(pathToFileURL(path.resolve(__dirname, '../../tools/검수묶음.mjs')));
  const { 목록 } = await 도구.다시하기({ 이름: path.basename(폴더), 폴더, 앞, 저장소, ...(배포후보 ? { 배포후보 } : {}) });
  const 답 = prompt => JSON.stringify({ findings: [], targets: [...prompt.matchAll(/^- \[(Q\d+)\]/gm)].map(x => ({ id: x[1], resolved: true, note: '고친 diff에서 확인' })),
    seen: [...prompt.matchAll(/^### \[([^\]]+)\]/gm)].map(x => x[1]), coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] },
    endMarker: /자료 끝 표식: (\S+)\s*$/.exec(prompt)[1] });
  const 몫 = async () => ({ 주간: 0.5, 다섯시간: 0.5 });
  for (const 누구 of 목록.검수자들) {
    if (누구 === 'GPT' || 누구 === '아르곤') await 도구[`${누구}보내기`](폴더, 목록, { call: async ({ prompt }) => ({ text: 답(prompt), selectedModel: 'fixture-reviewer' }), 몫 });
    else 도구.검수받기(폴더, 누구, 목록.묶음[0].이름, 답(fs.readFileSync(path.join(폴더, 목록.묶음[0].파일), 'utf8')));
  }
  const r = await 도구.검수확인(폴더, { 저장소 });
  if (!r.통과) throw new Error(`시험 다시 검수 증거 생성 실패: ${(r.사유 || []).join(' / ')}`);
  return 폴더;
}

module.exports = { 검수증거, 다시증거 };
