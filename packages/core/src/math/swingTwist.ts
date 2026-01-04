/**
 * Swing-Twist Decomposition
 *
 * Decomposes a quaternion rotation into swing and twist components around a specified axis.
 * This is essential for:
 * - Joint angle limits (twist limits separate from swing limits)
 * - Understanding rotation intent (e.g., forearm twist vs elbow bend)
 * - Constraint enforcement
 *
 * The decomposition satisfies: q = swing * twist
 * - twist: rotation around the twist axis
 * - swing: rotation that brings the twist axis to its final direction
 */

import { Quaternion, Vector3 } from 'three'

// Reusable temp objects to avoid allocations
const _v = new Vector3()
const _proj = new Vector3()
const _axis = new Vector3()

export interface SwingTwistResult {
  swing: Quaternion
  twist: Quaternion
  swingAngleRad: number
  twistAngleRad: number
  swingAxis: Vector3  // Unit axis of swing rotation (in local space)
}

/**
 * Decompose a quaternion into swing and twist components around a given axis.
 *
 * @param q - The quaternion to decompose (assumed normalized)
 * @param twistAxisLocal - The twist axis in local space (unit vector)
 * @param out - Output object to store results (reuse for performance)
 * @returns The out object with swing, twist, and angles
 */
export function swingTwistDecompose(
  q: Quaternion,
  twistAxisLocal: Vector3,
  out: SwingTwistResult
): SwingTwistResult {
  // q = (x, y, z, w) where (x, y, z) is the vector part

  // Project the vector part of q onto the twist axis
  _v.set(q.x, q.y, q.z)
  const dot = _v.dot(twistAxisLocal)
  _proj.copy(twistAxisLocal).multiplyScalar(dot)

  // Twist quaternion: vector part is the projection, scalar part is q.w
  out.twist.set(_proj.x, _proj.y, _proj.z, q.w)

  // Normalize twist (it won't be unit length in general)
  const twistLen = out.twist.length()
  if (twistLen > 1e-10) {
    out.twist.normalize()
  } else {
    // Degenerate case: no twist
    out.twist.set(0, 0, 0, 1)
  }

  // Swing = q * inverse(twist)
  out.swing.copy(out.twist).invert()
  out.swing.premultiply(q)
  out.swing.normalize()

  // Extract angles
  // Twist angle: 2 * acos(w) with correct sign
  out.twistAngleRad = 2 * Math.acos(Math.min(1, Math.max(-1, out.twist.w)))
  // Determine sign from the twist axis alignment
  const twistVecDot = _proj.dot(twistAxisLocal)
  if (twistVecDot < 0) {
    out.twistAngleRad = -out.twistAngleRad
  }

  // Swing angle: 2 * acos(w)
  out.swingAngleRad = 2 * Math.acos(Math.min(1, Math.max(-1, out.swing.w)))

  // Swing axis (direction of the swing rotation)
  _axis.set(out.swing.x, out.swing.y, out.swing.z)
  const axisLen = _axis.length()
  if (axisLen > 1e-10) {
    out.swingAxis.copy(_axis).multiplyScalar(1 / axisLen)
  } else {
    // No swing, axis is arbitrary
    out.swingAxis.set(1, 0, 0)
  }

  return out
}

/**
 * Create a reusable SwingTwistResult object.
 */
export function createSwingTwistResult(): SwingTwistResult {
  return {
    swing: new Quaternion(),
    twist: new Quaternion(),
    swingAngleRad: 0,
    twistAngleRad: 0,
    swingAxis: new Vector3(),
  }
}

/**
 * Compute rotation relative to rest pose.
 *
 * qRel = inverse(restLocal) * currentLocal
 *
 * This gives you the rotation that was applied on top of rest pose.
 *
 * @param restLocal - The rest pose local quaternion
 * @param currentLocal - The current local quaternion
 * @param out - Output quaternion (reuse for performance)
 */
export function relativeToRest(
  restLocal: Quaternion,
  currentLocal: Quaternion,
  out: Quaternion
): Quaternion {
  out.copy(restLocal).invert()
  out.multiply(currentLocal)
  out.normalize()
  return out
}

/**
 * Apply a relative rotation to rest pose.
 *
 * result = restLocal * deltaRel
 *
 * @param restLocal - The rest pose local quaternion
 * @param deltaRel - The rotation delta to apply
 * @param out - Output quaternion
 */
export function applyToRest(
  restLocal: Quaternion,
  deltaRel: Quaternion,
  out: Quaternion
): Quaternion {
  out.copy(restLocal).multiply(deltaRel)
  out.normalize()
  return out
}

/**
 * Clamp swing angle while preserving axis.
 *
 * @param swing - The swing quaternion (will be modified)
 * @param maxSwingRad - Maximum swing angle in radians
 * @returns The clamped swing quaternion
 */
export function clampSwing(swing: Quaternion, maxSwingRad: number): Quaternion {
  const angle = 2 * Math.acos(Math.min(1, Math.max(-1, swing.w)))

  if (angle <= maxSwingRad) {
    return swing // No clamping needed
  }

  // Extract axis
  _axis.set(swing.x, swing.y, swing.z)
  const axisLen = _axis.length()
  if (axisLen < 1e-10) {
    return swing // No swing, nothing to clamp
  }
  _axis.multiplyScalar(1 / axisLen)

  // Rebuild quaternion with clamped angle
  const halfAngle = maxSwingRad / 2
  const sinHalf = Math.sin(halfAngle)
  swing.set(
    _axis.x * sinHalf,
    _axis.y * sinHalf,
    _axis.z * sinHalf,
    Math.cos(halfAngle)
  )

  return swing
}

/**
 * Clamp twist angle.
 *
 * @param twist - The twist quaternion (will be modified)
 * @param twistAxis - The twist axis (unit vector)
 * @param minTwistRad - Minimum twist angle in radians
 * @param maxTwistRad - Maximum twist angle in radians
 * @returns The clamped twist quaternion
 */
export function clampTwist(
  twist: Quaternion,
  twistAxis: Vector3,
  minTwistRad: number,
  maxTwistRad: number
): Quaternion {
  // Get current twist angle with sign
  let angle = 2 * Math.acos(Math.min(1, Math.max(-1, twist.w)))
  _v.set(twist.x, twist.y, twist.z)
  if (_v.dot(twistAxis) < 0) {
    angle = -angle
  }

  // Clamp
  const clamped = Math.max(minTwistRad, Math.min(maxTwistRad, angle))

  // Rebuild quaternion
  const halfAngle = clamped / 2
  const sinHalf = Math.sin(halfAngle)
  twist.set(
    twistAxis.x * sinHalf,
    twistAxis.y * sinHalf,
    twistAxis.z * sinHalf,
    Math.cos(halfAngle)
  )

  return twist
}

/**
 * Combine swing and twist back into a single quaternion.
 *
 * q = swing * twist
 *
 * @param swing - The swing quaternion
 * @param twist - The twist quaternion
 * @param out - Output quaternion
 */
export function combineSwingTwist(
  swing: Quaternion,
  twist: Quaternion,
  out: Quaternion
): Quaternion {
  out.copy(swing).multiply(twist)
  out.normalize()
  return out
}

/**
 * Convert radians to degrees.
 */
export function radToDeg(rad: number): number {
  return rad * (180 / Math.PI)
}

/**
 * Convert degrees to radians.
 */
export function degToRad(deg: number): number {
  return deg * (Math.PI / 180)
}
