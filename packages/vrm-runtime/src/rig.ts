import { Object3D, Quaternion, Vector3 } from 'three'
import type { VRM } from '@pixiv/three-vrm'
import type { HumanoidRig as IHumanoidRig, VRMHumanBoneName, Pose } from '@posers/core'
import { createEmptyPose, quatIdentity } from '@posers/core'

/**
 * Maximum hip offset in any direction (meters).
 */
const MAX_HIP_OFFSET = 2.0

/**
 * Implementation of HumanoidRig for VRM models.
 */
export class VRMHumanoidRig implements IHumanoidRig {
  private vrm: VRM
  private restPose: Pose
  private tempVector = new Vector3()
  private availableBones: VRMHumanBoneName[] = []

  constructor(vrm: VRM) {
    this.vrm = vrm
    this.restPose = this.captureCurrentPose()
    this.availableBones = this.discoverAvailableBones()
  }

  private discoverAvailableBones(): VRMHumanBoneName[] {
    const bones: VRMHumanBoneName[] = []
    const allBones: VRMHumanBoneName[] = [
      'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
      'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
      'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
      'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
      'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
      'leftEye', 'rightEye', 'jaw',
    ]

    for (const bone of allBones) {
      if (this.getBoneNode(bone)) {
        bones.push(bone)
      }
    }

    return bones
  }

  private captureCurrentPose(): Pose {
    const pose = createEmptyPose()

    for (const boneName of this.availableBones) {
      const node = this.getBoneNode(boneName)
      if (node) {
        pose.rotations.set(boneName, node.quaternion.clone())
      }
    }

    const hips = this.getBoneNode('hips')
    if (hips) {
      pose.hipsOffset = hips.position.clone()
    }

    return pose
  }

  setRotation(bone: VRMHumanBoneName, rotation: Quaternion): void {
    const node = this.getBoneNode(bone)
    if (node) {
      node.quaternion.copy(rotation).normalize()
    }
  }

  addRotation(bone: VRMHumanBoneName, rotation: Quaternion): void {
    const node = this.getBoneNode(bone)
    if (node) {
      node.quaternion.multiply(rotation).normalize()
    }
  }

  setHipsPositionOffset(offset: Vector3): void {
    const hips = this.getBoneNode('hips')
    if (!hips) return

    // Clamp offset to safe range
    const clampedX = Math.max(-MAX_HIP_OFFSET, Math.min(MAX_HIP_OFFSET, offset.x))
    const clampedY = Math.max(-MAX_HIP_OFFSET, Math.min(MAX_HIP_OFFSET, offset.y))
    const clampedZ = Math.max(-MAX_HIP_OFFSET, Math.min(MAX_HIP_OFFSET, offset.z))

    // Apply relative to rest position
    const restOffset = this.restPose.hipsOffset
    if (restOffset) {
      hips.position.set(
        restOffset.x + clampedX,
        restOffset.y + clampedY,
        restOffset.z + clampedZ
      )
    } else {
      hips.position.set(clampedX, clampedY, clampedZ)
    }
  }

  getBoneNode(bone: VRMHumanBoneName): Object3D | null {
    const humanoid = this.vrm.humanoid
    if (!humanoid) return null
    return humanoid.getNormalizedBoneNode(bone) ?? null
  }

  getWorldPosition(bone: VRMHumanBoneName): Vector3 {
    const node = this.getBoneNode(bone)
    if (!node) {
      return new Vector3()
    }
    node.getWorldPosition(this.tempVector)
    return this.tempVector.clone()
  }

  getRotation(bone: VRMHumanBoneName): Quaternion | null {
    const node = this.getBoneNode(bone)
    if (!node) return null
    return node.quaternion.clone()
  }

  getRestPose(): Pose {
    return this.restPose
  }

  applyPose(pose: Pose): void {
    for (const [bone, rotation] of pose.rotations) {
      this.setRotation(bone, rotation)
    }

    if (pose.hipsOffset) {
      this.setHipsPositionOffset(pose.hipsOffset)
    }
  }

  resetToRestPose(): void {
    this.applyPose(this.restPose)
  }

  hasBone(bone: VRMHumanBoneName): boolean {
    return this.getBoneNode(bone) !== null
  }

  getAvailableBones(): VRMHumanBoneName[] {
    return [...this.availableBones]
  }

  /**
   * Get the underlying VRM instance.
   */
  getVRM(): VRM {
    return this.vrm
  }

  /**
   * Update the VRM (call each frame for blend shapes, spring bones, etc.).
   */
  update(deltaTime: number): void {
    this.vrm.update(deltaTime)
  }
}
