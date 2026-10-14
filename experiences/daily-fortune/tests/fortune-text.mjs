// 운세 문장 검사 도우미(시험 파일이 아니다). 사주 용어(60갑자·일간 이름)와 '물병자리'는 이름이라 지우고 검사한다.
// 예: 병오년·병화·물병자리에 든 「병」은 질병을 뜻하지 않는다.
import assert from 'node:assert/strict';
import { NAME_TOKENS } from '../fortune-base.mjs';

export const FORBIDDEN = /삼재|사고|이별|불길|파산|병|죽/;
// 단정·공포 표현과 투자·건강·법률 결정 권유도 쓰지 않는다.
export const RISKY = /투자|주식|코인|대출|병원|진료|소송|변호사|계약서|흉|액운|재앙|불운|저주|이혼|사망|질병|아프|최악|불행|헤어지|망한|틀림없/;

const tokens = [...NAME_TOKENS].sort((a, b) => b.length - a.length);
export function stripNames(text) {
  let value = text;
  for (const token of tokens) value = value.split(token).join('');
  return value;
}

export function strings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object') for (const child of Object.values(value)) strings(child, out);
  return out;
}

export function assertGentle(value, label = '') {
  const texts = strings(value);
  for (const text of texts) {
    if (/^[갑을병정무기경신임계자축인묘진사오미유술해]$/.test(text)) continue; // 천간·지지 한 글자 이름 칸(예 dayMaster.hangul '병')
    const clean = stripNames(text);
    assert.doesNotMatch(clean, FORBIDDEN, `${label} 금지어: ${text}`);
    assert.doesNotMatch(clean, RISKY, `${label} 단정·권유 표현: ${text}`);
  }
  return texts.length;
}
