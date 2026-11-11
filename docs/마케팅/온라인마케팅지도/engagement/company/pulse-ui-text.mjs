// 시험 · 도구 도우미(서버가 읽지 않는다): JS 원문에서 주석을 빼고 문자열 · 템플릿 글만 모은다 — PULSE 고객 앱 글꼴 조각(2026-11-11 첫 방문 무게)의 「화면 원문」.
// 회사 이미지는 npm 설치 없이 company/*.mjs만 싣는다(Dockerfile) — 그래서 구문 분석 패키지(acorn) 없이 node 기본만으로 돈다.
// 정규식 · 나눗셈을 앞 낱말로 가르는 작은 훑개다. acorn과 같은 글자를 내는지는 저장소 바닥 tests/pulse-ui-text.test.mjs가 실제 파일로 대조한다.
// 쓰는 곳: tools/build-pulse-fonts.py(조각 만들기) · pulse-first-load.test.mjs(화면 음절이 나머지 조각 범위에 들었는지).
const KEYWORDS=new Set(['return','typeof','instanceof','in','of','new','delete','void','throw','case','do','else','yield','await']);
const PUNCT_BEFORE_REGEX=new Set(['(',',','=',':','[','!','&','|','?','{','}',';','~','+','-','*','%','<','>','^']);
const SIMPLE={n:'\n',r:'\r',t:'\t',b:'\b',f:'\f',v:'\v','0':'\0'};

// 문자열 · 템플릿 안의 탈출 글자를 푼다(\uXXXX · \u{…} · \xHH · 한 글자 탈출 · 줄 잇기).
// 템플릿 글 안의 줄끝 CRLF · CR은 LF로 읽는다(ECMAScript 규격 — 작업본이 CRLF여도 acorn과 같은 글).
function unescape(src,start,end,template=false){
  let out='';
  for(let i=start;i<end;i++){
    const ch=src[i];
    if(template&&ch==='\r'){out+='\n';if(src[i+1]==='\n')i++;continue;}
    if(ch!=='\\'){out+=ch;continue;}
    const n=src[++i];
    if(n==='u'){
      if(src[i+1]==='{'){const close=src.indexOf('}',i+2);out+=String.fromCodePoint(parseInt(src.slice(i+2,close),16));i=close;}
      else{out+=String.fromCharCode(parseInt(src.slice(i+1,i+5),16));i+=4;}
    }else if(n==='x'){out+=String.fromCharCode(parseInt(src.slice(i+1,i+3),16));i+=2;}
    else if(n==='\r'){if(src[i+1]==='\n')i++;}
    else if(n==='\n'||n==='\u2028'||n==='\u2029'){}
    else out+=SIMPLE[n]??n;
  }
  return out;
}

// 원문 하나에서 문자열 · 템플릿 글을 차례대로 돌려준다(주석 · 정규식 · 코드는 뺀다).
export function literalTexts(src){
  const out=[];
  let i=0,last='';// last: 앞의 뜻 있는 낱말(정규식 · 나눗셈 가르기)
  const stack=[];// 템플릿 ${…} 안: 중괄호 깊이
  const word=/[A-Za-z0-9_$\u0080-\uffff]/;
  const regexAllowed=()=>last===''||PUNCT_BEFORE_REGEX.has(last)||KEYWORDS.has(last);
  const readTemplate=()=>{// i는 ` 바로 뒤 또는 } 바로 뒤. ` 나 ${ 에서 멈춘다.
    const begin=i;
    while(i<src.length){
      if(src[i]==='\\'){i+=2;continue;}
      if(src[i]==='`'){out.push(unescape(src,begin,i,true));i++;last='`';return;}
      if(src[i]==='$'&&src[i+1]==='{'){out.push(unescape(src,begin,i,true));i+=2;stack.push(0);last='{';return;}
      i++;
    }
    throw new Error('템플릿이 닫히지 않았다');
  };
  while(i<src.length){
    const ch=src[i];
    if(ch==='/'&&src[i+1]==='/'){const nl=src.indexOf('\n',i);i=nl<0?src.length:nl;continue;}
    if(ch==='/'&&src[i+1]==='*'){const close=src.indexOf('*/',i+2);if(close<0)throw new Error('주석이 닫히지 않았다');i=close+2;continue;}
    if(/\s/.test(ch)){i++;continue;}
    if(ch==='"'||ch==="'"){
      const begin=++i;
      // 역슬래시 뒤 줄끝은 줄 잇기다(CRLF는 두 글자를 함께 건넌다 — 검수 backend-d GA1). 그 밖의 맨 줄끝은 문자열 안에 올 수 없다.
      while(i<src.length&&src[i]!==ch){if(src[i]==='\\'){i+=src[i+1]==='\r'&&src[i+2]==='\n'?3:2;continue;}if(src[i]==='\n'||src[i]==='\r')throw new Error('문자열이 줄을 넘었다');i++;}
      if(i>=src.length)throw new Error('문자열이 닫히지 않았다');
      out.push(unescape(src,begin,i));i++;last='"';continue;
    }
    if(ch==='`'){i++;readTemplate();continue;}
    if(ch==='/'&&regexAllowed()){// 정규식: 끝 / 까지(글자 묶음 [...] 안의 / 와 탈출은 건너뛴다), 뒤 깃발까지
      i++;let inClass=false,closed=false;
      while(i<src.length){const c=src[i];if(c==='\\'){i+=2;continue;}if(c==='\n')throw new Error('정규식이 줄을 넘었다');if(inClass){if(c===']')inClass=false;}else if(c==='[')inClass=true;else if(c==='/'){closed=true;break;}i++;}
      if(!closed)throw new Error('정규식이 닫히지 않았다');
      i++;while(i<src.length&&/[a-z]/i.test(src[i]))i++;last='/re';continue;
    }
    if(stack.length&&ch==='{'){stack[stack.length-1]++;i++;last='{';continue;}
    if(stack.length&&ch==='}'){if(stack[stack.length-1]===0){stack.pop();i++;readTemplate();continue;}stack[stack.length-1]--;i++;last='}';continue;}
    // 낱말: 점(.) 뒤는 속성 이름이라 예약어 꼴(obj.in · x.return)이어도 값이다 — 그 뒤 / 는 나눗셈(검수 pulse-first-load-20261111-c B1).
    if(word.test(ch)){let j=i;while(j<src.length&&word.test(src[j]))j++;const name=src.slice(i,j);last=last==='.'?'name':/^\d/.test(name)?'0':name;i=j;continue;}
    // ++ · -- 는 한 낱말이다. 그 바로 뒤에는 정규식이 올 수 없어(++/re/는 문법 오류) 다음 / 는 나눗셈이다(i++ / 2).
    if((ch==='+'||ch==='-')&&src[i+1]===ch){last=ch+ch;i+=2;continue;}
    last=ch;i++;
  }
  if(stack.length)throw new Error('템플릿 식이 닫히지 않았다');
  return out;
}

const SYLLABLE=c=>c>=0xAC00&&c<=0xD7A3;
// 원문 여럿의 문자열 · 템플릿 글에 든 한글 음절(코드 포인트 Set).
export function literalSyllables(sources){
  const set=new Set();
  for(const src of sources)for(const text of literalTexts(src))for(const ch of text){const c=ch.codePointAt(0);if(SYLLABLE(c))set.add(c);}
  return set;
}
// 화면 원문으로 읽는 파일: pulse-app 아래 .mjs · .js(그림 · 예시 자료 · 기획 모음 · 아이콘 폴더 빼고) — 생성 도구와 시험이 같은 목록을 쓴다.
export const SKIP_DIRS=Object.freeze(['assets','demo-assets','production-library','icons']);
