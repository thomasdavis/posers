import { Euler, Quaternion } from 'three'
import type { HumanoidRig, VRMHumanBoneName } from '@posers/core'
import { addViolation, type ValidationResult } from '../violations'

/**
 * Joint limits in radians (min, max) for each axis.
 */
export interface JointLimits {
  x?: [number, number]
  y?: [number, number]
  z?: [number, number]
}

/**
 * Default joint limits for humanoid bones.
 * These are approximate and can be customized.
 */
export const DEFAULT_JOINT_LIMITS: Partial<Record<VRMHumanBoneName, JointLimits>> = {
  // Spine
  spine: {
    x: [-0.5, 0.5],  // ~30 degrees
    y: [-0.5, 0.5],
    z: [-0.3, 0.3],
  },
  chest: {
    x: [-0.4, 0.4],
    y: [-0.4, 0.4],
    z: [-0.2, 0.2],
  },
  neck: {
    x: [-0.7, 0.7],  // ~40 degrees
    y: [-1.2, 1.2],  // ~70 degrees
    z: [-0.5, 0.5],
  },
  head: {
    x: [-0.5, 0.5],
    y: [-1.0, 1.0],
    z: [-0.4, 0.4],
  },

  // Arms
  leftUpperArm: {
    x: [-Math.PI, Math.PI],
    y: [-Math.PI * 0.5, Math.PI * 0.5],
    z: [-Math.PI * 0.75, 0.3],
  },
  rightUpperArm: {
    x: [-Math.PI, Math.PI],
    y: [-Math.PI * 0.5, Math.PI * 0.5],
    z: [-0.3, Math.PI * 0.75],
  },
  leftLowerArm: {
    x: [0, 2.5],  // Elbow only bends one way
    y: [-0.1, 0.1],
    z: [-0.1, 0.1],
  },
  rightLowerArm: {
    x: [0, 2.5],
    y: [-0.1, 0.1],
    z: [-0.1, 0.1],
  },

  // Legs
  leftUpperLeg: {
    x: [-2.0, 1.5],
    y: [-0.8, 0.3],
    z: [-0.5, 0.8],
  },
  rightUpperLeg: {
    x: [-2.0, 1.5],
    y: [-0.3, 0.8],
    z: [-0.8, 0.5],
  },
  leftLowerLeg: {
    x: [-2.5, 0],  // Knee only bends backward
    y: [-0.1, 0.1],
    z: [-0.1, 0.1],
  },
  rightLowerLeg: {
    x: [-2.5, 0],
    y: [-0.1, 0.1],
    z: [-0.1, 0.1],
  },
  leftFoot: {
    x: [-0.8, 0.8],
    y: [-0.5, 0.5],
    z: [-0.3, 0.3],
  },
  rightFoot: {
    x: [-0.8, 0.8],
    y: [-0.5, 0.5],
    z: [-0.3, 0.3],
  },
}

/**
 * Convert quaternion to Euler angles.
 */
function quaternionToEuler(q: Quaternion): Euler {
  return new Euler().setFromQuaternion(q, 'XYZ')
}

/**
 * Check if a value is within limits.
 */
function isWithinLimits(value: number, limits: [number, number]): boolean {
  return value >= limits[0] && value <= limits[1]
}

/**
 * Validate joint limits for all bones.
 */
export function validateJointLimits(
  rig: HumanoidRig,
  result: ValidationResult,
  time: number,
  customLimits: Partial<Record<VRMHumanBoneName, JointLimits>> = {}
): void {
  const limits = { ...DEFAULT_JOINT_LIMITS, ...customLimits }
  const bones = rig.getAvailableBones()

  for (const bone of bones) {
    const boneLimits = limits[bone]
    if (!boneLimits) continue

    const rotation = rig.getRotation(bone)
    if (!rotation) continue

    const euler = quaternionToEuler(rotation)

    if (boneLimits.x && !isWithinLimits(euler.x, boneLimits.x)) {
      addViolation(result, {
        type: 'joint_limit_exceeded',
        severity: 'warning',
        message: `Joint limit exceeded for "${bone}" on X axis: ${euler.x.toFixed(2)} rad (limit: ${boneLimits.x[0].toFixed(2)} to ${boneLimits.x[1].toFixed(2)})`,
        bone,
        time,
        value: { axis: 'x', value: euler.x, limits: boneLimits.x },
      })
    }

    if (boneLimits.y && !isWithinLimits(euler.y, boneLimits.y)) {
      addViolation(result, {
        type: 'joint_limit_exceeded',
        severity: 'warning',
        message: `Joint limit exceeded for "${bone}" on Y axis: ${euler.y.toFixed(2)} rad`,
        bone,
        time,
        value: { axis: 'y', value: euler.y, limits: boneLimits.y },
      })
    }

    if (boneLimits.z && !isWithinLimits(euler.z, boneLimits.z)) {
      addViolation(result, {
        type: 'joint_limit_exceeded',
        severity: 'warning',
        message: `Joint limit exceeded for "${bone}" on Z axis: ${euler.z.toFixed(2)} rad`,
        bone,
        time,
        value: { axis: 'z', value: euler.z, limits: boneLimits.z },
      })
    }
  }
}
