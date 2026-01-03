import type { Vector3 } from 'three'
import type { z } from 'zod'
import type { HumanoidRig } from './rig'

/**
 * Metadata for a motion program.
 */
export interface MotionMeta {
  /** Unique identifier for the motion */
  id: string
  /** Human-readable name */
  name: string
  /** Optional description */
  description?: string
  /** Tags for categorization */
  tags?: string[]
  /** Author information */
  author?: string
}

/**
 * Context passed to motion programs each frame.
 */
export interface MotionContext {
  /** User-defined parameters */
  params: Record<string, unknown>
  /** Target information (e.g., look-at, reach) */
  target: {
    lookAt?: Vector3
    reachLeft?: Vector3
    reachRight?: Vector3
  }
  /** Runtime state (can be mutated by motion) */
  state: Record<string, unknown>
  /** Seed for deterministic randomness */
  seed: number
}

/**
 * A motion program that generates skeletal animation procedurally.
 */
export interface MotionProgram<TParams = Record<string, unknown>> {
  /** Motion metadata */
  meta: MotionMeta
  /** Zod schema for validating parameters */
  paramsSchema: z.ZodType<TParams, z.ZodTypeDef, unknown>
  /** Optional initialization (called once when motion starts) */
  init?(rig: HumanoidRig, ctx: MotionContext): void
  /** Called every frame to update the rig */
  update(rig: HumanoidRig, ctx: MotionContext, t: number, dt: number): void
  /** Optional cleanup */
  dispose?(): void
}

/**
 * Factory function type for creating motion programs.
 */
export type MotionFactory<TParams = Record<string, unknown>> = (
  params: TParams
) => MotionProgram<TParams>
