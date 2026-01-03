import { Euler, Quaternion } from 'three'

/**
 * Create a quaternion from Euler angles (in radians).
 */
export function quatFromEuler(x: number, y: number, z: number, order: 'XYZ' | 'YXZ' | 'ZXY' | 'ZYX' | 'YZX' | 'XZY' = 'XYZ'): Quaternion {
  const euler = new Euler(x, y, z, order)
  return new Quaternion().setFromEuler(euler)
}

/**
 * Create a quaternion from axis-angle representation.
 */
export function quatFromAxisAngle(axis: { x: number; y: number; z: number }, angle: number): Quaternion {
  const q = new Quaternion()
  const halfAngle = angle / 2
  const s = Math.sin(halfAngle)
  q.set(axis.x * s, axis.y * s, axis.z * s, Math.cos(halfAngle))
  return q.normalize()
}

/**
 * Spherical linear interpolation between two quaternions.
 */
export function quatSlerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
  const result = new Quaternion()
  return result.slerpQuaternions(a, b, t)
}

/**
 * Ensure a quaternion is normalized.
 */
export function quatNormalize(q: Quaternion): Quaternion {
  return q.clone().normalize()
}

/**
 * Check if a quaternion is valid (no NaN, properly normalized).
 */
export function quatIsValid(q: Quaternion): boolean {
  if (isNaN(q.x) || isNaN(q.y) || isNaN(q.z) || isNaN(q.w)) {
    return false
  }
  const lengthSq = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w
  return Math.abs(lengthSq - 1) < 0.001
}

/**
 * Identity quaternion (no rotation).
 */
export function quatIdentity(): Quaternion {
  return new Quaternion(0, 0, 0, 1)
}

/**
 * Multiply two quaternions.
 */
export function quatMultiply(a: Quaternion, b: Quaternion): Quaternion {
  return a.clone().multiply(b)
}

/**
 * Get the inverse of a quaternion.
 */
export function quatInverse(q: Quaternion): Quaternion {
  return q.clone().invert()
}
