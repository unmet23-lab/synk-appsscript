import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const old=JSON.parse(await fs.readFile(path.join(here,'../통합계산_20261006/products.json'),'utf8'));
const legacyIds=['SHIFT_EDU_60','SHIFT_EDU_120','SHIFT_EDU_3X90','SHIFT_AUTO_S','SHIFT_AUTO_D','SHIFT_AUTO_P','SHIFT_PROJECT','SHIFT_WORKSHOP'];
const base={brand:'SHIFT',currency:'KRW',price_reference:null,assumed_hours:null,assumed_direct_cash_native:null,initial_quantity:null,calculation_scope:'current',price_status:'현행 수익 구조 · 가격·제공량·판매 개시 미확정',assumption_label:'가격·수량·대표/직원 시간·직접비 미입력. 빈칸은 0매출·무료·0시간이 아님.',sourceLabel:'SHIFT BM 정본 · 2026-10-06 확정 / 2026-10-07 계산표 반영',sourcePaths:['docs/마케팅/SHIFT.md#shift-bm'],turnaround:'고객사 업무·자료·인수 기준에 따라 협의. 기간 미확정',revision_support:'지원 시간·수정 범위·자료 갱신 담당·오류 대응을 계약 전 합의',acceptance:'대상 업무·사용자·자료 접근 범위·완료 결과·검수/인수 기준·실제 공급비용 확인 필요'};
const current=[
 {...base,id:'SHIFT_PERSONALIZATION_SETUP',name:'개인화 서비스 초기 도입',unit:'고객사 한 업무·도입 1건',deliverables:'대상 업무·사용자·완료 결과 정의, 자료 정리, 전문 모듈 설정·시스템 연결, 제한된 사용자 흐름과 검수·인수',exclusions:'추가 업무·전문 모듈 신규 개발·상시 대응·범용 API/엔진 라이선스 판매는 포함 확정 아님'},
 {...base,id:'SHIFT_PERSONALIZATION_OPERATIONS',name:'개인화 서비스 정기 운영',unit:'고객사 한 업무·운영 1기간',deliverables:'공통 기능 이용, 운영·품질 점검, 합의한 자료 갱신과 담당자 지원',exclusions:'포함 사용량·과금 주기·최소 계약 기간·대응 수준·추가 개발 범위 미확정'},
 {...base,id:'SHIFT_PERSONALIZATION_ADDITIONAL',name:'개인화 서비스 추가 사용·개발',unit:'합의한 추가 범위 1건',deliverables:'기본 계약을 넘는 사용량·새 연결·추가 업무 또는 개발 범위를 따로 합의하여 공급',exclusions:'기본 도입·정기 운영과 중복 계산하지 않음. API/엔진 라이선스 상품은 반복 공급·효과·수익성 검증 뒤 검토'}
];
const products=old.products.map(p=>legacyIds.includes(p.id)?{...p,name:`참고 이력 · ${p.name}`,calculation_scope:'legacy_reference',price_status:`참고 이력 · 현행 신규 영업 범위에서 제외. ${p.price_status}`,assumption_label:`참고 이력 · 현행 SHIFT 합계 제외. ${p.assumption_label}`,deliverables:`과거 준비 범위: ${p.deliverables}`,acceptance:`과거안 참고. 현재 공급·판매 약속이 아님. 확인된 기존 계약은 개별 조건에 따라 별도로 기록. ${p.acceptance}`}:{...p});
products.splice(1,0,...current);
const data={...old,as_of:'2026-10-07',metadata:{...old.metadata,purpose:'현행 사업과 과거 제안가를 구분한 통합 BM 입력·계산. 실제 판매·수요·계약·현금 지출 미확정.',shift_scope:'현재 고객사 한 업무 개인화 서비스 도입·운영부터 반복 공급·효과·수익성 검증 뒤 API/엔진 라이선스로 확장. 참고 이력 8개는 현행 합계에 미포함.',quantity_policy:'현행 SHIFT 3단위 initial_quantity null은 미입력. 명시적 0을 입력한 때만 발생하지 않음으로 계산.'},products};
await fs.writeFile(path.join(here,'products.json'),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({products:products.length,currentShift:current.map(p=>p.id),legacyShift:legacyIds}));
