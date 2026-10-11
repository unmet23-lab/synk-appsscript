'use strict';
// Process-local test injection. Neither source repository nor remote storage is modified.
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../../..'),talk=path.resolve(root,'../SYNK-talk');
const candidate=path.join(root,'.tmp/tutor-life-backend-20261012/candidate-runtime.cjs');
const digest=crypto.createHash('sha256').update(fs.readFileSync(candidate)).digest('hex');
if(digest!=='21a763975456e0c64860bece08dcdbfc1a46e6b801e630ce7d1186f80234645b')throw Error('CANDIDATE_DRIFT');
const target=require.resolve(path.join(talk,'supabase/functions/_shared/synk-play-runtime.js'));
require.cache[target]={id:target,filename:target,loaded:true,exports:require(candidate)};
globalThis.fetch=async()=>{throw Error('NETWORK_FORBIDDEN_IN_SYNTHETIC_BACKEND_TEST');};
