import type { VRMHumanBoneName, Pose } from '@posers/core'
import { createEmptyPose } from '@posers/core'

/**
 * A mask defining which bones are affected by a motion.
 */
export interface BoneMask {
  bones: Set<VRMHumanBoneName>
  includeHips: boolean
}

/**
 * Predefined bone masks for common use cases.
 */
export const BONE_MASKS = {
  upperBody: createBoneMask([
    'spine', 'chest', 'upperChest', 'neck', 'head',
    'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
    'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  ], false),

  lowerBody: createBoneMask([
    'hips',
    'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
    'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
  ], true),

  leftArm: createBoneMask([
    'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  ], false),

  rightArm: createBoneMask([
    'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  ], false),

  leftLeg: createBoneMask([
    'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
  ], false),

  rightLeg: createBoneMask([
    'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
  ], false),

  spine: createBoneMask([
    'hips', 'spine', 'chest', 'upperChest',
  ], true),

  head: createBoneMask([
    'neck', 'head',
  ], false),

  fullBody: createBoneMask([
    'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
    'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
    'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
    'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
    'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
  ], true),
}

/**
 * Create a bone mask from a list of bone names.
 */
export function createBoneMask(
  bones: VRMHumanBoneName[],
  includeHips = false
): BoneMask {
  return {
    bones: new Set(bones),
    includeHips,
  }
}

/**
 * Apply a mask to a pose, returning only the masked bones.
 */
export function applyMaskToPose(pose: Pose, mask: BoneMask): Pose {
  const result = createEmptyPose()

  for (const [bone, rotation] of pose.rotations) {
    if (mask.bones.has(bone)) {
      result.rotations.set(bone, rotation.clone())
    }
  }

  if (mask.includeHips && pose.hipsOffset) {
    result.hipsOffset = pose.hipsOffset.clone()
  }

  return result
}

/**
 * Invert a bone mask.
 */
export function invertMask(mask: BoneMask, allBones: VRMHumanBoneName[]): BoneMask {
  const inverted = new Set<VRMHumanBoneName>()
  for (const bone of allBones) {
    if (!mask.bones.has(bone)) {
      inverted.add(bone)
    }
  }
  return {
    bones: inverted,
    includeHips: !mask.includeHips,
  }
}

/**
 * Combine two masks (union).
 */
export function combineMasks(a: BoneMask, b: BoneMask): BoneMask {
  return {
    bones: new Set([...a.bones, ...b.bones]),
    includeHips: a.includeHips || b.includeHips,
  }
}
