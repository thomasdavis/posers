import type { Quaternion, Vector3 } from 'three'
import type { HumanoidRig, VRMHumanBoneName } from '@posers/core'
import { addViolation, type ValidationResult } from '../violations'

/**
 * Check if a quaternion contains NaN or Infinity.
 */
export function isQuaternionValid(q: Quaternion): boolean {
  return (
    isFinite(q.x) && !isNaN(q.x) &&
    isFinite(q.y) && !isNaN(q.y) &&
    isFinite(q.z) && !isNaN(q.z) &&
    isFinite(q.w) && !isNaN(q.w)
  )
}

/**
 * Check if a vector contains NaN or Infinity.
 */
export function isVectorValid(v: Vector3): boolean {
  return (
    isFinite(v.x) && !isNaN(v.x) &&
    isFinite(v.y) && !isNaN(v.y) &&
    isFinite(v.z) && !isNaN(v.z)
  )
}

/**
 * Validate all bone rotations for NaN/Infinity.
 */
export function validateNaN(
  rig: HumanoidRig,
  result: ValidationResult,
  time: number
): void {
  const bones = rig.getAvailableBones()

  for (const bone of bones) {
    const rotation = rig.getRotation(bone)
    if (rotation && !isQuaternionValid(rotation)) {
      addViolation(result, {
        type: 'nan_rotation',
        severity: 'error',
        message: `NaN or Infinity in rotation for bone "${bone}"`,
        bone,
        time,
        value: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
      })
    }
  }

  // Check hip position if it exists
  const hipsNode = rig.getBoneNode('hips')
  if (hipsNode && !isVectorValid(hipsNode.position)) {
    addViolation(result, {
      type: 'nan_position',
      severity: 'error',
      message: 'NaN or Infinity in hips position',
      bone: 'hips',
      time,
      value: { x: hipsNode.position.x, y: hipsNode.position.y, z: hipsNode.position.z },
    })
  }
}
