/**
 * Arm IK Solver
 *
 * FABRIK-based IK solver specialized for arm chains (shoulder → elbow → wrist → hand).
 * Includes pole vector support for controlling elbow direction.
 *
 * Key features:
 * - FABRIK algorithm for position solving
 * - Pole vector to control elbow direction
 * - Returns relative rotations (compatible with setRotationRel)
 * - Joint constraint awareness
 */

import { Vector3, Quaternion, Object3D } from 'three'
import type { VRMHumanBoneName } from '@posers/core'

// Reusable temp objects
const _v1 = new Vector3()
const _v2 = new Vector3()
const _v3 = new Vector3()
const _axis = new Vector3()
const _proj1 = new Vector3()
const _proj2 = new Vector3()
const _cross = new Vector3()
const _quat = new Quaternion()

/**
 * Result of IK solving.
 */
export interface ArmIKResult {
  /** Whether the target was reached within tolerance */
  reached: boolean

  /** Final distance from end effector to target */
  endEffectorError: number

  /** Relative rotations to apply (bone → deltaRel from rest) */
  rotations: Map<VRMHumanBoneName, Quaternion>

  /** Solved joint positions in world space */
  positions: {
    shoulder: Vector3
    elbow: Vector3
    wrist: Vector3
    hand: Vector3
  }
}

/**
 * Options for arm IK.
 */
export interface ArmIKOptions {
  /** Maximum iterations for FABRIK */
  iterations?: number

  /** Tolerance for convergence (meters) */
  tolerance?: number

  /** Pole vector in world space (controls elbow direction) */
  poleVector?: Vector3

  /** Apply elbow hinge constraint */
  constrainElbow?: boolean
}

/**
 * Arm chain definition (bone names and rest data).
 */
export interface ArmChainDef {
  side: 'left' | 'right'
  shoulder: VRMHumanBoneName
  upperArm: VRMHumanBoneName
  lowerArm: VRMHumanBoneName
  hand: VRMHumanBoneName
}

/**
 * Get arm chain definition for a side.
 */
export function getArmChain(side: 'left' | 'right'): ArmChainDef {
  if (side === 'left') {
    return {
      side: 'left',
      shoulder: 'leftShoulder',
      upperArm: 'leftUpperArm',
      lowerArm: 'leftLowerArm',
      hand: 'leftHand',
    }
  } else {
    return {
      side: 'right',
      shoulder: 'rightShoulder',
      upperArm: 'rightUpperArm',
      lowerArm: 'rightLowerArm',
      hand: 'rightHand',
    }
  }
}

/**
 * FABRIK solver for a 3-joint chain (4 points: shoulder, elbow, wrist, hand).
 *
 * @param p0 Shoulder position (fixed)
 * @param p1 Elbow position (will be modified)
 * @param p2 Wrist position (will be modified)
 * @param p3 Hand/end effector position (will be modified)
 * @param target Target position for hand
 * @param lengths Bone lengths
 * @param iterations Max iterations
 * @param tolerance Convergence tolerance
 * @returns Whether target was reached
 */
export function fabrik3(
  p0: Vector3,
  p1: Vector3,
  p2: Vector3,
  p3: Vector3,
  target: Vector3,
  lengths: { l01: number; l12: number; l23: number },
  iterations: number,
  tolerance: number
): boolean {
  const base = p0.clone()
  let reached = false

  for (let i = 0; i < iterations; i++) {
    // Forward reaching (from target back to root)
    p3.copy(target)

    // p2 = move toward p3 by l23
    _v1.subVectors(p2, p3)
    if (_v1.lengthSq() > 1e-10) {
      _v1.normalize()
      p2.copy(p3).addScaledVector(_v1, lengths.l23)
    }

    // p1 = move toward p2 by l12
    _v1.subVectors(p1, p2)
    if (_v1.lengthSq() > 1e-10) {
      _v1.normalize()
      p1.copy(p2).addScaledVector(_v1, lengths.l12)
    }

    // p0 = move toward p1 by l01
    _v1.subVectors(p0, p1)
    if (_v1.lengthSq() > 1e-10) {
      _v1.normalize()
      p0.copy(p1).addScaledVector(_v1, lengths.l01)
    }

    // Backward reaching (from root to target)
    p0.copy(base)

    // p1 = move toward p0 by -l01 direction
    _v1.subVectors(p1, p0)
    if (_v1.lengthSq() > 1e-10) {
      _v1.normalize()
      p1.copy(p0).addScaledVector(_v1, lengths.l01)
    }

    // p2 = move toward p1 by -l12 direction
    _v1.subVectors(p2, p1)
    if (_v1.lengthSq() > 1e-10) {
      _v1.normalize()
      p2.copy(p1).addScaledVector(_v1, lengths.l12)
    }

    // p3 = move toward p2 by -l23 direction
    _v1.subVectors(p3, p2)
    if (_v1.lengthSq() > 1e-10) {
      _v1.normalize()
      p3.copy(p2).addScaledVector(_v1, lengths.l23)
    }

    // Check convergence
    const error = _v2.subVectors(p3, target).length()
    if (error <= tolerance) {
      reached = true
      break
    }
  }

  return reached
}

/**
 * Apply pole vector constraint to rotate elbow around shoulder→hand axis.
 *
 * @param shoulder Shoulder position (fixed)
 * @param elbow Elbow position (will be modified)
 * @param hand Hand position (fixed for this operation)
 * @param poleWorld Pole vector position in world space
 */
export function applyPoleVector(
  shoulder: Vector3,
  elbow: Vector3,
  hand: Vector3,
  poleWorld: Vector3
): void {
  // Axis: shoulder → hand (normalized)
  _axis.subVectors(hand, shoulder)
  const axisLen = _axis.length()
  if (axisLen < 1e-6) return
  _axis.divideScalar(axisLen)

  // Vector from shoulder to elbow
  _v1.subVectors(elbow, shoulder)

  // Vector from shoulder to pole
  _v2.subVectors(poleWorld, shoulder)

  // Project both onto plane perpendicular to axis
  const elbowDot = _v1.dot(_axis)
  _proj1.copy(_v1).addScaledVector(_axis, -elbowDot)

  const poleDot = _v2.dot(_axis)
  _proj2.copy(_v2).addScaledVector(_axis, -poleDot)

  // Normalize projections
  const proj1Len = _proj1.length()
  const proj2Len = _proj2.length()
  if (proj1Len < 1e-6 || proj2Len < 1e-6) return

  _proj1.divideScalar(proj1Len)
  _proj2.divideScalar(proj2Len)

  // Calculate angle between projections (with sign)
  _cross.crossVectors(_proj1, _proj2)
  const sign = Math.sign(_cross.dot(_axis))
  const dot = Math.max(-1, Math.min(1, _proj1.dot(_proj2)))
  const angle = Math.acos(dot) * sign

  // Rotate elbow around axis by this angle
  // Using Rodrigues' rotation formula
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  // v_rot = v*cos + (axis × v)*sin + axis*(axis·v)*(1-cos)
  const axisDotV = _axis.dot(_v1)
  _cross.crossVectors(_axis, _v1)

  _v3.copy(_v1).multiplyScalar(cos)
    .addScaledVector(_cross, sin)
    .addScaledVector(_axis, axisDotV * (1 - cos))

  elbow.copy(shoulder).add(_v3)
}

/**
 * Compute rotation to align one direction to another.
 */
export function quatFromUnitVectors(from: Vector3, to: Vector3, out: Quaternion): Quaternion {
  out.setFromUnitVectors(from, to)
  return out
}

/**
 * Convert world-space delta rotation to local-space delta rotation.
 *
 * @param parentWorldQuat Parent's world quaternion
 * @param worldDelta Delta rotation in world space
 * @param out Output quaternion
 */
export function worldDeltaToLocal(
  parentWorldQuat: Quaternion,
  worldDelta: Quaternion,
  out: Quaternion
): Quaternion {
  // localDelta = inv(parentWorld) * worldDelta * parentWorld
  out.copy(parentWorldQuat).invert()
  out.multiply(worldDelta)
  out.multiply(parentWorldQuat)
  out.normalize()
  return out
}

/**
 * Solve arm IK given current bone positions and a target.
 *
 * This is a high-level solver that:
 * 1. Gets current bone world positions
 * 2. Runs FABRIK to solve new positions
 * 3. Applies pole vector constraint
 * 4. Converts solved positions back to bone rotations
 *
 * @param getBoneWorldPos Function to get bone world position
 * @param getBoneWorldQuat Function to get bone world quaternion
 * @param getRestDirWorld Function to get bone's rest direction in world space
 * @param chain Arm chain definition
 * @param target Target position for hand in world space
 * @param options Solver options
 * @returns IK result with rotations to apply
 */
export function solveArmIK(
  getBoneWorldPos: (bone: VRMHumanBoneName) => Vector3,
  getBoneWorldQuat: (bone: VRMHumanBoneName) => Quaternion,
  getRestDirWorld: (bone: VRMHumanBoneName) => Vector3 | null,
  getParentWorldQuat: (bone: VRMHumanBoneName) => Quaternion | null,
  chain: ArmChainDef,
  target: Vector3,
  options: ArmIKOptions = {}
): ArmIKResult {
  const {
    iterations = 10,
    tolerance = 0.01,
    poleVector,
  } = options

  // Get current positions
  const shoulder = getBoneWorldPos(chain.upperArm).clone()
  const elbow = getBoneWorldPos(chain.lowerArm).clone()
  const wrist = getBoneWorldPos(chain.hand).clone()

  // Estimate hand end position (wrist + small offset in hand direction)
  const handDir = getRestDirWorld(chain.hand)
  const hand = wrist.clone()
  if (handDir) {
    hand.addScaledVector(handDir, 0.05) // ~5cm hand length
  }

  // Compute bone lengths
  const lengths = {
    l01: shoulder.distanceTo(elbow),
    l12: elbow.distanceTo(wrist),
    l23: wrist.distanceTo(hand),
  }

  // Run FABRIK
  const reached = fabrik3(
    shoulder,
    elbow,
    wrist,
    hand,
    target,
    lengths,
    iterations,
    tolerance
  )

  // Apply pole vector if provided
  if (poleVector) {
    applyPoleVector(shoulder, elbow, hand, poleVector)
    // Re-solve wrist after elbow adjustment
    _v1.subVectors(wrist, elbow).normalize()
    wrist.copy(elbow).addScaledVector(_v1, lengths.l12)
  }

  const endEffectorError = hand.distanceTo(target)

  // Convert solved positions to rotations
  const rotations = new Map<VRMHumanBoneName, Quaternion>()

  // For each bone, compute the rotation needed to point toward the next joint
  // This is done by comparing rest direction to desired direction

  // Upper arm: shoulder → elbow
  {
    const restDir = getRestDirWorld(chain.upperArm)
    if (restDir) {
      const desiredDir = _v1.subVectors(elbow, shoulder).normalize()
      const deltaWorld = new Quaternion()
      quatFromUnitVectors(restDir.normalize(), desiredDir, deltaWorld)

      // Convert to local space
      const parentQuat = getParentWorldQuat(chain.upperArm)
      if (parentQuat) {
        const localDelta = new Quaternion()
        worldDeltaToLocal(parentQuat, deltaWorld, localDelta)
        rotations.set(chain.upperArm, localDelta)
      }
    }
  }

  // Lower arm: elbow → wrist
  {
    const restDir = getRestDirWorld(chain.lowerArm)
    if (restDir) {
      const desiredDir = _v1.subVectors(wrist, elbow).normalize()
      const deltaWorld = new Quaternion()
      quatFromUnitVectors(restDir.normalize(), desiredDir, deltaWorld)

      const parentQuat = getParentWorldQuat(chain.lowerArm)
      if (parentQuat) {
        const localDelta = new Quaternion()
        worldDeltaToLocal(parentQuat, deltaWorld, localDelta)
        rotations.set(chain.lowerArm, localDelta)
      }
    }
  }

  // Hand: wrist → hand tip (optional, for wrist orientation)
  {
    const restDir = getRestDirWorld(chain.hand)
    if (restDir) {
      const desiredDir = _v1.subVectors(hand, wrist).normalize()
      const deltaWorld = new Quaternion()
      quatFromUnitVectors(restDir.normalize(), desiredDir, deltaWorld)

      const parentQuat = getParentWorldQuat(chain.hand)
      if (parentQuat) {
        const localDelta = new Quaternion()
        worldDeltaToLocal(parentQuat, deltaWorld, localDelta)
        rotations.set(chain.hand, localDelta)
      }
    }
  }

  return {
    reached,
    endEffectorError,
    rotations,
    positions: {
      shoulder: shoulder.clone(),
      elbow: elbow.clone(),
      wrist: wrist.clone(),
      hand: hand.clone(),
    },
  }
}
