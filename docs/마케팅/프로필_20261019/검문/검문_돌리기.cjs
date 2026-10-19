'use strict';
// 문안.json의 새 문장을 언어별 「한국어 / --- / 번역」 파일로 나눠 tools/현지어대조.js(제미나이 구독 통로)로 차례로 검문한다.
// 몽골어는 tools/몽골어대조.js --구독. 결과는 이 폴더의 <언어>.결과.txt, 요약은 요약.json.
//   node docs/마케팅/프로필_20261019/검문/검문_돌리기.cjs
const fs = require('node:fs'), path = require('node:path');
const { spawnSync } = require('node:child_process');

const here = __dirname;
const repo = path.resolve(here, '../../../..');
const d = JSON.parse(fs.readFileSync(path.join(here, '..', '문안.json'), 'utf8'));
const yt = d.youtube;
const ko = d.youtubeKoreanMeaning;
const para = (k) => yt[k].split('\n\n');
const KO_B = [ko.firstLine, ko.body, ko.mascot].join('\n');

const jobs = [
  { id: 'fil', 언어: '필리핀어(Taglish)', ko: KO_B, tr: para('lab-ph-youtube').slice(0, 3).join('\n') },
  { id: 'pt', 언어: '브라질 포르투갈어', ko: KO_B + '\n하고 싶은 말, 한국어로.', tr: para('lab-br-youtube').slice(0, 3).join('\n') + '\n' + d.banners['lab-br-youtube'].title.join(' ') },
  { id: 'zh-TW', 언어: '대만 번체 중국어', ko: KO_B, tr: para('lab-tw-youtube').slice(0, 3).join('\n') },
  { id: 'th', 언어: '태국어', ko: KO_B, tr: para('lab-th-youtube').slice(0, 3).join('\n') },
  { id: 'id', 언어: '인도네시아어', ko: KO_B, tr: para('lab-id-youtube').slice(0, 3).join('\n') },
  { id: 'ms', 언어: '말레이시아 말레이어', ko: KO_B + '\n뭘 말하고 싶든, 한국어로 말해.', tr: para('lab-my-youtube').slice(0, 3).join('\n') + '\n' + d.banners['lab-my-youtube'].title.join(' ') },
  { id: 'hi', 언어: '힌디어', ko: KO_B, tr: para('lab-in-youtube').slice(0, 3).join('\n') },
  { id: 'ky', 언어: '키르기스어', ko: KO_B, tr: para('lab-kg-youtube').slice(0, 3).join('\n') },
  { id: 'si', 언어: '싱할라어', ko: '한국어 관용구를 3초 안에 맞히며 한국어를 배우자.\n' + ko.body + '\n' + ko.mascot, tr: para('lab-lk-youtube').slice(0, 3).join('\n') },
  { id: 'ta', 언어: '타밀어', ko: '한국어 관용구를 3초 안에 맞히며 한국어를 배우자, 자막과 함께.', tr: para('lab-lk-youtube')[4].split('\n')[0] },
  { id: 'my', 언어: '버마어(미얀마어)', ko: KO_B, tr: para('lab-mm-youtube').slice(0, 3).join('\n') },
  { id: 'fr', 언어: '캐나다 프랑스어', ko: KO_B, tr: yt['lab-ca-youtube'].split('\n').filter((l) => /[éèàçù]|Apprends|Devine|nos trois/.test(l)).join('\n') },
  { id: 'es', 언어: '스페인어(파라과이 보세오·멕시코)', ko: '3초 퀴즈로 한국어를 배우고 바로 써 봐.\n3초 퀴즈로 한국어를 배우고 바로 써 봐.\n하고 싶은 말, 한국어로 말해.\n하고 싶은 말, 한국어로 말해.', tr: [para('lab-py-youtube')[0], para('lab-mx-youtube')[0], d.banners['lab-py-youtube'].title.join(' '), d.banners['lab-mx-youtube'].title.join(' ')].join('\n') },
  { id: 'ja', 언어: '일본어', ko: '3초 퀴즈로, 배워서 바로 쓰는 한국어.', tr: para('lab-jp-youtube')[0] },
  { id: 'vi', 언어: '베트남어', ko: '3초 퀴즈로 한국어를 배우고, 바로 써요!', tr: para('lab-vn-youtube')[0] },
  { id: 'uz', 언어: '우즈베크어(라틴)', ko: d.other['lab-uz-telegram'].korean, tr: d.other['lab-uz-telegram'].description },
  { id: 'zh-CN', 언어: '중국 간체 중국어(샤오훙수)', ko: d.other['lab-cn-xiaohongshu'].korean, tr: d.other['lab-cn-xiaohongshu'].bio },
];

const summary = {};
for (const j of jobs) {
  const f = path.join(here, `${j.id}.txt`);
  fs.writeFileSync(f, `${j.ko}\n---\n${j.tr}\n`, 'utf8');
  const r = spawnSync(process.execPath, [path.join(repo, 'tools/현지어대조.js'), '--언어', j.언어, '--파일', f], { cwd: repo, encoding: 'utf8', timeout: 300000 });
  fs.writeFileSync(path.join(here, `${j.id}.결과.txt`), (r.stdout || '') + (r.stderr || ''), 'utf8');
  const 판정 = ((r.stdout || '').match(/판정:\s*(\S+)/) || [])[1] || '?';
  summary[j.id] = { 종료: r.status, 판정 };
  console.log(j.id, '종료', r.status, '판정', 판정);
}
// 몽골어
{
  const f = path.join(here, 'mn_소개3.txt');
  const r = spawnSync(process.execPath, [path.join(repo, 'tools/몽골어대조.js'), '--파일', f, '--구독'], { cwd: repo, encoding: 'utf8', timeout: 400000 });
  fs.writeFileSync(path.join(here, 'mn_소개3.결과.txt'), (r.stdout || '') + (r.stderr || ''), 'utf8');
  const 판정 = ((r.stdout || '').match(/판정:\s*(\S+)/) || [])[1] || '?';
  summary.mn = { 종료: r.status, 판정 };
  console.log('mn 종료', r.status, '판정', 판정);
}
fs.writeFileSync(path.join(here, '요약.json'), JSON.stringify(summary, null, 2));
