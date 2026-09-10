'use strict';

// 공식 Claude Code OAuth 검수. 모델·인증 경로를 확인하고 결과만 반환한다.
// --safe-mode는 auth를 유지하며 사용자 hooks/skills/settings를 실행하지 않는다.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const 기본 = Object.freeze({ model: 'claude-opus-5', effort: 'xhigh' });
const 스키마 = {
  type: 'object', additionalProperties: false,
  required: ['summary', 'findings', 'completed', 'read_files', 'unreviewed'],
  properties: {
    summary: { type: 'string' },
    completed: { type: 'boolean', description: '제공된 코드 변경을 실제 검수했을 때만 true. 읽기/판정 실패는 false.' },
    read_files: { type: 'array', items: { type: 'string' } },
    unreviewed: { type: 'string', description: '제공되지 않은 의존 코드·실행·배포 등 검수하지 못한 범위.' },
    findings: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['severity', 'file', 'line', 'title', 'evidence', 'recommendation'],
      properties: { severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] }, file: { type: 'string' },
        line: { type: 'integer', minimum: 0 }, title: { type: 'string' }, evidence: { type: 'string' }, recommendation: { type: 'string' } } } },
  },
};

function 구독환경(env = process.env) {
  const out = { ...env };
  for (const key of Object.keys(out)) {
    if (/^ANTHROPIC_/.test(key) || /^CLAUDE_CODE_USE_/.test(key)
      || /^(OPENAI_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|GOOGLE_APPLICATION_CREDENTIALS|SYNK_ALLOW_PAID_API|CLAUDECODE)$/.test(key)) delete out[key];
  }
  // CLAUDE_CODE_OAUTH_TOKEN은 공식 구독 OAuth다. API 키로 바꾸거나 자동 폴백하지 않는다.
  return out;
}

function 실행파일() {
  if (process.platform === 'win32') {
    const exe = path.join(os.homedir(), '.local', 'bin', 'claude.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return 'claude';
}

function 구독인증(auth) {
  if (!auth || auth.loggedIn !== true || auth.authMethod !== 'claude.ai'
    || auth.apiProvider !== 'firstParty' || !['pro', 'max'].includes(auth.subscriptionType)) {
    throw new Error('Claude 구독 OAuth 인증을 확인하지 못했다. API 키·Vertex·Bedrock으로 전환하지 않는다.');
  }
  return { authMethod: auth.authMethod, subscriptionType: auth.subscriptionType, apiProvider: auth.apiProvider };
}

function 결과확인(raw, model) {
  let events;
  try { events = String(raw || '').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)); }
  catch (_) { throw new Error('Claude 결과가 JSON stream이 아니다.'); }
  const init = events.filter(e => e.type === 'system' && e.subtype === 'init');
  const results = events.filter(e => e.type === 'result');
  if (init.length !== 1 || init[0].model !== model || results.length !== 1) throw new Error('Claude 초기 실행 모델·완료 이벤트가 요청과 일치하지 않는다.');
  const envelope = results[0];
  if (envelope.type !== 'result' || envelope.subtype !== 'success' || envelope.is_error !== false) {
    throw new Error(`Claude 검수 미완료: ${String(envelope.subtype || 'result 없음')}. 다른 모델·결제 경로로 전환하지 않는다.`);
  }
  const models = Object.keys(envelope.modelUsage || {});
  const replyModels = events.filter(e => e.type === 'assistant' && e.message).map(e => e.message.model);
  if (!models.includes(model) || !replyModels.length || replyModels.some(m => m !== model)) {
    throw new Error(`Claude 응답 모델이 요청 ${model}과 일치하지 않거나 확인되지 않았다.`);
  }
  const rawValue = envelope.structured_output;
  if (!rawValue || rawValue.completed !== true || typeof rawValue.summary !== 'string'
    || !Array.isArray(rawValue.read_files) || rawValue.read_files.length === 0
    || rawValue.read_files.some(x => typeof x !== 'string' || !x.trim())
    || typeof rawValue.unreviewed !== 'string' || !Array.isArray(rawValue.findings)) throw new Error('Claude 구조화 검수의 완료·읽은 범위·지적 계약이 빠졌다.');
  for (const item of rawValue.findings) {
    if (!item || !['P0', 'P1', 'P2', 'P3'].includes(item.severity)
      || !Number.isInteger(item.line) || item.line < 0
      || ['file', 'title', 'evidence', 'recommendation'].some(k => typeof item[k] !== 'string' || !item[k].trim())) throw new Error('Claude 지적 항목이 검수 계약과 다르다.');
  }
  // Claude의 structured-output 도구는 ASCII property만 받는다. 저장소 장부에서만 한국어로 바꾼다.
  const value = { 완료: rawValue.completed, 요약: rawValue.summary, 읽은파일: rawValue.read_files, 안본것: rawValue.unreviewed,
    지적: rawValue.findings.map(x => ({ 등급: x.severity, 파일: x.file, 라인: x.line, 제목: x.title, 근거: x.evidence, 수정방향: x.recommendation })) };
  return { ...value, 모델: model, 통로: 'claude-subscription-oauth', 사용량: envelope.modelUsage,
    보조회계모델: models.filter(m => m !== model), 비용표시USD: envelope.total_cost_usd ?? null };
}

function 구독검수(prompt, options = {}) {
  const { model = 기본.model, effort = 기본.effort, timeoutMs = 600000, spawnImpl = spawnSync, bin = 실행파일() } = options;
  if (model !== 기본.model || effort !== 기본.effort) throw new Error('현재 검증된 Claude 독립검수 조합은 Opus 5/xhigh다. 모델을 조용히 대체하지 않는다.');
  if (!String(prompt || '').trim()) throw new Error('검수할 코드가 없다.');
  const env = 구독환경();
  const opts = { encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 16 * 1024 * 1024, env };
  const auth = spawnImpl(bin, ['auth', 'status', '--json'], opts);
  if (auth.error || auth.status !== 0) throw new Error('Claude 구독 인증 조회가 실패했다.');
  let authJson;
  try { authJson = JSON.parse(auth.stdout); } catch (_) { throw new Error('Claude 인증 응답을 확인할 수 없다.'); }
  const 인증 = 구독인증(authJson);
  const args = ['--safe-mode', '--print', '--model', model, '--effort', effort,
    '--output-format', 'stream-json', '--verbose', '--json-schema', JSON.stringify(스키마),
    '--tools', '', '--strict-mcp-config', '--no-chrome', '--disable-slash-commands',
    '--no-session-persistence', '--permission-prompts', 'none'];
  const result = spawnImpl(bin, args, { ...opts, timeout: timeoutMs, input: String(prompt) });
  if (result.error || result.signal || result.status !== 0) {
    let info = {};
    try { const j = String(result.stdout).trim().split(/\r?\n/).map(x => JSON.parse(x)).find(e => e.type === 'result'); info = { subtype: j.subtype, apiStatus: j.api_error_status, reason: j.terminal_reason }; } catch (_) { /* 비구조 로그는 유출 위험 때문에 붙이지 않는다 */ }
    throw new Error(`Claude 구독 검수가 ${result.signal ? '시간 초과/중단' : '실행 실패'}로 끝났다(${JSON.stringify(info)}). 추가 크레딧·API·다른 모델로 전환하지 않는다.`);
  }
  return { ...결과확인(result.stdout, model), 효력: effort, 인증 };
}

module.exports = { 기본, 스키마, 구독환경, 구독인증, 결과확인, 구독검수 };
