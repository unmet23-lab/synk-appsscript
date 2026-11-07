// 서울 하루(PATH 여행) 엔진 시험을 2026-10-07~09 확인 자료 표본으로 돌린다.
//
// 장소 자료는 30일마다 공식 안내로 다시 확인해 날짜·예외가 바뀐다. 엔진 규칙 시험은
// 그 시점의 실제 예외(궁 무료 기간·부분 휴관·한글날 등)로 짜여 있어, 자료를 새로 고칠
// 때마다 깨지지 않게 이 표본을 쓴다. 지금 자료는 tests/path-travel-live-catalog.test.mjs가
// 자료 자체의 확인일 기준으로 검사한다.
//
// 쓰는 법: 시험 파일 맨 앞에서 이 파일을 정적으로 들여온 뒤, path-travel 모듈은 모두
// 동적 import로 부른다. 정적 import는 이 고리가 등록되기 전에 해석된다.
import { registerHooks } from 'node:module';

const here = new URL('./', import.meta.url);
const DATA = /\/experiences\/path-travel\/(places-v2|real-places|real-course-data)\.mjs$/;

registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    if (!resolved.url.startsWith('file:')) return resolved;
    const match = new URL(resolved.url).pathname.match(DATA);
    return match ? { ...resolved, url: new URL(match[1] + '.mjs', here).href, shortCircuit: true } : resolved;
  },
});

export const SNAPSHOT_CHECKED_AT = '2026-10-09';
