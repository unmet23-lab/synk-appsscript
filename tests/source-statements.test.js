'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { sourceStatements } = require('./lib/source-statements.cjs');

test('AST selection preserves nested bodies and ignores comment, indentation and line-boundary markers', () => {
  const source = `// function refreshTutorAccount() { old marker }
    function refreshTutorAccount (
    ) {
if (true) {
return '} is text';
}
    }
    const next = () => 'next';
    window . addEventListener (
      'focus', () => refreshTutorAccount()
    );
    window.__synkWorld.entry = next;
    await Promise.resolve();
  `;
  const parsed = sourceStatements(source), listeners = new Map(), context = vm.createContext({ window: { addEventListener: (event, fn) => listeners.set(event, fn) } });
  vm.runInContext(parsed.function('refreshTutorAccount'), context);
  vm.runInContext(parsed.call('window.addEventListener', { 0: 'focus' }), context);
  assert.equal(listeners.get('focus')(), '} is text');
  assert.equal(vm.runInContext(`${parsed.between({ name: 'refreshTutorAccount' }, { assignment: 'window.__synkWorld.entry' })}\nnext()`, context), 'next');
});

test('AST selection rejects missing or ambiguous callbacks rather than running a different block', () => {
  const parsed = sourceStatements("on('form', 'submit', () => 1); on('form', 'submit', () => 2); const form=3;");
  assert.throws(() => parsed.call('on', { 0: 'form' }), /Expected one top-level call/);
  assert.throws(() => parsed.function('missing'), /Expected one top-level declaration/);
  assert.throws(() => parsed.function('form'), /must be a function declaration/);
  assert.throws(() => sourceStatements('function broken( {'), SyntaxError);
  const handlers=sourceStatements("on('form', () => clear()); on('form', () => redraw());");
  assert.equal(handlers.call('on', { 0: 'form' }, { calls: 'clear' }), "on('form', () => clear());");
});
