/**
 * Smoking Cigarette Motion
 *
 * Complete smoking animation with state machine for different phases:
 * idle holding, bring to mouth, inhale, hold, exhale, lower, ash tap.
 *
 * Research basis:
 * - Smoking biomechanics studies
 * - Hand-to-mouth coordination patterns
 * - Respiratory mechanics during smoking
 * - Habitual gesture timing
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
  SpringPresets,
  type NoiseGenerator,
  type Spring,
} from '@posers/core'
import {
  BoneChains,
  applyCigaretteGrip,
  applyFingerCurl,
} from '../blend'

// ============================================================================
// SCHEMA & TYPES
// ============================================================================

export const smokingCigaretteParamsSchema = z.object({
  /** Smoking style: casual, stressed, or seductive. Default: casual */
  smokingStyle: z.enum(['casual', 'stressed', 'seductive']).default('casual'),
  /** Which hand holds the cigarette. Default: right */
  handedness: z.enum(['left', 'right']).default('right'),
  /** Depth of inhale (0-1). Default: 0.7 */
  inhaleDepth: z.number().min(0).max(1).default(0.7),
  /** Variation in pacing (0-1). Default: 0.3 */
  paceVariation: z.number().min(0).max(1).default(0.3),
  /** Overall animation intensity (0-1). Default: 0.8 */
  intensity: z.number().min(0).max(1).default(0.8),
  /** Enable eye squint during inhale. Default: true */
  eyeSquint: z.boolean().default(true),
  /** Enable jaw animation during exhale. Default: true */
  jawAnimation: z.boolean().default(true),
  /** Time between puffs in seconds. Default: 8 */
  puffInterval: z.number().min(3).max(20).default(8),
})

export type SmokingCigaretteParams = z.infer<typeof smokingCigaretteParamsSchema>
export type SmokingCigaretteInput = z.input<typeof smokingCigaretteParamsSchema>

export const smokingCigaretteMeta: MotionMeta = {
  id: 'smoking-cigarette',
  name: 'Smoking Cigarette',
  description: 'Complete smoking animation with hand-to-mouth, inhale, exhale phases',
  tags: ['smoking', 'gesture', 'complex', 'state-machine'],
  author: 'posers',
}

// ============================================================================
// STATE MACHINE
// ============================================================================

type SmokingPhase =
  | 'idle'           // Holding cigarette at side
  | 'bring_to_mouth' // Raising arm to mouth
  | 'inhale'         // Taking a drag
  | 'hold'           // Holding smoke
  | 'exhale'         // Breathing out
  | 'lower'          // Lowering arm
  | 'ash_tap'        // Tapping ash off

interface SmokingState {
  noise: NoiseGenerator
  phase: SmokingPhase
  phaseTime: number
  phaseDuration: number
  armSpringX: Spring
  armSpringY: Spring
  armSpringZ: Spring
  wristSpring: Spring
  chestSpring: Spring
  lastPuffTime: number
  ashTapPending: boolean
  blinkTimer: number
  isBlinking: boolean
}

const PHASE_DURATIONS = {
  idle: { base: 6, variance: 2 },
  bring_to_mouth: { base: 0.8, variance: 0.2 },
  inhale: { base: 1.5, variance: 0.3 },
  hold: { base: 0.8, variance: 0.3 },
  exhale: { base: 2.0, variance: 0.4 },
  lower: { base: 0.6, variance: 0.15 },
  ash_tap: { base: 0.4, variance: 0.1 },
}

function initState(seed: number): SmokingState {
  return {
    noise: createNoiseGenerator(seed),
    phase: 'idle',
    phaseTime: 0,
    phaseDuration: PHASE_DURATIONS.idle.base,
    armSpringX: createSpring(SpringPresets.smooth),
    armSpringY: createSpring(SpringPresets.smooth),
    armSpringZ: createSpring(SpringPresets.smooth),
    wristSpring: createSpring({ stiffness: 250, damping: 22 }),
    chestSpring: createSpring({ stiffness: 100, damping: 18 }),
    lastPuffTime: -10,
    ashTapPending: false,
    blinkTimer: 0,
    isBlinking: false,
  }
}

function getNextPhase(current: SmokingPhase, ashTapPending: boolean): SmokingPhase {
  switch (current) {
    case 'idle': return 'bring_to_mouth'
    case 'bring_to_mouth': return 'inhale'
    case 'inhale': return 'hold'
    case 'hold': return 'exhale'
    case 'exhale': return ashTapPending ? 'ash_tap' : 'lower'
    case 'lower': return 'idle'
    case 'ash_tap': return 'lower'
  }
}

function getPhaseDuration(phase: SmokingPhase, variation: number, noise: NoiseGenerator, t: number): number {
  const { base, variance } = PHASE_DURATIONS[phase]
  return base + noise.noise2D(t, phase.length * 100) * variance * variation
}

// ============================================================================
// MOTION IMPLEMENTATION
// ============================================================================

/**
 * Creates a smoking cigarette motion with complete state machine.
 *
 * STATE MACHINE PHASES:
 * - idle: Holding cigarette at side, relaxed posture
 * - bring_to_mouth: Spring-animated arm raise to face
 * - inhale: Taking a drag, chest expansion, eye squint
 * - hold: Brief pause holding smoke, slight arm lower
 * - exhale: Slow breath out, jaw animation, arm stays high
 * - lower: Return arm to idle position
 * - ash_tap: Optional wrist flick to tap ash (random trigger)
 *
 * TRANSITIONS:
 * - All transitions are time-based with phase duration + variance
 * - Spring physics ensure smooth arm movement between states
 * - Phase progress is used for easing within each state
 * - idle → bring_to_mouth → inhale → hold → exhale → (ash_tap?) → lower → idle
 *
 * BONE HANDLING STRATEGY:
 * - Every bone rotation is guarded by rig.hasBone() checks
 * - Dynamic bone names (smokingArm, supportArm) are cast and checked
 * - Missing optional bones (jaw, eyes, fingers) are gracefully skipped
 * - The animation degrades gracefully when bones are unavailable
 *
 * DETERMINISM:
 * - All noise functions are seeded from ctx.seed
 * - Ash tap triggering uses seeded noise
 * - Phase duration variance uses seeded noise
 *
 * SECONDARY MOTION:
 * - Finger positions for cigarette grip via applyCigaretteGrip
 * - Wrist rotation during state transitions
 * - Chest expansion/contraction with breathing phases
 */
export function createSmokingCigarette(params: SmokingCigaretteInput = {}): MotionProgram<SmokingCigaretteParams> {
  const validatedParams = smokingCigaretteParamsSchema.parse(params)
  let state: SmokingState | null = null

  return {
    meta: smokingCigaretteMeta,
    paramsSchema: smokingCigaretteParamsSchema,

    init(_rig: HumanoidRig, ctx: MotionContext): void {
      state = initState(ctx.seed)
    },

    update(rig: HumanoidRig, ctx: MotionContext, t: number, dt: number): void {
      if (!state) {
        state = initState(ctx.seed)
      }

      const {
        smokingStyle,
        handedness,
        inhaleDepth,
        paceVariation,
        intensity,
        eyeSquint,
        jawAnimation,
        puffInterval,
      } = validatedParams

      const noise = state.noise
      const isRightHanded = handedness === 'right'
      const handSide = isRightHanded ? 1 : -1

      // Style modifiers
      const styleModifiers = {
        casual: { speed: 1, tension: 0.3, lean: 0 },
        stressed: { speed: 1.3, tension: 0.7, lean: 0.05 },
        seductive: { speed: 0.7, tension: 0.2, lean: -0.03 },
      }[smokingStyle]

      // ========================================
      // STATE MACHINE UPDATE
      // ========================================

      state.phaseTime += dt

      // Check for phase transition
      if (state.phaseTime >= state.phaseDuration) {
        const nextPhase = getNextPhase(state.phase, state.ashTapPending)
        state.phase = nextPhase
        state.phaseTime = 0
        state.phaseDuration = getPhaseDuration(nextPhase, paceVariation, noise, t) / styleModifiers.speed

        if (nextPhase === 'idle') {
          state.lastPuffTime = t
          // Randomly decide if next cycle should include ash tap
          state.ashTapPending = noise.noise2D(t, 500) > 0.7
        }
      }

      // Force transition if puff interval exceeded during idle
      if (state.phase === 'idle' && (t - state.lastPuffTime) > puffInterval) {
        state.phase = 'bring_to_mouth'
        state.phaseTime = 0
        state.phaseDuration = getPhaseDuration('bring_to_mouth', paceVariation, noise, t) / styleModifiers.speed
      }

      const phaseProgress = Math.min(1, state.phaseTime / state.phaseDuration)

      // ========================================
      // LAYER 1: BASE POSTURE
      // ========================================

      // Style-based lean
      if (rig.hasBone('hips')) {
        const leanAmount = styleModifiers.lean * intensity
        rig.setRotation('hips', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, leanAmount))
      }

      // Relaxed spine
      if (rig.hasBone('spine')) {
        rig.setRotation('spine', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.02 * intensity))
      }

      // ========================================
      // LAYER 2: ARM MOVEMENT (SPRING-BASED)
      // ========================================

      // Define arm targets for each phase
      let armTargetX = 0 // Forward/back rotation
      let armTargetY = 0 // Abduction
      let armTargetZ = 0 // Twist
      let elbowBend = 0.2 * intensity
      let wristRotation = 0

      const smokingArm = isRightHanded ? 'right' : 'left'
      const supportArm = isRightHanded ? 'left' : 'right'

      switch (state.phase) {
        case 'idle':
          armTargetX = 0.1 * intensity
          armTargetY = 0.15 * intensity
          armTargetZ = 0
          elbowBend = 0.3 * intensity
          wristRotation = 0.1 * handSide
          break

        case 'bring_to_mouth':
          const raiseEase = Easing.armRaise(phaseProgress)
          armTargetX = -0.5 * intensity * raiseEase
          armTargetY = 0.4 * intensity * raiseEase
          armTargetZ = handSide * 0.2 * intensity * raiseEase
          elbowBend = 1.4 * intensity * raiseEase
          wristRotation = handSide * 0.3 * raiseEase
          break

        case 'inhale':
          armTargetX = -0.5 * intensity
          armTargetY = 0.4 * intensity
          armTargetZ = handSide * 0.2 * intensity
          elbowBend = 1.4 * intensity
          wristRotation = handSide * 0.3
          break

        case 'hold':
          // Slight arm lower while holding + SECONDARY MOTION
          // During hold, add subtle micro-movements for organic feel
          const holdProgress = Easing.easeInOutCubic(phaseProgress)

          // Secondary motion: subtle arm drift and finger adjustments
          const holdMicroX = noise.noise2D(t * 0.5, 250) * 0.015 * intensity
          const holdMicroY = noise.noise2D(t * 0.4, 260) * 0.01 * intensity
          const holdMicroZ = noise.noise2D(t * 0.3, 270) * 0.008 * intensity
          const holdWristMicro = noise.noise2D(t * 0.6, 280) * 0.02 * intensity

          armTargetX = -0.4 * intensity + holdMicroX
          armTargetY = 0.35 * intensity + holdMicroY
          armTargetZ = handSide * 0.18 * intensity + holdMicroZ
          elbowBend = 1.3 * intensity
          wristRotation = handSide * 0.25 + holdWristMicro
          break

        case 'exhale':
          // Arm stays relatively high during exhale
          const exhaleProgress = Easing.easeInOutCubic(phaseProgress)
          armTargetX = -0.35 * intensity * (1 - exhaleProgress * 0.5)
          armTargetY = 0.3 * intensity * (1 - exhaleProgress * 0.3)
          armTargetZ = handSide * 0.15 * intensity
          elbowBend = 1.1 * intensity * (1 - exhaleProgress * 0.3)
          wristRotation = handSide * 0.2
          break

        case 'lower':
          const lowerEase = Easing.easeInCubic(phaseProgress)
          armTargetX = 0.1 * intensity * lowerEase
          armTargetY = 0.15 * intensity * lowerEase
          armTargetZ = 0
          elbowBend = 0.3 * intensity * lowerEase + 1.1 * intensity * (1 - lowerEase)
          wristRotation = handSide * 0.1 * lowerEase
          break

        case 'ash_tap':
          // Quick wrist flick
          const tapEase = Math.sin(phaseProgress * Math.PI * 2)
          armTargetX = 0.1 * intensity
          armTargetY = 0.15 * intensity
          armTargetZ = 0
          elbowBend = 0.4 * intensity
          wristRotation = handSide * 0.1 + tapEase * 0.3 * handSide
          break
      }

      // Apply spring smoothing to arm movements
      state.armSpringX.setTarget(armTargetX)
      state.armSpringY.setTarget(armTargetY)
      state.armSpringZ.setTarget(armTargetZ)
      state.wristSpring.setTarget(wristRotation)

      state.armSpringX.update(dt)
      state.armSpringY.update(dt)
      state.armSpringZ.update(dt)
      state.wristSpring.update(dt)

      const smoothArmX = state.armSpringX.value
      const smoothArmY = state.armSpringY.value
      const smoothArmZ = state.armSpringZ.value
      const smoothWrist = state.wristSpring.value

      // Apply smoking arm
      const upperArmBone = `${smokingArm}UpperArm` as VRMHumanBoneName
      const lowerArmBone = `${smokingArm}LowerArm` as VRMHumanBoneName
      const handBone = `${smokingArm}Hand` as VRMHumanBoneName
      const shoulderBone = `${smokingArm}Shoulder` as VRMHumanBoneName

      if (rig.hasBone(shoulderBone)) {
        rig.setRotation(shoulderBone, quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -handSide * smoothArmY * 0.15))
      }

      if (rig.hasBone(upperArmBone)) {
        const upperArmRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, smoothArmX)
        upperArmRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -handSide * smoothArmY))
        upperArmRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, smoothArmZ))
        rig.setRotation(upperArmBone, upperArmRot)
      }

      if (rig.hasBone(lowerArmBone)) {
        rig.setRotation(lowerArmBone, quatFromAxisAngle({ x: 0, y: 1, z: 0 }, handSide * elbowBend))
      }

      if (rig.hasBone(handBone)) {
        const handRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, smoothWrist)
        // Slight wrist extension when holding cigarette up
        const wristExtension = (state.phase === 'inhale' || state.phase === 'hold') ? 0.15 : 0
        handRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, wristExtension))
        rig.setRotation(handBone, handRot)
      }

      // Apply cigarette grip to smoking hand
      applyCigaretteGrip(rig, smokingArm as 'left' | 'right', 'between')

      // Support arm - relaxed or crossed
      const supportUpperArm = `${supportArm}UpperArm` as VRMHumanBoneName
      const supportLowerArm = `${supportArm}LowerArm` as VRMHumanBoneName

      if (smokingStyle === 'seductive') {
        // Arm crossed under
        if (rig.hasBone(supportUpperArm)) {
          const supportRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.4 * intensity)
          supportRot.multiply(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, handSide * 0.3 * intensity))
          rig.setRotation(supportUpperArm, supportRot)
        }
        if (rig.hasBone(supportLowerArm)) {
          rig.setRotation(supportLowerArm, quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -handSide * 1.2 * intensity))
        }
      } else {
        // Relaxed at side
        if (rig.hasBone(supportUpperArm)) {
          rig.setRotation(supportUpperArm, quatFromAxisAngle({ x: 0, y: 0, z: 1 }, handSide * 0.08))
        }
        if (rig.hasBone(supportLowerArm)) {
          rig.setRotation(supportLowerArm, quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -handSide * 0.15))
        }
        // Relaxed fingers on support hand
        applyFingerCurl(rig, supportArm as 'left' | 'right', {
          thumb: 0.3,
          index: 0.35,
          middle: 0.4,
          ring: 0.45,
          little: 0.5,
        })
      }

      // ========================================
      // LAYER 3: BREATHING & CHEST
      // ========================================

      let chestExpansion = 0
      const baseBreath = oscBreathing(t, 0.2, 0.3) * intensity

      switch (state.phase) {
        case 'inhale':
          // Deep inhale - chest expands
          chestExpansion = Easing.easeInCubic(phaseProgress) * inhaleDepth * 0.06
          break
        case 'hold':
          // Held breath
          chestExpansion = inhaleDepth * 0.06
          break
        case 'exhale':
          // Slow exhale
          chestExpansion = inhaleDepth * 0.06 * (1 - Easing.easeOutCubic(phaseProgress))
          break
        default:
          chestExpansion = baseBreath * 0.02
      }

      state.chestSpring.setTarget(chestExpansion)
      state.chestSpring.update(dt)
      const smoothChest = state.chestSpring.value

      if (rig.hasBone('chest')) {
        rig.setRotation('chest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -smoothChest))
      }
      if (rig.hasBone('upperChest')) {
        rig.setRotation('upperChest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -smoothChest * 1.5))
      }

      // Shoulders rise with inhale
      const shoulderRise = state.phase === 'inhale' ? phaseProgress * 0.02 * inhaleDepth : 0
      if (rig.hasBone('leftShoulder')) {
        rig.addRotation('leftShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -shoulderRise))
      }
      if (rig.hasBone('rightShoulder')) {
        rig.addRotation('rightShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, shoulderRise))
      }

      // ========================================
      // LAYER 4: HEAD MOVEMENT
      // ========================================

      let headTiltX = 0
      let headTiltY = 0

      switch (state.phase) {
        case 'inhale':
          // Slight head tilt back during inhale
          headTiltX = -0.05 * phaseProgress * intensity
          break
        case 'exhale':
          // Head forward/up for exhale
          headTiltX = 0.03 * (1 - phaseProgress) * intensity
          headTiltY = handSide * 0.02 * phaseProgress * intensity
          break
        default:
          // Subtle idle movement
          headTiltX = noise.noise2D(t * 0.2, 600) * 0.02 * intensity
          headTiltY = noise.noise2D(t * 0.15, 700) * 0.025 * intensity
      }

      if (rig.hasBone('head')) {
        const headRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, headTiltX)
        headRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, headTiltY))
        rig.setRotation('head', headRot)
      }
      if (rig.hasBone('neck')) {
        rig.setRotation('neck', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, headTiltX * 0.4))
      }

      // ========================================
      // LAYER 5: EYES
      // ========================================

      if (eyeSquint) {
        let eyeSquintAmount = 0

        if (state.phase === 'inhale') {
          eyeSquintAmount = phaseProgress * 0.15 * intensity
        } else if (state.phase === 'hold') {
          eyeSquintAmount = 0.15 * intensity
        } else if (state.phase === 'exhale') {
          eyeSquintAmount = 0.15 * intensity * (1 - phaseProgress)
        }

        // Eye rotation for squint effect
        if (rig.hasBone('leftEye')) {
          rig.setRotation('leftEye', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, eyeSquintAmount))
        }
        if (rig.hasBone('rightEye')) {
          rig.setRotation('rightEye', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, eyeSquintAmount))
        }
      }

      // Blinking
      const blinkChance = noise.noise2D(t * 0.3, 800)
      if (!state.isBlinking && blinkChance > 0.95) {
        state.isBlinking = true
        state.blinkTimer = 0
      }

      if (state.isBlinking) {
        state.blinkTimer += dt
        if (state.blinkTimer > 0.15) {
          state.isBlinking = false
        } else {
          const blinkProgress = Math.sin(state.blinkTimer / 0.15 * Math.PI)
          if (rig.hasBone('leftEye')) {
            rig.addRotation('leftEye', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -blinkProgress * 0.25))
          }
          if (rig.hasBone('rightEye')) {
            rig.addRotation('rightEye', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -blinkProgress * 0.25))
          }
        }
      }

      // ========================================
      // LAYER 6: JAW (EXHALE)
      // ========================================

      if (jawAnimation && rig.hasBone('jaw')) {
        let jawOpen = 0

        if (state.phase === 'exhale') {
          // Open slightly for exhale
          const exhaleJaw = Math.sin(phaseProgress * Math.PI) * 0.08 * intensity
          jawOpen = exhaleJaw
        }

        rig.setRotation('jaw', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, jawOpen))
      }

      // ========================================
      // LAYER 7: LEGS & WEIGHT
      // ========================================

      // Relaxed stance with slight weight shift
      const weightShift = noise.noise2D(t * 0.1, 900) * 0.03 * intensity

      if (rig.hasBone('leftUpperLeg')) {
        rig.setRotation('leftUpperLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.02 + weightShift))
      }
      if (rig.hasBone('rightUpperLeg')) {
        rig.setRotation('rightUpperLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.03 - weightShift))
      }
      if (rig.hasBone('leftLowerLeg')) {
        rig.setRotation('leftLowerLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -0.05))
      }
      if (rig.hasBone('rightLowerLeg')) {
        rig.setRotation('rightLowerLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -0.08))
      }

      // Feet slightly turned out
      if (rig.hasBone('leftFoot')) {
        rig.setRotation('leftFoot', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -0.1))
      }
      if (rig.hasBone('rightFoot')) {
        rig.setRotation('rightFoot', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, 0.15))
      }
    },
  }
}

export const smokingCigarette: MotionProgram<SmokingCigaretteParams> = createSmokingCigarette({})
