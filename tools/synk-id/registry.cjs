'use strict';
// One catalogue for the existing SYNK ID. A catalogue entry is not proof that
// its OAuth registration, transport or product data API is deployed.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const SERVICES = freeze([
  { id: 'platform', name: 'SYNK 플랫폼', product: 'platform', connection: 'implemented' },
  { id: 'world', name: 'SYNK WORLD', product: 'world', connection: 'implemented' },
  { id: 'messenger', name: 'SYNK 메신저', product: 'messenger', connection: 'implemented' },
  { id: 'teacher', name: 'SYNK WORLD 교사', product: 'world', connection: 'native-implemented' },
  { id: 'fortune', name: 'SYNK 무료 운세', product: 'platform', connection: 'implemented' },
  { id: 'care', name: 'SYNK 플레저', product: 'platform', connection: 'implemented' },
  { id: 'tools', name: 'SYNK 맞춤 도구', product: 'platform', connection: 'legacy' },
  { id: 'path', name: 'SYNK PATH', product: 'platform', connection: 'implemented' },
  { id: 'rehearsal', name: '중요한 대화 리허설', product: 'platform', connection: 'implemented' },
  { id: 'family-album', name: '가족 이야기 앨범', product: 'platform', connection: 'implemented' },
]);
const native = ['platform', 'world', 'messenger', 'teacher', 'fortune', 'care', 'rehearsal', 'family-album', 'path'].map((service, index) => ({
  id: `${service}-native`, service, product: SERVICES.find(item => item.id === service).product, runtime: 'native', connection: SERVICES.find(item => item.id === service).connection === 'pending-adapter' ? 'pending-adapter' : 'implemented', configKey: service,
  redirectUris: [`http://127.0.0.1:${43821 + index}/synk/oauth/${service}/callback`],
}));
const browserRedirects = {
  platform: 'http://127.0.0.1:4280/synk-account/client.html?product=platform',
  world: 'http://127.0.0.1:4280/synk-account/client.html?product=world',
  messenger: 'http://127.0.0.1:4191/api/synk-id/callback',
  teacher: 'http://127.0.0.1:4295/', fortune: 'http://127.0.0.1:4299/', care: 'http://127.0.0.1:4296/',
  rehearsal: 'http://127.0.0.1:4297/', 'family-album': 'http://127.0.0.1:4298/', path: 'http://127.0.0.1:4292/',
};
const browser = Object.entries(browserRedirects).map(([service, callback]) => ({
  id: `${service}-browser`, service, product: SERVICES.find(item => item.id === service).product, runtime: 'browser',
  connection: ['native-implemented', 'pending-adapter'].includes(SERVICES.find(item => item.id === service).connection) ? 'pending-adapter' : 'implemented', configKey: service, redirectUris: [callback],
}));
const CLIENTS = freeze([
  { id: 'world-legacy', service: 'world', product: 'world', runtime: 'legacy', connection: 'legacy', redirectUris: ['synktalk://oauth/callback'], knownIds: { production: '52e3e2ac-e26f-46c4-948a-e4ef84982141', rehearsal: 'f1a08dbc-2677-46bf-9146-db65688bf445' } },
  { id: 'tools-legacy', service: 'tools', product: 'platform', runtime: 'legacy', connection: 'legacy', redirectUris: ['https://synk.im/brief/computer/', 'https://synk.im/brief/meeting/'], knownIds: { production: '291a98a7-4fa8-44fe-b5de-8acb790bea21' } },
  ...native, ...browser,
]);
const LEGACY_CLIENT_IDS = freeze(Object.fromEntries(['production', 'rehearsal'].map(environment => [environment,
  Object.fromEntries(CLIENTS.filter(client => client.knownIds?.[environment]).map(client => [client.service, client.knownIds[environment]])),
])));
module.exports = { SERVICES, CLIENTS, LEGACY_CLIENT_IDS, TOOL_REDIRECTS: CLIENTS.find(client => client.id === 'tools-legacy').redirectUris };
