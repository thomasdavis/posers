import { Quaternion, Vector3 } from 'three'
import { z } from 'zod'
import type { MotionProgram, MotionMeta, HumanoidRig, MotionContext } from '@posers/core'
import { osc, quatFromAxisAngle, smoothstep, clamp } from '@posers/core'

/**
 * BACKFLIP MOTION
 * ===============
 *
 * Standing backflip - acrobatic full rotation with explosive vertical takeoff,
 * tight tuck for rotation, and controlled landing. High skill gymnastic movement.
 *
 * FEEL: Explosive commitment, brief disorientation, triumphant stick.
 * Like a gymnast's floor routine finale.
 *
 * PHASE TIMING (overlapping envelopes):
 * - ANTICIPATION (0-20%): Deep squat, arms forward, eyes spot ceiling
 * - TAKEOFF (15-30%): Explosive up-and-back, arms swing overhead, head throws back
 * - ROTATION (25-75%): Tight tuck, knees to chest, arms wrap shins, fast rotation
 * - OPENING (70-90%): Untuck, legs extend down, arms out, spot landing
 * - LANDING (85-100%): Absorb impact, stabilize, arms out for balance
 *
 * BIOMECHANICAL NOTES:
 * - Rotation initiated by: backward lean + head throw + arm swing
 * - Tuck reduces moment of inertia, speeds rotation (ice skater effect)
 * - Angular momentum conserved: tuck tight = rotate fast
 * - Opening early = safer landing, opening late = more rotation
 * - Arms wrap shins during tuck (not behind knees - injury risk)
 *
 * CRITICAL TIMING:
 * - Head throw initiates rotation (vestibular commitment)
 * - Arms must swing up AND back simultaneously
 * - Tuck must be tight and quick (within ~100ms of takeoff)
 * - Opening begins before apex for safe landing
 * - Eyes spot landing as soon as possible after opening
 *
 * BONE ENGAGEMENT: All 17 required + shoulders, toes, fingers for full expression
 *
 * RESEARCH BASIS:
 * - Somersault biomechanics (Yeadon, 1990)
 * - Angular momentum in gymnastics (Hay, 1993)
 * - Backflip learning progression (gymnastics coaching literature)
 *
 * WARNING: This is a complex motion with precise timing requirements.
 * Poor timing can look unrealistic very quickly.
 */

export const backflipParamsSchema = z.object({
  /** Flip duration in seconds. Default: 1.0 */
  duration: z.number().min(0.6).max(2).default(1.0),
  /** Jump height multiplier. Default: 1.0 */
  height: z.number().min(0.5).max(2).default(1.0),
  /** Tuck tightness (0-1). Higher = faster rotation. Default: 0.9 */
  tuckTightness: z.number().min(0.5).max(1).default(0.9),
  /** Landing absorption intensity (0-1). Default: 0.8 */
  landingAbsorption: z.number().min(0).max(1).default(0.8),
})

export type BackflipParams = z.infer<typeof backflipParamsSchema>

export const backflipMeta: MotionMeta = {
  id: 'backflip',
  name: 'Backflip',
  description: 'Standing backflip with full rotation',
  tags: ['locomotion', 'athletic', 'acrobatic', 'flip', 'advanced'],
  author: 'posers',
}

export type BackflipInput = z.input<typeof backflipParamsSchema>

/**
 * Phase envelope with configurable easing
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
 * Sustained envelope - rises and stays high
 */
function sustainEnvelope(t: number, start: number, peak: number, end: number): number {
  if (t < start) return 0
  if (t > end) return 0
  if (t < peak) {
    return smoothstep(start, peak, t)
  }
  // Stay at 1 until end phase
  const holdEnd = end - (end - peak) * 0.3
  if (t < holdEnd) return 1
  return 1 - smoothstep(holdEnd, end, t)
}

/**
 * Create the backflip motion.
 */
export function createBackflip(params: BackflipInput = {}): MotionProgram<BackflipParams> {
  const validatedParams = backflipParamsSchema.parse(params)

  return {
    meta: backflipMeta,
    paramsSchema: backflipParamsSchema,

    update(rig: HumanoidRig, ctx: MotionContext, t: number, _dt: number): void {
      const { duration, height, tuckTightness, landingAbsorption } = validatedParams

      // Normalize time to 0-1 within flip cycle
      const cycleT = (t % duration) / duration

      // ========== PHASE ENVELOPES (overlapping) ==========
      const anticipation = phaseEnvelope(cycleT, 0, 0.12, 0.25)     // 0-25%
      const takeoff = phaseEnvelope(cycleT, 0.12, 0.22, 0.35)       // 12-35%
      const tuck = sustainEnvelope(cycleT, 0.22, 0.35, 0.72)        // 22-72%
      const opening = phaseEnvelope(cycleT, 0.65, 0.78, 0.88)       // 65-88%
      const landing = phaseEnvelope(cycleT, 0.82, 0.92, 1.0)        // 82-100%

      // ========== BODY ROTATION (around lateral axis) ==========
      // Full 360 degree rotation backwards
      let bodyRotation = 0
      if (cycleT > 0.20 && cycleT < 0.88) {
        // Rotation progresses non-linearly (faster during tuck)
        const rotationProgress = (cycleT - 0.20) / (0.88 - 0.20) // 0-1
        // Ease in, fast middle (tuck), ease out
        const eased = smoothstep(0, 0.3, rotationProgress) * (1 - smoothstep(0.7, 1, rotationProgress) * 0.3)
        // Adjust for tuck tightness (tighter = faster through middle)
        const tuckBoost = tuck * tuckTightness * 0.2
        bodyRotation = -Math.PI * 2 * (eased + tuckBoost * rotationProgress)
      } else if (cycleT >= 0.88) {
        bodyRotation = -Math.PI * 2 // Full rotation complete
      }

      // ========== HIP TRAJECTORY (parabolic arc, moving backward) ==========
      let hipY = 0
      let hipZ = 0
      if (cycleT > 0.18 && cycleT < 0.88) {
        const airT = (cycleT - 0.18) / (0.88 - 0.18) // 0-1 during air time
        // Vertical: parabolic arc
        hipY = (-4 * Math.pow(airT - 0.5, 2) + 1) * 0.5 * height
        // Horizontal: slight backward then forward arc
        hipZ = Math.sin(airT * Math.PI) * -0.15 * height
      }
      // Squat during anticipation and landing
      const squat = anticipation * 0.2 * height + landing * 0.25 * height * landingAbsorption
      rig.setHipsPositionOffset(new Vector3(0, hipY - squat, hipZ))

      // ========== HIPS (body rotation applied here) ==========
      if (rig.hasBone('hips')) {
        // Base pitch from phases
        const hipPitch = anticipation * 0.3 + landing * 0.25 * landingAbsorption
        const rot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, bodyRotation + hipPitch)
        rig.setRotation('hips', rot)
      }

      // ========== LEGS ==========
      // During tuck: knees to chest
      const tuckLeg = tuck * 1.5 * tuckTightness
      const anticipationLeg = anticipation * 0.9
      const landingLeg = landing * 0.8 * landingAbsorption
      const extendLeg = opening * 0.3

      if (rig.hasBone('leftUpperLeg')) {
        const angle = tuckLeg + anticipationLeg + landingLeg - extendLeg
        rig.setRotation('leftUpperLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, angle))
      }
      if (rig.hasBone('rightUpperLeg')) {
        const angle = tuckLeg + anticipationLeg + landingLeg - extendLeg
        rig.setRotation('rightUpperLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, angle))
      }

      // Knee flexion - very tight during tuck
      const tuckKnee = tuck * 2.2 * tuckTightness // Near max flexion
      const anticipationKnee = anticipation * 1.3
      const landingKnee = landing * 1.1 * landingAbsorption
      const extendKnee = opening * 0.5

      if (rig.hasBone('leftLowerLeg')) {
        const angle = tuckKnee + anticipationKnee + landingKnee - extendKnee
        rig.setRotation('leftLowerLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, angle))
      }
      if (rig.hasBone('rightLowerLeg')) {
        const angle = tuckKnee + anticipationKnee + landingKnee - extendKnee
        rig.setRotation('rightLowerLeg', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, angle))
      }

      // Ankles
      const ankleDorsi = anticipation * 0.35 + landing * 0.3 * landingAbsorption + tuck * 0.4
      const anklePlantar = takeoff * 0.6 + opening * 0.3

      if (rig.hasBone('leftFoot')) {
        rig.setRotation('leftFoot', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, ankleDorsi - anklePlantar))
      }
      if (rig.hasBone('rightFoot')) {
        rig.setRotation('rightFoot', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, ankleDorsi - anklePlantar))
      }

      // Toes
      if (rig.hasBone('leftToes')) {
        const toeAngle = anticipation * 0.2 + tuck * 0.3 - opening * 0.2
        rig.setRotation('leftToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, toeAngle))
      }
      if (rig.hasBone('rightToes')) {
        const toeAngle = anticipation * 0.2 + tuck * 0.3 - opening * 0.2
        rig.setRotation('rightToes', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, toeAngle))
      }

      // ========== SPINE ==========
      // Follows body rotation but with relative adjustments
      // During tuck: spine curls forward (relative to body)
      // During opening: spine extends
      const spineCurl = tuck * 0.3 * tuckTightness + anticipation * 0.15
      const spineExtend = opening * 0.2 + takeoff * 0.15

      if (rig.hasBone('spine')) {
        rig.setRotation('spine', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, spineCurl - spineExtend))
      }
      if (rig.hasBone('chest')) {
        rig.setRotation('chest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, (spineCurl - spineExtend) * 0.7))
      }
      if (rig.hasBone('upperChest')) {
        rig.setRotation('upperChest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, (spineCurl - spineExtend) * 0.5))
      }

      // ========== ARMS ==========
      // Anticipation: arms forward (balance)
      // Takeoff: arms swing UP and BACK (critical for rotation initiation)
      // Tuck: arms wrap around shins
      // Opening: arms extend out for balance
      // Landing: arms out for stability

      const armsForward = anticipation * 0.7
      const armsSwingUp = takeoff * 1.5 // Swing overhead and back
      const armsWrap = tuck * 1.2 * tuckTightness // Reach for shins
      const armsOut = (opening + landing) * 0.6

      if (rig.hasBone('leftUpperArm')) {
        // Complex arm path with base arm-down
        // Base arm-down from T-pose: ~70° (1.2 rad), reduced during swing up
        const armDownBase = 1.2 * (1 - armsSwingUp * 0.7 - armsOut * 0.5)
        let armPitch = armsForward - armsSwingUp + armsWrap - armsOut * 0.3
        // Left arm: negative Z brings arm down
        const rot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -armDownBase)
        rot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, armPitch))
        rig.setRotation('leftUpperArm', rot)
      }
      if (rig.hasBone('rightUpperArm')) {
        const armDownBase = 1.2 * (1 - armsSwingUp * 0.7 - armsOut * 0.5)
        let armPitch = armsForward - armsSwingUp + armsWrap - armsOut * 0.3
        // Right arm: positive Z brings arm down
        const rot = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, armDownBase)
        rot.multiply(quatFromAxisAngle({ x: 1, y: 0, z: 0 }, armPitch))
        rig.setRotation('rightUpperArm', rot)
      }

      // Elbows - bent during tuck (grabbing shins), extended during swing
      const elbowBend = 0.4 + tuck * 1.2 * tuckTightness + anticipation * 0.3 + landing * 0.3
      const elbowExtend = takeoff * 0.3 + armsOut * 0.4

      if (rig.hasBone('leftLowerArm')) {
        rig.setRotation('leftLowerArm', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, elbowBend - elbowExtend))
      }
      if (rig.hasBone('rightLowerArm')) {
        rig.setRotation('rightLowerArm', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, elbowBend - elbowExtend))
      }

      // Shoulders
      if (rig.hasBone('leftShoulder')) {
        const shrug = takeoff * 0.15 + tuck * 0.1
        rig.setRotation('leftShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -shrug))
      }
      if (rig.hasBone('rightShoulder')) {
        const shrug = takeoff * 0.15 + tuck * 0.1
        rig.setRotation('rightShoulder', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, shrug))
      }

      // Hands - grip during tuck
      if (rig.hasBone('leftHand')) {
        const grip = tuck * 0.4 * tuckTightness + (takeoff + landing) * 0.2
        rig.setRotation('leftHand', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, grip))
      }
      if (rig.hasBone('rightHand')) {
        const grip = tuck * 0.4 * tuckTightness + (takeoff + landing) * 0.2
        rig.setRotation('rightHand', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, grip))
      }

      // ========== HEAD/NECK ==========
      // Head throw back initiates rotation (critical)
      // Then spots landing during opening
      const headThrow = takeoff * 0.5 // Look back (initiate rotation)
      const headSpot = opening * 0.3 // Look for ground
      const headStable = landing * 0.1

      if (rig.hasBone('neck')) {
        // Relative to body, throws back then levels
        rig.setRotation('neck', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -headThrow + headSpot))
      }
      if (rig.hasBone('head')) {
        rig.setRotation('head', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -headThrow * 0.5 + headSpot * 0.5))
      }

      // ========== MICRO-MOVEMENTS ==========
      // Minimal during flip (focus and tension), more during effort phases
      const microPhase = t * 10
      const microAmp = 0.008 * (anticipation * 2 + landing * 1.5)

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
 * Default backflip motion with default parameters.
 */
export const backflip: MotionProgram<BackflipParams> = createBackflip({})
