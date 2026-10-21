import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const out = path.join(root, 'outputs/01a10c3d-cfe1-7c40-a1db-eea42c604fd6/shift-bm-20261007');
const qa = path.join(here, 'qa');
await fs.mkdir(out, {recursive:true}); await fs.mkdir(qa, {recursive:true});
const data = JSON.parse(await fs.readFile(path.join(here,'products.json'),'utf8'));
const products = data.products;
const activeIndices=products.flatMap((p,i)=>p.calculation_scope==='legacy_reference'?[]:[i]);
const currentShiftIndices=products.flatMap((p,i)=>p.brand==='SHIFT'&&p.calculation_scope==='current'?[i]:[]);
const productNotesRow=products.length+9;
const inputNotesRow=prEnd();
function prEnd(){return 8+(products.length-1)*11+12;}
const wb = Workbook.create();
const names = ['요약','상품목록','판매조건','월별상품','인력과 LAB','운영비','현금입력','월별손익','상품계산','근거'];
const sheets = Object.fromEntries(names.map(n=>[n,wb.worksheets.add(n)]));
const C = {ink:'#10131A', muted:'#616975', blue:'#0000FF', green:'#008000', navy:'#24448C', light:'#EDF2FA', input:'#FFF2CC', rule:'#D5DBE5', red:'#9C2028'};
const font = 'SUIT BM';
const num = '#,##0;(#,##0);"-";@';
const dec = '#,##0.0;(#,##0.0);"-";@';
const money = '"₩" #,##0;"₩" (#,##0);"-";@';
const pct = '0.0%;(0.0%);"-";@';
const cols = Array.from({length:12},(_,i)=>String.fromCharCode(70+i));
const V=(s,a,v)=>sheets[s].getRange(a).values=[[v]];
const F=(s,a,v)=>{sheets[s].getRange(a).formulas=[[v]];sheets[s].getRange(a).format.font.color=v.includes('!')?C.green:'#000000';};
const link=(s,a,source)=>F(s,a,`=IF(COUNT(${source})=0,"",${source})`);
function input(s,a,v,format=num){V(s,a,v);sheets[s].getRange(a).format={fill:C.input,font:{color:C.blue},numberFormat:format,horizontalAlignment:'right'};}
function row(s,r,label,unit='',id=''){V(s,`C${r}`,id);V(s,`D${r}`,label);V(s,`E${r}`,unit);}
function base(s,title,sub,end=65){
 const sh=sheets[s];sh.showGridLines=false;
 sh.getRange(`A1:R${end}`).format={font:{name:font,size:11,color:C.ink},rowHeight:25,verticalAlignment:'center'};
 sh.getRange('A:B').format.columnWidth=2.2;
 sh.getRange('C:C').format.columnWidth=13; sh.getRange('D:D').format.columnWidth=30;sh.getRange('E:E').format.columnWidth=13;
 sh.getRange('F:Q').format.columnWidth=15;sh.getRange('R:R').format.columnWidth=3;
 V(s,'C2',title);sh.getRange('C2:Q2').format={font:{size:19,bold:true},rowHeight:36,borders:{bottom:{style:'thin',color:C.navy}}};
 V(s,'C3',sub);sh.getRange('C3:Q3').format={font:{size:10,italic:true,color:C.muted},rowHeight:25};
 sh.getRange(`F7:Q${end}`).setNumberFormat(num);
}
function timeline(s){
 row(s,6,'항목','단위','구분');
 for(let i=0;i<12;i++){const c=cols[i];if(s==='요약')V(s,`${c}6`,new Date(Date.UTC(2026,9+i,1)));else F(s,`${c}6`,`='요약'!${c}6`);}
 sheets[s].getRange('F6:Q6').setNumberFormat('yyyy-mm');
 header(s,'C6:Q6');
 if(s!=='요약'){sheets[s].freezePanes.freezeRows(6);sheets[s].freezePanes.freezeColumns(5);}
}
function header(s,a){sheets[s].getRange(a).format={fill:C.navy,font:{bold:true,color:'#FFFFFF'},horizontalAlignment:'center',rowHeight:29,borders:{insideVertical:{style:'thin',color:'#FFFFFF'}}};}
function section(s,r,title){V(s,`C${r}`,title);sheets[s].getRange(`C${r}:Q${r}`).format={fill:C.light,font:{bold:true},rowHeight:29};V(s,`A${r}`,'x');V(s,`B${r}`,'x');sheets[s].getRange(`A${r}:B${r}`).format.font.color='#AFB8C6';}
function total(s,r){sheets[s].getRange(`C${r}:Q${r}`).format={font:{bold:true},fill:'#F4F6FA',borders:{top:{style:'thin',color:C.rule}}};}
function negative(s,a){sheets[s].getRange(a).conditionalFormats.add('cellIs',{operator:'lessThan',formula:0,format:{fill:'#FBE7E8',font:{color:C.red}}});}
function valid(s,a,type='decimal',max=1000000000000){sheets[s].dataValidations.add({range:a,rule:{type,operator:'between',formula1:0,formula2:max}});}
function nonblankSum(refs){return `IF(COUNT(${refs.join(',')})=${refs.length},SUM(${refs.join(',')}),"")`;}
const pr = [], cr=[];
for(let i=0;i<products.length;i++){pr.push(8+i*11);cr.push(8+i*12);}

base('요약','SYNK 사업·인력·현금 계산','2026-10~2027-09 입력용. 현행 SHIFT 수량·가격은 미입력이며 참고 이력 8개는 합계에서 제외합니다.',68);timeline('요약');
base('상품목록','상품 기준표','현행 SHIFT 3단위는 가격·공수 미확정. 참고 이력은 개별 비교용이며 현행 합계에서 제외합니다.',productNotesRow+5);
const cat=sheets['상품목록'];cat.getRange('C:C').format.columnWidth=23;cat.getRange('D:D').format.columnWidth=10;cat.getRange('E:E').format.columnWidth=28;cat.getRange('F:F').format.columnWidth=18;cat.getRange('G:G').format.columnWidth=9;cat.getRange('H:J').format.columnWidth=15;cat.getRange('K:K').format.columnWidth=43;cat.getRange('L:L').format.columnWidth=54;cat.getRange('M:M').format.columnWidth=52;
cat.getRange('C6:M6').values=[['상품 ID','브랜드','상품','판매 단위','통화','참고 가격','공수 가정','직접비 가정','가격의 상태','공수·직접비의 상태','근거']];header('상품목록','C6:M6');
products.forEach((p,i)=>{const r=7+i;cat.getRange(`C${r}:M${r}`).values=[[p.id,p.brand,p.name,p.unit,p.currency,p.price_reference,p.assumed_hours,p.assumed_direct_cash_native,p.price_status,p.assumption_label,p.sourceLabel]];cat.getRange(`C${r}:M${r}`).format={wrapText:true,rowHeight:p.calculation_scope?100:65,verticalAlignment:'top',...(p.calculation_scope==='legacy_reference'?{fill:'#F4F4F4'}:{})};cat.getRange(`H${r}:J${r}`).setNumberFormat(num);});
cat.freezePanes.freezeRows(6);cat.freezePanes.freezeColumns(5);
V('상품목록',`C${productNotesRow}`,'학생월·구독월·좌석월은 해당 월 제공량입니다. 기간권 선수금은 현금입력에서 따로 조정합니다.');
V('상품목록',`C${productNotesRow+1}`,'LAB 기간 할인은 월별 판매가에 가중평균 월 단가로 입력합니다. 한 학생을 여러 상품에 중복 입력하지 않습니다.');
V('상품목록',`C${productNotesRow+2}`,'범위 가격의 하단값은 비교 기준일 뿐입니다. 주문별 범위·납기를 확정한 뒤 월별 판매가와 시간을 바꾸세요.');
V('상품목록',`C${productNotesRow+3}`,'참고 이력 8개는 현행 SHIFT 합계에 넣지 않습니다. 확인된 기존 계약이 있으면 실제 조건으로 별도 기록하세요.');

base('판매조건','상품별 판매 조건','현행 개인화 서비스의 계약 입력과 참고 이력을 구분합니다. 가격·기간·수정·지원은 실제 업무별 합의가 필요합니다.',8+(products.length-1)*8+7);
const terms=sheets['판매조건'];terms.getRange('C:C').format.columnWidth=20;terms.getRange('D:D').format.columnWidth=30;terms.getRange('E:E').format.columnWidth=115;
terms.getRange('C6:E6').values=[['브랜드·상품','항목','조건과 확인할 내용']];header('판매조건','C6:E6');
products.forEach((p,i)=>{const r=8+i*8;[['납품물',p.deliverables],['기간',p.turnaround],['수정·지원',p.revision_support],['제외·추가 견적',p.exclusions],['검수·판매 전 확인',p.acceptance],['가격·출처',`${p.price_status}. ${p.sourceLabel}`]].forEach(([label,text],j)=>{terms.getRange(`C${r+j}:E${r+j}`).values=[[j===0?p.brand:'',j===0?p.name:label,j===0?`${label}: ${text}`:text]];terms.getRange(`C${r+j}:E${r+j}`).format={rowHeight:p.calculation_scope?60:43,wrapText:true,verticalAlignment:'top',fill:j===0?C.light:'#FFFFFF'};});});
terms.freezePanes.freezeRows(6);terms.freezePanes.freezeColumns(4);

base('월별상품','월별 판매와 작업 원가','현행 SHIFT 3단위는 수량부터 미입력. 참고 이력은 합계 제외. 빈칸은 미확인, 명시적 0은 발생하지 않음.',inputNotesRow+2);timeline('월별상품');
products.forEach((p,i)=>{const r=pr[i];section('월별상품',r,`${String(i+1).padStart(2,'0')} ${p.brand} ${p.name}`);const defs=[['수량',p.unit,Object.hasOwn(p,'initial_quantity')?p.initial_quantity:0],['판매가',p.currency,p.price_reference],['가격에 포함된 세금률','%',null],['매출 기준 판매수수료율','%',null],['건당 직접 현금원가',p.currency,p.assumed_direct_cash_native],['건당 대표 작업시간','시간',p.assumed_hours],['건당 직원 작업시간','시간',null]];
 defs.forEach(([label,unit,value],j)=>{row('월별상품',r+j+1,label,unit,j===0?String(i+1).padStart(2,'0'):'');for(const c of cols)input('월별상품',`${c}${r+j+1}`,value,j===2||j===3?pct:j>=5?dec:num);valid('월별상품',`F${r+j+1}:Q${r+j+1}`,j===0?'whole':'decimal',j===2||j===3?1:1000000000000);});
 row('월별상품',r+8,'상태');V('월별상품',`F${r+8}`,p.assumption_label+' 대표 수행 가정이며 직원 전환 시 시간을 나눠 입력.');sheets['월별상품'].getRange(`F${r+8}:Q${r+8}`).format.font={size:10,color:C.muted};
 if(p.calculation_scope==='current'){sheets['월별상품'].getRange(`C${r+1}:Q${r+1}`).format.rowHeight=58;sheets['월별상품'].getRange(`E${r+1}`).format.wrapText=true;}
});
V('월별상품',`C${inputNotesRow}`,'수수료는 세금 제외 매출에 적용합니다. 실제 청구 기준이 다르면 같은 수수료 금액이 되도록 유효 요율을 입력하세요.');
V('월별상품',`C${inputNotesRow+1}`,'직접 현금원가는 재료·건별 API·외주 등입니다. 월급 직원의 노동비와 공통 구독료는 운영비에서만 반영합니다.');
V('월별상품',`C${inputNotesRow+2}`,'참고 이력의 과거 가격·시간을 현행 3단위에 전용하지 않습니다. 신규 수치·고객 효과·수익성은 입력 전 미확정입니다.');

base('인력과 LAB','환율·인력·LAB 운영량','환율은 외화 1단위당 원화. 직원의 직무·시간표 배정 가능성은 별도 확인해야 합니다.',61);timeline('인력과 LAB');sheets['인력과 LAB'].tabColor='#E4D4B2';
const laborDefs={8:['MNT 1당 KRW','원',null],9:['USD 1당 KRW','원',null],10:['대표 시간 가치','원/시간',30000],11:['대표 제공 가능 시간','시간',null],12:['대표 공통·영업 시간','시간',null],13:['제작·서비스 직원 용량','시간',null],14:['직원 공통·지원 시간','시간',null],15:['LAB 직원 강사 용량','시간',null],16:['대표의 LAB 수업·준비','시간',0],19:['반당 최대 학생 수','명',null],20:['반당 주간 수업','시간',7.5],21:['월 환산 주수','주',4.345],22:['반당 월 준비·정리','시간',null],23:['실제 운영 가능 반 수','반',null],24:['강사 공통·행정 시간','시간',null],35:['무료 활성 이용자','명',0],36:['무료 1명당 월 현금원가','원',null],37:['무료 대응 대표 시간','시간',null],38:['WORLD 콘텐츠 대표 시간','시간',null]};
section('인력과 LAB',17,'LAB 수업 공급');section('인력과 LAB',33,'무료 이용과 공통 제작');section('인력과 LAB',43,'전체 작업시간과 잔여 용량');
for(const [rs,[label,unit,value]] of Object.entries(laborDefs)){row('인력과 LAB',+rs,label,unit);for(const c of cols)input('인력과 LAB',`${c}${rs}`,value,rs==='8'?'0.0000':rs==='21'?'0.000':rs==='10'?num:dec);valid('인력과 LAB',`F${rs}:Q${rs}`);}
for(const [r,l,u] of [[26,'LAB 재학생','명'],[27,'필요 반 수','반'],[28,'수업·준비·행정 총시간','시간'],[29,'강사 잔여 시간','시간'],[30,'운영 가능 반 대비 여유','반'],[40,'무료 이용 현금원가','원'],[45,'대표 총 필요시간','시간'],[46,'대표 잔여 시간','시간'],[47,'직원 총 필요시간','시간'],[48,'직원 잔여 시간','시간'],[49,'대표 시간 가치 합계','원']])row('인력과 LAB',r,l,u);
const labIndex=products.findIndex(p=>p.brand==='LAB');
for(const c of cols){
 link('인력과 LAB',`${c}26`,`'월별상품'!${c}${pr[labIndex]+1}`);
 F('인력과 LAB',`${c}27`,`=IF(OR(COUNT(${c}26)=0,${c}26<0,MOD(${c}26,1)<>0),"",IF(${c}26=0,0,IF(OR(COUNT(${c}19)=0,${c}19<=0),"",ROUNDUP(${c}26/${c}19,0))))`);
 F('인력과 LAB',`${c}28`,`=IF(OR(COUNT(${c}27,${c}24)<2,${c}24<0),"",IF(${c}27=0,${c}24,IF(OR(COUNT(${c}20:${c}22)<3,MIN(${c}20:${c}21)<=0,${c}22<0),"",${c}27*(${c}20*${c}21+${c}22)+${c}24)))`);
 F('인력과 LAB',`${c}29`,`=IF(OR(COUNT(${c}15:${c}16,${c}28)<3,MIN(${c}15:${c}16,${c}28)<0),"",${c}15+${c}16-${c}28)`);
 F('인력과 LAB',`${c}30`,`=IF(OR(COUNT(${c}23,${c}27)<2,${c}23<0),"",${c}23-${c}27)`);
 F('인력과 LAB',`${c}40`,`=IF(OR(COUNT(${c}35)=0,${c}35<0,MOD(${c}35,1)<>0),"",IF(${c}35=0,0,IF(OR(COUNT(${c}36)=0,${c}36<0),"",${c}35*${c}36)))`);
 const owners=activeIndices.map(i=>`'상품계산'!${c}${cr[i]+4}`),staff=activeIndices.map(i=>`'상품계산'!${c}${cr[i]+5}`);
 F('인력과 LAB',`${c}45`,`=${nonblankSum([...owners,`${c}12`,`${c}16`,`${c}37`,`${c}38`])}`);
 F('인력과 LAB',`${c}46`,`=IF(OR(COUNT(${c}11,${c}45)<2,${c}11<0),"",${c}11-${c}45)`);
 F('인력과 LAB',`${c}47`,`=${nonblankSum([...staff,`${c}14`])}`);
 F('인력과 LAB',`${c}48`,`=IF(OR(COUNT(${c}13,${c}47)<2,${c}13<0),"",${c}13-${c}47)`);
 F('인력과 LAB',`${c}49`,`=IF(OR(COUNT(${c}10,${c}45)<2,${c}10<0),"",${c}10*${c}45)`);
}
[29,30,46,48].forEach(r=>negative('인력과 LAB',`F${r}:Q${r}`));
V('인력과 LAB','C52','LAB 수업시간은 강사 용량에서 따로 계산합니다. 상품별 직원 시간에는 수업 외 학생별 지원만 입력하세요.');
V('인력과 LAB','C53','대표가 직접 수업하면 16행에 수업·준비 시간을 입력합니다. 대표 필요시간과 강사 공급시간에 연결되므로 가용시간에서 다시 빼지 않습니다.');
V('인력과 LAB','C54','대표 공통·영업, 무료 대응, 콘텐츠 시간은 서로 겹치지 않게 입력합니다. 인력이 없거나 해당 업무가 없으면 0.');
V('인력과 LAB','C55','반당 정원은 가격·레벨별 편성의 단순화입니다. 실제 시간표의 반 수가 더 많으면 정원 또는 준비시간을 보수적으로 조정하세요.');
V('인력과 LAB','C56','대표 시간가치 30,000원, 월 4.345주는 비교용 가정입니다. 실제 급여·근무기록이 아닙니다.');

base('운영비','월별 고정·공통 운영비','계약·청구 또는 예산을 입력합니다. 미확인은 빈칸, 사용하지 않는 항목은 0. 상품 직접비를 다시 넣지 않습니다.',59);timeline('운영비');
const opex=[['대표 현금 급여','KRW'],['LAB 강사 급여·회사 부담','MNT'],['제작·서비스 직원 급여','KRW'],['관리·운영 직원 급여','MNT'],['임대료','MNT'],['관리비·전기·통신','MNT'],['공통 AI 구독','KRW'],['제작 도구·공통 라이선스','KRW'],['업무 도구·공용 계정','KRW'],['고정 서버·백업·저장','KRW'],['회계·법무·연납비 월 배분','KRW'],['마케팅·영업 고정비','KRW'],['학생 혜택·복지 고정비','MNT'],['기타 월 고정 운영비','KRW']];
opex.forEach(([label,cur],i)=>{const r=8+i;row('운영비',r,label,cur,String(i+1).padStart(2,'0'));sheets['운영비'].getRange(`E${r}`).dataValidation={rule:{type:'list',values:['KRW','MNT','USD']}};sheets['운영비'].getRange(`E${r}`).format={fill:C.input,font:{color:C.blue}};for(const c of cols)input('운영비',`${c}${r}`,null);valid('운영비',`F${r}:Q${r}`);});
section('운영비',25,'원화 환산');
opex.forEach(([label],i)=>{const r=27+i;row('운영비',r,label,'원');for(const c of cols){const src=`${c}${8+i}`,fx=`IF($E${8+i}="KRW",1,IF($E${8+i}="MNT",'인력과 LAB'!${c}8,IF($E${8+i}="USD",'인력과 LAB'!${c}9,"")))`;F('운영비',`${c}${r}`,`=IF(OR(COUNT(${src})=0,${src}<0),"",IF(${src}=0,0,IF(${fx}>0,${src}*${fx},"")))`);}});
row('운영비',43,'운영비 합계','원');row('운영비',44,'미확인 비용 항목','개');
for(const c of cols){F('운영비',`${c}43`,`=IF(COUNT(${c}27:${c}40)=14,SUM(${c}27:${c}40),"")`);F('운영비',`${c}44`,`=14-COUNT(${c}27:${c}40)`);}total('운영비',43);
V('운영비','C47','급여는 세후 수령액이 아니라 회사가 부담하는 총액입니다. 대표·직원 급여를 시간원가로 다시 비용 처리하지 않습니다.');
V('운영비','C48','여기에는 월 비용을 입력합니다. 연납 실제 지급과 월 배분의 차이는 현금입력의 비용 지급시점 조정으로 연결합니다.');
V('운영비','C49','시설·보증금·출자·차입은 현금입력에서 구분합니다. 과거 비용 계획은 근거 시트에 있으며 자동 합산하지 않습니다.');
V('운영비','C50','감가상각·이자·법인세는 영업잔액에서 제외합니다. 관련 현금 지급은 현금입력에 입력합니다.');

base('현금입력','수납·지급·투자와 자금 조달','원화 입력. 0은 초기 시나리오 값입니다. 실제 거래·자금 확정값이 아니며 발생 월에 바꿉니다.',42);timeline('현금입력');
const cashDefs={8:'월초 현금',9:'수납 시점·선수금 조정',10:'비용 지급시점 조정',11:'부가세 등 순현금 흐름',12:'이자·법인세 현금 지급',13:'일회성 비용·당월 지급',14:'시설·설비 등 자산 취득',15:'보증금 지급',16:'보증금 회수',17:'출자·증자 유입',18:'신규 차입',19:'차입 원금 상환',20:'배당·대표 인출',21:'환불·할인 매출 차감'};
for(const [rs,label] of Object.entries(cashDefs)){const r=+rs;row('현금입력',r,label,'원');for(const c of cols){if(r===8){if(c==='F')input('현금입력',`${c}${r}`,null,money);else link('현금입력',`${c}${r}`,`'월별손익'!${String.fromCharCode(c.charCodeAt(0)-1)}48`);}else input('현금입력',`${c}${r}`,0,money);}if(r===8||r>=12)valid('현금입력',r===8?'F8':`F${r}:Q${r}`);}
const cashNotes=[['수납 조정','부가세 제외 순수납액(입금−환불 지급) − 환불·할인 차감 후 매출. 미수는 음수, 이후 수금·선수금은 양수.'],['비용 지급 조정','손익에 반영한 직접비·수수료·운영비 − 실제 지급액. 미지급은 양수, 선납·과거 비용 지급은 음수.'],['세금 흐름','부가세 등 수취·환급은 양수, 납부·고객 반환은 음수. 세금 포함 비용을 입력했다면 같은 세금을 다시 넣지 않습니다.'],['환불·할인','21행에 당월 확정한 세금 제외 매출 차감을 양수로 입력. 기본은 당월 반환이며 미반환·이후 지급 차이는 9행에서 조정.'],['일회성 비용','당월 비용이면서 당월 지출인 항목만 입력. 시설 자산·보증금·출자금을 이 행에 넣지 않습니다.'],['자산·재원','출자·차입은 매출이 아닙니다. 시설·보증금과 준비기간 현금을 성격별로 한 번만 반영하고 내부 이체는 제거합니다.']];
cashNotes.forEach(([label,desc],i)=>{V('현금입력',`C${25+i*2}`,label);V('현금입력',`F${25+i*2}`,desc);sheets['현금입력'].getRange(`F${25+i*2}:Q${25+i*2}`).format.font={size:10,color:C.muted};});

base('상품계산','상품별 월 기여와 시간','현행과 참고 이력의 개별 계산. 참고 이력은 월별손익·인력 합계 제외. 빈칸은 미입력입니다.',8+(products.length-1)*12+11);timeline('상품계산');
products.forEach((p,i)=>{const r=cr[i],r0=pr[i];section('상품계산',r,`${String(i+1).padStart(2,'0')} ${p.brand} ${p.name}`);
 const defs={1:['세금 제외 매출','원'],2:['수수료·직접 현금원가','원'],3:['기여금액','원'],4:['대표 작업시간','시간'],5:['직원 작업시간','시간'],6:['대표 시간 반영 기여','원'],7:['금액 입력 미완료','개'],8:['시간 입력 미완료','개'],9:['건당 손익분기 대표시간','시간']};for(const [j,[l,u]]of Object.entries(defs))row('상품계산',r+(+j),l,u);
 for(const c of cols){const q=`'월별상품'!${c}${r0+1}`,price=`'월별상품'!${c}${r0+2}`,tax=`'월별상품'!${c}${r0+3}`,fee=`'월별상품'!${c}${r0+4}`,cash=`'월별상품'!${c}${r0+5}`,owner=`'월별상품'!${c}${r0+6}`,staff=`'월별상품'!${c}${r0+7}`,fx=p.currency==='KRW'?'1':`'인력과 LAB'!${c}${p.currency==='MNT'?8:9}`;
 const badQ=`OR(COUNT(${q})=0,${q}<0,MOD(${q},1)<>0)`;
 const badRev=`OR(COUNT(${price},${tax})<2,${price}<0,${tax}<0,${tax}>1,${fx}<=0)`;
 F('상품계산',`${c}${r+1}`,`=IF(${badQ},"",IF(${q}=0,0,IF(${badRev},"",${q}*${price}/(1+${tax})*${fx})))`);
 F('상품계산',`${c}${r+2}`,`=IF(${badQ},"",IF(${q}=0,0,IF(OR(COUNT(${c}${r+1})=0,COUNT(${fee},${cash})<2,${fee}<0,${fee}>1,${cash}<0),"",${c}${r+1}*${fee}+${q}*${cash}*${fx})))`);
 F('상품계산',`${c}${r+3}`,`=IF(COUNT(${c}${r+1}:${c}${r+2})=2,${c}${r+1}-${c}${r+2},"")`);
 for(const [j,t]of[[4,owner],[5,staff]])F('상품계산',`${c}${r+j}`,`=IF(${badQ},"",IF(${q}=0,0,IF(OR(COUNT(${t})=0,${t}<0),"",${q}*${t})))`);
 F('상품계산',`${c}${r+6}`,`=IF(OR(COUNT(${c}${r+3}:${c}${r+4},'인력과 LAB'!${c}10)<3,'인력과 LAB'!${c}10<0),"",${c}${r+3}-${c}${r+4}*'인력과 LAB'!${c}10)`);
 F('상품계산',`${c}${r+7}`,`=IF(COUNT(${c}${r+1}:${c}${r+2})=2,0,1)`);
 F('상품계산',`${c}${r+8}`,`=IF(COUNT(${c}${r+4}:${c}${r+5})=2,0,1)`);
 F('상품계산',`${c}${r+9}`,`=IF(OR(${q}<=0,COUNT(${c}${r+3},'인력과 LAB'!${c}10)<2,'인력과 LAB'!${c}10<=0),"",${c}${r+3}/${q}/'인력과 LAB'!${c}10)`);
 }
 [3,6].forEach(j=>{total('상품계산',r+j);negative('상품계산',`F${r+j}:Q${r+j}`);});sheets['상품계산'].getRange(`F${r+4}:Q${r+5}`).setNumberFormat(dec);sheets['상품계산'].getRange(`F${r+9}:Q${r+9}`).setNumberFormat(dec);
});

base('월별손익','월별 손익과 현금 연결','원화. 영업잔액은 감가상각·금융비용·법인세 전입니다. 빈칸은 필요한 입력이 아직 없다는 뜻입니다.',67);timeline('월별손익');
const brands=['LAB','SHIFT','PULSE','PATH','WORLD'];
const pnlDefs={13:'환불 후 매출 합계',14:'차감한 환불·할인',21:'환불 후 기여 합계',23:'무료 이용 현금원가',24:'공통 운영비·급여',25:'일회성 비용',26:'영업잔액',28:'대표 전체시간 가치',29:'대표 현금 급여 가산',30:'대표 시간 반영 잔액',34:'월초 현금',35:'영업잔액',36:'수납 시점·선수금 조정',37:'비용 지급시점 조정',38:'부가세 등 순현금 흐름',39:'이자·법인세 지급',40:'시설·설비 자산 취득',41:'보증금 지급',42:'보증금 회수',43:'출자 유입',44:'신규 차입',45:'차입 원금 상환',46:'배당·대표 인출',47:'순현금 증감',48:'월말 현금',49:'현금 연결 차이',52:'금액 미완료 상품',53:'미확인 고정비 항목',54:'대표 잔여 시간',55:'직원 잔여 시간',56:'강사 잔여 시간',57:'운영 가능 반 여유'};
brands.forEach((b,i)=>{row('월별손익',8+i,`${b} 매출`,'원');row('월별손익',16+i,`${b} 기여`,'원');});
for(const [r,l]of Object.entries(pnlDefs))row('월별손익',+r,l,+r>=54&&+r<=56?'시간':+r===57?'반':+r===52||+r===53?'개':'원');
section('월별손익',32,'현금');section('월별손익',51,'누락과 공급 능력');
for(const c of cols){
 brands.forEach((b,i)=>{const inds=activeIndices.filter(k=>products[k].brand===b);for(const [outrow,offset]of[[8+i,1],[16+i,3]])F('월별손익',`${c}${outrow}`,`=${nonblankSum(inds.map(k=>`'상품계산'!${c}${cr[k]+offset}`))}`);});
 link('월별손익',`${c}14`,`'현금입력'!${c}21`);
 F('월별손익',`${c}13`,`=IF(COUNT(${c}8:${c}12,${c}14)=6,SUM(${c}8:${c}12)-${c}14,"")`);
 F('월별손익',`${c}21`,`=IF(COUNT(${c}16:${c}20,${c}14)=6,SUM(${c}16:${c}20)-${c}14,"")`);
 link('월별손익',`${c}23`,`'인력과 LAB'!${c}40`);link('월별손익',`${c}24`,`'운영비'!${c}43`);link('월별손익',`${c}25`,`'현금입력'!${c}13`);
 F('월별손익',`${c}26`,`=IF(COUNT(${c}21,${c}23:${c}25)=4,${c}21-SUM(${c}23:${c}25),"")`);
 link('월별손익',`${c}28`,`'인력과 LAB'!${c}49`);link('월별손익',`${c}29`,`'운영비'!${c}27`);
 F('월별손익',`${c}30`,`=IF(COUNT(${c}26,${c}28:${c}29)=3,${c}26-${c}28+${c}29,"")`);
 link('월별손익',`${c}34`,`'현금입력'!${c}8`);link('월별손익',`${c}35`,`${c}26`);
 for(const [dest,src]of[[36,9],[37,10],[38,11],[39,12],[40,14],[41,15],[42,16],[43,17],[44,18],[45,19],[46,20]])link('월별손익',`${c}${dest}`,`'현금입력'!${c}${src}`);
 F('월별손익',`${c}47`,`=IF(COUNT(${c}35:${c}46)=12,SUM(${c}35:${c}38)-SUM(${c}39:${c}41)+SUM(${c}42:${c}44)-SUM(${c}45:${c}46),"")`);
 F('월별손익',`${c}48`,`=IF(COUNT(${c}34,${c}47)=2,${c}34+${c}47,"")`);
 F('월별손익',`${c}49`,`=IF(COUNT(${c}34:${c}48)=15,${c}48-${c}34-SUM(${c}35:${c}38)+SUM(${c}39:${c}41)-SUM(${c}42:${c}44)+SUM(${c}45:${c}46),"")`);
 F('월별손익',`${c}52`,`=SUM(${activeIndices.map(i=>`'상품계산'!${c}${cr[i]+7}`).join(',')})`);link('월별손익',`${c}53`,`'운영비'!${c}44`);
 for(const [r,src]of[[54,46],[55,48],[56,29],[57,30]])link('월별손익',`${c}${r}`,`'인력과 LAB'!${c}${src}`);
}
[13,21,26,30,47,48].forEach(r=>total('월별손익',r));[26,30,48,54,55,56,57].forEach(r=>negative('월별손익',`F${r}:Q${r}`));
V('월별손익','C60','대표 시간 반영 잔액 = 영업잔액 + 대표 현금 급여 − 대표 전체시간 가치. 대표 급여와 기회비용을 이중 차감하지 않습니다.');
V('월별손익','C61','브랜드 매출·기여는 환불 전입니다. 환불·할인은 합계에서 차감하며 공통비도 회사 전체에서만 반영합니다.');
V('월별손익','C62','SHIFT 매출·기여는 현행 개인화 3단위만 합산합니다. 참고 이력 8개는 개별 계산에 보존하며 확인된 기존 계약은 별도 기록합니다.');

const summaryRows={8:[13,'세금 제외 매출'],9:[21,'상품 기여 합계'],10:[24,'공통비·급여'],11:[23,'무료 이용 비용'],12:[26,'영업잔액'],13:[30,'대표 시간 반영 잔액'],14:[48,'월말 현금'],18:[54,'대표 잔여 시간'],19:[55,'직원 잔여 시간'],20:[56,'강사 잔여 시간'],21:[57,'운영 가능 반 여유'],24:[52,'원가·세금·환율 누락 상품'],25:[53,'미확인 운영비 항목']};
for(const[r,[src,label]]of Object.entries(summaryRows)){row('요약',+r,label,+r>=18&&+r<=20?'시간':+r===21?'반':+r>=24?'개':'원');for(const c of cols)link('요약',`${c}${r}`,`'월별손익'!${c}${src}`);}
row('요약',26,'무료 원가 미완료','개');for(const c of cols)F('요약',`${c}26`,`=IF(COUNT('인력과 LAB'!${c}40)=1,0,1)`);
[12,13,14].forEach(r=>{total('요약',r);sheets['요약'].getRange(`F${r}:Q${r}`).setNumberFormat(money);});[12,13,14,18,19,20,21].forEach(r=>negative('요약',`F${r}:Q${r}`));
section('요약',17,'일정 안에 제공 가능한가');section('요약',23,'입력 확인');
V('요약','C28','입력 순서');
const guide=[['1  상품·조건','상품목록과 판매조건에서 가격안·범위를 확인합니다. 월별상품에서 판매량, 판매가, 세금·수수료, 직접비, 대표·직원 시간을 입력합니다.'],['2  인력·고정비','인력과 LAB에서 환율·가용시간·반 정원을 입력합니다. 운영비의 모든 항목에 금액 또는 확인한 0을 입력합니다.'],['3  수납·투자','현금입력에서 첫 달 보유 현금과 수금·지급 시점, 설비·보증금, 출자·차입을 입력합니다.'],['4  판단','요약에서 음수인 현금·잔여시간을 확인합니다. 상품계산의 손익분기 대표시간은 공통비 차감 전 상한이므로 여유를 두고 견적을 잡습니다.']];
guide.forEach(([a,b],i)=>{V('요약',`C${30+i*3}`,a);V('요약',`F${30+i*3}`,b);});
V('요약','C44','읽는 기준');V('요약','F44','노란 바탕·파란 숫자 = 입력 / 검정 = 같은 시트 계산 / 초록 = 다른 시트 연결 / 붉은 바탕 = 음수 여력·잔액');
V('요약','C46','아직 없는 값');V('요약','F46','실제 판매량·청구액·계약·작업기록이 없어 결과를 비워둔 부분이 있습니다. 빈칸을 0원 또는 흑자로 해석하지 않습니다.');
V('요약','C48','시간과 수익');V('요약','F48','영업잔액과 대표 시간 반영 잔액을 함께 봅니다. 직원 월급은 운영비에서 한 번만 차감하며 시간은 공급 한도를 판단합니다.');
V('요약','C50','기간');V('요약','F50','월별 입력은 표시된 절대 월에 고정됩니다. 새 기간이 필요하면 기존 월을 덮어쓰지 않고 다음 월을 확장합니다.');
V('요약','C52','SHIFT 현행 범위');V('요약','F52','한 업무 개인화 서비스의 도입·운영부터 시작합니다. 반복 공급·고객 효과·수익성 검증 뒤 API·엔진 라이선스를 검토합니다.');
V('요약','C54','SHIFT 가격·시간');V('요약','F54','현행 3단위는 가격·수량·공수 미입력입니다. 참고 이력 8개의 가격을 새 상품에 전용하거나 합계에 넣지 않습니다.');

base('근거','근거·가정·계산 범위','자료 확인일 2026-10-07. SHIFT 현행 범위와 과거 가격안을 구분하며 실제 계약·청구는 미확정입니다.',100);
const source=sheets['근거'];source.getRange('C:C').format.columnWidth=24;source.getRange('D:D').format.columnWidth=42;source.getRange('E:E').format.columnWidth=21;source.getRange('F:F').format.columnWidth=110;
source.getRange('C6:F6').values=[['항목','자료·기준','자료 시점','반영과 남은 확인']];header('근거','C6:F6');
const sources=[
 ['가격','상품목록 각 행의 근거','2026-09~10','기존 제안가입니다. 실제 판매가·수요·세금 처리·플랫폼 요율은 미확정이며 월별 입력에서 바꿉니다.'],
 ['상품 범위','크몽 등록초안·각 브랜드 수익구조','2026-09~10','납품·수정·지원은 준비안의 범위입니다. 미정 조건과 추가요금은 판매조건 시트에서 확인합니다.'],
 ['대표 공수','BM 사업모델 V2 원가 예시','2026-10-06','자동화 S 5시간/2만원, 프로필 D 2시간/1만원, PATH 입학 25시간/10만MNT 등은 비교용 가정입니다. 대표가 수행하는 초기값으로 배치했습니다.'],
 ['대표 시간 가치','BM 사업모델 V2 비교 가정','2026-10-06','시간당 30,000원. 시장 단가·급여가 아닙니다. 대표 현금 급여는 경제성 계산 시 되돌려 더해 중복 차감을 피합니다.'],
 ['LAB','현행 오프라인 운영기준·LAB 수익구조','2026-10-02 / 과거안','월 550,000MNT는 과거안. 90분×주5회, 월 4.345주 환산. 실제 반 정원·시간표·준비·행정 시간·강사 용량은 입력해야 합니다.'],
 ['WORLD','BM 목록·싱크타운 생활경제와 상품 설계','2026-09~10','타운 월 7,900원, 기관 좌석 USD는 검증용 가정입니다. 유효 구독월·좌석월만 입력하며 기관 등급을 중복하지 않습니다.'],
 ['무료 이용','BM 사업모델 V2 / 이번 입력표','2026-10-06','무료 활성 인원과 실제 월 원가를 분리합니다. AI 시험 한도는 지출 추정값이 아니므로 비용에 자동 반영하지 않습니다.'],
 ['환율','사용자 입력','미확정','MNT·USD 1단위당 KRW를 월별로 입력합니다. 과거 환율이나 실시간 환율을 임의 적용하지 않았습니다.'],
 ['세금·수수료','사용자 입력','미확정','판매가/(1+가격 포함 세금률)로 매출을 계산하고 그 매출에 수수료율을 적용합니다. 세법 안내나 플랫폼 공식 요율이 아닙니다.'],
 ['고정비','회사 전체 권리등록·출시·제작비','2026-10-01','과거 계획은 아래 참고만 유지합니다. 새 청구·견적을 확인해 운영비에 입력하고 상품 직접비와 겹치는 도구·API를 제거합니다.'],
 ['현금 조정','이번 계산 방식','2026-10-06','매출·비용의 발생월과 수납·지급월을 조정합니다. 시설·보증금·출자·차입은 서로 구분합니다. 세금·이자·환불의 실제 흐름을 반영해야 합니다.'],
 ['결과의 범위','영업잔액·경제성·현금','입력 시나리오','감가상각·금융비용·법인세를 포함한 회계 순이익표가 아닙니다. 자산 상각·세무·차입 계약을 검토한 확정 재무제표를 대체하지 않습니다.'],
 ['생산 능력','대표 / 제작·서비스 직원 / LAB 강사','입력 시나리오','총시간 비교입니다. 기술별 인력, 주별 납기, 레벨별 반 편성은 실제 배정표로 추가 확인해야 합니다. 대표의 LAB 수업시간은 16행을 통해 대표 필요시간과 강사 공급에 한 번씩 연결합니다.'],
 ['초기 수량','미입력 계획','2026-10-07','현행 SHIFT 3단위의 수량·가격·공수는 공란입니다. 나머지 상품·무료인원·현금 조정의 기존 0 초기값은 보존하며 실제 실적이 아닙니다. 미확인 값은 0으로 바꾸지 않습니다.'],
 ['개정','통합 계산표 첫 전달본','2026-10-06','기존 14쪽 PDF와 수정용 Word를 보완합니다. 가격 확정·사업 개시·실제 수주를 의미하지 않습니다.']
];
const costs=JSON.parse(await fs.readFile(path.join(here,'costs.json'),'utf8'));
sources.forEach((v,i)=>{source.getRange(`C${8+i}:F${8+i}`).values=[v];source.getRange(`C${8+i}:F${8+i}`).format={rowHeight:63,wrapText:true,verticalAlignment:'top'};});
source.getRange('C23:F24').values=[['SHIFT 현행 범위','SHIFT BM 정본 #shift-bm','2026-10-06 확정','고객사 한 업무 개인화 서비스 도입·운영, 반복 공급·효과·수익성 검증, 이후 API·엔진 라이선스 검토. 초기 도입·정기 운영·추가 사용/개발은 가격·시간·판매량 미확정.'],['SHIFT 참고 이력','기존 등록초안·수익구조','2026-09~10 과거안','교육·자동화·프로젝트·워크숍 8개는 이력 비교 계산에 보존하고 현행 매출·기여·인력 합계에서 제외. 기존 계약이 확인되면 개별 조건으로 별도 기록.']];
source.getRange('C23:F24').format={rowHeight:76,wrapText:true,verticalAlignment:'top'};
V('근거','C26','과거 비용 계획 참고');
const historical=[['공통 월 운영 계획','1,017,355.58원/월','2026-10-01','AI·제작·업무 도구·앱/API·백업·검수 등의 과거 계획. 상품 직접비와 겹치는 항목을 제거해야 하므로 현재 운영비로 자동 적용하지 않습니다.'],['첫 12개월 산정분','46,180,196원','2026-10-01','권리·출시·공유 운영·양국 설립·회계 등의 부분 합계. 공사·임대·전 인력 급여를 포함한 현재 총자금이 아닙니다.'],['이전 시설 중간안','약 163,990,000원','이전 81평안','현재 102~104평 후보 공간의 공사·임대 계약과 다릅니다. 새 견적·지급일정을 현금입력에 반영해야 합니다.'],['필요 증빙','청구서·견적서·근무기록·계약','미확보','운영비는 실제 청구·계약, 직접비는 주문별 사용량, 시간은 준비·수정·지원까지 기록해 갱신합니다.']];
historical.forEach((v,i)=>{source.getRange(`C${28+i}:F${28+i}`).values=[v];source.getRange(`C${28+i}:F${28+i}`).format={rowHeight:65,wrapText:true,verticalAlignment:'top'};});
V('근거','C34','과거 반복비 상세 — 자동 합산하지 않음');
source.getRange('C36:F36').values=[['항목','기준·통화·수량','참고 단가·금액','중복 방지와 필요한 증빙']];header('근거','C36:F36');
const costRow=(item,r)=>{const p=item.plan;source.getRange(`C${r}:F${r}`).values=[[item.name,`${item.status}\n${p.currency} / ${p.unit}${p.quantity?` / ${p.quantity}개`:''}`,p.unit_price??p.amount??null,`${p.assumption??p.scope??''}\n${item.double_count_rule??item.expense_cash_rule??''}\n확인: ${item.required_evidence??'실제 견적·계약과 지급 시점'}`]];source.getRange(`C${r}:F${r}`).format={rowHeight:98,wrapText:true,verticalAlignment:'top'};source.getRange(`E${r}`).setNumberFormat('#,##0.##');};
costs.recurring.forEach((item,i)=>costRow(item,37+i));
V('근거','C59','과거 초기비·미견적 — 비용·자산·보증금 구분');
source.getRange('C61:F61').values=[['항목','기준·통화','참고 금액','처리와 필요한 증빙']];header('근거','C61:F61');
costs.one_time.forEach((item,i)=>costRow(item,62+i));
V('근거','C79','상세 원문');V('근거','D79','회사전체_권리등록_출시_제작비_산정근거_20261001.json');
V('근거','D80','학원_개원_예산과_준비기간_20261001.md / 법인설립_비용_20261001.md');
source.freezePanes.freezeRows(6);

// Standalone input perturbations check the same model that is exported.
const checks=[];const saved=[];
function set(s,a,v){saved.push([s,a,sheets[s].getRange(a).values[0][0]]);V(s,a,v);}
function value(s,a){return sheets[s].getRange(a).values[0][0];}
function expect(name,s,a,want){const got=value(s,a);const ok=typeof want==='number'?typeof got==='number'&&Math.abs(got-want)<1e-7:got===want||want===''&&got===null;checks.push({name,sheet:s,cell:a,expected:want,actual:got,passed:ok});if(!ok){console.log(JSON.stringify({pnl:sheets['월별손익'].getRange('F16:F30').values,opex:sheets['운영비'].getRange('F27:F44').values,cash:sheets['현금입력'].getRange('F8:F20').values}));throw Error(`${name}: ${s}!${a} got ${JSON.stringify(got)} wanted ${want}`);}}
const si=products.findIndex(p=>p.id==='SHIFT_PERSONALIZATION_SETUP'), sr=pr[si], sc=cr[si];
for(const i of currentShiftIndices){for(const c of ['F','L','Q']){expect(`${products[i].id} ${c} 수량 미입력`,'월별상품',`${c}${pr[i]+1}`,'');expect(`${products[i].id} ${c} 가격 미입력`,'월별상품',`${c}${pr[i]+2}`,'');expect(`${products[i].id} ${c} 공수 미입력`,'월별상품',`${c}${pr[i]+6}`,'');expect(`${products[i].id} ${c} 매출 미입력`,'상품계산',`${c}${cr[i]+1}`,'');}}
expect('현행 SHIFT 합계 미입력','월별손익','F9','');
expect('전체 초기 매출 미입력 전파','월별손익','F13','');
expect('미입력 현행 금액 3개 표시','요약','F24',3);
expect('미확인 고정비는 손익을 비움','월별손익','F26','');
for(const i of currentShiftIndices)for(const c of cols)set('월별상품',`${c}${pr[i]+1}`,0);
expect('수량 0 명시 후 전체 매출 0','월별손익','F13',0);
const legacyIndex=products.findIndex(p=>p.id==='SHIFT_AUTO_S'),legacyInput=pr[legacyIndex],legacyCalc=cr[legacyIndex];
for(const [j,v]of[[1,1],[3,0],[4,0],[7,0]])set('월별상품',`F${legacyInput+j}`,v);
expect('참고 자동화 기존 계산 보존','상품계산',`F${legacyCalc+3}`,270000);
expect('참고 이력은 현행 SHIFT 합계 제외','월별손익','F9',0);
set('월별상품',`F${legacyInput+1}`,0);
set('월별상품',`F${sr+1}`,1);expect('가격 미입력 전파','상품계산',`F${sc+1}`,'');
set('월별상품',`F${sr+2}`,290000);expect('세금 미입력 전파','상품계산',`F${sc+1}`,'');
set('월별상품',`F${sr+3}`,0);set('월별상품',`F${sr+4}`,0);set('월별상품',`F${sr+5}`,20000);set('월별상품',`F${sr+6}`,5);set('월별상품',`F${sr+7}`,0);
expect('도입비 가상입력 매출','상품계산',`F${sc+1}`,290000);expect('직접비 차감 기여','상품계산',`F${sc+3}`,270000);expect('대표 5시간 경제성','상품계산',`F${sc+6}`,120000);expect('시간 상한','상품계산',`F${sc+9}`,9);
for(let i=8;i<=21;i++)set('운영비',`F${i}`,0);
set('현금입력','F8',1000000);for(const r of[12,14,24,37,38])set('인력과 LAB',`F${r}`,0);
set('인력과 LAB','F11',4);set('인력과 LAB','F13',0);set('인력과 LAB','F15',0);set('인력과 LAB','F23',0);
expect('대표 시간 부족','인력과 LAB','F46',-1);expect('영업잔액','월별손익','F26',270000);expect('대표 시간 잔액','월별손익','F30',120000);expect('현금 연결','월별손익','F48',1270000);
set('운영비','F8',100000);expect('대표 급여 한 번 차감','월별손익','F26',170000);expect('기회비용 중복 제거','월별손익','F30',120000);
set('운영비','F10',3000000);expect('직원 월급 한 번 차감','월별손익','F26',-2830000);set('운영비','F10',0);
set('현금입력','F9',-290000);expect('미수와 매출 구분','월별손익','F48',880000);
set('현금입력','F15',200000);set('현금입력','F17',500000);expect('보증금·출자 현금만 반영','월별손익','F48',1180000);expect('보증금 비용 미산입','월별손익','F26',170000);expect('현금 조정 잔차','월별손익','F49',0);
set('인력과 LAB','F35',1000);set('인력과 LAB','F36',100);expect('무료 이용 비용','인력과 LAB','F40',100000);expect('무료 비용 반영','월별손익','F26',70000);
const lr=pr[labIndex];set('월별상품',`F${lr+1}`,11);set('월별상품',`F${lr+3}`,0);set('월별상품',`F${lr+4}`,0);set('월별상품',`F${lr+5}`,0);set('월별상품',`F${lr+6}`,0);set('월별상품',`F${lr+7}`,0);
expect('환율 누락 표시','상품계산',`F${cr[labIndex]+1}`,'');set('인력과 LAB','F8',0.4);set('인력과 LAB','F19',10);set('인력과 LAB','F22',0);set('인력과 LAB','F15',60);set('인력과 LAB','F23',1);
expect('MNT 원화 환산','상품계산',`F${cr[labIndex]+1}`,2420000);expect('LAB 정원 초과 반 올림','인력과 LAB','F27',2);expect('LAB 강사 시간','인력과 LAB','F28',65.175);expect('LAB 강사 부족','인력과 LAB','F29',-5.175);expect('LAB 슬롯 부족','인력과 LAB','F30',-1);
set('인력과 LAB','F16',32.5875);expect('대표 수업을 필요시간에 포함','인력과 LAB','F45',37.5875);expect('대표 수업의 시간가치','인력과 LAB','F49',1127625);expect('대표 수업을 강사 공급에 포함','인력과 LAB','F29',27.4125);
set('인력과 LAB','F35',null);expect('무료 인원 공란 보존','인력과 LAB','F40','');expect('무료 비용 미확인 손익 전파','월별손익','F26','');set('인력과 LAB','F35',1000);
set('인력과 LAB','F24',null);expect('행정시간 공란 보존','인력과 LAB','F28','');set('인력과 LAB','F24',0);
for(let i=8;i<=21;i++)set('운영비',`G${i}`,0);
const closing=value('월별손익','F48');expect('전월말 다음월초 연결','현금입력','G8',closing);
set('현금입력','G9',290000);expect('다음 달 미수 회수','월별손익','G48',closing+290000);expect('미수 회수는 매출 아님','월별손익','G13',0);
set('현금입력','G21',290000);expect('이전 매출의 당월 환불 차감','월별손익','G13',-290000);expect('환불 손익 반영','월별손익','G26',-290000);expect('환불 현금 반영','월별손익','G48',closing);
set('현금입력','G11',10000);expect('부가세 현금만 별도 반영','월별손익','G48',closing+10000);
const firstRevenue=value('월별손익','F13');set('월별상품',`I${sr+1}`,2);set('월별상품',`I${sr+2}`,290000);set('월별상품',`I${sr+3}`,0);set('월별상품',`I${sr+4}`,0);set('월별상품',`I${sr+7}`,0);
expect('후기 월 입력','상품계산',`I${sc+1}`,580000);expect('과거 월 불변','월별손익','F13',firstRevenue);
set('월별상품',`I${sr+1}`,-1);expect('음수 수량 거부','상품계산',`I${sc+1}`,'');
const wi=products.findIndex(p=>p.id==='WORLD_SEAT_A'),wr=pr[wi],wc=cr[wi];for(const[j,v]of[[1,2],[3,0.1],[4,0.15],[5,1],[6,0],[7,0]])set('월별상품',`Q${wr+j}`,v);set('인력과 LAB','Q9',1400);expect('마지막 달 USD·세금·수수료','상품계산',`Q${wc+3}`,2*5/1.1*1400*0.85-2*1400);
while(saved.length){const[s,a,v]=saved.pop();V(s,a,v);}
expect('복원 매출 미입력','월별손익','F13','');expect('복원 현금 미확정','월별손익','F48','');
const prior=JSON.parse(await fs.readFile(path.join(here,'../통합계산_20261006/products.json'),'utf8'));
for(const p of prior.products.filter(p=>p.brand!=='SHIFT')){const next=products.find(n=>n.id===p.id);if(JSON.stringify(next)!==JSON.stringify(p))throw Error(`${p.id}: unrelated brand source changed`);checks.push({name:`${p.id} 原상품 값 보존`,passed:true});}
for(const p of prior.products.filter(p=>p.brand==='SHIFT')){const next=products.find(n=>n.id===p.id);for(const field of ['id','brand','unit','currency','price_reference','assumed_hours','assumed_direct_cash_native','teaching_hours_reference','price_reference_min','price_reference_max','hours_reference_min','hours_reference_max'])if(next[field]!==p[field])throw Error(`${p.id}.${field}: historical value changed`);checks.push({name:`${p.id} 과거 가격·시간·단위 보존`,passed:true});}
const finalIndex=products.length-1;expect('마지막 상품명 주석과 분리','상품목록',`C${7+finalIndex}`,products[finalIndex].id);expect('마지막 입력블록 수량','월별상품',`F${pr[finalIndex]+1}`,Object.hasOwn(products[finalIndex],'initial_quantity')?products[finalIndex].initial_quantity:0);
wb.recalculate();
await fs.writeFile(path.join(qa,'tests.json'),JSON.stringify(checks,null,2));
console.log(`Verified ${checks.length} model assertions`);
const inspected=await wb.inspect({kind:'table',range:'요약!C6:H25',include:'values,formulas',tableMaxRows:20,tableMaxCols:6,maxChars:4500});await fs.writeFile(path.join(qa,'summary-inspect.ndjson'),inspected.ndjson);
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:300},summary:'Final formula error scan'});await fs.writeFile(path.join(qa,'errors.ndjson'),errors.ndjson);console.log(errors.ndjson);
const finalPath=path.join(out,'02_BM_통합계산_20261007.xlsx');const xlsx=await SpreadsheetFile.exportXlsx(wb);await xlsx.save(finalPath);console.log(`Saved ${finalPath}`);
const views={'요약':'C1:K26','상품목록':'C1:M11','판매조건':'C14:E29','월별상품':'C17:K48','인력과 LAB':'C1:K30','운영비':'C1:K22','현금입력':'C1:K21','월별손익':'C1:K30','상품계산':'C18:K54','근거':'C21:F26'};
for(const[s,range]of Object.entries(views)){const blob=await wb.render({sheetName:s,range,scale:1,format:'png'});await fs.writeFile(path.join(qa,`${s}.png`),new Uint8Array(await blob.arrayBuffer()));console.log(`Rendered ${s}`);}
const extraViews={'상품목록-이력':{sheet:'상품목록',range:'C10:M19'},'상품목록-마지막':{sheet:'상품목록',range:`C${products.length+1}:M${productNotesRow+3}`},'월별상품-마지막':{sheet:'월별상품',range:`C${pr.at(-1)}:K${inputNotesRow+2}`},'요약-안내':{sheet:'요약',range:'C44:Q56'}};
for(const[label,{sheet,range}]of Object.entries(extraViews)){const blob=await wb.render({sheetName:sheet,range,scale:1,format:'png'});await fs.writeFile(path.join(qa,`${label}.png`),new Uint8Array(await blob.arrayBuffer()));}
const productRowsById=Object.fromEntries(products.map((p,i)=>[p.id,{catalog:7+i,terms:8+i*8,input:pr[i],calculation:cr[i],scope:p.calculation_scope||'current'}]));
await fs.writeFile(path.join(qa,'manifest.json'),JSON.stringify({output:finalPath,products:products.length,currentShift:currentShiftIndices.map(i=>products[i].id),legacyShift:products.filter(p=>p.calculation_scope==='legacy_reference').map(p=>p.id),sheets:names,tests:checks.length,sourceCostFile:!!costs,monthColumns:cols,productRowsById,productInputRows:pr,productCalcRows:cr,productNotesRow,inputNotesRow,font},null,2));
console.log(`Build completed; exitCode=${process.exitCode??0}`);
