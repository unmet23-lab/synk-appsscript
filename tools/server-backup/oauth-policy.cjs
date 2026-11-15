'use strict';
const DRIVE='https://www.googleapis.com/auth/drive.file';
function assertRestrictedToken(info,clientId){
 const scopes=String(info?.scope||'').split(/\s+/).filter(Boolean);
 if(!clientId||clientId.startsWith('107294490549-')||(info.aud||info.issued_to)!==clientId||scopes.length!==1||scopes[0]!==DRIVE)throw Error('SERVER_OAUTH_SCOPE_MISMATCH');
 return scopes;
}
module.exports={assertRestrictedToken};
