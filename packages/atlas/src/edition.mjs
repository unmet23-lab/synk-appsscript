// 판 이름(설계 §9 「판 이름은 빌드가 찍는다」). 소스에서는 'dev'이고, tools/build.mjs가 esbuild define으로 판 이름을 넣는다.
// 엔진이 기록에 남기는 결정은 이 이름과 함께 남는다(설계 §2 원칙 5 · §14-1). __ATLAS_EDITION__은 빌드가 바꿔 넣는 이름이라 선언이 없다.
export const EDITION = typeof __ATLAS_EDITION__ === 'string' ? __ATLAS_EDITION__ : 'dev';
