/**
 * Curve functions for animation easing and oscillation.
 */

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Linear interpolation.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Inverse lerp - find t given value between a and b.
 */
export function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) return 0
  return (value - a) / (b - a)
}

/**
 * Remap a value from one range to another.
 */
export function remap(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = inverseLerp(inMin, inMax, value)
  return lerp(outMin, outMax, t)
}

/**
 * Smooth step (Hermite interpolation).
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * Smoother step (Ken Perlin's improved version).
 */
export function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/**
 * Triangle wave (0 to 1 and back, period = 1).
 */
export function triangle(t: number): number {
  const wrapped = t - Math.floor(t)
  return 1 - Math.abs(2 * wrapped - 1)
}

/**
 * Pulse/step function - returns 1 when t is in [start, end), 0 otherwise.
 */
export function pulse(t: number, start: number, end: number): number {
  return t >= start && t < end ? 1 : 0
}

/**
 * Sawtooth wave (0 to 1, period = 1).
 */
export function sawtooth(t: number): number {
  return t - Math.floor(t)
}

/**
 * Ease in (quadratic).
 */
export function easeIn(t: number): number {
  return t * t
}

/**
 * Ease out (quadratic).
 */
export function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

/**
 * Ease in-out (quadratic).
 */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

/**
 * Bounce easing (for cartoon-like motion).
 */
export function bounce(t: number): number {
  const n1 = 7.5625
  const d1 = 2.75

  if (t < 1 / d1) {
    return n1 * t * t
  } else if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75
  } else if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375
  } else {
    return n1 * (t -= 2.625 / d1) * t + 0.984375
  }
}

/**
 * Elastic easing (spring-like overshoot).
 */
export function elastic(t: number, amplitude = 1, period = 0.3): number {
  if (t === 0 || t === 1) return t
  const s = period / (2 * Math.PI) * Math.asin(1 / amplitude)
  return amplitude * Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / period) + 1
}
