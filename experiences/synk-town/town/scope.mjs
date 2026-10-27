/** Which access each town command needs (vertical slice design §20-7 ③, bridge design §5-3). The
 * same lists live in SYNK-talk lib/town-scope.js, which the account service checks before a command
 * runs; this copy is what the town's own code and tests read, and talk's test compares the two.
 *   rights         the person's own rights over what the town keeps: take something out of a
 *                  resident's memory, remove a response, "I only did that then", clear what was
 *                  seen, clear all personalisation, the evaluation consent, filling spots at the
 *                  time the player usually comes (off empties that record, W6). Any active account's
 *                  own records — no entry check, trial or subscription (§20-5, G12).
 *   base           walking, greetings, the notebook and its settings, feedback and suggestion menus,
 *                  closing a scene — the widest scope inside the town: entry passed and trial or
 *                  subscription; it stays open after the first chapter or a subscription ends.
 *   first-chapter  the first chapter's scenes — open on a trial too.
 *   subscription   everything else; a command missing from the lists closes here, so a new paid
 *                  scene never opens on a trial by mistake.
 */
import { ACTIVITY_COMMANDS } from './activities/index.mjs';

export const SCOPES = Object.freeze(['rights', 'base', 'first-chapter', 'subscription']);
// W8: each life activity names its commands' scopes (town/activities — the tea order's TEA_OPEN · TEA_SERVE · TEA_OWNER
// are the first chapter's, TEA_CLOSE is base: closing is always open). talk lib/town-scope.js lists them by name.
const activityIn = scope => Object.entries(ACTIVITY_COMMANDS).filter(([, s]) => s === scope).map(([type]) => type);
// W6 (design review F7): turning the time the player usually comes off empties that record — the person's own right, so rights.
export const RIGHTS = Object.freeze(new Set(['MEMORY_FORGET', 'FEEDBACK_REMOVE', 'OBSERVED_CORRECT', 'SEEN_CLEAR', 'MEMORY_CLEAR', 'EVAL_CONSENT', 'PREF_VISIT_BANDS']));
export const BASE = Object.freeze(new Set([
  'ACK', 'RESET', 'VISIT', 'LEAVE', 'SIT', 'REARRANGE', 'REMOVE', 'SIGN_REMOVE',
  'DAY_MOVE', 'DAY_WALK', 'DAY_WALK_ENABLE', 'DAY_WALK_DISABLE', 'DAY_EXIT', 'DAY_REST', 'DAY_WAKE', 'DAY_OBSERVED', 'DAY_CLOSE',
  'DAY_HOME_PREVIEW', 'DAY_HOME_CONFIRM', 'DAY_HOME_CANCEL', 'DAY_HOME_STAY',
  'LIFE_ACK', 'LIFE_CLOSE', 'LIFE_PREFERENCE', 'LIFE_DECLINE', 'LIFE_DEFER', 'LIFE_REST',
  'BAZAAR_OBSERVED', 'BAZAAR_CLOSE', 'BAZAAR_CANCEL',
  'SUPPORT_CLOSE', 'SUPPORT_SET', 'SUPPORT_CLEAR',
  // §20-3 feedback and suggestion menus, the notebook's settings.
  'FEEDBACK_GIVE', 'PREF_LESS_OFTEN', 'PREF_TODAY_OTHER', 'PREF_APPROACH', 'PREF_FAMILY',
  // W5: closing a card with the player, declining or putting off its offer, a greeting (§20-7 ③, review F5).
  'CARD_CLOSE', 'CARD_DECLINE', 'CARD_DEFER', 'GREET',
  // W6: closing the mascot's question unanswered (§20-3).
  'ASK_CLOSE',
  ...activityIn('base'),
]));
export const FIRST_CHAPTER = Object.freeze(new Set([
  'CHOOSE', 'NEXT', 'COLOR', 'CRAFT', 'PREVIEW_SLOT', 'PLACE', 'CANCEL', 'SIGN_START', 'SIGN_NEXT', 'SIGN_PICTURE', 'SIGN_PREVIEW', 'SIGN_PLACE', 'SIGN_CANCEL',
  'DAY_START', 'DAY_RESUME', 'DAY_RETRY', 'DAY_CHOICE', 'DAY_CONFIRM', 'DAY_CONTINUE', 'DAY_GUIDE_NEXT', 'DAY_HELP_DIRECTION', 'DAY_HELP_FINISH',
  'DAY_INTERACT', 'DAY_JOB_COLLECT', 'DAY_JOB_START', 'DAY_PICTURE_NEXT', 'DAY_ROLE', 'DAY_SUPPORT', 'DAY_TEA_NEXT',
  'LIFE_OPEN', 'LIFE_RESUME', 'LIFE_CONFIRM', 'LIFE_DIRECTION', 'LIFE_ROLE',
  'BAZAAR_START', 'BAZAAR_RESUME', 'BAZAAR_ASK', 'BAZAAR_CHOICE', 'BAZAAR_CONFIRM', 'BAZAAR_CONTINUE', 'BAZAAR_MATCH', 'BAZAAR_OWNER_TAKE', 'BAZAAR_ROLE', 'BAZAAR_TEA_NEXT',
  'SUPPORT_OPEN', 'SUPPORT_HINT', 'SUPPORT_ANSWER', 'SUPPORT_NEXT', 'SUPPORT_ACCEPT',
  // W5: a small need card with the player — the first chapter's (§20-7 ③ 카드 「나와 함께」, review F5).
  'CARD_OPEN', 'CARD_CHOOSE', 'CARD_CONFIRM',
  ...activityIn('first-chapter'),
]));
export const commandScope = type => RIGHTS.has(type) ? 'rights' : BASE.has(type) ? 'base' : FIRST_CHAPTER.has(type) ? 'first-chapter' : 'subscription';
