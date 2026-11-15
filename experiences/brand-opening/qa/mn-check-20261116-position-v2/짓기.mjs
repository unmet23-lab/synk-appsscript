// 「내 위치」 2판 몽골어 검문 묶음 짓기(11-16): 화면을 읽는 차례대로 열쇠와 값을 적은 *.keys에서 한국어 · 몽골어 블록 파일(*.txt, git 밖)을 만든다.
//   node experiences/brand-opening/qa/mn-check-20261116-position-v2/짓기.mjs  → story.txt · variants.txt
// 그다음: node tools/몽골어대조.js --파일 <txt> --구독
import fs from 'node:fs';import path from 'node:path';
import {t} from '../../world-lang.mjs';
const dir=import.meta.dirname;
for(const name of ['story','variants']){
 const rows=fs.readFileSync(path.join(dir,`${name}.keys`),'utf8').split(/\r?\n/).filter(line=>line.trim()&&!line.startsWith('#'));
 // 한 줄 = 「열쇠 {json 값}」을 ' — '로 이은 화면 한 줄(이름 — 글). 한 칸에 열쇠가 둘 이상이면(화면이 빈칸으로 잇는 글) 빈칸으로 잇는다.
 const line=(row,lang)=>row.split(' — ').map(part=>part.split(/ (?=position\.)/).map(piece=>{const m=piece.match(/^(\S+)(?:\s+(\{.*\}))?$/);return t(m[1],m[2]?JSON.parse(m[2]):undefined,lang);}).join(' ')).join(' — ');
 const ko=rows.map(row=>line(row,'ko')),mn=rows.map(row=>line(row,'mn'));
 for(const text of [...ko,...mn])if(/position\.|goal\./.test(text))throw Error('열쇠가 그대로 남음: '+text);
 fs.writeFileSync(path.join(dir,`${name}.txt`),`${ko.join('\n')}\n---\n${mn.join('\n')}\n`);
 console.log(`${name}.txt ${rows.length}줄`);
}
