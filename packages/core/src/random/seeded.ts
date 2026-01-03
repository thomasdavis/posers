/**
 * Seeded pseudo-random number generator for deterministic motion.
 * Uses a simple but effective xorshift128+ algorithm.
 */
export class SeededRandom {
  private s0: number
  private s1: number

  /**
   * Create a new seeded RNG.
   * @param seed - Integer seed value
   */
  constructor(seed: number) {
    // Initialize state from seed using splitmix64-like initialization
    let s = seed >>> 0
    s = (s + 0x9e3779b9) >>> 0
    s = ((s ^ (s >>> 16)) * 0x85ebca6b) >>> 0
    s = ((s ^ (s >>> 13)) * 0xc2b2ae35) >>> 0
    this.s0 = (s ^ (s >>> 16)) >>> 0

    s = (seed + 0x9e3779b9 * 2) >>> 0
    s = ((s ^ (s >>> 16)) * 0x85ebca6b) >>> 0
    s = ((s ^ (s >>> 13)) * 0xc2b2ae35) >>> 0
    this.s1 = (s ^ (s >>> 16)) >>> 0

    // Warm up the generator
    for (let i = 0; i < 10; i++) {
      this.next()
    }
  }

  /**
   * Get the next random number in [0, 1).
   */
  next(): number {
    let s1 = this.s0
    const s0 = this.s1
    this.s0 = s0
    s1 ^= s1 << 23
    s1 ^= s1 >>> 17
    s1 ^= s0
    s1 ^= s0 >>> 26
    this.s1 = s1
    return ((this.s0 + this.s1) >>> 0) / 0x100000000
  }

  /**
   * Get a random number in a range [min, max).
   */
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /**
   * Get a random integer in range [min, max] (inclusive).
   */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  /**
   * Random boolean with optional probability of true.
   */
  bool(probability = 0.5): boolean {
    return this.next() < probability
  }

  /**
   * Pick a random element from an array.
   */
  pick<T>(array: T[]): T {
    return array[this.int(0, array.length - 1)]
  }

  /**
   * Gaussian (normal) distribution using Box-Muller transform.
   * @param mean - Mean of distribution (default 0)
   * @param stdDev - Standard deviation (default 1)
   */
  gaussian(mean = 0, stdDev = 1): number {
    const u1 = this.next()
    const u2 = this.next()
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return z0 * stdDev + mean
  }
}

/**
 * Create a seeded random instance.
 */
export function createRandom(seed: number): SeededRandom {
  return new SeededRandom(seed)
}

/**
 * Hash a string to a seed number.
 */
export function hashSeed(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash >>> 0
  }
  return hash
}
