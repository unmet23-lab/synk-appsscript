'use strict';
const fs = require('node:fs'), path = require('node:path');
const { sha256 } = require('./contract.cjs');

// Known local runners use the reviewed watchdog and file concurrency. Historical
// tests, individual deadlines, input, reporter and judgment stay pinned.
const approved = Object.freeze({
  legacy: '0534d5dcb5675f3696ca4d95a222dd483f89c39a8aee581366680e45ade6ebfe',
  previous: '58a85821dfcf62cfbc8ca0c2e534b80dfae8c9cf5c4cd23446ceb85ea5b80155',
  bounded: '59ea46121cf4ebeb86774a4c4a99f31b91701dac2a0314ad780c28758f2fd359',
  contract: '5a41b5e12c0a982d8ab42bb5adaac3bef0c1bba7cdd9e88e061e5368e6be14f1',
  reporter: '054c1b5949c0ec3a08be382417b66efcac32048405a4a46d6658006aacf0d577',
});
function digest(folder, file) {
  return sha256(fs.readFileSync(path.join(folder, file), 'utf8').replace(/\r\n/g, '\n'));
}
function runnerFor(root, operator = __dirname, pair = approved) {
  const target = path.join(root, 'tools/conditional-qa'), original = path.join(target, 'run.cjs');
  const requested = digest(target, 'run.cjs');
  if (![pair.legacy, pair.previous].includes(requested) || digest(operator, 'run.cjs') !== pair.bounded) return original;
  if (digest(target, 'contract.cjs') !== pair.contract || digest(operator, 'contract.cjs') !== pair.contract) return original;
  if (digest(target, 'reporter.cjs') !== pair.reporter) return original;
  return __filename;
}
async function runPreparedLocal(root, output, contextFile) {
  const context = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
  if (!path.isAbsolute(output) || fs.existsSync(path.join(output, 'result.json'))) throw Error('Use a new absolute output directory');
  if (context.version !== 1 || context.candidate || path.resolve(context.root) !== root || runnerFor(root) !== __filename) {
    throw Error('Unrecognized local verification context or watchdog');
  }
  fs.writeFileSync(path.join(output, 'profile-watchdog.json'), JSON.stringify({
    inputDigest: context.inputDigest, requested: digest(path.join(root, 'tools/conditional-qa'), 'run.cjs'), executed: approved.bounded,
    contract: approved.contract, reporter: approved.reporter,
  }, null, 2), {flag: 'wx'});
  const { run } = require('./run.cjs');
  return run({route: 'local', root, output, context});
}
if (require.main === module) {
  const [routeFlag, route, outFlag, output, contextFlag, context] = process.argv.slice(2);
  if (routeFlag !== '--route' || route !== 'local' || outFlag !== '--output' || contextFlag !== '--context') throw Error('Expected a prepared local run');
  runPreparedLocal(process.cwd(), output, context).then(result => { process.exitCode = result.ok ? 0 : 1; })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { runnerFor };
