#!/usr/bin/env node
'use strict';
// Legacy entry point is read-only. All mutations use the digest-guarded workflow.
async function main(args = process.argv.slice(2), dependencies) {
  if (args.some(arg => arg !== '--운영') || args.filter(arg => arg === '--운영').length > 1) throw Error('기존 --register·--products 쓰기는 폐기했어요. provision-apply.cjs의 원본 지문 검증과 --apply를 사용해 주세요.');
  const { createProvider } = dependencies || require('./provision-apply.cjs');
  const environment = args.includes('--운영') ? 'production' : 'rehearsal';
  const provider = await createProvider({ environment, apply: false });
  const clients = await provider.listClients();
  console.log(JSON.stringify({ environment, readOnly: true, clients: clients.map(client => ({ client_id: client.client_id, client_name: client.client_name, client_type: client.client_type, redirect_uris: client.redirect_uris })) }, null, 2));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
