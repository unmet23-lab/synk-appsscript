// 말의 리듬의 새 길(Atlas 재설계 단계 4 · 4-6d — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §23-7). WORLD 셸이 연 게임 코치를
// 문(window.SYNKAtlasGame)으로 받아(키트 kit/atlas-next.mjs) 이 게임의 판 · 고르기 · 답 · 도움 · 전달 · 순간 맞춤을 잇는다.
// 스위치가 꺼졌을 때(문도 개발 깃발도 없을 때) app.mjs는 이 파일을 싣지 않고 옛 코치를 지금처럼 만든다.
//   판      곡 하나가 판 하나다(5문항 — set.length 5 · 새것 한도 3n, 키트 setPlay). 곡의 첫 문장을 낼 때 앞 판(입구의 고르기 · 보충 연습)을
//           닫고 새로 열고, 곡이 끝나거나 중간에 나가면 기록 없이 닫는다.
//   곡      곡 문항 전체(곡 셋 × 문장 다섯 × 주장 변형 둘) 가운데 recommend가 고른 문항이 든 곡이 추천 곡이고, 그 이유는 why.line이다.
//           엔진이 고르지 않으면(none) 게임은 지금 고른 곡 그대로 두고 이유 줄을 지어내지 않는다.
//   문장    문장마다 주장 변형 둘 가운데 recommend. 문장 소리 길이가 관문 자리를 정하고 소리는 곡을 열 때 한 번에 받으므로, 곡을 열 때 문장마다
//           고른 변형으로 보면을 짓는다(variants). 그 문장을 낼 때 한 번 더 recommend해 지금도 그 변형을 고르면 엔진이 고른 제시(adaptive),
//           아니면 게임 차례(host)로 낸다. none이면 보면의 섞기(게임 차례)이고 이유 줄이 없다. 곡의 차례(관문 순서)는 게임 규칙이다.
//   그 밖   새 문장 확인(곡의 문장마다 수 · 시간만 바꾼 문장)과 보충 연습은 게임 차례로 present만 한다. 며칠 뒤 다시 확인(옛 followups ·
//           mapVersion)은 due()의 단위가 든, 아직 듣지 않은 며칠 뒤 확인 대화다(dueItems). 손님 체험은 곡에서만(게임 규칙 — app.mjs).
//   정해진 판  새 문장 확인 · 보충 연습 · 며칠 뒤 다시 확인은 저마다 판 하나다(fixed). 첫 제시 바로 앞에서 앞 판을 닫고 판 길이(낼 제시 수)를
//           코치 startSet으로 넘긴다(키트 setPlay().open() — 새것 한도 3n). 코치에 startSet이 없으면 첫 제시가 코치의 기본 판을 연다.
//           이 판이 도는 동안 추천 곡은 판 옵션 없이 고른다 — 곡의 판 옵션을 넘기면 코치가 판을 새로 열어 이 판의 제시가 닫힌다.
//   뒤 답   새 문장 확인 · 보충 연습의 다시 듣기는 같은 제시의 도움(replay)일 뿐이다 — 답은 한 번.
//   순간 맞춤  판정 폭(FLOW_RHYTHM — live). 박자는 문항이 아니라 제시 번호 없이 관찰하고, 듣기 O·X 답은 순간 맞춤을 움직이지 않는다.
//   답      옛 답 꼴을 키트 answerOf로 옮긴다. 혼자 처음 맞혔나(independent)는 저장 뒤에 선다 — 판 끝에서 기다린다(settled).
//   오류    문을 거친 오류는 셸 창의 것이라 code로만 가른다. 겉이 닫히면(RUN_ENDED · 판을 다시 정함) 그 겉을 더 부르지 않고 기록 없이 놀이를
//           잇는다. 다른 오류는 그 부르기만 버린다. 판을 다시 정했으면(retired) 다음 곡에서 app.mjs가 문을 다시 연다.
// 옛 return-practice(놓친 표현 바로 연습 · 맞춤 첫 관문) · 옛 요약 · events · followups · 기록 지우기 · syncPort는 새 길에서 쓰지 않는다(§23-6).
import { TRACKS } from './core.mjs';
import { rhythmItem } from './personalization.mjs';
import { supplementalItems } from './supplemental.mjs';
import { answerOf, ended, openNext, setPlay } from './kit/atlas-next.mjs';

export const GAME_ID = 'korean-rhythm';
// 셸의 게임 은행 표(synk-world-app/world-atlas-game.mjs GAME_BANKS['korean-rhythm'])와 같다 — 시험이 견준다.
export const BANKS = Object.freeze(['korean-rhythm']);
// 곡 하나의 문장 수 = 판 길이.
export const SONG_LENGTH = 5;
// 엔진이 그 까닭으로 고르지 않았을 때(하루 상한 · 끈질긴 말의 몫)만 입구 · 판 끝에 그 한 줄을 쓴다.
const HELD = new Set(['day.capped', 'pace.stubborn']);
// 혼자 뜨는 길(개발 깃발)의 능력 이름 — 결과 화면의 이름과 같다(단위 이름은 지도 조각이 안다).
const SKILL_LABEL = Object.freeze({
  'ko.listening.detail': '세부 내용',
  'ko.listening.negation': '부정 표현',
  'ko.listening.condition': '조건 표현',
  'ko.listening.reason': '이유',
  'ko.listening.main': '중심 내용',
});
// 곡의 문장(주장 변형) 문항 번호 — rhythmItem의 id(t곡q문장v변형). 새 문장 확인은 t곡q문장r, 보충 연습은 다른 꼴이다.
const SONG_CLAIM = /^t(\d+)q(\d+)v([01])$/;

// 한 문장의 주장 변형 둘 — 문항(rhythmItem)에 곡 · 변형 번호를 붙인다(자료만 — 문을 지난다).
export function claimsOf(trackId, sourceIndex) {
  return [0, 1].map(variant => ({ ...rhythmItem(trackId, { sourceIndex, variant }), trackId, variant }));
}
// 곡 문항 전체 — 곡마다 문장마다 변형 둘.
export function songItems(tracks = TRACKS) {
  return tracks.flatMap(track => track.questions.flatMap((_, sourceIndex) => claimsOf(track.id, sourceIndex)));
}

// 새 길 코치를 연다. 문이 없고 개발 깃발도 없거나 셸이 지금 판이라고 하면 null(옛 길). RUN_ENDED는 그대로 던진다 — 옛 길을 열지 않는다.
export async function openRhythm({ win = globalThis.window } = {}) {
  const coach = await openNext({ win, gameId: GAME_ID, banks: [...BANKS], label: id => SKILL_LABEL[id] ?? null });
  return coach ? createRhythm(coach) : null;
}

// coach: 키트가 감싼 게임 겉(openNext의 값).
export function createRhythm(coach) {
  let open = coach; // 겉이 닫히면(RUN_ENDED · 판을 다시 정함) null — 그 뒤는 기록 없이 잇는다
  let retired = false;
  let inSong = false; // 이 곡의 판을 열었나(곡의 첫 문장 앞에서 앞 판을 닫는다)
  let fixedKey = null; // 도는 정해진 판(새 문장 확인 · 보충 연습)의 열쇠 — 판을 닫으면 null
  let last = null; // 마지막 recommend의 결과 — none의 까닭(held)을 읽는다
  const call = fn => {
    if (!open) return null;
    try {
      return fn(open);
    } catch (error) {
      if (ended(error)) open = null;
      return null;
    }
  };
  // 판을 다시 정했다 — 이번 판은 기록 없이 잇고 다음 곡에서 문을 다시 연다(§23-2).
  call(c =>
    c.onRetired?.(() => {
      retired = true;
      open = null;
    }),
  );
  const set = setPlay(
    {
      recommend: (list, options) => (last = open.recommend(list, options)),
      finishSet: options => open.finishSet(options),
    },
    { length: SONG_LENGTH },
  );
  // 엔진이 고른 것만 — 게임 차례는 부르는 쪽이 정한다(곡은 지금 고른 곡, 문장은 보면의 섞기).
  const pick = list => {
    last = null;
    return call(() => set.next(list, () => null));
  };
  // 정해진 판이 도는 동안의 고르기 — 판 옵션 없이 지금 판 안에서 고른다(ready · idle만 엔진이 고른 것, 키트 setPlay.next와 같다).
  const peek = list => {
    last = null;
    const result = call(c => (last = c.recommend(list, {})));
    return ['ready', 'idle'].includes(result?.status) && result.selected
      ? { item: result.selected, why: result.why ?? null, engine: true }
      : null;
  };
  const end = () => {
    inSong = false;
    fixedKey = null;
    call(() => set.end());
  };
  const banked = item => (call(c => c.itemUnits(item.itemKey))?.length ?? 0) > 0;

  // app.mjs · supplemental-player.mjs가 쓰는 옛 겉의 꼴(제시 · 전달 · 도움 · 답 · 순간 맞춤 · 저장 상태 · 만남).
  const surface = Object.freeze({
    present(item) {
      // 은행에 없는 문항은 내지 않는다 — 내면 엔진이 태그 없는 문항으로 받아 그 계열을 새 단위로 센다.
      if (!item?.itemKey || !banked(item)) return null;
      const claim = SONG_CLAIM.exec(item.id ?? '');
      if (claim) {
        // 곡의 첫 문장(보면을 받은 뒤 코치가 늦게 왔을 때) — 앞 판을 닫고 이 곡의 판을 새로 연다.
        if (!inSong) {
          end();
          inSong = true;
        }
        // 문장마다 주장 변형 둘 가운데 recommend — 지금도 낸 변형을 고르면 엔진이 고른 제시, 아니면 게임 차례(host).
        pick(claimsOf(Number(claim[1]), Number(claim[2])));
      }
      return call(c => c.present(item));
    },
    delivery: (pid, status) => (pid ? call(c => c.delivery(pid, { audio: status?.audio })) : null),
    help: (pid, kind) => (pid ? call(c => c.help(pid, kind)) : null),
    // 화면 값(correct)은 바로 쓰고, 혼자 처음 맞혔나(independent)는 저장 뒤 근거가 서면 채운다.
    answer(pid, old) {
      if (!pid) return null;
      const recorded = call(c => c.answer(pid, answerOf(old)));
      if (!recorded) return null;
      const out = { eventId: recorded.eventId, verdict: recorded.verdict, correct: recorded.correct, independent: null, evidence: null };
      out.evidence = Promise.resolve(recorded.evidence).then(
        evidence => {
          out.independent = evidence?.independent === true;
          return evidence;
        },
        () => null,
      );
      return out;
    },
    live: (content, options) => call(c => c.live(content, options)),
    summary: () => call(c => c.summary()),
    exposure: item => call(c => c.exposure(item)),
  });

  return Object.freeze({
    coach: surface,
    get retired() {
      return retired;
    },
    // 추천 곡 — { trackId(엔진이 고르지 않았으면 null), line(why.line), held(엔진이 그 까닭으로 멈춘 한 줄) }.
    song(tracks = TRACKS) {
      const got = fixedKey === null ? pick(songItems(tracks)) : peek(songItems(tracks));
      if (got?.engine) return { trackId: got.item.trackId, line: got.why?.line ?? null, held: null };
      const why = last?.status === 'none' && HELD.has(last.why?.code) ? last.why : null;
      return { trackId: null, line: null, held: why?.line ?? null };
    },
    // 곡을 연다 — 앞 판을 닫고, 문장마다 주장 변형 둘 가운데 엔진이 고른 변형으로 보면의 변형을 정한다(core.mjs buildChart의 variantChoices).
    // 엔진이 고르지 않은 문장은 정하지 않는다(보면의 섞기 — 게임 차례).
    variants(track) {
      end();
      inSong = true;
      const variantChoices = { ...(track.variantChoices ?? {}) };
      track.questions.forEach((_, sourceIndex) => {
        if (variantChoices[sourceIndex]) return;
        const got = pick(claimsOf(track.id, sourceIndex));
        if (got?.engine) variantChoices[sourceIndex] = [got.item.variant];
      });
      return { ...track, variantChoices };
    },
    // 곡 끝 · 그만두기 — 판을 기록 없이 닫는다. 겉이 닫혔으면 조용히 지나간다.
    end,
    // 정해진 판(새 문장 확인 · 보충 연습 · 며칠 뒤 다시 확인)을 연다 — 그 판의 첫 제시 바로 앞에서 부른다. 앞 판을 닫고 판 길이(items 가운데
    // 은행에 있는 문항 수 — 낼 제시 수)를 코치 startSet으로 넘긴다. key는 판 하나를 가른다 — 같은 판이 돌고 있으면 아무것도 하지 않는다.
    fixed(items = [], key = items) {
      if (key !== null && key === fixedKey) return;
      end();
      fixedKey = key;
      const length = items.filter(item => item?.itemKey && banked(item)).length;
      call(c => setPlay(c, { length }).open());
    },
    // 며칠 뒤 다시 확인 — 돌아온 단위(due)가 든, 아직 듣지 않은 며칠 뒤 확인 대화(같은 출처 대화까지 듣지 않은 것).
    dueItems() {
      const due = call(c => c.due()) ?? [];
      if (!due.length) return [];
      const units = new Set(due.map(row => row.unit));
      const seen = item => call(c => c.exposure(item))?.seen ?? null;
      return supplementalItems({ purpose: 'delayed', seen }).filter(item =>
        (call(c => c.itemUnits(item.itemKey)) ?? []).some(row => units.has(row.unit)),
      );
    },
    // 이 판 답들의 근거가 다 섰을 때 — 판 끝에 혼자 처음 맞힌 수를 다시 쓴다.
    settled(records = []) {
      return Promise.all(records.map(record => record?.evidence ?? null)).then(() => undefined);
    },
  });
}
