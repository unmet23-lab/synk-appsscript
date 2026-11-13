// 손님 → 계정 옮기기(단계 4 계획 §18-5-3 — 경계 표지 · 다섯 걸음, 설계 §5-6). 손님 저장소(synk-atlas:guest)의 기록 가운데 계정 Z의
// 경계 둘(열쇠 경계 · 기준 시각)을 다 지난 것만 Z로 옮긴다 — 로그아웃 뒤 다른 계정 로그인 · 「이 기기에만 두기」 뒤에 앞 사람의 손님
// 기록이 남의 계정에 섞이지 않게(C1 · C2).
//   ① 손님 저장소의 차례 안에서 꼬리를 읽고 옮길 묶음을 고른다 — 그때의 읽은 자리가 until. 놓는다.
//   ② 옛 꼴 부분은 제품이 준 옛 POST(postLegacy — 부모 먼저 · 건수와 바이트로 자름)로 보내 받았다는 답을 확인한다.
//   ③ 계정 저장소의 차례 안에서 2판 부분을 그 판으로 도장 찍어 한 번에 덧붙인다(같은 번호는 건너뜀 · 제외의 닿는 줄 메모도). 놓는다.
//   ④ 손님 저장소의 차례 안에서 옮김 표지를 쓴다. ⑤ 그 뒤에 알리고 올린다.
//   두 저장소의 차례를 겹쳐 쥐지 않는다. 어느 걸음이 실패하거나 일부만 됐으면 표지를 쓰지 않는다 — 다음에 다시 고르고, 판이 그대로면
//   서버가 번호로 거르며 판이 올랐으면 ids · 기준 시각이 받는다(§18-5-2).

// 옮길 계획 — 손님 기록부의 guestUpload(경계로 고른다). 셀 때(물음의 수)는 차례 없이 꼬리만 읽는다.
export async function planMove(guest, { account, revision, watermarks }) {
  await guest.trail.refresh();
  return guest.trail.record.guestUpload(revision, { account, watermarks });
}

export async function moveGuest(guest, target, { watermarks = {}, postLegacy = null } = {}) {
  const account = target.account;
  const revision = target.revision;
  const plan = await guest.turn('move', async () => {
    await guest.trail.refresh(); // 차례에 들자마자 꼬리부터(§18-5-1)
    return guest.trail.record.guestUpload(revision, { account, watermarks });
  });
  // ② 옛 POST의 답 꼴은 하나 — 실제로 보낸 옛 꼴 번호 { ok: true, ids }(고른 것이 없으면 ids: []). 그 꼴이 아니면 실패로 본다 —
  // 「true = 준 것 모두」를 두면 제품이 고르지 않은 번호까지 표지에 실려 그것을 겨눈 제외가 따라가고 서버가 EVENT_LINK로 버렸다(설계 주인
  // 11-13 — GPT 다시 GA2 (a)). 보낸 번호는 옮김 표지 ids에 함께 실어 그것을 겨눈 2판 제외가 다음 옮기기에서 Z로 따라가게 하고(GA2),
  // 이번 옛 꼴 후보를 겨눈 제외(legacyExclusions)는 그 사건이 이번에 보내졌을 때만 같은 회차에 함께 보낸다(GA2 (b)).
  let legacyIds = [];
  let alongside = [];
  if (plan.legacy.length) {
    if (typeof postLegacy !== 'function')
      return { ok: false, step: 'legacy', code: 'NO_LEGACY_POST' };
    const sent = await postLegacy(plan.legacy);
    if (sent?.ok !== true || !Array.isArray(sent.ids))
      return { ok: false, step: 'legacy', code: 'LEGACY_POST_FAILED' };
    const listed = new Set(sent.ids);
    legacyIds = plan.legacy.map(event => event.id).filter(id => listed.has(id));
    const went = new Set(legacyIds);
    alongside = (plan.legacyExclusions ?? []).filter(event => went.has(event.targetId));
  }
  const current = [...plan.current, ...alongside];
  let added = [];
  if (current.length)
    added = await target.turn('move', async () => {
      await target.trail.refresh();
      return target.trail.record.importMoved(current, plan.touches);
    });
  // ④ 표지 → ⑤ 알리고 올린다. 표지를 못 썼어도 계정 저장소에 든 것은 알리고 올린다 — 다음 옮기기는 같은 번호를 건너뛰어(③) 다시
  // 알릴 일이 없다.
  await guest
    .turn('move', () =>
      guest.trail.record.mark({
        mark: 'moved',
        account,
        revision,
        until: plan.until,
        ids: [...legacyIds, ...current.map(event => event.id)],
      }),
    )
    .finally(() => {
      if (added.length) target.landed();
    });
  // legacy는 실제로 보낸 옛 꼴 수다 — 고르기 전 후보 수를 내면 결정 기록의 「옮긴 수」가 부풀었다(Fable 5.2 끝 판 넘친 #17).
  return { ok: true, legacy: legacyIds.length, current: added.length, until: plan.until };
}

// 「이 기기에만 두기」 — 지금 읽은 자리까지는 Z에게 다시 묻지 않는다(두기 표지 · until). 못 쓰면(차례 · 저장 실패) 계기에 남기고 실패를
// 그대로 돌려준다 — 셸은 결정만 남기고 다음 로그인에 다시 센다(계기에도 없던 것 — Fable 5.2 끝 판 둘째 넘친 #5).
export async function keepGuest(guest, { account }) {
  try {
    return await guest.turn('move', async () => {
      await guest.trail.refresh();
      const until = guest.trail.record.guestUpload(0, { account }).until;
      return guest.trail.record.mark({ mark: 'kept', account, until });
    });
  } catch (error) {
    guest.note?.('save', { ok: false, code: 'GUEST_MARK', dependent: true });
    throw error;
  }
}

// 되는 만큼만 쓰는 표지 — 계정이 이 기기에 다녀감(visited) · 로그아웃(logout). 쓰기 실패는 계기에만(로그인 · 로그아웃을 막지 않는다).
export async function noteGuest(guest, { mark, account = null }) {
  try {
    await guest.turn('move', () => guest.trail.record.mark({ mark, account }));
    return true;
  } catch {
    guest.note?.('save', { ok: false, code: 'GUEST_MARK', dependent: true });
    return false;
  }
}
