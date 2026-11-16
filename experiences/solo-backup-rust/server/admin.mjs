// Operator commands, run inside the api container:
//   docker compose exec -T wb-api node admin.mjs <command> [arg]
// invite-add and invite-remove read the address from standard input so it does not
// stay in shell history or process listings. Output never prints a key secret;
// customer addresses are printed only by `customers --email`.
import fs from 'node:fs';
import { apiFromEnv } from './boot.mjs';
import { withSettings } from './config.mjs';

const [command, arg, flag] = process.argv.slice(2);
const stdin = () => fs.readFileSync(0, 'utf8').trim();
const out = (v) => console.log(JSON.stringify(v, null, 1));
const { store, api, jobs, keys } = apiFromEnv(withSettings(process.env));

try {
  switch (command) {
    case 'invite-add': out({ added: store.addInvite(stdin()) }); break;
    case 'invite-remove': out({ removed: store.removeInvite(stdin()) }); break;
    case 'invites': out(store.listInvites().map((i) => ({ email: i.email, addedAt: new Date(i.added_at).toISOString(), used: !!i.used_at }))); break;
    case 'customers':
      out(store.all('select * from customers order by created_at').map((c) => ({ id: c.id, state: c.state, createdAt: new Date(c.created_at).toISOString(), lostAt: c.lost_at, readKey: !!c.read_key, devices: store.devicesOf(c.id).length, ...(arg === '--email' ? { email: c.email } : {}) })));
      break;
    case 'devices': out(store.devicesOf(arg).map((d) => ({ id: d.id, name: d.name, role: d.role, state: d.state, lastSeenAt: d.last_seen_at }))); break;
    // A key of ours that B2 has and the table does not (the reconcile's 「not-in-table」 — for
    // example after the database was restored from an older copy): after looking, delete it.
    case 'key-delete': {
      const row = store.keyById(arg);
      if (row && row.state !== 'deleted') throw new Error('IN_TABLE');
      out(await keys('keys.delete', { keyId: arg }));
      break;
    }
    // 4.5 「서버가 하루치 급증을 보면 그 기기 출입증만 끊는 길」.
    case 'cut-device': {
      const d = store.device(arg); if (!d) throw new Error('NOT_FOUND');
      await api.cutDevice(d.id);
      out({ cut: d.id });
      break;
    }
    // 1단계 has no phone lost-report page: a customer with no other PC asks the operator
    // (design 「휴대폰 분실 신고 쪽」). The same report as POST lost, in the same per-customer
    // line as the running api (카본 r7 B2).
    case 'lost': {
      const d = store.device(arg); if (!d) throw new Error('NOT_FOUND');
      const r = await api.reportLost(d.id);
      out({ lost: d.id, alreadyLost: !!r.alreadyLost });
      break;
    }
    case 'scan': { const c = store.customerById(arg); if (!c) throw new Error('NOT_FOUND'); await jobs.scanCustomer(c, Date.now()); out(store.lastUsage(arg)); break; }
    case 'reconcile': out(await jobs.reconcileKeys(Date.now())); break;
    case 'backup': store.backupTo(arg); out({ backup: arg }); break;
    case 'mail-held': out(store.all("select key, to_addr, subject, state, created_at from outbox order by created_at desc limit 50").map((m) => ({ ...m, to_addr: (arg === '--to' || flag === '--to') ? m.to_addr : m.to_addr.replace(/^[^@]{0,3}[^@]*/, (s) => s.slice(0, 2) + '…') }))); break;
    default: console.error('commands: invite-add · invite-remove · invites · customers [--email] · devices <customer> · cut-device <device> · lost <device> · scan <customer> · reconcile · backup <file> · mail-held [--to] · key-delete <keyId>'); process.exitCode = 2;
  }
} finally { store.close(); }
