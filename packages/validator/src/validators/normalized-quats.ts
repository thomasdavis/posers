import type { Quaternion } from 'three'
import type { HumanoidRig } from '@posers/core'
import { addViolation, type ValidationResult } from '../violations'

/**
 * Tolerance for quaternion normalization check.
 */
const NORMALIZATION_TOLERANCE = 0.01

/**
 * Check if a quaternion is properly normalized.
 */
export function isQuaternionNormalized(q: Quaternion, tolerance = NORMALIZATION_TOLERANCE): boolean {
  const lengthSq = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w
  return Math.abs(lengthSq - 1) <= tolerance
}

/**
 * Validate all bone rotations are properly normalized.
 */
export function validateNormalizedQuaternions(
  rig: HumanoidRig,
  result: ValidationResult,
  time: number,
  tolerance = NORMALIZATION_TOLERANCE
): void {
  const bones = rig.getAvailableBones()

  for (const bone of bones) {
    const rotation = rig.getRotation(bone)
    if (rotation && !isQuaternionNormalized(rotation, tolerance)) {
      const lengthSq = rotation.x ** 2 + rotation.y ** 2 + rotation.z ** 2 + rotation.w ** 2
      addViolation(result, {
        type: 'unnormalized_quaternion',
        severity: 'warning',
        message: `Quaternion not normalized for bone "${bone}" (length² = ${lengthSq.toFixed(4)})`,
        bone,
        time,
        value: { lengthSquared: lengthSq },
      })
    }
  }
}
