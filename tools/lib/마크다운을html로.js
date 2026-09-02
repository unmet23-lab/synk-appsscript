// 소개서 마크다운을 «정적» HTML 로. 라이브러리를 안 쓴다 — 구조가 단순하고, 페이지가 혼자 서야 한다.
const fs=require('fs');
const 벗기 = (s)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const 인라인 = (s)=> 벗기(s)
  .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>')
  .replace(/`([^`]+)`/g,'<code>$1</code>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>');

function 바꾸기(md){
  const 줄들 = md.split(/\r?\n/);
  const 나온것=[]; const 목차=[];
  let i=0, 표버퍼=null, 목록버퍼=null, 문단버퍼=[];
  const 문단닫기=()=>{ if(문단버퍼.length){ 나온것.push('<p>'+문단버퍼.map(인라인).join(' ')+'</p>'); 문단버퍼=[]; } };
  const 목록닫기=()=>{ if(목록버퍼){ 나온것.push('<ul>'+목록버퍼.map(x=>'<li>'+인라인(x)+'</li>').join('')+'</ul>'); 목록버퍼=null; } };
  const 표닫기=()=>{
    if(!표버퍼) return;
    const [머리,...몸]=표버퍼;
    const 칸=(줄)=>줄.replace(/^\||\|$/g,'').split('|').map(x=>x.trim());
    나온것.push('<div class="표감"><table><thead><tr>'+칸(머리).map(c=>'<th>'+인라인(c)+'</th>').join('')+
      '</tr></thead><tbody>'+몸.map(r=>'<tr>'+칸(r).map(c=>'<td>'+인라인(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>');
    표버퍼=null;
  };
  const 다닫기=()=>{ 문단닫기(); 목록닫기(); 표닫기(); };

  for(; i<줄들.length; i++){
    const 줄=줄들[i], t=줄.trim();
    if(!t){ 다닫기(); continue; }
    if(/^#{1,6}\s/.test(t)){
      다닫기();
      const 급=t.match(/^#+/)[0].length, 글=t.replace(/^#+\s*/,'');
      const id='절'+목차.length;
      if(급<=2) 목차.push({id, 글, 급});
      나온것.push(`<h${급} id="${id}">${인라인(글)}</h${급}>`);
      continue;
    }
    if(/^---+$/.test(t)){ 다닫기(); 나온것.push('<hr>'); continue; }
    if(/^\|/.test(t)){
      문단닫기(); 목록닫기();
      if(/^\|[\s:|-]+\|?$/.test(t)) continue;      // 표 구분선
      (표버퍼 ||= []).push(t); continue;
    }
    if(/^>\s?/.test(t)){
      다닫기();
      const 모음=[]; while(i<줄들.length && /^>\s?/.test(줄들[i].trim())){ 모음.push(줄들[i].trim().replace(/^>\s?/,'')); i++; }
      i--;
      나온것.push('<blockquote>'+모음.filter(Boolean).map(x=>'<p>'+인라인(x)+'</p>').join('')+'</blockquote>');
      continue;
    }
    if(/^\s*[-*+]\s/.test(줄)){ 문단닫기(); 표닫기(); (목록버퍼 ||= []).push(t.replace(/^[-*+]\s*/,'')); continue; }
    문단버퍼.push(t);
  }
  다닫기();
  return { 본문: 나온것.join('\n'), 목차 };
}
module.exports = { 바꾸기 };
