/**
 * ULID (Universally Unique Lexicographically Sortable Identifier)
 *
 * Format: 01ARZ3NDEKTSV4RRFFQ69G5FAV
 * - 26 characters, URL-safe (Crockford's base32)
 * - First 10 chars: timestamp (milliseconds since Unix epoch)
 * - Last 16 chars: randomness
 * - Lexicographically sortable by creation time
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford's base32 (excludes I, L, O, U)
const ENCODING_LEN = ENCODING.length // 32
const TIME_LEN = 10
const RANDOM_LEN = 16

/**
 * Encodes a timestamp into 10 Crockford base32 characters
 */
function encodeTime(timestamp: number): string {
  let str = ''
  let now = timestamp
  for (let i = TIME_LEN; i > 0; i--) {
    const mod = now % ENCODING_LEN
    str = ENCODING[mod] + str
    now = Math.floor(now / ENCODING_LEN)
  }
  return str
}

/**
 * Generates 16 random Crockford base32 characters
 */
function encodeRandom(): string {
  const randomBytes = new Uint8Array(RANDOM_LEN)
  crypto.getRandomValues(randomBytes)

  let str = ''
  for (let i = 0; i < RANDOM_LEN; i++) {
    str += ENCODING[randomBytes[i] % ENCODING_LEN]
  }
  return str
}

/**
 * Generates a new ULID
 *
 * @returns A 26-character ULID string
 */
export function generateUlid(): string {
  const timestamp = Date.now()
  return encodeTime(timestamp) + encodeRandom()
}

/**
 * Extracts the timestamp from a ULID
 *
 * @param ulid - A 26-character ULID string
 * @returns Unix timestamp in milliseconds
 */
export function extractTimestamp(ulid: string): number {
  if (ulid.length !== 26) {
    throw new Error('Invalid ULID: must be 26 characters')
  }

  const timeStr = ulid.slice(0, TIME_LEN).toUpperCase()
  let timestamp = 0

  for (let i = 0; i < TIME_LEN; i++) {
    const charIndex = ENCODING.indexOf(timeStr[i])
    if (charIndex === -1) {
      throw new Error(`Invalid ULID character: ${timeStr[i]}`)
    }
    timestamp = timestamp * ENCODING_LEN + charIndex
  }

  return timestamp
}

/**
 * Validates a ULID string
 *
 * @param ulid - String to validate
 * @returns true if valid ULID format
 */
export function isValidUlid(ulid: string): boolean {
  if (typeof ulid !== 'string' || ulid.length !== 26) {
    return false
  }

  const upperUlid = ulid.toUpperCase()
  for (const char of upperUlid) {
    if (!ENCODING.includes(char)) {
      return false
    }
  }

  return true
}
