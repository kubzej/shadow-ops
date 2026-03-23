/**
 * Mulberry32 — fast, seedable 32-bit PRNG.
 * Returns a function that produces values in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

/** Seed from current timestamp + entropy. */
export function createRng(): () => number {
  return mulberry32((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0)
}

/** Pick a random element from an array using the given RNG. */
export function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** Pick N unique random elements from an array. */
export function pickRandomN<T>(arr: T[], n: number, rng: () => number): T[] {
  const copy = [...arr]
  const result: T[] = []
  const count = Math.min(n, copy.length)
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * (copy.length - i))
    result.push(copy[idx])
    copy[idx] = copy[copy.length - 1 - i]
  }
  return result
}

/** Random integer in [min, max] inclusive. */
export function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

/** Random float in [min, max). */
export function randFloat(min: number, max: number, rng: () => number): number {
  return rng() * (max - min) + min
}

/** Clamp a value between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Weighted random pick: weights[] must parallel arr[]. */
export function pickWeighted<T>(arr: T[], weights: number[], rng: () => number): T {
  const total = weights.reduce((s, w) => s + w, 0)
  let r = rng() * total
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i]
    if (r <= 0) return arr[i]
  }
  return arr[arr.length - 1]
}

/** Generate a short random id (8 hex chars). */
export function randomId(): string {
  return (
    Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0') +
    Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')
  )
}
