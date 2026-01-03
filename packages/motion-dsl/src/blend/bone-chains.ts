/**
 * Bone Chain Utilities
 *
 * Helpers for animating connected bone chains (spine, arms, legs, fingers).
 * Provides wave propagation, secondary motion, and chain-based operations.
 */

import { Quaternion } from 'three'
import type { VRMHumanBoneName } from '@posers/core'
import { quatFromAxisAngle } from '@posers/core'

/**
 * Minimal rig interface for bone chain operations
 */
export interface RigInterface {
  hasBone(bone: VRMHumanBoneName): boolean
  setRotation(bone: VRMHumanBoneName, rotation: Quaternion): void
  addRotation(bone: VRMHumanBoneName, rotation: Quaternion): void
}

/**
 * Predefined bone chains
 */
export const BoneChains = {
  /** Full spine from hips to head */
  spine: [
    'hips', 'spine', 'chest', 'upperChest', 'neck', 'head'
  ] as VRMHumanBoneName[],

  /** Core spine without head */
  spineCore: [
    'hips', 'spine', 'chest', 'upperChest'
  ] as VRMHumanBoneName[],

  /** Left arm from shoulder to hand */
  leftArm: [
    'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand'
  ] as VRMHumanBoneName[],

  /** Right arm from shoulder to hand */
  rightArm: [
    'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand'
  ] as VRMHumanBoneName[],

  /** Left leg from hip to foot */
  leftLeg: [
    'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes'
  ] as VRMHumanBoneName[],

  /** Right leg from hip to foot */
  rightLeg: [
    'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes'
  ] as VRMHumanBoneName[],

  /** Left hand fingers */
  leftFingers: [
    'leftThumbProximal', 'leftThumbIntermediate', 'leftThumbDistal',
    'leftIndexProximal', 'leftIndexIntermediate', 'leftIndexDistal',
    'leftMiddleProximal', 'leftMiddleIntermediate', 'leftMiddleDistal',
    'leftRingProximal', 'leftRingIntermediate', 'leftRingDistal',
    'leftLittleProximal', 'leftLittleIntermediate', 'leftLittleDistal',
  ] as VRMHumanBoneName[],

  /** Right hand fingers */
  rightFingers: [
    'rightThumbProximal', 'rightThumbIntermediate', 'rightThumbDistal',
    'rightIndexProximal', 'rightIndexIntermediate', 'rightIndexDistal',
    'rightMiddleProximal', 'rightMiddleIntermediate', 'rightMiddleDistal',
    'rightRingProximal', 'rightRingIntermediate', 'rightRingDistal',
    'rightLittleProximal', 'rightLittleIntermediate', 'rightLittleDistal',
  ] as VRMHumanBoneName[],

  /** Individual finger chains */
  leftThumb: ['leftThumbProximal', 'leftThumbIntermediate', 'leftThumbDistal'] as VRMHumanBoneName[],
  leftIndex: ['leftIndexProximal', 'leftIndexIntermediate', 'leftIndexDistal'] as VRMHumanBoneName[],
  leftMiddle: ['leftMiddleProximal', 'leftMiddleIntermediate', 'leftMiddleDistal'] as VRMHumanBoneName[],
  leftRing: ['leftRingProximal', 'leftRingIntermediate', 'leftRingDistal'] as VRMHumanBoneName[],
  leftLittle: ['leftLittleProximal', 'leftLittleIntermediate', 'leftLittleDistal'] as VRMHumanBoneName[],

  rightThumb: ['rightThumbProximal', 'rightThumbIntermediate', 'rightThumbDistal'] as VRMHumanBoneName[],
  rightIndex: ['rightIndexProximal', 'rightIndexIntermediate', 'rightIndexDistal'] as VRMHumanBoneName[],
  rightMiddle: ['rightMiddleProximal', 'rightMiddleIntermediate', 'rightMiddleDistal'] as VRMHumanBoneName[],
  rightRing: ['rightRingProximal', 'rightRingIntermediate', 'rightRingDistal'] as VRMHumanBoneName[],
  rightLittle: ['rightLittleProximal', 'rightLittleIntermediate', 'rightLittleDistal'] as VRMHumanBoneName[],

  /** Eyes */
  eyes: ['leftEye', 'rightEye'] as VRMHumanBoneName[],

  /** All upper body bones */
  upperBody: [
    'spine', 'chest', 'upperChest', 'neck', 'head',
    'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
    'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  ] as VRMHumanBoneName[],

  /** All lower body bones */
  lowerBody: [
    'hips',
    'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
    'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
  ] as VRMHumanBoneName[],
} as const

/**
 * Get available bones from a chain based on what the rig supports
 */
export function getAvailableBones(rig: RigInterface, chain: VRMHumanBoneName[]): VRMHumanBoneName[] {
  return chain.filter(bone => rig.hasBone(bone))
}

/**
 * Apply a wave rotation along a bone chain
 *
 * Creates a wave-like motion propagating through the chain,
 * useful for spinal movements, tails, etc.
 *
 * @param rig The humanoid rig
 * @param chain Array of bone names in order
 * @param axis Rotation axis (x, y, or z)
 * @param amplitude Base rotation amount in radians
 * @param phase Current phase of the wave (0-1)
 * @param waveLength How many bones make up one full wave cycle
 * @param falloff How much amplitude decreases along the chain (0-1)
 */
export function applyChainWave(
  rig: RigInterface,
  chain: VRMHumanBoneName[],
  axis: 'x' | 'y' | 'z',
  amplitude: number,
  phase: number,
  waveLength: number = chain.length,
  falloff: number = 0
): void {
  const availableBones = getAvailableBones(rig, chain)

  availableBones.forEach((bone, i) => {
    const bonePhase = phase + (i / waveLength)
    const boneAmplitude = amplitude * (1 - falloff * (i / availableBones.length))
    const rotation = Math.sin(bonePhase * Math.PI * 2) * boneAmplitude

    const axisVec = axis === 'x' ? { x: 1, y: 0, z: 0 }
      : axis === 'y' ? { x: 0, y: 1, z: 0 }
      : { x: 0, y: 0, z: 1 }

    const quat = quatFromAxisAngle(axisVec, rotation)
    rig.addRotation(bone, quat)
  })
}

/**
 * Apply cascading rotation along a chain with delay
 *
 * Each bone rotates with a slight delay from the previous,
 * creating follow-through/secondary motion.
 *
 * @param rig The humanoid rig
 * @param chain Array of bone names in order
 * @param axis Rotation axis
 * @param rotations Array of target rotations for each bone
 * @param t Current time
 * @param delayPerBone Delay between each bone (seconds)
 * @param smoothing Smoothing factor (0-1)
 */
export function applyChainCascade(
  rig: RigInterface,
  chain: VRMHumanBoneName[],
  axis: 'x' | 'y' | 'z',
  baseRotation: number,
  t: number,
  delayPerBone: number = 0.05,
  damping: number = 0.8
): void {
  const availableBones = getAvailableBones(rig, chain)

  availableBones.forEach((bone, i) => {
    // Each bone has a delayed, dampened version of the base rotation
    const delay = i * delayPerBone
    const dampedT = Math.max(0, t - delay)
    const dampedRotation = baseRotation * Math.pow(damping, i) * Math.sin(dampedT * Math.PI * 2)

    const axisVec = axis === 'x' ? { x: 1, y: 0, z: 0 }
      : axis === 'y' ? { x: 0, y: 1, z: 0 }
      : { x: 0, y: 0, z: 1 }

    const quat = quatFromAxisAngle(axisVec, dampedRotation)
    rig.addRotation(bone, quat)
  })
}

/**
 * Apply uniform rotation to all bones in a chain
 */
export function applyChainRotation(
  rig: RigInterface,
  chain: VRMHumanBoneName[],
  rotation: Quaternion,
  falloff: number = 0
): void {
  const availableBones = getAvailableBones(rig, chain)

  availableBones.forEach((bone, i) => {
    if (falloff > 0) {
      const weight = 1 - falloff * (i / availableBones.length)
      const dampedRot = new Quaternion().slerpQuaternions(new Quaternion(), rotation, weight)
      rig.addRotation(bone, dampedRot)
    } else {
      rig.addRotation(bone, rotation)
    }
  })
}

/**
 * Finger curl helper - curl all fingers on a hand
 *
 * @param rig The humanoid rig
 * @param hand 'left' or 'right'
 * @param curlAmounts Object mapping finger name to curl amount (0-1)
 */
export function applyFingerCurl(
  rig: RigInterface,
  hand: 'left' | 'right',
  curlAmounts: {
    thumb?: number
    index?: number
    middle?: number
    ring?: number
    little?: number
  }
): void {
  const maxCurlAngle = Math.PI * 0.45 // ~80 degrees max curl per joint

  const fingerChains = hand === 'left' ? {
    thumb: BoneChains.leftThumb,
    index: BoneChains.leftIndex,
    middle: BoneChains.leftMiddle,
    ring: BoneChains.leftRing,
    little: BoneChains.leftLittle,
  } : {
    thumb: BoneChains.rightThumb,
    index: BoneChains.rightIndex,
    middle: BoneChains.rightMiddle,
    ring: BoneChains.rightRing,
    little: BoneChains.rightLittle,
  }

  for (const [finger, curl] of Object.entries(curlAmounts)) {
    if (curl === undefined) continue

    const chain = fingerChains[finger as keyof typeof fingerChains]
    if (!chain) continue

    const availableBones = getAvailableBones(rig, chain)

    availableBones.forEach((bone, i) => {
      // Thumb rotates differently
      const isThumb = finger === 'thumb'
      const curlAxis = isThumb && i === 0 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 }

      // Each joint curls slightly less than the previous
      const jointCurl = curl * maxCurlAngle * (1 - i * 0.15)
      const quat = quatFromAxisAngle(curlAxis, jointCurl)
      rig.setRotation(bone, quat)
    })
  }
}

/**
 * Spread fingers apart
 *
 * @param rig The humanoid rig
 * @param hand 'left' or 'right'
 * @param spreadAmount How much to spread (0-1)
 */
export function applyFingerSpread(
  rig: RigInterface,
  hand: 'left' | 'right',
  spreadAmount: number
): void {
  const maxSpread = Math.PI * 0.15 // ~27 degrees max spread

  const fingers = hand === 'left' ? [
    { bone: 'leftIndexProximal' as VRMHumanBoneName, offset: -1 },
    { bone: 'leftMiddleProximal' as VRMHumanBoneName, offset: 0 },
    { bone: 'leftRingProximal' as VRMHumanBoneName, offset: 1 },
    { bone: 'leftLittleProximal' as VRMHumanBoneName, offset: 2 },
  ] : [
    { bone: 'rightIndexProximal' as VRMHumanBoneName, offset: 1 },
    { bone: 'rightMiddleProximal' as VRMHumanBoneName, offset: 0 },
    { bone: 'rightRingProximal' as VRMHumanBoneName, offset: -1 },
    { bone: 'rightLittleProximal' as VRMHumanBoneName, offset: -2 },
  ]

  for (const { bone, offset } of fingers) {
    if (!rig.hasBone(bone)) continue

    const spread = offset * spreadAmount * maxSpread * 0.5
    const quat = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, spread)
    rig.addRotation(bone, quat)
  }
}

/**
 * Create a cigarette/pen holding pose for fingers
 *
 * @param rig The humanoid rig
 * @param hand 'left' or 'right'
 * @param style 'pinch' | 'between' | 'relaxed'
 */
export function applyCigaretteGrip(
  rig: RigInterface,
  hand: 'left' | 'right',
  style: 'pinch' | 'between' | 'relaxed' = 'between'
): void {
  switch (style) {
    case 'pinch':
      // Thumb and index pinching, others relaxed
      applyFingerCurl(rig, hand, {
        thumb: 0.4,
        index: 0.5,
        middle: 0.6,
        ring: 0.65,
        little: 0.7,
      })
      break

    case 'between':
      // Cigarette between index and middle
      applyFingerCurl(rig, hand, {
        thumb: 0.3,
        index: 0.35,
        middle: 0.35,
        ring: 0.5,
        little: 0.55,
      })
      // Spread index and middle slightly
      const indexBone = (hand === 'left' ? 'leftIndexProximal' : 'rightIndexProximal') as VRMHumanBoneName
      const middleBone = (hand === 'left' ? 'leftMiddleProximal' : 'rightMiddleProximal') as VRMHumanBoneName

      if (rig.hasBone(indexBone)) {
        const dir = hand === 'left' ? -1 : 1
        rig.addRotation(indexBone, quatFromAxisAngle({ x: 0, y: 0, z: 1 }, dir * 0.15))
      }
      if (rig.hasBone(middleBone)) {
        const dir = hand === 'left' ? 1 : -1
        rig.addRotation(middleBone, quatFromAxisAngle({ x: 0, y: 0, z: 1 }, dir * 0.1))
      }
      break

    case 'relaxed':
      // Loose grip
      applyFingerCurl(rig, hand, {
        thumb: 0.25,
        index: 0.3,
        middle: 0.35,
        ring: 0.4,
        little: 0.45,
      })
      break
  }
}
