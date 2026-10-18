'use strict';
// Small integration fixture: it has no runtime callers or external effects.
function completedCount(receipts) {
  return receipts.filter(receipt => receipt.state === 'integrated').length;
}
module.exports = {completedCount};
