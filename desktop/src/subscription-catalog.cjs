'use strict';
// 새 공급자는 어댑터와 이 등록 한 줄로 읽기·검증·로그인 계약에 참여한다.
const adapters=Object.freeze({claude:require('./subscription-adapters/claude.cjs'),gpt:require('./subscription-adapters/gpt.cjs'),higgsfield:require('./subscription-adapters/higgsfield.cjs'),gemini:require('./subscription-adapters/gemini.cjs'),typecast:require('./subscription-adapters/typecast.cjs')});
const SERVICES=Object.freeze(Object.fromEntries(Object.entries(adapters).map(([id,a])=>[id,a.spec])));
const serviceSpec=service=>typeof service==='string'&&Object.hasOwn(SERVICES,service)?SERVICES[service]:null;
const providerPolicy=service=>typeof service==='string'&&Object.hasOwn(adapters,service)?adapters[service].policy:null;
module.exports={adapters,SERVICES,serviceSpec,providerPolicy};
