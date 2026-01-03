import type { Vector3 } from 'three'
import type { MotionContext } from '@posers/core'

/**
 * Options for creating a motion context.
 */
export interface CreateContextOptions {
  params?: Record<string, unknown>
  seed?: number
  lookAt?: Vector3
  reachLeft?: Vector3
  reachRight?: Vector3
}

/**
 * Create a new motion context.
 */
export function createMotionContext(options: CreateContextOptions = {}): MotionContext {
  return {
    params: options.params ?? {},
    target: {
      lookAt: options.lookAt,
      reachLeft: options.reachLeft,
      reachRight: options.reachRight,
    },
    state: {},
    seed: options.seed ?? 12345,
  }
}

/**
 * Clone a motion context.
 */
export function cloneContext(ctx: MotionContext): MotionContext {
  return {
    params: { ...ctx.params },
    target: { ...ctx.target },
    state: { ...ctx.state },
    seed: ctx.seed,
  }
}
