/**
 * Rig Calibration System
 *
 * Computes and stores per-bone calibration data that makes motion code portable
 * across different VRM models. This includes:
 * - Rest pose quaternions (local and world)
 * - Twist axes for each bone (computed from bone→child direction)
 * - Humanoid space basis vectors
 * - Scale measurements
 */

import { Quaternion, Vector3, Object3D } from 'three'
import type { VRMHumanBoneName } from '@posers/core'
import type { VRMHumanoidRig } from './rig'

// Reusable temp vectors
const _aW = new Vector3()
const _bW = new Vector3()
const _dirW = new Vector3()
const _dirL = new Vector3()

/**
 * Calibration data for a single bone.
 */
export interface BoneCalibration {
  bone: VRMHumanBoneName
  node: Object3D

  // Rest pose quaternions
  restLocal: Quaternion
  restWorld: Quaternion

  // Direction to child bone in REST pose (world and local space)
  // undefined if bone has no relevant child
  restDirWorld?: Vector3
  restDirLocal?: Vector3

  // Twist axis in local space (unit vector)
  // For limbs, this is the bone's primary axis (shoulder→elbow, elbow→wrist, etc.)
  twistAxisLocal?: Vector3

  // For hinge joints (elbow, knee), the hinge axis in local space
  hingeAxisLocal?: Vector3

  // Bone length (distance to child) in meters
  length?: number
}

/**
 * Humanoid space basis (character-relative coordinate system).
 */
export interface HumanoidSpace {
  right: Vector3   // Character's right direction (world)
  up: Vector3      // Character's up direction (world)
  forward: Vector3 // Character's forward direction (world)
  origin: Vector3  // Hips world position at rest
}

/**
 * Scale measurements for the character.
 */
export interface CharacterScale {
  height: number          // Head to feet
  shoulderWidth: number   // Left shoulder to right shoulder
  armLength: number       // Shoulder to wrist (average of left/right)
  legLength: number       // Hip to ankle (average of left/right)
  headToNeck: number      // Head to neck distance
  torsoLength: number     // Hips to neck
}

/**
 * Full rig calibration data.
 */
export interface RigCalibration {
  bones: Map<VRMHumanBoneName, BoneCalibration>
  humanoidSpace: HumanoidSpace
  scale: CharacterScale
}

/**
 * Bone hierarchy for computing twist axes.
 * Maps parent bone to its child (for arm/leg chains).
 */
const BONE_CHILDREN: Partial<Record<VRMHumanBoneName, VRMHumanBoneName>> = {
  leftShoulder: 'leftUpperArm',
  leftUpperArm: 'leftLowerArm',
  leftLowerArm: 'leftHand',
  rightShoulder: 'rightUpperArm',
  rightUpperArm: 'rightLowerArm',
  rightLowerArm: 'rightHand',
  leftUpperLeg: 'leftLowerLeg',
  leftLowerLeg: 'leftFoot',
  leftFoot: 'leftToes',
  rightUpperLeg: 'rightLowerLeg',
  rightLowerLeg: 'rightFoot',
  rightFoot: 'rightToes',
  hips: 'spine',
  spine: 'chest',
  chest: 'neck',
  neck: 'head',
}

/**
 * Bones that act as hinges (primarily rotate around one axis).
 * Maps bone to its hinge axis in anatomical terms.
 */
const HINGE_BONES: Set<VRMHumanBoneName> = new Set([
  'leftLowerArm',  // Elbow
  'rightLowerArm',
  'leftLowerLeg',  // Knee
  'rightLowerLeg',
])

/**
 * Calibrate a VRM rig, computing all bone data for consistent motion control.
 *
 * IMPORTANT: Call this immediately after VRM load, with the model in rest pose,
 * and after scene matrices have been updated.
 *
 * @param rig - The VRM humanoid rig
 * @returns Full calibration data
 */
export function calibrateRig(rig: VRMHumanoidRig): RigCalibration {
  // Ensure world matrices are up to date
  rig.updateMatrixWorld()

  const bones = new Map<VRMHumanBoneName, BoneCalibration>()

  // Calibrate each available bone
  for (const boneName of rig.getAvailableBones()) {
    const node = rig.getBoneNode(boneName)
    if (!node) continue

    const calib: BoneCalibration = {
      bone: boneName,
      node,
      restLocal: node.quaternion.clone(),
      restWorld: new Quaternion(),
    }

    // Get world quaternion
    node.getWorldQuaternion(calib.restWorld)

    // Compute direction to child and twist axis
    const childBone = BONE_CHILDREN[boneName]
    if (childBone) {
      const childNode = rig.getBoneNode(childBone)
      if (childNode) {
        const result = computeTwistAxisFromChild(node, childNode)
        calib.restDirWorld = result.dirWorld
        calib.restDirLocal = result.dirLocal
        calib.twistAxisLocal = result.dirLocal.clone() // Twist axis = bone direction
        calib.length = result.length
      }
    }

    // For hinge joints, compute the hinge axis
    if (HINGE_BONES.has(boneName)) {
      calib.hingeAxisLocal = computeHingeAxis(boneName, calib.restDirLocal)
    }

    bones.set(boneName, calib)
  }

  // Compute humanoid space from hips orientation
  const humanoidSpace = computeHumanoidSpace(rig)

  // Compute scale measurements
  const scale = computeScale(rig, bones)

  return { bones, humanoidSpace, scale }
}

/**
 * Compute the twist axis (bone direction) from parent to child bone.
 */
function computeTwistAxisFromChild(
  bone: Object3D,
  child: Object3D
): { dirWorld: Vector3; dirLocal: Vector3; length: number } {
  // Get world positions
  bone.getWorldPosition(_aW)
  child.getWorldPosition(_bW)

  // Direction in world space
  _dirW.subVectors(_bW, _aW)
  const length = _dirW.length()
  _dirW.normalize()

  // Convert to bone local space
  // We need the direction as a vector in the bone's local coordinate system
  // localDir = bone.worldToLocal(worldPoint) - bone.worldToLocal(boneWorldPos)
  // Simplified: transform direction by inverse of bone's world rotation
  const invWorldQuat = new Quaternion()
  bone.getWorldQuaternion(invWorldQuat)
  invWorldQuat.invert()

  _dirL.copy(_dirW).applyQuaternion(invWorldQuat)
  _dirL.normalize()

  return {
    dirWorld: _dirW.clone(),
    dirLocal: _dirL.clone(),
    length,
  }
}

/**
 * Compute the hinge axis for elbow/knee joints.
 *
 * Elbows hinge around an axis perpendicular to the forearm direction.
 * Knees hinge around a lateral axis.
 */
function computeHingeAxis(
  bone: VRMHumanBoneName,
  boneDir?: Vector3
): Vector3 {
  // Default hinge axes based on anatomical conventions
  // In VRM normalized space, elbows bend around Y (lateral), knees around X (lateral)

  if (bone === 'leftLowerArm' || bone === 'rightLowerArm') {
    // Elbow: hinge around local Y (perpendicular to arm)
    // The exact axis depends on forearm twist, but Y is a good default
    return new Vector3(0, 1, 0)
  }

  if (bone === 'leftLowerLeg' || bone === 'rightLowerLeg') {
    // Knee: hinge around local X (lateral axis)
    return new Vector3(1, 0, 0)
  }

  // Fallback
  return new Vector3(0, 1, 0)
}

/**
 * Compute the humanoid space basis from the rig's hips.
 */
function computeHumanoidSpace(rig: VRMHumanoidRig): HumanoidSpace {
  const hipsNode = rig.getBoneNode('hips')

  if (!hipsNode) {
    // Fallback to world axes
    return {
      right: new Vector3(1, 0, 0),
      up: new Vector3(0, 1, 0),
      forward: new Vector3(0, 0, 1),
      origin: new Vector3(0, 0, 0),
    }
  }

  // Get hips world transform
  const origin = new Vector3()
  hipsNode.getWorldPosition(origin)

  const worldQuat = new Quaternion()
  hipsNode.getWorldQuaternion(worldQuat)

  // Transform local axes to world
  // In VRM: +X = right, +Y = up, +Z = forward (facing camera in T-pose)
  const right = new Vector3(1, 0, 0).applyQuaternion(worldQuat).normalize()
  const up = new Vector3(0, 1, 0).applyQuaternion(worldQuat).normalize()
  const forward = new Vector3(0, 0, 1).applyQuaternion(worldQuat).normalize()

  return { right, up, forward, origin }
}

/**
 * Compute character scale measurements.
 */
function computeScale(
  rig: VRMHumanoidRig,
  bones: Map<VRMHumanBoneName, BoneCalibration>
): CharacterScale {
  // Helper to get bone length
  const getLength = (bone: VRMHumanBoneName): number => {
    return bones.get(bone)?.length ?? 0
  }

  // Helper to get world position
  const getPos = (bone: VRMHumanBoneName): Vector3 => {
    return rig.getWorldPosition(bone)
  }

  // Shoulder width
  const leftShoulder = getPos('leftShoulder')
  const rightShoulder = getPos('rightShoulder')
  const shoulderWidth = leftShoulder.distanceTo(rightShoulder)

  // Arm length (shoulder → elbow → wrist)
  const leftArmLength =
    getLength('leftUpperArm') + getLength('leftLowerArm')
  const rightArmLength =
    getLength('rightUpperArm') + getLength('rightLowerArm')
  const armLength = (leftArmLength + rightArmLength) / 2

  // Leg length (hip → knee → ankle)
  const leftLegLength =
    getLength('leftUpperLeg') + getLength('leftLowerLeg')
  const rightLegLength =
    getLength('rightUpperLeg') + getLength('rightLowerLeg')
  const legLength = (leftLegLength + rightLegLength) / 2

  // Head to neck
  const headToNeck = getLength('neck')

  // Torso length (hips → neck)
  const torsoLength =
    getLength('hips') + getLength('spine') + (getLength('chest') || 0)

  // Total height (head to feet)
  const head = getPos('head')
  const leftFoot = getPos('leftFoot')
  const rightFoot = getPos('rightFoot')
  const feetY = (leftFoot.y + rightFoot.y) / 2
  const height = head.y - feetY

  return {
    height: Math.max(0.1, height),
    shoulderWidth: Math.max(0.1, shoulderWidth),
    armLength: Math.max(0.1, armLength),
    legLength: Math.max(0.1, legLength),
    headToNeck: Math.max(0.01, headToNeck),
    torsoLength: Math.max(0.1, torsoLength),
  }
}

/**
 * Get a semantic landmark position (e.g., "mouth") from calibration.
 */
export function getLandmarkPosition(
  rig: VRMHumanoidRig,
  calibration: RigCalibration,
  landmark: string
): Vector3 {
  switch (landmark) {
    case 'mouth': {
      // Estimate mouth position from head bone
      // Mouth is roughly 0.1 * head-neck distance below and in front of head
      const head = rig.getWorldPosition('head')
      const offset = calibration.scale.headToNeck * 0.3
      // Offset down and forward
      head.y -= offset * 0.5
      head.add(calibration.humanoidSpace.forward.clone().multiplyScalar(offset))
      return head
    }

    case 'chin': {
      const head = rig.getWorldPosition('head')
      const offset = calibration.scale.headToNeck * 0.4
      head.y -= offset
      return head
    }

    case 'chest_center': {
      const chest = rig.getWorldPosition('chest')
      return chest
    }

    default:
      // Try to get as bone position
      return rig.getWorldPosition(landmark as VRMHumanBoneName)
  }
}

/**
 * Get the distance between two landmarks.
 */
export function getLandmarkDistance(
  rig: VRMHumanoidRig,
  calibration: RigCalibration,
  from: string,
  to: string
): number {
  const posA = getLandmarkPosition(rig, calibration, from)
  const posB = getLandmarkPosition(rig, calibration, to)
  return posA.distanceTo(posB)
}
