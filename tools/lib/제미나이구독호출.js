#!/usr/bin/env node
'use strict';
/**
 * Google AI 구독(agy에 로그인한 개인 Google 계정)으로 Gemini를 부르는 로컬 통로.
 * 2026-10-17 기준 agy 로그인은 Google AI Ultra 계정(77yuhbs)이다. 계정 확인은
 * `~/.gemini/antigravity-cli/cli.log`의 「authenticated successfully as」 줄로 한다(토큰은 보지 않는다).
 *
 * API 키·Vertex·Google Cloud 결제는 쓰지 않는다. `agy`의 저장된 개인 Google 로그인만 쓰고,
 * 빈 임시 폴더 + sandbox에서 한 번 호출한다. 지원하지 않는 모델은 다른 모델로 내리지 않고 멈춘다.
 * 무료 API 몫이 찼을 때 `제미나이호출.js`가 같은 모델로 이 통로를 부른다(10-17 사용자 결정).
 *
 * 사용:
 *   node tools/lib/제미나이구독호출.js --model <정책 모델> [--thinking high]
 *     [--schema <json>] -o <출력> [--timeout <ms>]   (프롬프트 = stdin)
 *   const { 부르기 } = require('./제미나이구독호출.js');  → await 부르기({ model, prompt, schema, thinking })
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

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
  /* 10-18 유호님 「아르곤 붙여서 비교해봐줘」 — 몽골어 검문을 flash와 나란히 돌려 보려고 더했다(Ultra 계정 agy 목록에 있음,
   * Pro 계정은 invalid model selection — 현장 노트 AI_CLI). 기본 픽은 그대로 모델정책(flash high)이다. */
  'gemini-4-argon': Object.freeze({
    low: 'gemini-4-argon-low',
    medium: 'gemini-4-argon-medium',
    high: 'gemini-4-argon-high',
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
    throw new Error(`Google AI 구독 통로가 지원하지 않는 픽 ${model}/${thinking || 'high'} — 가능: ${가능한것}. 다른 모델로 자동 대체하지 않는다.`);
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

function 임시방지우기(방, 지우기 = fs.rmSync) {
  const 임시루트 = path.resolve(os.tmpdir()) + path.sep;
  const 대상 = path.resolve(방);
  if (!대상.startsWith(임시루트) || !path.basename(대상).startsWith('synk-agy-review-')) {
    throw new Error(`임시방 경계 밖은 지우지 않는다: ${대상}`);
  }
  /* agy가 띄우는 `--bg-updater`가 이 방을 작업 폴더로 물려받아 잠깐 잡고 있는다(10-14 실측: 답은 받았는데
   * 지우기가 EPERM으로 터져 호출 전체가 실패로 나갔다). 몇 초 기다리며 다시 지우고, 그래도 안 되면
   * 방만 남기고 알린다 — 이미 받은 답을 임시 폴더 때문에 버리지 않는다. */
  try {
    지우기(대상, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    return true;
  } catch (e) {
    console.error(`주의: 임시방을 못 지워 남겨 둔다(${e.code || e.message}) — ${대상}`);
    return false;
  }
}

function 비밀환경걷기(env = process.env) {
  const 안전 = { ...env };
  for (const 이름 of [
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY',
    'GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_GEMINI_BASE_URL', 'SYNK_ALLOW_PAID_API',
  ]) delete 안전[이름];
  return 안전;
}

/* agy는 에이전트라 전역 GEMINI.md를 읽고 「먼저 자료를 보자」며 도구를 부르기도 한다. 도구를 부르면
 * 전역 PreToolUse 훅이 돌고, 10-14에는 그 훅(없는 파일을 가리키는 orca-status)이 CP949 오류문을 내
 * agy가 `proto: … invalid UTF-8`로 통째로 실패했다(몽골어 검문 문법 층). 이 통로의 일은 «모델에게 한 번
 * 묻기»이므로 도구 없이 주어진 글만 보고 답하라고 앞에 붙인다. */
const 도구없이 = '[이 요청은 도구 없이 답한다] 파일 읽기·명령 실행·검색 같은 도구를 쓰지 말고, '
  + '아래에 주어진 글만 보고 바로 답해라. 다른 문서를 읽어야 하는 요청이 아니다.\n\n';

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
    const input = JSON.stringify({ event: 'user', message: { content: 도구없이 + prompt } }) + '\n';
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
      route: 'google-ai-subscription',
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

/* 비동기 호출 — 이 파일을 **자식 프로세스로** 띄운다. agy를 동기로 기다리는 main을 그대로 쓰면서도
 * 부르는 쪽(몽골어 검문의 맞춤법 요청 등)이 그동안 멈추지 않게 한다. 돌려주는 값은 main의 기록 모양이다.
 * (10-17 몽골어대조.js의 「구독으로부르기」를 여기로 옮겼다 — 손잡이 --구독과 무료 몫 대체가 한 구현을 쓴다.) */
function 부르기({ model, prompt, schema = null, thinking = 'high', timeoutMs } = {}) {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-mn-sub-'));
  const 출력 = path.join(방, 'answer.json');
  const args = [__filename, '--model', model, '--thinking', thinking || 'high', '-o', 출력];
  if (timeoutMs) args.push('--timeout', String(timeoutMs));
  if (schema) {
    const 스키마 = path.join(방, 'schema.json');
    fs.writeFileSync(스키마, JSON.stringify(schema), 'utf8');
    args.push('--schema', 스키마);
  }
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    let 진단 = '';
    p.stderr.setEncoding('utf8');
    p.stderr.on('data', (d) => { 진단 += d; });
    p.on('error', reject);
    p.on('close', (code) => {
      try {
        if (code !== 0) {
          const 끝 = 진단.trim().split(/\r?\n/).filter(Boolean).slice(-2).join(' / ');
          return reject(new Error(`구독 통로 실패(종료 ${code}) — ${끝 || '진단 없음'}`));
        }
        resolve(JSON.parse(fs.readFileSync(출력, 'utf8')));
      } catch (e) {
        reject(e);
      } finally {
        fs.rmSync(방, { recursive: true, force: true });
      }
    });
    p.stdin.end(String(prompt ?? ''), 'utf8');
  });
}

module.exports = { 경로표, 구독모델, 결과읽기, 비밀환경걷기, 설정파일, 구독설정확인, 임시방지우기, 부르기, main };

if (require.main === module) {
  try { main(); }
  catch (e) { console.error(`확인 불가: 제미나이 구독 호출 실패 — ${e.message}`); process.exit(2); }
}
