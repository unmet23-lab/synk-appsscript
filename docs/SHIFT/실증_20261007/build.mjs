import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..');
const out=path.join(root,'outputs/01a10c3d-cfe1-7c40-a1db-eea42c604fd6/shift-evidence-20261007'),qa=path.join(here,'qa');
await fs.mkdir(out,{recursive:true});await fs.mkdir(qa,{recursive:true});
const wb=Workbook.create(),names=['요약','업무범위','시행기록','원가기록','재사용기록','판단기록'];
const sh=Object.fromEntries(names.map(n=>[n,wb.worksheets.add(n)]));
const c={ink:'#172131',muted:'#657184',navy:'#24448C',light:'#EDF2FA',input:'#FFF2CC',rule:'#D5DBE5',red:'#9C2028'};
const num='#,##0;(#,##0);"-";@',dec='#,##0.0;(#,##0.0);"-";@',pct='0.0%;(0.0%);"-";@',money='"₩" #,##0;"₩" (#,##0);"-";@';
const V=(s,a,v)=>sh[s].getRange(a).values=[[v]],F=(s,a,f)=>{sh[s].getRange(a).formulas=[[f]];sh[s].getRange(a).format.font.color=s==='요약'?c.ink:f.includes('!')?'#008000':'#000000';};
const value=(s,a)=>sh[s].getRange(a).values[0][0];
function base(s,title,subtitle,lastCol,end=74){const x=sh[s];x.showGridLines=false;x.getRange(`A1:${lastCol}${end}`).format={font:{name:'SUIT BM',size:11,color:c.ink},rowHeight:28,verticalAlignment:'center'};x.getRange(`A:${lastCol}`).format.columnWidth=17;V(s,'A2',title);x.getRange(`A2:${lastCol}2`).format={font:{size:17,bold:true},rowHeight:38,borders:{bottom:{style:'thin',color:c.navy}}};V(s,'A3',subtitle);x.getRange(`A3:${lastCol}3`).format={font:{size:10,italic:true,color:c.muted},rowHeight:29};}
function head(s,a,values){sh[s].getRange(a).values=[values];sh[s].getRange(a).format={fill:c.navy,font:{bold:true,color:'#FFFFFF'},rowHeight:42,wrapText:true,horizontalAlignment:'center',borders:{insideVertical:{style:'thin',color:'#FFFFFF'}}};}
function input(s,a,fmt){sh[s].getRange(a).format={fill:c.input,font:{color:'#0000FF'},...(fmt?{numberFormat:fmt,horizontalAlignment:'right'}:{})};}
function list(s,a,values){sh[s].getRange(a).dataValidation={rule:{type:'list',values}};}
function numeric(s,a,max=1e12,type='decimal'){sh[s].dataValidations.add({range:a,rule:{type,operator:'between',formula1:0,formula2:max}});}
function band(s,r,text,last='J'){V(s,`A${r}`,text);sh[s].getRange(`A${r}:${last}${r}`).format={fill:c.light,font:{bold:true},rowHeight:31};}
function negative(s,a){sh[s].getRange(a).conditionalFormats.add('cellIs',{operator:'lessThan',formula:0,format:{fill:'#FBE7E8',font:{color:c.red}}});}
function note(s,r,label,text,last='J'){V(s,`A${r}`,label);V(s,`D${r}`,text);sh[s].getRange(`A${r}:${last}${r}`).format.rowHeight=32;sh[s].getRange(`D${r}:${last}${r}`).format.font={size:10,color:c.muted};}

base('업무범위','고객별 한 업무의 범위','고객·업무·계약·비교 기준은 미정입니다. 확인한 내용만 노란 칸에 입력하세요.','E',40);
sh['업무범위'].getRange('A:A').format.columnWidth=29;sh['업무범위'].getRange('B:B').format.columnWidth=51;sh['업무범위'].getRange('C:C').format.columnWidth=3;sh['업무범위'].getRange('D:D').format.columnWidth=51;sh['업무범위'].getRange('E:E').format.columnWidth=58;
head('업무범위','A6:E6',['항목','고객1','','고객2','작성할 내용']);
const fields=[['고객명','비식별 고객 코드 또는 명칭. 고객1·2는 구분 라벨입니다.'],['한 업무','개인화를 적용할 한 과업'],['사용자의 완료 결과','관찰할 최종 행동 또는 납품 결과'],['비교그룹 ID','같은 조건으로 비교하는 그룹 ID'],['업무·자료 버전','시행 기록과 일치하는 버전'],['대상·제외 조건','사용자·업무 난이도·권한과 제외 조건'],['측정 시작일','비교 대상의 시작 날짜'],['측정 종료일','비교 대상의 종료 날짜'],['비교 방법','동시 비교·교차 적용·전후 비교 등 실제 방법'],['배정·조건 차이','선정·배정 방식과 학습·기간·난이도 차이'],['완료·실패·중단 기준','완료 판정과 중단을 구분하는 사전 기준'],['시간 측정 경계','대기·검토·재작업을 포함하는지'],['오류·사람 전환 기준','오류 정의·검증 담당·사람에게 넘기는 조건'],['인수 기준','대상·결과물·합격 판단과 검수 담당'],['지원·추가 개발 범위','포함·제외·수정 횟수 등 실제 합의'],['자료·권한·보관·삭제','고객 자료의 권리와 고객별 경계'],['도입·운영 담당','SYNK와 고객사 담당·권한'],['기한·종료 조건','기한 또는 중단·종료 조건'],['합의한 비용 한도','가격표·예산을 임의로 확정하지 않습니다.'],['세금 제외 실제 매출 (원)','확인된 발생 매출. 수금액과 다릅니다.'],['원가 기록 완료 여부','빠진 항목까지 확인한 뒤 완료. 없던 비용은 명시적 0.'],['고객2와 업무·조건 차이','고객1과 비교할 때 규모·범위·지원 차이'],['공통 개선의 기존 고객 적용','호환성 확인과 기존 고객에 적용한 실제 범위'],['근거·확정 담당','계약·기록 위치와 확인자. 민감한 원문은 넣지 않습니다.']];
fields.forEach(([label,hint],i)=>{const r=7+i;V('업무범위',`A${r}`,label);V('업무범위',`E${r}`,hint);input('업무범위',`B${r}`);input('업무범위',`D${r}`);sh['업무범위'].getRange(`A${r}:E${r}`).format={rowHeight:52,wrapText:true,verticalAlignment:'top'};});
for(const col of ['B','D']){sh['업무범위'].getRange(`${col}13:${col}14`).setNumberFormat('yyyy-mm-dd');input('업무범위',`${col}25:${col}26`,money);numeric('업무범위',`${col}25:${col}26`);list('업무범위',`${col}27`,['미완료','완료']);}
V('업무범위','A33','사업 기준');V('업무범위','B33','SHIFT BM 정본, 2026-10-06 확정. 한 업무 도입·운영부터 반복 공급 검증 후 API·라이선스 확장.');sh['업무범위'].getRange('B33:E33').format={font:{size:10,color:c.muted},rowHeight:30};
V('업무범위','A35','입력 순서');V('업무범위','B35','범위 확정 → 시행·원가·재사용 기록 → 인수와 결과 판단');

base('시행기록','사용자 시행별 결과','한 행은 한 과업 시행입니다. 실패·중단은 완료율 분모에 포함하고 미측정·제외는 따로 표시합니다.','U',74);
const trialHeaders=['시행 ID','고객','비교그룹 ID','방식','날짜','비식별 대상 ID','업무·자료 버전','결과','작업시간 (분)','오류 수','사람 전환 (0/1)','제외 사유','근거','집계 상태','완료 (0/1)','시간 (분)','오류 수','사람 전환','시간 측정 (0/1)','오류 측정 (0/1)','전환 측정 (0/1)'];
head('시행기록','A6:U6',trialHeaders);input('시행기록','A7:M66');sh['시행기록'].getRange('M:M').format.columnWidth=28;sh['시행기록'].getRange('L:L').format.columnWidth=28;sh['시행기록'].getRange('N:N').format.columnWidth=18;sh['시행기록'].getRange('E7:E66').setNumberFormat('yyyy-mm-dd');sh['시행기록'].getRange('I7:I66').setNumberFormat(dec);
list('시행기록','B7:B66',['고객1','고객2']);list('시행기록','D7:D66',['기존','개인화']);list('시행기록','H7:H66',['완료','실패','중단','미측정']);numeric('시행기록','I7:J66');numeric('시행기록','K7:K66',1,'whole');
for(let r=7;r<=66;r++){const group=`IF(B${r}="고객1",'업무범위'!B10,'업무범위'!D10)`,version=`IF(B${r}="고객1",'업무범위'!B11,'업무범위'!D11)`,start=`IF(B${r}="고객1",'업무범위'!B13,'업무범위'!D13)`,end=`IF(B${r}="고객1",'업무범위'!B14,'업무범위'!D14)`;
 F('시행기록',`N${r}`,`=IF(COUNTA(A${r}:M${r})=0,"",IF(OR(A${r}="",COUNTIFS($A$7:$A$66,A${r})<>1,AND(B${r}<>"고객1",B${r}<>"고객2"),C${r}="",${group}="",C${r}<>${group},AND(D${r}<>"기존",D${r}<>"개인화"),COUNT(E${r})<>1,${start}<=0,${end}<=0,${end}<${start},E${r}<${start},E${r}>${end},F${r}="",G${r}="",${version}="",G${r}<>${version},AND(H${r}<>"완료",H${r}<>"실패",H${r}<>"중단",H${r}<>"미측정"),M${r}=""),"입력확인",IF(L${r}<>"","제외",IF(H${r}="미측정","미측정","집계"))))`);
 F('시행기록',`O${r}`,`=IF(N${r}="집계",IF(H${r}="완료",1,0),"")`);
 for(const [dest,src]of[['P','I'],['Q','J'],['R','K']])F('시행기록',`${dest}${r}`,`=IF(AND(N${r}="집계",COUNT(${src}${r})=1,${src}${r}>=0${dest==='Q'?`,MOD(${src}${r},1)=0`:dest==='R'?`,${src}${r}<=1,MOD(${src}${r},1)=0`:''}),${src}${r},"")`);
 for(const [dest,src]of[['S','P'],['T','Q'],['U','R']])F('시행기록',`${dest}${r}`,`=IF(N${r}="집계",COUNT(${src}${r}),"")`);
}
sh['시행기록'].getRange('N7:N66').conditionalFormats.add('containsText',{text:'입력확인',format:{fill:'#FBE7E8',font:{color:c.red}}});sh['시행기록'].freezePanes.freezeRows(6);sh['시행기록'].freezePanes.freezeColumns(2);
V('시행기록','A69','빈칸과 0');V('시행기록','D69','측정하지 않은 값은 빈칸, 확인한 0만 입력. 시간·오류·사람 전환의 누락은 각각 구분합니다.');

base('원가기록','도입·운영의 전체 원가','대표 시간·지원·영업·자료 정리·모델·서버·저장·외주를 기록합니다. 같은 비용은 한 번만 입력합니다.','P',74);
head('원가기록','A6:P6',['기록 ID','고객','날짜','단계','변경·비용 분류','업무·비용 항목','시간 (시간)','시간단가 (원)','노동 현금 (원)','비노동 현금 (원)','고객 배분율','근거','경제 원가 (원)','현금 원가 (원)','배분 시간','기록 상태']);
input('원가기록','A7:L66');sh['원가기록'].getRange('E:E').format.columnWidth=22;sh['원가기록'].getRange('F:F').format.columnWidth=29;sh['원가기록'].getRange('L:L').format.columnWidth=28;sh['원가기록'].getRange('C7:C66').setNumberFormat('yyyy-mm-dd');sh['원가기록'].getRange('G7:G66').setNumberFormat(dec);sh['원가기록'].getRange('H7:J66').setNumberFormat(money);sh['원가기록'].getRange('K7:K66').setNumberFormat(pct);sh['원가기록'].getRange('M7:N66').setNumberFormat(money);sh['원가기록'].getRange('O7:O66').setNumberFormat(dec);
list('원가기록','B7:B66',['고객1','고객2']);list('원가기록','D7:D66',['도입','운영']);list('원가기록','E7:E66',['Atlas 공통','전문 모듈','고객 설정·연결','제품 호스트','영업·지원','공통비 배분']);numeric('원가기록','G7:J66');numeric('원가기록','K7:K66',1);
for(let r=7;r<=66;r++){
 F('원가기록',`P${r}`,`=IF(COUNTA(A${r}:L${r})=0,"",IF(OR(A${r}="",COUNTIFS($A$7:$A$66,A${r})<>1,AND(B${r}<>"고객1",B${r}<>"고객2"),COUNT(C${r})<>1,AND(D${r}<>"도입",D${r}<>"운영"),AND(E${r}<>"Atlas 공통",E${r}<>"전문 모듈",E${r}<>"고객 설정·연결",E${r}<>"제품 호스트",E${r}<>"영업·지원",E${r}<>"공통비 배분"),F${r}="",COUNT(G${r}:K${r})<>5,MIN(G${r}:K${r})<0,K${r}>1,L${r}=""),"입력확인","집계"))`);
 F('원가기록',`M${r}`,`=IF(P${r}="집계",(G${r}*H${r}+J${r})*K${r},"")`);F('원가기록',`N${r}`,`=IF(P${r}="집계",SUM(I${r}:J${r})*K${r},"")`);F('원가기록',`O${r}`,`=IF(P${r}="집계",G${r}*K${r},"")`);
}
sh['원가기록'].freezePanes.freezeRows(6);sh['원가기록'].freezePanes.freezeColumns(2);
V('원가기록','A69','두 가지 원가');V('원가기록','D69','경제 원가 = 시간 × 시간단가 + 비노동 현금. 현금 원가 = 노동 현금 + 비노동 현금. 둘을 합산하지 않습니다.');
V('원가기록','A71','배분과 0');V('원가기록','D71','공통비는 근거 있는 배분율만 반영. 노동 없는 비용은 시간·단가·노동 현금을 확인한 0으로 입력. 대표 단가 미정은 빈칸.');

base('재사용기록','고객2에 재사용한 능력과 변경','동일한 능력·모듈의 기존 버전과 고객2 적용을 기록합니다. 시간·금액은 원가기록에서 한 번만 계산합니다.','J',40);
head('재사용기록','A6:J6',['능력·모듈 ID','책임 분류','고객1 버전·근거','고객2 적용 버전','고객2 처리','수정 내용·사유','고객1 반영·호환 확인','원가 기록 ID','수행·품질 확인 근거','기록 상태']);input('재사용기록','A7:I31');
for(const col of ['C','D','F','G','I'])sh['재사용기록'].getRange(`${col}:${col}`).format.columnWidth=30;
list('재사용기록','B7:B31',['Atlas 공통','전문 모듈','고객 설정·연결','제품 호스트']);list('재사용기록','E7:E31',['그대로 재사용','수정하여 재사용','신규 개발']);
for(let r=7;r<=31;r++){sh['재사용기록'].getRange(`A${r}:J${r}`).format={wrapText:true,rowHeight:52,verticalAlignment:'top'};F('재사용기록',`J${r}`,`=IF(COUNTA(A${r}:I${r})=0,"",IF(OR(A${r}="",COUNTIFS($A$7:$A$31,A${r})<>1,B${r}="",D${r}="",AND(E${r}<>"그대로 재사용",E${r}<>"수정하여 재사용",E${r}<>"신규 개발"),AND(E${r}<>"신규 개발",C${r}=""),F${r}="",G${r}="",H${r}="",COUNTIFS('원가기록'!$A$7:$A$66,H${r},'원가기록'!$B$7:$B$66,"고객2",'원가기록'!$E$7:$E$66,B${r},'원가기록'!$P$7:$P$66,"집계")<>1,I${r}=""),"입력확인","집계"))`);}
sh['재사용기록'].freezePanes.freezeRows(6);sh['재사용기록'].freezePanes.freezeColumns(2);
V('재사용기록','A34','읽는 기준');V('재사용기록','D34','기록된 모듈 개수 비율입니다. 범위·복잡도 가중치나 비용 절감률로 해석하지 않습니다.');

base('판단기록','인수와 다음 공급 판단','판단 기준·담당·판정은 미확정입니다. 숫자만으로 성공 또는 API 출시를 자동 판정하지 않습니다.','E',31);
sh['판단기록'].getRange('A:A').format.columnWidth=29;sh['판단기록'].getRange('B:B').format.columnWidth=51;sh['판단기록'].getRange('C:C').format.columnWidth=3;sh['판단기록'].getRange('D:D').format.columnWidth=51;sh['판단기록'].getRange('E:E').format.columnWidth=58;head('판단기록','A6:E6',['확인 항목','고객1','','고객2','필요한 판단·근거']);
const judgments=[['조건 비교 가능 여부','대상·난이도·기간·업무 버전 차이와 누락 범위'],['비교 결과의 해석','관찰된 차이. 전후 차이를 인과효과로 확정하지 않습니다.'],['인수 기준과 결과','사전에 정한 기준과 검수 결과·담당'],['오류·사용자 불편','실패·중단·미측정·사람 전환 원인과 후속 조치'],['권한·보관·삭제 확인','자료 사용 범위와 운영 책임 확인'],['원가 누락 확인','대표·수정·지원·영업·전체 AI 호출·서버·저장·배분'],['두 고객 간 공급 비교','범위·규모·납기·지원·품질 차이를 함께 확인'],['공통 개선 또는 전문 규칙','Atlas 능력 개선·전문 모듈·고객 설정·호스트 책임 구분'],['다음 공급 판단','계속·수정·중단 등 실제 판단과 이유'],['API·라이선스 확대 판단','반복 공급·품질·원가 근거가 마련된 뒤 별도 판단'],['확정 담당과 날짜','서명 또는 확인 기록·날짜'],['판단 근거 위치','비식별 근거 ID. 원문 권한은 별도 유지']];judgments.forEach(([label,hint],i)=>{const r=7+i;V('판단기록',`A${r}`,label);V('판단기록',`E${r}`,hint);input('판단기록',`B${r}`);input('판단기록',`D${r}`);sh['판단기록'].getRange(`A${r}:E${r}`).format={rowHeight:64,wrapText:true,verticalAlignment:'top'};});

base('요약','SHIFT 한 업무 실증과 반복 공급','실증 준비용 입력표. 고객·업무 미정, 실증 미실행. 빈칸은 0 또는 성과가 아닙니다.','J',67);sh['요약'].tabColor=c.navy;sh['요약'].getRange('A:A').format.columnWidth=29;sh['요약'].getRange('B:C').format.columnWidth=3;sh['요약'].getRange('G:G').format.columnWidth=3;sh['요약'].getRange('D:F').format.columnWidth=19;sh['요약'].getRange('H:J').format.columnWidth=19;
head('요약','D6:F6',['고객1 기존','고객1 개인화','관찰 차이']);head('요약','H6:J6',['고객2 기존','고객2 개인화','관찰 차이']);
const trialMetrics=[['결과 집계 시행 수','개'],['완료율','%'],['평균 작업시간','분'],['오류 있는 시행 비율','%'],['사람 전환 비율','%'],['실패 시행 수','개'],['중단 시행 수','개'],['미측정 시행 수','개'],['제외 시행 수','개'],['입력확인 시행 수','개'],['시간 측정 시행 수','개'],['오류 측정 시행 수','개'],['전환 측정 시행 수','개']];
const ranges={customer:"'시행기록'!$B$7:$B$66",method:"'시행기록'!$D$7:$D$66",status:"'시행기록'!$N$7:$N$66",result:"'시행기록'!$H$7:$H$66"};
for(const [customer,columns]of[['고객1',['D','E']],['고객2',['H','I']]])for(const [i,col]of columns.entries()){
 const method=i===0?'기존':'개인화',criteria=`${ranges.customer},"${customer}",${ranges.method},"${method}"`,n=`COUNTIFS(${criteria},${ranges.status},"집계")`,registered=`COUNTIFS(${criteria})`,guard=`IF(${registered}=0,"",`;
 F('요약',`${col}8`,`=${guard}${n})`);
 F('요약',`${col}9`,`=IF(${n}=0,"",SUMIFS('시행기록'!$O$7:$O$66,${criteria},${ranges.status},"집계")/${n})`);
 F('요약',`${col}10`,`=IF(${col}18="","",IF(${col}18=0,"",SUMIFS('시행기록'!$P$7:$P$66,${criteria},${ranges.status},"집계")/${col}18))`);
 for(const [row,flag,valueCol]of[[11,'T','Q'],[12,'U','R']]){const denom=`SUMIFS('시행기록'!$${flag}$7:$${flag}$66,${criteria},${ranges.status},"집계")`;F('요약',`${col}${row}`,`=IF(${denom}=0,"",${row===11?`COUNTIFS(${criteria},${ranges.status},"집계",'시행기록'!$${valueCol}$7:$${valueCol}$66,">0")`:`SUMIFS('시행기록'!$${valueCol}$7:$${valueCol}$66,${criteria},${ranges.status},"집계")`}/${denom})`);}
 for(const [row,result,status]of[[13,'실패','집계'],[14,'중단','집계'],[15,null,'미측정'],[16,null,'제외'],[17,null,'입력확인']])F('요약',`${col}${row}`,`=${guard}COUNTIFS(${criteria},${ranges.status},"${status}"${result?`,${ranges.result},"${result}"`:''}))`);
 for(const [row,flag]of[[18,'S'],[19,'T'],[20,'U']])F('요약',`${col}${row}`,`=${guard}SUMIFS('시행기록'!$${flag}$7:$${flag}$66,${criteria},${ranges.status},"집계"))`);
}
trialMetrics.forEach(([label,unit],i)=>V('요약',`A${8+i}`,unit==='분'?`${label} (분)`:label));
V('요약','A22','전체 입력확인 시행 (개)');F('요약','D22',`=IF(COUNTA('시행기록'!A7:M66)=0,"",COUNTIFS('시행기록'!N7:N66,"입력확인"))`);
for(const [delta,before,after]of[['F','D','E'],['J','H','I']])for(const r of[9,10,11,12])F('요약',`${delta}${r}`,`=IF(COUNT(${before}${r},${after}${r})=2,${after}${r}-${before}${r},"")`);
for(const r of[9,11,12])sh['요약'].getRange(`D${r}:J${r}`).setNumberFormat(pct);sh['요약'].getRange('D10:J10').setNumberFormat(dec);
band('요약',23,'도입·운영 원가와 재사용');head('요약','D24:F24',['고객1','고객2','고객2 − 고객1']);
const costLabels={25:'도입 배분시간 (시간)',26:'운영 배분시간 (시간)',27:'전체 배분시간 (시간)',28:'Atlas 공통 시간 (시간)',29:'전문 모듈 시간 (시간)',30:'고객 설정·연결 시간 (시간)',31:'제품 호스트 시간 (시간)',32:'영업·지원 시간 (시간)',33:'공통비 배분 시간 (시간)',35:'경제 원가 (원)',36:'현금 원가 (원)',37:'입력확인 원가 기록 (개)',38:'원가 기록 완료 여부',40:'세금 제외 실제 매출 (원)',41:'매출 − 경제 원가 (원)',42:'매출 − 현금 원가 (원)',45:'고객2 재사용 대상 기록 (개)',46:'그대로·수정 재사용 (개)',47:'신규 개발 (개)',48:'재사용 기록 비율',49:'입력확인 재사용 기록 (개)'};
for(const[r,label]of Object.entries(costLabels))V('요약',`A${r}`,label);
for(const [customer,col,scope]of[['고객1','D','B'],['고객2','E','D']]){
 const criteria=`'원가기록'!$B$7:$B$66,"${customer}"`,n=`COUNTIFS(${criteria},'원가기록'!$P$7:$P$66,"집계")`,registered=`COUNTIFS(${criteria})`,sum=(field,more='')=>`IF(${n}=0,"",SUMIFS('원가기록'!$${field}$7:$${field}$66,${criteria},'원가기록'!$P$7:$P$66,"집계"${more}))`;
 for(const [r,phase]of[[25,'도입'],[26,'운영']])F('요약',`${col}${r}`,`=${sum('O',`,'원가기록'!$D$7:$D$66,"${phase}"`)}`);
 F('요약',`${col}27`,`=${sum('O')}`);
 for(const [r,kind]of[[28,'Atlas 공통'],[29,'전문 모듈'],[30,'고객 설정·연결'],[31,'제품 호스트'],[32,'영업·지원'],[33,'공통비 배분']])F('요약',`${col}${r}`,`=${sum('O',`,'원가기록'!$E$7:$E$66,"${kind}"`)}`);
 for(const [r,field]of[[35,'M'],[36,'N']])F('요약',`${col}${r}`,`=${sum(field)}`);
 F('요약',`${col}37`,`=IF(${registered}=0,"",COUNTIFS(${criteria},'원가기록'!$P$7:$P$66,"입력확인"))`);
 F('요약',`${col}38`,`=IF('업무범위'!${scope}27="","미확인",IF(AND('업무범위'!${scope}27="완료",${registered}>0,${col}37=0,COUNTIFS('원가기록'!$P$7:$P$66,"입력확인")=0),"완료","미완료"))`);
 F('요약',`${col}40`,`=IF(COUNT('업무범위'!${scope}26)=1,'업무범위'!${scope}26,"")`);
 for(const [r,cost]of[[41,35],[42,36]])F('요약',`${col}${r}`,`=IF(AND(${col}38="완료",COUNT(${col}40,${col}${cost})=2),${col}40-${col}${cost},"")`);
}
for(const r of[25,26,27,28,29,30,31,32,33,35,36,40,41,42])F('요약',`F${r}`,`=IF(COUNT(D${r}:E${r})=2,E${r}-D${r},"")`);
F('요약','E45',`=IF(COUNTA('재사용기록'!$A$7:$A$31)=0,"",COUNTIFS('재사용기록'!$J$7:$J$31,"집계"))`);
F('요약','E46',`=IF(E45="","",SUM(COUNTIFS('재사용기록'!$J$7:$J$31,"집계",'재사용기록'!$E$7:$E$31,"그대로 재사용"),COUNTIFS('재사용기록'!$J$7:$J$31,"집계",'재사용기록'!$E$7:$E$31,"수정하여 재사용")))`);
F('요약','E47',`=IF(E45="","",COUNTIFS('재사용기록'!$J$7:$J$31,"집계",'재사용기록'!$E$7:$E$31,"신규 개발"))`);F('요약','E48','=IF(OR(E45="",E45=0),"",E46/E45)');F('요약','E49',`=IF(COUNTA('재사용기록'!$A$7:$A$31)=0,"",COUNTIFS('재사용기록'!$J$7:$J$31,"입력확인"))`);
V('요약','A50','전체 입력확인 원가 (개)');F('요약','D50',`=IF(COUNTA('원가기록'!A7:L66)=0,"",COUNTIFS('원가기록'!P7:P66,"입력확인"))`);
sh['요약'].getRange('D25:F33').setNumberFormat(dec);sh['요약'].getRange('D35:F36').setNumberFormat(money);sh['요약'].getRange('D40:F42').setNumberFormat(money);sh['요약'].getRange('E48').setNumberFormat(pct);negative('요약','D41:F42');
note('요약',52,'입력 순서','업무범위 확정 후 시행·원가·재사용을 기록하고 판단기록을 작성합니다.');
note('요약',54,'완료율 분모','완료·실패·중단 결과가 확인된 시행. 미측정·제외·입력확인은 따로 표시합니다.');
note('요약',56,'측정 누락','시간·오류·전환의 측정 수를 결과 집계 수와 비교하세요. 각각의 분모가 다를 수 있습니다.');
note('요약',58,'관찰 차이','개인화 − 기존. 비율 차이는 %p. 조건 차이·배정·누락을 판단기록에서 함께 확인합니다.');
note('요약',60,'전체 원가','완료 확인 전에도 기록된 비용은 보입니다. 수익 잔액은 완료 확인 전 비워 둡니다.');
note('요약',62,'고객2 비교','고객2 − 고객1. 업무·규모·지원 차이가 있으면 시간 감소를 재사용 효과로 확정하지 않습니다.');
note('요약',64,'재사용 비율','기록된 능력·모듈 개수 기준. 비용·복잡도 가중치와 실제 효과는 별도 확인합니다.');

const checks=[],saved=[];
function set(s,a,v){saved.push([s,a,value(s,a)]);V(s,a,v);}
function expect(name,s,a,want){const got=value(s,a),ok=typeof want==='number'?typeof got==='number'&&Math.abs(got-want)<1e-8:got===want||want===''&&got===null;checks.push({name,sheet:s,cell:a,expected:want,actual:got,passed:ok});if(!ok)throw Error(`${name}: ${s}!${a} got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);}
for(const a of ['D8','D9','E8','H8','D35','E35','D40','E40','D41','E41','E45','E48'])expect('미입력 실적은 공란','요약',a,'');expect('전체 원가 미확인','요약','D38','미확인');
for(const col of ['B','D']){set('업무범위',`${col}10`,'QA-GROUP');set('업무범위',`${col}11`,'QA-v1');set('업무범위',`${col}13`,44999);set('업무범위',`${col}14`,45001);}
const trial=(r,customer,method,result,time,errors,handover,reason='')=>{const vals=[`QA-${r}`,customer,'QA-GROUP',method,45000,`SYNTHETIC-${r}`,'QA-v1',result,time,errors,handover,reason,'SYNTHETIC QA ONLY'];for(let i=0;i<vals.length;i++)set('시행기록',`${String.fromCharCode(65+i)}${r}`,vals[i]);};
trial(7,'고객1','기존','완료',10,0,0);trial(8,'고객1','기존','실패',20,2,1);trial(9,'고객1','개인화','완료',6,0,0);trial(10,'고객1','개인화','중단',null,null,null);trial(11,'고객1','개인화','미측정',null,null,null);trial(12,'고객1','개인화','실패',30,1,1,'조건 밖');
expect('완료와 실패를 분모에 포함','요약','D8',2);expect('실패를 성공으로 계산하지 않음','요약','D9',0.5);expect('중단을 분모에 포함','요약','E8',2);expect('중단을 성공으로 계산하지 않음','요약','E9',0.5);expect('중단 건수','요약','E14',1);expect('미측정 건수','요약','E15',1);expect('제외 건수','요약','E16',1);expect('시간 누락 시 측정 분모','요약','E18',1);expect('시간 누락을 0분으로 계산하지 않음','요약','E10',6);expect('관찰 시간 차이','요약','F10',-9);expect('오류의 개별 측정 분모','요약','E11',0);expect('사람 전환 비율','요약','D12',0.5);
set('시행기록','A9','QA-7');expect('중복 ID 검출','시행기록','N9','입력확인');expect('중복은 집계에서 제외','요약','E8',1);set('시행기록','A9','QA-9');set('시행기록','G9','QA-v2');expect('다른 버전을 혼합하지 않음','시행기록','N9','입력확인');set('시행기록','G9','QA-v1');set('시행기록','E9',45002);expect('측정 기간 밖은 집계하지 않음','시행기록','N9','입력확인');set('시행기록','E9',45000);set('시행기록','A9',null);expect('시행 ID 미입력 오류 표시','요약','E17',1);set('시행기록','A9','QA-9');
set('시행기록','I9',-1);expect('음수 작업시간은 집계하지 않음','요약','E18',0);expect('음수 시간 때문에 평균이 0이 되지 않음','요약','E10','');set('시행기록','I9',6);trial(66,'고객2','기존','완료',0,0,0);set('시행기록','H66','완료');expect('마지막 시행 행의 측정된 0분 보존','요약','H10',0);expect('고객 간 집계 분리','요약','D8',2);
const cost=(r,customer,phase,kind,hours,rate,labor,cash,allocation=1)=>{const vals=[`QA-COST-${r}`,customer,45000,phase,kind,'SYNTHETIC QA ONLY',hours,rate,labor,cash,allocation,'SYNTHETIC QA ONLY'];for(let i=0;i<vals.length;i++)set('원가기록',`${String.fromCharCode(65+i)}${r}`,vals[i]);};
cost(7,'고객1','도입','Atlas 공통',4,null,0,10000);expect('대표 시간단가 공란을 0으로 계산하지 않음','원가기록','P7','입력확인');expect('불완전 원가를 0원으로 계산하지 않음','요약','D35','');set('원가기록','H7',30000);cost(8,'고객1','운영','영업·지원',2,20000,30000,5000);cost(9,'고객1','도입','공통비 배분',0,0,0,20000,0.5);
expect('시간 가치와 노동 현금을 이중 계산하지 않음','요약','D35',185000);expect('현금 원가','요약','D36',55000);expect('대표를 포함한 전체 시간','요약','D27',6);expect('Atlas 공통 변경 분류','요약','D28',4);expect('영업·지원 분류','요약','D32',2);set('업무범위','B26',300000);expect('원가 미확인 시 잔액 미계산','요약','D41','');set('업무범위','B27','완료');expect('확인 후 경제 잔액','요약','D41',115000);expect('확인 후 현금 잔액','요약','D42',245000);
cost(10,'고객2','도입','전문 모듈',1,30000,0,0);cost(66,'고객2','도입','고객 설정·연결',2,30000,0,0);set('업무범위','D26',0);set('업무범위','D27','완료');expect('고객2 경제 원가','요약','E35',90000);expect('확인된 실제 매출 0원 보존','요약','E40',0);expect('매출 없음이 흑자로 계산되지 않음','요약','E41',-90000);expect('고객2 도입시간 차이','요약','F25',-1);expect('마지막 원가 행의 시간','요약','E30',2);
const reuse=(r,id,kind,old,mode,costID)=>{const vals=[id,kind,old,'QA-v1',mode,'SYNTHETIC QA ONLY','SYNTHETIC QA ONLY',costID,'SYNTHETIC QA ONLY'];for(let i=0;i<vals.length;i++)set('재사용기록',`${String.fromCharCode(65+i)}${r}`,vals[i]);};
reuse(7,'QA-MODULE','전문 모듈','QA-old','수정하여 재사용','QA-COST-10');reuse(31,'QA-CONNECTOR','고객 설정·연결','','신규 개발','QA-COST-66');expect('재사용 대상 기록 건수','요약','E45',2);expect('재사용 기록 비율','요약','E48',0.5);expect('신규 개발 건수','요약','E47',1);set('재사용기록','H7','QA-COST-7');expect('다른 고객의 원가 연결 거부','재사용기록','J7','입력확인');set('재사용기록','H7','QA-COST-10');set('원가기록','H10',null);expect('연결한 재사용 원가의 누락 표시','재사용기록','J7','입력확인');expect('원가 완료 선언만으로 완료 판정하지 않음','요약','E38','미완료');expect('불완전 원가는 잔액 공란','요약','E41','');
while(saved.length){const[s,a,v]=saved.pop();V(s,a,v);}wb.recalculate();
for(const s of ['업무범위','시행기록','원가기록','재사용기록','판단기록']){const range=s==='업무범위'?'B7:B30':s==='판단기록'?'B7:B18':s==='시행기록'?'A7:M66':s==='원가기록'?'A7:L66':'A7:I31';expect('합성 입력을 전달본에서 제거',s,range.split(':')[0],'');}
for(const a of ['D8','D9','E8','H10','D35','E35','D40','E40','D41','E41','E45','E48'])expect('복원 후 실적 공란','요약',a,'');
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:100},summary:'Formula error scan'});await fs.writeFile(path.join(qa,'errors.ndjson'),errors.ndjson);
await fs.writeFile(path.join(qa,'tests.json'),JSON.stringify(checks,null,2));const inspect=await wb.inspect({kind:'table',range:'요약!A6:J20',include:'values,formulas',tableMaxRows:15,tableMaxCols:10,maxChars:6000});await fs.writeFile(path.join(qa,'summary-inspect.ndjson'),inspect.ndjson);
const final=path.join(out,'SHIFT_한업무_실증과_반복공급_20261007.xlsx');await(await SpreadsheetFile.exportXlsx(wb)).save(final);
const views={요약:['A1:J21','A23:F49','A52:J65'],업무범위:['A1:E15','A16:E30'],시행기록:['A1:F13','G6:N13','N6:U13'],원가기록:['A1:F13','G6:P13','A69:P72'],재사용기록:['A1:E11','F6:J11'],판단기록:['A1:E12','A13:E19']};
const renders=[];for(const[s,ranges]of Object.entries(views))for(let i=0;i<ranges.length;i++){const range=ranges[i],blob=await wb.render({sheetName:s,range,scale:1,format:'png'}),file=`${s}-${i+1}.png`;await fs.writeFile(path.join(qa,file),new Uint8Array(await blob.arrayBuffer()));renders.push({sheet:s,range,file,scale:1});}
const bytes=await fs.readFile(final),sha=crypto.createHash('sha256').update(bytes).digest('hex');await fs.writeFile(path.join(qa,'manifest.json'),JSON.stringify({status:'prepared-real-customer-trial-not-run',output:final,outputBytes:bytes.length,outputSha256:sha,sheets:names,checks:checks.length,views:renders,syntheticQAOnly:true,actualCustomerInputBlank:true,actualResultsMeasured:false,nativeExcelPending:true},null,2));console.log(JSON.stringify({output:final,checks:checks.length,views:renders.length,sha256:sha}));
