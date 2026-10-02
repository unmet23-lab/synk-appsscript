'use strict';
const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'../../..');const changed=[];
function update(p,fn){const abs=path.join(root,p),s=fs.readFileSync(abs,'utf8'),out=fn(s);if(out!==s){fs.writeFileSync(abs,out);changed.push(p);}}
const table=`| 엔진 | 맡는 역할 |
|---|---|
| **SYNK Core** | 학습 기록과 목표를 바탕으로 지금 필요한 도움을 고른다 |
| **SYNK Loom** | 재질·빛·배치·움직임으로 실제 화면과 장면을 표현한다 |
| **SYNK Vellum** | 확인된 맥락에 맞는 말·안내·몸짓을 사람에게 전달한다 |
| **SYNK Trail** | 목표와 경험, 확인된 이후의 결과를 시간에 따라 잇는다 |
| **SYNK Prism** | 여러 학습 경험에서 반복되는 어려움을 집계해 교육 재료를 개선한다 |
| **SYNK Temper** | 어떤 도움 뒤 무엇이 달라졌는지 조건과 근거를 대조한다 |
| **SYNK Reed** | 음악·소리·방송과 소리가 놓이는 경험의 규격을 맡는다 |
| **SYNK Strata** | 배울 내용·선행 관계·급수·상황을 연결한 학습 지도를 맡는다 |
`;
const atlas=`**SYNK Atlas는 여덟 엔진을 필요한 경험에 연결하는 상위 시스템이다.** 기억 → 결정 → 제공 → 확인을 잇고, 각 엔진은 자기 역할을 맡는다. 학생 한 명분의 축적된 이해는 Atlas가 만드는 결과 중 하나다.

Reed는 음악과 소리의 층으로 참여하며 개인 청취를 학습자 수집으로 강제하지 않는다. Strata는 사람의 성향이 아니라 배울 내용의 지도를 맡는다. Amber는 Vellum 안의 개념이고 Patina는 Loom 안의 개념이며 별도 엔진으로 세지 않는다.

2026-09-21 기준 엔진 구성이다. 8종의 역할이 정해졌다는 것이 모두 구현·배포됐다는 뜻은 아니다. Strata는 설계와 관련 재료를 준비한 단계이며 독립된 지도와 소비 연결은 후속 작업이다. 현재 범위는 docs/엔진/지도_20260921/SYNK_Atlas_엔진지도_20260921.html과 docs/엔진8종_상향설계_v3.md에서 확인한다.
`;
function section(s,start,end,replacement){const a=s.indexOf(start),b=s.indexOf(end,a+start.length);if(a<0||b<0)throw Error('Section missing: '+start);return s.slice(0,a)+replacement+'\n\n'+s.slice(b);}
update('docs/정본/SYNK/SYNK 기업소개서.txt',s=>section(s,'### 하나. 엔진 여덟','### 둘.','### 하나. 엔진 여덟, 그리고 그것이 만드는 것\n\n학생의 배움과 경험을 돕는 일을 여덟 엔진이 나누어 맡습니다.\n\n'+table+'\n'+atlas));
update('docs/정본/SYNK/SYNK 기업마스터.txt',s=>section(s,'## 3. 엔진 여덟','### 1년차 과녁','## 3. 엔진 여덟과 SYNK Atlas\n\n'+table+'\n'+atlas).replace('여섯을 깊게 짓는 게 아니라, 여섯을 꿰뚫는 한 줄을 먼저 뚫는다.','담당 엔진을 실제 사용자 경험으로 연결하는 한 흐름부터 완성한다.'));
update('docs/정본/SYNK 보안/SYNK_사업계획서.txt',s=>section(s,'### 엔진 여덟','### 1년차 과녁','### 엔진 여덟과 SYNK Atlas\n\n'+table+'\n'+atlas).replace('여섯을 깊게 짓는 게 아니라, 여섯을 꿰뚫는 한 줄을 먼저 뚫는다.','담당 엔진을 실제 사용자 경험으로 연결하는 한 흐름부터 완성한다.'));
update('docs/정본/SYNK LAB/SYNK LAB 상세서.txt',s=>section(s,'## 8. 엔진 여덟','### 세계관','## 8. 엔진 여덟과 그 위의 것들\n\n'+table+'\n'+atlas));
update('docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/04_SYNK_크루_핸드북.txt',s=>section(s,'**엔진은 여덟입니다.**','이 이름들은','**엔진은 여덟입니다.** 배움과 사람에게 닿는 경험을 나누어 맡는 시스템입니다.\n\n'+table+'\n'+atlas));
update('docs/제품방향.md',s=>s.replace(/현재 엔진은 일곱이다:[^\r\n]+/, '현재 엔진은 여덟이다: Core(기억·판단), Loom(화면과 제작), Vellum(말과 행동), Trail(시간에 따른 경험), Prism(반복되는 어려움의 집계), Temper(도움의 효과 대조), Reed(소리와 경험), Strata(배울 내용과 순서의 지도). **SYNK Atlas는 여덟 엔진을 한 제품 경험으로 통합하는 상위 시스템**이다. Core는 Atlas의 중심 두뇌이고, 학생 한 명분의 축적된 이해는 Atlas가 만드는 학생 지도다. Reed는 소리와 경험의 층으로 참여하며 개인 청취 수집을 강제하지 않는다. Strata는 학습 내용의 지도를 맡고 현재 설계와 관련 재료를 준비한 단계다. 구현·원격 반영 상태는 [현재 엔진 지도](엔진/지도_20260921/SYNK_Atlas_엔진지도_20260921.html)와 실제 코드·배포 증거를 대조한다.'));
update('docs/SYNK_로드맵.html',s=>{
 const start='<h3>이미 가진 것 ③ — 엔진 일곱 (회사의 심장)</h3>',a=s.indexOf(start),end=s.indexOf('<h3>엔진은 이렇게 배운다',a);if(a<0||end<0)throw Error('Old roadmap engine block missing');
 const rows=[['Core','지금 필요한 다음 도움을 고르는 중심'],['Loom','재질·빛·움직임으로 화면과 장면을 표현'],['Vellum','확인한 맥락에 맞는 말과 안내'],['Trail','시간에 따라 이어지는 목표와 경험'],['Prism','여러 경험에서 반복되는 어려움의 집계'],['Temper','도움과 후행 변화를 조건에 맞춰 대조'],['Reed','음악·소리·방송의 경험과 규격'],['Strata','배울 내용·선행 관계·상황을 연결하는 지도']];
 return s.slice(0,a)+`<h3>회사의 공통 기반 — 엔진 여덟</h3><p class="작게">SYNK Atlas는 여덟 엔진을 기억·결정·제공·확인의 흐름으로 연결합니다. 엔진별 역할과 구현 단계는 다릅니다. Strata는 설계와 관련 재료를 준비한 단계입니다. 2026-09-21의 <a href="엔진/지도_20260921/SYNK_Atlas_엔진지도_20260921.html">현재 구현 지도</a>와 <a href="앱로드맵_20260921/SYNK_WORLD_앱로드맵_20260921.html">새 앱 로드맵</a>에서 현재 범위를 확인하세요. 아래의 다른 항목은 기존 문서의 작성 시점 기록입니다.</p><div class="표스크롤"><table class="표 빽빽"><tr><th>엔진</th><th>맡는 역할</th></tr>${rows.map(([n,r])=>'<tr><td><b>SYNK '+n+'</b></td><td>'+r+'</td></tr>').join('')}</table></div>\n\n`+s.slice(end);
});
console.log(JSON.stringify({changed}));fs.writeFileSync(path.join(__dirname,'역할표변경.json'),JSON.stringify(changed,null,2)+'\n');
