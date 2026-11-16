// Operator commands, run inside the api container:
//   docker compose exec -T workbackup-api node admin.mjs <command> [arg]
// invite-add and invite-remove read the address from standard input so it does not
// stay in shell history or process listings. Output never prints a key secret;
// customer addresses are printed only by `customers --email`.
import fs from 'node:fs';
import { apiFromEnv } from './boot.mjs';

const [command, arg, flag] = process.argv.slice(2);
const stdin = () => fs.readFileSync(0, 'utf8').trim();
const out = (v) => console.log(JSON.stringify(v, null, 1));
const { store, api, jobs } = apiFromEnv();

try {
  switch (command) {
    case 'invite-add': out({ added: store.addInvite(stdin()) }); break;
    case 'invite-remove': out({ removed: store.removeInvite(stdin()) }); break;
    case 'invites': out(store.listInvites().map((i) => ({ email: i.email, addedAt: new Date(i.added_at).toISOString(), used: !!i.used_at }))); break;
    case 'customers':
      out(store.all('select * from customers order by created_at').map((c) => ({ id: c.id, state: c.state, createdAt: new Date(c.created_at).toISOString(), lostAt: c.lost_at, readKey: !!c.read_key, devices: store.devicesOf(c.id).length, ...(arg === '--email' ? { email: c.email } : {}) })));
      break;
    case 'devices': out(store.devicesOf(arg).map((d) => ({ id: d.id, name: d.name, role: d.role, state: d.state, lastSeenAt: d.last_seen_at }))); break;
    // 4.5 「서버가 하루치 급증을 보면 그 기기 출입증만 끊는 길」.
    case 'cut-device': {
      const d = store.device(arg); if (!d) throw new Error('NOT_FOUND');
      for (const k of store.liveKeys(d.customer_id, 'write').filter((k) => k.device_id === d.id)) await api.dropKey(k, 'operator-cut');
      store.setDevice(d.id, { state: 'revoked', role: 'read' });
      out({ cut: d.id });
      break;
    }
    // 1단계 has no phone lost-report page: a customer with no other PC asks the operator
    // (design 「휴대폰 분실 신고 쪽」). Same effect as POST lost.
    case 'lost': {
      const d = store.device(arg); if (!d) throw new Error('NOT_FOUND');
      const c = store.customerById(d.customer_id);
      await api.serial(c.id, async () => {
        for (const k of [...store.liveKeys(c.id, 'write').filter((k) => k.device_id === d.id), ...store.liveKeys(c.id, 'read')]) await api.dropKey(k, 'lost-operator');
        store.tx(() => { store.setDevice(d.id, { state: 'lost', role: 'read' }); store.setCustomer(c.id, { read_key: null, lost_at: Date.now(), google_step: 1 }); });
      });
      out({ lost: d.id });
      break;
    }
    case 'scan': await jobs.scanCustomer(store.customerById(arg), Date.now()); out(store.lastUsage(arg)); break;
    case 'reconcile': out(await jobs.reconcileKeys(Date.now())); break;
    case 'backup': store.backupTo(arg); out({ backup: arg }); break;
    case 'mail-held': out(store.all("select key, to_addr, subject, state, created_at from outbox order by created_at desc limit 50").map((m) => ({ ...m, to_addr: flag === '--to' ? m.to_addr : m.to_addr.replace(/^[^@]{0,3}[^@]*/, (s) => s.slice(0, 2) + '…') }))); break;
    default: console.error('commands: invite-add · invite-remove · invites · customers [--email] · devices <customer> · cut-device <device> · lost <device> · scan <customer> · reconcile · backup <file> · mail-held'); process.exitCode = 2;
  }
} finally { store.close(); }
