// 서울행 부스: 이름 → 한글 후보(설계 이름손글씨.md 4-3, 소리 나는 대로). 정답 표기가 아니라 학생이 고를 수 있는 첫 후보다.
// 차례: 한글이면 그대로 → 이름 사전 → 글자별 규칙(키릴 = 몽골어 소리, 베트남 성조 글자 = 베트남어 음절, 그 밖의 라틴 = 소리 규칙) → 후보 없음(한자 등).
const L_LIST=[...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'],V_LIST=[...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
const T_LIST=['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const join=({L,V,T=''})=>String.fromCharCode(0xAC00+L_LIST.indexOf(L)*588+V_LIST.indexOf(V)*28+T_LIST.indexOf(T));

// ── 소리 조각 → 음절 ──
// 자음 조각: on(첫소리 자모) · coda(받침이 될 때의 자모, 없으면 따로 한 음절) · solo(따로 설 때의 모음 ㅡ/ㅣ) · y(뒤 모음에 y를 얹는 ш)
const C={
 b:{on:'ㅂ'},v:{on:'ㅂ'},g:{on:'ㄱ',coda:'ㄱ'},d:{on:'ㄷ'},j:{on:'ㅈ',solo:'ㅣ'},z:{on:'ㅈ'},k:{on:'ㅋ',coda:'ㄱ'},l:{on:'ㄹ',coda:'ㄹ'},
 m:{on:'ㅁ',coda:'ㅁ'},n:{on:'ㄴ',coda:'ㄴ'},ng:{on:'ㅇ',coda:'ㅇ'},p:{on:'ㅍ'},r:{on:'ㄹ'},s:{on:'ㅅ'},t:{on:'ㅌ'},f:{on:'ㅍ'},h:{on:'ㅎ'}, // h(х)는 모음 앞이 아니면 받침이 아니라 「흐」(엥흐 · 뭉흐 · 샤흐조드)
 ts:{on:'ㅊ'},ch:{on:'ㅊ',solo:'ㅣ'},sh:{on:'ㅅ',solo:'ㅣ',y:true},
};
const Y={'ㅏ':'ㅑ','ㅓ':'ㅕ','ㅗ':'ㅛ','ㅜ':'ㅠ','ㅔ':'ㅖ','ㅐ':'ㅒ','ㅡ':'ㅣ','ㅣ':'ㅣ'};
const W={'ㅏ':'ㅘ','ㅐ':'ㅙ','ㅔ':'ㅞ','ㅣ':'ㅟ','ㅓ':'ㅝ','ㅗ':'ㅗ','ㅜ':'ㅜ','ㅡ':'ㅟ'};
// seq: [{c:'b'} | {v:'ㅏ'} | {y:1} | {w:1}] → 한글
function build(seq){
 const out=[];let pend=[],glide=null;
 const prev=()=>out[out.length-1];
 const solo=(c)=>{const k=C[c];out.push({L:k.on,V:k.solo||'ㅡ'});};
 // 모음 앞이 아닌 자음 하나를 처리(받침 또는 따로)
 const flush=(c,next)=>{const k=C[c],p=prev();
  if(c==='n'&&next&&['g','k','h','ng'].includes(next)&&p&&!p.T){p.T='ㅇ';return;}
  if(c==='ng'){if(p&&!p.T){p.T='ㅇ';return;}out.push({L:'ㅇ',V:'ㅡ',T:'ㅇ'});return;}
  if(k.coda&&p&&!p.T){p.T=k.coda;return;}
  solo(c);};
 for(let i=0;i<seq.length;i++){
  const s=seq[i];
  if(s.y||s.w){glide=s.y?'y':'w';continue;}
  if(s.c){pend.push(s.c);continue;}
  // 모음: 앞 자음 묶음에서 마지막은 첫소리, 나머지는 받침 · 따로
  let on=null;
  if(pend.length){
   on=pend.pop();
   pend.forEach((c,j)=>flush(c,pend[j+1]||on));
   // 모음 사이 ㄹ(l)은 앞 음절 받침 ㄹ + 첫소리 ㄹ(볼로르 · 말리카)
   if(on==='l'&&!pend.length&&prev()&&!prev().T&&i>1)prev().T='ㄹ';
   pend=[];
  }
  let v=s.v;
  if(on&&C[on].y&&!glide)glide='y';
  if(glide==='y')v=Y[v]||v;else if(glide==='w')v=W[v]||v;
  glide=null;
  if(on==='ng'){const p=prev();if(p&&!p.T){p.T='ㅇ';on=null;}else{out.push({L:'ㅇ',V:'ㅡ',T:'ㅇ'});on=null;}}
  out.push({L:on?C[on].on:'ㅇ',V:v});
 }
 pend.forEach((c,j)=>{if(c==='r'){solo('r');return;}flush(c,pend[j+1]);});
 return out.map(join).join('');
}

// ── 키릴(몽골어 소리) ──
function cyr(word){
 let w=word.toLowerCase().replace(/[ьъ]/g,'');
 w=w.replace(/юу/g,'ю').replace(/яа/g,'я').replace(/ёо/g,'ё').replace(/аа/g,'а').replace(/ээ/g,'э').replace(/оо/g,'о').replace(/уу/g,'у').replace(/өө/g,'ө').replace(/үү/g,'ү').replace(/ий/g,'и').replace(/ы/g,'и');
 const V1={а:'ㅏ',э:'ㅔ',и:'ㅣ',о:'ㅗ',у:'ㅗ',ө:'ㅜ',ү:'ㅜ',е:'ㅔ'},YV={я:'ㅏ',ё:'ㅗ',ю:'ㅜ',е:'ㅔ'};
 const CC={б:'b',в:'v',г:'g',д:'d',ж:'j',з:'z',к:'k',л:'l',м:'m',н:'n',п:'p',р:'r',с:'s',т:'t',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sh'};
 const seq=[];
 for(let i=0;i<w.length;i++){const ch=w[i];
  if(ch==='й'){seq.push({v:'ㅣ'});continue;}
  if(ch==='е'&&i>0&&CC[w[i-1]]){seq.push({v:'ㅔ'});continue;}
  if(YV[ch]){seq.push({y:1},{v:YV[ch]});continue;}
  if(V1[ch]){seq.push({v:V1[ch]});continue;}
  if(CC[ch]){seq.push({c:CC[ch]});continue;}
 }
 return seq;
}

// ── 라틴(소리 규칙) ──
function lat(word){
 let w=word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’'`ʻʼ]/g,'');
 w=w.replace(/aa/g,'a').replace(/ee/g,'i').replace(/oo/g,'u').replace(/uu/g,'u').replace(/ii/g,'i');
 const seq=[];const isV=c=>!!c&&'aeiouy'.includes(c);
 for(let i=0;i<w.length;){
  const r=w.slice(i);let m;
  if((m=/^(kh|sh|ch|ts|zh|ng|ph|th|gh|ck|qu|dj|tch)/.exec(r))){const d=m[1];
   if(d==='ng'&&isV(w[i+2]||'')){seq.push({c:'n'},{c:'g'});i+=2;continue;}
   const map={kh:'h',sh:'sh',ch:'ch',ts:'ts',zh:'j',ng:'ng',ph:'f',th:'t',gh:'g',ck:'k',dj:'j',tch:'ch'};
   if(d==='qu'){seq.push({c:'k'},{w:1});i+=2;continue;}
   seq.push({c:map[d]});i+=d.length;continue;}
  const c=w[i];
  if(c==='y'){if(isV(w[i+1]||'')&&w[i+1]!=='y'){seq.push({y:1});}else seq.push({v:'ㅣ'});i++;continue;}
  if(c==='w'){if(isV(w[i+1]||'')){seq.push({w:1});}else seq.push({v:'ㅜ'});i++;continue;}
  if(isV(c)){seq.push({v:{a:'ㅏ',e:'ㅔ',i:'ㅣ',o:'ㅗ',u:'ㅜ'}[c]});i++;continue;}
  const one={b:'b',c:/[eiy]/.test(w[i+1]||'')?'s':'k',d:'d',f:'f',g:'g',h:'h',j:'j',k:'k',l:'l',m:'m',n:'n',p:'p',q:'k',r:'r',s:'s',t:'t',v:'v',x:/[iy]/.test(w[i+1]||'')?'s':'h',z:'z'}[c];
  if(one){if(seq.length&&seq[seq.length-1].c===one&&!['l','n','m'].includes(one)){i++;continue;}seq.push({c:one});}
  i++;
 }
 return seq;
}

// ── 베트남어 음절(성조 글자가 있을 때) ──
const VN={nguyen:'응우옌',tran:'쩐',le:'레',pham:'팜',hoang:'호앙',huynh:'후인',phan:'판',vu:'부',vo:'보',dang:'당',bui:'부이',do:'도',ho:'호',ngo:'응오',duong:'즈엉',ly:'리',dinh:'딘',truong:'쯔엉',
 minh:'민',linh:'린',anh:'아인',huong:'흐엉',trang:'짱',thao:'타오',ha:'하',lan:'란',mai:'마이',hung:'훙',dung:'중',tuan:'뚜언',nam:'남',hai:'하이',long:'롱',quang:'꽝',huy:'후이',
 thi:'티',van:'반',thu:'투',ngoc:'응옥',nhung:'늉',nhi:'니',yen:'옌',phuong:'프엉',giang:'장',khanh:'카인',duc:'득',tung:'뚱',son:'선',tam:'떰',thang:'탕',hieu:'히에우',hien:'히엔',
 quynh:'뀐',vy:'비',hanh:'하인',thuy:'투이',duy:'주이',khoa:'코아',bao:'바오',chau:'쩌우',uyen:'우옌',an:'안',binh:'빈',cuong:'끄엉',hoa:'호아',hue:'후에',kim:'김',loan:'로안',
 my:'미',nga:'응아',nhu:'뉴',oanh:'오아인',quan:'꽌',quoc:'꾸옥',tai:'따이',thanh:'타인',thien:'티엔',tien:'띠엔',trinh:'찐',trung:'쭝',viet:'비엣',xuan:'쑤언',vinh:'빈',phuc:'푹',
 dat:'닷',dao:'다오',diep:'디엡',hau:'허우',hoai:'호아이',khang:'캉',khoi:'코이',kiet:'끼엣',lam:'람',luan:'루언',nghia:'응이아',nhat:'녓',phat:'팟',quyen:'꾸옌',sang:'상',tho:'토',
 thuan:'투언',toan:'또안',tri:'찌',tuyet:'뚜옛',uy:'우이',vuong:'브엉',hong:'홍',huu:'흐우',luong:'르엉',mac:'막',ta:'따',trieu:'찌에우',luu:'르우',ton:'똔',lai:'라이',cao:'까오',chu:'쭈'};
const strip=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
export const isVN=s=>/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(s);

// ── 이름 사전(흔한 이름 · 한국에서 흔히 쓰는 표기) ──
export const NAME_DICT={
 // 몽골(키릴 · 라틴)
 'болор':'볼로르','bolor':'볼로르','болормаа':'볼로르마','bolormaa':'볼로르마','бат':'바트','bat':'바트','батболд':'바트볼드','batbold':'바트볼드','бат-эрдэнэ':'바트에르덴','bat-erdene':'바트에르덴',
 'ганбаатар':'간바타르','ganbaatar':'간바타르','энхболд':'엥흐볼드','enkhbold':'엥흐볼드','энхбаяр':'엥흐바야르','enkhbayar':'엥흐바야르','мөнхбат':'뭉흐바트','munkhbat':'뭉흐바트',
 'сүхбаатар':'수흐바타르','sukhbaatar':'수흐바타르','оюунчимэг':'오윤치멕','oyunchimeg':'오윤치멕','оюун':'오윤','oyun':'오윤','номин':'노민','nomin':'노민','тэмүүжин':'테무진','temuujin':'테무진',
 'цэцэг':'체첵','tsetseg':'체첵','энхтуяа':'엥흐토야','enkhtuya':'엥흐토야','нарантуяа':'나랑토야','narantuya':'나랑토야','сарнай':'사르나이','sarnai':'사르나이','ганзориг':'간조릭','ganzorig':'간조릭',
 'баттулга':'바트톨가','battulga':'바트톨가','хулан':'홀랑','khulan':'홀랑','анужин':'아노징','anujin':'아노징','ариунаа':'아리오나','ariunaa':'아리오나','билгүүн':'빌군','bilguun':'빌군',
 'мөнх-эрдэнэ':'뭉흐에르덴','munkh-erdene':'뭉흐에르덴','золзаяа':'졸자야','zolzaya':'졸자야','дорж':'도르지','dorj':'도르지','пүрэв':'푸레브','purev':'푸레브','төмөр':'투무르','tumur':'투무르',
 'сайнбаяр':'사인바야르','sainbayar':'사인바야르','мөнхзул':'뭉흐졸','munkhzul':'뭉흐졸','одгэрэл':'오드게렐','odgerel':'오드게렐','отгонбаяр':'오트곤바야르','otgonbayar':'오트곤바야르',
 'хонгор':'홍고르','khongor':'홍고르','мишээл':'미셸','misheel':'미셸','тэмүүлэн':'테물렌','temuulen':'테물렌','анударь':'아노다리','anudari':'아노다리','ундрал':'온드랄','undral':'온드랄',
 'эрдэнэ':'에르데네','erdene':'에르데네','сараа':'사라','saraa':'사라','маралмаа':'마랄마','maralmaa':'마랄마','solongo':'솔롱고','солонго':'솔롱고','gerel':'게렐','гэрэл':'게렐',
 // 우즈베키스탄
 aziz:'아지즈',dilnoza:'딜노자',shahzod:'샤흐조드',jasur:'자수르',bobur:'보부르',madina:'마디나',malika:'말리카',sardor:'사르도르',nilufar:'닐루파르',otabek:'오타벡',jahongir:'자홍기르',
 javohir:'자보히르',sevara:'세바라',gulnora:'굴노라',zarina:'자리나',dilshod:'딜쇼드',ulugbek:'울루그벡',sherzod:'셰르조드',kamola:'카몰라',feruza:'페루자',shohruh:'쇼흐루흐',akmal:'아크말',
 // 영어권 · 그 밖의 흔한 이름
 anna:'안나',emma:'엠마',olivia:'올리비아',sophia:'소피아',mia:'미아',emily:'에밀리',sarah:'세라',jessica:'제시카',jennifer:'제니퍼',michael:'마이클',john:'존',james:'제임스',david:'데이비드',
 daniel:'대니얼',chris:'크리스',christopher:'크리스토퍼',matthew:'매슈',andrew:'앤드루',alex:'알렉스',alexander:'알렉산더',ryan:'라이언',kevin:'케빈',brian:'브라이언',tom:'톰',thomas:'토머스',
 william:'윌리엄',jack:'잭',lucas:'루카스',noah:'노아',liam:'리엄',ethan:'이선',grace:'그레이스',hannah:'해나',rachel:'레이철',laura:'로라',kate:'케이트',lily:'릴리',chloe:'클로이',ella:'엘라',
 isabella:'이사벨라',charlotte:'샬럿',harry:'해리',george:'조지',oliver:'올리버',henry:'헨리',peter:'피터',paul:'폴',mark:'마크',robert:'로버트',richard:'리처드',joseph:'조지프',steven:'스티븐',
 eric:'에릭',adam:'애덤',nick:'닉',ben:'벤',max:'맥스',leo:'레오',mary:'메리',linda:'린다',lisa:'리사',amy:'에이미',julia:'줄리아',maria:'마리아',sofia:'소피아',lucy:'루시',
 // 지금 부스 사전(NAMES)
 minh:'민',linh:'린',
};

export function hangulName(raw){
 const s=String(raw||'').trim().replace(/\s+/g,' ');if(!s)return null;
 if(/^[가-힣]+( [가-힣]+)*$/.test(s))return {ko:s,via:'hangul'};
 const key=s.toLowerCase();
 if(NAME_DICT[key])return {ko:NAME_DICT[key],via:'dict'};
 const words=s.split(/[ ]+/),vn=isVN(s);
 const one=w=>{const k=w.toLowerCase();if(NAME_DICT[k])return NAME_DICT[k];
  // 하이픈 이름은 조각마다 바꿔 붙인다(Bat-Erdene → 바트에르덴)
  if(w.includes('-'))return w.split('-').filter(Boolean).map(one).join('');
  if(vn||(/^[a-z]+$/i.test(w)&&VN[strip(w)]&&words.length>=2&&words.every(x=>VN[strip(x)])))return VN[strip(w)]||build(lat(w));
  if(/^[\u0400-\u04ff]+$/.test(w))return build(cyr(w));
  if(/^[a-z\u00c0-\u024f'’`ʻʼ]+$/i.test(w))return build(lat(w));
  return null;};
 const parts=words.map(one);if(parts.some(p=>!p))return null;
 let ko=parts.join(' ');
 // 길면 부르는 이름 하나만: 베트남 · 병음 꼴(성이 앞)은 마지막 낱말, 그 밖(몽골 · 우즈베크 · 영어권)은 첫 낱말(설계 검토 F3-1)
 if(ko.length>10)ko=vn?parts[parts.length-1]:parts[0];
 if(!ko||ko.length>10)return null;
 return {ko,via:'rule'};
}
// 시험용: 사전을 거치지 않은 규칙 결과
export const _rule={cyr:w=>build(cyr(w)),lat:w=>build(lat(w))};
// 긴 이름에서 손으로 쓸 부르는 이름: 베트남어(성이 앞)는 마지막 낱말, 그 밖은 첫 낱말. 한 낱말이면 없음(전부 쓴다)
export function calledName(ko,raw){const w=String(ko||'').split(' ').filter(Boolean);if(w.length<2)return null;return isVN(raw||'')?w[w.length-1]:w[0];}
