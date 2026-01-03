/**
 * Seductive Walk Motion
 *
 * Runway-style walking with exaggerated hip sway, fluid arm movement,
 * and confident head carriage. Full gait cycle implementation with
 * crossover step pattern.
 *
 * Research basis:
 * - Runway/catwalk biomechanics
 * - Hip kinematics during walking
 * - Arm swing dynamics and coordination
 * - Weight transfer patterns
 * - Secondary motion physics
 */

import { z } from 'zod'
import { Vector3 } from 'three'
import type { MotionProgram, MotionMeta, HumanoidRig, MotionContext, VRMHumanBoneName } from '@posers/core'
import {
  osc,
  quatFromAxisAngle,
  createNoiseGenerator,
  createSpring,
  Easing,
  walkPhase,
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

export const seductiveWalkParamsSchema = z.object({
  /** Overall intensity of exaggeration (0-1). Default: 0.7 */
  intensity: z.number().min(0).max(1).default(0.7),
  /** Walking speed (steps per second). Default: 0.8 */
  speed: z.number().min(0.3).max(2).default(0.8),
  /** Amount of hip sway (0-1). Default: 0.8 */
  hipSwayAmount: z.number().min(0).max(1).default(0.8),
  /** Fluidity of arm movement (0-1). Default: 0.7 */
  armFlowiness: z.number().min(0).max(1).default(0.7),
  /** Head tilt angle (0-1). Default: 0.3 */
  headTilt: z.number().min(0).max(1).default(0.3),
  /** Enable crossover step pattern. Default: true */
  crossoverStep: z.boolean().default(true),
  /** Enable toe point during swing. Default: true */
  toePoint: z.boolean().default(true),
  /** Enable secondary motion (follow-through). Default: true */
  secondaryMotion: z.boolean().default(true),
  /** Enable finger movement. Default: true */
  fingerAnimation: z.boolean().default(true),
})

export type SeductiveWalkParams = z.infer<typeof seductiveWalkParamsSchema>
export type SeductiveWalkInput = z.input<typeof seductiveWalkParamsSchema>

export const seductiveWalkMeta: MotionMeta = {
  id: 'seductive-walk',
  name: 'Seductive Walk',
  description: 'Runway-style walk with exaggerated hip sway and fluid arm movement',
  tags: ['walk', 'locomotion', 'seductive', 'runway'],
  author: 'posers',
}

// ============================================================================
// GAIT CYCLE HELPERS
// ============================================================================

/**
 * Gait cycle phases (0-1):
 * 0.0 - 0.1: Right heel strike / Left toe off
 * 0.1 - 0.3: Right loading response
 * 0.3 - 0.5: Right midstance / Left swing
 * 0.5 - 0.6: Left heel strike / Right toe off
 * 0.6 - 0.8: Left loading response
 * 0.8 - 1.0: Left midstance / Right swing
 */

function getGaitPhase(t: number, speed: number): number {
  const cycleTime = 1 / speed
  return (t / cycleTime) % 1
}

function legSwingCurve(phase: number): number {
  // Smooth leg swing with acceleration
  return Easing.easeInOutSine(phase)
}

function hipDropCurve(phase: number): number {
  // Hip drops during swing phase, rises during stance
  return Math.sin(phase * Math.PI * 2)
}

function armSwingCurve(phase: number, flowiness: number): number {
  // Fluid arm swing with follow-through
  const base = Math.sin(phase * Math.PI * 2)
  const secondary = Math.sin((phase * Math.PI * 2) - 0.3) * 0.2 * flowiness
  return base + secondary
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

interface SeductiveWalkState {
  noise: NoiseGenerator
  hipSpring: Spring
  shoulderSpring: Spring
  headSpring: Spring
  leftArmSpring: Spring
  rightArmSpring: Spring
  blinkTimer: number
  isBlinking: boolean
}

/**
 * Initialize deterministic state with seeded random generators.
 * The noise generator uses the seed to ensure identical output
 * for the same seed value across all calls.
 */
function initState(seed: number): SeductiveWalkState {
  // Noise generator is seeded for deterministic, reproducible motion
  return {
    noise: createNoiseGenerator(seed),
    hipSpring: createSpring({ stiffness: 150, damping: 15 }),
    shoulderSpring: createSpring({ stiffness: 120, damping: 12 }),
    headSpring: createSpring({ stiffness: 180, damping: 20 }),
    leftArmSpring: createSpring({ stiffness: 80, damping: 10 }),
    rightArmSpring: createSpring({ stiffness: 80, damping: 10 }),
    blinkTimer: 0,
    isBlinking: false,
  }
}

// ============================================================================
// MOTION IMPLEMENTATION
// ============================================================================

/**
 * Creates a seductive walk motion with full gait cycle implementation.
 *
 * BONE HANDLING STRATEGY:
 * - Every bone rotation is guarded by rig.hasBone() checks
 * - Missing optional bones (toes, eyes, fingers) are gracefully skipped
 * - The animation degrades gracefully when bones are unavailable
 * - Core bones (hips, spine, legs) are all checked before use
 *
 * DETERMINISM:
 * - All noise functions are seeded from ctx.seed
 * - Same seed produces identical animation every time
 * - Gait phase is purely time-based with no random elements
 *
 * PERFORMANCE:
 * - All computations are O(1) per frame
 * - Spring physics use efficient semi-implicit Euler integration
 * - Gait phase calculations are simple trigonometry
 * - No allocations in hot path except quaternion creation
 */
export function createSeductiveWalk(params: SeductiveWalkInput = {}): MotionProgram<SeductiveWalkParams> {
  const validatedParams = seductiveWalkParamsSchema.parse(params)
  let state: SeductiveWalkState | null = null

  return {
    meta: seductiveWalkMeta,
    paramsSchema: seductiveWalkParamsSchema,

    init(_rig: HumanoidRig, ctx: MotionContext): void {
      state = initState(ctx.seed)
    },

    update(rig: HumanoidRig, ctx: MotionContext, t: number, dt: number): void {
      if (!state) {
        state = initState(ctx.seed)
      }

      const {
        intensity,
        speed,
        hipSwayAmount,
        armFlowiness,
        headTilt,
        crossoverStep,
        toePoint,
        secondaryMotion,
        fingerAnimation,
      } = validatedParams

      const noise = state.noise
      const gaitPhase = getGaitPhase(t, speed)

      // Which leg is in stance phase
      const rightStance = gaitPhase < 0.5
      const leftStance = !rightStance

      // Swing phase for each leg (0-1 during their swing)
      const rightSwingPhase = rightStance ? 0 : (gaitPhase - 0.5) * 2
      const leftSwingPhase = leftStance ? 0 : gaitPhase * 2

      // ========================================
      // LAYER 1: HIP MOVEMENT (CORE OF THE WALK)
      // ========================================

      // Hip sway - lateral movement
      const hipSwayTarget = Math.sin(gaitPhase * Math.PI * 2) * hipSwayAmount * 0.12 * intensity
      state.hipSpring.setTarget(hipSwayTarget)
      state.hipSpring.update(dt)
      const hipSway = state.hipSpring.value

      // Hip rotation (twist) - counter to shoulders
      const hipTwist = Math.sin(gaitPhase * Math.PI * 2) * 0.08 * intensity

      // Hip drop on swing side
      const hipDrop = hipDropCurve(gaitPhase) * 0.05 * intensity

      // Forward hip oscillation (pelvic tilt during gait)
      const hipForward = Math.sin(gaitPhase * Math.PI * 4) * 0.02 * intensity

      if (rig.hasBone('hips')) {
        const hipsRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, hipSway)
        hipsRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, hipTwist))
        hipsRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, hipForward))
        rig.setRotation('hips', hipsRot)

        // Hip translation for bounce
        const hipBounce = Math.abs(Math.sin(gaitPhase * Math.PI * 2)) * 0.01 * intensity
        rig.setHipsPositionOffset(new Vector3(hipSway * 0.1, hipBounce, 0))
      }

      // ========================================
      // LAYER 2: SPINE COUNTER-ROTATION
      // ========================================

      // Spine opposes hip movement for balance
      const spineCounter = -hipTwist * 0.4
      const spineSway = -hipSway * 0.3

      if (rig.hasBone('spine')) {
        const spineRot = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, spineCounter * 0.5)
        spineRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, spineSway * 0.5))
        rig.setRotation('spine', spineRot)
      }

      if (rig.hasBone('chest')) {
        const chestRot = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, spineCounter * 0.8)
        chestRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, spineSway * 0.3))
        // Slight chest forward for confidence
        chestRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -0.03 * intensity))
        rig.setRotation('chest', chestRot)
      }

      if (rig.hasBone('upperChest')) {
        const upperChestRot = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, spineCounter)
        upperChestRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, spineSway * 0.2))
        upperChestRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -0.04 * intensity))
        rig.setRotation('upperChest', upperChestRot)
      }

      // ========================================
      // LAYER 3: SHOULDER MOVEMENT
      // ========================================

      // Shoulders counter-rotate to hips
      const shoulderTarget = -hipTwist * 0.6
      state.shoulderSpring.setTarget(shoulderTarget)
      state.shoulderSpring.update(dt)
      const shoulderTwist = state.shoulderSpring.value

      // Shoulder drop with arm swing
      const leftShoulderDrop = armSwingCurve(gaitPhase, armFlowiness) * 0.02 * intensity
      const rightShoulderDrop = armSwingCurve(gaitPhase + 0.5, armFlowiness) * 0.02 * intensity

      if (rig.hasBone('leftShoulder')) {
        const leftShoulderRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -leftShoulderDrop)
        rig.setRotation('leftShoulder', leftShoulderRot)
      }

      if (rig.hasBone('rightShoulder')) {
        const rightShoulderRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, rightShoulderDrop)
        rig.setRotation('rightShoulder', rightShoulderRot)
      }

      // ========================================
      // LAYER 4: ARM SWING
      // ========================================

      // Fluid arm swing with secondary motion
      const leftArmSwingBase = armSwingCurve(gaitPhase, armFlowiness) * 0.35 * intensity * armFlowiness
      const rightArmSwingBase = armSwingCurve(gaitPhase + 0.5, armFlowiness) * 0.35 * intensity * armFlowiness

      // Apply spring for smoothness
      state.leftArmSpring.setTarget(leftArmSwingBase)
      state.rightArmSpring.setTarget(rightArmSwingBase)
      state.leftArmSpring.update(dt)
      state.rightArmSpring.update(dt)

      const leftArmSwing = state.leftArmSpring.value
      const rightArmSwing = state.rightArmSpring.value

      // Secondary motion - wrist lag
      const leftWristLag = secondaryMotion ? leftArmSwing * 0.3 : 0
      const rightWristLag = secondaryMotion ? rightArmSwing * 0.3 : 0

      if (rig.hasBone('leftUpperArm')) {
        const leftUpperArmRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, leftArmSwing)
        leftUpperArmRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, 0.08 * intensity))
        rig.setRotation('leftUpperArm', leftUpperArmRot)
      }

      if (rig.hasBone('rightUpperArm')) {
        const rightUpperArmRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, rightArmSwing)
        rightUpperArmRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -0.08 * intensity))
        rig.setRotation('rightUpperArm', rightUpperArmRot)
      }

      // Lower arms - slight bend with secondary motion
      if (rig.hasBone('leftLowerArm')) {
        const leftLowerRot = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -0.1 - leftWristLag * 0.2)
        rig.setRotation('leftLowerArm', leftLowerRot)
      }

      if (rig.hasBone('rightLowerArm')) {
        const rightLowerRot = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, 0.1 + rightWristLag * 0.2)
        rig.setRotation('rightLowerArm', rightLowerRot)
      }

      // Wrists - graceful rotation
      if (rig.hasBone('leftHand')) {
        const leftHandRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, 0.1 + leftWristLag * 0.15)
        leftHandRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -leftWristLag * 0.1))
        rig.setRotation('leftHand', leftHandRot)
      }

      if (rig.hasBone('rightHand')) {
        const rightHandRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -0.1 - rightWristLag * 0.15)
        rightHandRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -rightWristLag * 0.1))
        rig.setRotation('rightHand', rightHandRot)
      }

      // ========================================
      // LAYER 5: LEG MOVEMENT
      // ========================================

      // Right leg
      const rightLegForward = rightStance
        ? -0.1 * (gaitPhase * 2) * intensity // Pushing back during stance
        : Math.sin(rightSwingPhase * Math.PI) * 0.4 * intensity // Swinging forward

      const rightLegAbduction = crossoverStep
        ? Math.sin(gaitPhase * Math.PI * 2 + Math.PI) * 0.05 * intensity // Crossover
        : 0

      if (rig.hasBone('rightUpperLeg')) {
        const rightUpperLegRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, rightLegForward)
        rightUpperLegRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, rightLegAbduction))
        rig.setRotation('rightUpperLeg', rightUpperLegRot)
      }

      // Right knee bend
      const rightKneeBend = rightStance
        ? 0.08 * intensity // Slight bend in stance
        : Math.sin(rightSwingPhase * Math.PI) * 0.6 * intensity // Bend during swing

      if (rig.hasBone('rightLowerLeg')) {
        rig.setRotation('rightLowerLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -rightKneeBend))
      }

      // Left leg
      const leftLegForward = leftStance
        ? -0.1 * ((gaitPhase - 0.5) * 2) * intensity
        : Math.sin(leftSwingPhase * Math.PI) * 0.4 * intensity

      const leftLegAbduction = crossoverStep
        ? Math.sin(gaitPhase * Math.PI * 2) * 0.05 * intensity
        : 0

      if (rig.hasBone('leftUpperLeg')) {
        const leftUpperLegRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, leftLegForward)
        leftUpperLegRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, leftLegAbduction))
        rig.setRotation('leftUpperLeg', leftUpperLegRot)
      }

      const leftKneeBend = leftStance
        ? 0.08 * intensity
        : Math.sin(leftSwingPhase * Math.PI) * 0.6 * intensity

      if (rig.hasBone('leftLowerLeg')) {
        rig.setRotation('leftLowerLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -leftKneeBend))
      }

      // ========================================
      // LAYER 6: FEET & TOES
      // ========================================

      // Right foot
      const rightFootAngle = rightStance
        ? -0.1 * intensity // Flat/slight heel strike
        : (toePoint ? -0.3 * Math.sin(rightSwingPhase * Math.PI) * intensity : 0) // Toe point during swing

      if (rig.hasBone('rightFoot')) {
        const rightFootRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, rightFootAngle)
        rightFootRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, 0.05)) // Slight turn out
        rig.setRotation('rightFoot', rightFootRot)
      }

      if (rig.hasBone('rightToes') && toePoint) {
        const rightToePoint = rightStance ? 0 : Math.sin(rightSwingPhase * Math.PI) * 0.4 * intensity
        rig.setRotation('rightToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -rightToePoint))
      }

      // Left foot
      const leftFootAngle = leftStance
        ? -0.1 * intensity
        : (toePoint ? -0.3 * Math.sin(leftSwingPhase * Math.PI) * intensity : 0)

      if (rig.hasBone('leftFoot')) {
        const leftFootRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, leftFootAngle)
        leftFootRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -0.05))
        rig.setRotation('leftFoot', leftFootRot)
      }

      if (rig.hasBone('leftToes') && toePoint) {
        const leftToePoint = leftStance ? 0 : Math.sin(leftSwingPhase * Math.PI) * 0.4 * intensity
        rig.setRotation('leftToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -leftToePoint))
      }

      // ========================================
      // LAYER 7: HEAD (STABLE WITH TILT)
      // ========================================

      // Head stays relatively stable (vestibular reflex)
      const headCompensation = -hipSway * 0.3
      const headTiltAmount = headTilt * 0.08 * intensity

      // Subtle look direction
      const lookDirection = noise.noise2D(t * 0.1, 100) * 0.05 * intensity

      state.headSpring.setTarget(headCompensation)
      state.headSpring.update(dt)

      if (rig.hasBone('head')) {
        const headRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, state.headSpring.value + headTiltAmount)
        headRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, lookDirection))
        // Slight chin up for confidence
        headRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -0.03 * intensity))
        rig.setRotation('head', headRot)
      }

      if (rig.hasBone('neck')) {
        const neckRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, state.headSpring.value * 0.3)
        neckRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -0.02 * intensity))
        rig.setRotation('neck', neckRot)
      }

      // ========================================
      // LAYER 8: FINGERS
      // ========================================

      if (fingerAnimation) {
        // Graceful, slightly spread fingers
        const fingerCurl = 0.15 + noise.noise2D(t * 0.2, 200) * 0.05

        applyFingerCurl(rig, 'left', {
          thumb: fingerCurl * 0.4,
          index: fingerCurl * 0.8,
          middle: fingerCurl * 0.9,
          ring: fingerCurl,
          little: fingerCurl * 1.1,
        })

        applyFingerCurl(rig, 'right', {
          thumb: fingerCurl * 0.4,
          index: fingerCurl * 0.8,
          middle: fingerCurl * 0.9,
          ring: fingerCurl,
          little: fingerCurl * 1.1,
        })

        // Elegant spread
        applyFingerSpread(rig, 'left', 0.4 * intensity)
        applyFingerSpread(rig, 'right', 0.4 * intensity)
      }

      // ========================================
      // LAYER 9: EYES
      // ========================================

      // Confident forward gaze with subtle movement
      const eyeX = noise.noise2D(t * 0.15, 300) * 0.03 * intensity
      const eyeY = noise.noise2D(t * 0.12, 400) * 0.02 * intensity

      // Blinking
      const blinkChance = noise.noise2D(t * 0.25, 500)
      if (!state.isBlinking && blinkChance > 0.95) {
        state.isBlinking = true
        state.blinkTimer = 0
      }

      let blinkAmount = 0
      if (state.isBlinking) {
        state.blinkTimer += dt
        if (state.blinkTimer > 0.15) {
          state.isBlinking = false
        } else {
          blinkAmount = Math.sin(state.blinkTimer / 0.15 * Math.PI) * 0.25
        }
      }

      if (rig.hasBone('leftEye')) {
        const leftEyeRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, eyeY - blinkAmount)
        leftEyeRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, eyeX))
        rig.setRotation('leftEye', leftEyeRot)
      }

      if (rig.hasBone('rightEye')) {
        const rightEyeRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, eyeY - blinkAmount)
        rightEyeRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, eyeX))
        rig.setRotation('rightEye', rightEyeRot)
      }
    },
  }
}

export const seductiveWalk: MotionProgram<SeductiveWalkParams> = createSeductiveWalk({})
