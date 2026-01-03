/**
 * Contemplative Lean Motion
 *
 * Thoughtful asymmetric pose with weight on one leg and thinking gestures.
 * Multiple pose variants including chin rest, crossed arms, and akimbo.
 *
 * Research basis:
 * - Thoughtful posture psychology
 * - Asymmetric stance biomechanics
 * - Self-touch gestures in contemplation
 * - Weight-bearing postural patterns
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
  applyFingerCurl,
} from '../blend'

// ============================================================================
// SCHEMA & TYPES
// ============================================================================

export const contemplativeLeanParamsSchema = z.object({
  /** Pose variant. Default: chin_rest */
  poseVariant: z.enum(['chin_rest', 'crossed_arms', 'akimbo', 'hand_on_hip']).default('chin_rest'),
  /** Intensity of thinking gestures (0-1). Default: 0.5 */
  thoughtIntensity: z.number().min(0).max(1).default(0.5),
  /** Depth of breathing (0-1). Default: 0.6 */
  breathDepth: z.number().min(0).max(1).default(0.6),
  /** Amount of subtle fidgeting (0-1). Default: 0.3 */
  fidgetAmount: z.number().min(0).max(1).default(0.3),
  /** Which leg bears weight. Default: right */
  weightLeg: z.enum(['left', 'right']).default('right'),
  /** Overall animation intensity (0-1). Default: 0.7 */
  intensity: z.number().min(0).max(1).default(0.7),
  /** Enable eye movement. Default: true */
  eyeMovement: z.boolean().default(true),
  /** Enable head tilts. Default: true */
  headTilts: z.boolean().default(true),
})

export type ContemplativeLeanParams = z.infer<typeof contemplativeLeanParamsSchema>
export type ContemplativeLeanInput = z.input<typeof contemplativeLeanParamsSchema>

export const contemplativeLeanMeta: MotionMeta = {
  id: 'contemplative-lean',
  name: 'Contemplative Lean',
  description: 'Thoughtful asymmetric pose with weight on one leg and thinking gestures',
  tags: ['contemplative', 'thinking', 'pose', 'idle'],
  author: 'posers',
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

interface ContemplativeLeanState {
  noise: NoiseGenerator
  weightSpring: Spring
  headSpring: Spring
  armSpring: Spring
  blinkTimer: number
  isBlinking: boolean
  thinkingGestureTimer: number
  currentGesture: 'idle' | 'head_tilt' | 'chin_tap' | 'look_away'
  gestureDuration: number
}

function initState(seed: number): ContemplativeLeanState {
  return {
    noise: createNoiseGenerator(seed),
    weightSpring: createSpring({ stiffness: 30, damping: 12 }),
    headSpring: createSpring({ stiffness: 50, damping: 15 }),
    armSpring: createSpring({ stiffness: 40, damping: 10 }),
    blinkTimer: 0,
    isBlinking: false,
    thinkingGestureTimer: 0,
    currentGesture: 'idle',
    gestureDuration: 3,
  }
}

// ============================================================================
// POSE VARIANTS
// ============================================================================

interface ArmPose {
  leftUpperArm: { x: number; y: number; z: number }
  leftLowerArm: { x: number; y: number; z: number }
  leftHand: { x: number; y: number; z: number }
  rightUpperArm: { x: number; y: number; z: number }
  rightLowerArm: { x: number; y: number; z: number }
  rightHand: { x: number; y: number; z: number }
  leftFingers: { thumb: number; index: number; middle: number; ring: number; little: number }
  rightFingers: { thumb: number; index: number; middle: number; ring: number; little: number }
}

function getArmPose(variant: string, intensity: number): ArmPose {
  switch (variant) {
    case 'chin_rest':
      return {
        // Right arm: hand to chin
        rightUpperArm: { x: -0.8 * intensity, y: 0, z: -0.4 * intensity },
        rightLowerArm: { x: 0, y: 1.3 * intensity, z: 0 },
        rightHand: { x: 0.2 * intensity, y: 0, z: 0.1 * intensity },
        // Left arm: support under right elbow
        leftUpperArm: { x: 0.3 * intensity, y: 0, z: 0.25 * intensity },
        leftLowerArm: { x: 0, y: -1.0 * intensity, z: 0 },
        leftHand: { x: 0, y: 0, z: 0.15 * intensity },
        // Fingers
        rightFingers: { thumb: 0.2, index: 0.15, middle: 0.35, ring: 0.5, little: 0.55 },
        leftFingers: { thumb: 0.3, index: 0.35, middle: 0.4, ring: 0.45, little: 0.5 },
      }

    case 'crossed_arms':
      return {
        rightUpperArm: { x: 0.5 * intensity, y: 0, z: -0.35 * intensity },
        rightLowerArm: { x: 0, y: 1.4 * intensity, z: 0 },
        rightHand: { x: 0, y: 0, z: -0.2 * intensity },
        leftUpperArm: { x: 0.4 * intensity, y: 0, z: 0.25 * intensity },
        leftLowerArm: { x: 0, y: -1.3 * intensity, z: 0 },
        leftHand: { x: 0, y: 0, z: 0.15 * intensity },
        rightFingers: { thumb: 0.2, index: 0.25, middle: 0.3, ring: 0.35, little: 0.4 },
        leftFingers: { thumb: 0.25, index: 0.3, middle: 0.35, ring: 0.4, little: 0.45 },
      }

    case 'akimbo':
      return {
        rightUpperArm: { x: 0.15 * intensity, y: 0, z: -0.5 * intensity },
        rightLowerArm: { x: 0, y: 1.4 * intensity, z: 0 },
        rightHand: { x: -0.3 * intensity, y: 0, z: 0 },
        leftUpperArm: { x: 0.15 * intensity, y: 0, z: 0.5 * intensity },
        leftLowerArm: { x: 0, y: -1.4 * intensity, z: 0 },
        leftHand: { x: -0.3 * intensity, y: 0, z: 0 },
        rightFingers: { thumb: 0.1, index: 0.15, middle: 0.2, ring: 0.25, little: 0.3 },
        leftFingers: { thumb: 0.1, index: 0.15, middle: 0.2, ring: 0.25, little: 0.3 },
      }

    case 'hand_on_hip':
      return {
        // Right hand on hip
        rightUpperArm: { x: 0.2 * intensity, y: 0, z: -0.45 * intensity },
        rightLowerArm: { x: 0, y: 1.3 * intensity, z: 0 },
        rightHand: { x: -0.25 * intensity, y: 0, z: -0.1 * intensity },
        // Left arm relaxed
        leftUpperArm: { x: 0.05 * intensity, y: 0, z: 0.12 * intensity },
        leftLowerArm: { x: 0, y: -0.15 * intensity, z: 0 },
        leftHand: { x: 0, y: 0, z: 0.1 * intensity },
        rightFingers: { thumb: 0.15, index: 0.2, middle: 0.25, ring: 0.3, little: 0.35 },
        leftFingers: { thumb: 0.25, index: 0.3, middle: 0.35, ring: 0.4, little: 0.45 },
      }

    default:
      return getArmPose('chin_rest', intensity)
  }
}

// ============================================================================
// MOTION IMPLEMENTATION
// ============================================================================

/**
 * Creates a contemplative lean motion with multiple pose variants.
 *
 * BONE HANDLING STRATEGY:
 * - Every bone rotation is guarded by rig.hasBone() checks
 * - Missing optional bones (jaw, eyes, toes, fingers) are gracefully skipped
 * - Dynamic bone names (weightLeg, relaxLeg) are cast and checked
 * - The animation degrades gracefully when bones are unavailable
 *
 * DETERMINISM:
 * - All noise functions are seeded from ctx.seed
 * - Same seed produces identical animation every time
 * - Gesture selection is deterministic via seeded noise
 *
 * PERFORMANCE:
 * - All computations are O(1) per frame
 * - Spring physics use efficient semi-implicit Euler integration
 * - Pose variant lookup is constant time
 * - No allocations in hot path except quaternion creation
 *
 * TRANSITIONS:
 * - Thinking gesture state machine provides fluid transitions
 * - Gesture weights use sine easing for smooth in/out
 * - Springs smooth all micro-movements
 */
export function createContemplativeLean(params: ContemplativeLeanInput = {}): MotionProgram<ContemplativeLeanParams> {
  const validatedParams = contemplativeLeanParamsSchema.parse(params)
  let state: ContemplativeLeanState | null = null

  return {
    meta: contemplativeLeanMeta,
    paramsSchema: contemplativeLeanParamsSchema,

    init(_rig: HumanoidRig, ctx: MotionContext): void {
      state = initState(ctx.seed)
    },

    update(rig: HumanoidRig, ctx: MotionContext, t: number, dt: number): void {
      if (!state) {
        state = initState(ctx.seed)
      }

      const {
        poseVariant,
        thoughtIntensity,
        breathDepth,
        fidgetAmount,
        weightLeg,
        intensity,
        eyeMovement,
        headTilts,
      } = validatedParams

      const noise = state.noise
      const isRightWeight = weightLeg === 'right'
      const weightSide = isRightWeight ? 1 : -1

      // ========================================
      // THINKING GESTURE STATE MACHINE
      // ========================================

      state.thinkingGestureTimer += dt
      if (state.thinkingGestureTimer > state.gestureDuration) {
        state.thinkingGestureTimer = 0
        state.gestureDuration = 2 + noise.noise2D(t, 50) * 3

        // Pick next gesture
        const gestureRoll = noise.noise2D(t, 100)
        if (gestureRoll > 0.7 && headTilts) {
          state.currentGesture = 'head_tilt'
        } else if (gestureRoll > 0.4 && poseVariant === 'chin_rest') {
          state.currentGesture = 'chin_tap'
        } else if (gestureRoll > 0.2) {
          state.currentGesture = 'look_away'
        } else {
          state.currentGesture = 'idle'
        }
      }

      const gestureProgress = state.thinkingGestureTimer / state.gestureDuration
      const gestureWeight = Math.sin(gestureProgress * Math.PI) * thoughtIntensity

      // ========================================
      // LAYER 1: ASYMMETRIC WEIGHT DISTRIBUTION
      // ========================================

      // Hip drop on non-weight-bearing side
      const hipDrop = 0.06 * intensity * weightSide
      const hipShift = 0.04 * intensity * weightSide

      // Subtle weight shift noise
      const weightNoise = noise.noise2D(t * 0.08, 200) * fidgetAmount * 0.02
      state.weightSpring.setTarget(hipShift + weightNoise)
      state.weightSpring.update(dt)

      if (rig.hasBone('hips')) {
        const hipsRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, hipDrop + state.weightSpring.value)
        hipsRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, weightSide * 0.03 * intensity))
        rig.setRotation('hips', hipsRot)
      }

      // ========================================
      // LAYER 2: SPINE (RELAXED, SLIGHT CURVE)
      // ========================================

      if (rig.hasBone('spine')) {
        const spineRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -hipDrop * 0.3)
        spineRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.03 * intensity))
        rig.setRotation('spine', spineRot)
      }

      if (rig.hasBone('chest')) {
        const chestRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -hipDrop * 0.2)
        chestRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.02 * intensity))
        rig.setRotation('chest', chestRot)
      }

      if (rig.hasBone('upperChest')) {
        rig.setRotation('upperChest', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -hipDrop * 0.1))
      }

      // ========================================
      // LAYER 3: DEEP CONTEMPLATIVE BREATHING
      // ========================================

      const breathPhase = oscBreathing(t, 0.12, breathDepth)

      if (rig.hasBone('chest')) {
        rig.addRotation('chest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, breathPhase * 0.025))
      }
      if (rig.hasBone('upperChest')) {
        rig.addRotation('upperChest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, breathPhase * 0.035))
      }

      // Shoulder rise with breath
      const shoulderBreath = breathPhase * 0.012
      if (rig.hasBone('leftShoulder')) {
        rig.setRotation('leftShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -shoulderBreath))
      }
      if (rig.hasBone('rightShoulder')) {
        rig.setRotation('rightShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, shoulderBreath))
      }

      // ========================================
      // LAYER 4: LEGS (WEIGHT DISTRIBUTION)
      // ========================================

      // Weight-bearing leg: straight
      // Non-weight leg: bent, relaxed

      const weightLegBone = isRightWeight ? 'rightUpperLeg' : 'leftUpperLeg'
      const relaxLegBone = isRightWeight ? 'leftUpperLeg' : 'rightUpperLeg'
      const weightKnee = isRightWeight ? 'rightLowerLeg' : 'leftLowerLeg'
      const relaxKnee = isRightWeight ? 'leftLowerLeg' : 'rightLowerLeg'
      const weightFoot = isRightWeight ? 'rightFoot' : 'leftFoot'
      const relaxFoot = isRightWeight ? 'leftFoot' : 'rightFoot'

      if (rig.hasBone(weightLegBone as VRMHumanBoneName)) {
        // Slight hip flexion on weight-bearing side
        rig.setRotation(weightLegBone as VRMHumanBoneName,
          quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.02 * intensity))
      }

      if (rig.hasBone(relaxLegBone as VRMHumanBoneName)) {
        // Relaxed leg forward and slightly bent
        const relaxRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.15 * intensity)
        relaxRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -weightSide * 0.08 * intensity))
        rig.setRotation(relaxLegBone as VRMHumanBoneName, relaxRot)
      }

      if (rig.hasBone(weightKnee as VRMHumanBoneName)) {
        // Straight-ish weight-bearing knee
        rig.setRotation(weightKnee as VRMHumanBoneName,
          quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -0.03 * intensity))
      }

      if (rig.hasBone(relaxKnee as VRMHumanBoneName)) {
        // Bent relaxed knee
        rig.setRotation(relaxKnee as VRMHumanBoneName,
          quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -0.2 * intensity))
      }

      // Feet
      if (rig.hasBone(weightFoot as VRMHumanBoneName)) {
        rig.setRotation(weightFoot as VRMHumanBoneName,
          quatFromAxisAngle({ x: 0, y: 1, z: 0 }, weightSide * 0.08))
      }

      if (rig.hasBone(relaxFoot as VRMHumanBoneName)) {
        // Relaxed foot on ball/toe
        const relaxFootRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -0.15 * intensity)
        relaxFootRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -weightSide * 0.1))
        rig.setRotation(relaxFoot as VRMHumanBoneName, relaxFootRot)
      }

      // Toes
      const weightToes = isRightWeight ? 'rightToes' : 'leftToes'
      const relaxToes = isRightWeight ? 'leftToes' : 'rightToes'

      if (rig.hasBone(weightToes as VRMHumanBoneName)) {
        rig.setRotation(weightToes as VRMHumanBoneName,
          quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.05))
      }
      if (rig.hasBone(relaxToes as VRMHumanBoneName)) {
        rig.setRotation(relaxToes as VRMHumanBoneName,
          quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -0.1 * intensity))
      }

      // ========================================
      // LAYER 5: ARMS (POSE VARIANT)
      // ========================================

      const armPose = getArmPose(poseVariant, intensity)

      // Add subtle arm movement/fidget
      const armFidget = noise.noise2D(t * 0.15, 300) * fidgetAmount * 0.02
      state.armSpring.setTarget(armFidget)
      state.armSpring.update(dt)
      const armNoise = state.armSpring.value

      if (rig.hasBone('leftUpperArm')) {
        const rot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, armPose.leftUpperArm.x)
        rot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, armPose.leftUpperArm.y + armNoise))
        rot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, armPose.leftUpperArm.z))
        rig.setRotation('leftUpperArm', rot)
      }

      if (rig.hasBone('leftLowerArm')) {
        const rot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, armPose.leftLowerArm.x)
        rot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, armPose.leftLowerArm.y))
        rot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, armPose.leftLowerArm.z))
        rig.setRotation('leftLowerArm', rot)
      }

      if (rig.hasBone('leftHand')) {
        const rot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, armPose.leftHand.x)
        rot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, armPose.leftHand.y))
        rot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, armPose.leftHand.z))
        rig.setRotation('leftHand', rot)
      }

      if (rig.hasBone('rightUpperArm')) {
        const rot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, armPose.rightUpperArm.x)
        rot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, armPose.rightUpperArm.y - armNoise))
        rot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, armPose.rightUpperArm.z))
        rig.setRotation('rightUpperArm', rot)
      }

      if (rig.hasBone('rightLowerArm')) {
        // Add chin tap gesture for chin_rest variant
        let chinTapAdd = 0
        if (poseVariant === 'chin_rest' && state.currentGesture === 'chin_tap') {
          chinTapAdd = Math.sin(state.thinkingGestureTimer * 6) * 0.05 * gestureWeight
        }

        const rot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, armPose.rightLowerArm.x)
        rot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, armPose.rightLowerArm.y + chinTapAdd))
        rot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, armPose.rightLowerArm.z))
        rig.setRotation('rightLowerArm', rot)
      }

      if (rig.hasBone('rightHand')) {
        const rot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, armPose.rightHand.x)
        rot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, armPose.rightHand.y))
        rot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, armPose.rightHand.z))
        rig.setRotation('rightHand', rot)
      }

      // ========================================
      // LAYER 5B: DETAILED FINGER ANIMATION
      // ========================================
      // Animate all 30 finger bones (15 per hand) with pose-specific positioning
      // Each finger has 3 joints: Proximal, Intermediate, Distal
      // Bones: thumb/index/middle/ring/little + Proximal/Intermediate/Distal
      //
      // Apply base finger curl from pose, plus subtle micro-movements

      // Add subtle finger fidget for organic feel
      const fingerFidget = noise.noise2D(t * 0.25, 1100) * fidgetAmount * 0.1

      // Left hand finger bones - explicit animation of all joints
      const leftFingerCurl = {
        thumb: armPose.leftFingers.thumb + fingerFidget * 0.3,
        index: armPose.leftFingers.index + fingerFidget * 0.5,
        middle: armPose.leftFingers.middle + fingerFidget * 0.6,
        ring: armPose.leftFingers.ring + fingerFidget * 0.7,
        little: armPose.leftFingers.little + fingerFidget * 0.8,
      }

      // Right hand finger bones - with thinking gesture adjustments
      const thinkingFingerMod = state.currentGesture === 'chin_tap' ? gestureWeight * 0.1 : 0
      const rightFingerCurl = {
        thumb: armPose.rightFingers.thumb + thinkingFingerMod,
        index: armPose.rightFingers.index + thinkingFingerMod * 1.5, // Index finger more active in chin tap
        middle: armPose.rightFingers.middle + thinkingFingerMod * 0.8,
        ring: armPose.rightFingers.ring + fingerFidget * 0.5,
        little: armPose.rightFingers.little + fingerFidget * 0.6,
      }

      // Apply finger curls - this internally handles all 15 bones per hand
      // with hasBone() checks for each: Proximal, Intermediate, Distal joints
      applyFingerCurl(rig, 'left', leftFingerCurl)
      applyFingerCurl(rig, 'right', rightFingerCurl)

      // ========================================
      // LAYER 6: HEAD & NECK (THINKING)
      // ========================================

      let headTiltX = 0.02 * intensity // Slight down
      let headTiltY = 0
      let headTiltZ = 0.03 * intensity * weightSide // Tilt toward weight side

      // Add thinking gestures
      if (state.currentGesture === 'head_tilt') {
        headTiltZ += gestureWeight * 0.05 * (noise.noise2D(t, 400) > 0 ? 1 : -1)
        headTiltX += gestureWeight * 0.03
      } else if (state.currentGesture === 'look_away') {
        headTiltY = gestureWeight * 0.1 * (noise.noise2D(t, 500) > 0 ? 1 : -1)
      }

      // Micro-movement
      const headMicroX = noise.noise2D(t * 0.2, 600) * 0.01 * intensity
      const headMicroY = noise.noise2D(t * 0.15, 700) * 0.015 * intensity

      state.headSpring.setTarget(headTiltY + headMicroY)
      state.headSpring.update(dt)

      if (rig.hasBone('head')) {
        const headRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, headTiltX + headMicroX)
        headRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, state.headSpring.value))
        headRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, headTiltZ))
        rig.setRotation('head', headRot)
      }

      if (rig.hasBone('neck')) {
        const neckRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, headTiltX * 0.5)
        neckRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, state.headSpring.value * 0.4))
        neckRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, headTiltZ * 0.3))
        rig.setRotation('neck', neckRot)
      }

      // ========================================
      // LAYER 7: EYES (CONTEMPLATIVE GAZE)
      // ========================================

      if (eyeMovement) {
        // Slow, distant gaze with occasional focus shifts
        let eyeX = 0
        let eyeY = 0.02 * intensity // Slight downward gaze

        if (state.currentGesture === 'look_away') {
          eyeX = gestureWeight * 0.1 * (noise.noise2D(t, 800) > 0 ? 1 : -1)
        } else {
          eyeX = noise.noise2D(t * 0.1, 900) * 0.04 * intensity
          eyeY += noise.noise2D(t * 0.08, 1000) * 0.02 * intensity
        }

        // Slow blinking (contemplative)
        const blinkChance = noise.noise2D(t * 0.2, 1100)
        if (!state.isBlinking && blinkChance > 0.92) {
          state.isBlinking = true
          state.blinkTimer = 0
        }

        let blinkAmount = 0
        if (state.isBlinking) {
          state.blinkTimer += dt
          const blinkDuration = 0.2 // Slower, contemplative blink
          if (state.blinkTimer > blinkDuration) {
            state.isBlinking = false
          } else {
            blinkAmount = Math.sin(state.blinkTimer / blinkDuration * Math.PI) * 0.25
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
      }

      // ========================================
      // LAYER 8: JAW (OCCASIONAL SUBTLE MOVEMENT)
      // ========================================

      if (rig.hasBone('jaw')) {
        // Very subtle jaw movement as if thinking words
        const jawThink = noise.noise2D(t * 0.3, 1200) > 0.85
          ? noise.noise2D(t * 2, 1300) * 0.02 * thoughtIntensity
          : 0
        rig.setRotation('jaw', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, jawThink))
      }
    },
  }
}

export const contemplativeLean: MotionProgram<ContemplativeLeanParams> = createContemplativeLean({})
