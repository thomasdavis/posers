import { Quaternion, Vector3 } from 'three'
import type { Pose, VRMHumanBoneName } from '@posers/core'
import { createEmptyPose } from '@posers/core'

/**
 * Apply an additive pose on top of a base pose.
 * The additive pose represents deltas from identity.
 * @param base - The base pose
 * @param additive - The additive pose (rotations are deltas)
 * @param weight - How much of the additive to apply (0-1)
 * @returns Combined pose
 */
export function applyAdditivePose(base: Pose, additive: Pose, weight = 1): Pose {
  const result = createEmptyPose()
  const clampedWeight = Math.max(0, Math.min(1, weight))
  const identity = new Quaternion(0, 0, 0, 1)

  // Copy all base rotations
  for (const [bone, rotation] of base.rotations) {
    result.rotations.set(bone, rotation.clone())
  }

  // Apply additive rotations
  for (const [bone, deltaRotation] of additive.rotations) {
    // Scale the delta rotation by weight (slerp from identity)
    const scaledDelta = new Quaternion().slerpQuaternions(identity, deltaRotation, clampedWeight)

    const existing = result.rotations.get(bone)
    if (existing) {
      // Multiply: base * delta
      existing.multiply(scaledDelta).normalize()
    } else {
      result.rotations.set(bone, scaledDelta)
    }
  }

  // Handle hip offset
  if (base.hipsOffset) {
    result.hipsOffset = base.hipsOffset.clone()
  }

  if (additive.hipsOffset) {
    const scaledOffset = additive.hipsOffset.clone().multiplyScalar(clampedWeight)
    if (result.hipsOffset) {
      result.hipsOffset.add(scaledOffset)
    } else {
      result.hipsOffset = scaledOffset
    }
  }

  return result
}

/**
 * Create an additive pose from two poses (target - reference).
 * @param reference - The reference pose (usually rest pose)
 * @param target - The target pose
 * @returns Additive pose representing the difference
 */
export function createAdditivePose(reference: Pose, target: Pose): Pose {
  const result = createEmptyPose()

  for (const [bone, targetRot] of target.rotations) {
    const refRot = reference.rotations.get(bone)
    if (refRot) {
      // Delta = inverse(reference) * target
      const delta = refRot.clone().invert().multiply(targetRot)
      result.rotations.set(bone, delta)
    } else {
      result.rotations.set(bone, targetRot.clone())
    }
  }

  if (target.hipsOffset) {
    const refOffset = reference.hipsOffset ?? new Vector3()
    result.hipsOffset = target.hipsOffset.clone().sub(refOffset)
  }

  return result
}
