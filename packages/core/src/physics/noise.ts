/**
 * Noise System for Organic Movement
 *
 * Provides deterministic noise functions for adding organic micro-movements
 * to procedural animations. Uses simplex noise for smooth, natural variation.
 *
 * All functions are seeded for deterministic playback.
 */

import { createNoise2D, createNoise3D, createNoise4D } from 'simplex-noise'
import { createRandom } from '../random/seeded'

/**
 * Noise generator with seeded randomness
 */
export interface NoiseGenerator {
  /** 2D noise at (x, y) */
  noise2D(x: number, y: number): number
  /** 3D noise at (x, y, z) */
  noise3D(x: number, y: number, z: number): number
  /** 4D noise at (x, y, z, w) - useful for time-varying 3D noise */
  noise4D(x: number, y: number, z: number, w: number): number
  /** Fractal Brownian Motion (multiple octaves of noise) */
  fbm(x: number, y: number, octaves?: number, persistence?: number, lacunarity?: number): number
  /** Ridged noise (absolute value creates sharp ridges) */
  ridged(x: number, y: number, octaves?: number): number
  /** Turbulence (absolute value of FBM) */
  turbulence(x: number, y: number, octaves?: number): number
}

/**
 * Create a seeded noise generator
 *
 * @param seed Seed for deterministic noise
 */
export function createNoiseGenerator(seed: number): NoiseGenerator {
  const rng = createRandom(seed)
  // simplex-noise expects a function that returns random numbers
  const randomFn = () => rng.next()
  const noise2D = createNoise2D(randomFn)
  const noise3D = createNoise3D(randomFn)
  const noise4D = createNoise4D(randomFn)

  return {
    noise2D,
    noise3D,
    noise4D,

    fbm(x: number, y: number, octaves = 4, persistence = 0.5, lacunarity = 2): number {
      let total = 0
      let amplitude = 1
      let frequency = 1
      let maxValue = 0

      for (let i = 0; i < octaves; i++) {
        total += noise2D(x * frequency, y * frequency) * amplitude
        maxValue += amplitude
        amplitude *= persistence
        frequency *= lacunarity
      }

      return total / maxValue
    },

    ridged(x: number, y: number, octaves = 4): number {
      let total = 0
      let amplitude = 1
      let frequency = 1
      let maxValue = 0

      for (let i = 0; i < octaves; i++) {
        // Absolute value creates ridges
        total += (1 - Math.abs(noise2D(x * frequency, y * frequency))) * amplitude
        maxValue += amplitude
        amplitude *= 0.5
        frequency *= 2
      }

      return total / maxValue
    },

    turbulence(x: number, y: number, octaves = 4): number {
      let total = 0
      let amplitude = 1
      let frequency = 1
      let maxValue = 0

      for (let i = 0; i < octaves; i++) {
        total += Math.abs(noise2D(x * frequency, y * frequency)) * amplitude
        maxValue += amplitude
        amplitude *= 0.5
        frequency *= 2
      }

      return total / maxValue
    }
  }
}

/**
 * Micro-movement generator for adding life to static poses
 *
 * Creates subtle, organic variations that make characters feel alive.
 */
export interface MicroMovement {
  /** Get micro-rotation for a bone at time t */
  getBoneNoise(boneIndex: number, t: number, amplitude: number): { x: number; y: number; z: number }
  /** Get breathing-like oscillation */
  getBreathNoise(t: number, rate: number): number
  /** Get weight-shift noise */
  getWeightShift(t: number): { x: number; z: number }
  /** Get eye micro-movement */
  getEyeNoise(t: number): { x: number; y: number }
}

/**
 * Create a micro-movement generator for organic animation
 *
 * @param seed Seed for deterministic noise
 */
export function createMicroMovement(seed: number): MicroMovement {
  const noise = createNoiseGenerator(seed)

  return {
    getBoneNoise(boneIndex: number, t: number, amplitude: number) {
      // Use different noise offsets for each axis and bone
      const boneOffset = boneIndex * 100
      const speed = 0.5 // Slow micro-movements

      return {
        x: noise.noise2D(t * speed, boneOffset) * amplitude,
        y: noise.noise2D(t * speed, boneOffset + 33) * amplitude,
        z: noise.noise2D(t * speed, boneOffset + 66) * amplitude
      }
    },

    getBreathNoise(t: number, rate: number) {
      // Breathing has a base sine wave with noise modulation
      const baseBreath = Math.sin(t * rate * Math.PI * 2)
      const noiseModulation = noise.noise2D(t * 0.3, 0) * 0.1
      return baseBreath * (1 + noiseModulation)
    },

    getWeightShift(t: number) {
      // Slow, subtle weight shifts
      return {
        x: noise.fbm(t * 0.1, 0, 3) * 0.02,
        z: noise.fbm(t * 0.1, 100, 3) * 0.01
      }
    },

    getEyeNoise(t: number) {
      // Fast, small eye movements (saccades)
      const slowDrift = {
        x: noise.noise2D(t * 0.2, 0) * 0.02,
        y: noise.noise2D(t * 0.2, 50) * 0.015
      }

      // Occasional quick movements
      const saccadeChance = noise.noise2D(t * 2, 100)
      if (saccadeChance > 0.95) {
        return {
          x: slowDrift.x + noise.noise2D(t * 5, 200) * 0.05,
          y: slowDrift.y + noise.noise2D(t * 5, 250) * 0.04
        }
      }

      return slowDrift
    }
  }
}

/**
 * Layered noise for complex organic motion
 *
 * Combines multiple noise sources at different frequencies
 * to create rich, natural-feeling movement.
 */
export function layeredNoise(
  noise: NoiseGenerator,
  t: number,
  offset: number,
  layers: Array<{ frequency: number; amplitude: number }>
): number {
  let total = 0
  for (const layer of layers) {
    total += noise.noise2D(t * layer.frequency, offset) * layer.amplitude
  }
  return total
}

/**
 * Noise presets for common use cases
 */
export const NoisePresets = {
  /** Subtle micro-movement layers */
  microMovement: [
    { frequency: 0.5, amplitude: 0.3 },
    { frequency: 1.2, amplitude: 0.15 },
    { frequency: 2.5, amplitude: 0.05 }
  ],
  /** Breathing modulation */
  breathing: [
    { frequency: 0.15, amplitude: 0.8 },
    { frequency: 0.4, amplitude: 0.15 },
    { frequency: 0.8, amplitude: 0.05 }
  ],
  /** Nervous jitter */
  nervous: [
    { frequency: 3, amplitude: 0.4 },
    { frequency: 7, amplitude: 0.2 },
    { frequency: 12, amplitude: 0.1 }
  ],
  /** Slow drift */
  drift: [
    { frequency: 0.05, amplitude: 0.6 },
    { frequency: 0.12, amplitude: 0.3 },
    { frequency: 0.25, amplitude: 0.1 }
  ]
} as const
