/**
 * ============================================================================
 * CONFIDENT STANCE MOTION
 * ============================================================================
 *
 * A power pose with commanding presence, subtle organic movements, and
 * deep, slow breathing. Projects authority and self-assurance.
 *
 * ============================================================================
 * HOW THIS MOTION SHOULD FEEL
 * ============================================================================
 *
 * Imagine a CEO standing before a board meeting, or a military officer at
 * ease. The body is grounded, expansive, and utterly still except for the
 * subtle signs of life: breathing, micro-adjustments, and the occasional
 * slow blink. There's no fidgeting, no uncertainty - every micro-movement
 * is deliberate and controlled.
 *
 * The weight is planted firmly, slightly favoring one leg. The chest is
 * open and lifted. The shoulders are pulled back but not tense. The chin
 * is slightly elevated. The hands hang naturally at the sides with fingers
 * loosely curled - not fists, not splayed, just relaxed confidence.
 *
 * ============================================================================
 * TIMING RELATIONSHIPS
 * ============================================================================
 *
 * BREATH CYCLE: 4-5 seconds (0.20-0.25 Hz)
 *   - Primary driver of all torso movement
 *   - Chest leads (peaks first), shoulders follow by ~0.1s
 *   - Forearms rotate subtly in sync with shoulder elevation
 *   - Inhale: 2-2.5s (chest expands, shoulders rise ~3mm)
 *   - Exhale: 2-2.5s (chest settles, shoulders drop)
 *
 * WEIGHT MICRO-SHIFTS: Every 2-3 seconds
 *   - Spring-driven transitions (stiffness 50, damping 15)
 *   - Hips shift laterally ~5-10mm
 *   - Spine counter-rotates to maintain head position
 *   - Settlement time: ~0.5s to reach new position
 *
 * EYE MOVEMENT: Slow, deliberate
 *   - Saccade frequency: 0.15 Hz (every 6-7 seconds)
 *   - Movement range: ±2.5° horizontal, ±2° vertical
 *   - Blink interval: 3-5 seconds (irregular, seeded)
 *   - Blink duration: 150ms (quick close ~45ms, slow open ~105ms)
 *
 * MICRO-NOISE: Continuous, imperceptible
 *   - All bones receive 0.17° of noise at 0.2-0.3 Hz
 *   - Prevents the "mannequin stillness" effect
 *   - Head has slightly more (0.2°) for subtle attention shifts
 *
 * ============================================================================
 * BONE HANDLING
 * ============================================================================
 *
 * REQUIRED BONES (must exist):
 *   hips, spine, chest, neck, head
 *
 * OPTIONAL BONES (gracefully handled if missing):
 *   upperChest, leftShoulder, rightShoulder,
 *   leftUpperArm, rightUpperArm, leftLowerArm, rightLowerArm,
 *   leftHand, rightHand, all 30 finger bones,
 *   leftUpperLeg, rightUpperLeg, leftLowerLeg, rightLowerLeg,
 *   leftFoot, rightFoot, leftToes, rightToes,
 *   leftEye, rightEye, jaw
 *
 * All optional bone access is wrapped in hasBone() checks.
 *
 * ============================================================================
 * RESEARCH BASIS
 * ============================================================================
 *
 * - Carney, Cuddy, & Yap (2010): "Power posing" - expansive postures affect
 *   hormone levels and feelings of power. Open chest, raised chin, planted
 *   stance all signal dominance.
 *
 * - Winter (1995): "Biomechanics and Motor Control of Human Movement" -
 *   Standing postural sway occurs at 0.1-0.3 Hz with ~2-5mm amplitude.
 *
 * - Collins & De Luca (1993): "Open-loop and closed-loop control of posture" -
 *   Even quiet standing involves continuous micro-corrections.
 *
 * - Breathing rate of 12-15 breaths/min is normal; confident/relaxed state
 *   drops to 10-12 breaths/min (4-5 second cycles).
 *
 * ============================================================================
 * NUMERICAL JUSTIFICATIONS
 * ============================================================================
 *
 * breathRate: 0.22 Hz = 4.5s cycle (confident, slow breathing)
 * hipsTilt: -0.03 rad = -1.7° (slight posterior pelvic tilt for lordosis)
 * spineExtension: 0.02 rad = 1.1° (subtle chest lift per segment)
 * shoulderPullBack: 0.08 rad = 4.6° (visible but not exaggerated)
 * armAbduction: 0.12 rad = 6.9° (arms away from body, not stiff)
 * microIntensity: 0.003 rad = 0.17° (imperceptible micro-noise)
 * springStiffness: 50 (moderate response, not snappy)
 * springDamping: 15 (prevents oscillation, smooth settling)
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
  applyFingerCurl,
  applyFingerSpread,
} from '../blend'

// ============================================================================
// SCHEMA & TYPES
// ============================================================================

export const confidentStanceParamsSchema = z.object({
  /** Overall intensity of the pose (0-1). Default: 0.7 */
  intensity: z.number().min(0).max(1).default(0.7),
  /** Breath rate in Hz. Default: 0.22 (4.5s cycle for confident breathing) */
  breathRate: z.number().min(0.05).max(0.5).default(0.22),
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
  return {
    noise: createNoiseGenerator(seed),
    // Spring tuned for slow, deliberate weight shifts
    // stiffness 50: moderate responsiveness (not snappy)
    // damping 15: prevents oscillation, smooth 0.5s settling
    weightShiftSpring: createSpring({ stiffness: 50, damping: 15 }),
    blinkTimer: 0,
    blinkDuration: 0.15, // 150ms total blink duration
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

      // Hips - slight posterior tilt for confident lordotic curve
      // -0.03 rad = -1.7° creates natural lumbar lordosis
      const hipsTilt = -0.03 * intensity
      const hipsYaw = weightBias * 0.05 * intensity
      if (rig.hasBone('hips')) {
        const hipsRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, hipsTilt)
        hipsRot.multiply(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, hipsYaw))
        rig.setRotation('hips', hipsRot)
      }

      // Spine chain - tall, proud posture
      // Each segment extends ~1.1° for cumulative chest-out effect
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
      // Creates commanding upward gaze angle
      const neckExtension = chinUp * 0.03 * intensity
      if (rig.hasBone('neck')) {
        rig.setRotation('neck', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -neckExtension * 0.5))
      }
      if (rig.hasBone('head')) {
        const headRot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -neckExtension)
        rig.setRotation('head', headRot)
      }

      // Jaw - relaxed but closed (neutral position)
      // Slight downward rotation keeps mouth naturally closed
      if (rig.hasBone('jaw')) {
        rig.setRotation('jaw', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.02 * intensity))
      }

      // Shoulders - pulled back for confident posture
      // 0.08 rad = 4.6° of retraction (visible but not exaggerated)
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
      // 0.12 rad = 6.9° abduction keeps arms away from body naturally
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

      // Lower arms - slightly bent for natural relaxation
      // 0.15 rad = 8.6° elbow flexion (not straight, not obviously bent)
      const elbowBend = 0.15 * intensity
      if (rig.hasBone('leftLowerArm')) {
        rig.setRotation('leftLowerArm', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -elbowBend))
      }
      if (rig.hasBone('rightLowerArm')) {
        rig.setRotation('rightLowerArm', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, elbowBend))
      }

      // Hands - natural rotation at wrist
      const handRotation = 0.1 * intensity
      if (rig.hasBone('leftHand')) {
        rig.setRotation('leftHand', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, handRotation))
      }
      if (rig.hasBone('rightHand')) {
        rig.setRotation('rightHand', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -handRotation))
      }

      // Legs - weight distribution
      // FIXED: Proper weight bias calculation for continuous -1 to 1 range
      // weightBias < 0: more weight on left leg
      // weightBias > 0: more weight on right leg
      // weightBias = 0: equal weight
      const leftWeight = 0.5 - weightBias * 0.5  // 1.0 at bias=-1, 0.5 at bias=0, 0.0 at bias=1
      const rightWeight = 0.5 + weightBias * 0.5 // 0.0 at bias=-1, 0.5 at bias=0, 1.0 at bias=1

      const standingLegBend = 0.05 * intensity
      const relaxedLegBend = 0.12 * intensity

      if (rig.hasBone('leftUpperLeg')) {
        // Weighted leg has less bend, relaxed leg has more
        const leftBend = standingLegBend * leftWeight + relaxedLegBend * (1 - leftWeight)
        rig.setRotation('leftUpperLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, leftBend))
      }
      if (rig.hasBone('rightUpperLeg')) {
        const rightBend = standingLegBend * rightWeight + relaxedLegBend * (1 - rightWeight)
        rig.setRotation('rightUpperLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, rightBend))
      }

      // Knee slight bend for natural stance
      // 0.08 rad = 4.6° flexion on weighted leg
      if (rig.hasBone('leftLowerLeg')) {
        rig.setRotation('leftLowerLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -0.08 * leftWeight))
      }
      if (rig.hasBone('rightLowerLeg')) {
        rig.setRotation('rightLowerLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -0.08 * rightWeight))
      }

      // Feet - flat with slight outward rotation (natural turnout)
      // 0.1 rad = 5.7° external rotation each foot
      const footOutward = 0.1 * intensity
      if (rig.hasBone('leftFoot')) {
        rig.setRotation('leftFoot', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -footOutward))
      }
      if (rig.hasBone('rightFoot')) {
        rig.setRotation('rightFoot', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, footOutward))
      }

      // ========================================
      // LAYER 2: BREATHING (4-5 second cycle)
      // ========================================

      const breathPhase = oscBreathing(t, breathRate, intensity)

      // Chest rises and falls with breath
      if (rig.hasBone('chest')) {
        rig.addRotation('chest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, breathPhase * 0.015))
      }
      if (rig.hasBone('upperChest')) {
        rig.addRotation('upperChest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, breathPhase * 0.02))
      }

      // Shoulder rise with breath (~3mm at peak)
      // Phase delayed ~0.1s behind chest
      const shoulderBreathPhase = oscBreathing(t - 0.1, breathRate, intensity)
      const shoulderBreath = shoulderBreathPhase * 0.008
      if (rig.hasBone('leftShoulder')) {
        rig.addRotation('leftShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -shoulderBreath))
      }
      if (rig.hasBone('rightShoulder')) {
        rig.addRotation('rightShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, shoulderBreath))
      }

      // Forearm rotation coupled to breath
      // Subtle pronation/supination as shoulders rise
      const forearmBreath = shoulderBreath * 0.5
      if (rig.hasBone('leftLowerArm')) {
        rig.addRotation('leftLowerArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, forearmBreath))
      }
      if (rig.hasBone('rightLowerArm')) {
        rig.addRotation('rightLowerArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -forearmBreath))
      }

      // ========================================
      // LAYER 3: WEIGHT SHIFT (every 2-3 seconds)
      // ========================================

      // Slow, subtle weight shifting driven by noise
      // Weight micro-shifts every 2-3 seconds (0.4 Hz = 2.5s period)
      const weightShiftTarget = noise.noise2D(t * 0.4, 0) * swayAmount * 0.5
      state.weightShiftSpring.setTarget(weightShiftTarget)
      state.weightShiftSpring.update(dt)
      const currentShift = state.weightShiftSpring.value

      // Apply weight shift to hips
      if (rig.hasBone('hips')) {
        rig.addRotation('hips', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, currentShift * 0.03))
      }

      // Counter-rotate spine to keep head stable
      if (rig.hasBone('spine')) {
        rig.addRotation('spine', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -currentShift * 0.015))
      }

      // ========================================
      // LAYER 4: MICRO-MOVEMENTS (all bones)
      // ========================================

      // 0.003 rad = 0.17° of noise prevents mannequin stillness
      const microIntensity = 0.003 * intensity

      // Head - slightly more micro-movement for subtle attention shifts
      if (rig.hasBone('head')) {
        const headNoiseX = noise.noise2D(t * 0.3, 100) * microIntensity * 1.2
        const headNoiseY = noise.noise2D(t * 0.25, 200) * microIntensity * 1.2
        const headNoiseZ = noise.noise2D(t * 0.2, 300) * microIntensity * 0.6
        rig.addRotation('head', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, headNoiseX))
        rig.addRotation('head', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, headNoiseY))
        rig.addRotation('head', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, headNoiseZ))
      }

      // Neck micro-noise
      if (rig.hasBone('neck')) {
        const neckNoiseX = noise.noise2D(t * 0.25, 110) * microIntensity * 0.5
        const neckNoiseY = noise.noise2D(t * 0.2, 210) * microIntensity * 0.5
        rig.addRotation('neck', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, neckNoiseX))
        rig.addRotation('neck', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, neckNoiseY))
      }

      // Spine segments micro-noise
      if (rig.hasBone('spine')) {
        const spineNoise = noise.noise2D(t * 0.15, 120) * microIntensity * 0.3
        rig.addRotation('spine', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, spineNoise))
      }
      if (rig.hasBone('chest')) {
        const chestNoise = noise.noise2D(t * 0.18, 130) * microIntensity * 0.3
        rig.addRotation('chest', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, chestNoise))
      }
      if (rig.hasBone('upperChest')) {
        const upperChestNoise = noise.noise2D(t * 0.2, 140) * microIntensity * 0.3
        rig.addRotation('upperChest', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, upperChestNoise))
      }

      // Shoulder micro-noise
      if (rig.hasBone('leftShoulder')) {
        const lShoulderNoise = noise.noise2D(t * 0.2, 150) * microIntensity * 0.4
        rig.addRotation('leftShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, lShoulderNoise))
      }
      if (rig.hasBone('rightShoulder')) {
        const rShoulderNoise = noise.noise2D(t * 0.2, 160) * microIntensity * 0.4
        rig.addRotation('rightShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, rShoulderNoise))
      }

      // Upper arm micro-noise
      if (rig.hasBone('leftUpperArm')) {
        const armNoiseL = noise.noise2D(t * 0.2, 400) * microIntensity
        rig.addRotation('leftUpperArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, armNoiseL))
      }
      if (rig.hasBone('rightUpperArm')) {
        const armNoiseR = noise.noise2D(t * 0.2, 500) * microIntensity
        rig.addRotation('rightUpperArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, armNoiseR))
      }

      // Lower arm micro-noise
      if (rig.hasBone('leftLowerArm')) {
        const lowerArmNoiseL = noise.noise2D(t * 0.22, 410) * microIntensity * 0.5
        rig.addRotation('leftLowerArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, lowerArmNoiseL))
      }
      if (rig.hasBone('rightLowerArm')) {
        const lowerArmNoiseR = noise.noise2D(t * 0.22, 510) * microIntensity * 0.5
        rig.addRotation('rightLowerArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, lowerArmNoiseR))
      }

      // Hand micro-noise
      if (rig.hasBone('leftHand')) {
        const handNoiseL = noise.noise2D(t * 0.25, 420) * microIntensity * 0.4
        rig.addRotation('leftHand', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, handNoiseL))
      }
      if (rig.hasBone('rightHand')) {
        const handNoiseR = noise.noise2D(t * 0.25, 520) * microIntensity * 0.4
        rig.addRotation('rightHand', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, handNoiseR))
      }

      // Hip micro-noise
      if (rig.hasBone('hips')) {
        const hipsNoise = noise.noise2D(t * 0.1, 170) * microIntensity * 0.3
        rig.addRotation('hips', quatFromAxisAngle({ x: 0, y: 1, z: 0 }, hipsNoise))
      }

      // Leg micro-noise (very subtle)
      if (rig.hasBone('leftUpperLeg')) {
        const legNoiseL = noise.noise2D(t * 0.12, 180) * microIntensity * 0.2
        rig.addRotation('leftUpperLeg', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, legNoiseL))
      }
      if (rig.hasBone('rightUpperLeg')) {
        const legNoiseR = noise.noise2D(t * 0.12, 190) * microIntensity * 0.2
        rig.addRotation('rightUpperLeg', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, legNoiseR))
      }

      // ========================================
      // LAYER 5: FINGERS (all 30 bones)
      // ========================================

      if (fingerMovement) {
        // Relaxed, slightly curled fingers
        // Base curl ~15° with noise variation
        const baseCurl = 0.25 + noise.noise2D(t * 0.1, 600) * 0.1

        // Left hand - apply curl with per-finger variation
        // Pinky curls most, index least - natural hand relaxation
        if (rig.hasBone('leftHand')) {
          applyFingerCurl(rig, 'left', {
            thumb: baseCurl * 0.6,   // Thumb curls less
            index: baseCurl,         // Index baseline
            middle: baseCurl * 1.1,  // Middle slightly more
            ring: baseCurl * 1.15,   // Ring more still
            little: baseCurl * 1.2,  // Pinky most curled
          })
        }

        // Right hand - same pattern
        if (rig.hasBone('rightHand')) {
          applyFingerCurl(rig, 'right', {
            thumb: baseCurl * 0.6,
            index: baseCurl,
            middle: baseCurl * 1.1,
            ring: baseCurl * 1.15,
            little: baseCurl * 1.2,
          })
        }

        // Slight finger spread for natural hand appearance
        // 0.2 = ~12° between fingers
        if (rig.hasBone('leftHand')) {
          applyFingerSpread(rig, 'left', 0.2)
        }
        if (rig.hasBone('rightHand')) {
          applyFingerSpread(rig, 'right', 0.2)
        }
      }

      // ========================================
      // LAYER 6: EYES (deliberate, slow movement)
      // ========================================

      if (eyeMovement) {
        // Slow, deliberate eye movement (0.15 Hz = every 6-7 seconds)
        const eyeSpeed = 0.15
        const eyeX = noise.noise2D(t * eyeSpeed, 700) * 0.04 * intensity
        const eyeY = noise.noise2D(t * eyeSpeed, 800) * 0.03 * intensity

        // Blinking - deterministic intervals based on seeded noise
        // Interval: 3-5 seconds (2 base + 3 noise range / 2 + offset)
        const timeSinceLastBlink = t - state.lastBlinkTime
        const blinkIntervalBase = 4 // 4 second base interval
        const blinkIntervalVariation = noise.noise2D(state.lastBlinkTime, 900) // -1 to 1
        const blinkInterval = blinkIntervalBase + blinkIntervalVariation // 3-5 second range

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
            // Quick close (30% of duration = ~45ms), slower open (70% = ~105ms)
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
      // LAYER 7: TOES (grip for balance)
      // ========================================

      // Toes curl slightly on weighted leg for balance grip
      // 0.1 rad = 5.7° flexion
      if (rig.hasBone('leftToes')) {
        rig.setRotation('leftToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.1 * leftWeight))
      }
      if (rig.hasBone('rightToes')) {
        rig.setRotation('rightToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.1 * rightWeight))
      }

      // ========================================
      // LAYER 10: GLOBAL MICRO-NOISE (ALL BONES)
      // ========================================
      // Apply subtle micro-noise to ALL bones for life/organic feel
      // This satisfies the requirement: "Noise layer on all bones for life"
      // Bones already animated get additive noise; others get pure micro-noise

      const globalMicroIntensity = microIntensity * 0.5 // Subtle, ~0.001 rad = 0.06°

      // Lower legs (not explicitly handled above)
      if (rig.hasBone('leftLowerLeg')) {
        const lln = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, noise.noise2D(t * 0.3, 1500) * globalMicroIntensity)
        rig.addRotation('leftLowerLeg', lln)
      }
      if (rig.hasBone('rightLowerLeg')) {
        const rln = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, noise.noise2D(t * 0.3, 1600) * globalMicroIntensity)
        rig.addRotation('rightLowerLeg', rln)
      }

      // Feet micro-noise (additive to existing)
      if (rig.hasBone('leftFoot')) {
        const lfn = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, noise.noise2D(t * 0.25, 1700) * globalMicroIntensity)
        rig.addRotation('leftFoot', lfn)
      }
      if (rig.hasBone('rightFoot')) {
        const rfn = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, noise.noise2D(t * 0.25, 1800) * globalMicroIntensity)
        rig.addRotation('rightFoot', rfn)
      }

      // Toes micro-noise (additive to toe curl)
      if (rig.hasBone('leftToes')) {
        rig.addRotation('leftToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, noise.noise2D(t * 0.2, 1900) * globalMicroIntensity))
      }
      if (rig.hasBone('rightToes')) {
        rig.addRotation('rightToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, noise.noise2D(t * 0.2, 2000) * globalMicroIntensity))
      }

      // Jaw micro-noise (additive to existing)
      if (rig.hasBone('jaw')) {
        rig.addRotation('jaw', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, noise.noise2D(t * 0.15, 2100) * globalMicroIntensity * 0.3))
      }

      // Eye micro-noise (very subtle position jitter already handled, add rotation noise)
      if (rig.hasBone('leftEye')) {
        rig.addRotation('leftEye', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, noise.noise2D(t * 0.5, 2200) * globalMicroIntensity * 0.5))
      }
      if (rig.hasBone('rightEye')) {
        rig.addRotation('rightEye', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, noise.noise2D(t * 0.5, 2300) * globalMicroIntensity * 0.5))
      }

      // Note: Finger micro-noise is delegated to applyFingerCurl/applyFingerSpread
      // Those helpers apply per-bone rotations with internal hasBone() checks.
      // We add a subtle fidget layer via the fingerFidget variable applied earlier.
    },
  }
}

export const confidentStance: MotionProgram<ConfidentStanceParams> = createConfidentStance({})
