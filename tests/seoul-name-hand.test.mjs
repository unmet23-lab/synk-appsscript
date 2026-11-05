// 서울행 부스 이름 손글씨(설계 experiences/seoul-arrival/이름손글씨.md): 획 모형 · 판정 · 서명 줄글 · 한글 이름 후보
import test from 'node:test';
import assert from 'node:assert/strict';
import {syllableStrokes,decompose,strokeCount} from '../experiences/seoul-arrival/hangul-strokes.mjs';
import {score,which,samples,encodeSign,decodeSign} from '../experiences/seoul-arrival/name-hand.mjs';
import {hangulName,calledName,isVNName,_rule,NAME_DICT} from '../experiences/seoul-arrival/name-hangul.mjs';
import {nameSyllables} from '../experiences/seoul-arrival/name-trace.mjs';
import {readArrival} from '../experiences/synk-world-app/seoul-record.mjs';
import {L,sub,TEXT_TABLES} from '../experiences/seoul-arrival/strings.mjs';
import fs from 'node:fs';

// 사람이 쓴 것처럼: 모형 획을 3% 안쪽으로 흔들어 쓴다
const wobble=(pts,a=.006)=>samples(pts,.01).map(([x,y],i)=>[x+Math.sin(i*1.7)*a,y+Math.cos(i*2.3)*a]);
const write=ch=>syllableStrokes(ch).map(s=>wobble(s.p));

test('11,172자 모두 획이 나오고 칸 안에 있다', () => {
 for(let c=0xAC00;c<=0xD7A3;c++){
  const ch=String.fromCharCode(c),st=syllableStrokes(ch);
  assert.ok(st&&st.length>=2,ch);
  for(const s of st){assert.ok(s.p.length>=2&&s.j&&s.k,ch);for(const [x,y] of s.p)assert.ok(x>=0&&x<=1&&y>=0&&y<=1&&Number.isFinite(x+y),ch);}
 }
 assert.equal(syllableStrokes('a'),null);assert.equal(syllableStrokes('ㄱ'),null);
});

test('자모 획 수가 쓰기 차례 표와 같다', () => {
 const want={ㄱ:1,ㄴ:1,ㄷ:2,ㄹ:3,ㅁ:3,ㅂ:4,ㅅ:2,ㅇ:1,ㅈ:2,ㅊ:3,ㅋ:2,ㅌ:3,ㅍ:4,ㅎ:3,ㄲ:2,ㄸ:4,ㅃ:8,ㅆ:4,ㅉ:4,
  ㅏ:2,ㅐ:3,ㅑ:3,ㅒ:4,ㅓ:2,ㅔ:3,ㅕ:3,ㅖ:4,ㅗ:2,ㅘ:4,ㅙ:5,ㅚ:3,ㅛ:3,ㅜ:2,ㅝ:4,ㅞ:5,ㅟ:3,ㅠ:3,ㅡ:1,ㅢ:2,ㅣ:1};
 for(const [j,n] of Object.entries(want))assert.equal(strokeCount(j),n,j);
 // 음절의 획 수 = 자모 획 수의 합(볼 = ㅂ4 + ㅗ2 + ㄹ3)
 assert.equal(syllableStrokes('볼').length,9);assert.equal(syllableStrokes('가').length,3);assert.equal(syllableStrokes('닭').length,8);
 assert.deepEqual(decompose('꽝'),{L:'ㄲ',V:'ㅘ',T:'ㅇ'});
});

test('쓰는 차례 · 방향: ㅓ는 짧은 선 먼저, ㅇ은 위에서 왼쪽으로, 가로획은 왼쪽에서', () => {
 const eo=syllableStrokes('어');assert.equal(eo[0].j,'ㅇ');assert.equal(eo[1].k,'h');assert.equal(eo[2].k,'v');
 const o=eo[0].p;assert.ok(o[0][1]<o[Math.floor(o.length/4)][1]&&o[Math.floor(o.length/4)][0]<o[0][0],'ㅇ: 위에서 왼쪽 아래로');
 for(const ch of ['가','볼','르','트'])for(const s of syllableStrokes(ch).filter(s=>s.k==='h'))assert.ok(s.p[0][0]<s.p[s.p.length-1][0],ch);
 for(const ch of ['가','볼','민'])for(const s of syllableStrokes(ch).filter(s=>s.k==='v'))assert.ok(s.p[0][1]<s.p[s.p.length-1][1],ch);
});

test('판정: 모형대로 쓰면 통과하고, 빼먹거나 다른 글자를 쓰면 통과하지 않는다', () => {
 const syl='가나다라마바사아자차카타파하볼로르트에덴응우옌민꽝닭의쩐뚜언샤흐조드엥뭉왕웨이귀값앉빨뺨쌍꿈';
 for(const ch of syl){const m=syllableStrokes(ch),w=write(ch);
  assert.ok(score(m,w).ok,ch+' 그대로');
  assert.ok(!score(m,w.slice(1)).ok,ch+' 첫 획 빼기');assert.ok(!score(m,w.slice(0,-1)).ok,ch+' 끝 획 빼기');}
 const m=syllableStrokes('볼');
 assert.ok(!score(m,write('불')).ok,'볼 자리에 불');
 assert.ok(!score(syllableStrokes('가'),write('기')).ok,'가 자리에 기');
 assert.ok(!score(syllableStrokes('가'),write('거')).ok,'가 자리에 거');
 assert.ok(!score(syllableStrokes('바'),write('버')).ok,'바 자리에 버');
 const zig=[Array.from({length:60},(_,i)=>[.1+(i%2)*.8,.1+i*.0135])];assert.ok(!score(m,zig).ok,'칸 지그재그');
 const box=[samples([[.1,.15],[.9,.15],[.9,.9],[.1,.9],[.1,.15]],.01)];assert.ok(!score(m,box).ok,'네모 한 획');
 assert.ok(!score(m,[]).ok,'빈 칸');
});

test('판정: 자리 · 크기는 넉넉히 받는다', () => {
 const m=syllableStrokes('볼');
 assert.ok(score(m,write('볼').map(s=>s.map(([x,y])=>[x+.1,y+.05]))).ok,'10% 옮겨 쓰기');
 assert.ok(score(m,write('볼').map(s=>s.map(([x,y])=>[.5+(x-.5)*.8,.5+(y-.5)*.8]))).ok,'80%로 작게');
 assert.ok(score(syllableStrokes('민'),write('민').map(s=>s.map(([x,y])=>[.5+(x-.5)*1.15,.5+(y-.5)*1.15]))).ok,'115%로 크게');
 // 순서를 바꿔 써도 막지 않는다(엄격한 관문은 스트레스 — 13판과 같다)
 assert.ok(score(m,write('볼').reverse()).ok,'순서 바꿔 쓰기');
});

test('방금 그은 획이 어느 획이고 거꾸로였는지', () => {
 const g=syllableStrokes('가');
 assert.deepEqual(which(g,wobble(g[0].p)),{k:0,rev:false});assert.deepEqual(which(g,wobble([...g[0].p].reverse())),{k:0,rev:true});
 assert.deepEqual(which(g,wobble(g[2].p)),{k:2,rev:false});
 const a=syllableStrokes('아');assert.equal(which(a,wobble(a[0].p)).rev,false);assert.equal(which(a,wobble([...a[0].p].reverse())).rev,true);
 assert.equal(which(g,[[.5,.5],[.5,.5]]).k,-1);
});

test('서명 줄글: 쓰고 되읽고, 길이를 지키고, 이상한 줄글은 거절한다', () => {
 const syl=['볼','로','르'].map(write),s=encodeSign(syl);
 assert.ok(s&&s.length<=3000&&/^[A-Za-z0-9_\-,|]+$/.test(s));
 const back=decodeSign(s);assert.equal(back.length,3);assert.equal(back[0].length,syl[0].length);
 for(const st of back.flat())for(const [x,y] of st)assert.ok(x>=0&&x<=1&&y>=0&&y<=1);
 const long=Array.from({length:10},()=>write('뷁').map(st=>st.flatMap(p=>[p,p,p])));const sl=encodeSign(long);assert.ok(sl===null||sl.length<=3000);
 for(const bad of [null,'','ab|c','a<b',123,'x'.repeat(3001)])assert.equal(decodeSign(bad),null,String(bad));
});

test('한글 이름 후보: 규칙이 흔한 표기와 맞는다(사전 없이)', () => {
 const cyr={болор:'볼로르',батболд:'바트볼드',ганбаатар:'간바타르',энхболд:'엥흐볼드',мөнхбат:'뭉흐바트',сүхбаатар:'수흐바타르',оюунчимэг:'오윤치멕',номин:'노민',тэмүүжин:'테무진',
  цэцэг:'체첵',ганзориг:'간조릭',дорж:'도르지',пүрэв:'푸레브',сайнбаяр:'사인바야르',эрдэнэ:'에르데네',баяр:'바야르',элбэгдорж:'엘벡도르지',хүрэлсүх:'후렐수흐',чойбалсан:'초이발산',
  дэлгэр:'델게르',ганбат:'간바트',одгэрэл:'오드게렐',анна:'안나',иван:'이반',алексей:'알렉세이',дмитрий:'드미트리',сарангэрэл:'사랑게렐',болормаа:'볼로르마',мандах:'만다흐',энх:'엥흐'};
 const lat={bolor:'볼로르',batbold:'바트볼드',ganbaatar:'간바타르',enkhbold:'엥흐볼드',munkhbat:'뭉흐바트',aziz:'아지즈',dilnoza:'딜노자',shahzod:'샤흐조드',jasur:'자수르',bobur:'보부르',
  madina:'마디나',malika:'말리카',sardor:'사르도르',nilufar:'닐루파르',otabek:'오타벡',wang:'왕',wei:'웨이',zhang:'장',li:'리',chen:'첸',yuki:'유키',haruto:'하루토',sakura:'사쿠라',
  kenji:'켄지',shota:'쇼타',ryota:'료타',anna:'안나',nomin:'노민',tsetseg:'체첵',temuujin:'테무진',khulan:'훌란',sherzod:'셰르조드',kamila:'카밀라',farrukh:'파루흐'};
 for(const [w,e] of Object.entries(cyr))assert.equal(_rule.cyr(w),e,w);
 for(const [w,e] of Object.entries(lat))assert.equal(_rule.lat(w),e,w);
});

test('한글 이름 후보: 한글 · 사전 · 베트남 · 하이픈 · 한자 · 길이', () => {
 assert.deepEqual(hangulName('볼로르'),{ko:'볼로르',via:'hangul'});
 assert.deepEqual(hangulName(' Bolor '),{ko:'볼로르',via:'dict'});
 assert.equal(hangulName('Bat-Erdene').ko,'바트에르덴');
 assert.equal(hangulName('Nguyễn Văn An').ko,'응우옌 반 안');
 assert.equal(hangulName('Trần Thị Linh').ko,'쩐 티 린');
 assert.equal(hangulName('Michael').ko,'마이클');
 assert.equal(hangulName('王伟'),null);assert.equal(hangulName(''),null);assert.equal(hangulName('!!!'),null);
 for(const raw of ['Oyunchimeg Bat-Erdene Ganbaatar','Maximilian Alexander']){const r=hangulName(raw);assert.ok(!r||r.ko.length<=10,raw);}
 for(const v of Object.values(NAME_DICT))assert.match(v,/^[가-힣]{1,10}$/);
});

test('긴 이름은 부르는 이름만 쓰고, 띄어쓰기는 음절 줄의 틈이 된다', () => {
 assert.deepEqual(nameSyllables('볼로르').syl.map(x=>x.ch).join(''),'볼로르');
 const vn=hangulName('Nguyễn Thị Minh Anh');assert.equal(calledName(vn.ko,'Nguyễn Thị Minh Anh'),'아인');
 assert.equal(nameSyllables(vn.ko,calledName(vn.ko,'Nguyễn Thị Minh Anh')).word,'아인');
 assert.equal(nameSyllables('안나 킴',calledName('안나 킴','Anna Kim')).word,'안나 킴');   // 다섯 음절 아래는 전부
 assert.deepEqual(nameSyllables('안나 킴').syl.map(x=>x.gap),[false,false,true]);
 assert.equal(calledName('볼로르','Bolor'),null);
});

test('학생 칸의 이름 글씨: 꼴이 맞을 때만 읽고, 이름과 다르면 버린다', () => {
 const b={version:1,name:'볼로르'},ok={w:'볼로르',s:'AAzz,BB|CCdd|EEff'};
 assert.deepEqual(readArrival({...b,sign:ok}).sign,ok);
 assert.deepEqual(readArrival({version:1,name:'응우옌 티 민 아인',sign:{w:'아인',s:'AA|BB'}}).sign,{w:'아인',s:'AA|BB'});
 for(const bad of [{w:'볼로',s:'AA|BB'},{w:'볼로르',s:'AA|BB'},{w:'볼로르',s:'A<|BB|CC'},{w:'볼로르',s:'A|BB|CC'},{w:'Bolor',s:'AA|BB|CC'},{w:'볼로르',s:'AA|BB|'+'C'.repeat(3000)},'x',null,{w:'볼로르'}])
  assert.equal(readArrival({...b,sign:bad}).sign,null,JSON.stringify(bad));
 assert.equal(readArrival({version:1,sign:ok}).sign,null,'이름 없는 기록');
});

test('이름 손글씨 글: 영어 · 몽골어가 다 있다(변수 열쇠 · 이름 든 줄 포함)', () => {
 const src=fs.readFileSync(new URL('../experiences/seoul-arrival/name-trace.mjs',import.meta.url),'utf8');
 const keys=new Set([...src.matchAll(/'(획 안내 [^']+|이름 쓰기 안내[^']*|이름 쓰는 칸)'/g)].map(m=>m[1]));
 assert.ok(keys.size>=11,String(keys.size));
 for(const lang of ['en','mn'])for(const k of keys){assert.ok(k in TEXT_TABLES.UI[lang],lang+' '+k);assert.ok(!L(k,{j:'ㅂ',w:'볼로르'},lang).includes('{'),lang+' '+k);}
 for(const k of keys)assert.ok(k in TEXT_TABLES.KO,'ko '+k);
 for(const lang of ['en','mn'])for(const line of ['Bolor… 한글로는 이렇게 쓰면 돼요.','이름이 길어서, 오늘은 아인만 써 봐요.'])assert.ok(sub(line,lang),lang+' '+line);
});

test('화면 검수 A1 · A3 · A4: 성조 없는 베트남 이름 · 결합 문자 · 하이픈 조각', () => {
 assert.equal(isVNName('Nguyen Thi Minh Anh'),true);assert.equal(isVNName('Nguyễn Văn An'),true);assert.equal(isVNName('응우옌 호앙 민'),true);
 assert.equal(isVNName('Anna Kim'),false);assert.equal(isVNName('Bolor'),false);assert.equal(isVNName('안나 킴'),false);
 assert.equal(calledName('응우옌 호앙 민','Nguyen Hoang Minh'),'민');assert.equal(calledName('응우옌 호앙 민','응우옌 호앙 민'),'민');
 assert.equal(calledName('응우옌 티 민 아인','Nguyen Thi Minh Anh'),'아인');
 assert.equal(hangulName('Thảo').ko,'타오','결합 문자 성조');
 assert.equal(hangulName('볼로르').ko,'볼로르','자모로 갈라 붙인 한글');
 for(const raw of ['Bat-龍','Minh-2','-'])assert.equal(hangulName(raw),null,raw);
 assert.equal(hangulName('Bat-Erdene').ko,'바트에르덴');
});

test('화면 검수 F2 · F3: 판정을 통과한 글씨는 저장 검증도 통과하고, 홑낱말 베트남 성씨는 흔한 표기로', () => {
 // 펜을 떼지 않고 한 획으로 길게 이어 쓴 음절(점이 많다)도 encodeSign이 readSign 상한 안으로 솎는다
 const long=ch=>[syllableStrokes(ch).flatMap(s=>samples(s.p,.002)).map(([x,y],i)=>[x+Math.sin(i)*.01,y+Math.cos(i*1.3)*.01])];
 for(const w of ['뺨빨','볼로르','옌쭝']){const syl=[...w].map(long);assert.ok(syl[0][0].length>200,'점이 상한보다 많은 획');
  const s=encodeSign(syl);assert.ok(s,w);const rec=readArrival({version:1,name:w,sign:{w,s}});assert.deepEqual(rec.sign,{w,s},w);}
 const many=[Array.from({length:60},(_,i)=>[[i/60,.2],[i/60,.8]])];const sm=encodeSign(many);assert.equal(sm.split(',').length,40,'음절당 획 40개까지');
 assert.equal(hangulName('Nguyen').ko,'응우옌');assert.equal(hangulName('Tran').ko,'쩐');assert.equal(hangulName('Nguyen Van An').ko,'응우옌 반 안');
});

test('Fable 다시 검수 FA2: 라틴으로 친 이름은 한글 후보의 한 음절 성씨로 베트남이라 보지 않는다', () => {
 const k=hangulName('Bo Erdenechimeg').ko;assert.equal(calledName(k,'Bo Erdenechimeg'),'보');
 assert.equal(calledName('응우옌 호앙 민','응우옌 호앙 민'),'민');assert.equal(calledName('응우옌 티 민 아인','Nguyen Thi Minh Anh'),'아인');
});
