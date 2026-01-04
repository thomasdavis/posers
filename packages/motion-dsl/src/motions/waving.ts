/**
 * Waving Motion - Complex Choreographed Sequence
 *
 * Uses setRotationRel for portable rotations across VRM models.
 * All rotations are deltas from rest pose (T-pose).
 *
 * Phases:
 * 1. ARM RAISE - Arm comes up from rest with anticipation
 * 2. BIG WAVES - Enthusiastic initial greeting waves
 * 3. SMALL WAVES - Settle into friendly smaller waves
 * 4. FLOURISH - Final expressive wave with body involvement
 * 5. ARM LOWER - Return to rest
 *
 * Full cycle is ~8 seconds for a complete greeting sequence.
 */

import { Quaternion } from 'three'
import { z } from 'zod'
import type { MotionProgram, MotionMeta, HumanoidRig, MotionContext, VRMHumanBoneName } from '@posers/core'
import { lerp } from '@posers/core'

// ============================================================================
// PARAMS SCHEMA
// ============================================================================

export const wavingParamsSchema = z.object({
  wavingHand: z.enum(['left', 'right']).default('right'),
  energy: z.number().min(0).max(1).default(0.8),
  cycleDuration: z.number().min(4).max(16).default(8),
})

export type WavingParams = z.infer<typeof wavingParamsSchema>

// ============================================================================
// MOTION META
// ============================================================================

export const wavingMeta: MotionMeta = {
  id: 'waving',
  name: 'Waving',
  description: 'Expressive choreographed waving with arm raise, varied waves, and body movement',
  tags: ['greeting', 'social', 'gesture', 'friendly', 'expressive'],
  author: 'posers',
}

// ============================================================================
// QUATERNION HELPERS
// ============================================================================

// Reusable quaternions to avoid allocations
const _qX = new Quaternion()
const _qY = new Quaternion()
const _qZ = new Quaternion()
const _qResult = new Quaternion()

/**
 * Create rotation delta from euler angles (XYZ order).
 * Uses setFromAxisAngle for precision.
 */
function eulerDelta(x: number, y: number, z: number, out: Quaternion): Quaternion {
  out.identity()

  if (Math.abs(x) > 1e-6) {
    _qX.setFromAxisAngle({ x: 1, y: 0, z: 0 } as any, x)
    out.multiply(_qX)
  }
  if (Math.abs(y) > 1e-6) {
    _qY.setFromAxisAngle({ x: 0, y: 1, z: 0 } as any, y)
    out.multiply(_qY)
  }
  if (Math.abs(z) > 1e-6) {
    _qZ.setFromAxisAngle({ x: 0, y: 0, z: 1 } as any, z)
    out.multiply(_qZ)
  }

  return out
}

// ============================================================================
// EASING FUNCTIONS
// ============================================================================

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

function easeInQuad(t: number): number {
  return t * t
}

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t
  const p = 0.3
  return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1
}

function phaseProgress(t: number, start: number, end: number): number {
  if (t < start) return 0
  if (t > end) return 1
  return (t - start) / (end - start)
}

// ============================================================================
// PHASE DEFINITIONS
// ============================================================================

const PHASES = {
  ARM_RAISE_START: 0,
  ARM_RAISE_END: 0.15,
  BIG_WAVES_START: 0.15,
  BIG_WAVES_END: 0.40,
  SMALL_WAVES_START: 0.40,
  SMALL_WAVES_END: 0.70,
  FLOURISH_START: 0.70,
  FLOURISH_END: 0.85,
  ARM_LOWER_START: 0.85,
  ARM_LOWER_END: 1.0,
}

// ============================================================================
// MOTION IMPLEMENTATION
// ============================================================================

export function createWaving(params: Partial<WavingParams> = {}): MotionProgram<WavingParams> {
  const validatedParams = wavingParamsSchema.parse(params)

  // Pre-allocate quaternions for each bone to avoid GC
  const boneQuats = new Map<string, Quaternion>()
  const getBoneQuat = (name: string): Quaternion => {
    let q = boneQuats.get(name)
    if (!q) {
      q = new Quaternion()
      boneQuats.set(name, q)
    }
    return q
  }

  return {
    meta: wavingMeta,
    paramsSchema: wavingParamsSchema,

    update(rig: HumanoidRig, ctx: MotionContext, t: number, dt: number): void {
      const { wavingHand, energy, cycleDuration } = validatedParams

      const cycleTime = (t % cycleDuration) / cycleDuration
      const isRightHand = wavingHand === 'right'
      const side = isRightHand ? 1 : -1

      // Bone names
      const wavingUpperArm = `${wavingHand}UpperArm` as VRMHumanBoneName
      const wavingLowerArm = `${wavingHand}LowerArm` as VRMHumanBoneName
      const wavingHandBone = `${wavingHand}Hand` as VRMHumanBoneName
      const wavingShoulder = `${wavingHand}Shoulder` as VRMHumanBoneName

      const supportArm = isRightHand ? 'left' : 'right'
      const supportUpperArm = `${supportArm}UpperArm` as VRMHumanBoneName
      const supportLowerArm = `${supportArm}LowerArm` as VRMHumanBoneName
      const supportHandBone = `${supportArm}Hand` as VRMHumanBoneName
      const supportSide = isRightHand ? -1 : 1

      // ========================================
      // CALCULATE PHASE-BASED PARAMETERS
      // ========================================

      let armRaise = 0
      let waveIntensity = 0
      let waveSpeed = 0
      let bodyLean = 0
      let shoulderPop = 0
      let headTilt = 0
      let armForward = 0

      // Phase 1: Arm Raise
      const raiseProgress = phaseProgress(cycleTime, PHASES.ARM_RAISE_START, PHASES.ARM_RAISE_END)
      if (raiseProgress > 0 && raiseProgress < 1) {
        armRaise = easeOutBack(raiseProgress)
        shoulderPop = easeOutQuart(raiseProgress) * 0.5
        headTilt = easeOutQuart(raiseProgress) * 0.3
      }

      // Phase 2: Big Waves
      const bigWaveProgress = phaseProgress(cycleTime, PHASES.BIG_WAVES_START, PHASES.BIG_WAVES_END)
      if (bigWaveProgress > 0) {
        armRaise = 1
        if (bigWaveProgress < 1) {
          waveIntensity = 0.8 + 0.2 * Math.sin(bigWaveProgress * Math.PI)
          waveSpeed = 4.5
          bodyLean = 0.3 * Math.sin(bigWaveProgress * Math.PI * 2)
          shoulderPop = 0.5 + 0.3 * Math.sin(bigWaveProgress * Math.PI * 4)
          headTilt = 0.5
          armForward = 0.3
        }
      }

      // Phase 3: Small Waves
      const smallWaveProgress = phaseProgress(cycleTime, PHASES.SMALL_WAVES_START, PHASES.SMALL_WAVES_END)
      if (smallWaveProgress > 0 && smallWaveProgress < 1) {
        armRaise = 1
        waveIntensity = lerp(0.8, 0.4, easeInOutCubic(smallWaveProgress))
        waveSpeed = lerp(4.5, 2.5, smallWaveProgress)
        bodyLean = 0.1 * Math.sin(smallWaveProgress * Math.PI)
        shoulderPop = 0.3
        headTilt = lerp(0.5, 0.3, smallWaveProgress)
        armForward = lerp(0.3, 0.2, smallWaveProgress)
      }

      // Phase 4: Flourish
      const flourishProgress = phaseProgress(cycleTime, PHASES.FLOURISH_START, PHASES.FLOURISH_END)
      if (flourishProgress > 0 && flourishProgress < 1) {
        armRaise = 1 + 0.2 * easeOutElastic(flourishProgress)
        waveIntensity = 0.6 + 0.4 * (1 - flourishProgress)
        waveSpeed = 3
        bodyLean = 0.4 * Math.sin(flourishProgress * Math.PI)
        shoulderPop = 0.6 * easeOutElastic(flourishProgress)
        headTilt = 0.6 * Math.sin(flourishProgress * Math.PI)
        armForward = 0.4 * Math.sin(flourishProgress * Math.PI)
      }

      // Phase 5: Arm Lower
      const lowerProgress = phaseProgress(cycleTime, PHASES.ARM_LOWER_START, PHASES.ARM_LOWER_END)
      if (lowerProgress > 0) {
        armRaise = 1 - easeInOutCubic(lowerProgress)
        waveIntensity = 0.3 * (1 - lowerProgress)
        waveSpeed = 2
        shoulderPop = 0.3 * (1 - easeInQuad(lowerProgress))
        headTilt = 0.3 * (1 - lowerProgress)
        armForward = 0.1 * (1 - lowerProgress)
      }

      // Apply energy
      waveIntensity *= energy
      bodyLean *= energy
      shoulderPop *= energy
      headTilt *= energy

      // ========================================
      // WAVING ARM (using setRotationRel)
      // ========================================

      if (rig.hasBone(wavingUpperArm)) {
        // Delta from T-pose: raise arm out and forward
        // In T-pose, arms are horizontal. We rotate:
        // - Z axis to raise/lower (negative Z = up for both sides in VRM normalized space)
        // - X axis for forward reach
        // - Y axis for twist
        const q = getBoneQuat(wavingUpperArm)

        // Raise arm up (from horizontal T-pose, negative Z rotates up)
        const raiseAngle = -side * 0.8 * armRaise
        // Forward reach
        const forwardAngle = -0.4 * armRaise * (0.5 + armForward)
        // Slight outward twist
        const twistAngle = side * 0.2 * armRaise

        eulerDelta(forwardAngle, twistAngle, raiseAngle, q)
        rig.setRotationRel(wavingUpperArm, q)
      }

      if (rig.hasBone(wavingLowerArm)) {
        const q = getBoneQuat(wavingLowerArm)
        // Elbow bend (Y axis in VRM = elbow flexion)
        const bendAngle = -1.8 * armRaise
        // Add bounce during waves
        const bounce = Math.sin(t * waveSpeed * Math.PI * 0.5) * 0.15 * waveIntensity

        eulerDelta(0, bendAngle + bounce, 0, q)
        rig.setRotationRel(wavingLowerArm, q)
      }

      if (rig.hasBone(wavingHandBone)) {
        const q = getBoneQuat(wavingHandBone)
        const wavePhase = t * waveSpeed * Math.PI * 2

        // Primary wave: side to side (Z axis)
        const waveSideToSide = Math.sin(wavePhase) * 0.7 * waveIntensity
        // Secondary: rotation (Y axis)
        const waveRotation = Math.sin(wavePhase * 1.5 + 0.5) * 0.3 * waveIntensity
        // Wrist extension (X axis - tilt back)
        const wristExtension = -0.3 * armRaise

        eulerDelta(wristExtension, side * waveRotation, waveSideToSide, q)
        rig.setRotationRel(wavingHandBone, q)
      }

      if (rig.hasBone(wavingShoulder)) {
        const q = getBoneQuat(wavingShoulder)
        const lift = -0.15 * shoulderPop * armRaise
        const forward = 0.1 * armRaise * armForward

        eulerDelta(forward, 0, side * lift, q)
        rig.setRotationRel(wavingShoulder, q)
      }

      // ========================================
      // FINGERS
      // ========================================

      const fingers = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'] as const
      const segments = ['Proximal', 'Intermediate', 'Distal'] as const

      for (const finger of fingers) {
        for (let i = 0; i < segments.length; i++) {
          const boneName = `${wavingHand}${finger}${segments[i]}` as VRMHumanBoneName
          if (rig.hasBone(boneName)) {
            const q = getBoneQuat(boneName)

            const spread = finger === 'Thumb' ? 0.3 : (finger === 'Little' ? 0.15 : 0.08)
            const curl = (0.05 + i * 0.03) * armRaise
            const wiggle = Math.sin(t * waveSpeed * Math.PI * 2 + fingers.indexOf(finger) * 0.5) * 0.05 * waveIntensity

            eulerDelta(curl + wiggle, 0, side * spread * armRaise, q)
            rig.setRotationRel(boneName, q)
          }
        }
      }

      // ========================================
      // SUPPORT ARM
      // ========================================

      if (rig.hasBone(supportUpperArm)) {
        const q = getBoneQuat(supportUpperArm)
        // Very subtle sway - mostly stay at rest
        const subtleSway = Math.sin(t * 0.5) * 0.02 * energy
        eulerDelta(0.03, 0, subtleSway, q)
        rig.setRotationRel(supportUpperArm, q)
      }

      if (rig.hasBone(supportLowerArm)) {
        const q = getBoneQuat(supportLowerArm)
        // Slight natural bend
        eulerDelta(0, -0.1, 0, q)
        rig.setRotationRel(supportLowerArm, q)
      }

      if (rig.hasBone(supportHandBone)) {
        const q = getBoneQuat(supportHandBone)
        eulerDelta(0.08, 0, 0, q)
        rig.setRotationRel(supportHandBone, q)
      }

      // ========================================
      // BODY
      // ========================================

      if (rig.hasBone('spine')) {
        const q = getBoneQuat('spine')
        const lean = side * 0.05 * bodyLean
        const forward = 0.03 * armRaise
        eulerDelta(forward, 0, lean, q)
        rig.setRotationRel('spine', q)
      }

      if (rig.hasBone('chest')) {
        const q = getBoneQuat('chest')
        const breathe = Math.sin(t * 0.8) * 0.015
        const lean = side * 0.03 * bodyLean
        eulerDelta(breathe, 0, lean, q)
        rig.setRotationRel('chest', q)
      }

      if (rig.hasBone('hips')) {
        const q = getBoneQuat('hips')
        const shift = side * 0.02 * bodyLean
        eulerDelta(0, 0, shift, q)
        rig.setRotationRel('hips', q)
      }

      // ========================================
      // HEAD
      // ========================================

      if (rig.hasBone('head')) {
        const q = getBoneQuat('head')
        const tiltZ = side * 0.08 * headTilt
        const nodX = Math.sin(t * waveSpeed * Math.PI) * 0.04 * waveIntensity
        const turnY = side * 0.1 * headTilt
        eulerDelta(nodX, turnY, tiltZ, q)
        rig.setRotationRel('head', q)
      }

      if (rig.hasBone('neck')) {
        const q = getBoneQuat('neck')
        const tilt = side * 0.04 * headTilt
        eulerDelta(0, 0, tilt, q)
        rig.setRotationRel('neck', q)
      }

      // ========================================
      // LEGS
      // ========================================

      if (rig.hasBone('leftUpperLeg')) {
        const q = getBoneQuat('leftUpperLeg')
        const shift = isRightHand ? 0.03 * bodyLean : -0.02 * bodyLean
        eulerDelta(0, 0, shift, q)
        rig.setRotationRel('leftUpperLeg', q)
      }

      if (rig.hasBone('rightUpperLeg')) {
        const q = getBoneQuat('rightUpperLeg')
        const shift = isRightHand ? -0.02 * bodyLean : 0.03 * bodyLean
        eulerDelta(0, 0, shift, q)
        rig.setRotationRel('rightUpperLeg', q)
      }
    },
  }
}

// Default export
export const waving: MotionProgram<WavingParams> = createWaving({})
