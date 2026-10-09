import React from 'react';
import { DataComponent, DataTable, ReportSection, RichNarrative, useDataApp } from '../../data-app-public.jsx';
import { engineeringText } from './engineering-text.js';
const columns=[{key:'engine',label:'현재 비교 대상',renderCell:(v,r)=><a href={r.urls[0]} target="_blank" rel="noreferrer">{v}</a>},{key:'role',label:'SYNK 적합성 판단'},{key:'strength',label:'제작 효율의 장점'},{key:'cost',label:'추가로 감당할 작업'},{key:'change',label:'선택이 달라지는 조건'}];
const previews={
 'https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli':{title:'Unity CLI가 에디터 MCP를 대체',summary:'기존 AI assistant 패키지의 MCP 서버 폐기 범위, 공식 CLI 명령과 MCP 모드, 로컬 실행·검사·빌드 기능을 설명한다.',approvedForReport:true},
 'https://unity.com/releases/unity-6/support':{title:'Unity 6 지원 정책',summary:'신규·중기 제작용 Supported 업데이트와 버전을 고정할 제작용 LTS의 지원 방식을 구분한다.',approvedForReport:true},
 'https://unity.com/features/ai':{title:'Unity 공식 제작 도구',summary:'공식 플러그인·CLI·MCP 사용 경로와 별도 AI 크레딧 서비스의 차이를 설명한다.',approvedForReport:true},
};
export function EngineeringReport(){
 const {reviewedPeriodRows}=useDataApp(),rows=reviewedPeriodRows('engines'),sources=reviewedPeriodRows('engineeringSources');
 const N=({id})=><RichNarrative id={`engineering:${id}`} value={engineeringText[id]} sourcePreviews={previews} label="제작 방식 분석 편집"/>;
 return <div className="engineering-report">
  <nav className="engineering-nav" aria-label="조사 항목"><a href="#engineering-recommendation">추천 구성</a><a href="#engineering-engines">엔진 비교</a><a href="#engineering-costumes">코스튬 공정</a><a href="#engineering-automation">AI·자동화</a><a href="#engineering-proof">검증 기준</a><a href="#steam-reference">Steam 시각 자료</a></nav>
  <div id="engineering-recommendation"><ReportSection id="engineering-verdict" title="기존 구현을 제외한 권고" queryId="engines" sourceRows={rows} showHeading={false}><N id="verdict"/></ReportSection></div>
  <N id="versions"/>
  <div id="engineering-engines"><DataComponent id="engine-table" title="7개 제작 경로의 비교" kind="table" queryId="engines" sourceRows={rows} displayRows={rows}><DataTable rows={rows} columns={columns} searchable={false} rowKey="id" caption="네이티브와 웹 제작 경로 비교"/></DataComponent></div>
  <N id="architecture"/><N id="rendering"/>
  <div id="engineering-costumes"><N id="costume"/></div>
  <div id="engineering-automation"><N id="automation"/></div><N id="aiassets"/>
  <div id="engineering-proof"><N id="validation"/></div>
  <DataComponent id="engineering-sources" title="기술 조사 공식 출처" kind="table" queryId="engineeringSources" sourceRows={sources} displayRows={sources}>
   <DataTable rows={sources} columns={[{key:'title',label:'주제'},{key:'url',label:'공식 문서',renderCell:v=><a href={v} target="_blank" rel="noreferrer">{v}</a>},{key:'checkedAt',label:'확인 시점'}]} rowKey="id" caption="기술 조사 공식 출처 목록"/>
  </DataComponent>
 </div>;
}
