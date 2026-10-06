import { archive, parseArchive, MAX_IMPORT_BYTES } from './domain.mjs';
export const STORAGE_KEY = 'synk-rehearsal-v1';

export function loadSaved(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? { enabled: true, sessions: parseArchive(raw).sessions, error: '' } : { enabled: false, sessions: [], error: '' };
  } catch { return { enabled: false, sessions: [], error: '기기에 저장된 기록을 읽지 못했어요. 새 연습은 저장 없이 진행할 수 있어요.' }; }
}

export function saveSessions(storage, sessions) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(archive(sessions))); return { ok: true }; }
  catch { return { ok: false, error: '기기에 저장하지 못했어요. 기록은 현재 화면에 남아 있어요. JSON으로 내보내 보세요.' }; }
}

export function removeSaved(storage) {
  try { storage.removeItem(STORAGE_KEY); return { ok: true }; }
  catch { return { ok: false, error: '기기 기록을 지우지 못했어요. 브라우저의 사이트 데이터 설정에서 이 주소의 데이터를 삭제해 주세요.' }; }
}

// File reads can finish after a person has started another exercise. A route
// change or newer selection invalidates the old operation before it can commit.
export function createImportController() {
  let generation = 0;
  return {
    invalidate() { generation += 1; },
    async read(file) {
      const operation = ++generation;
      try {
        if (file.size > MAX_IMPORT_BYTES) throw new TypeError('파일은 500KB 이하로 선택해 주세요.');
        const text = await file.text();
        if (operation !== generation) return { status: 'cancelled' };
        return { status: 'ready', archive: parseArchive(text) };
      } catch (error) {
        if (operation !== generation) return { status: 'cancelled' };
        throw error;
      }
    },
  };
}
