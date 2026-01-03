import type { Quaternion, Vector3 } from 'three'

/**
 * Standard VRM humanoid bone names.
 * Follows the VRM 1.0 specification.
 */
export type VRMHumanBoneName =
  // Torso
  | 'hips'
  | 'spine'
  | 'chest'
  | 'upperChest'
  | 'neck'
  | 'head'
  // Left arm
  | 'leftShoulder'
  | 'leftUpperArm'
  | 'leftLowerArm'
  | 'leftHand'
  // Right arm
  | 'rightShoulder'
  | 'rightUpperArm'
  | 'rightLowerArm'
  | 'rightHand'
  // Left leg
  | 'leftUpperLeg'
  | 'leftLowerLeg'
  | 'leftFoot'
  | 'leftToes'
  // Right leg
  | 'rightUpperLeg'
  | 'rightLowerLeg'
  | 'rightFoot'
  | 'rightToes'
  // Fingers (optional)
  | 'leftThumbMetacarpal'
  | 'leftThumbProximal'
  | 'leftThumbDistal'
  | 'leftIndexProximal'
  | 'leftIndexIntermediate'
  | 'leftIndexDistal'
  | 'leftMiddleProximal'
  | 'leftMiddleIntermediate'
  | 'leftMiddleDistal'
  | 'leftRingProximal'
  | 'leftRingIntermediate'
  | 'leftRingDistal'
  | 'leftLittleProximal'
  | 'leftLittleIntermediate'
  | 'leftLittleDistal'
  | 'rightThumbMetacarpal'
  | 'rightThumbProximal'
  | 'rightThumbDistal'
  | 'rightIndexProximal'
  | 'rightIndexIntermediate'
  | 'rightIndexDistal'
  | 'rightMiddleProximal'
  | 'rightMiddleIntermediate'
  | 'rightMiddleDistal'
  | 'rightRingProximal'
  | 'rightRingIntermediate'
  | 'rightRingDistal'
  | 'rightLittleProximal'
  | 'rightLittleIntermediate'
  | 'rightLittleDistal'
  // Eyes (optional)
  | 'leftEye'
  | 'rightEye'
  | 'jaw'

/**
 * Required bones that must be present in a VRM humanoid.
 */
export const REQUIRED_BONES: VRMHumanBoneName[] = [
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'leftUpperArm',
  'leftLowerArm',
  'leftHand',
  'rightUpperArm',
  'rightLowerArm',
  'rightHand',
  'leftUpperLeg',
  'leftLowerLeg',
  'leftFoot',
  'rightUpperLeg',
  'rightLowerLeg',
  'rightFoot',
]

/**
 * A bone transform containing rotation and optional position offset.
 */
export interface BoneTransform {
  rotation: Quaternion
  position?: Vector3
}
