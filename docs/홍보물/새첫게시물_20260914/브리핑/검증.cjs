'use strict';
require('../유호/검증.cjs').verify(__dirname).catch(e=>{console.error(e);process.exitCode=1;});
