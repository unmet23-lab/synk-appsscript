import { emptyState, importBackup } from './model.mjs';
import { createDocumentSync } from '../synk-account/src/document-sync.mjs';

export function createCareSync(options) {
  if (typeof options?.transport !== 'function') throw new TypeError('transport must be a function');
  const transport = (action, body) => options.transport(action, action === 'careSave' ? { ...body, messageLibraryVersion: 1, checkinPreferenceVersion: 1 } : body);
  const requiresConflictReview = (local, remote) => {
    const localPeople = new Map(local.people.map(person => [person.id, person]));
    return remote.people.some(person => ['messageLibrary', 'checkinIntervalDays'].some(field => Object.hasOwn(person, field) && !Object.hasOwn(localPeople.get(person.id) ?? {}, field)));
  };
  return createDocumentSync({ ...options, transport, emptyState, validateState: importBackup, requiresConflictReview, scope: 'synk-care', cachePrefix: 'synk.care.account.v1.' });
}
