import { Quaternion } from 'three'
import { z } from 'zod'
import type { MotionProgram, MotionMeta, HumanoidRig, MotionContext } from '@posers/core'
import { osc, oscBreathing, quatFromAxisAngle } from '@posers/core'

/**
 * Parameters for the idle breathing motion.
 */
export const idleBreatheParamsSchema = z.object({
  /** Breath rate in Hz (breaths per second). Default: ~0.2 (12 breaths/min) */
  breathRate: z.number().min(0.05).max(1).default(0.2),
  /** Intensity of the breathing motion (0-1). Default: 0.5 */
  intensity: z.number().min(0).max(1).default(0.5),
  /** Enable subtle head sway. Default: true */
  headSway: z.boolean().default(true),
  /** Enable subtle shoulder movement. Default: true */
  shoulderMovement: z.boolean().default(true),
})

export type IdleBreatheParams = z.infer<typeof idleBreatheParamsSchema>

/**
 * Metadata for the idle breathing motion.
 */
export const idleBreatheMeta: MotionMeta = {
  id: 'idle-breathe',
  name: 'Idle Breathe',
  description: 'Subtle breathing animation for idle stance',
  tags: ['idle', 'breathing', 'subtle'],
  author: 'posers',
}

/**
 * Input type for createIdleBreathe - all params have defaults so they're optional.
 */
export type IdleBreatheInput = z.input<typeof idleBreatheParamsSchema>

/**
 * Create the idle breathing motion.
 */
export function createIdleBreathe(params: IdleBreatheInput = {}): MotionProgram<IdleBreatheParams> {
  const validatedParams = idleBreatheParamsSchema.parse(params)

  return {
    meta: idleBreatheMeta,
    paramsSchema: idleBreatheParamsSchema,

    update(rig: HumanoidRig, ctx: MotionContext, t: number, _dt: number): void {
      const { breathRate, intensity, headSway, shoulderMovement } = validatedParams

      // Base arm positioning: bring arms from T-pose to relaxed at sides
      // VRM normalized bones have mirrored Z axes for left/right
      const armDownFromTpose = 1.2  // ~69° from T-pose
      if (rig.hasBone('leftUpperArm')) {
        rig.setRotation('leftUpperArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -armDownFromTpose))
      }
      if (rig.hasBone('rightUpperArm')) {
        rig.setRotation('rightUpperArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, armDownFromTpose))
      }

      // Main breathing oscillation
      const breathPhase = oscBreathing(t, breathRate, intensity)

      // Spine breathing - subtle chest expansion
      const spineBreath = breathPhase * 0.02 // Very subtle forward tilt
      if (rig.hasBone('spine')) {
        const spineRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, spineBreath)
        rig.setRotation('spine', spineRot)
      }

      // Chest breathing - slightly more pronounced
      const chestBreath = breathPhase * 0.025
      if (rig.hasBone('chest')) {
        const chestRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, chestBreath)
        rig.setRotation('chest', chestRot)
      }

      // Upper chest - most visible breathing
      const upperChestBreath = breathPhase * 0.03
      if (rig.hasBone('upperChest')) {
        const upperChestRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, upperChestBreath)
        rig.setRotation('upperChest', upperChestRot)
      }

      // Shoulders - slight rise and fall
      if (shoulderMovement) {
        const shoulderPhase = breathPhase * 0.015
        // Add subtle outward rotation on inhale
        const shoulderY = breathPhase * 0.01

        if (rig.hasBone('leftShoulder')) {
          const leftShoulderRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -shoulderPhase)
          leftShoulderRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, shoulderY))
          rig.setRotation('leftShoulder', leftShoulderRot)
        }

        if (rig.hasBone('rightShoulder')) {
          const rightShoulderRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, shoulderPhase)
          rightShoulderRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -shoulderY))
          rig.setRotation('rightShoulder', rightShoulderRot)
        }
      }

      // Head - subtle sway for life-like appearance
      if (headSway) {
        // Slow, irregular head movement using multiple frequencies
        const headYaw = osc(t, 0.07, 0, 0.015 * intensity) +
                        osc(t, 0.11, 1.2, 0.008 * intensity)
        const headPitch = osc(t, 0.05, 0.5, 0.01 * intensity) +
                          breathPhase * 0.005 // Slight nod with breath
        const headRoll = osc(t, 0.03, 2.1, 0.005 * intensity)

        if (rig.hasBone('head')) {
          const headRot = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, headYaw)
          headRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, headPitch))
          headRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, headRoll))
          rig.setRotation('head', headRot)
        }

        // Neck follows head but less
        if (rig.hasBone('neck')) {
          const neckRot = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, headYaw * 0.3)
          neckRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, headPitch * 0.3))
          rig.setRotation('neck', neckRot)
        }
      }

      // Arms - very subtle relaxed sway (additive on top of base pose)
      const armSway = osc(t, 0.08, 0, 0.01 * intensity)

      if (rig.hasBone('leftUpperArm')) {
        rig.addRotation('leftUpperArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, armSway * 0.5))
      }

      if (rig.hasBone('rightUpperArm')) {
        rig.addRotation('rightUpperArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -armSway * 0.5))
      }
    },
  }
}

/**
 * Default idle breathe motion with default parameters.
 */
export const idleBreathe: MotionProgram<IdleBreatheParams> = createIdleBreathe({})
