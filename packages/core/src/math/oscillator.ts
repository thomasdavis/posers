/**
 * Oscillator functions for rhythmic motion.
 */

/**
 * Basic sine oscillator.
 * @param t - Time in seconds
 * @param freq - Frequency in Hz (cycles per second)
 * @param phase - Phase offset in radians (default 0)
 * @param amp - Amplitude (default 1)
 * @returns Value oscillating between -amp and +amp
 */
export function osc(t: number, freq: number, phase = 0, amp = 1): number {
  return amp * Math.sin(2 * Math.PI * freq * t + phase)
}

/**
 * Cosine oscillator (same as osc but phase-shifted by PI/2).
 */
export function oscCos(t: number, freq: number, phase = 0, amp = 1): number {
  return amp * Math.cos(2 * Math.PI * freq * t + phase)
}

/**
 * Oscillator that returns values between 0 and 1 (unipolar).
 */
export function oscUnipolar(t: number, freq: number, phase = 0): number {
  return 0.5 + 0.5 * Math.sin(2 * Math.PI * freq * t + phase)
}

/**
 * Square wave oscillator.
 * @returns +amp or -amp
 */
export function oscSquare(t: number, freq: number, phase = 0, amp = 1): number {
  const value = Math.sin(2 * Math.PI * freq * t + phase)
  return value >= 0 ? amp : -amp
}

/**
 * Triangle wave oscillator.
 */
export function oscTriangle(t: number, freq: number, phase = 0, amp = 1): number {
  const period = 1 / freq
  const phaseShift = phase / (2 * Math.PI) * period
  const shifted = t + phaseShift
  const wrapped = (shifted % period + period) % period
  const normalized = wrapped / period
  return amp * (1 - Math.abs(2 * normalized - 1) * 2 - 1 + 1)
}

/**
 * Sawtooth wave oscillator.
 */
export function oscSawtooth(t: number, freq: number, phase = 0, amp = 1): number {
  const period = 1 / freq
  const phaseShift = phase / (2 * Math.PI) * period
  const shifted = t + phaseShift
  const wrapped = (shifted % period + period) % period
  const normalized = wrapped / period
  return amp * (2 * normalized - 1)
}

/**
 * Breathing pattern - a smooth, natural-feeling oscillation.
 * Good for idle animations.
 */
export function oscBreathing(t: number, freq: number, amp = 1): number {
  // Combine multiple sine waves for a more organic feel
  const primary = Math.sin(2 * Math.PI * freq * t)
  const secondary = 0.15 * Math.sin(4 * Math.PI * freq * t)
  return amp * (primary + secondary) / 1.15
}

/**
 * Walk cycle phase - returns 0-1 for each step.
 * @param t - Time in seconds
 * @param stepsPerSecond - Walking cadence
 * @returns Phase from 0 to 1 for current step
 */
export function walkPhase(t: number, stepsPerSecond: number): number {
  const period = 1 / stepsPerSecond
  return (t % period) / period
}

/**
 * Alternating value for left/right during walk.
 * @returns -1 for left phase, +1 for right phase
 */
export function walkSide(t: number, stepsPerSecond: number): number {
  const fullCycle = 2 / stepsPerSecond // Two steps per cycle
  const phase = (t % fullCycle) / fullCycle
  return phase < 0.5 ? -1 : 1
}
