// unit 묶음의 훅(tools/test.mjs unit이 --import로 건다): 패키지 의존을 부르는 import · require를 멈춘다.
// unit 시험은 node: 내장과 상대 경로만 쓴다 — 패키지 의존을 깔지 않은 작업본(다른 세션의 전체 시험, 루트 CI 시험)에서도 돌아야 한다.
// src/index.mjs가 단계 2에서 ts-fsrs를 부르게 되면 index를 거치는 unit 시험은 여기서 멈춘다: 그 시험은 잎 모듈(src/<모듈>/)만
// 부르게 고치거나 test/build/로 옮긴다. 건너뛰지 않는다(CI는 등록하지 않은 건너뜀을 실패로 센다).
// registerHooks는 Node 22.15부터 있다(package.json engines) — 이름으로 가져오면 옛 Node에서 아래 안내에 닿기 전에 멈추므로 통째로 가져와 본다.
import * as nodeModule from 'node:module';

const { isBuiltin, registerHooks } = nodeModule;
const LOCAL = /^(?:\.{1,2}\/|\/|file:|data:|node:|[A-Za-z]:[\\/])/;

if (typeof registerHooks !== 'function') {
  throw new Error('Atlas unit: node:module registerHooks가 없다 — Node 22.15 이상에서 돌린다');
}

registerHooks({
  resolve(specifier, context, next) {
    if (!isBuiltin(specifier) && !LOCAL.test(specifier)) {
      throw Object.assign(
        new Error(
          `Atlas unit: 패키지 의존 「${specifier}」를 부를 수 없다 — 의존이 드는 시험은 test/build/에 둔다`,
        ),
        { code: 'ATLAS_UNIT_DEPENDENCY' },
      );
    }
    return next(specifier, context);
  },
});
