'use strict';
// Preserve the existing meeting design and background media; update its entry route.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {filingTitle,purpose}=require('./content.cjs');
const root='C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본';
const packet=path.join(root,'현재_미팅본_20260912');
const out=path.join(root,'등록우선전략_20260912');
const entry=path.join(packet,'00_여기서시작.html');
let html=fs.readFileSync(entry,'utf8');
if(!html.includes('/* registration reading */'))html=html.replace('</style>','/* registration reading */\n.hero p,.action p,.card p{word-break:keep-all;text-wrap:pretty}\n</style>');
html=html.replace('말은 그대로.<br>판단은 이유와 함께.','실제 기술 하나를.<br>등록특허로.');
html=html.replace('SYNK Atlas의 중심 두뇌인 <b>SYNK Core</b>가 학습 발화의 근거 자격을 나누고, 필요한 확인을 고른 뒤, 새 사실에 맞춰 영향을 받은 기록만 다시 판단합니다.','SYNK Atlas의 중심 두뇌인 <b>SYNK Core</b>의 실제 처리에서 등록할 기술 한 가지를 검토합니다. 목표는 우리 기술의 등록특허 1건으로 기업의 신뢰를 설명하는 것입니다.');
html=html.replace('요약 → 원리 → 직접 작동 → 질문 대응','등록 전략 → 선택 정정 실연 → 청구항·선행 대조');
if(!html.includes('data-registration-strategy'))html=html.replace('<section class="cards">',`<section class="action" data-registration-strategy><div><h2>가장 먼저 · 등록특허 1건 전략</h2><p>16쪽에 주안·예비안, 실제 입력과 결과, 청구항 초안, 선행 쟁점, 5분 시연, 등록 절차와 마케팅 문구를 정리했습니다. 아래 기존 자료는 전체 원리 참고본입니다.</p></div><div class="buttons"><a class="button primary" href="05_등록우선전략.html" target="_blank">새 전략 열기</a><a class="button" href="05_등록우선전략.pdf" target="_blank">인쇄 PDF</a></div></section><section class="cards">`);
html=html.replace('<h3>핵심 답변</h3>','<h3>기존 핵심 답변 · 참고</h3>').replace('가장 많이 받을 질문 여섯 개와 짧은 답변, 발명의 명칭 1안.','원리 질문 여섯 개의 짧은 답변. 현재 출원 명칭·범위·전략은 새 16쪽 자료를 따릅니다.');
html=html.replace('<h3>발표 요약</h3>','<h3>전체 원리 발표 · 참고</h3>').replace('문제, 판단 단위, 관측, 재판정, 선행과의 차이를 10장으로 설명.','전체 처리 관계를 10장으로 설명합니다. 최종 청구 범위를 고정하는 자료는 아닙니다.');
html=html.replace('7분 대본 보기','등록 미팅 대본').replace('Core 시험 86/86','새 전략 사례 4/4').replace('사건 전환 1,280개 대조','저장 판본 22개 재현').replace('영상 음성 33/33','출원·등록은 미완료');
fs.writeFileSync(entry,html);
const guide=`# SYNK · 등록특허 1건을 위한 미팅 가이드

2026-09-12 · 현재 목적은 **실제 사업 기술과 연결된 등록특허 1건의 마케팅 신뢰**입니다. 넓은 권리 범위는 후순위입니다.

먼저 [새 전략서](05_등록우선전략.html)를 엽니다. 16쪽 PDF는 인쇄용입니다. 기존 영상·10쪽 발표·31쪽 상세안내는 전체 작동 원리의 참고 자료이고 현재 출원 범위는 새 전략이 우선합니다.

## 첫 문장

> 우리 SYNK Core로 이 근거 판단 시제품을 만들었습니다. 넓은 독점보다 우리 실제 기술의 등록 한 건이 우선입니다. 뒤늦게 확인된 도움 때문에 같은 음성의 특정 수행 기여만 정정하고, 여전히 쓸 수 있는 자료는 유지하는 처리부터 검토해 주세요.

현재 발명의 명칭 초안: **${filingTitle}**. 최종 명칭·독립항·한정은 선행 대조 뒤 변리사와 정합니다.

## 5분 실연

1. **0:00–0:40**: 위 목적을 말합니다. 전략 1쪽을 보여 줍니다.
2. **0:40–1:30**: 이 폴더의 **06_작업실_실행.cmd** → 작업실 → 예제로 보기 → 늦은 도움 정정 예제. 반영된 세 칸의 서로 다른 쓰임을 설명합니다.
3. **1:30–2:30**: **발화 전 도움 기록을 뒤늦게 추가**. 원음·전사는 유지되고 조사 기여 하나만 철회되는 것을 가리킵니다. 다른 능력 유지는 해당 독립 조건이 충족된 예입니다.
4. **2:30–3:40**: **근거가 바뀐 기록 → 저장 기록 재현 확인**. 원인 사건·전후 판본·철회/유지를 확인합니다.
5. **3:40–5:00**: 전략 6~9쪽. 도움 시점이 수행 전이면 제외, 수행 중이면 보류, 수행 뒤면 유지되는 실행 결과와 선행 쟁점을 봅니다.

이는 통제된 예제입니다. 실제 학생 성과로 설명하지 않습니다. 새 음성 전사는 이 미팅의 필수 순서가 아닙니다. 시연이 멈추면 새 전략서의 결과표와 [실행 증거 안내](../등록우선전략_20260912/읽어주세요.md)를 보여 줍니다.

## 변리사에게 받을 결과

- Core 선택 정정 중심 R1과 관측·새 수행 구별 연결 R2 중 추천 독립항.
- 가장 가까운 문헌·해당 단락·청구항, 남는 차이와 결합 반론 대응표.
- 처음 명세서에 넣을 입력 계약·예외·도면·실시예·보정용 한정.
- Core가 약할 때 Loom 의상 보존 표정 합성의 비교 결과.
- 지원 범위, 출원인 요건, 조사·출원·중간사건·등록료·연차료 및 심사 일정.

현재 등록을 보장하거나 수치 확률을 제시하지 않습니다. 마케팅 목적에도 특허 요건은 같습니다. 등록 후 확정된 기술·번호·권리자·실제 제품 적용 범위로 설명합니다.

## 현재 구현의 중요한 한계

지원된 문장과 유효 능력 코드로 로컬 합성 사례를 검증했습니다. 미지원 skill 코드는 현재 무관한 도움처럼 처리될 수 있어 입력 처리 보강이 남아 있습니다. 운영 학생 DB 통합·모델 언러닝·외부 시각 진위 인증은 이번 시제품의 완료 범위가 아닙니다.
`;
fs.writeFileSync(path.join(packet,'00_미팅진행가이드.md'),guide);
fs.writeFileSync(path.join(root,'00_현재본_여기부터.md'),`# 현재 특허 미팅본 · 등록 우선 전략 · 2026-09-12\n\n[현재 미팅 시작 화면](현재_미팅본_20260912/00_여기서시작.html)에서 **새 전략 열기**를 누릅니다.\n\n- 목표: ${purpose}\n- 주안: Core의 지연 도움에 따른 용도·능력별 기여 선택 정정\n- 예비안: Loom의 의상 보존형 표정 집합 합성\n- 출원 명칭 초안: ${filingTitle}\n- 전체 제품: SYNK Atlas / 중심 두뇌: SYNK Core / 표현 엔진: SYNK Loom\n\n현재 전략은 16쪽 자료가 우선합니다. 기존 원리 영상·10쪽 발표·31쪽 설명은 배경 참고입니다. 출원·심사·등록은 미완료이며 최종 선행 대조가 남아 있습니다.\n`);
const readme=`# 등록 전략 자료를 읽는 순서

1. **SYNK_등록특허_1건을_위한_전략.html** 또는 PDF: 16쪽 최종 전략. 화면판은 목차와 실행 사례 선택이 됩니다.
2. **A_core.md**: 독립항 기술 초안, 종속/대안 한정, 계약과 실제 코드 위치.
3. **B_candidates.md**: Core와 실제 다른 후보의 비교.
4. **evidence.json**: 실제 로컬 Store/Core에서 실행한 합성 입력 4건의 전체 근거. 원음과 사건은 합성이고 실제 학생·마이크·API 전송이 없습니다.
5. **GATE.md**: A/B와 최종 원고를 분리해 검토한 사실·표현 확인 기록.

## 이 PC에서 재현

    node C:/Users/q1212/Documents/SYNK-appsscript/tools/patent-studio/registration-20260912/reproduce.cjs

새 OS 임시 SQLite를 만들며 제품 DB를 열지 않습니다. 기존 로컬 합성 WAV·매니페스트·Core/Store 소스·현재 Node 런타임이 필요합니다. 동봉 reproduce.cjs는 원본 스크립트 사본입니다. **이 폴더의 사본만 다른 PC로 옮겨 독립 실행할 수 있는 패키지는 아닙니다.** 재현 스크립트는 위 저장소 위치의 파일로 실행합니다.

자료만 읽거나 PDF·HTML을 보는 데는 서버가 필요 없습니다. 공식 출처 링크만 인터넷을 사용합니다. HTML의 작업실 링크는 같은 PC의 로컬 서버를 가리킵니다.

## 상태

4개 시나리오 통과, 22개 저장 판본 재현, 전체/재사용 의미 출력 4개 일치, 원음 4개 유지. 시간·도움 범위·사람 확인 조건은 통제 주입입니다. 선행기술 우위·학습 효과·등록 요건 통과의 증거로 확대하지 않습니다. 미지원 능력 코드 입력 처리 약점은 미수정 상태입니다.

16쪽 PDF의 렌더·서체·잘림 및 화면판 데스크톱/390px 모바일·목차·사례선택을 확인했습니다. 검수/에 기록이 있습니다. 기존 승인 브랜드 자산의 원본 지문을 대조해 사용했습니다.
`;
fs.writeFileSync(path.join(out,'읽어주세요.md'),readme);
fs.writeFileSync(path.join(__dirname,'README.md'),readme);
const digest=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const list=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(e.name==='검수'?[]:list(path.join(dir,e.name))):e.name==='파일지문.json'?[]:[path.join(dir,e.name)]);
const prior=JSON.parse(fs.readFileSync(path.join(packet,'파일지문.json'),'utf8'));
prior.generatedAt=new Date().toISOString();prior.purpose=purpose;prior.primary='05_등록우선전략.html';prior.architecture.filingTitleDraft=filingTitle;prior.architecture.patentCandidate='Core 지연 도움에 따른 용도·능력별 기여 선택 정정';prior.alternative='Loom 의상 보존형 표정 집합 합성';prior.referencePolicy='기존 1쪽·10쪽·31쪽·영상은 전체 원리 참고; 현재 청구 범위 전략은 16쪽 등록 전략을 우선';prior.files=list(packet).map(f=>({path:path.relative(packet,f).replace(/\\/g,'/'),bytes:fs.statSync(f).size,sha256:digest(f)}));
fs.writeFileSync(path.join(packet,'파일지문.json'),JSON.stringify(prior,null,2));
const localManifest=JSON.parse(fs.readFileSync(path.join(out,'파일지문.json'),'utf8'));localManifest.files=list(out).map(f=>({path:path.relative(out,f).replace(/\\/g,'/'),bytes:fs.statSync(f).size,sha256:digest(f)}));localManifest.integrationSource=digest(__filename);fs.writeFileSync(path.join(out,'파일지문.json'),JSON.stringify(localManifest,null,2));
console.log(JSON.stringify({updated:entry,files:prior.files.length,strategyFiles:localManifest.files.length}));
