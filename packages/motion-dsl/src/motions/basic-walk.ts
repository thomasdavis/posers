import { Quaternion, Vector3 } from 'three'
import { z } from 'zod'
import type { MotionProgram, MotionMeta, HumanoidRig, MotionContext } from '@posers/core'
import { osc, quatFromAxisAngle, smoothstep, clamp } from '@posers/core'

/**
 * Parameters for the basic walk cycle.
 */
export const basicWalkParamsSchema = z.object({
  /** Walking speed multiplier. Default: 1.0 */
  speed: z.number().min(0.1).max(3).default(1.0),
  /** Stride length multiplier. Default: 1.0 */
  strideLength: z.number().min(0.3).max(2).default(1.0),
  /** Arm swing intensity (0-1). Default: 0.7 */
  armSwing: z.number().min(0).max(1).default(0.7),
  /** Hip sway intensity (0-1). Default: 0.5 */
  hipSway: z.number().min(0).max(1).default(0.5),
  /** Spine twist intensity (0-1). Default: 0.5 */
  spineTwist: z.number().min(0).max(1).default(0.5),
})

export type BasicWalkParams = z.infer<typeof basicWalkParamsSchema>

/**
 * Metadata for the basic walk motion.
 */
export const basicWalkMeta: MotionMeta = {
  id: 'basic-walk',
  name: 'Basic Walk',
  description: 'Simple procedural walk cycle',
  tags: ['locomotion', 'walk', 'cycle'],
  author: 'posers',
}

/**
 * Input type for createBasicWalk - all params have defaults so they're optional.
 */
export type BasicWalkInput = z.input<typeof basicWalkParamsSchema>

/**
 * Create the basic walk motion.
 */
export function createBasicWalk(params: BasicWalkInput = {}): MotionProgram<BasicWalkParams> {
  const validatedParams = basicWalkParamsSchema.parse(params)

  // Walk cycle timing
  const baseStepsPerSecond = 1.8 // ~108 steps per minute (normal walking)

  return {
    meta: basicWalkMeta,
    paramsSchema: basicWalkParamsSchema,

    update(rig: HumanoidRig, ctx: MotionContext, t: number, _dt: number): void {
      const { speed, strideLength, armSwing, hipSway, spineTwist } = validatedParams

      const stepsPerSecond = baseStepsPerSecond * speed
      const cycleTime = 1 / stepsPerSecond // Time for one step
      const fullCycleTime = cycleTime * 2 // Time for complete L-R cycle

      // Phase calculations (0-1 for full cycle)
      const phase = (t % fullCycleTime) / fullCycleTime
      const leftPhase = phase // Left leg phase
      const rightPhase = (phase + 0.5) % 1 // Right leg 180° out of phase

      // Convert phase to -1 to 1 for oscillation
      const leftOsc = Math.sin(leftPhase * Math.PI * 2)
      const rightOsc = Math.sin(rightPhase * Math.PI * 2)

      // ========== LEGS ==========

      // Upper leg swing (hip flexion/extension)
      const legSwingAngle = 0.4 * strideLength // ~23 degrees max

      // Left leg
      if (rig.hasBone('leftUpperLeg')) {
        const leftHipFlex = leftOsc * legSwingAngle
        const leftHipRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, leftHipFlex)
        rig.setRotation('leftUpperLeg', leftHipRot)
      }

      if (rig.hasBone('leftLowerLeg')) {
        // Knee bends more during swing phase (leg going forward)
        const leftKneePhase = (leftPhase + 0.25) % 1 // Offset for natural timing
        const leftKneeBend = Math.max(0, Math.sin(leftKneePhase * Math.PI * 2)) * 0.6 * strideLength
        const leftKneeRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, leftKneeBend)
        rig.setRotation('leftLowerLeg', leftKneeRot)
      }

      // Right leg
      if (rig.hasBone('rightUpperLeg')) {
        const rightHipFlex = rightOsc * legSwingAngle
        const rightHipRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, rightHipFlex)
        rig.setRotation('rightUpperLeg', rightHipRot)
      }

      if (rig.hasBone('rightLowerLeg')) {
        const rightKneePhase = (rightPhase + 0.25) % 1
        const rightKneeBend = Math.max(0, Math.sin(rightKneePhase * Math.PI * 2)) * 0.6 * strideLength
        const rightKneeRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, rightKneeBend)
        rig.setRotation('rightLowerLeg', rightKneeRot)
      }

      // Foot dorsiflexion during swing
      if (rig.hasBone('leftFoot')) {
        const leftFootPhase = (leftPhase + 0.5) % 1
        const leftFootFlex = Math.sin(leftFootPhase * Math.PI * 2) * 0.15
        const leftFootRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, leftFootFlex)
        rig.setRotation('leftFoot', leftFootRot)
      }

      if (rig.hasBone('rightFoot')) {
        const rightFootPhase = (rightPhase + 0.5) % 1
        const rightFootFlex = Math.sin(rightFootPhase * Math.PI * 2) * 0.15
        const rightFootRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, rightFootFlex)
        rig.setRotation('rightFoot', rightFootRot)
      }

      // ========== HIPS ==========

      // Hip vertical oscillation (bob)
      const hipBob = Math.abs(Math.sin(phase * Math.PI * 2)) * 0.03 * strideLength
      rig.setHipsPositionOffset(new Vector3(0, -hipBob, 0))

      if (rig.hasBone('hips')) {
        // Hip lateral sway (shift weight side to side)
        const hipLateral = leftOsc * 0.04 * hipSway

        // Hip rotation (pelvis rotates with legs)
        const hipYaw = leftOsc * 0.08 * spineTwist

        // Hip tilt (drops on swing side)
        const hipTilt = leftOsc * 0.03 * hipSway

        const hipsRot = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, hipYaw)
        hipsRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, hipTilt))
        rig.setRotation('hips', hipsRot)
      }

      // ========== SPINE ==========

      // Counter-rotation of spine (opposite to hips)
      if (rig.hasBone('spine')) {
        const spineYaw = -leftOsc * 0.04 * spineTwist
        const spineRot = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, spineYaw)
        rig.setRotation('spine', spineRot)
      }

      if (rig.hasBone('chest')) {
        const chestYaw = -leftOsc * 0.03 * spineTwist
        const chestRot = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, chestYaw)
        rig.setRotation('chest', chestRot)
      }

      // ========== ARMS (counter-swing) ==========

      const armSwingAngle = 0.5 * armSwing * strideLength

      // Left arm swings opposite to left leg
      if (rig.hasBone('leftUpperArm')) {
        const leftArmSwing = -leftOsc * armSwingAngle
        const leftArmRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, leftArmSwing)
        // Slight outward rotation
        leftArmRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, 0.1))
        rig.setRotation('leftUpperArm', leftArmRot)
      }

      if (rig.hasBone('leftLowerArm')) {
        // Slight elbow bend
        const leftElbowBend = 0.3 + Math.abs(leftOsc) * 0.1 * armSwing
        const leftElbowRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, leftElbowBend)
        rig.setRotation('leftLowerArm', leftElbowRot)
      }

      // Right arm swings opposite to right leg
      if (rig.hasBone('rightUpperArm')) {
        const rightArmSwing = -rightOsc * armSwingAngle
        const rightArmRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, rightArmSwing)
        rightArmRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -0.1))
        rig.setRotation('rightUpperArm', rightArmRot)
      }

      if (rig.hasBone('rightLowerArm')) {
        const rightElbowBend = 0.3 + Math.abs(rightOsc) * 0.1 * armSwing
        const rightElbowRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, rightElbowBend)
        rig.setRotation('rightLowerArm', rightElbowRot)
      }

      // ========== HEAD ==========

      // Subtle head stabilization (counter spine movement slightly)
      if (rig.hasBone('head')) {
        const headYaw = leftOsc * 0.02 * spineTwist
        const headRot = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, headYaw)
        rig.setRotation('head', headRot)
      }

      if (rig.hasBone('neck')) {
        const neckYaw = leftOsc * 0.015 * spineTwist
        const neckRot = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, neckYaw)
        rig.setRotation('neck', neckRot)
      }
    },
  }
}

/**
 * Default basic walk motion with default parameters.
 */
export const basicWalk: MotionProgram<BasicWalkParams> = createBasicWalk({})
