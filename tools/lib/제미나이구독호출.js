#!/usr/bin/env node
'use strict';
/**
 * Google AI Pro 구독으로 Gemini를 부르는 로컬 검수 통로.
 *
 * API 키·Vertex·Google Cloud 결제는 쓰지 않는다. `agy`의 저장된 개인 Google 로그인만 쓰고,
 * 빈 임시 폴더 + sandbox에서 한 번 호출한다. 지원하지 않는 모델은 다른 모델로 내리지 않고 멈춘다.
 *
 * 사용:
 *   node tools/lib/제미나이구독호출.js --model <정책 모델> [--thinking high]
 *     [--schema <json>] -o <출력> [--timeout <ms>]   (프롬프트 = stdin)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const 경로표 = Object.freeze({
  'gemini-3.1-pro-preview': Object.freeze({
    low: 'gemini-3.1-pro-low',
    high: 'gemini-3.1-pro-high',
  }),
  'gemini-3.8-flash': Object.freeze({
    low: 'gemini-3.8-flash-low',
    medium: 'gemini-3.8-flash-medium',
    high: 'gemini-3.8-flash-high',
  }),
});

function 값(argv, 이름) {
  const i = argv.indexOf(이름);
  if (i < 0) return null;
  const v = argv[i + 1];
  if (!v || /^--?/.test(v)) throw new Error(`${이름} 뒤에 값이 없다`);
  return v;
}
function 구독모델(model, thinking = 'high') {
  const 모델 = 경로표[String(model)];
  const 고른것 = 모델 && 모델[String(thinking || 'high')];
  if (!고른것) {
    const 가능한것 = Object.entries(경로표)
      .flatMap(([m, levels]) => Object.keys(levels).map((level) => `${m}/${level}`)).join(' · ');
    throw new Error(`Google AI Pro 구독 통로가 지원하지 않는 픽 ${model}/${thinking || 'high'} — 가능: ${가능한것}. 다른 모델로 자동 대체하지 않는다.`);
  }
  return 고른것;
}

function 실행파일() {
  if (process.env.SYNK_AGY_BIN) return process.env.SYNK_AGY_BIN;
  if (process.platform === 'win32') {
    const p = path.join(os.homedir(), 'AppData', 'Local', 'agy', 'bin', 'agy.exe');
    if (fs.existsSync(p)) return p;
  }
  return 'agy';
}

function 설정파일() {
  return process.env.SYNK_AGY_SETTINGS
    || path.join(os.homedir(), '.gemini', 'antigravity-cli', 'settings.json');
}

/**
 * Antigravity는 false 기본값을 파일에서 생략하는 희소 저장을 쓴다. 따라서 값 없음과 false는 안전하고,
 * true만 거절한다. API 키 제공자 선택도 구독 호출이 아니므로 거절한다.
 */
function 구독설정확인(파일 = 설정파일()) {
  if (!fs.existsSync(파일)) return { useG1Credits: false, sparseDefault: true };
  let j;
  try { j = JSON.parse(fs.readFileSync(파일, 'utf8')); }
  catch (e) { throw new Error(`Antigravity 설정 JSON을 못 읽었다: ${e.message}`); }
  if (j.useG1Credits === true) {
    throw new Error('Antigravity의 Use G1 Credits가 켜져 있다. 구독 기본 몫 소진 뒤 크레딧을 쓰지 않도록 먼저 꺼야 한다.');
  }
  if (j.modelProvider) {
    throw new Error(`Antigravity modelProvider=${j.modelProvider}는 계정 구독 통로가 아니다. modelProvider를 지우고 Google 로그인으로 돌아가야 한다.`);
  }
  return { useG1Credits: false, sparseDefault: j.useG1Credits === undefined };
}

function 결과읽기(stdout) {
  const 줄들 = String(stdout || '').split(/\r?\n/).filter((s) => s.trim());
  const 사건들 = 줄들.map((줄, i) => {
    try { return JSON.parse(줄); }
    catch (e) { throw new Error(`agy 출력 ${i + 1}번째 줄이 JSON이 아니다: ${줄.slice(0, 160)}`); }
  });
  const 결과들 = 사건들.filter((e) => e && e.event === 'result' && e.result).map((e) => e.result);
  if (결과들.length !== 1) throw new Error(`agy 완료 결과가 하나가 아니다(받은 수 ${결과들.length})`);
  const init = 사건들.find((e) => e && e.event === 'init' && e.init);
  return { init: init ? init.init : null, result: 결과들[0] };
}

function 임시방지우기(방) {
  const 임시루트 = path.resolve(os.tmpdir()) + path.sep;
  const 대상 = path.resolve(방);
  if (!대상.startsWith(임시루트) || !path.basename(대상).startsWith('synk-agy-review-')) {
    throw new Error(`임시방 경계 밖은 지우지 않는다: ${대상}`);
  }
  fs.rmSync(대상, { recursive: true, force: true });
}

function 비밀환경걷기(env = process.env) {
  const 안전 = { ...env };
  for (const 이름 of [
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY',
    'GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_GEMINI_BASE_URL', 'SYNK_ALLOW_PAID_API',
  ]) delete 안전[이름];
  return 안전;
}

function main(argv = process.argv.slice(2)) {
  const model = 값(argv, '--model');
  const out = 값(argv, '-o');
  if (!model || !out) throw new Error('사용: --model <정책 모델> -o <출력> 이 필요하다');
  const thinking = 값(argv, '--thinking') || 'high';
  const schemaArg = 값(argv, '--schema');
  const timeoutMs = Math.max(1_000, Number(값(argv, '--timeout')) || 300_000);
  const schema = schemaArg ? path.resolve(schemaArg) : null;
  if (schema && !fs.existsSync(schema)) throw new Error(`스키마를 못 찾았다: ${schema}`);
  const prompt = fs.readFileSync(0, 'utf8');
  if (!prompt.trim()) throw new Error('stdin 프롬프트가 비었다');

  구독설정확인();
  const selectedModel = 구독모델(model, thinking);
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-agy-review-'));
  try {
    const args = [
      '--input-format', 'stream-json', '--output-format', 'stream-json',
      '--model', selectedModel, '--effort', thinking,
      '--print-timeout', `${Math.ceil(timeoutMs / 1000)}s`,
      '--sandbox', '--disable-slash-commands',
      ...(schema ? ['--json-schema', schema] : []),
    ];
    const input = JSON.stringify({ event: 'user', message: { content: prompt } }) + '\n';
    const p = spawnSync(실행파일(), args, {
      cwd: 방,
      input,
      encoding: 'utf8',
      windowsHide: true,
      timeout: timeoutMs + 30_000,
      maxBuffer: 32 * 1024 * 1024,
      env: 비밀환경걷기(),
    });
    if (p.error) throw new Error(`agy 실행 실패: ${p.error.message}`);
    if (p.status !== 0) {
      const 진단 = String(p.stderr || p.stdout || '').trim().split(/\r?\n/).filter(Boolean).slice(-3).join(' / ');
      throw new Error(`agy 종료 ${p.status}: ${진단 || '(진단 없음)'}`);
    }
    const { init, result } = 결과읽기(p.stdout);
    if (result.status !== 'SUCCESS') throw new Error(`agy 상태 ${result.status}: ${result.error || '(원인 없음)'}`);
    if (init && init.model && init.model !== selectedModel) {
      throw new Error(`agy가 고른 모델이 요청과 다르다: 요청 ${selectedModel} · 실행 ${init.model}`);
    }
    const text = result.structured_output !== undefined
      ? JSON.stringify(result.structured_output)
      : String(result.response || '').trim();
    if (!text) throw new Error('agy가 빈 답을 냈다');
    const 기록 = {
      text,
      modelVersion: selectedModel,
      finishReason: result.status,
      usage: result.usage || null,
      route: 'google-ai-pro-subscription',
      requestedModel: model,
      requestedThinking: thinking,
      selectedModel,
    };
    const 절대출력 = path.resolve(out);
    fs.mkdirSync(path.dirname(절대출력), { recursive: true });
    fs.writeFileSync(절대출력, JSON.stringify(기록), 'utf8');
    return 기록;
  } finally {
    임시방지우기(방);
  }
}

module.exports = { 경로표, 구독모델, 결과읽기, 비밀환경걷기, 설정파일, 구독설정확인, 임시방지우기, main };

if (require.main === module) {
  try { main(); }
  catch (e) { console.error(`확인 불가: 제미나이 구독 호출 실패 — ${e.message}`); process.exit(2); }
}
