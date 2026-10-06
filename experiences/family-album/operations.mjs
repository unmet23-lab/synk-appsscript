// A superseded read must never reattach a file removed by the person.
export function createMediaOperations(){const versions={photo:0,audio:0};return {begin(kind){return ++versions[kind];},current(kind,version){return versions[kind]===version;},invalidate(kind){versions[kind]++;},reset(){versions.photo++;versions.audio++;}};}
// A file belongs to the selection and screen that started its asynchronous read.
export function createImportOperations(){let version=0;return {begin(screen){return {version:++version,screen};},current(operation,screen){return Boolean(operation)&&operation.version===version&&operation.screen===screen;},invalidate(){version++;}};}
export function cancelImportIfIdle({saving,event,cancel}){if(saving){event?.preventDefault();return false;}cancel();return true;}
