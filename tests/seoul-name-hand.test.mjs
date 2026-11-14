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

// 겉 v2(11-14): 잉크 · 흐린 글씨 그리기의 순수 함수 — 판정은 이 파일을 보지 않는다
test('잉크 겉 v2: 굵기 배수는 느리면 굵고 빠르면 가늘며 끝을 뺀다, 넓적 촉은 세로획이 가로획보다 굵다', async () => {
 const {inkScale,resample,smooth,nibQuads,profile,shapeOf}=await import('../experiences/seoul-arrival/name-ink.mjs');
 const line=(dx,dy,ms)=>Array.from({length:41},(_,i)=>[i*dx,i*dy,i*ms]);
 const slow=inkScale(line(1,0,10),{thin:.3,lo:.6,hi:1,vref:.9,fin:false}),fast=inkScale(line(6,0,6),{thin:.3,lo:.6,hi:1,vref:.9,fin:false});
 assert.ok(slow[20]>fast[20]+.15,`${slow[20]} ${fast[20]}`);
 for(const k of [...slow,...fast])assert.ok(k>=.6-1e-9&&k<=1+1e-9);
 const tap=inkScale(line(2,0,8),{taperOut:20,outTo:.2});assert.ok(tap.at(-1)<tap[20]*.4,'끝을 뺀다');
 assert.ok(inkScale([[0,0],[2,0],[4,0]],{}).every(Number.isFinite),'시각 없는 점(학생증 서명)');
 const r=resample([[0,0],[10,0],[10,10]],2);assert.equal(r.length,11);assert.deepEqual(r.at(-1),[10,10]);
 const sm=smooth([[0,0,0],[1,5,1],[2,0,2],[3,5,3],[4,0,4]],2);assert.deepEqual(sm[0],[0,0,0]);assert.deepEqual(sm.at(-1),[4,0,4]);assert.ok(Math.abs(sm[2][1]-2)<1e-9);
 const area=v=>Math.abs(v.reduce((a,[x1,y1],j)=>{const [x2,y2]=v[(j+1)%4];return a+x1*y2-x2*y1;},0)/2);
 const width=(pts)=>nibQuads(pts,pts.map(()=>1),{h:6,a:.42}).reduce((a,v)=>a+area(v),0)/10;
 assert.ok(width([[0,0],[10,0]])*1.8<width([[0,0],[0,10]]),'세로획이 가로획보다 굵다');
 for(const q of nibQuads([[0,0],[10,0],[10,10],[0,10]],[1,1,1,1],{h:5}))assert.ok(q.reduce((a,[x1,y1],j)=>{const [x2,y2]=q[(j+1)%4];return a+x1*y2-x2*y1;},0)>=0,'감김 방향이 모두 같다');
 for(const k of ['h','v','hv','vh','dl','dr','o','hdl','tick'])for(let s=0;s<=1;s+=.05){const v=profile(k,s);assert.ok(v>.15&&v<1.2,k+' '+s);}
 assert.ok(profile('dl',1)<profile('dl',.05)*.4,'삐침은 끝을 뺀다');assert.ok(profile('dr',.85)>profile('dr',0)*1.8,'오른내림은 눌러 내린다');
 const sh=shapeOf('h',[[0,0],[100,0]]);assert.equal(sh.p.length,sh.K.length);
});

// 서하 목소리 응원(11-14 유호님 「실수하면 나레이션으로 가이드 · 제대로 해도 응원 · 최종 점수와 같이 승부욕」): 줄 고르기 · 잔소리 막기 · 파일과 출처 · 번역
import {VO,SETS,finalLine,weakTag,tier,createCoach} from '../experiences/seoul-arrival/name-coach.mjs';
test('서하 응원: 점수 층 · 다시 쓴 판 · 꼬리표 · 줄 파일과 번역', () => {
 assert.equal(finalLine({score:100,attempt:1}),'f100');
 assert.equal(finalLine({score:94,attempt:1}),'ftop');
 assert.equal(finalLine({score:84,attempt:1}),'fhi');   // 80점대는 「한 번 더 하면 백 점」(승부욕)
 assert.equal(finalLine({score:70,attempt:1}),'fmid');
 // 한글을 이미 쓰는 학생에게는 「처음」을 전제한 줄(f100 · ftop · flow)을 쓰지 않는다
 assert.equal(finalLine({score:100,attempt:1,knows:true}),'r100');
 assert.equal(finalLine({score:95,attempt:1,knows:true}),'fhi');
 assert.equal(finalLine({score:50,attempt:1,knows:true}),'fmid');
 assert.equal(finalLine({score:40,attempt:1}),'flow');
 assert.equal(finalLine({score:90,attempt:2,prev:82}),'rup');
 assert.equal(finalLine({score:80,attempt:2,prev:82}),'rdown');
 assert.equal(finalLine({score:82,attempt:3,prev:82}),'fhi');    // 지난 최고와 같으면 점수 층 말(「최고 기록까지 조금만 더」는 뜻이 어긋남, 카본 A6)
 assert.equal(finalLine({score:70,attempt:2,prev:70}),'fmid');
 assert.equal(finalLine({score:45,attempt:2,prev:92}),'fmid');   // 크게 떨어지면 「조금만 더」가 아니라 「한 번만 더 써 보면」(최종 검수 F2)
 assert.equal(finalLine({score:85,attempt:2,prev:92}),'rdown');
 assert.equal(finalLine({score:100,attempt:2,prev:100}),'r100');
 assert.deepEqual([100,95,85,60].map(tier),['full','top','hi','mid']);
 assert.equal(weakTag({ord:.5,dir:1,like:.98}),'순서');
 assert.equal(weakTag({ord:1,dir:0,like:.99}),'방향');
 assert.equal(weakTag({ord:1,dir:1,like:.7}),'모양');
 assert.equal(weakTag({ord:1,dir:1,like:.97}),null);
 const made=JSON.parse(fs.readFileSync(new URL('../experiences/seoul-arrival/qa/소리출처.json',import.meta.url),'utf8'));
 for(const [id,text] of Object.entries(VO)){
  assert.ok(fs.existsSync(new URL(`../experiences/seoul-arrival/assets/snd/vo_nt_${id}.mp3`,import.meta.url)),id);
  assert.equal(made['vo_nt_'+id]?.글,text,`출처 글: ${id}`);
  for(const lang of ['en','mn'])assert.ok(text in TEXT_TABLES.UI[lang],`${lang}: ${text}`);
 }
 for(const ids of Object.values(SETS))for(const id of ids)assert.ok(VO[id],id);
 // 꼬리표 열쇠는 L(tag)로 불러 화면 글 검사가 못 본다 — 여기서 번역을 확인(카본 B5)
 for(const k of ['순서','방향','모양','최고 기록','도전 횟수','지난 최고'])for(const lang of ['en','mn'])assert.ok(k in TEXT_TABLES.UI[lang],lang+': '+k);
});
test('서하 응원: 바로잡기는 음절마다 두 번 · 1.8초 안에 다시 하지 않고, 칭찬은 돌아가며, 끝 줄은 끼어든다', () => {
 let t=0;const played=[];const SND={speak:u=>{played.push(u.match(/vo_nt_(\w+)\.mp3/)[1]);return 1.2;},hush(){},voWarm(){}};
 const c=createCoach({SND,now:()=>t});
 assert.equal(c.fix('order').id,'o1');t+=500;
 assert.equal(c.fix('dir'),null);          // 1.8초 안
 t+=2000;assert.equal(c.fix('dir').id,'d1');t+=2000;
 assert.equal(c.fix('order'),null);        // 이 음절에서 두 번 넘음
 c.syllable();assert.equal(c.fix('order').id,'o2');
 t+=200;assert.equal(c.praise(),null);     // 바로잡기가 도는 동안 칭찬은 끼어들지 않는다
 t+=2000;assert.equal(c.praise().id,'g1');t+=2000;assert.equal(c.praise().id,'g2');
 assert.equal(c.final({score:84,attempt:1}).id,'fhi');   // 칭찬이 도는 중이어도 끝 줄은 낸다
 assert.equal(c.said,'fhi');
 const quiet=createCoach({SND:{speak:()=>null}});assert.equal(quiet.praise(),null);   // 아직 안 풀린 줄 · 소리 없음은 건너뛴다
});

// 카본 지적 고침(seoul-name-v3-20261114): 한 점 획 · 동그라미 방향 · 상자 맞춘 순서 · 방향
import {nibQuads} from '../experiences/seoul-arrival/name-ink.mjs';
import {fitsStroke,strokeStats} from '../experiences/seoul-arrival/name-hand.mjs';
test('카본 A1 · A2 · A3: 한 점 획은 촉 크기만큼만, 동그라미 방향은 자리와 상관없이, 비켜 쓴 음절의 순서 · 방향은 상자를 맞춰 다시 센다', () => {
 // A1: [0,1] 학생증 좌표에서 점 하나 — 모든 꼭짓점이 촉 반폭 안
 const q=nibQuads([[.5,.5]],[1],{h:.03,a:.42});assert.equal(q.length,1);
 for(const [x,y] of q[0])assert.ok(Math.hypot(x-.5,y-.5)<.04,String([x,y]));
 // A2: 칸 아래쪽의 받침 ㅇ을 안내대로(12시 → 9시 → 6시 → 3시) 돌고 10~11시까지 여며도, 반대로 돌아도 자리와 상관없이 맞게
 const loop=(cx,cy,r,from,turn,dirSign)=>Array.from({length:40},(_,i)=>{const a=from+dirSign*turn*i/39;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];});
 const model=[{k:'o',p:loop(.5,.78,.1,-Math.PI/2,2*Math.PI,-1)}];
 for(const [cx,cy] of [[.5,.78],[.3,.85],[.7,.2]]){
  assert.equal(which(model.map(m=>({...m,p:loop(cx,cy,.1,-Math.PI/2,2*Math.PI,-1)})),loop(cx,cy,.1,-Math.PI/2,2*Math.PI+.6,-1)).rev,false,'바른 방향 '+cx+','+cy);
  assert.equal(which(model.map(m=>({...m,p:loop(cx,cy,.1,-Math.PI/2,2*Math.PI,-1)})),loop(cx,cy,.1,-Math.PI/2,2*Math.PI+.6,1)).rev,true,'반대 '+cx+','+cy);
 }
 assert.equal(fitsStroke(model[0],loop(.5,.78,.1,-Math.PI/2,2*Math.PI-.4,-1)).rev,false);
 // A3: 「가」를 바른 차례 · 방향으로 칸 왼쪽 위에 절반 크기로 쓰면, 그대로는 이웃 획으로 짚혀도 상자를 맞추면 순서 · 방향이 다 맞다
 const ga=syllableStrokes('가'),small=ga.map(s=>samples(s.p).map(([x,y])=>[.12+x*.5,.1+y*.5]));   // 실제 잉크처럼 점을 촘촘히
 const r=strokeStats(ga,small,.05);assert.equal(r.n,ga.length);assert.equal(r.ord,ga.length);assert.equal(r.dir,ga.length);
 const back=strokeStats(ga,[small[1],small[0],...small.slice(2)],.05);assert.ok(back.ord<back.n,'순서를 바꾸면 여전히 깎인다');
});
