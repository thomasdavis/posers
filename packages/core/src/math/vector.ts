import { Vector3 } from 'three'

/**
 * Create a Vector3 from components.
 */
export function vec3(x: number, y: number, z: number): Vector3 {
  return new Vector3(x, y, z)
}

/**
 * Linear interpolation between two vectors.
 */
export function vec3Lerp(a: Vector3, b: Vector3, t: number): Vector3 {
  return a.clone().lerp(b, t)
}

/**
 * Add two vectors.
 */
export function vec3Add(a: Vector3, b: Vector3): Vector3 {
  return a.clone().add(b)
}

/**
 * Subtract two vectors (a - b).
 */
export function vec3Sub(a: Vector3, b: Vector3): Vector3 {
  return a.clone().sub(b)
}

/**
 * Scale a vector by a scalar.
 */
export function vec3Scale(v: Vector3, s: number): Vector3 {
  return v.clone().multiplyScalar(s)
}

/**
 * Normalize a vector.
 */
export function vec3Normalize(v: Vector3): Vector3 {
  return v.clone().normalize()
}

/**
 * Get the length/magnitude of a vector.
 */
export function vec3Length(v: Vector3): number {
  return v.length()
}

/**
 * Dot product of two vectors.
 */
export function vec3Dot(a: Vector3, b: Vector3): number {
  return a.dot(b)
}

/**
 * Cross product of two vectors.
 */
export function vec3Cross(a: Vector3, b: Vector3): Vector3 {
  return a.clone().cross(b)
}

/**
 * Check if a vector is valid (no NaN or Infinity).
 */
export function vec3IsValid(v: Vector3): boolean {
  return (
    isFinite(v.x) && !isNaN(v.x) &&
    isFinite(v.y) && !isNaN(v.y) &&
    isFinite(v.z) && !isNaN(v.z)
  )
}

/**
 * Zero vector.
 */
export function vec3Zero(): Vector3 {
  return new Vector3(0, 0, 0)
}

/**
 * Unit vectors.
 */
export const VEC3_UP = new Vector3(0, 1, 0)
export const VEC3_DOWN = new Vector3(0, -1, 0)
export const VEC3_FORWARD = new Vector3(0, 0, 1)
export const VEC3_BACK = new Vector3(0, 0, -1)
export const VEC3_LEFT = new Vector3(-1, 0, 0)
export const VEC3_RIGHT = new Vector3(1, 0, 0)
