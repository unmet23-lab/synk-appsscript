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
  if (plan.legacy.length) {
    if (typeof postLegacy !== 'function')
      return { ok: false, step: 'legacy', code: 'NO_LEGACY_POST' };
    const sent = await postLegacy(plan.legacy);
    if (sent !== true) return { ok: false, step: 'legacy', code: 'LEGACY_POST_FAILED' };
  }
  let added = [];
  if (plan.current.length)
    added = await target.turn('move', async () => {
      await target.trail.refresh();
      return target.trail.record.importMoved(plan.current, plan.touches);
    });
  // ④ 표지 → ⑤ 알리고 올린다. 표지를 못 썼어도 계정 저장소에 든 것은 알리고 올린다 — 다음 옮기기는 같은 번호를 건너뛰어(③) 다시
  // 알릴 일이 없다.
  await guest
    .turn('move', () =>
      guest.trail.record.mark({ mark: 'moved', account, revision, until: plan.until }),
    )
    .finally(() => {
      if (added.length) target.landed();
    });
  return { ok: true, legacy: plan.legacy.length, current: added.length, until: plan.until };
}

// 「이 기기에만 두기」 — 지금 읽은 자리까지는 Z에게 다시 묻지 않는다(두기 표지 · until).
export async function keepGuest(guest, { account }) {
  return guest.turn('move', async () => {
    await guest.trail.refresh();
    const until = guest.trail.record.guestUpload(0, { account }).until;
    return guest.trail.record.mark({ mark: 'kept', account, until });
  });
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
