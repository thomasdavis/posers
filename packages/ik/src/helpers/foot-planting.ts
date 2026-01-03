import { Vector3 } from 'three'
import type { HumanoidRig, VRMHumanBoneName } from '@posers/core'

/**
 * Options for foot planting helper.
 */
export interface FootPlantingOptions {
  /** Ground height (Y coordinate) */
  groundHeight?: number
  /** Tolerance for ground contact */
  tolerance?: number
  /** Which foot to plant */
  foot: 'left' | 'right'
}

/**
 * Stance phases for a walk cycle.
 */
export interface StancePhase {
  /** Is the foot currently on the ground? */
  isGrounded: boolean
  /** Contact position if grounded */
  contactPosition?: Vector3
  /** Phase within the gait cycle (0-1) */
  phase: number
}

/**
 * Detect stance phase based on leg configuration.
 * Stub implementation - full version in Milestone 2.
 */
export function detectStancePhase(
  rig: HumanoidRig,
  foot: 'left' | 'right',
  groundHeight = 0
): StancePhase {
  const footBone: VRMHumanBoneName = foot === 'left' ? 'leftFoot' : 'rightFoot'
  const footPos = rig.getWorldPosition(footBone)

  // Simple ground contact detection
  const isGrounded = footPos.y <= groundHeight + 0.05

  return {
    isGrounded,
    contactPosition: isGrounded ? footPos.clone() : undefined,
    phase: 0, // Stub: would calculate from motion state
  }
}

/**
 * Foot planting helper - keeps foot planted during stance phase.
 * Stub implementation - full version in Milestone 2.
 */
export function footPlantingHelper(
  rig: HumanoidRig,
  options: FootPlantingOptions
): void {
  const { groundHeight = 0, tolerance = 0.01, foot } = options

  const stance = detectStancePhase(rig, foot, groundHeight)

  if (stance.isGrounded && stance.contactPosition) {
    // Stub: Would use IK to keep foot at contact position
    // Full implementation will:
    // 1. Store foot position when foot first contacts ground
    // 2. Use IK to maintain that position during stance
    // 3. Release when foot lifts off
  }
}
