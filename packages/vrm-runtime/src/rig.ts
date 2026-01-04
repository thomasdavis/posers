import { Object3D, Quaternion, Vector3 } from 'three'
import type { VRM } from '@pixiv/three-vrm'
import type { HumanoidRig as IHumanoidRig, VRMHumanBoneName, Pose } from '@posers/core'
import { createEmptyPose } from '@posers/core'

/**
 * Maximum hip offset in any direction (meters).
 */
const MAX_HIP_OFFSET = 2.0

/**
 * All standard VRM humanoid bone names.
 */
const ALL_HUMANOID_BONES: VRMHumanBoneName[] = [
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
  'leftEye', 'rightEye', 'jaw',
  // Finger bones
  'leftThumbMetacarpal', 'leftThumbProximal', 'leftThumbDistal',
  'leftIndexProximal', 'leftIndexIntermediate', 'leftIndexDistal',
  'leftMiddleProximal', 'leftMiddleIntermediate', 'leftMiddleDistal',
  'leftRingProximal', 'leftRingIntermediate', 'leftRingDistal',
  'leftLittleProximal', 'leftLittleIntermediate', 'leftLittleDistal',
  'rightThumbMetacarpal', 'rightThumbProximal', 'rightThumbDistal',
  'rightIndexProximal', 'rightIndexIntermediate', 'rightIndexDistal',
  'rightMiddleProximal', 'rightMiddleIntermediate', 'rightMiddleDistal',
  'rightRingProximal', 'rightRingIntermediate', 'rightRingDistal',
  'rightLittleProximal', 'rightLittleIntermediate', 'rightLittleDistal',
]

/**
 * Implementation of HumanoidRig for VRM models.
 *
 * Uses normalized bone nodes from three-vrm, which provide a consistent
 * interface across different VRM models regardless of bone roll/orientation.
 *
 * Key concepts:
 * - restLocal: The bone's local quaternion in T-pose (captured at load time)
 * - setRotationRel: Apply rotation as a delta from rest pose (recommended)
 * - setRotation: Set absolute local rotation (use with care)
 */
export class VRMHumanoidRig implements IHumanoidRig {
  private vrm: VRM
  private restPose: Pose

  // Cached node references for fast access
  private nodes = new Map<VRMHumanBoneName, Object3D>()

  // Rest pose local quaternions per bone (captured from normalized bones at load)
  private restLocal = new Map<VRMHumanBoneName, Quaternion>()

  // Reusable temp objects to avoid allocations
  private _tempVector = new Vector3()
  private _tempQuat = new Quaternion()
  private _tempWorldQuat = new Quaternion()

  private availableBones: VRMHumanBoneName[] = []

  constructor(vrm: VRM) {
    this.vrm = vrm

    // Cache all bone nodes and their rest quaternions
    this.cacheBonesAndRestPose()

    // Capture full rest pose for compatibility
    this.restPose = this.captureCurrentPose()
  }

  /**
   * Cache bone nodes and capture rest local quaternions.
   * This should be called immediately after VRM load, before any animation.
   */
  private cacheBonesAndRestPose(): void {
    const humanoid = this.vrm.humanoid
    if (!humanoid) return

    for (const bone of ALL_HUMANOID_BONES) {
      const node = humanoid.getNormalizedBoneNode(bone)
      if (node) {
        this.nodes.set(bone, node)
        this.restLocal.set(bone, node.quaternion.clone())
        this.availableBones.push(bone)
      }
    }
  }

  private captureCurrentPose(): Pose {
    const pose = createEmptyPose()

    for (const boneName of this.availableBones) {
      const node = this.nodes.get(boneName)
      if (node) {
        pose.rotations.set(boneName, node.quaternion.clone())
      }
    }

    const hips = this.nodes.get('hips')
    if (hips) {
      pose.hipsOffset = hips.position.clone()
    }

    return pose
  }

  // ============================================================================
  // ROTATION METHODS
  // ============================================================================

  /**
   * Set rotation as a delta relative to rest pose.
   * This is the RECOMMENDED way to set bone rotations.
   *
   * finalRotation = restLocal * deltaRel
   *
   * @param bone - The bone to rotate
   * @param deltaRel - Rotation delta from rest pose
   */
  setRotationRel(bone: VRMHumanBoneName, deltaRel: Quaternion): void {
    const node = this.nodes.get(bone)
    const rest = this.restLocal.get(bone)
    if (!node || !rest) return

    // Apply: rest * delta
    node.quaternion.copy(rest).multiply(deltaRel).normalize()
  }

  /**
   * Set absolute local rotation (replaces the bone's rotation entirely).
   * Use setRotationRel instead when possible for consistency.
   *
   * @param bone - The bone to rotate
   * @param rotation - Absolute local rotation
   */
  setRotation(bone: VRMHumanBoneName, rotation: Quaternion): void {
    const node = this.nodes.get(bone)
    if (node) {
      node.quaternion.copy(rotation).normalize()
    }
  }

  /**
   * Add rotation on top of current rotation (multiplicative).
   *
   * @param bone - The bone to rotate
   * @param rotation - Rotation to multiply with current
   */
  addRotation(bone: VRMHumanBoneName, rotation: Quaternion): void {
    const node = this.nodes.get(bone)
    if (node) {
      node.quaternion.multiply(rotation).normalize()
    }
  }

  /**
   * Get the current rotation relative to rest pose.
   *
   * deltaRel = inverse(restLocal) * currentLocal
   */
  getRotationRel(bone: VRMHumanBoneName): Quaternion | null {
    const node = this.nodes.get(bone)
    const rest = this.restLocal.get(bone)
    if (!node || !rest) return null

    // deltaRel = inv(rest) * current
    this._tempQuat.copy(rest).invert()
    this._tempQuat.multiply(node.quaternion)
    return this._tempQuat.clone()
  }

  /**
   * Get the bone's rest pose local quaternion.
   */
  getRestLocal(bone: VRMHumanBoneName): Quaternion | null {
    const rest = this.restLocal.get(bone)
    return rest ? rest.clone() : null
  }

  // ============================================================================
  // POSITION METHODS
  // ============================================================================

  setHipsPositionOffset(offset: Vector3): void {
    const hips = this.nodes.get('hips')
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

  /**
   * Get world-space position of a bone.
   * Note: Call updateMatrixWorld() on the scene before this for accurate results.
   */
  getWorldPosition(bone: VRMHumanBoneName): Vector3 {
    const node = this.nodes.get(bone)
    if (!node) {
      return new Vector3()
    }
    node.getWorldPosition(this._tempVector)
    return this._tempVector.clone()
  }

  /**
   * Get world-space position into an existing Vector3 (no allocation).
   */
  getWorldPositionTo(bone: VRMHumanBoneName, out: Vector3): boolean {
    const node = this.nodes.get(bone)
    if (!node) return false
    node.getWorldPosition(out)
    return true
  }

  /**
   * Get world-space quaternion of a bone.
   */
  getWorldQuaternion(bone: VRMHumanBoneName): Quaternion | null {
    const node = this.nodes.get(bone)
    if (!node) return null
    node.getWorldQuaternion(this._tempWorldQuat)
    return this._tempWorldQuat.clone()
  }

  /**
   * Get world-space quaternion into an existing Quaternion (no allocation).
   */
  getWorldQuaternionTo(bone: VRMHumanBoneName, out: Quaternion): boolean {
    const node = this.nodes.get(bone)
    if (!node) return false
    node.getWorldQuaternion(out)
    return true
  }

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  getBoneNode(bone: VRMHumanBoneName): Object3D | null {
    return this.nodes.get(bone) ?? null
  }

  getRotation(bone: VRMHumanBoneName): Quaternion | null {
    const node = this.nodes.get(bone)
    if (!node) return null
    return node.quaternion.clone()
  }

  getRestPose(): Pose {
    return this.restPose
  }

  hasBone(bone: VRMHumanBoneName): boolean {
    return this.nodes.has(bone)
  }

  getAvailableBones(): VRMHumanBoneName[] {
    return [...this.availableBones]
  }

  // ============================================================================
  // POSE OPERATIONS
  // ============================================================================

  applyPose(pose: Pose): void {
    for (const [bone, rotation] of pose.rotations) {
      this.setRotation(bone, rotation)
    }

    if (pose.hipsOffset) {
      this.setHipsPositionOffset(pose.hipsOffset)
    }
  }

  resetToRestPose(): void {
    for (const [bone, rest] of this.restLocal) {
      const node = this.nodes.get(bone)
      if (node) {
        node.quaternion.copy(rest)
      }
    }

    const hips = this.nodes.get('hips')
    if (hips && this.restPose.hipsOffset) {
      hips.position.copy(this.restPose.hipsOffset)
    }
  }

  // ============================================================================
  // VRM ACCESS
  // ============================================================================

  /**
   * Get the underlying VRM instance.
   */
  getVRM(): VRM {
    return this.vrm
  }

  /**
   * Update the VRM (call each frame for blend shapes, spring bones, etc.).
   * This also syncs normalized bones to raw bones.
   */
  update(deltaTime: number): void {
    this.vrm.update(deltaTime)
  }

  /**
   * Ensure world matrices are up to date.
   * Call this after applying rotations and before reading world positions.
   */
  updateMatrixWorld(): void {
    this.vrm.scene.updateMatrixWorld(true)
  }
}
