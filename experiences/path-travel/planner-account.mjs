import { validateTravelMemory, createTravelMemory, TRAVEL_MAX_BYTES } from './planner-storage.mjs';

/** The existing `path` resource is PATH VR; travel always has its own contract. */
export const TRAVEL_ACCOUNT_CONTRACT = Object.freeze({ resource: 'path-travel', clientKey: 'path-travel',
  scope: 'synk-personal', endpoint: 'synk-personal', maxBytes: TRAVEL_MAX_BYTES, version: 1,
  available: true, locallyImplemented: true, productionRegistered: true,
  reason: 'SYNK ID로 여행을 보관하고 다른 기기에서 이어가세요. 로그인 없이 여행 파일로도 이어갈 수 있어요.' });

export function travelAccountDocument(deviceState, options) {
  const value = validateTravelMemory(deviceState, options);
  delete value.consent;
  return value;
}
export function travelDeviceState(accountState, { consent = false, now } = {}) {
  if (!accountState || Object.hasOwn(accountState, 'consent') || typeof consent !== 'boolean') throw new TypeError('여행 계정 기록을 확인해 주세요.');
  return validateTravelMemory({ ...accountState, consent }, { now });
}
export function emptyTravelAccountDocument(options) { return travelAccountDocument(createTravelMemory({}, options), options); }

export function validateTravelAccountDocument(value, options) {
  return travelAccountDocument(travelDeviceState(value, options), options);
}

/** Fixed product identity; a caller cannot accidentally write a trip into PATH VR. */
function travelAccountOptions(options) {
  return { ...options, clientKey: 'path-travel', resource: 'path-travel',
    scope: 'synk-personal', endpoint: 'synk-personal', validateState: validateTravelAccountDocument,
    operations: { load: 'personalLoad', save: 'personalSave', delete: 'personalDelete' } };
}
export async function createTravelAccount(options = {}) {
  const { createProductAccount } = await import('../synk-account/src/product-account.mjs');
  return createProductAccount(travelAccountOptions(options));
}

/** Shared SYNK ID UI and CAS/offline queue. Calling this does not create a client registration.
 * Guest records migrate only through the shared notebook's explicit import action.
 */
export async function createTravelAccountNotebook(options = {}) {
  const { createAccountNotebook } = await import('../synk-account/src/account-notebook.mjs');
  const { createProductAccount } = await import('../synk-account/src/product-account.mjs');
  const { validatePersonalState } = await import('../synk-account/src/personal-data.mjs');
  return createAccountNotebook({ description: '여행 조건·일정·직접 확인한 취향·방문 의견을 내 계정에 보관해요. 로그인을 누르면 로그인 전 여행과 입력을 이 탭에 30분 동안 임시 보관해요. 기기 보관 동의나 계정으로 옮기기는 별도입니다.',
    deleteLabel: '계정의 여행 기록 모두 삭제',
    deleteConfirmation: '이 계정의 여행 조건·일정·취향·방문 의견을 모두 삭제할까요? 다른 기기에서도 다시 불러올 수 없어요. 필요한 기록은 먼저 여행 파일로 내보내 주세요.',
    ...options, resource: 'path-travel', validateState: value => validatePersonalState('path-travel', value), toDocument: travelAccountDocument,
    // Notebook's second argument is a guarded transport, not device consent.
    fromDocument: document => travelDeviceState(document),
    emptyDocument: emptyTravelAccountDocument, accountFactory: settings => {
      const account = options.accountFactory ? options.accountFactory(settings) : createProductAccount(travelAccountOptions({ ...settings,
        configUrl:options.configUrl ?? './config.json',
      }));
      return { ...account, async signIn() {
        // Only explicit sign-in may retain a guest snapshot for full-page OAuth.
        // Failure to retain it stops navigation without changing the live editor.
        try {
          await options.beforeSignIn?.();
          return await account.signIn();
        } catch (error) {
          options.onSignInFailure?.();
          throw error;
        }
      } };
    } });
}

// Integration map for the dedicated travel release. Runtime configuration and
// server authorization remain necessary; a local flag alone is not connectivity.
export const TRAVEL_ACCOUNT_EXTENSION_POINTS = Object.freeze([
  { file: 'experiences/synk-account/src/core.mjs', change: 'PRODUCTS에 path-travel 표시명과 별도 OAuth client 등록' },
  { file: 'experiences/synk-account/src/product-account.mjs', change: 'clientKey allowlist에 path-travel 추가; 기존 세션 키 분리 유지' },
  { file: 'experiences/synk-account/src/personal-data.mjs', change: 'PERSONAL_LIMITS 및 validatePersonalState에 path-travel 전용 validator 추가' },
  { file: 'experiences/synk-account/server-shared.mjs', change: '여행 계약과 종속 모듈의 정확한 allowlist 추가' },
  { file: 'tools/synk-id/personal-public-provision.cjs', change: '여행 전용 OAuth callback·client 계약 등록, 기존 path 등록 재사용 금지' },
  { file: '../SYNK-talk/lib/synk-personal-server.js', change: 'PERSONAL_RESOURCES와 여행 전용 validator를 사용한 소유권·revision 검사 유지' },
  { file: '../SYNK-talk/supabase/migrations/20261007010000_synk_personal_c16.sql', change: '기존 migration 수정 대신 신규 migration으로 synk_personal_resource_c16 체크에 path-travel 추가' },
  { file: '../SYNK-talk/tools/synk-personal-build.js', change: '추가한 여행 validator를 계정 runtime에 동봉하고 합성 계정 왕복 검사 뒤 서버 배포' },
]);
