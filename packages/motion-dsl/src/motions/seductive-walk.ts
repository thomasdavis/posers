/**
 * ============================================================================
 * SEDUCTIVE WALK MOTION
 * ============================================================================
 *
 * Runway-style walking with exaggerated hip sway, fluid arm movement,
 * and confident head carriage. Full gait cycle with crossover step pattern.
 *
 * ============================================================================
 * HOW THIS MOTION SHOULD FEEL
 * ============================================================================
 *
 * Think of a supermodel on a Milan runway. Each step is deliberate, the hips
 * swinging in an exaggerated figure-8 pattern. The legs cross slightly in
 * front of each other (crossover step) creating that distinctive catwalk
 * line. The arms flow gracefully, slightly behind the beat of the legs.
 * The head stays remarkably stable despite the body movement below - a
 * testament to the vestibular-ocular reflex keeping the gaze steady.
 *
 * The key quality is FLOW. Nothing is jerky or mechanical. The hip leads,
 * the spine follows with counter-rotation, the shoulders oppose the hips,
 * and the arms trail behind with elegant follow-through. Even the fingers
 * are slightly spread in that characteristic model pose.
 *
 * ============================================================================
 * TIMING RELATIONSHIPS
 * ============================================================================
 *
 * GAIT CYCLE: 1.25 seconds at default speed (0.8 Hz)
 *   - Right heel strike: 0% of cycle
 *   - Right midstance: 25% (peak weight on right leg)
 *   - Left heel strike: 50% of cycle
 *   - Left midstance: 75% (peak weight on left leg)
 *
 * HIP MOVEMENT:
 *   - Lateral sway: peaks at midstance (25%, 75%)
 *   - Forward/back tilt: 2x frequency (peaks at 12.5%, 37.5%, 62.5%, 87.5%)
 *   - Rotation (twist): same phase as sway but opposite direction
 *   - Drop: peaks during swing phase (opposite to sway)
 *
 * SPINE COUNTER-ROTATION:
 *   - Spine: 50% counter to hip twist
 *   - Chest: 80% counter to hip twist
 *   - Upper chest: 100% counter (shoulders oppose hips)
 *
 * ARM SWING:
 *   - Phase: opposite to same-side leg (arm forward when leg back)
 *   - Secondary motion: wrist lags arm by ~0.3 radians phase
 *   - Fingers: subtle curl variation at 0.2 Hz
 *
 * LEG MOVEMENT:
 *   - Swing phase: 50% of gait cycle per leg (simplified symmetric gait)
 *   - Peak knee bend: 50% into swing phase (apex of sine curve)
 *   - Crossover: 5% adduction creates line
 *
 * HEAD STABILIZATION:
 *   - Compensates 30% of hip sway
 *   - Spring-driven (stiffness 180) for natural lag
 *   - Slight constant tilt for attitude
 *
 * ============================================================================
 * BONE HANDLING
 * ============================================================================
 *
 * All bone access wrapped in hasBone() checks.
 *
 * CORE: hips (with translation), spine, chest, upperChest, neck, head
 * ARMS: leftShoulder, rightShoulder, leftUpperArm, rightUpperArm,
 *       leftLowerArm, rightLowerArm, leftHand, rightHand
 * FINGERS: all 30 bones via applyFingerCurl/applyFingerSpread helpers
 * LEGS: leftUpperLeg, rightUpperLeg, leftLowerLeg, rightLowerLeg
 * FEET: leftFoot, rightFoot, leftToes, rightToes
 * FACE: leftEye, rightEye
 *
 * ============================================================================
 * RESEARCH BASIS
 * ============================================================================
 *
 * - Whittle, M. (2007): "Gait Analysis: An Introduction" - Normal gait cycle
 *   timing, stance/swing phase ratios, hip/knee kinematics.
 *
 * - Murray, M.P. et al. (1970): "Walking patterns of normal women" - Hip
 *   rotation 8-12° total, lateral trunk sway increases with slower walking.
 *
 * - Runway walking uses exaggerated hip sway (lateral tilt) rather than
 *   rotation. The stylized motion prioritizes visual aesthetics over
 *   biomechanical accuracy, using moderate rotation (~4.6°) with pronounced
 *   lateral sway (~7°) and crossover step pattern.
 *
 * - Head stabilization: We use 30% compensation for this stylized motion
 *   (less than the ~70% vestibular-ocular reflex) to allow visible head
 *   movement that reads as intentional and confident rather than rigid.
 *
 * ============================================================================
 * NUMERICAL JUSTIFICATIONS
 * ============================================================================
 *
 * speed 0.8 Hz: Slower than normal walk (1.0-1.2 Hz) for runway effect
 * hipSwayAmount 0.8: Exaggerated from normal 0.3-0.4
 * hipSway 0.12 rad: 7° lateral sway (2x normal)
 * hipTwist 0.08 rad: 4.6° rotation per side (within normal range)
 * crossoverStep 0.05 rad: 2.9° adduction for crossover line
 * armFlowiness 0.7: Secondary motion amplitude
 * headTilt 0.08 rad: 4.6° constant attitude tilt
 * springStiffness 150-180: Moderate lag for organic feel
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
        const hipsRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, hipSway + hipDrop)
        hipsRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, hipTwist))
        hipsRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, hipForward))
        rig.setRotation('hips', hipsRot)

        // Hip translation for bounce (includes hip drop as vertical offset)
        const hipBounce = Math.abs(Math.sin(gaitPhase * Math.PI * 2)) * 0.01 * intensity
        rig.setHipsPositionOffset(new Vector3(hipSway * 0.1, hipBounce - hipDrop * 0.02, 0))
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
      // LAYER 2B: BREATH COUPLING TO GAIT
      // ========================================

      // Breath rate couples to gait cycle - approximately one breath per 2 steps
      // At 0.8 Hz speed, this gives ~0.4 Hz breathing = 2.5s cycle
      const breathPhase = Math.sin(gaitPhase * Math.PI) * 0.02 * intensity

      if (rig.hasBone('chest')) {
        rig.addRotation('chest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, breathPhase))
      }
      if (rig.hasBone('upperChest')) {
        rig.addRotation('upperChest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, breathPhase * 1.5))
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
        // Apply counter-rotation (shoulderTwist) + drop with arm swing
        const leftShoulderRot = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -shoulderTwist * 0.3)
        leftShoulderRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -leftShoulderDrop))
        rig.setRotation('leftShoulder', leftShoulderRot)
      }

      if (rig.hasBone('rightShoulder')) {
        // Apply counter-rotation (shoulderTwist) + drop with arm swing
        const rightShoulderRot = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, shoulderTwist * 0.3)
        rightShoulderRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, rightShoulderDrop))
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

      // Base arm-down from T-pose: ~70° (1.2 rad) with mirrored Z axis
      const armDownBase = 1.2 * intensity
      if (rig.hasBone('leftUpperArm')) {
        // Left arm: negative Z brings arm down, X is forward/back swing
        const leftUpperArmRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -armDownBase)
        leftUpperArmRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, leftArmSwing))
        rig.setRotation('leftUpperArm', leftUpperArmRot)
      }

      if (rig.hasBone('rightUpperArm')) {
        // Right arm: positive Z brings arm down
        const rightUpperArmRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, armDownBase)
        rightUpperArmRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, rightArmSwing))
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

      if (rig.hasBone('rightToes')) {
        if (rightStance) {
          // Toes grip during stance for balance and push-off
          // 0.15 rad = 8.6° flexion for grip
          rig.setRotation('rightToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.15 * intensity))
        } else if (toePoint) {
          // Toes point during swing for elegance
          const rightToePoint = Math.sin(rightSwingPhase * Math.PI) * 0.4 * intensity
          rig.setRotation('rightToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -rightToePoint))
        }
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

      if (rig.hasBone('leftToes')) {
        if (leftStance) {
          // Toes grip during stance for balance and push-off
          // 0.15 rad = 8.6° flexion for grip
          rig.setRotation('leftToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.15 * intensity))
        } else if (toePoint) {
          // Toes point during swing for elegance
          const leftToePoint = Math.sin(leftSwingPhase * Math.PI) * 0.4 * intensity
          rig.setRotation('leftToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -leftToePoint))
        }
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
        // Note: applyFingerCurl/applyFingerSpread have internal hasBone() checks
        // via getAvailableBones(), but we guard on hand existence for clarity
        const fingerCurl = 0.15 + noise.noise2D(t * 0.2, 200) * 0.05

        // Left hand fingers - only apply if hand exists
        if (rig.hasBone('leftHand')) {
          applyFingerCurl(rig, 'left', {
            thumb: fingerCurl * 0.4,
            index: fingerCurl * 0.8,
            middle: fingerCurl * 0.9,
            ring: fingerCurl,
            little: fingerCurl * 1.1,
          })
          // Elegant spread
          applyFingerSpread(rig, 'left', 0.4 * intensity)
        }

        // Right hand fingers - only apply if hand exists
        if (rig.hasBone('rightHand')) {
          applyFingerCurl(rig, 'right', {
            thumb: fingerCurl * 0.4,
            index: fingerCurl * 0.8,
            middle: fingerCurl * 0.9,
            ring: fingerCurl,
            little: fingerCurl * 1.1,
          })
          // Elegant spread
          applyFingerSpread(rig, 'right', 0.4 * intensity)
        }
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
