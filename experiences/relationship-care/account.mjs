import { importBackup } from './model.mjs';
import { createProductAccount } from '../synk-account/src/product-account.mjs';

/** 기존 SYNK ID의 플레저 전용 계약. 토큰은 공통 연결기 밖으로 내보내지 않는다. */
export function createCareAccount(options = {}) {
  return createProductAccount({ ...options, bridge: options.bridge ?? globalThis.window?.synkProduct, clientKey: 'care', endpoint: 'synk-care', scope: 'synk-care', validateState: importBackup });
}
