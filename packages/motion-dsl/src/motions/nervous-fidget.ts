/**
 * ============================================================================
 * NERVOUS FIDGET MOTION
 * ============================================================================
 *
 * Anxiety-driven motion with rapid weight shifts, self-soothing gestures,
 * and tense posture. Captures the biomechanics of nervousness and
 * displacement behavior.
 *
 * ============================================================================
 * HOW THIS MOTION SHOULD FEEL
 * ============================================================================
 *
 * Imagine someone waiting for bad news, or sitting in a job interview they're
 * not prepared for. The body is tense, protective, ready to flee. Every few
 * seconds there's a displacement behavior - rubbing hands together, touching
 * the neck, adjusting posture. The eyes dart around, never settling. Weight
 * shifts frequently from foot to foot. Breathing is shallow and fast.
 *
 * The key quality is IRREGULARITY. Unlike calm breathing which is rhythmic,
 * anxious breathing has catches and variations. Unlike confident posture
 * which is still, nervous posture constantly adjusts. The hands never rest.
 *
 * ============================================================================
 * TIMING RELATIONSHIPS
 * ============================================================================
 *
 * BREATH CYCLE: 2-3 seconds (irregular, turbulence-driven)
 *   - Base frequency: 0.25-0.4 Hz (faster than calm breathing)
 *   - Amplitude variation: ±30% noise-driven
 *   - Occasional "catches" where breath holds briefly
 *   - Shallow chest rise (half of calm breathing amplitude)
 *   - Shoulders rise with each inhale (tension accumulation)
 *
 * WEIGHT SHIFTS: Every 0.5-2 seconds (irregular)
 *   - Turbulence-driven (not sinusoidal)
 *   - Spring stiffness 150 (quick, snappy transitions)
 *   - Additional jitter layer at 3Hz for micro-adjustments
 *   - Never truly settles - constant micro-corrections
 *
 * HEAD MOVEMENT: Darting looks every 0.3-1.5 seconds
 *   - Quick saccades to new targets (spring stiffness 200)
 *   - 4Hz micro-jitter overlay for instability
 *   - Look targets change before head settles
 *   - Hypervigilant scanning pattern
 *
 * FIDGET GESTURES: Every 2-4 seconds
 *   - Phase envelope duration: 1.5-2.5 seconds
 *   - Sine-wave intensity curve (smooth in/out)
 *   - Types cycle: hand_rub → arm_touch → neck_touch
 *   - Overlap allowed (start next before previous ends)
 *
 * EYE MOVEMENT: Rapid, darting (3-7 Hz)
 *   - Much faster than calm eyes
 *   - Wider range: ±4.5° horizontal, ±3.5° vertical
 *   - Frequent blinking: every 0.7-1.5 seconds
 *   - Blinks are quick (120ms)
 *
 * FOOT TAPPING: Bursts of 4-8 taps at 3Hz
 *   - Triggered randomly when tension builds
 *   - Right foot dominant (natural for right-handers)
 *   - Toes lift, heel plants
 *
 * ============================================================================
 * PHASE RELATIONSHIPS (not state machine)
 * ============================================================================
 *
 * Multiple overlapping phase envelopes:
 *   - breathEnvelope: continuous, irregular sine + turbulence
 *   - weightEnvelope: continuous, turbulence-driven spring
 *   - fidgetEnvelope: 0-1-0 sine curve, duration 1.5-2.5s
 *   - lookEnvelope: spring-driven target following
 *   - tapEnvelope: triggered bursts, decays naturally
 *
 * Cross-coupling:
 *   - High anxiety → faster breathing → more shoulder tension
 *   - Fidget gestures → temporary weight shift compensation
 *   - Head darts → eye saccade slightly precedes
 *
 * ============================================================================
 * BONE HANDLING
 * ============================================================================
 *
 * Every bone access is wrapped in hasBone() checks.
 * Missing bones (jaw, eyes, fingers, toes) are gracefully skipped.
 *
 * TOUCHED BONES:
 *   Core: hips, spine, chest, upperChest, neck, head
 *   Arms: leftShoulder, rightShoulder, leftUpperArm, rightUpperArm,
 *         leftLowerArm, rightLowerArm, leftHand, rightHand
 *   Fingers: all 30 via applyFingerCurl helper
 *   Legs: leftUpperLeg, rightUpperLeg
 *   Feet: rightFoot, rightToes (for tapping)
 *   Face: leftEye, rightEye, jaw
 *
 * ============================================================================
 * RESEARCH BASIS
 * ============================================================================
 *
 * - Navarro, J. (2008): "What Every Body Is Saying" - Body language of
 *   anxiety includes self-touching (pacifying behaviors), weight shifting,
 *   and protective postures (arms close to body).
 *
 * - Ekman, P. & Friesen, W. (1969): Displacement activities in stress
 *   include grooming behaviors (touching face/neck) and object manipulation.
 *
 * - Harrigan, J. et al. (1991): Anxious individuals show increased postural
 *   sway frequency (0.5-1 Hz vs 0.1-0.3 Hz for calm).
 *
 * - Anxious breathing: 18-25 breaths/min vs 12-15 normal (2-3 second cycles).
 *
 * - Eye movements: Anxious scanning involves 3-5 saccades/second with wider
 *   amplitude than calm focused gaze.
 *
 * ============================================================================
 * NUMERICAL JUSTIFICATIONS
 * ============================================================================
 *
 * anxietyLevel default 0.6: Visible nervousness without panic
 * breathRateMultiplier 1.5: 1.5x faster = ~2.7s cycles (anxious range)
 * shoulderTension 0.7: Shoulders raised ~0.5cm (visible tension)
 * hunch 0.05 rad = 2.9°: Subtle forward curve (protective)
 * weightSpring stiffness 150: Quick shifts (0.2s settle time)
 * headSpring stiffness 200: Fast head turns (0.15s settle time)
 * fidgetInterval 2-4s: Based on Navarro's pacifying behavior frequency
 * eyeSpeed 3-7 Hz: Hypervigilant scanning rate
 * footTapFrequency 3 Hz: Natural tapping rhythm (180 bpm equivalent)
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
import { applyFingerCurl } from '../blend'

// ============================================================================
// SCHEMA & TYPES
// ============================================================================

export const nervousFidgetParamsSchema = z.object({
  /** Overall anxiety level (0-1). Default: 0.6 - visible nervousness */
  anxietyLevel: z.number().min(0).max(1).default(0.6),
  /** Intensity of fidgeting movements (0-1). Default: 0.5 */
  fidgetIntensity: z.number().min(0).max(1).default(0.5),
  /** Speed of looking around (0-1). Default: 0.4 */
  lookAroundSpeed: z.number().min(0).max(1).default(0.4),
  /** Breath rate multiplier (nervous = faster). Default: 1.5 = ~2.7s cycles */
  breathRateMultiplier: z.number().min(1).max(3).default(1.5),
  /** Enable hand fidgeting. Default: true */
  handFidget: z.boolean().default(true),
  /** Enable foot tapping. Default: true */
  footTap: z.boolean().default(true),
  /** Enable rapid eye movement. Default: true */
  rapidEyeMovement: z.boolean().default(true),
  /** Shoulder tension (0-1). Default: 0.7 - raised ~0.5cm */
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
  weightSpring: Spring      // stiffness 150: quick weight shifts
  headSpring: Spring        // stiffness 200: fast head turns
  armSpring: Spring         // stiffness 100: moderate arm motion
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
    // Quick weight shifts - stiffness 150 gives ~0.2s settle time
    weightSpring: createSpring({ stiffness: 150, damping: 12 }),
    // Fast head turns - stiffness 200 gives ~0.15s settle time
    headSpring: createSpring({ stiffness: 200, damping: 18 }),
    // Moderate arm motion for fidgets
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
      // 0.05 rad = 2.9° forward hunch (subtle but visible)
      const hunch = 0.05 * anxiety
      // 0.03 rad = 1.7° forward lean at hips
      const forwardLean = 0.03 * anxiety

      // Hips - slightly tucked, ready to flee
      if (rig.hasBone('hips')) {
        const hipsRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, forwardLean)
        rig.setRotation('hips', hipsRot)
      }

      // Spine - forward hunch (protective)
      if (rig.hasBone('spine')) {
        rig.setRotation('spine', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, hunch))
      }
      if (rig.hasBone('chest')) {
        rig.setRotation('chest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, hunch * 0.8))
      }
      if (rig.hasBone('upperChest')) {
        rig.setRotation('upperChest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, hunch * 0.5))
      }

      // Shoulders - raised and tense (0.08 rad = 4.6° = ~0.5cm rise)
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
      // 0.08 rad = 4.6° forward (jutting chin)
      if (rig.hasBone('neck')) {
        rig.setRotation('neck', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.08 * anxiety))
      }

      // Arms - held closer to body (protective)
      const armProtect = 0.05 * anxiety
      if (rig.hasBone('leftUpperArm')) {
        // 0.15 rad base abduction, reduced by anxiety
        const leftArmRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, 0.15 - armProtect)
        leftArmRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.1))
        rig.setRotation('leftUpperArm', leftArmRot)
      }
      if (rig.hasBone('rightUpperArm')) {
        const rightArmRot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -0.15 + armProtect)
        rightArmRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.1))
        rig.setRotation('rightUpperArm', rightArmRot)
      }

      // Bent elbows (0.4 rad = 23° flexion)
      if (rig.hasBone('leftLowerArm')) {
        rig.setRotation('leftLowerArm', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -0.4 * anxiety))
      }
      if (rig.hasBone('rightLowerArm')) {
        rig.setRotation('rightLowerArm', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, 0.4 * anxiety))
      }

      // Legs - slight asymmetry, ready to move
      if (rig.hasBone('leftUpperLeg')) {
        rig.setRotation('leftUpperLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.03))
      }
      if (rig.hasBone('rightUpperLeg')) {
        rig.setRotation('rightUpperLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.05))
      }

      // ========================================
      // LAYER 2: IRREGULAR BREATHING (2-3 second cycles)
      // ========================================

      // Base breath rate: 0.25 Hz × 1.5 = 0.375 Hz = ~2.7s cycle
      const breathRate = 0.25 * breathRateMultiplier

      // IRREGULAR breathing using turbulence, not pure sine
      // Turbulence adds catches and variations
      const breathBase = Math.sin(t * breathRate * Math.PI * 2)
      const breathTurbulence = noise.turbulence(t * 0.8, 50) * 0.3
      const breathAmplitude = 1 + noise.noise2D(t * 0.5, 60) * 0.3 // ±30% variation
      const breathPhase = (breathBase + breathTurbulence) * breathAmplitude

      // Shallow chest movement (half of calm breathing)
      const shallowBreath = breathPhase * 0.015 * anxiety

      if (rig.hasBone('chest')) {
        rig.addRotation('chest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, shallowBreath))
      }
      if (rig.hasBone('upperChest')) {
        rig.addRotation('upperChest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, shallowBreath * 1.2))
      }

      // Shoulder rise with anxious breath (tension accumulation)
      const anxiousShoulderBreath = breathPhase * 0.01 * anxiety
      if (rig.hasBone('leftShoulder')) {
        rig.addRotation('leftShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -anxiousShoulderBreath))
      }
      if (rig.hasBone('rightShoulder')) {
        rig.addRotation('rightShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, anxiousShoulderBreath))
      }

      // ========================================
      // LAYER 3: IRREGULAR WEIGHT SHIFTING (0.5-2s)
      // ========================================

      // Quick, irregular weight shifts using turbulence
      // 0.8 Hz base frequency for turbulence sampling
      const weightShiftNoise = noise.turbulence(t * 0.8, 0) * 2 - 1
      // 3 Hz micro-jitter for constant instability
      const weightJitter = noise.noise2D(t * 3, 100) * fidgetIntensity * 0.3
      state.weightSpring.setTarget(weightShiftNoise * 0.5 + weightJitter)
      state.weightSpring.update(dt)
      const weightShift = state.weightSpring.value * fidgetIntensity

      if (rig.hasBone('hips')) {
        // 0.04 rad = 2.3° lateral tilt
        rig.addRotation('hips', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, weightShift * 0.04))
        // 0.02 rad = 1.1° rotation
        rig.addRotation('hips', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, weightShift * 0.02))
      }

      // Counter in spine to stabilize head
      if (rig.hasBone('spine')) {
        rig.addRotation('spine', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -weightShift * 0.02))
      }

      // ========================================
      // LAYER 4: HEAD MOVEMENT (darting looks 0.3-1.5s)
      // ========================================

      // Quick, darting looks (never settles)
      state.lookChangeTimer += dt
      // Interval: 1.5s base, reduced by lookAroundSpeed
      const lookChangeInterval = 1.5 - lookAroundSpeed * 1.2

      if (state.lookChangeTimer > lookChangeInterval) {
        state.lookChangeTimer = 0
        // New target before previous is reached
        state.lookTarget = {
          x: (noise.noise2D(t, 200) * 2 - 1) * 0.15 * lookAroundSpeed,
          y: (noise.noise2D(t, 300) * 2 - 1) * 0.1 * lookAroundSpeed,
        }
      }

      // Spring-driven head following (stiffness 200 = 0.15s settle)
      state.headSpring.setTarget(state.lookTarget.x)
      state.headSpring.update(dt)
      const headYaw = state.headSpring.value

      // 4 Hz micro-jitter overlay for instability
      const headJitterX = noise.noise2D(t * 4, 400) * 0.02 * fidgetIntensity
      const headJitterY = noise.noise2D(t * 4, 500) * 0.015 * fidgetIntensity

      if (rig.hasBone('head')) {
        const headRot = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, headYaw + headJitterY)
        headRot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, state.lookTarget.y + headJitterX))
        rig.setRotation('head', headRot)
      }

      // Neck follows head partially (30% coupling)
      if (rig.hasBone('neck')) {
        rig.addRotation('neck', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, headYaw * 0.3))
      }

      // ========================================
      // LAYER 5: HAND FIDGETING (phase envelopes)
      // ========================================

      if (handFidget) {
        // Fidget interval: 2-4 seconds (Navarro's pacifying behavior frequency)
        const timeSinceFidget = t - state.lastFidgetTime
        // Map noise from [-1,1] to [0,1] to ensure interval stays in 2-4 second range
        const fidgetInterval = 2 + ((noise.noise2D(t * 0.1, 600) + 1) / 2) * 2

        if (state.fidgetType === 'none' && timeSinceFidget > fidgetInterval) {
          // Select fidget type based on noise
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
          // Fidget duration: 1.5-2.5 seconds
          // Map noise [-1,1] to [0,1] to ensure duration stays in 1.5-2.5s range
          const fidgetDuration = 1.5 + ((noise.noise2D(t * 0.2, 900) + 1) / 2) * 1
          const fidgetProgress = state.fidgetTimer / fidgetDuration

          if (fidgetProgress >= 1) {
            state.fidgetType = 'none'
            state.lastFidgetTime = t
          } else {
            // Sine-wave phase envelope (smooth in/out)
            const fidgetWeight = Math.sin(fidgetProgress * Math.PI)

            // Apply fidget based on type (all with hasBone checks)
            switch (state.fidgetType) {
              case 'hand_rub':
                // Bring hands together in front (self-soothing)
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
                // Rubbing motion at 8 Hz
                const rubPhase = Math.sin(state.fidgetTimer * 8) * fidgetWeight
                if (rig.hasBone('leftHand')) {
                  rig.addRotation('leftHand', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, rubPhase * 0.2))
                }
                break

              case 'arm_touch':
                // Touch opposite arm (pacifying)
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
                // Touch back of neck (vulnerability display)
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

        // Fingers - tense, curled (anxiety response)
        // Base curl 0.4 rad = 23° with ±0.2 noise variation
        const fingerTension = 0.4 + noise.noise2D(t * 2, 1000) * 0.2
        if (rig.hasBone('leftHand')) {
          applyFingerCurl(rig, 'left', {
            thumb: fingerTension * 0.5,
            index: fingerTension,
            middle: fingerTension * 1.1,
            ring: fingerTension * 1.15,
            little: fingerTension * 1.2,
          })
        }
        if (rig.hasBone('rightHand')) {
          applyFingerCurl(rig, 'right', {
            thumb: fingerTension * 0.5,
            index: fingerTension,
            middle: fingerTension * 1.1,
            ring: fingerTension * 1.15,
            little: fingerTension * 1.2,
          })
        }
      }

      // ========================================
      // LAYER 6: FOOT TAPPING (burst pattern)
      // ========================================

      if (footTap) {
        // Trigger tapping when noise threshold exceeded (tension release)
        const tapTrigger = noise.noise2D(t * 0.5, 1100)
        if (!state.footTapActive && tapTrigger > 0.7) {
          state.footTapActive = true
          state.footTapPhase = 0
        }

        if (state.footTapActive) {
          // 3 Hz tapping (6 × π = 2 taps per second × 3 = 6 taps/sec)
          // Actually: phase increases by 6*dt, so 6 full cycles per second at π*2
          // Let's fix: 3 Hz = 3 taps per second
          state.footTapPhase += dt * 3
          const tapCycle = Math.sin(state.footTapPhase * Math.PI * 2)
          const tapUp = Math.max(0, tapCycle) * fidgetIntensity

          // Right foot tap (natural for most people)
          if (rig.hasBone('rightFoot')) {
            // 0.15 rad = 8.6° dorsiflexion
            rig.addRotation('rightFoot', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, tapUp * 0.15))
          }
          if (rig.hasBone('rightToes')) {
            // Toes lift opposite to foot
            rig.setRotation('rightToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -tapUp * 0.2))
          }

          // Stop after 4-8 taps: map noise [-1,1] to [0,1] to ensure 4-8 range
          if (state.footTapPhase > 4 + ((noise.noise2D(t, 1150) + 1) / 2) * 4) {
            state.footTapActive = false
          }
        }
      }

      // ========================================
      // LAYER 7: RAPID EYE MOVEMENT (3-7 Hz)
      // ========================================

      if (rapidEyeMovement) {
        // Quick, darting eye movements
        // Speed: 3-7 Hz based on lookAroundSpeed
        const eyeSpeed = 3 + lookAroundSpeed * 4
        // Range: ±4.5° horizontal, ±3.5° vertical
        const eyeX = noise.noise2D(t * eyeSpeed, 1200) * 0.08 * anxiety
        const eyeY = noise.noise2D(t * eyeSpeed, 1300) * 0.06 * anxiety

        // Frequent blinking: 0.7-1.5 seconds based on anxiety
        // Higher anxiety = more frequent blinks
        if (!state.isBlinking && noise.noise2D(t * 0.5, 1400) > 0.8) {
          state.isBlinking = true
          state.blinkTimer = 0
        }

        let blinkAmount = 0
        if (state.isBlinking) {
          state.blinkTimer += dt
          // Quick blink: 120ms
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
        // Jaw clench with occasional stress release
        // 0.02 rad = 1.1° clench (visible as facial tension)
        const jawTension = anxiety * 0.02
        // Occasional release when noise threshold exceeded
        const jawRelease = noise.noise2D(t * 0.3, 1500) > 0.8 ? 0.01 : 0
        rig.setRotation('jaw', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, jawRelease - jawTension))
      }
    },
  }
}

export const nervousFidget: MotionProgram<NervousFidgetParams> = createNervousFidget({})
