'use strict';
// 계정판 요금표의 synk.im 공개본(synk-policy desktop/ai-prices.json)을 앱 기본 사본(src/ai-prices.cjs의 DEFAULT_PRICES)에서 만든다.
// 공개본은 서비스·출처를 부호로 적어 synk.im에 AI 도구 이름이 남지 않게 한다(배포 점검·공개 도구가 막는다).
// 쓰기: node desktop/tools/ai-prices-public.cjs <내보낼 파일> → node tools/공개.js 올리기 desktop/ai-prices.json=<그 파일>
const fs=require('node:fs'),path=require('node:path');
const {DEFAULT_PRICES,MAX_BYTES,toWire,validatePrices}=require('../src/ai-prices.cjs');
const NAMES=/claude|anthropic|higgsfield|typecast|openai|chatgpt|gpt|gemini/i;
const out=process.argv[2];
if(!out){console.error('사용법: node desktop/tools/ai-prices-public.cjs <내보낼 파일>');process.exit(2);}
const text=JSON.stringify(toWire(DEFAULT_PRICES),null,2)+'\n',now=Date.now();
if(NAMES.test(text))throw new Error('공개본에 서비스 이름이 남았다');
if(Buffer.byteLength(text)>MAX_BYTES)throw new Error('공개본이 32KB를 넘는다');
// 앱이 받는 길(확인한 날 상한을 보는 검사)로 다시 읽어 앱 기본 사본과 같은지 본다.
if(JSON.stringify(validatePrices(JSON.parse(text),now))!==JSON.stringify(validatePrices(DEFAULT_PRICES,now,{trusted:true})))throw new Error('공개본을 다시 읽은 값이 앱 기본 사본과 다르다');
fs.writeFileSync(path.resolve(out),text);
console.log(JSON.stringify({file:path.resolve(out),bytes:Buffer.byteLength(text)}));
