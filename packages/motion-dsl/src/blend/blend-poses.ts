import { Quaternion, Vector3 } from 'three'
import type { Pose, VRMHumanBoneName } from '@posers/core'
import { createEmptyPose } from '@posers/core'

/**
 * Blend two poses together.
 * @param a - First pose
 * @param b - Second pose
 * @param weight - Blend weight (0 = all A, 1 = all B)
 * @returns Blended pose
 */
export function blendPoses(a: Pose, b: Pose, weight: number): Pose {
  const result = createEmptyPose()
  const clampedWeight = Math.max(0, Math.min(1, weight))

  // Collect all unique bone names
  const allBones = new Set<VRMHumanBoneName>([
    ...a.rotations.keys(),
    ...b.rotations.keys(),
  ])

  // Blend each bone
  for (const bone of allBones) {
    const rotA = a.rotations.get(bone)
    const rotB = b.rotations.get(bone)

    if (rotA && rotB) {
      // Both have this bone - slerp between them
      const blended = new Quaternion().slerpQuaternions(rotA, rotB, clampedWeight)
      result.rotations.set(bone, blended)
    } else if (rotA) {
      // Only A has this bone
      result.rotations.set(bone, rotA.clone())
    } else if (rotB) {
      // Only B has this bone
      result.rotations.set(bone, rotB.clone())
    }
  }

  // Blend hip offset
  if (a.hipsOffset && b.hipsOffset) {
    result.hipsOffset = new Vector3().lerpVectors(a.hipsOffset, b.hipsOffset, clampedWeight)
  } else if (a.hipsOffset) {
    result.hipsOffset = a.hipsOffset.clone()
  } else if (b.hipsOffset) {
    result.hipsOffset = b.hipsOffset.clone()
  }

  return result
}

/**
 * Blend a pose with identity (rest pose) by a weight.
 * Useful for fading in/out a motion.
 * @param pose - The pose to blend
 * @param weight - How much of the pose to apply (0 = identity, 1 = full pose)
 */
export function blendToIdentity(pose: Pose, weight: number): Pose {
  const result = createEmptyPose()
  const clampedWeight = Math.max(0, Math.min(1, weight))
  const identity = new Quaternion(0, 0, 0, 1)

  for (const [bone, rotation] of pose.rotations) {
    const blended = new Quaternion().slerpQuaternions(identity, rotation, clampedWeight)
    result.rotations.set(bone, blended)
  }

  if (pose.hipsOffset) {
    result.hipsOffset = pose.hipsOffset.clone().multiplyScalar(clampedWeight)
  }

  return result
}
