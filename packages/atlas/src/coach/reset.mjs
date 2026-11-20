// 연습 기록 비우기 — 코치 reset()의 길 셋(단계 4 계획 §22-4 — 설계 주인 답 1 · 2 · 3 · 5, 둘째 · 셋째 답). 계정과 손님이 아니라 기록이 사는
// 곳으로 가른다: 손님(이 기기의 손님 기록 전부), 올리는 계정(올리기를 먼저 다 하고 서버를 비운다), 기기 길 계정(입구가 준 서버 비우기). 서버
// 비우기는 동의 판을 올리고 새 판을 돌려준다. 판 견줌 · 남은 걸음 표지 · 본인 값 옮기기 · 앞 판 쓸기 · 다시 정하기는 입구(WORLD world-atlas-next.mjs)의
// 몫이다(22-1의 4). 여기는 엔진 기록만 다룬다 — 새 길의 기록부(손님 저장소 · 서버)와 옛 엔진의 손님 로그(입구가 준 읽개 · 비우는 문).
//   legacy: { read() → { log, ledger, epoch } | null, clear({ check }?) → 옛 엔진 손님 비우기(던지면 그 code — STORAGE_BUSY 등) }
//   check가 있으면 옛 엔진 문은 쓰기 임대를 쥔 채 옛 로그를 다시 읽어 check(그 값)가 참일 때만 비우고, 거짓이면 비우지 않고 'kept'를 돌려준다
//   (계정 비우기의 4b — 4-5 코드 검수 GPT GA1 · 설계 주인 11-18).
import { legacyAllMoved } from '../record/carry.mjs';
import { failureOf } from './sync.mjs';

const CODE = /^[A-Z][A-Z0-9_]{1,39}$/;
const codeOf = (error, fallback) =>
  typeof error?.code === 'string' && CODE.test(error.code) ? error.code : fallback;
// 계정 비우기의 0 걸음이 대기열을 올려 보는 바퀴 수 — 넘으면 「아직 보내지 못한 기록이 있어 지금은 비우지 못했어요」.
export const FLUSH_ROUNDS = 4;

// 옛 손님 로그 읽기 — { missing }(읽개가 없거나 null — 옛 로그가 없다) · { value } · { broken }(읽다 던짐 — epoch을 모른다).
async function readLegacy(read) {
  if (typeof read !== 'function') return { missing: true };
  try {
    const value = await read();
    return value == null ? { missing: true } : { value };
  } catch {
    return { broken: true };
  }
}

// 옛 엔진의 손님 기록 비우기 — 'cleared' · 'busy'(다른 창이 쥠 — STORAGE_BUSY) · 'failed'(그 밖의 실패, 또는 비운 뒤 새 epoch을 확인하지
// 못함) · 'none'(비우는 문이 없다). before: 비우기 전에 읽은 옛 로그(readLegacy). 옛 엔진 reset은 빈 로그와 새 epoch을 쓴다 — 비운 뒤 다시 읽어
// epoch이 바뀐 것을 본 때만 'cleared'다. 그때만 바닥과 옮긴 장부 칸(cleared.carried)을 거둔다(설계 주인 11-18 승인 조건). 앞 로그를 못 읽었거나
// 다시 읽지 못하면 확인할 수 없어 둘 다 남긴다. check(계정 4b)가 있으면 옛 엔진 문이 임대를 쥔 채 비우기 직전에 다시 판단한다 — 거짓이면
// 'kept'(비우지 않았다).
async function wipeLegacy(legacy, before, check = null) {
  if (typeof legacy?.clear !== 'function') return 'none';
  try {
    if ((await legacy.clear(check ? { check } : undefined)) === 'kept') return 'kept';
  } catch (error) {
    return error?.code === 'STORAGE_BUSY' ? 'busy' : 'failed';
  }
  const after = await readLegacy(legacy.read);
  const epoch = after.value?.epoch;
  return before?.value && epoch != null && epoch !== before.value.epoch ? 'cleared' : 'failed';
}

// 손님(22-4 손님 1 · 2). 옛 로그의 바닥을 먼저 정하고(옛 로그가 없으면 바닥 없음, 못 읽으면 epoch을 모름) 손님 저장소를 한 트랜잭션으로 비운 뒤
// 다른 탭에 알리고, 옛 엔진의 손님 기록을 비운다. 옛 엔진 비우기가 되면 같은 걸음에서 바닥을 거둔다. 안 되면(busy · failed) 「일부만 비움」이다
// — 새 길은 이미 비었고 바닥이 있어 되살아나지 않는다. 다시 누르면 처음부터 다시 해 끝까지 간다. 손님 판 기록 열쇠와 같은 문서의 손님 코치
// 은퇴는 입구가 한다(손님 3 · 4).
// cleared(gen): 손님 저장소를 비운 바로 뒤, 같은 차례 안에서 부른다 — 순간 맞춤 내용 기억을 비운 뒤의 세대로 비운다(flow-memory.mjs
// clearFlowMemory · 단계 4 계획 §23-13). 옛 엔진 비우기처럼 기다리는 걸음 뒤에 두면 그사이 새 세대에 저장한 다른 탭의 기억 앞에 표지가
// 늦게 선다(설계 관문 검토 M1 — 표지는 그 세대의 열쇠가 비어 있을 때만 쓴다). 던져도 비우기는 된 것이다.
export async function resetGuest(host, legacy, cleared = null) {
  const record = host.trail.record;
  const old = await readLegacy(legacy?.read);
  const floor = old.missing ? null : { epoch: old.value?.epoch ?? null };
  let gen;
  try {
    ({ gen } = await host.turn('reset', async () => {
      const done = await record.clear({ legacy: floor });
      try {
        cleared?.(done?.gen ?? null);
      } catch {}
      return done;
    }));
  } catch (error) {
    return { ok: false, path: 'guest', step: 'store', code: codeOf(error, 'STORAGE_ERROR') };
  }
  host.landed();
  const wiped = old.missing ? 'none' : await wipeLegacy(legacy, old);
  if (wiped === 'cleared') await host.turn('reset', () => record.liftFloor(gen)).catch(() => {});
  return { ok: true, path: 'guest', gen, legacy: wiped };
}

// 계정 비우기의 0 걸음(22-4 올리는 계정 0 — 설계 주인 셋째 답 2의 조건). 저장 중인 쓰기를 기다리고 대기열을 다 올린다 — 아직 못 올린 숙제 답이
// 있을 수 있고 서버는 교실 연결이 문 사건만 남기므로, 먼저 올려야 「선생님께 낸 숙제는 남아요」가 지켜진다. 올리기가 멈췄거나(멈춤 · 쓰기 막힘 ·
// 스위치 꺼짐) 몇 바퀴 뒤에도 남으면 실패다 — 아무것도 지우지 않는다. 옛 엔진의 올리기 대기열은 입구가 먼저 올린다. 지금 보낼 수 없는 사건
// (서버가 받지 않아 이 세션에 건너뛴 사건과 그 자식 — 쉬는 세션이면 남은 것 모두)은 막지도 조용히 버리지도 않는다. 그 수를 옛 대기열의 몫
// (elsewhere — 입구가 센다)과 더해 UNSENT_SKIPPED로 알리고, 학생이 그 수를 보고 한 번 더 확인하면(allowed) 그 수까지만 지운다. 그사이 수가
// 늘었으면 다시 묻는다(4-5 Opus 대체 설계 검토 F4 · 설계 주인 11-18).
async function flush(host, { allowed = 0, elsewhere = 0 } = {}) {
  // 확인한 수 · 옛 대기열의 몫은 0 이상의 정수만 믿는다 — 꼴이 틀리면 0(확인하지 않은 것)으로 본다.
  const allow = Number.isSafeInteger(allowed) && allowed > 0 ? allowed : 0;
  const aside = Number.isSafeInteger(elsewhere) && elsewhere > 0 ? elsewhere : 0;
  for (let round = 0; ; round += 1) {
    await host.settled();
    // 대기열을 세기 전에 기록부를 다시 읽어 다른 탭이 저장한 사건까지 센다(4-5 코드 검수 GPT GA2 · 설계 주인 11-18). 마지막 확인과 서버
    // 비우기 사이에 다른 탭이 새로 쓰는 짧은 틈은 알려진 한계다(§6).
    await host.trail.record.refresh();
    const status = host.syncStatus();
    if (host.unsentLeft() === 0 || status.paused) {
      const skipped = host.unsentHeld() + aside;
      return skipped > allow ? { ok: false, code: 'UNSENT_SKIPPED', skipped } : { ok: true };
    }
    if (round >= FLUSH_ROUNDS || status.stopped || status.writesOff || status.switchOff)
      return { ok: false, code: 'UNSENT' };
    await host.upload();
  }
}

// 계정 비우기의 넷째 걸음과 4b(22-4 올리는 계정 4 · 4b — 설계 주인 답 3 · 둘째 답 가). open()은 손님 저장소를 옆으로 연 호스트를 준다(저장소가
// 없으면 null — 만들지 않는다). 4b의 판단(옛 손님 로그가 모두 그 계정으로 옮긴 것인가)은 지우기 전에 한 번 읽어 정하고, 맞으면 지운 뒤 옛 엔진의
// 손님 기록을 통째로 비운다 — 되면 바닥과 옮긴 장부 칸을 거둔다. 안 되면 legacy가 'busy' · 'failed'라 입구가 남은 걸음 표지에 「옛 손님 로그
// 남음」을 적고 다음 다시 정하기에서 마저 한다. 섞였으면 'kept'(알려진 한계 — §6), 옛 로그가 없으면 'none'. drop이 거짓이면 넷째 걸음(옮긴
// 사건 지우기)을 건너뛰고 4b만 한다(settleAccount 'legacy'). before는 그 비우기가 올린 새 판이다 — 넷째 걸음은 그보다 앞선 판의 옮김 표지만
// 센다(서버는 그 판 앞의 기록만 지웠다 — 늦게 도는 남은 걸음이 비운 뒤 그 계정으로 새로 옮긴 사건까지 지우던 것, 4-5 Opus 대체 설계 검토 F5).
async function forgetMoved(account, legacy, open, drop = true, before = null) {
  let aside;
  try {
    aside = await open();
  } catch (error) {
    return { ok: false, code: codeOf(error, 'STORAGE_FAILED'), dropped: 0, legacy: 'kept' };
  }
  if (!aside) return { ok: true, dropped: 0, legacy: 'none' };
  try {
    return await aside.turn('reset', async () => {
      const record = aside.trail.record;
      await record.refresh();
      const old = await readLegacy(legacy?.read);
      // 판단의 재료(옮긴 번호 · 손님 저장소의 사건 · 옮긴 장부 칸)는 넷째 걸음 전에 한 번 읽는다. 판단 자체는 비우기 직전에 옛 엔진 문이 임대를
      // 쥔 채 다시 읽은 옛 로그로 한 번 더 한다(아래 wipeLegacy의 check — GA1).
      const facts = {
        moved: record.movedIds(account, before),
        events: record.heldEvents(),
        carried: record.cleared()?.carried ?? null,
      };
      const allMoved = value => value != null && legacyAllMoved(value, facts);
      const all = allMoved(old.value);
      // gen: 넷째 걸음이 쓴 세대(지울 것이 없거나 건너뛰면 지금 세대) — 4b가 바닥을 거둘 때 그 세대일 때만 거둔다.
      const { dropped, gen } = drop
        ? await record.dropMoved({ account, before })
        : { dropped: 0, gen: record.generation() };
      if (dropped) aside.landed();
      if (old.missing) return { ok: true, dropped, legacy: 'none' };
      if (!all) return { ok: true, dropped, legacy: 'kept' };
      const wiped = await wipeLegacy(legacy, old, allMoved);
      if (wiped === 'cleared') await record.liftFloor(gen);
      return { ok: true, dropped, legacy: wiped };
    });
  } catch (error) {
    return { ok: false, code: codeOf(error, 'GUEST_FAILED'), dropped: 0, legacy: 'kept' };
  } finally {
    aside.release();
  }
}

// 계정(22-4 올리는 계정 · 기기 길 계정). 올리는 계정은 대기열을 먼저 다 올린다. 서버 비우기(clear — 올리는 계정은 나르개의 clear, 기기 길 계정은
// 입구가 준다)가 판을 올리면 손님 저장소의 넷째 걸음과 4b를 한다. 서버가 받지 않은 것이 분명하면(409 · 그 밖의 4xx · 인증) known이 참이고,
// 닿지 못함 · 답 끊김 · 새 판 없는 답은 결과를 모른다(known 거짓 — 입구는 다음 다시 정하기의 판 견줌(lastClear)으로 맞춘다).
export async function resetAccount(
  host,
  { account, clear, legacy, open, allowed = 0, elsewhere = 0 },
) {
  const path = host.guest ? 'device' : 'upload';
  if (path === 'upload') {
    let flushed;
    try {
      flushed = await flush(host, { allowed, elsewhere });
    } catch (error) {
      // 0 걸음이 던졌다(기록부 다시 읽기 · 올리기의 저장소 실패) — 서버에 닿기 전이라 아무것도 지우지 않았다. 결과를 아는 실패로 돌려준다
      // (입구는 아무것도 바꾸지 않는다 — 4-5 코드 다시 검수 GPT GA3).
      flushed = { ok: false, code: codeOf(error, 'UNSENT') };
    }
    if (!flushed.ok)
      return {
        ok: false,
        path,
        step: 'upload',
        code: flushed.code,
        known: true,
        ...(flushed.skipped ? { skipped: flushed.skipped } : {}),
      };
  }
  if (typeof clear !== 'function')
    return { ok: false, path, step: 'clear', code: 'NO_CLEAR', known: true };
  let answer;
  try {
    answer = await clear();
  } catch (error) {
    const known = failureOf(error, 'post') !== 'offline';
    return { ok: false, path, step: 'clear', code: codeOf(error, 'CLEAR_FAILED'), known };
  }
  const revision = answer?.revision;
  if (!Number.isSafeInteger(revision) || revision <= host.revision)
    return { ok: false, path, step: 'clear', code: 'CLEAR_ANSWER', known: false };
  const guest = await forgetMoved(account, legacy, open, true, revision);
  return { ok: true, path, revision, guest };
}

// 서버가 이미 비운 뒤의 남은 걸음(22-4 「실패와 다시 누르기」 — 입구가 남은 걸음 표지를 마저 할 때). 올리기 · 서버 비우기 없이 손님 저장소의
// 걸음만 한다. settle 'cleared'는 넷째 걸음과 4b다 — 이 기기가 판 견줌(lastClear)으로 비우기를 따라 하거나, 넷째 걸음이 안 됐다.
// 'legacy'는 4b만이다 — 옛 손님 로그가 남았고 넷째 걸음은 이미 했다(그 뒤 그 계정으로 새로 옮긴 사건을 지우지 않게). revision은 그 비우기가
// 올린 새 판이다(남은 걸음 표지가 든다) — 'cleared'의 넷째 걸음은 그보다 앞선 판의 옮김 표지만 센다. 없으면 이 코치의 판으로 잰다.
// own: 이 코치의 계정 걸음인가 — 손님 코치가 다른 계정의 걸음을 할 때는 거짓이다.
export async function settleAccount(
  host,
  { account, legacy, open, settle, revision = null, own = true },
) {
  // 어느 계정의 걸음인지 모르면 하지 않는다 — 손님 코치는 입구가 준 계정의 것만 한다(4-5 Opus 대체 설계 검토 F7).
  if (account == null)
    return { ok: false, path: 'guest', step: 'settle', code: 'NO_ACCOUNT', known: true };
  const given = Number.isSafeInteger(revision) && revision > 0 ? revision : null;
  // 손님 코치는 그 계정의 판을 모른다 — 넷째 걸음을 잴 판(표지의 판)을 받지 못했으면 하지 않는다. 손님 판으로 재면 옮김 표지를 하나도
  // 고르지 못하거나 판 없이 모두 지웠다(4-5 끝 판 카본 D2).
  if (!own && settle === 'cleared' && given == null)
    return { ok: false, path: 'guest', step: 'settle', code: 'NO_REVISION', known: true };
  const path = !own ? 'guest' : host.guest ? 'device' : 'upload';
  const before = given ?? host.revision;
  const guest = await forgetMoved(account, legacy, open, settle === 'cleared', before);
  return { ok: true, path, settled: settle, guest };
}
