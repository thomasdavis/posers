import type { Quaternion, Vector3 } from 'three'
import type { VRMHumanBoneName } from './bones'

/**
 * A pose is a snapshot of bone rotations at a moment in time.
 */
export interface Pose {
  /** Map of bone name to quaternion rotation */
  rotations: Map<VRMHumanBoneName, Quaternion>
  /** Optional hip position offset (for locomotion) */
  hipsOffset?: Vector3
}

/**
 * Create an empty pose.
 */
export function createEmptyPose(): Pose {
  return {
    rotations: new Map(),
  }
}

/**
 * Clone a pose (deep copy).
 */
export function clonePose(pose: Pose): Pose {
  const cloned: Pose = {
    rotations: new Map(),
  }

  for (const [bone, quat] of pose.rotations) {
    cloned.rotations.set(bone, quat.clone())
  }

  if (pose.hipsOffset) {
    cloned.hipsOffset = pose.hipsOffset.clone()
  }

  return cloned
}
