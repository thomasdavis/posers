import type { Object3D, Quaternion, Vector3 } from 'three'
import type { VRMHumanBoneName } from './bones'
import type { Pose } from './pose'

/**
 * Safe interface for manipulating a VRM humanoid rig.
 * All methods are designed to be safe and bounded.
 */
export interface HumanoidRig {
  /**
   * Set the absolute rotation of a bone.
   */
  setRotation(bone: VRMHumanBoneName, rotation: Quaternion): void

  /**
   * Add a rotation to the current bone rotation (multiplicative).
   */
  addRotation(bone: VRMHumanBoneName, rotation: Quaternion): void

  /**
   * Set the hip position offset (for locomotion).
   * Offset is clamped to a safe range.
   */
  setHipsPositionOffset(offset: Vector3): void

  /**
   * Get the Three.js Object3D node for a bone (read-only access).
   * Returns null if bone doesn't exist.
   */
  getBoneNode(bone: VRMHumanBoneName): Object3D | null

  /**
   * Get the world-space position of a bone.
   */
  getWorldPosition(bone: VRMHumanBoneName): Vector3

  /**
   * Get the current local rotation of a bone.
   */
  getRotation(bone: VRMHumanBoneName): Quaternion | null

  /**
   * Get the rest pose (T-pose) of the rig.
   */
  getRestPose(): Pose

  /**
   * Apply a complete pose to the rig.
   */
  applyPose(pose: Pose): void

  /**
   * Reset the rig to its rest pose.
   */
  resetToRestPose(): void

  /**
   * Check if a bone exists in the rig.
   */
  hasBone(bone: VRMHumanBoneName): boolean

  /**
   * Get all available bone names in this rig.
   */
  getAvailableBones(): VRMHumanBoneName[]
}
