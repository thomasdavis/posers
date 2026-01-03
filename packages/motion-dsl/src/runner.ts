import type { MotionProgram, MotionContext, HumanoidRig } from '@posers/core'
import { DeterministicClock } from '@posers/core'
import { createMotionContext } from './context'

/**
 * Options for the motion runner.
 */
export interface MotionRunnerOptions {
  /** Initial parameters for the motion */
  params?: Record<string, unknown>
  /** Seed for deterministic randomness */
  seed?: number
}

/**
 * Runs motion programs on a rig.
 */
export class MotionRunner {
  private rig: HumanoidRig
  private motion: MotionProgram | null = null
  private context: MotionContext
  private clock: DeterministicClock
  private initialized = false

  constructor(rig: HumanoidRig, options: MotionRunnerOptions = {}) {
    this.rig = rig
    this.context = createMotionContext({
      params: options.params,
      seed: options.seed,
    })
    this.clock = new DeterministicClock()
  }

  /**
   * Set the current motion program.
   */
  setMotion(motion: MotionProgram): void {
    // Dispose previous motion
    if (this.motion?.dispose) {
      this.motion.dispose()
    }

    this.motion = motion
    this.initialized = false
    this.clock.reset()

    // Update params from motion's default schema if available
    try {
      const defaultParams = motion.paramsSchema.parse({})
      this.context.params = { ...defaultParams, ...this.context.params }
    } catch {
      // Schema may require params, that's fine
    }
  }

  /**
   * Update motion parameters.
   */
  setParams(params: Record<string, unknown>): void {
    this.context.params = { ...this.context.params, ...params }
  }

  /**
   * Get current motion parameters.
   */
  getParams(): Record<string, unknown> {
    return { ...this.context.params }
  }

  /**
   * Get the clock for playback control.
   */
  getClock(): DeterministicClock {
    return this.clock
  }

  /**
   * Get current time.
   */
  getTime(): number {
    return this.clock.time
  }

  /**
   * Update the motion runner. Call this each frame.
   * @param deltaTime - Optional delta time in seconds. If not provided, uses real time.
   */
  update(deltaTime?: number): void {
    if (!this.motion) return

    // Initialize if needed
    if (!this.initialized) {
      if (this.motion.init) {
        this.motion.init(this.rig, this.context)
      }
      this.initialized = true
    }

    const dt = this.clock.update(deltaTime)
    const t = this.clock.time

    // Run motion update
    this.motion.update(this.rig, this.context, t, dt)
  }

  /**
   * Manually advance by a fixed time step (for deterministic testing).
   */
  advance(dt: number): void {
    if (!this.motion) return

    // Initialize if needed
    if (!this.initialized) {
      if (this.motion.init) {
        this.motion.init(this.rig, this.context)
      }
      this.initialized = true
    }

    const actualDt = this.clock.advance(dt)
    const t = this.clock.time

    this.motion.update(this.rig, this.context, t, actualDt)
  }

  /**
   * Reset the runner to initial state.
   */
  reset(): void {
    this.clock.reset()
    this.initialized = false
    this.context.state = {}
    this.rig.resetToRestPose()
  }

  /**
   * Get the current motion.
   */
  getMotion(): MotionProgram | null {
    return this.motion
  }

  /**
   * Dispose the runner and current motion.
   */
  dispose(): void {
    if (this.motion?.dispose) {
      this.motion.dispose()
    }
    this.motion = null
    this.initialized = false
  }
}
