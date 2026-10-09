import React, { useState } from 'react';
import { DataComponent, DataTable, ReportSection, RichNarrative, useDataApp } from '../../data-app-public.jsx';
import { prose } from './research-text.js';
import { EngineeringReport } from './EngineeringReport.jsx';
const columns=[
 {key:'name',label:'작품',renderCell:(v,r)=><a href={r.url} target="_blank" rel="noreferrer">{v}</a>},
 {key:'group',label:'시각 계열'}, {key:'release',label:'Steam 날짜',renderCell:(v,r)=>`${v}${r.comingSoon?' · 예정':r.status==='Early Access'?' · EA':''}`},
 {key:'positivePct',label:'게임 추천률',renderCell:v=>v==null?'—':`${v.toFixed(1)}%`},
 {key:'total',label:'리뷰 수',renderCell:v=>v==null?'—':v.toLocaleString()},
 {key:'platforms',label:'확인한 플랫폼'}
];
const catCols=[{key:'name',label:'목록',renderCell:(v,r)=><a href={r.url} target="_blank" rel="noreferrer">{v}</a>},{key:'tags',label:'검색 태그'},{key:'selection',label:'검토 범위'}];
export function ReportContent(){
 const {snapshot,reviewedPeriodRows,appTitle,canEdit,mode,setAppTitle}=useDataApp();
 const rows=reviewedPeriodRows('games'),catalogue=reviewedPeriodRows('catalog');
 const [category,setCategory]=useState('전체'),[focus,setFocus]=useState(null);
 const filtered=rows.filter(r=>category==='전체'||r.group===category),selected=rows.find(r=>r.appid===focus);
 const gallery=snapshot.research.galleryIds.map(id=>rows.find(r=>r.appid===id)).filter(Boolean);
 const sourcePreviews={
  'https://apps.apple.com/us/app/cozy-caravan/id6740474743?platform=ipad':{title:'Cozy Caravan · App Store',summary:'iPhone·iPad 출시와 외형·옷·액세서리, 터치 이동 및 선택 가능한 캐릭터 움직임을 확인한 공식 제품 페이지.',approvedForReport:true},
  'https://www.fantasylife.jp/fli/en/topics/260820/':{title:'FANTASY LIFE i 모바일 출시',summary:'LEVEL5가 2026년 8월 20일 iOS·Android 출시와 저장 공유를 공지했다.',date:'2026-08-20',approvedForReport:true},
  'https://www.fantasylife.jp/fli/en/guide/cross-save/':{title:'기기 간 저장 사용 안내',summary:'계정 연동 방식과 플랫폼별 구매·유료 특전의 사용 조건을 설명한다.',approvedForReport:true},
  'https://tinybookshopgame.com/':{title:'Tiny Bookshop 공식 홈페이지',summary:'PC·콘솔·iOS·Android 제품 링크와 서점 꾸미기 경험을 확인했다.',approvedForReport:true},
  'https://dev.epicgames.com/documentation/unreal-engine/using-lumen-global-illumination-on-mobile-in-unreal-engine':{title:'Epic · 모바일 Lumen',summary:'고급 Android에서 실험적으로 제공하는 기능이며 iOS 지원이 없다고 명시한다.',approvedForReport:true},
 };
 const N=({id})=><RichNarrative id={`synk:${id}`} value={prose[id]} sourcePreviews={sourcePreviews} label="보고서 본문 편집"/>;
 return <article className="report-content" aria-label="SYNK WORLD 그래픽 조사 보고서">
  <header className="report-hero"><span className="synk-kicker">RESEARCH / MOBILE FIRST / 2026.10.08–09</span>
   <h1 data-data-app-title contentEditable={canEdit&&mode==='edit'} suppressContentEditableWarning onBlur={e=>setAppTitle(e.currentTarget.textContent.trim()||appTitle)}>{appTitle}</h1>
   <RichNarrative id="engineering:intro" value="Galaxy S25 · iPhone 15 · PC를 위한 제작 기술 조사. 2026년 10월 9일 공식 문서를 다시 확인해 엔진·코스튬 생산·AI 자동화·출시 과정을 비교했다. 기존 시제품의 재사용 가능성은 평가에서 제외했다."/>
  </header>
  <EngineeringReport/>
  <div id="steam-reference"><RichNarrative id="engineering:reference-intro" value="## 시각 방향과 Steam 비교 자료\n\n아래는 앞서 조사한 54개 작품의 화면·평가·플랫폼 자료다. 게임의 미감과 반응을 위한 근거이며, 특정 엔진의 성능 비교 자료로 사용하지 않았다."/></div>
  <ReportSection id="recommendation" title="추천 방향" queryId="games" sourceRows={rows} showHeading={false}><N id="recommendation"/></ReportSection>
  <section><N id="visuals"/>
   <DataComponent id="visual-gallery" title="공식 스크린샷 비교" kind="custom" queryId="games" sourceRows={gallery} displayRows={gallery}>
    <div className="synk-gallery" data-reviewed-rows>{gallery.map(r=><figure key={r.appid}>
     <a href={r.shot} target="_blank" rel="noreferrer"><img src={r.shot} alt={`${r.name} 공식 Steam 스크린샷`} loading="lazy"/></a>
     <figcaption><strong><a href={r.url} target="_blank" rel="noreferrer">{r.name}</a></strong><span>{r.graphics}</span></figcaption>
    </figure>)}</div>
   </DataComponent>
  </section>
  <ReportSection id="reaction" title="반응의 해석" queryId="games" sourceRows={rows} showHeading={false}><N id="meaning"/></ReportSection>
  <section><RichNarrative id="synk:tableintro" value={`## 작품별 비교 · ${rows.length}종\n\n시각 계열을 고르거나 게임명을 검색할 수 있다. 행을 선택하면 코스튬·적용 판단과 공식 출처가 나온다. 그래픽 인기 순위가 아니다.`}/>
   <DataComponent id="games-table" title="작품·그래픽·플랫폼" queryId="games" kind="table" sourceRows={filtered} displayRows={filtered}>
    <DataTable rows={filtered} columns={columns} rowKey="appid" caption="생활 게임 그래픽 비교" onRowSelect={r=>setFocus(r.appid)} selectedRowKey={focus} rowActionLabel={r=>`${r.name} 자세히 보기`} toolbarControls={<label className="synk-filter">시각 계열 <select value={category} onChange={e=>setCategory(e.target.value)}><option>전체</option>{[...new Set(rows.map(r=>r.group))].map(g=><option key={g}>{g}</option>)}</select></label>}/>
   </DataComponent>
   {selected&&<ReportSection id="game-detail" title={selected.name} queryId="games" sourceRows={[selected]} showHeading={false}><RichNarrative id={`synk:game-${selected.appid}`} value={`### ${selected.name}\n\n**그래픽:** ${selected.graphics}\n\n**꾸미기:** ${selected.costume}\n\n**SYNK 판단:** ${selected.implication}\n\n**확인 범위:** ${selected.evidence}\n\n${selected.sources.map((u,i)=>`[출처 ${i+1}](${u})`).join(' · ')}`}/></ReportSection>}
  </section>
  <N id="alternatives"/><N id="style"/><N id="continuity"/><N id="platforms"/>
  <ReportSection id="methods" title="조사 범위" queryId="catalog" sourceRows={catalogue} showHeading={false}><N id="scope"/></ReportSection>
  <DataComponent id="catalog-table" title="4,989개 수집 목록에서 찾기" queryId="catalog" kind="table" sourceRows={catalogue} displayRows={catalogue}><DataTable rows={catalogue} columns={catCols} rowKey="appid" caption="Steam 태그 검색 수집 목록"/></DataComponent>
 </article>;
}
