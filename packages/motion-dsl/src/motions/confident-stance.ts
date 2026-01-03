/**
 * Confident Stance Motion
 *
 * A power pose with subtle weight distribution, commanding posture,
 * and organic micro-movements. Uses all available bones for maximum
 * realism with layered animation approach.
 *
 * Research basis:
 * - Power pose psychology (Carney et al.)
 * - Postural sway biomechanics
 * - Weight distribution patterns
 * - Breathing mechanics in standing posture
 */

import { z } from 'zod'
import type { MotionProgram, MotionMeta, HumanoidRig, MotionContext, VRMHumanBoneName } from '@posers/core'
import {
  osc,
  oscBreathing,
  quatFromAxisAngle,
  createNoiseGenerator,
  createSpring,
  Easing,
  type NoiseGenerator,
  type Spring,
} from '@posers/core'
import {
  BoneChains,
  getAvailableBones,
  applyFingerCurl,
  applyFingerSpread,
} from '../blend'

// ============================================================================
// SCHEMA & TYPES
// ============================================================================

export const confidentStanceParamsSchema = z.object({
  /** Overall intensity of the pose (0-1). Default: 0.7 */
  intensity: z.number().min(0).max(1).default(0.7),
  /** Breath rate in Hz. Default: 0.15 (slower, confident breathing) */
  breathRate: z.number().min(0.05).max(0.5).default(0.15),
  /** Amount of hip sway side-to-side (0-1). Default: 0.3 */
  swayAmount: z.number().min(0).max(1).default(0.3),
  /** Enable eye micro-movements. Default: true */
  eyeMovement: z.boolean().default(true),
  /** Enable finger movements. Default: true */
  fingerMovement: z.boolean().default(true),
  /** Weight distribution bias (-1=left, 0=center, 1=right). Default: 0.15 */
  weightBias: z.number().min(-1).max(1).default(0.15),
  /** Shoulder tension level (0=relaxed, 1=tense). Default: 0.2 */
  shoulderTension: z.number().min(0).max(1).default(0.2),
  /** Chest out amount (0-1). Default: 0.6 */
  chestOut: z.number().min(0).max(1).default(0.6),
  /** Chin up amount (0-1). Default: 0.3 */
  chinUp: z.number().min(0).max(1).default(0.3),
})

export type ConfidentStanceParams = z.infer<typeof confidentStanceParamsSchema>
export type ConfidentStanceInput = z.input<typeof confidentStanceParamsSchema>

export const confidentStanceMeta: MotionMeta = {
  id: 'confident-stance',
  name: 'Confident Stance',
  description: 'Power pose with commanding presence, subtle breathing, and organic micro-movements',
  tags: ['stance', 'confident', 'power', 'idle'],
  author: 'posers',
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

interface ConfidentStanceState {
  noise: NoiseGenerator
  weightShiftSpring: Spring
  blinkTimer: number
  blinkDuration: number
  isBlinking: boolean
  lastBlinkTime: number
}

/**
 * Initialize deterministic state with seeded random generators.
 * All noise and random elements are seeded to ensure identical
 * output for the same seed value - required for deterministic playback.
 */
function initState(seed: number): ConfidentStanceState {
  // All random elements use the seed for deterministic, reproducible motion
  return {
    noise: createNoiseGenerator(seed), // Seeded simplex noise
    weightShiftSpring: createSpring({ stiffness: 50, damping: 15 }),
    blinkTimer: 0,
    blinkDuration: 0.15,
    isBlinking: false,
    lastBlinkTime: 0,
  }
}

// ============================================================================
// MOTION IMPLEMENTATION
// ============================================================================

export function createConfidentStance(params: ConfidentStanceInput = {}): MotionProgram<ConfidentStanceParams> {
  const validatedParams = confidentStanceParamsSchema.parse(params)
  let state: ConfidentStanceState | null = null

  return {
    meta: confidentStanceMeta,
    paramsSchema: confidentStanceParamsSchema,

    init(_rig: HumanoidRig, ctx: MotionContext): void {
      state = initState(ctx.seed)
    },

    update(rig: HumanoidRig, ctx: MotionContext, t: number, dt: number): void {
      // Lazy initialization if init wasn't called
      if (!state) {
        state = initState(ctx.seed)
      }

      const {
        intensity,
        breathRate,
        swayAmount,
        eyeMovement,
        fingerMovement,
        weightBias,
        shoulderTension,
        chestOut,
        chinUp,
      } = validatedParams

      const noise = state.noise

      // ========================================
      // LAYER 1: BASE POSTURE
      // ========================================

      // Hips - slight forward tilt for confident stance
      const hipsTilt = -0.03 * intensity // Slight posterior tilt
      const hipsYaw = weightBias * 0.05 * intensity
      if (rig.hasBone('hips')) {
        const hipsRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, hipsTilt)
        hipsRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, hipsYaw))
        rig.setRotation('hips', hipsRot)
      }

      // Spine chain - tall, proud posture
      const spineExtension = 0.02 * intensity * chestOut
      if (rig.hasBone('spine')) {
        rig.setRotation('spine', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -spineExtension * 0.5))
      }
      if (rig.hasBone('chest')) {
        rig.setRotation('chest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -spineExtension))
      }
      if (rig.hasBone('upperChest')) {
        rig.setRotation('upperChest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -spineExtension * 1.2))
      }

      // Neck and head - chin slightly up
      const neckExtension = chinUp * 0.03 * intensity
      if (rig.hasBone('neck')) {
        rig.setRotation('neck', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -neckExtension * 0.5))
      }
      if (rig.hasBone('head')) {
        const headRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -neckExtension)
        rig.setRotation('head', headRot)
      }

      // Shoulders - pulled back for confident posture
      const shoulderPullBack = 0.08 * intensity * (1 - shoulderTension * 0.5)
      const shoulderDown = shoulderTension * 0.05 * intensity
      if (rig.hasBone('leftShoulder')) {
        const leftShoulderRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -shoulderDown)
        leftShoulderRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -shoulderPullBack))
        rig.setRotation('leftShoulder', leftShoulderRot)
      }
      if (rig.hasBone('rightShoulder')) {
        const rightShoulderRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, shoulderDown)
        rightShoulderRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, shoulderPullBack))
        rig.setRotation('rightShoulder', rightShoulderRot)
      }

      // Arms - relaxed at sides with slight separation
      const armAbduction = 0.12 * intensity
      const armRelax = 0.08 * intensity
      if (rig.hasBone('leftUpperArm')) {
        const leftUpperArmRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, armAbduction)
        leftUpperArmRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, armRelax))
        rig.setRotation('leftUpperArm', leftUpperArmRot)
      }
      if (rig.hasBone('rightUpperArm')) {
        const rightUpperArmRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -armAbduction)
        rightUpperArmRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, armRelax))
        rig.setRotation('rightUpperArm', rightUpperArmRot)
      }

      // Lower arms - slightly bent
      const elbowBend = 0.15 * intensity
      if (rig.hasBone('leftLowerArm')) {
        rig.setRotation('leftLowerArm', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -elbowBend))
      }
      if (rig.hasBone('rightLowerArm')) {
        rig.setRotation('rightLowerArm', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, elbowBend))
      }

      // Hands - natural rotation
      const handRotation = 0.1 * intensity
      if (rig.hasBone('leftHand')) {
        rig.setRotation('leftHand', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, handRotation))
      }
      if (rig.hasBone('rightHand')) {
        rig.setRotation('rightHand', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -handRotation))
      }

      // Legs - weight distribution
      const standingLegBend = 0.05 * intensity
      const relaxedLegBend = 0.12 * intensity
      const leftWeight = weightBias < 0 ? 1 : 1 - weightBias
      const rightWeight = weightBias > 0 ? 1 : 1 + weightBias

      if (rig.hasBone('leftUpperLeg')) {
        const leftLegRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, standingLegBend * leftWeight + relaxedLegBend * (1 - leftWeight))
        rig.setRotation('leftUpperLeg', leftLegRot)
      }
      if (rig.hasBone('rightUpperLeg')) {
        const rightLegRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, standingLegBend * rightWeight + relaxedLegBend * (1 - rightWeight))
        rig.setRotation('rightUpperLeg', rightLegRot)
      }

      // Knee slight bend for natural stance
      if (rig.hasBone('leftLowerLeg')) {
        rig.setRotation('leftLowerLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -0.08 * leftWeight))
      }
      if (rig.hasBone('rightLowerLeg')) {
        rig.setRotation('rightLowerLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -0.08 * rightWeight))
      }

      // Feet - flat with slight outward rotation
      const footOutward = 0.1 * intensity
      if (rig.hasBone('leftFoot')) {
        rig.setRotation('leftFoot', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -footOutward))
      }
      if (rig.hasBone('rightFoot')) {
        rig.setRotation('rightFoot', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, footOutward))
      }

      // ========================================
      // LAYER 2: BREATHING
      // ========================================

      const breathPhase = oscBreathing(t, breathRate, intensity)

      // Add breathing to spine
      if (rig.hasBone('chest')) {
        rig.addRotation('chest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, breathPhase * 0.015))
      }
      if (rig.hasBone('upperChest')) {
        rig.addRotation('upperChest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, breathPhase * 0.02))
      }

      // Shoulder rise with breath
      const shoulderBreath = breathPhase * 0.008
      if (rig.hasBone('leftShoulder')) {
        rig.addRotation('leftShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -shoulderBreath))
      }
      if (rig.hasBone('rightShoulder')) {
        rig.addRotation('rightShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, shoulderBreath))
      }

      // ========================================
      // LAYER 3: WEIGHT SHIFT
      // ========================================

      // Slow, subtle weight shifting
      const weightShiftTarget = noise.noise2D(t * 0.15, 0) * swayAmount * 0.5
      state.weightShiftSpring.setTarget(weightShiftTarget)
      state.weightShiftSpring.update(dt)
      const currentShift = state.weightShiftSpring.value

      // Apply weight shift to hips
      if (rig.hasBone('hips')) {
        rig.addRotation('hips', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, currentShift * 0.03))
      }

      // Counter-rotate spine
      if (rig.hasBone('spine')) {
        rig.addRotation('spine', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -currentShift * 0.015))
      }

      // ========================================
      // LAYER 4: MICRO-MOVEMENTS
      // ========================================

      // Subtle noise on all joints for organic feel
      const microIntensity = 0.003 * intensity

      // Head micro-movements
      if (rig.hasBone('head')) {
        const headNoiseX = noise.noise2D(t * 0.3, 100) * microIntensity
        const headNoiseY = noise.noise2D(t * 0.25, 200) * microIntensity
        const headNoiseZ = noise.noise2D(t * 0.2, 300) * microIntensity * 0.5
        rig.addRotation('head', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, headNoiseX))
        rig.addRotation('head', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, headNoiseY))
        rig.addRotation('head', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, headNoiseZ))
      }

      // Upper arm micro-movements
      if (rig.hasBone('leftUpperArm')) {
        const armNoiseL = noise.noise2D(t * 0.2, 400) * microIntensity
        rig.addRotation('leftUpperArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, armNoiseL))
      }
      if (rig.hasBone('rightUpperArm')) {
        const armNoiseR = noise.noise2D(t * 0.2, 500) * microIntensity
        rig.addRotation('rightUpperArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, armNoiseR))
      }

      // ========================================
      // LAYER 5: FINGERS
      // ========================================

      if (fingerMovement) {
        // Relaxed, slightly curled fingers
        const baseCurl = 0.25 + noise.noise2D(t * 0.1, 600) * 0.1

        // Left hand
        applyFingerCurl(rig, 'left', {
          thumb: baseCurl * 0.6,
          index: baseCurl,
          middle: baseCurl * 1.1,
          ring: baseCurl * 1.15,
          little: baseCurl * 1.2,
        })

        // Right hand
        applyFingerCurl(rig, 'right', {
          thumb: baseCurl * 0.6,
          index: baseCurl,
          middle: baseCurl * 1.1,
          ring: baseCurl * 1.15,
          little: baseCurl * 1.2,
        })

        // Slight finger spread
        applyFingerSpread(rig, 'left', 0.2)
        applyFingerSpread(rig, 'right', 0.2)
      }

      // ========================================
      // LAYER 6: EYES
      // ========================================

      if (eyeMovement) {
        // Slow, deliberate eye movement
        const eyeSpeed = 0.15
        const eyeX = noise.noise2D(t * eyeSpeed, 700) * 0.04 * intensity
        const eyeY = noise.noise2D(t * eyeSpeed, 800) * 0.03 * intensity

        // Blinking - deterministic intervals based on seed
        const timeSinceLastBlink = t - state.lastBlinkTime
        // Use floor of time to get stable interval calculation
        const blinkSeed = Math.floor(state.lastBlinkTime * 10)
        const blinkInterval = 3 + noise.noise2D(blinkSeed, 900) * 2
        if (timeSinceLastBlink > blinkInterval && !state.isBlinking) {
          state.isBlinking = true
          state.blinkTimer = 0
        }

        let blinkAmount = 0
        if (state.isBlinking) {
          state.blinkTimer += dt
          const blinkProgress = state.blinkTimer / state.blinkDuration
          if (blinkProgress >= 1) {
            state.isBlinking = false
            state.lastBlinkTime = t
          } else {
            // Quick close, slower open
            blinkAmount = blinkProgress < 0.3
              ? Easing.easeOutQuad(blinkProgress / 0.3)
              : Easing.easeInQuad(1 - (blinkProgress - 0.3) / 0.7)
          }
        }

        // Apply eye rotations
        if (rig.hasBone('leftEye')) {
          const leftEyeRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, eyeY - blinkAmount * 0.3)
          leftEyeRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, eyeX))
          rig.setRotation('leftEye', leftEyeRot)
        }
        if (rig.hasBone('rightEye')) {
          const rightEyeRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, eyeY - blinkAmount * 0.3)
          rightEyeRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, eyeX))
          rig.setRotation('rightEye', rightEyeRot)
        }
      }

      // ========================================
      // LAYER 7: TOES
      // ========================================

      // Toes slightly gripping for balance
      if (rig.hasBone('leftToes')) {
        rig.setRotation('leftToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.1 * leftWeight))
      }
      if (rig.hasBone('rightToes')) {
        rig.setRotation('rightToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.1 * rightWeight))
      }
    },
  }
}

export const confidentStance: MotionProgram<ConfidentStanceParams> = createConfidentStance({})
