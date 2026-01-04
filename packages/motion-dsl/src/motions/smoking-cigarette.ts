/**
 * ============================================================================
 * SMOKING CIGARETTE MOTION
 * ============================================================================
 *
 * Complete smoking animation using overlapping phase envelopes (NOT state
 * machine). Hand raises to mouth, inhale expands chest, hold briefly, exhale
 * slowly, arm lowers with optional ash tap.
 *
 * ============================================================================
 * HOW THIS MOTION SHOULD FEEL
 * ============================================================================
 *
 * Think of a film noir character leaning against a doorframe, cigarette
 * dangling between fingers. The motion is unhurried, sensual even. The arm
 * drifts up to the mouth in a lazy arc. The inhale is deep and deliberate,
 * eyes narrowing slightly against the smoke. A pause - savoring - then the
 * slow exhale, smoke curling upward. The arm descends but never quite
 * returns to rest before the next pull.
 *
 * The key is OVERLAP. The exhale begins before the arm fully lowers. The
 * chest relaxation lags behind the breath. The wrist adjusts before the
 * elbow completes its motion. This creates the fluid, organic feel of a
 * habitual smoker rather than a robot performing discrete steps.
 *
 * ============================================================================
 * PHASE ENVELOPE ARCHITECTURE (NOT STATE MACHINE)
 * ============================================================================
 *
 * PUFF CYCLE: ~8 seconds total, overlapping phases
 *
 *   Time:    0   1   2   3   4   5   6   7   8
 *   armRaise:  ▁▁▄▇██▇▄▁▁▁▁▁▁▁▁▁▁
 *   inhale:       ▁▄▇██▇▄▁▁▁▁▁▁▁
 *   hold:            ▁▄▇██▇▄▁▁▁▁
 *   exhale:              ▁▄▇█▇▄▁▁
 *   armLower:                 ▁▄▇█▇▄▁
 *   ashTap:                    ▁▃▇▃▁ (optional, random)
 *
 * Each envelope is a smooth 0→1→0 curve (typically sine or smootherstep).
 * Overlaps ensure no discrete transitions.
 *
 * ============================================================================
 * TIMING RELATIONSHIPS (PERCENTAGES OF PUFF CYCLE)
 * ============================================================================
 * Note: All timings are percentages of puffInterval (default 8s).
 * Absolute times scale proportionally with puffInterval parameter.
 *
 * ARM RAISE: 0-30% of cycle (2.4s at default 8s)
 *   - Shoulder leads by ~3% phase (~240ms at 8s)
 *   - Elbow follows at base timing
 *   - Wrist trails by ~3% phase (~240ms at 8s)
 *   - Uses spring physics for natural deceleration at top
 *
 * INHALE: 10-40% of cycle (2.4s at default 8s)
 *   - Starts before arm reaches peak (overlap at ~10-30%)
 *   - Chest expansion leads (visible breath intake)
 *   - Shoulders rise after chest begins
 *   - Eyes squint gradually, peak at 80% of inhale phase
 *
 * HOLD: 35-55% of cycle (1.6s at default 8s)
 *   - Overlaps end of inhale and start of exhale
 *   - Arm micro-drifts with noise (not frozen)
 *   - Fingers maintain cigarette grip
 *
 * EXHALE: 45-85% of cycle (3.2s at default 8s)
 *   - Begins while arm still high (hold overlap)
 *   - Jaw opens slightly at 30% of exhale phase
 *   - Head tilts up/back for "blowing smoke up"
 *   - Chest deflates slower than inhale inflated
 *
 * ARM LOWER: 70-100% of cycle (2.4s at default 8s)
 *   - Begins at 70% (overlaps with exhale)
 *   - Wrist leads (cigarette tips forward first) - INVERTED from raise
 *   - Elbow follows at base timing
 *   - Shoulder trails (opposite of raise stagger)
 *
 * ASH TAP: 75-85% of cycle (0.8s at default 8s, random 30%)
 *   - Quick wrist flick during lower phase
 *   - Two oscillations (tap-tap)
 *
 * ============================================================================
 * BONE HANDLING
 * ============================================================================
 *
 * All bone access wrapped in hasBone() checks.
 *
 * SMOKING ARM: [side]Shoulder, [side]UpperArm, [side]LowerArm, [side]Hand
 *   + all 15 finger bones via applyCigaretteGrip helper
 *
 * SUPPORT ARM: Opposite side arm, relaxed or crossed (style-dependent)
 *   + all 15 finger bones via applyFingerCurl helper
 *
 * CORE: hips, spine, chest, upperChest, neck, head
 * LEGS: leftUpperLeg, rightUpperLeg, leftLowerLeg, rightLowerLeg
 * FEET: leftFoot, rightFoot
 * FACE: leftEye, rightEye, jaw
 *
 * ============================================================================
 * RESEARCH BASIS
 * ============================================================================
 *
 * - Bernstein, N. (1967): "The Co-ordination and Regulation of Movements" -
 *   Proximal joints initiate movement, distal joints follow (kinetic chain).
 *   Shoulder → elbow → wrist → fingers timing.
 *
 * - Smoking behavior studies show average puff duration 1.5-2s, inter-puff
 *   interval 20-60s for casual smoking. We compress to 8s for visual interest.
 *
 * - Hand-to-mouth gestures: Peak velocity at 40% of movement, smooth
 *   deceleration approaching target (Fitts's Law applied to natural motion).
 *
 * - Respiratory mechanics: Inhale 1.5-2s, exhale 2-3s (exhale longer than
 *   inhale for relaxed breathing).
 *
 * ============================================================================
 * NUMERICAL JUSTIFICATIONS
 * ============================================================================
 *
 * puffInterval 8s: Compressed from real 20-60s for visual engagement
 * armRaiseDuration 0.8s: Natural reach-to-mouth speed
 * inhaleDepth 0.06 rad: Visible but not exaggerated chest expansion
 * eyeSquint 0.15 rad: Subtle narrowing, not cartoonish
 * wristFlick 0.3 rad: 17° flick for ash tap (natural wrist range)
 * springStiffness smooth preset: ~180 for natural arm deceleration
 * phase overlap 30%: Ensures continuous blending between actions
 *
 * ============================================================================
 * KNOWN LIMITATIONS
 * ============================================================================
 *
 * IK TARGETING: This motion uses forward kinematics (FK) only. The hand
 * position is determined by joint rotations tuned for typical VRM proportions.
 * Without an IK solver, precise hand-to-mouth contact cannot be guaranteed
 * across all rig proportions. For production use:
 *   1. Consider integrating with an IK system (e.g., FABRIK, CCD)
 *   2. Or expose tunable arm/elbow angles for rig-specific adjustment
 *   3. The current values work well for standard VRM humanoid proportions
 *
 * The motion prioritizes natural-looking arm dynamics over precise targeting,
 * which is acceptable for most visualization purposes where the cigarette
 * reaching "close to" the mouth is sufficient.
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
  smootherstep,
  type NoiseGenerator,
  type Spring,
} from '@posers/core'
import {
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
  description: 'Complete smoking animation with overlapping phase envelopes for hand-to-mouth, inhale, exhale',
  tags: ['smoking', 'gesture', 'complex', 'phase-envelope'],
  author: 'posers',
}

// ============================================================================
// PHASE ENVELOPE TIMING
// ============================================================================

/**
 * Phase timing configuration - defines when each phase starts and ends
 * as a fraction of the total puff cycle.
 *
 * These overlap to create smooth blending between actions.
 */
const PHASE_TIMING = {
  // armRaise: starts at 0%, peaks at 15%, ends at 30%
  armRaise: { start: 0.0, peak: 0.15, end: 0.30 },
  // inhale: starts at 10%, peaks at 25%, ends at 40%
  inhale: { start: 0.10, peak: 0.25, end: 0.40 },
  // hold: starts at 35%, peaks at 45%, ends at 55%
  hold: { start: 0.35, peak: 0.45, end: 0.55 },
  // exhale: starts at 45%, peaks at 65%, ends at 85%
  exhale: { start: 0.45, peak: 0.65, end: 0.85 },
  // armLower: starts at 70%, peaks at 85%, ends at 100%
  armLower: { start: 0.70, peak: 0.85, end: 1.0 },
}

/**
 * Calculate phase envelope value (0-1) given cycle progress.
 * Uses smootherstep for organic acceleration/deceleration.
 */
function getPhaseEnvelope(cycleProgress: number, timing: { start: number; peak: number; end: number }): number {
  if (cycleProgress < timing.start || cycleProgress > timing.end) {
    return 0
  }

  if (cycleProgress < timing.peak) {
    // Rising edge: start → peak
    const t = (cycleProgress - timing.start) / (timing.peak - timing.start)
    return smootherstep(0, 1, t)
  } else {
    // Falling edge: peak → end
    const t = (cycleProgress - timing.peak) / (timing.end - timing.peak)
    return 1 - smootherstep(0, 1, t)
  }
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

interface SmokingState {
  noise: NoiseGenerator
  armSpringX: Spring      // Forward/back shoulder rotation
  armSpringY: Spring      // Abduction
  armSpringZ: Spring      // Twist
  wristSpring: Spring     // Wrist rotation
  chestSpring: Spring     // Chest expansion
  lastPuffStart: number   // Time when current puff cycle started
  ashTapActive: boolean   // Whether current cycle includes ash tap
  blinkTimer: number
  isBlinking: boolean
}

function initState(seed: number): SmokingState {
  return {
    noise: createNoiseGenerator(seed),
    // Smooth spring preset (stiffness ~180, damping ~20) for natural arm motion
    armSpringX: createSpring(SpringPresets.smooth),
    armSpringY: createSpring(SpringPresets.smooth),
    armSpringZ: createSpring(SpringPresets.smooth),
    wristSpring: createSpring({ stiffness: 250, damping: 22 }),
    chestSpring: createSpring({ stiffness: 100, damping: 18 }),
    lastPuffStart: -10, // Start immediately
    ashTapActive: false,
    blinkTimer: 0,
    isBlinking: false,
  }
}

// ============================================================================
// MOTION IMPLEMENTATION
// ============================================================================

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

      // Style modifiers affect speed and posture
      const styleModifiers = {
        casual: { speed: 1, tension: 0.3, lean: 0 },
        stressed: { speed: 1.3, tension: 0.7, lean: 0.05 },
        seductive: { speed: 0.7, tension: 0.2, lean: -0.03 },
      }[smokingStyle]

      // ========================================
      // PUFF CYCLE PROGRESS (0-1)
      // ========================================

      // Calculate where we are in the current puff cycle
      const timeSincePuffStart = t - state.lastPuffStart
      const adjustedPuffInterval = puffInterval / styleModifiers.speed
      // Add noise-based variation to puff interval
      const puffVariation = 1 + noise.noise2D(state.lastPuffStart, 100) * paceVariation * 0.3

      // Cycle progress from 0 to 1
      let cycleProgress = timeSincePuffStart / (adjustedPuffInterval * puffVariation)

      // Start new cycle when current one completes
      if (cycleProgress >= 1) {
        state.lastPuffStart = t
        cycleProgress = 0
        // Decide if this cycle includes ash tap (30% chance)
        state.ashTapActive = noise.noise2D(t, 500) > 0.7
      }

      // ========================================
      // CALCULATE ALL PHASE ENVELOPES
      // ========================================

      const armRaiseEnv = getPhaseEnvelope(cycleProgress, PHASE_TIMING.armRaise)
      const inhaleEnv = getPhaseEnvelope(cycleProgress, PHASE_TIMING.inhale)
      const holdEnv = getPhaseEnvelope(cycleProgress, PHASE_TIMING.hold)
      const exhaleEnv = getPhaseEnvelope(cycleProgress, PHASE_TIMING.exhale)
      const armLowerEnv = getPhaseEnvelope(cycleProgress, PHASE_TIMING.armLower)

      // Combined "arm up" envelope - arm raised for inhale/hold/start of exhale
      // This creates the overlap where arm stays up during multiple phases
      const armUpEnv = Math.max(armRaiseEnv, inhaleEnv, holdEnv, exhaleEnv * 0.7)

      // STAGGERED JOINT ENVELOPES
      // Phase offset of 0.03 (~240ms at 8s cycle) between joints
      // RAISE: shoulder leads, wrist trails
      // LOWER: wrist leads, shoulder trails (inverted)
      const staggerOffset = 0.03

      // Detect if we're in raising or lowering phase
      const isLoweringPhase = armLowerEnv > 0.1 && armRaiseEnv < 0.1

      // During raise: shoulder +offset (leads), wrist -offset (trails)
      // During lower: shoulder -offset (trails), wrist +offset (leads)
      const shoulderOffset = isLoweringPhase ? -staggerOffset : staggerOffset
      const wristOffset = isLoweringPhase ? staggerOffset : -staggerOffset

      const shoulderEnv = Math.max(
        getPhaseEnvelope(cycleProgress + shoulderOffset, PHASE_TIMING.armRaise),
        getPhaseEnvelope(cycleProgress + shoulderOffset, PHASE_TIMING.inhale),
        getPhaseEnvelope(cycleProgress + shoulderOffset, PHASE_TIMING.hold),
        getPhaseEnvelope(cycleProgress + shoulderOffset, PHASE_TIMING.exhale) * 0.7,
        getPhaseEnvelope(cycleProgress + shoulderOffset, PHASE_TIMING.armLower) * (isLoweringPhase ? 1 : 0)
      )
      const elbowEnv = armUpEnv // Elbow uses base timing
      const wristEnv = Math.max(
        getPhaseEnvelope(cycleProgress + wristOffset, PHASE_TIMING.armRaise),
        getPhaseEnvelope(cycleProgress + wristOffset, PHASE_TIMING.inhale),
        getPhaseEnvelope(cycleProgress + wristOffset, PHASE_TIMING.hold),
        getPhaseEnvelope(cycleProgress + wristOffset, PHASE_TIMING.exhale) * 0.7,
        getPhaseEnvelope(cycleProgress + wristOffset, PHASE_TIMING.armLower) * (isLoweringPhase ? 1 : 0)
      )

      // Ash tap envelope (optional, during arm lower)
      let ashTapEnv = 0
      if (state.ashTapActive && cycleProgress > 0.75 && cycleProgress < 0.85) {
        // Two quick oscillations
        const tapProgress = (cycleProgress - 0.75) / 0.1
        ashTapEnv = Math.sin(tapProgress * Math.PI * 4) * (1 - tapProgress)
      }

      // ========================================
      // LAYER 1: BASE POSTURE
      // ========================================

      // Style-based lean
      if (rig.hasBone('hips')) {
        const leanAmount = styleModifiers.lean * intensity
        rig.setRotation('hips', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, leanAmount))
      }

      // Relaxed spine with slight forward curve
      if (rig.hasBone('spine')) {
        rig.setRotation('spine', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.02 * intensity))
      }

      // ========================================
      // LAYER 2: ARM MOVEMENT (PHASE ENVELOPES)
      // ========================================

      const smokingArm = isRightHanded ? 'right' : 'left'
      const supportArm = isRightHanded ? 'left' : 'right'

      // Arm position interpolated between idle and raised based on envelopes
      // Idle position
      const idleArmX = 0.1 * intensity    // Slight forward
      const idleArmY = 0.15 * intensity   // Slight abduction
      const idleArmZ = 0                  // No twist
      const idleElbow = 0.3 * intensity   // Slight bend
      const idleWrist = 0.1 * handSide    // Slight rotation

      // Raised position (at mouth) - arm must come forward AND inward to reach face
      const raisedArmX = -1.1 * intensity  // Less forward flexion = lower hand
      const raisedArmY = -0.6 * intensity  // Inward toward mouth centerline
      const raisedArmZ = handSide * 0.2 * intensity  // Slight twist
      const raisedElbow = 2.7 * intensity  // Very bent elbow to bring hand to mouth
      const raisedWrist = handSide * 0.4   // Rotated for cigarette at lips

      // Blend between idle and raised based on STAGGERED envelopes
      // Shoulder leads, elbow follows, wrist trails
      const armTargetX = idleArmX + (raisedArmX - idleArmX) * shoulderEnv
      const armTargetY = idleArmY + (raisedArmY - idleArmY) * shoulderEnv
      const armTargetZ = idleArmZ + (raisedArmZ - idleArmZ) * shoulderEnv
      const elbowBend = idleElbow + (raisedElbow - idleElbow) * elbowEnv
      let wristRotation = idleWrist + (raisedWrist - idleWrist) * wristEnv

      // Add ash tap to wrist if active
      wristRotation += ashTapEnv * 0.3 * handSide

      // Add micro-movements during hold phase for organic feel
      if (holdEnv > 0.1) {
        const holdMicroX = noise.noise2D(t * 0.5, 250) * 0.015 * intensity * holdEnv
        const holdMicroY = noise.noise2D(t * 0.4, 260) * 0.01 * intensity * holdEnv
        wristRotation += noise.noise2D(t * 0.6, 280) * 0.02 * intensity * holdEnv
      }

      // Apply spring smoothing for natural motion
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

      // Bone names for smoking arm
      const upperArmBone = `${smokingArm}UpperArm` as VRMHumanBoneName
      const lowerArmBone = `${smokingArm}LowerArm` as VRMHumanBoneName
      const handBone = `${smokingArm}Hand` as VRMHumanBoneName
      const shoulderBone = `${smokingArm}Shoulder` as VRMHumanBoneName

      // Shoulder leads arm movement (anticipation)
      if (rig.hasBone(shoulderBone)) {
        rig.setRotation(shoulderBone, quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -handSide * smoothArmY * 0.15))
      }

      // Upper arm rotation
      // Base arm-down from T-pose: handSide * 1.2 gives correct direction for smoking arm
      // But reduce it significantly when arm is raised to smoke - arm needs to come forward, not down
      const smokingArmDown = handSide * 1.2 * (1 - armUpEnv * 0.95)
      if (rig.hasBone(upperArmBone)) {
        const upperArmRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, smokingArmDown)
        upperArmRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, smoothArmX))
        upperArmRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, smoothArmZ))
        rig.setRotation(upperArmBone, upperArmRot)
      }

      // Lower arm (elbow bend)
      if (rig.hasBone(lowerArmBone)) {
        rig.setRotation(lowerArmBone, quatFromAxisAngle({ x: 0, y: 1, z: 0 }, handSide * elbowBend))
      }

      // Hand/wrist
      if (rig.hasBone(handBone)) {
        const handRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, smoothWrist)
        // Wrist extension when holding cigarette up
        const wristExtension = armUpEnv * 0.15
        handRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, wristExtension))
        rig.setRotation(handBone, handRot)
      }

      // Apply cigarette grip to smoking hand
      if (rig.hasBone(handBone)) {
        applyCigaretteGrip(rig, smokingArm as 'left' | 'right', 'between')
      }

      // Support arm - relaxed or crossed depending on style
      const supportUpperArm = `${supportArm}UpperArm` as VRMHumanBoneName
      const supportLowerArm = `${supportArm}LowerArm` as VRMHumanBoneName
      const supportHand = `${supportArm}Hand` as VRMHumanBoneName

      // Base arm-down from T-pose for SUPPORT arm (opposite side of smoking arm)
      // Support arm is opposite of handSide:
      // - If handSide = 1 (right smoking), support is LEFT → needs NEGATIVE Z = -1.2
      // - If handSide = -1 (left smoking), support is RIGHT → needs POSITIVE Z = 1.2
      // So support arm down = -handSide * 1.2
      const supportArmDown = -handSide * 1.2

      if (smokingStyle === 'seductive') {
        // Arm crossed under (one arm supporting the other)
        if (rig.hasBone(supportUpperArm)) {
          const supportRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, supportArmDown * 0.6)  // Partial down, arm crosses
          supportRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.4 * intensity))
          rig.setRotation(supportUpperArm, supportRot)
        }
        if (rig.hasBone(supportLowerArm)) {
          rig.setRotation(supportLowerArm, quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -handSide * 1.2 * intensity))
        }
      } else {
        // Relaxed at side
        if (rig.hasBone(supportUpperArm)) {
          rig.setRotation(supportUpperArm, quatFromAxisAngle({ x: 0, y: 0, z: 1 }, supportArmDown))
        }
        if (rig.hasBone(supportLowerArm)) {
          rig.setRotation(supportLowerArm, quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -handSide * 0.15))
        }
      }

      // Relaxed fingers on support hand
      if (rig.hasBone(supportHand)) {
        applyFingerCurl(rig, supportArm as 'left' | 'right', {
          thumb: 0.3,
          index: 0.35,
          middle: 0.4,
          ring: 0.45,
          little: 0.5,
        })
      }

      // ========================================
      // LAYER 3: BREATHING (PHASE ENVELOPES)
      // ========================================

      // Chest expansion based on inhale/hold/exhale envelopes
      // Inhale expands, hold maintains, exhale contracts
      const breathExpansion = (inhaleEnv + holdEnv) * inhaleDepth * 0.06
        - exhaleEnv * inhaleDepth * 0.04 // Exhale slower than inhale deflates

      // Add baseline breathing when not in puff cycle
      const idleBreath = (1 - Math.max(inhaleEnv, holdEnv, exhaleEnv)) * oscBreathing(t, 0.2, 0.3) * 0.02 * intensity

      state.chestSpring.setTarget(breathExpansion + idleBreath)
      state.chestSpring.update(dt)
      const smoothChest = state.chestSpring.value

      if (rig.hasBone('chest')) {
        rig.setRotation('chest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -smoothChest))
      }
      if (rig.hasBone('upperChest')) {
        rig.setRotation('upperChest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -smoothChest * 1.5))
      }

      // Shoulders rise during inhale (delayed 0.1s / ~1% of cycle)
      const shoulderRise = inhaleEnv * 0.02 * inhaleDepth
      if (rig.hasBone('leftShoulder')) {
        rig.addRotation('leftShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -shoulderRise))
      }
      if (rig.hasBone('rightShoulder')) {
        rig.addRotation('rightShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, shoulderRise))
      }

      // ========================================
      // LAYER 4: HEAD MOVEMENT
      // ========================================

      // Head tilts based on phase
      // Inhale: slight tilt back
      // Exhale: head up/forward to blow smoke
      const inhaleTilt = inhaleEnv * -0.05 * intensity
      const exhaleTilt = exhaleEnv * 0.03 * intensity
      const headTiltX = inhaleTilt + exhaleTilt

      // Head turns slightly during exhale
      const headTiltY = exhaleEnv * handSide * 0.02 * intensity

      // Idle micro-movements when not in puff
      const idleHeadX = (1 - armUpEnv) * noise.noise2D(t * 0.2, 600) * 0.02 * intensity
      const idleHeadY = (1 - armUpEnv) * noise.noise2D(t * 0.15, 700) * 0.025 * intensity

      if (rig.hasBone('head')) {
        const headRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, headTiltX + idleHeadX)
        headRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, headTiltY + idleHeadY))
        rig.setRotation('head', headRot)
      }
      if (rig.hasBone('neck')) {
        rig.setRotation('neck', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, (headTiltX + idleHeadX) * 0.4))
      }

      // ========================================
      // LAYER 5: EYES
      // ========================================

      if (eyeSquint) {
        // Eyes squint during inhale and hold
        // 0.15 rad = 8.6° (subtle narrowing)
        const eyeSquintAmount = (inhaleEnv + holdEnv * 0.8) * 0.15 * intensity

        if (rig.hasBone('leftEye')) {
          rig.setRotation('leftEye', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, eyeSquintAmount))
        }
        if (rig.hasBone('rightEye')) {
          rig.setRotation('rightEye', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, eyeSquintAmount))
        }
      }

      // Blinking (seeded for determinism)
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
        // Jaw opens during exhale (peak at 50% of exhale)
        // 0.08 rad = 4.6° opening
        const jawOpen = Math.sin(exhaleEnv * Math.PI) * 0.08 * intensity
        rig.setRotation('jaw', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, jawOpen))
      }

      // ========================================
      // LAYER 7: LEGS & WEIGHT
      // ========================================

      // Relaxed stance with subtle weight shifting
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

      // Feet slightly turned out for relaxed stance
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
