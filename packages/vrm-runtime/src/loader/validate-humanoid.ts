import type { VRM } from '@pixiv/three-vrm'
import { REQUIRED_BONES, type VRMHumanBoneName } from '@posers/core'

export interface HumanoidValidationResult {
  valid: boolean
  missingBones: VRMHumanBoneName[]
  availableBones: VRMHumanBoneName[]
}

/**
 * Validate that a VRM has the required humanoid bones.
 */
export function validateHumanoid(vrm: VRM): HumanoidValidationResult {
  const humanoid = vrm.humanoid
  const missingBones: VRMHumanBoneName[] = []
  const availableBones: VRMHumanBoneName[] = []

  if (!humanoid) {
    return {
      valid: false,
      missingBones: [...REQUIRED_BONES],
      availableBones: [],
    }
  }

  // Check each required bone
  for (const boneName of REQUIRED_BONES) {
    const node = humanoid.getNormalizedBoneNode(boneName)
    if (node) {
      availableBones.push(boneName)
    } else {
      missingBones.push(boneName)
    }
  }

  // Also collect any optional bones that exist
  const allBoneNames: VRMHumanBoneName[] = [
    ...REQUIRED_BONES,
    'upperChest',
    'leftShoulder',
    'rightShoulder',
    'leftToes',
    'rightToes',
    'leftEye',
    'rightEye',
    'jaw',
    // Fingers...
    'leftThumbMetacarpal',
    'leftThumbProximal',
    'leftThumbDistal',
    'leftIndexProximal',
    'leftIndexIntermediate',
    'leftIndexDistal',
    'leftMiddleProximal',
    'leftMiddleIntermediate',
    'leftMiddleDistal',
    'leftRingProximal',
    'leftRingIntermediate',
    'leftRingDistal',
    'leftLittleProximal',
    'leftLittleIntermediate',
    'leftLittleDistal',
    'rightThumbMetacarpal',
    'rightThumbProximal',
    'rightThumbDistal',
    'rightIndexProximal',
    'rightIndexIntermediate',
    'rightIndexDistal',
    'rightMiddleProximal',
    'rightMiddleIntermediate',
    'rightMiddleDistal',
    'rightRingProximal',
    'rightRingIntermediate',
    'rightRingDistal',
    'rightLittleProximal',
    'rightLittleIntermediate',
    'rightLittleDistal',
  ]

  for (const boneName of allBoneNames) {
    if (!availableBones.includes(boneName)) {
      const node = humanoid.getNormalizedBoneNode(boneName)
      if (node) {
        availableBones.push(boneName)
      }
    }
  }

  return {
    valid: missingBones.length === 0,
    missingBones,
    availableBones,
  }
}
