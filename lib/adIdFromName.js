import { createHash } from 'crypto';
import normalizeName from './normalizeName.js';
/**
 * Derive a deterministic ad_id from an ad name.
 * - Normalizes the name (lowercase, trimmed, collapse spaces, remove diacritics)
 * - SHA1 hashes the normalized name and prefixes with "H_".
 *
 * @param adName Raw ad name string
 * @returns A stable identifier like "H_<sha1>" (42 chars max)
 */
export function adIdFromName(adName) {
    const nameNorm = normalizeName(adName);
    const sha1Hex = createHash('sha1').update(nameNorm).digest('hex');
    return `H_${sha1Hex}`;
}
export default adIdFromName;
