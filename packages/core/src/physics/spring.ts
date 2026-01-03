/**
 * Spring Physics System
 *
 * Provides critically-damped spring dynamics for natural motion.
 * Based on the "Game Programming Gems 4" spring damper.
 *
 * Usage:
 *   const spring = createSpring({ stiffness: 300, damping: 20 })
 *   // In update loop:
 *   spring.setTarget(targetValue)
 *   spring.update(dt)
 *   const currentValue = spring.value
 */

export interface SpringConfig {
  /** Spring stiffness (higher = faster response). Default: 300 */
  stiffness: number
  /** Damping coefficient (higher = less oscillation). Default: 20 */
  damping: number
  /** Initial value. Default: 0 */
  initialValue?: number
  /** Initial velocity. Default: 0 */
  initialVelocity?: number
}

export interface Spring {
  /** Current spring value */
  value: number
  /** Current velocity */
  velocity: number
  /** Target value the spring is moving toward */
  target: number
  /** Set new target value */
  setTarget(target: number): void
  /** Update spring physics */
  update(dt: number): void
  /** Snap to target immediately */
  snap(): void
  /** Check if spring has settled (within threshold) */
  isSettled(threshold?: number): boolean
  /** Reset to initial state */
  reset(value?: number): void
}

/**
 * Create a 1D spring with critically-damped behavior
 */
export function createSpring(config: Partial<SpringConfig> = {}): Spring {
  const stiffness = config.stiffness ?? 300
  const damping = config.damping ?? 20

  let value = config.initialValue ?? 0
  let velocity = config.initialVelocity ?? 0
  let target = value

  return {
    get value() { return value },
    get velocity() { return velocity },
    get target() { return target },

    setTarget(newTarget: number) {
      target = newTarget
    },

    update(dt: number) {
      // Clamp dt to avoid instability
      const clampedDt = Math.min(dt, 0.1)

      // Spring force: F = -k * x - c * v
      // Where x = displacement from target, k = stiffness, c = damping
      const displacement = value - target
      const springForce = -stiffness * displacement
      const dampingForce = -damping * velocity
      const acceleration = springForce + dampingForce

      // Semi-implicit Euler integration
      velocity += acceleration * clampedDt
      value += velocity * clampedDt
    },

    snap() {
      value = target
      velocity = 0
    },

    isSettled(threshold = 0.001): boolean {
      return Math.abs(value - target) < threshold && Math.abs(velocity) < threshold
    },

    reset(newValue?: number) {
      value = newValue ?? config.initialValue ?? 0
      velocity = 0
      target = value
    }
  }
}

/**
 * Spring configuration presets
 */
export const SpringPresets = {
  /** Snappy, responsive spring (UI elements) */
  snappy: { stiffness: 500, damping: 30 } as SpringConfig,
  /** Smooth, natural spring (body movement) */
  smooth: { stiffness: 200, damping: 25 } as SpringConfig,
  /** Slow, heavy spring (large mass) */
  heavy: { stiffness: 100, damping: 20 } as SpringConfig,
  /** Bouncy spring (cartoon-like) */
  bouncy: { stiffness: 400, damping: 10 } as SpringConfig,
  /** Critically damped (no overshoot) */
  critical: { stiffness: 300, damping: 35 } as SpringConfig,
  /** Very slow, contemplative */
  slow: { stiffness: 50, damping: 15 } as SpringConfig,
} as const

/**
 * 3D Spring for Vector3 values
 */
export interface Spring3D {
  x: Spring
  y: Spring
  z: Spring
  setTarget(x: number, y: number, z: number): void
  update(dt: number): void
  snap(): void
  isSettled(threshold?: number): boolean
  reset(x?: number, y?: number, z?: number): void
  get value(): { x: number; y: number; z: number }
}

export function createSpring3D(config: Partial<SpringConfig> = {}): Spring3D {
  const x = createSpring(config)
  const y = createSpring(config)
  const z = createSpring(config)

  return {
    x, y, z,

    setTarget(tx: number, ty: number, tz: number) {
      x.setTarget(tx)
      y.setTarget(ty)
      z.setTarget(tz)
    },

    update(dt: number) {
      x.update(dt)
      y.update(dt)
      z.update(dt)
    },

    snap() {
      x.snap()
      y.snap()
      z.snap()
    },

    isSettled(threshold?: number): boolean {
      return x.isSettled(threshold) && y.isSettled(threshold) && z.isSettled(threshold)
    },

    reset(rx?: number, ry?: number, rz?: number) {
      x.reset(rx)
      y.reset(ry)
      z.reset(rz)
    },

    get value() {
      return { x: x.value, y: y.value, z: z.value }
    }
  }
}

/**
 * Spring-based smooth damp function (Unity-style)
 *
 * Smoothly interpolates a value toward a target with spring-like behavior.
 * Useful for one-off smoothing without maintaining spring state.
 *
 * @param current Current value
 * @param target Target value
 * @param currentVelocity Reference to current velocity (modified in place)
 * @param smoothTime Approximate time to reach target
 * @param dt Delta time
 * @param maxSpeed Optional maximum speed
 * @returns New value
 */
export function smoothDamp(
  current: number,
  target: number,
  currentVelocity: { value: number },
  smoothTime: number,
  dt: number,
  maxSpeed: number = Infinity
): number {
  // Based on Unity's SmoothDamp implementation
  const omega = 2 / Math.max(0.0001, smoothTime)
  const x = omega * dt
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)

  let change = current - target
  const originalTo = target

  // Clamp maximum speed
  const maxChange = maxSpeed * smoothTime
  change = Math.max(-maxChange, Math.min(maxChange, change))
  const newTarget = current - change

  const temp = (currentVelocity.value + omega * change) * dt
  currentVelocity.value = (currentVelocity.value - omega * temp) * exp

  let output = newTarget + (change + temp) * exp

  // Prevent overshooting
  if ((originalTo - current > 0) === (output > originalTo)) {
    output = originalTo
    currentVelocity.value = (output - originalTo) / dt
  }

  return output
}

/**
 * Exponential decay smoothing
 * Simpler than spring, good for trailing effects
 *
 * @param current Current value
 * @param target Target value
 * @param decay Decay rate (0-1, higher = faster)
 * @param dt Delta time
 */
export function expDecay(current: number, target: number, decay: number, dt: number): number {
  return target + (current - target) * Math.exp(-decay * dt * 60)
}
