// Mail for the provisioning server (STAGE1_DESIGN.md 4.5 「메일」). Same shape as the
// PULSE relay: the api signs each request with its own RSA key and the
// founder@synk.im Apps Script relay (mail-relay/relay.gs) sends a key once.
// Until the owner picks the sender name, reply address and wording, `enabled` is
// false and every message waits in the outbox as 'held' — nothing leaves.
// Recipients are only the customer's own address and the operator address.
import crypto from 'node:crypto';

export const SIGNED_TAG = 'workbackup-mail/v1';
export const SUBJECT_HEAD = '〔SYNK 업무 백업〕';
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n);
const when = (ms) => new Date(ms).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'long', timeStyle: 'short' });

// Draft wording (Claude, 11-16) — to be replaced by the owner's choice before mail is turned on.
export const TEMPLATES = {
  'new-device': (d) => ['새 기기가 연결됐습니다', `${when(d.at)}에 「${clean(d.name, 60)}」 기기가 이 계정의 업무 백업에 연결됐습니다.\n\n직접 하신 일이 아니면 다른 기기의 업무 백업 앱에서 설정 → 내 기기를 열고 그 기기를 끊어 주세요.`],
  'seat-moved': (d) => ['백업하는 기기가 바뀌었습니다', `${when(d.at)}부터 「${clean(d.name, 60)}」 기기가 이 계정의 백업을 맡습니다. 그전 기기는 더 이상 백업하지 않습니다.\n\n직접 하신 일이 아니면 업무 백업 앱의 설정 → 내 기기에서 그 기기를 끊어 주세요.`],
  'restore-requested': (d) => ['백업 되돌리기가 요청됐습니다', `${when(d.at)}에 이 계정의 백업을 ${when(d.to)} 상태로 되돌리는 요청이 들어왔습니다. 되돌리는 동안 백업 출입 열쇠를 모두 새로 바꿉니다.\n\n직접 하신 일이 아니면 바로 업무 백업 앱을 열어 확인해 주세요.`],
  'restore-done': (d) => ['백업을 되돌렸습니다', `이 계정의 백업을 ${when(d.to)} 상태로 되돌렸습니다. 업무 백업 앱에서 「여기서부터 계속」이나 「되돌리기 취소」를 골라 주세요. 고르기 전까지 자동 백업은 쉽니다.`],
  'repo-changed': (d) => [`백업이 바뀌었습니다 — 되돌릴 수 있는 날이 ${d.daysLeft}일 남았습니다`, `이 계정의 클라우드 백업에서 평소와 다른 변경을 찾았습니다. 업무 백업 앱을 열어 확인해 주세요. 앱의 「사고가 났을 때 되돌리기」로 변경 전 상태로 돌릴 수 있습니다.`],
  silent: (d) => ['사흘 넘게 백업 소식이 없습니다', `「${clean(d.name, 60)}」 기기에서 ${when(d.lastSeen)} 뒤로 백업 소식이 없습니다. 그 PC가 켜져 있다면 인터넷 연결과 업무 백업 앱을 확인해 주세요. 그동안 백업하지 못했는지는 서버가 알 수 없습니다.`],
  'lost-reported': (d) => ['분실 신고를 받았습니다', `「${clean(d.name, 60)}」 기기의 분실 신고를 받아 그 기기의 백업 출입 열쇠와 복구용 열쇠를 지웠습니다. 전에 받은 복구 코드는 더 이상 쓸 수 없습니다.\n\nGoogle 계정에서 그 기기를 로그아웃하고 「업무 백업」 접근을 지워 주세요: https://myaccount.google.com/connections`],
  'over-quota': (d) => ['백업 용량을 넘었습니다', `이 계정의 백업이 시범 용량을 넘어 새 파일 올리기를 멈췄습니다. 업무 백업 앱에서 백업할 폴더를 줄여 주세요.`],
};
export const OPERATOR = {
  'repo-changed': (d) => ['[운영] 손님 저장소 변경 탐지', `손님 ${d.customerId}: ${JSON.stringify(d.detail).slice(0, 1500)}`],
  reconcile: (d) => ['[운영] 매일 대조 어긋남', JSON.stringify(d.problems).slice(0, 3000)],
  growth: (d) => ['[운영] 하루 저장량 급증', `손님 ${d.customerId}: ${d.grewBytes}바이트`],
  help: (d) => ['[운영] 도움 요청', `손님 ${d.customerId} · 기기 ${d.deviceId} · 접수 ${d.ticket}\n\n${clean(d.text, 2000)}`],
  'job-failed': (d) => ['[운영] 되돌리기 실패', `손님 ${d.customerId} · 작업 ${d.jobId} · ${d.code}`],
  'worker-failed': (d) => ['[운영] 서버 일꾼 오류', `${d.task}: ${d.code}`],
};

export function signRequest(privateKey, req) {
  const message = JSON.stringify([SIGNED_TAG, req.op, req.key, req.ts, req.to, req.subject, req.body]);
  return crypto.sign('sha256', Buffer.from(message, 'utf8'), { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING }).toString('base64');
}

export function createMailer({ store, relayUrl = null, privateKey = null, enabled = false, operator = null, fetchImpl = fetch, now = () => Date.now() }) {
  const usable = enabled && relayUrl && privateKey;
  function queue(key, to, [subject, body]) {
    if (!to) return null;
    store.queueMail({ key, to, subject: clean(SUBJECT_HEAD + ' ' + subject, 150), body: String(body).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').slice(0, 3900), held: !usable });
    return key;
  }
  return {
    get live() { return !!usable; },
    toCustomer(customer, kind, detail, unique) {
      const t = TEMPLATES[kind]; if (!t || !customer?.email) return null;
      return queue(`wb:${kind}:${customer.id}:${unique}`, customer.email, t(detail));
    },
    toOperator(kind, detail, unique) {
      const t = OPERATOR[kind]; if (!t) return null;
      return queue(`wb:op:${kind}:${unique}`, operator, t(detail));
    },
    async flush(limit = 5) {
      if (!usable) return 0;
      let sent = 0;
      for (const m of store.pendingMail(limit)) {
        const ts = now();
        const req = { v: 1, op: 'send', key: m.key.replace(/[^a-z0-9:_-]/gi, '-').toLowerCase().slice(0, 160), ts, to: m.to_addr, subject: m.subject, body: m.body };
        req.sig = signRequest(privateKey, req);
        let answer = null;
        try {
          const res = await fetchImpl(relayUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify(req), headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(30000) });
          answer = await res.json();
        } catch { store.setMail(m.key, { attempts: m.attempts + 1, last_at: ts }); continue; }
        const status = answer?.status;
        if (status === 'sent' || status === 'duplicate') { store.setMail(m.key, { state: 'sent', attempts: m.attempts + 1, last_at: ts }); sent++; }
        else if (status === 'busy') store.setMail(m.key, { attempts: m.attempts + 1, last_at: ts });
        else if (status === 'unknown') store.setMail(m.key, { state: 'unknown', attempts: m.attempts + 1, last_at: ts });
        else store.setMail(m.key, { state: m.attempts >= 4 ? 'failed' : 'pending', attempts: m.attempts + 1, last_at: ts });
      }
      return sent;
    },
  };
}
