// data/timing.js와 data/plan.js를 브라우저처럼(window 하나에) 읽어 계획을 푼다. Node 도구들이 함께 쓴다.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
module.exports = function load() {
  const root = path.resolve(__dirname, '..');
  const ctx = { window: {} };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  for (const f of ['timing.js', 'plan.js']) vm.runInContext(fs.readFileSync(path.join(root, 'data', f), 'utf8'), ctx, { filename: f });
  const T = ctx.window.EP01_TIMING;
  return { T, R: ctx.window.EP01_PLAN.resolve(T), PLAN: ctx.window.EP01_PLAN.PLAN };
};
