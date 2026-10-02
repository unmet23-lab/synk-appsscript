'use strict';
const fs=require('node:fs'),path=require('node:path');
const script=require('./narration-script.json'),timing=require('./장면타이밍.json');
const lines=script.segments.map(s=>`### ${s.id}\n\n${s.text}`).join('\n\n');
fs.writeFileSync(path.join(__dirname,'원고.md'),`# 1편 쇼츠 수정 원고\n\n2026-09-22. ${script.segments.reduce((n,s)=>n+s.text.length,0)}자, ${script.segments.length}구간. 정의로는 임시 목소리이며 추후 유호 육성으로 교체할 수 있다.\n\n${lines}\n\n## 사실과 각색\n\n첫 결제일과 번역 목적, 학원 근무, 학생 문의 증가, 부모 알림의 구상, Glide와 Google Sheets 첫 시도, 코딩을 전혀 모르던 상태와 스크린샷 반복은 사용자 회고에 근거한다. 문의 증가를 등록생 증가로 바꾸지 않는다.\n\n부모 알림과 교사 편의는 당시의 목표다. 앱의 구현 완료나 현장 사용 성과가 아니다. 17~18시간은 주관적 회고이며 권장 학습량이 아니다. 출석 앱 대신 괴상한 것을 만들고 있었다는 표현은 사용자 요청을 다듬은 대사다. 뒤틀린 앱 화면과 심심함 해결은 맥락 안에서 각색한 연출이다. 반복 수정 뒤 한숨과 머리를 확인하는 농담은 사용자가 직접 제안한 코믹 대사이며 실제 탈모 진단을 뜻하지 않는다.\n\n12~14번은 현재 시청자에게 제안하는 방법으로 당시 실제 첫 프롬프트가 아니다. 인물은 사용자가 제공한 유호 프로필 얼굴과 그림 몸체를 합성했다. 작업 화면은 재구성이며 실제 학생 데이터를 표현하지 않는다. 100시간은 처음부터 설정을 알았더라면 시간을 아꼈을 것이라는 개인적 가정으로, 실측 결과나 시청자 절감 보장이 아니다.\n`);
let html=fs.readFileSync(path.join(__dirname,'_src_preview.html'),'utf8');
html=html.replace('__MIDDLE__',String(timing.scenes.find(s=>s.visual==='screenshots').start/30)).replace('__ENDING__',String(timing.scenes.at(-1).start/30)).replace('쇼츠 리듬 수정본 · 새 성우 내레이션','59초 · 정의로 임시 내레이션 · 쇼츠 수정본');
html=html.replace(/data-time="[\d.]+">마무리/,`data-time="${timing.scenes.find(s=>s.visual==='ending').start/30}">마무리`).replace(/\d+초 · 정의로 임시 내레이션 · 쇼츠 수정본/,`${Math.round(timing.durationInFrames/30)}초 · 정의로 임시 내레이션 · 엔딩·얼굴 수정본`);
html=html.replace(/data-time="[\d.]+">표정·눈물/,`data-time="${timing.scenes.find(s=>s.visual==='zero').start/30}">표정·눈물`).replace(/<p class="spec">[^<]+<\/p>/,`<p class="spec">${Math.round(timing.durationInFrames/30)}초 · 정의로 임시 내레이션 · 괴상한 앱 대사·눈물 수정본</p>`);
if(!html.includes('>수정한 템포</button>')&&!html.includes('>수정한 대사</button>')&&!html.includes('>입력 예시</button>'))html=html.replace('<button type="button" data-time="0">처음부터</button>',`<button type="button" data-time="0">처음부터</button><button type="button" data-time="${timing.scenes.find(s=>s.visual==='purpose').start/30}">수정한 템포</button>`);
html=html.replace(/data-time="[\d.]+">(?:수정한 (?:템포|대사)|입력 예시)/,`data-time="${timing.scenes.find(s=>s.visual==='prompt').start/30}">입력 예시`);
if(!html.includes('>수정한 장면</button>'))html=html.replace('<button type="button" data-time="0">처음부터</button>',`<button type="button" data-time="0">처음부터</button><button type="button" data-time="${timing.scenes.find(s=>s.visual==='screenshots').start/30}">수정한 장면</button>`);
html=html.replace(/data-time="[\d.]+">수정한 장면/,`data-time="${timing.scenes.find(s=>s.visual==='screenshots').start/30}">수정한 장면`);
fs.writeFileSync(path.join(__dirname,'_src_preview.html'),html);
// Prompt card is a reusable example; placeholder is shown, not spoken.
// Plain reading script for Yuho's future recording; no directions mixed into spoken lines.
fs.writeFileSync(path.join(__dirname,'육성녹음용_대본.txt'),script.segments.map(s=>s.text).join('\n\n')+'\n');
console.log('Script, recording copy and preview chapters ready.');
