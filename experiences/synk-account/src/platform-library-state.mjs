import { checkPersonalState } from './personal-state.mjs';
import { validatePlatformLibrary, PLATFORM_LIBRARY_LIMITS } from './platform-library-data.mjs';

/** The synk-personal check for the platform library: the one personal-data.mjs
 * gives the account server, without bundling the other products' validators.
 * Not in platform-library-data.mjs: the server bundle reaches that module early,
 * and an import there would renumber names across the server bundle's modules. */
export function validatePlatformLibraryState(value) { return checkPersonalState(value, PLATFORM_LIBRARY_LIMITS.maxBytes, validatePlatformLibrary); }
