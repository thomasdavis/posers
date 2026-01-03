/**
 * Easing Functions for Animation
 *
 * Provides bezier-based easing curves and common easing presets
 * for smooth animation transitions.
 */

import BezierEasing from 'bezier-easing'

/**
 * Easing function type
 */
export type EasingFunction = (t: number) => number

/**
 * Create a cubic bezier easing function
 *
 * @param x1 First control point X (0-1)
 * @param y1 First control point Y
 * @param x2 Second control point X (0-1)
 * @param y2 Second control point Y
 */
export function createBezierEasing(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  return BezierEasing(x1, y1, x2, y2)
}

/**
 * Common easing presets (CSS-style)
 */
export const Easing = {
  // Linear
  linear: (t: number) => t,

  // Quadratic
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  // Cubic
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  // Quartic
  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - (--t) * t * t * t,
  easeInOutQuart: (t: number) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,

  // Quintic
  easeInQuint: (t: number) => t * t * t * t * t,
  easeOutQuint: (t: number) => 1 + (--t) * t * t * t * t,
  easeInOutQuint: (t: number) => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,

  // Sine
  easeInSine: (t: number) => 1 - Math.cos(t * Math.PI / 2),
  easeOutSine: (t: number) => Math.sin(t * Math.PI / 2),
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,

  // Exponential
  easeInExpo: (t: number) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
  easeOutExpo: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo: (t: number) => {
    if (t === 0) return 0
    if (t === 1) return 1
    return t < 0.5
      ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2
  },

  // Circular
  easeInCirc: (t: number) => 1 - Math.sqrt(1 - t * t),
  easeOutCirc: (t: number) => Math.sqrt(1 - (--t) * t),
  easeInOutCirc: (t: number) => t < 0.5
    ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
    : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,

  // Elastic
  easeInElastic: (t: number) => {
    if (t === 0) return 0
    if (t === 1) return 1
    return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * (2 * Math.PI) / 3)
  },
  easeOutElastic: (t: number) => {
    if (t === 0) return 0
    if (t === 1) return 1
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1
  },
  easeInOutElastic: (t: number) => {
    if (t === 0) return 0
    if (t === 1) return 1
    return t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * (2 * Math.PI) / 4.5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * (2 * Math.PI) / 4.5)) / 2 + 1
  },

  // Back (overshoot)
  easeInBack: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return c3 * t * t * t - c1 * t * t
  },
  easeOutBack: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  easeInOutBack: (t: number) => {
    const c1 = 1.70158
    const c2 = c1 * 1.525
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2
  },

  // Bounce
  easeInBounce: (t: number) => 1 - Easing.easeOutBounce(1 - t),
  easeOutBounce: (t: number) => {
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
  },
  easeInOutBounce: (t: number) => t < 0.5
    ? (1 - Easing.easeOutBounce(1 - 2 * t)) / 2
    : (1 + Easing.easeOutBounce(2 * t - 1)) / 2,

  // CSS standard presets (bezier-based)
  ease: createBezierEasing(0.25, 0.1, 0.25, 1),
  easeIn: createBezierEasing(0.42, 0, 1, 1),
  easeOut: createBezierEasing(0, 0, 0.58, 1),
  easeInOut: createBezierEasing(0.42, 0, 0.58, 1),

  // Material Design presets
  standard: createBezierEasing(0.4, 0, 0.2, 1),
  decelerate: createBezierEasing(0, 0, 0.2, 1),
  accelerate: createBezierEasing(0.4, 0, 1, 1),
  sharp: createBezierEasing(0.4, 0, 0.6, 1),

  // Animation-specific presets
  /** Smooth arm raise (human-like) */
  armRaise: createBezierEasing(0.25, 0.46, 0.45, 0.94),
  /** Natural step movement */
  footStep: createBezierEasing(0.55, 0.085, 0.68, 0.53),
  /** Breath-like oscillation */
  breathe: createBezierEasing(0.37, 0, 0.63, 1),
  /** Quick snap with settle */
  snapSettle: createBezierEasing(0.68, -0.55, 0.265, 1.55),
  /** Slow contemplative movement */
  contemplative: createBezierEasing(0.19, 1, 0.22, 1),
  /** Seductive sway */
  sway: createBezierEasing(0.445, 0.05, 0.55, 0.95),
} as const

/**
 * Chain multiple easing functions together
 *
 * @param easings Array of {easing, duration} pairs
 * @param t Normalized time (0-1)
 */
export function chainedEasing(
  easings: Array<{ easing: EasingFunction; weight: number }>,
  t: number
): number {
  const totalWeight = easings.reduce((sum, e) => sum + e.weight, 0)
  let accumulated = 0
  let normalizedT = t * totalWeight

  for (const { easing, weight } of easings) {
    if (normalizedT <= weight) {
      const localT = normalizedT / weight
      return accumulated + easing(localT) * (weight / totalWeight)
    }
    accumulated += weight / totalWeight
    normalizedT -= weight
  }

  return 1
}

/**
 * Create a hold-at-value easing (pause at a certain point)
 *
 * @param easing Base easing function
 * @param holdStart When to start holding (0-1)
 * @param holdEnd When to end holding (0-1)
 * @param holdValue Value to hold at
 */
export function withHold(
  easing: EasingFunction,
  holdStart: number,
  holdEnd: number,
  holdValue?: number
): EasingFunction {
  return (t: number) => {
    if (t < holdStart) {
      // Remap 0-holdStart to 0-1 for first segment
      const localT = t / holdStart
      const val = easing(localT * (holdValue !== undefined ? holdValue : holdStart))
      return val
    } else if (t < holdEnd) {
      // Hold
      return holdValue !== undefined ? holdValue : easing(holdStart)
    } else {
      // Remap holdEnd-1 to holdValue-1
      const localT = (t - holdEnd) / (1 - holdEnd)
      const startVal = holdValue !== undefined ? holdValue : easing(holdStart)
      return startVal + (1 - startVal) * easing(localT)
    }
  }
}

/**
 * Blend between two easing functions
 */
export function blendEasing(
  easingA: EasingFunction,
  easingB: EasingFunction,
  blend: number
): EasingFunction {
  return (t: number) => {
    const a = easingA(t)
    const b = easingB(t)
    return a + (b - a) * blend
  }
}

/**
 * Reverse an easing function
 */
export function reverseEasing(easing: EasingFunction): EasingFunction {
  return (t: number) => 1 - easing(1 - t)
}

/**
 * Mirror an easing function (ease in becomes ease in-out)
 */
export function mirrorEasing(easing: EasingFunction): EasingFunction {
  return (t: number) => {
    if (t < 0.5) {
      return easing(t * 2) / 2
    }
    return 1 - easing((1 - t) * 2) / 2
  }
}
