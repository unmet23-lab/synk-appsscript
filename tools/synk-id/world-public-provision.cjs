#!/usr/bin/env node
'use strict';
// Product identity only. Shared implementation preserves journal and no-retry guards.
const { createWorldPublicProvision, LOCAL_CALLBACK, LEARNING_URL } = require('./world-public-provision-core.cjs');
const CALLBACK = "https://synk.im/account/client.html?product=world";
const { provision: provisionWorldPublic, parseArgs, main } = createWorldPublicProvision({
  callback: CALLBACK, journalKey: "publicWorld", registrationName: "world-public-callback", outputPrefix: "world-public-"
});
module.exports = { provisionWorldPublic, CALLBACK, LOCAL_CALLBACK, LEARNING_URL, parseArgs };
if (require.main === module) main().catch(error => { console.error(error.code === 'EEXIST' ? 'WORLD_PUBLIC_OTHER_PROVISIONER_LOCKED' : error.message); process.exitCode = 1; });
