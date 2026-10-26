// serve.mjs가 /day-district.mjs 자리에 내주는 얇은 층. ?district=diorama일 때만 시안을 그리고,
// 그 밖에는 원래 day-district.mjs(/day-district.real.mjs)를 그대로 부른다.
import * as real from './day-district.real.mjs';
import { applyDiorama } from './look/diorama.mjs';

export const { BAKED_DISTRICTS, BAKED_SETS, WORLD_DEFAULT_DISTRICT, districtRequest } = real;

export function swapDistrict(args) {
  if (new URLSearchParams(location.search).get('district') !== 'diorama') return real.swapDistrict(args);
  return applyDiorama(args);
}
