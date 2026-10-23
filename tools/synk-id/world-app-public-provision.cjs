#!/usr/bin/env node
'use strict';
// Product identity only. Shared implementation preserves journal and no-retry guards.
const { createWorldPublicProvision, LOCAL_CALLBACK, LEARNING_URL } = require('./world-public-provision-core.cjs');
const CALLBACK = "https://synk.im/world/";
const { provision: provisionWorldAppPublic, parseArgs, main } = createWorldPublicProvision({
  callback: CALLBACK, journalKey: "publicWorldApp", registrationName: "world-app-public-callback", outputPrefix: "world-app-public-"
});
module.exports = { provisionWorldAppPublic, CALLBACK, LOCAL_CALLBACK, LEARNING_URL, parseArgs };
if (require.main === module) main().catch(error => { console.error(error.code === 'EEXIST' ? 'WORLD_PUBLIC_OTHER_PROVISIONER_LOCKED' : error.message); process.exitCode = 1; });
