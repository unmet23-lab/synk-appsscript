'use strict';
const path = require('node:path');
const source = process.env.SYNK_PREVIEW_SERVER || path.resolve(__dirname, '../../server.cjs');
const { server } = require(source).createExperienceServer({ root: path.resolve(__dirname, '../..') });
server.listen(Number(process.env.PULSE_PREVIEW_PORT || 4419), '127.0.0.1');
