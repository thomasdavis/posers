/**
 * Nervous Fidget Motion
 *
 * Anxiety-driven motion with rapid weight shifts, self-soothing gestures,
 * and tense posture. Captures the biomechanics of nervousness and
 * displacement behavior.
 *
 * Research basis:
 * - Anxiety body language (Navarro)
 * - Self-soothing behaviors (pacifying gestures)
 * - Displacement activities in stress
 * - Hypervigilance postural patterns
 */

import { z } from 'zod'
import type { MotionProgram, MotionMeta, HumanoidRig, MotionContext, VRMHumanBoneName } from '@posers/core'
import {
  osc,
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
} from '../blend'

// ============================================================================
// SCHEMA & TYPES
// ============================================================================

export const nervousFidgetParamsSchema = z.object({
  /** Overall anxiety level (0-1). Default: 0.6 */
  anxietyLevel: z.number().min(0).max(1).default(0.6),
  /** Intensity of fidgeting movements (0-1). Default: 0.5 */
  fidgetIntensity: z.number().min(0).max(1).default(0.5),
  /** Speed of looking around (0-1). Default: 0.4 */
  lookAroundSpeed: z.number().min(0).max(1).default(0.4),
  /** Breath rate multiplier (nervous = faster). Default: 1.5 */
  breathRateMultiplier: z.number().min(1).max(3).default(1.5),
  /** Enable hand fidgeting. Default: true */
  handFidget: z.boolean().default(true),
  /** Enable foot tapping. Default: true */
  footTap: z.boolean().default(true),
  /** Enable rapid eye movement. Default: true */
  rapidEyeMovement: z.boolean().default(true),
  /** Shoulder tension (0-1). Default: 0.7 */
  shoulderTension: z.number().min(0).max(1).default(0.7),
})

export type NervousFidgetParams = z.infer<typeof nervousFidgetParamsSchema>
export type NervousFidgetInput = z.input<typeof nervousFidgetParamsSchema>

export const nervousFidgetMeta: MotionMeta = {
  id: 'nervous-fidget',
  name: 'Nervous Fidget',
  description: 'Anxiety-driven fidgeting with weight shifts, tense posture, and self-soothing gestures',
  tags: ['nervous', 'anxiety', 'fidget', 'tension'],
  author: 'posers',
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

interface NervousFidgetState {
  noise: NoiseGenerator
  weightSpring: Spring
  headSpring: Spring
  armSpring: Spring
  fidgetTimer: number
  fidgetType: 'none' | 'hand_rub' | 'arm_touch' | 'neck_touch'
  fidgetHand: 'left' | 'right'
  lastFidgetTime: number
  blinkTimer: number
  isBlinking: boolean
  footTapPhase: number
  footTapActive: boolean
  lookTarget: { x: number; y: number }
  lookChangeTimer: number
}

function initState(seed: number): NervousFidgetState {
  return {
    noise: createNoiseGenerator(seed),
    weightSpring: createSpring({ stiffness: 150, damping: 12 }),
    headSpring: createSpring({ stiffness: 200, damping: 18 }),
    armSpring: createSpring({ stiffness: 100, damping: 15 }),
    fidgetTimer: 0,
    fidgetType: 'none',
    fidgetHand: 'right',
    lastFidgetTime: 0,
    blinkTimer: 0,
    isBlinking: false,
    footTapPhase: 0,
    footTapActive: false,
    lookTarget: { x: 0, y: 0 },
    lookChangeTimer: 0,
  }
}

// ============================================================================
// MOTION IMPLEMENTATION
// ============================================================================

/**
 * Creates a nervous fidget motion with proper handling of optional bones.
 *
 * BONE HANDLING STRATEGY:
 * - Every bone rotation is guarded by rig.hasBone() checks
 * - Missing optional bones (jaw, eyes, fingers, toes) are gracefully skipped
 * - The animation degrades gracefully when bones are unavailable
 * - Core bones (hips, spine, chest) are checked before use
 *
 * DETERMINISM:
 * - All noise functions are seeded from ctx.seed
 * - Same seed produces identical animation every time
 * - No use of Math.random() or Date.now()
 *
 * PERFORMANCE:
 * - All computations are O(1) per frame
 * - No allocations in the update loop except for quaternion creation
 * - Pre-computed values used where possible
 * - Springs provide efficient physics simulation
 */
export function createNervousFidget(params: NervousFidgetInput = {}): MotionProgram<NervousFidgetParams> {
  const validatedParams = nervousFidgetParamsSchema.parse(params)
  let state: NervousFidgetState | null = null

  return {
    meta: nervousFidgetMeta,
    paramsSchema: nervousFidgetParamsSchema,

    init(_rig: HumanoidRig, ctx: MotionContext): void {
      state = initState(ctx.seed)
    },

    update(rig: HumanoidRig, ctx: MotionContext, t: number, dt: number): void {
      if (!state) {
        state = initState(ctx.seed)
      }

      const {
        anxietyLevel,
        fidgetIntensity,
        lookAroundSpeed,
        breathRateMultiplier,
        handFidget,
        footTap,
        rapidEyeMovement,
        shoulderTension,
      } = validatedParams

      const noise = state.noise
      const anxiety = anxietyLevel

      // ========================================
      // LAYER 1: TENSE BASE POSTURE
      // ========================================

      // Hunched, protective stance
      const hunch = 0.05 * anxiety
      const forwardLean = 0.03 * anxiety

      // Hips - slightly tucked
      if (rig.hasBone('hips')) {
        const hipsRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, forwardLean)
        rig.setRotation('hips', hipsRot)
      }

      // Spine - forward hunch
      if (rig.hasBone('spine')) {
        rig.setRotation('spine', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, hunch))
      }
      if (rig.hasBone('chest')) {
        rig.setRotation('chest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, hunch * 0.8))
      }
      if (rig.hasBone('upperChest')) {
        rig.setRotation('upperChest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, hunch * 0.5))
      }

      // Shoulders - raised and tense
      const shoulderRaise = shoulderTension * 0.08
      const shoulderForward = shoulderTension * 0.06
      if (rig.hasBone('leftShoulder')) {
        const leftShoulderRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -shoulderRaise)
        leftShoulderRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -shoulderForward))
        rig.setRotation('leftShoulder', leftShoulderRot)
      }
      if (rig.hasBone('rightShoulder')) {
        const rightShoulderRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, shoulderRaise)
        rightShoulderRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, shoulderForward))
        rig.setRotation('rightShoulder', rightShoulderRot)
      }

      // Neck - forward head posture (hypervigilance)
      if (rig.hasBone('neck')) {
        rig.setRotation('neck', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.08 * anxiety))
      }

      // Arms - held closer to body
      const armProtect = 0.05 * anxiety
      if (rig.hasBone('leftUpperArm')) {
        const leftArmRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, 0.15 - armProtect)
        leftArmRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.1))
        rig.setRotation('leftUpperArm', leftArmRot)
      }
      if (rig.hasBone('rightUpperArm')) {
        const rightArmRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -0.15 + armProtect)
        rightArmRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.1))
        rig.setRotation('rightUpperArm', rightArmRot)
      }

      // Bent elbows
      if (rig.hasBone('leftLowerArm')) {
        rig.setRotation('leftLowerArm', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -0.4 * anxiety))
      }
      if (rig.hasBone('rightLowerArm')) {
        rig.setRotation('rightLowerArm', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, 0.4 * anxiety))
      }

      // Legs - weight on one leg, ready to move
      if (rig.hasBone('leftUpperLeg')) {
        rig.setRotation('leftUpperLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.03))
      }
      if (rig.hasBone('rightUpperLeg')) {
        rig.setRotation('rightUpperLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.05))
      }

      // ========================================
      // LAYER 2: SHALLOW BREATHING
      // ========================================

      const breathRate = 0.25 * breathRateMultiplier
      const breathPhase = Math.sin(t * breathRate * Math.PI * 2)
      const shallowBreath = breathPhase * 0.015 * anxiety

      if (rig.hasBone('chest')) {
        rig.addRotation('chest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, shallowBreath))
      }
      if (rig.hasBone('upperChest')) {
        rig.addRotation('upperChest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, shallowBreath * 1.2))
      }

      // Shoulder rise with anxious breath
      const anxiousShoulderBreath = breathPhase * 0.01 * anxiety
      if (rig.hasBone('leftShoulder')) {
        rig.addRotation('leftShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -anxiousShoulderBreath))
      }
      if (rig.hasBone('rightShoulder')) {
        rig.addRotation('rightShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, anxiousShoulderBreath))
      }

      // ========================================
      // LAYER 3: IRREGULAR WEIGHT SHIFTING
      // ========================================

      // Quick, irregular weight shifts
      const weightShiftNoise = noise.turbulence(t * 0.8, 0) * 2 - 1
      const weightJitter = noise.noise2D(t * 3, 100) * fidgetIntensity * 0.3
      state.weightSpring.setTarget(weightShiftNoise * 0.5 + weightJitter)
      state.weightSpring.update(dt)
      const weightShift = state.weightSpring.value * fidgetIntensity

      if (rig.hasBone('hips')) {
        rig.addRotation('hips', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, weightShift * 0.04))
        rig.addRotation('hips', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, weightShift * 0.02))
      }

      // Counter in spine
      if (rig.hasBone('spine')) {
        rig.addRotation('spine', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -weightShift * 0.02))
      }

      // ========================================
      // LAYER 4: HEAD MOVEMENT (LOOKING AROUND)
      // ========================================

      // Quick, darting looks
      state.lookChangeTimer += dt
      const lookChangeInterval = 1.5 - lookAroundSpeed * 1.2
      if (state.lookChangeTimer > lookChangeInterval) {
        state.lookChangeTimer = 0
        state.lookTarget = {
          x: (noise.noise2D(t, 200) * 2 - 1) * 0.15 * lookAroundSpeed,
          y: (noise.noise2D(t, 300) * 2 - 1) * 0.1 * lookAroundSpeed,
        }
      }

      state.headSpring.setTarget(state.lookTarget.x)
      state.headSpring.update(dt)
      const headYaw = state.headSpring.value

      // Add nervous micro-movements
      const headJitterX = noise.noise2D(t * 4, 400) * 0.02 * fidgetIntensity
      const headJitterY = noise.noise2D(t * 4, 500) * 0.015 * fidgetIntensity

      if (rig.hasBone('head')) {
        const headRot = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, headYaw + headJitterY)
        headRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, state.lookTarget.y + headJitterX))
        rig.setRotation('head', headRot)
      }

      if (rig.hasBone('neck')) {
        rig.addRotation('neck', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, headYaw * 0.3))
      }

      // ========================================
      // LAYER 5: HAND FIDGETING
      // ========================================

      if (handFidget) {
        // Decide on fidget type
        const timeSinceFidget = t - state.lastFidgetTime
        const fidgetInterval = 2 + noise.noise2D(t * 0.1, 600) * 2

        if (state.fidgetType === 'none' && timeSinceFidget > fidgetInterval) {
          const fidgetRoll = noise.noise2D(t, 700)
          if (fidgetRoll > 0.6) {
            state.fidgetType = 'hand_rub'
          } else if (fidgetRoll > 0.3) {
            state.fidgetType = 'arm_touch'
          } else {
            state.fidgetType = 'neck_touch'
          }
          state.fidgetHand = noise.noise2D(t, 800) > 0.5 ? 'left' : 'right'
          state.fidgetTimer = 0
        }

        if (state.fidgetType !== 'none') {
          state.fidgetTimer += dt
          const fidgetDuration = 1.5 + noise.noise2D(t * 0.2, 900) * 1
          const fidgetProgress = state.fidgetTimer / fidgetDuration

          if (fidgetProgress >= 1) {
            state.fidgetType = 'none'
            state.lastFidgetTime = t
          } else {
            // Ease in and out of fidget
            const fidgetWeight = Math.sin(fidgetProgress * Math.PI)

            // Apply fidget based on type
            switch (state.fidgetType) {
              case 'hand_rub':
                // Bring hands together in front
                if (rig.hasBone('leftUpperArm')) {
                  rig.addRotation('leftUpperArm', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.3 * fidgetWeight))
                  rig.addRotation('leftUpperArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -0.2 * fidgetWeight))
                }
                if (rig.hasBone('rightUpperArm')) {
                  rig.addRotation('rightUpperArm', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.3 * fidgetWeight))
                  rig.addRotation('rightUpperArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, 0.2 * fidgetWeight))
                }
                if (rig.hasBone('leftLowerArm')) {
                  rig.addRotation('leftLowerArm', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -0.5 * fidgetWeight))
                }
                if (rig.hasBone('rightLowerArm')) {
                  rig.addRotation('rightLowerArm', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, 0.5 * fidgetWeight))
                }
                // Rubbing motion
                const rubPhase = Math.sin(state.fidgetTimer * 8) * fidgetWeight
                if (rig.hasBone('leftHand')) {
                  rig.addRotation('leftHand', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, rubPhase * 0.2))
                }
                break

              case 'arm_touch':
                // Touch opposite arm
                const touchArm = state.fidgetHand === 'left' ? 'left' : 'right'
                if (rig.hasBone(`${touchArm}UpperArm` as VRMHumanBoneName)) {
                  rig.addRotation(`${touchArm}UpperArm` as VRMHumanBoneName,
                    quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.4 * fidgetWeight))
                }
                if (rig.hasBone(`${touchArm}LowerArm` as VRMHumanBoneName)) {
                  rig.addRotation(`${touchArm}LowerArm` as VRMHumanBoneName,
                    quatFromAxisAngle({ x: 0, y: 1, z: 0 }, (touchArm === 'left' ? -1 : 1) * 0.8 * fidgetWeight))
                }
                break

              case 'neck_touch':
                // Touch back of neck
                const neckArm = state.fidgetHand
                if (rig.hasBone(`${neckArm}UpperArm` as VRMHumanBoneName)) {
                  rig.addRotation(`${neckArm}UpperArm` as VRMHumanBoneName,
                    quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -0.5 * fidgetWeight))
                  rig.addRotation(`${neckArm}UpperArm` as VRMHumanBoneName,
                    quatFromAxisAngle({ x: 0, y: 0, z: 1 }, (neckArm === 'left' ? -1 : 1) * 0.3 * fidgetWeight))
                }
                if (rig.hasBone(`${neckArm}LowerArm` as VRMHumanBoneName)) {
                  rig.addRotation(`${neckArm}LowerArm` as VRMHumanBoneName,
                    quatFromAxisAngle({ x: 0, y: 1, z: 0 }, (neckArm === 'left' ? -1 : 1) * 1.2 * fidgetWeight))
                }
                break
            }
          }
        }

        // Fingers - tense, curled
        const fingerTension = 0.4 + noise.noise2D(t * 2, 1000) * 0.2
        applyFingerCurl(rig, 'left', {
          thumb: fingerTension * 0.5,
          index: fingerTension,
          middle: fingerTension * 1.1,
          ring: fingerTension * 1.15,
          little: fingerTension * 1.2,
        })
        applyFingerCurl(rig, 'right', {
          thumb: fingerTension * 0.5,
          index: fingerTension,
          middle: fingerTension * 1.1,
          ring: fingerTension * 1.15,
          little: fingerTension * 1.2,
        })
      }

      // ========================================
      // LAYER 6: FOOT TAPPING
      // ========================================

      if (footTap) {
        // Decide when to tap
        const tapTrigger = noise.noise2D(t * 0.5, 1100)
        if (!state.footTapActive && tapTrigger > 0.7) {
          state.footTapActive = true
          state.footTapPhase = 0
        }

        if (state.footTapActive) {
          state.footTapPhase += dt * 6 // Fast tapping
          const tapCycle = Math.sin(state.footTapPhase * Math.PI * 2)
          const tapUp = Math.max(0, tapCycle) * fidgetIntensity

          // Right foot tap
          if (rig.hasBone('rightFoot')) {
            rig.addRotation('rightFoot', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, tapUp * 0.15))
          }
          if (rig.hasBone('rightToes')) {
            rig.setRotation('rightToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -tapUp * 0.2))
          }

          // Stop after a few taps
          if (state.footTapPhase > 8) {
            state.footTapActive = false
          }
        }
      }

      // ========================================
      // LAYER 7: RAPID EYE MOVEMENT
      // ========================================

      if (rapidEyeMovement) {
        // Quick, darting eye movements
        const eyeSpeed = 3 + lookAroundSpeed * 4
        const eyeX = noise.noise2D(t * eyeSpeed, 1200) * 0.08 * anxiety
        const eyeY = noise.noise2D(t * eyeSpeed, 1300) * 0.06 * anxiety

        // Frequent blinking
        const blinkInterval = 1.5 - anxiety * 0.8
        if (!state.isBlinking && noise.noise2D(t * 0.5, 1400) > 0.8) {
          state.isBlinking = true
          state.blinkTimer = 0
        }

        let blinkAmount = 0
        if (state.isBlinking) {
          state.blinkTimer += dt
          if (state.blinkTimer > 0.12) {
            state.isBlinking = false
          } else {
            blinkAmount = Math.sin(state.blinkTimer / 0.12 * Math.PI)
          }
        }

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
      // LAYER 8: JAW TENSION
      // ========================================

      if (rig.hasBone('jaw')) {
        // Slight jaw clench with occasional release
        const jawTension = anxiety * 0.02
        const jawRelease = noise.noise2D(t * 0.3, 1500) > 0.8 ? 0.01 : 0
        rig.setRotation('jaw', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, jawRelease - jawTension))
      }
    },
  }
}

export const nervousFidget: MotionProgram<NervousFidgetParams> = createNervousFidget({})
