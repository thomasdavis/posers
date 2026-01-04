import { Quaternion, Vector3 } from 'three'
import { z } from 'zod'
import type { MotionProgram, MotionMeta, HumanoidRig, MotionContext } from '@posers/core'
import { osc, quatFromAxisAngle, smoothstep, clamp } from '@posers/core'

/**
 * JUMP MOTION
 * ===========
 *
 * Athletic vertical jump from standing position. Full body coordination with
 * proper biomechanical phasing through anticipation, takeoff, airborne, and landing.
 *
 * FEEL: Explosive power, brief weightlessness, controlled landing.
 * Like a basketball player going for a rebound.
 *
 * PHASE TIMING (overlapping envelopes):
 * - ANTICIPATION (0-25%): Squat down, arms swing back, weight shifts forward, inhale
 * - TAKEOFF (20-35%): Explosive extension, arms swing up, toes push off
 * - AIRBORNE (30-70%): Body fully extends, arms at peak, slight back arch
 * - LANDING (65-100%): Anticipate ground, absorb impact through legs, stabilize
 *
 * BIOMECHANICAL NOTES:
 * - Triple extension: hip, knee, ankle extend together during takeoff
 * - Arms contribute ~10% of jump height through momentum transfer
 * - Landing uses eccentric muscle contraction for shock absorption
 * - Core stabilizes throughout; spine flexes during anticipation and landing
 *
 * BONE ENGAGEMENT: All 17 required + optional shoulder, toes, fingers for full expression
 *
 * TIMING RELATIONSHIPS:
 * - Ankle extension lags hip/knee by ~20ms (distal delay)
 * - Arms lead leg extension by ~50ms (momentum generation)
 * - Spine flexion/extension follows hip with ~30ms delay
 * - Head remains relatively stable (vestibular reflex)
 *
 * RESEARCH BASIS:
 * - Vertical jump biomechanics (Bobbert & van Ingen Schenau, 1988)
 * - Arm swing contribution to vertical jump (Lees et al., 2004)
 * - Landing mechanics and injury prevention (Devita & Skelly, 1992)
 */

export const jumpParamsSchema = z.object({
  /** Jump duration in seconds. Default: 1.2 */
  duration: z.number().min(0.5).max(3).default(1.2),
  /** Jump height multiplier (affects hip offset and pose intensity). Default: 1.0 */
  height: z.number().min(0.3).max(2).default(1.0),
  /** Arm swing intensity (0-1). Default: 1.0 */
  armSwing: z.number().min(0).max(1).default(1.0),
  /** Landing absorption intensity (0-1). Default: 0.8 */
  landingAbsorption: z.number().min(0).max(1).default(0.8),
})

export type JumpParams = z.infer<typeof jumpParamsSchema>

export const jumpMeta: MotionMeta = {
  id: 'jump',
  name: 'Jump',
  description: 'Athletic vertical jump with full body coordination',
  tags: ['locomotion', 'athletic', 'jump', 'explosive'],
  author: 'posers',
}

export type JumpInput = z.input<typeof jumpParamsSchema>

/**
 * Phase envelope - creates smooth transitions between phases
 */
function phaseEnvelope(t: number, start: number, peak: number, end: number): number {
  if (t < start) return 0
  if (t > end) return 0
  if (t < peak) {
    return smoothstep(start, peak, t)
  }
  return 1 - smoothstep(peak, end, t)
}

/**
 * Create the jump motion.
 */
export function createJump(params: JumpInput = {}): MotionProgram<JumpParams> {
  const validatedParams = jumpParamsSchema.parse(params)

  return {
    meta: jumpMeta,
    paramsSchema: jumpParamsSchema,

    update(rig: HumanoidRig, ctx: MotionContext, t: number, _dt: number): void {
      const { duration, height, armSwing, landingAbsorption } = validatedParams

      // Normalize time to 0-1 within jump cycle
      const cycleT = (t % duration) / duration

      // ========== PHASE ENVELOPES (overlapping) ==========
      const anticipation = phaseEnvelope(cycleT, 0, 0.15, 0.30)    // 0-30%
      const takeoff = phaseEnvelope(cycleT, 0.18, 0.28, 0.38)      // 18-38%
      const airborne = phaseEnvelope(cycleT, 0.30, 0.50, 0.70)     // 30-70%
      const landing = phaseEnvelope(cycleT, 0.62, 0.80, 1.0)       // 62-100%

      // ========== HIP VERTICAL TRAJECTORY ==========
      // Parabolic arc during airborne phase
      let hipY = 0
      if (cycleT > 0.25 && cycleT < 0.75) {
        const airT = (cycleT - 0.25) / 0.5 // 0-1 during air time
        // Parabola: -4(t-0.5)^2 + 1 peaks at 0.5
        hipY = (-4 * Math.pow(airT - 0.5, 2) + 1) * 0.4 * height
      }
      // Squat down during anticipation and landing
      const squat = anticipation * 0.15 * height + landing * 0.2 * height * landingAbsorption
      rig.setHipsPositionOffset(new Vector3(0, hipY - squat, 0))

      // ========== HIPS ==========
      if (rig.hasBone('hips')) {
        // Forward tilt during anticipation, backward during takeoff extension
        const hipPitch = anticipation * 0.25 - takeoff * 0.15 + landing * 0.2 * landingAbsorption
        const hipsRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, hipPitch)
        rig.setRotation('hips', hipsRot)
      }

      // ========== LEGS ==========
      // Hip flexion/extension
      const legFlexion = anticipation * 0.8 + landing * 0.7 * landingAbsorption
      const legExtension = takeoff * 0.3 + airborne * 0.1

      if (rig.hasBone('leftUpperLeg')) {
        const angle = legFlexion - legExtension
        rig.setRotation('leftUpperLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, angle))
      }
      if (rig.hasBone('rightUpperLeg')) {
        const angle = legFlexion - legExtension
        rig.setRotation('rightUpperLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, angle))
      }

      // Knee flexion (squat and absorption)
      const kneeFlexion = anticipation * 1.2 + landing * 1.0 * landingAbsorption
      const kneeExtension = takeoff * 0.1 + airborne * 0.05

      if (rig.hasBone('leftLowerLeg')) {
        const angle = kneeFlexion - kneeExtension
        rig.setRotation('leftLowerLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, angle))
      }
      if (rig.hasBone('rightLowerLeg')) {
        const angle = kneeFlexion - kneeExtension
        rig.setRotation('rightLowerLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, angle))
      }

      // Ankle (dorsiflexion during squat, plantarflexion during push and air)
      const ankleDorsi = anticipation * 0.3 + landing * 0.25 * landingAbsorption
      const anklePlantar = takeoff * 0.5 + airborne * 0.4

      if (rig.hasBone('leftFoot')) {
        const angle = ankleDorsi - anklePlantar
        rig.setRotation('leftFoot', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, angle))
      }
      if (rig.hasBone('rightFoot')) {
        const angle = ankleDorsi - anklePlantar
        rig.setRotation('rightFoot', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, angle))
      }

      // Toes - grip during anticipation, point during air
      if (rig.hasBone('leftToes')) {
        const toeAngle = anticipation * 0.2 - airborne * 0.3
        rig.setRotation('leftToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, toeAngle))
      }
      if (rig.hasBone('rightToes')) {
        const toeAngle = anticipation * 0.2 - airborne * 0.3
        rig.setRotation('rightToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, toeAngle))
      }

      // ========== SPINE ==========
      // Flexes forward during anticipation and landing, extends during air
      const spineFlexion = anticipation * 0.15 + landing * 0.12 * landingAbsorption
      const spineExtension = airborne * 0.08

      if (rig.hasBone('spine')) {
        const angle = spineFlexion - spineExtension
        rig.setRotation('spine', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, angle))
      }
      if (rig.hasBone('chest')) {
        const angle = (spineFlexion - spineExtension) * 0.7
        rig.setRotation('chest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, angle))
      }
      if (rig.hasBone('upperChest')) {
        const angle = (spineFlexion - spineExtension) * 0.5
        rig.setRotation('upperChest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, angle))
      }

      // ========== ARMS ==========
      // Arms swing back during anticipation, up during takeoff/air, forward during landing
      const armsBack = anticipation * 0.8 * armSwing
      const armsUp = (takeoff * 0.6 + airborne * 1.0) * armSwing
      const armsForward = landing * 0.4 * armSwing

      // Base arm-down from T-pose: ~70° (1.2 rad)
      // Arms raise during jump but ALWAYS maintain minimum 0.5 rad (~30°) downward angle
      // This prevents arms from appearing horizontal (T-pose-like)
      const armDownBase = Math.max(0.5, 1.2 * (1 - armsUp * 0.6))

      if (rig.hasBone('leftUpperArm')) {
        // Pitch: negative = forward/up, positive = back
        const pitch = armsBack - armsUp * 0.5 - armsForward
        // Left arm: negative Z brings arm down
        const rot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -armDownBase)
        rot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, pitch))
        rig.setRotation('leftUpperArm', rot)
      }
      if (rig.hasBone('rightUpperArm')) {
        const pitch = armsBack - armsUp * 0.5 - armsForward
        // Right arm: positive Z brings arm down
        const rot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, armDownBase)
        rot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, pitch))
        rig.setRotation('rightUpperArm', rot)
      }

      // Elbows - slight bend, more during back swing
      const elbowBend = 0.3 + armsBack * 0.4 + landing * 0.2

      if (rig.hasBone('leftLowerArm')) {
        rig.setRotation('leftLowerArm', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, elbowBend))
      }
      if (rig.hasBone('rightLowerArm')) {
        rig.setRotation('rightLowerArm', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, elbowBend))
      }

      // Shoulders rise with arms
      if (rig.hasBone('leftShoulder')) {
        const shrug = armsUp * 0.1
        rig.setRotation('leftShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -shrug))
      }
      if (rig.hasBone('rightShoulder')) {
        const shrug = armsUp * 0.1
        rig.setRotation('rightShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, shrug))
      }

      // Hands - relaxed, slight tension during effort
      if (rig.hasBone('leftHand')) {
        const tension = (takeoff + landing) * 0.15
        rig.setRotation('leftHand', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, tension))
      }
      if (rig.hasBone('rightHand')) {
        const tension = (takeoff + landing) * 0.15
        rig.setRotation('rightHand', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, tension))
      }

      // ========== HEAD/NECK ==========
      // Head stays relatively stable, slight look up during jump
      if (rig.hasBone('neck')) {
        const neckExt = airborne * 0.1 - landing * 0.05
        rig.setRotation('neck', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -neckExt))
      }
      if (rig.hasBone('head')) {
        const headExt = airborne * 0.05
        rig.setRotation('head', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -headExt))
      }

      // ========== MICRO-MOVEMENTS (life layer) ==========
      const microPhase = t * 8 // Faster for effort
      const microAmp = 0.01 * (1 + takeoff * 2 + landing * 1.5) // More during effort

      if (rig.hasBone('spine')) {
        rig.addRotation('spine', quatFromAxisAngle(
          { x: 0, y: 1, z: 0 },
          Math.sin(microPhase) * microAmp
        ))
      }
    },
  }
}

/**
 * Default jump motion with default parameters.
 */
export const jump: MotionProgram<JumpParams> = createJump({})
