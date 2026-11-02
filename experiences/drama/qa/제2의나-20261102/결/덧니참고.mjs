#!/usr/bin/env node
// 제2의 나 태오 참고 세트(정면 · 3/4 · 웃음)를 덧니 선배로 다시 굽는 일감(2026-11-03, 결정 11-02 「쇼케이스 태오 얼굴 = 덧니 선배」 — 옛 태오와 닮음 0.25라 다른 사람).
// 지시문은 결 원고 그대로이고 신원 줄만 `태오_신원_덧니`로 바꿨다. 얼굴이 나노바나나에서 나왔고 셀카도 엔진 B로 정해져(결정 11-02 「셀카 포즈로 나눠 섞기」) 엔진 B로 굽는다.
// 실행기는 쇼케이스 .tmp/taeo-face-nb(시작그림.mjs와 같음). node 덧니참고.mjs → jobs.json에 me2-taeo-* 일감. 닮음은 `닮음표.py taeo <F1> <C4 끝 그림> -- <판…>`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const D = 'C:/Users/q1212/Documents/SYNK-appsscript/.tmp/taeo-face-nb';
const 읽기 = (f) => fs.readFileSync(path.join(여기, '지시문', `${f}.md`), 'utf8').trim();
const jobs = JSON.parse(fs.readFileSync(`${D}/jobs.json`, 'utf8')).filter((j) => !j.id.startsWith('me2-taeo-'));
for (const [각도, 이름] of [['정면', 'front'], ['34', '34'], ['웃음', 'laugh']]) {
 const prompt = ['태오_신원_덧니', `태오_${각도}`, '태오_결', '_계절', '_규칙'].map(읽기).join('\n\n');
 jobs.push({ id: `me2-taeo-${이름}`, ratio: '3:4', refs: [`${D}/refs/f-face.jpg`, `${D}/refs/c4-end.jpg`], prompt, out: `${D}/out/me2-taeo-${이름}_g{n}.png` });
 console.log(이름, prompt.length);
}
fs.writeFileSync(`${D}/jobs.json`, JSON.stringify(jobs, null, 1));
