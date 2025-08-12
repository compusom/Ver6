import { createHash } from 'crypto';

/**
 * Generate a deterministic synthetic ad_id when the real ID is missing.
 * The result is always a negative BIGINT computed from a 64-bit hash of
 * account, campaign, adset and ad names.
 */
export function synthAdId(
  accountName: string = '',
  campaign: string = '',
  adset: string = '',
  ad: string = ''
): bigint {
  const input = `${accountName.toLowerCase()}|${campaign.toLowerCase()}|${adset.toLowerCase()}|${ad.toLowerCase()}`;
  // Use SHA-256 and keep the first 8 bytes (64 bits)
  const hex = createHash('sha256').update(input).digest('hex').slice(0, 16);
  const positive = BigInt('0x' + hex) & ((1n << 63n) - 1n); // 63-bit positive number
  return -positive; // Always negative
}

export default { synthAdId };
