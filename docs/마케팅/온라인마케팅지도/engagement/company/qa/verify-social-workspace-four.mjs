import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../../../..');
process.env.SYNK_SOCIAL_FOUR_QA='1';
process.env.SYNK_SOCIAL_QA_OUT=resolve(root,'docs/_ops/qa/social-workspace-four-20261013');
await import('./verify-social-workspace.mjs');
