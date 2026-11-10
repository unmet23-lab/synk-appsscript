// SYNK Atlas 입구의 ES 모듈 겉 — 판과 무관해 바뀌지 않는다. 판 이름은 loader.js의 한 줄에만 있다.
// 쓰는 법: import { coach } from '/atlas/loader.mjs'; const c = coach(options); await c.ready;
import './loader.js';

export const SynkAtlas = globalThis.SynkAtlas;
export const coach = (options, settings) => SynkAtlas.coach(options, settings);
export default SynkAtlas;
