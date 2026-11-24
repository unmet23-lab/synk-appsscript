// Generated from packages/atlas/src/vellum (scene.lines · scene.step, 말하는 사람 fan). Change the source; run node tools/build-seoul-fan-lines.mjs.

export const FAN_LINES = Object.freeze({
  ko: Object.freeze({
    "scene.lines:1": "대사 1줄을 소리 내어 말했어요.",
    "scene.lines:2": "대사 2줄을 소리 내어 말했어요.",
    "scene.lines:3": "대사 3줄을 소리 내어 말했어요.",
    "scene.lines:4": "대사 4줄을 소리 내어 말했어요.",
    "scene.lines:5": "대사 5줄을 소리 내어 말했어요.",
    "scene.lines:6": "대사 6줄을 소리 내어 말했어요.",
    "scene.lines:7": "대사 7줄을 소리 내어 말했어요.",
    "scene.lines:8": "대사 8줄을 소리 내어 말했어요.",
    "scene.lines:9": "대사 9줄을 소리 내어 말했어요.",
    "scene.lines:10": "대사 10줄을 소리 내어 말했어요.",
    "scene.step:take2:done": "「한 번 더」도 말해 봤어요.",
    "scene.step:take2:wait": "「한 번 더」는 기다릴게요. 하면 자리 하나가 켜져요.",
    "scene.step:transfer:done": "「처음 보는 말」까지 말해 봤어요.",
    "scene.step:transfer:wait": "「처음 보는 말」도 들어 보고 싶어요.",
  }),
  en: Object.freeze({
    "scene.lines:1": "You spoke 1 line out loud.",
    "scene.lines:2": "You spoke 2 lines out loud.",
    "scene.lines:3": "You spoke 3 lines out loud.",
    "scene.lines:4": "You spoke 4 lines out loud.",
    "scene.lines:5": "You spoke 5 lines out loud.",
    "scene.lines:6": "You spoke 6 lines out loud.",
    "scene.lines:7": "You spoke 7 lines out loud.",
    "scene.lines:8": "You spoke 8 lines out loud.",
    "scene.lines:9": "You spoke 9 lines out loud.",
    "scene.lines:10": "You spoke 10 lines out loud.",
    "scene.step:take2:done": "You tried “One more time” too.",
    "scene.step:take2:wait": "I’ll wait for you to try “One more time.” When you do, a seat lights up.",
    "scene.step:transfer:done": "You even tried “Something new.”",
    "scene.step:transfer:wait": "I’d love to hear you try “Something new” too.",
  }),
  mn: Object.freeze({
    "scene.lines:1": "Та 1 мөр чангаар хэллээ.",
    "scene.lines:2": "Та 2 мөр чангаар хэллээ.",
    "scene.lines:3": "Та 3 мөр чангаар хэллээ.",
    "scene.lines:4": "Та 4 мөр чангаар хэллээ.",
    "scene.lines:5": "Та 5 мөр чангаар хэллээ.",
    "scene.lines:6": "Та 6 мөр чангаар хэллээ.",
    "scene.lines:7": "Та 7 мөр чангаар хэллээ.",
    "scene.lines:8": "Та 8 мөр чангаар хэллээ.",
    "scene.lines:9": "Та 9 мөр чангаар хэллээ.",
    "scene.lines:10": "Та 10 мөр чангаар хэллээ.",
    "scene.step:take2:done": "Та «Дахин нэг удаа» дасгалыг ч хийж үзлээ.",
    "scene.step:take2:wait": "«Дахин нэг удаа» дасгалыг хийхийг тань хүлээж байя. Хийвэл нэг суудлын гэрэл асна.",
    "scene.step:transfer:done": "Та «Шинэ үг хэллэг» дасгалыг хүртэл хийж үзлээ.",
    "scene.step:transfer:wait": "Таны «Шинэ үг хэллэг»-ийг ч сонсмоор байна.",
  }),
});

const own = (object, key) => (typeof key === 'string' && Object.hasOwn(object, key) ? object[key] : undefined);
const plain = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const keyOf = why => {
  const slots = why?.slots;
  if (!plain(slots)) return null;
  const names = Object.keys(slots).sort().join(',');
  if (why.code === 'scene.lines' && names === 'n' && Number.isSafeInteger(slots.n)) return `scene.lines:${slots.n}`;
  if (why.code === 'scene.step' && names === 'state,step' && typeof slots.step === 'string' && typeof slots.state === 'string')
    return `scene.step:${slots.step}:${slots.state}`;
  return null;
};

// why = { code, slots } → 팬 한마디 | null. 모르는 언어 · 칸이면 null이다(다른 언어로 물러서지 않는다).
export function fanLine(lang, why) {
  const table = own(FAN_LINES, lang);
  const key = table ? keyOf(why) : null;
  return key ? (own(table, key) ?? null) : null;
}
