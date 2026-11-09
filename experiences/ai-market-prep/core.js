(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MarketCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const categories = ['content', 'education', 'automation'];
  const modes = ['commission', 'learn', 'digital'];
  const trim = value => String(value ?? '').trim();
  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function normalizeRequest(input) {
    return {
      category: trim(input.category), mode: trim(input.mode),
      goal: trim(input.goal), deliverable: trim(input.deliverable),
      currentMethod: trim(input.currentMethod), constraints: trim(input.constraints),
      budgetMax: input.budgetMax === '' || input.budgetMax == null ? null : Number(input.budgetMax),
      deadline: trim(input.deadline) || null,
      reference: trim(input.reference),
      shareWithCandidates: input.shareWithCandidates === true || input.shareWithCandidates === 'on',
      publishCase: input.publishCase === true || input.publishCase === 'on',
      sourceCase: trim(input.sourceCase)
    };
  }
  function httpsUrl(value) {
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; }
    catch { return false; }
  }
  function validateRequest(input, asOf = today()) {
    const value = normalizeRequest(input);
    const errors = {};
    if (!categories.includes(value.category)) errors.category = '분야를 골라 주세요.';
    if (!modes.includes(value.mode)) errors.mode = '원하는 도움을 골라 주세요.';
    if (value.goal.length < 10 || value.goal.length > 1000) errors.goal = '해결할 일을 10~1,000자로 적어 주세요.';
    if (value.deliverable.length < 5 || value.deliverable.length > 500) errors.deliverable = '받고 싶은 결과를 5~500자로 적어 주세요.';
    if (value.budgetMax !== null && (!Number.isSafeInteger(value.budgetMax) || value.budgetMax < 1 || value.budgetMax > 1000000000)) errors.budgetMax = '예산은 1~10억 원의 정수로 쓰거나 비워 주세요.';
    if (value.deadline && (!validDate(value.deadline) || value.deadline < asOf)) errors.deadline = '오늘 이후의 올바른 날짜를 고르거나 비워 주세요.';
    for (const key of ['currentMethod', 'constraints']) if (value[key].length > 1000) errors[key] = '1,000자 안으로 적어 주세요.';
    if (value.reference && !httpsUrl(value.reference)) errors.reference = 'https://로 시작하는 참고 링크를 적어 주세요.';
    return {value, errors, valid: Object.keys(errors).length === 0};
  }
  function matchRequest(input, sellers, asOf = today()) {
    const checked = validateRequest(input, asOf);
    if (!checked.valid) return {matches: [], excluded: [], errors: checked.errors};
    const r = checked.value, matches = [], excluded = [];
    const availableDays = r.deadline ? (Date.parse(r.deadline + 'T00:00:00Z') - Date.parse(asOf + 'T00:00:00Z')) / 86400000 : null;
    for (const seller of sellers) {
      const reasons = [], questions = [], rejection = [];
      if (!seller.active || !seller.reviewed) rejection.push('참여·운영 검토 전');
      if (seller.category !== r.category) rejection.push('분야 불일치');
      if (!seller.modes.includes(r.mode)) rejection.push('제공 방식 불일치');
      if (rejection.length) { excluded.push({id:seller.id, reasons:rejection}); continue; }
      const terms = seller.terms[r.mode];
      if (!terms) { excluded.push({id:seller.id,reasons:['제공 조건 미등록']}); continue; }
      if (r.budgetMax !== null && terms.from > r.budgetMax) rejection.push('예산 상한 초과');
      if (availableDays !== null && terms.days > availableDays) rejection.push('요청 기한보다 긴 최소 준비 기간');
      if (rejection.length) { excluded.push({id:seller.id,reasons:rejection}); continue; }
      reasons.push('요청 분야와 제공 방식이 맞습니다.');
      if (r.budgetMax === null) questions.push('작업 범위를 정한 뒤 예산을 확인해야 합니다.');
      else reasons.push('등록된 시작 금액이 예산 상한 안에 있습니다.');
      if (availableDays === null) questions.push('착수일과 납품일을 협의해야 합니다.');
      else reasons.push('등록된 최소 준비 기간이 요청 날짜 안에 들어갑니다.');
      questions.push('실제 가용 일정·총액·사용권은 제안서로 확인합니다.');
      if (r.constraints) questions.push('적어 주신 보안·사용 조건의 수용 여부는 운영자가 확인합니다.');
      matches.push({seller, reasons, questions, terms});
    }
    return {matches:matches.slice(0,3), excluded, errors:{}};
  }
  function validateSeller(input) {
    const v = {...input}, errors = {};
    for (const key of ['displayName','offer','workUrl','role','priceFrom','availability']) v[key] = trim(v[key]);
    if (v.displayName.length < 2 || v.displayName.length > 60) errors.displayName = '활동 이름을 2~60자로 적어 주세요.';
    if (!categories.includes(v.category)) errors.category = '대표 분야를 골라 주세요.';
    v.modes = Array.isArray(v.modes) ? v.modes.filter(x => modes.includes(x)) : [];
    if (!v.modes.length) errors.modes = '제공 방식을 하나 이상 골라 주세요.';
    if (v.offer.length < 10 || v.offer.length > 1000) errors.offer = '제공 범위를 10~1,000자로 적어 주세요.';
    if (!httpsUrl(v.workUrl)) errors.workUrl = '직접 작업한 사례의 https 링크를 적어 주세요.';
    if (v.role.length < 5 || v.role.length > 1000) errors.role = '직접 맡은 역할을 5~1,000자로 적어 주세요.';
    for (const key of ['priceFrom','availability']) if (!v[key] || v[key].length > 500) errors[key] = '500자 안으로 적어 주세요.';
    v.participation = v.participation === true || v.participation === 'on';
    if (!v.participation) errors.participation = '참여 인터뷰 의사를 확인해 주세요.';
    return {value:v, errors, valid:Object.keys(errors).length === 0};
  }
  function parseNumericInput(input) {
    const s=trim(input);
    if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(s))return NaN;
    return Number(s.replace(/,/g,''));
  }
  function economics(input) {
    const keys = ['orderValue','orders','commission','paymentRate','support','lossRate','acquisition','fixed'];
    const v = Object.fromEntries(keys.map(k => [k, Number(input[k])]));
    if (keys.some(k => !Number.isFinite(v[k]) || v[k] < 0) || v.orderValue <= 0 ||
      !Number.isSafeInteger(v.orders) || ['commission','paymentRate','lossRate'].some(k => v[k] > 100))
      return {valid:false,error:'거래액은 0보다 큰 값, 건수는 0 이상의 정수, 비율은 0~100으로 입력해 주세요.'};
    const round = n => Math.round(n);
    const fee = round(v.orderValue * v.commission / 100);
    const payment = round(v.orderValue * v.paymentRate / 100);
    const loss = round(v.orderValue * v.lossRate / 100);
    const contribution = fee - payment - loss - v.support - v.acquisition;
    return {valid:true, fee,payment,loss,contribution,monthlyRevenue:fee*v.orders,monthlyContribution:contribution*v.orders,
      operatingResult:contribution*v.orders-v.fixed,
      breakEven:contribution > 0 ? Math.ceil(v.fixed/contribution) : null};
  }
  return {today,validDate,httpsUrl,normalizeRequest,validateRequest,matchRequest,validateSeller,parseNumericInput,economics};
});

