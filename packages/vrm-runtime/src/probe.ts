/**
 * PoseProbe - Spatial Telemetry System
 *
 * Provides real-time spatial information about the character pose:
 * - World-space positions of end effectors (hands, feet, head)
 * - Distances to semantic landmarks (hand→mouth, foot→floor)
 * - Joint angles with violation detection
 * - Velocities for smoothness analysis
 * - Foot contact and sliding detection
 * - Overall pose quality score
 *
 * This telemetry turns "blind rotation guessing" into "measurable optimization."
 */

import { Vector3, Quaternion } from 'three'
import type { VRMHumanBoneName } from '@posers/core'
import {
  swingTwistDecompose,
  createSwingTwistResult,
  relativeToRest,
  radToDeg,
} from '@posers/core'
import type { VRMHumanoidRig } from './rig'
import type { RigCalibration, BoneCalibration } from './calibration'
import { getLandmarkPosition } from './calibration'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Semantic landmarks for position queries.
 */
export type Landmark =
  | 'hips'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'mouth'
  | 'chin'
  | 'leftShoulder' | 'rightShoulder'
  | 'leftElbow' | 'rightElbow'
  | 'leftHand' | 'rightHand'
  | 'leftHip' | 'rightHip'
  | 'leftKnee' | 'rightKnee'
  | 'leftFoot' | 'rightFoot'
  | 'leftToes' | 'rightToes'

/**
 * Landmark to bone mapping.
 */
const LANDMARK_TO_BONE: Record<Landmark, VRMHumanBoneName | null> = {
  hips: 'hips',
  spine: 'spine',
  chest: 'chest',
  neck: 'neck',
  head: 'head',
  mouth: null, // Computed from head
  chin: null,  // Computed from head
  leftShoulder: 'leftShoulder',
  rightShoulder: 'rightShoulder',
  leftElbow: 'leftLowerArm',
  rightElbow: 'rightLowerArm',
  leftHand: 'leftHand',
  rightHand: 'rightHand',
  leftHip: 'leftUpperLeg',
  rightHip: 'rightUpperLeg',
  leftKnee: 'leftLowerLeg',
  rightKnee: 'rightLowerLeg',
  leftFoot: 'leftFoot',
  rightFoot: 'rightFoot',
  leftToes: 'leftToes',
  rightToes: 'rightToes',
}

/**
 * Joint angle report for a single bone.
 */
export interface JointAngleReport {
  bone: VRMHumanBoneName
  twistDeg: number
  swingDeg: number
  twistRad: number
  swingRad: number
  violated: boolean
  violationAmountDeg: number
  limitSwingDeg?: number
  limitTwistMinDeg?: number
  limitTwistMaxDeg?: number
}

/**
 * Foot contact report.
 */
export interface FootContactReport {
  side: 'left' | 'right'
  inContact: boolean
  footY: number
  groundY: number
  penetration: number      // How far below ground (positive = penetrating)
  horizontalSpeed: number  // Movement speed while "in contact"
  sliding: boolean
}

/**
 * Quality score breakdown.
 */
export interface QualityBreakdown {
  joint: number      // Joint limit violations
  slide: number      // Foot sliding penalty
  jerk: number       // High acceleration penalty
  goal: number       // Distance to targets penalty
  total: number
}

/**
 * Complete pose probe frame data.
 */
export interface PoseProbeFrame {
  t: number
  dt: number

  // World-space positions
  positions: Partial<Record<Landmark, Vector3>>

  // World-space velocities (from previous frame)
  velocities: Partial<Record<Landmark, Vector3>>

  // Pre-computed distances between common pairs
  distances: Record<string, number>

  // Joint angle reports
  jointAngles: JointAngleReport[]

  // Foot contact
  foot: FootContactReport[]

  // Quality score
  quality: QualityBreakdown
}

// ============================================================================
// DEFAULT JOINT LIMITS
// ============================================================================

interface JointLimit {
  maxSwingDeg: number
  minTwistDeg: number
  maxTwistDeg: number
}

const DEFAULT_JOINT_LIMITS: Partial<Record<VRMHumanBoneName, JointLimit>> = {
  // Shoulders
  leftUpperArm: { maxSwingDeg: 150, minTwistDeg: -90, maxTwistDeg: 90 },
  rightUpperArm: { maxSwingDeg: 150, minTwistDeg: -90, maxTwistDeg: 90 },

  // Elbows (mostly hinge)
  leftLowerArm: { maxSwingDeg: 150, minTwistDeg: -90, maxTwistDeg: 90 },
  rightLowerArm: { maxSwingDeg: 150, minTwistDeg: -90, maxTwistDeg: 90 },

  // Wrists
  leftHand: { maxSwingDeg: 80, minTwistDeg: -45, maxTwistDeg: 45 },
  rightHand: { maxSwingDeg: 80, minTwistDeg: -45, maxTwistDeg: 45 },

  // Hips
  leftUpperLeg: { maxSwingDeg: 120, minTwistDeg: -45, maxTwistDeg: 45 },
  rightUpperLeg: { maxSwingDeg: 120, minTwistDeg: -45, maxTwistDeg: 45 },

  // Knees (mostly hinge)
  leftLowerLeg: { maxSwingDeg: 160, minTwistDeg: -10, maxTwistDeg: 10 },
  rightLowerLeg: { maxSwingDeg: 160, minTwistDeg: -10, maxTwistDeg: 10 },

  // Ankles
  leftFoot: { maxSwingDeg: 50, minTwistDeg: -30, maxTwistDeg: 30 },
  rightFoot: { maxSwingDeg: 50, minTwistDeg: -30, maxTwistDeg: 30 },

  // Spine
  spine: { maxSwingDeg: 40, minTwistDeg: -30, maxTwistDeg: 30 },
  chest: { maxSwingDeg: 30, minTwistDeg: -30, maxTwistDeg: 30 },

  // Neck/Head
  neck: { maxSwingDeg: 40, minTwistDeg: -60, maxTwistDeg: 60 },
  head: { maxSwingDeg: 50, minTwistDeg: -70, maxTwistDeg: 70 },
}

// ============================================================================
// POSE PROBE IMPLEMENTATION
// ============================================================================

/**
 * Create a PoseProbe instance for a calibrated rig.
 */
export class PoseProbe {
  private rig: VRMHumanoidRig
  private calibration: RigCalibration

  // Previous frame data for velocity computation
  private prevPositions = new Map<Landmark, Vector3>()
  private prevT = 0

  // Reusable objects
  private _tempQuat = new Quaternion()
  private _tempVec = new Vector3()
  private _swingTwist = createSwingTwistResult()

  // Ground plane Y (can be configured)
  private groundY = 0

  // Sliding threshold (m/s)
  private slideThreshold = 0.05

  constructor(rig: VRMHumanoidRig, calibration: RigCalibration) {
    this.rig = rig
    this.calibration = calibration
  }

  /**
   * Sample the current pose and compute all telemetry.
   */
  sample(t: number, dt: number): PoseProbeFrame {
    // Ensure matrices are up to date
    this.rig.updateMatrixWorld()

    const frame: PoseProbeFrame = {
      t,
      dt,
      positions: {},
      velocities: {},
      distances: {},
      jointAngles: [],
      foot: [],
      quality: { joint: 0, slide: 0, jerk: 0, goal: 0, total: 0 },
    }

    // Sample positions
    this.samplePositions(frame)

    // Compute velocities from previous frame
    this.computeVelocities(frame, dt)

    // Compute common distances
    this.computeDistances(frame)

    // Analyze joint angles
    this.analyzeJointAngles(frame)

    // Analyze foot contact
    this.analyzeFootContact(frame)

    // Compute quality score
    this.computeQualityScore(frame)

    // Store for next frame
    this.storeForNextFrame(frame, t)

    return frame
  }

  /**
   * Get position of a landmark.
   */
  getPosition(landmark: Landmark): Vector3 {
    const bone = LANDMARK_TO_BONE[landmark]
    if (bone) {
      return this.rig.getWorldPosition(bone)
    }
    // Computed landmark
    return getLandmarkPosition(this.rig, this.calibration, landmark)
  }

  /**
   * Get distance between two landmarks.
   */
  getDistance(from: Landmark, to: Landmark): number {
    const posA = this.getPosition(from)
    const posB = this.getPosition(to)
    return posA.distanceTo(posB)
  }

  /**
   * Get joint angle report for a bone.
   */
  getJointAngle(bone: VRMHumanBoneName): JointAngleReport | null {
    const boneCalib = this.calibration.bones.get(bone)
    if (!boneCalib || !boneCalib.twistAxisLocal) return null

    const qRel = this.rig.getRotationRel(bone)
    if (!qRel) return null

    // Decompose into swing/twist
    swingTwistDecompose(qRel, boneCalib.twistAxisLocal, this._swingTwist)

    const swingDeg = radToDeg(this._swingTwist.swingAngleRad)
    const twistDeg = radToDeg(this._swingTwist.twistAngleRad)

    // Check limits
    const limit = DEFAULT_JOINT_LIMITS[bone]
    let violated = false
    let violationAmount = 0

    if (limit) {
      if (Math.abs(swingDeg) > limit.maxSwingDeg) {
        violated = true
        violationAmount += Math.abs(swingDeg) - limit.maxSwingDeg
      }
      if (twistDeg < limit.minTwistDeg) {
        violated = true
        violationAmount += limit.minTwistDeg - twistDeg
      }
      if (twistDeg > limit.maxTwistDeg) {
        violated = true
        violationAmount += twistDeg - limit.maxTwistDeg
      }
    }

    return {
      bone,
      swingDeg,
      twistDeg,
      swingRad: this._swingTwist.swingAngleRad,
      twistRad: this._swingTwist.twistAngleRad,
      violated,
      violationAmountDeg: violationAmount,
      limitSwingDeg: limit?.maxSwingDeg,
      limitTwistMinDeg: limit?.minTwistDeg,
      limitTwistMaxDeg: limit?.maxTwistDeg,
    }
  }

  /**
   * Format frame data as compact text for prompts.
   */
  formatCompact(frame: PoseProbeFrame, maxLines = 10): string {
    const lines: string[] = []

    // Header
    lines.push(`t=${frame.t.toFixed(2)} dt=${(frame.dt * 1000).toFixed(1)}ms`)

    // Key positions
    const pos = frame.positions
    if (pos.rightHand && pos.mouth) {
      const d = pos.rightHand.distanceTo(pos.mouth)
      lines.push(
        `handR=(${pos.rightHand.x.toFixed(2)},${pos.rightHand.y.toFixed(2)},${pos.rightHand.z.toFixed(2)}) ` +
        `mouth=(${pos.mouth.x.toFixed(2)},${pos.mouth.y.toFixed(2)},${pos.mouth.z.toFixed(2)}) dist=${d.toFixed(2)}m`
      )
    }

    // Joint angles with violations
    const violations = frame.jointAngles.filter(j => j.violated)
    if (violations.length > 0) {
      for (const v of violations.slice(0, 3)) {
        lines.push(
          `${v.bone} swing=${v.swingDeg.toFixed(0)}° twist=${v.twistDeg.toFixed(0)}° ` +
          `(VIOLATION +${v.violationAmountDeg.toFixed(0)}°)`
        )
      }
    } else {
      // Show a couple normal joints
      const show = frame.jointAngles.slice(0, 2)
      for (const j of show) {
        lines.push(`${j.bone} swing=${j.swingDeg.toFixed(0)}° twist=${j.twistDeg.toFixed(0)}° (ok)`)
      }
    }

    // Foot contact
    for (const f of frame.foot) {
      const status = f.sliding ? 'SLIDING' : f.inContact ? 'contact' : 'air'
      lines.push(
        `foot${f.side[0].toUpperCase()} ${status} y=${f.footY.toFixed(2)} speed=${f.horizontalSpeed.toFixed(2)}m/s`
      )
    }

    // Quality score
    const q = frame.quality
    lines.push(
      `quality=${q.total.toFixed(2)} (joint=${q.joint.toFixed(2)} slide=${q.slide.toFixed(2)} jerk=${q.jerk.toFixed(2)})`
    )

    return lines.slice(0, maxLines).join('\n')
  }

  // --------------------------------------------------------------------------
  // PRIVATE METHODS
  // --------------------------------------------------------------------------

  private samplePositions(frame: PoseProbeFrame): void {
    const landmarks: Landmark[] = [
      'hips', 'head', 'mouth', 'neck', 'chest',
      'leftShoulder', 'rightShoulder',
      'leftElbow', 'rightElbow',
      'leftHand', 'rightHand',
      'leftKnee', 'rightKnee',
      'leftFoot', 'rightFoot',
    ]

    for (const lm of landmarks) {
      frame.positions[lm] = this.getPosition(lm).clone()
    }
  }

  private computeVelocities(frame: PoseProbeFrame, dt: number): void {
    if (dt <= 0) return

    for (const [lm, pos] of Object.entries(frame.positions) as [Landmark, Vector3][]) {
      const prev = this.prevPositions.get(lm)
      if (prev) {
        const vel = new Vector3().subVectors(pos, prev).divideScalar(dt)
        frame.velocities[lm] = vel
      }
    }
  }

  private computeDistances(frame: PoseProbeFrame): void {
    const pairs: [Landmark, Landmark][] = [
      ['rightHand', 'mouth'],
      ['leftHand', 'mouth'],
      ['rightHand', 'rightShoulder'],
      ['leftHand', 'leftShoulder'],
      ['rightHand', 'hips'],
      ['leftHand', 'hips'],
      ['leftFoot', 'rightFoot'],
    ]

    for (const [a, b] of pairs) {
      const posA = frame.positions[a]
      const posB = frame.positions[b]
      if (posA && posB) {
        frame.distances[`${a}→${b}`] = posA.distanceTo(posB)
      }
    }
  }

  private analyzeJointAngles(frame: PoseProbeFrame): void {
    const bonesToAnalyze: VRMHumanBoneName[] = [
      'leftUpperArm', 'leftLowerArm', 'leftHand',
      'rightUpperArm', 'rightLowerArm', 'rightHand',
      'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
      'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
      'spine', 'chest', 'neck', 'head',
    ]

    for (const bone of bonesToAnalyze) {
      const report = this.getJointAngle(bone)
      if (report) {
        frame.jointAngles.push(report)
      }
    }
  }

  private analyzeFootContact(frame: PoseProbeFrame): void {
    for (const side of ['left', 'right'] as const) {
      const footLandmark: Landmark = side === 'left' ? 'leftFoot' : 'rightFoot'
      const footPos = frame.positions[footLandmark]
      const footVel = frame.velocities[footLandmark]

      if (!footPos) continue

      const footY = footPos.y
      const penetration = this.groundY - footY
      const inContact = penetration > -0.05 // Within 5cm of ground

      // Horizontal speed
      let horizontalSpeed = 0
      if (footVel) {
        horizontalSpeed = Math.sqrt(footVel.x ** 2 + footVel.z ** 2)
      }

      const sliding = inContact && horizontalSpeed > this.slideThreshold

      frame.foot.push({
        side,
        inContact,
        footY,
        groundY: this.groundY,
        penetration,
        horizontalSpeed,
        sliding,
      })
    }
  }

  private computeQualityScore(frame: PoseProbeFrame): void {
    // Joint penalty
    let jointPenalty = 0
    for (const j of frame.jointAngles) {
      if (j.violated) {
        jointPenalty += j.violationAmountDeg / 90 // Normalize by 90 degrees
      }
    }
    jointPenalty = Math.min(1, jointPenalty / 3) // Cap at 1

    // Slide penalty
    let slidePenalty = 0
    for (const f of frame.foot) {
      if (f.sliding) {
        slidePenalty += f.horizontalSpeed / 0.5 // Normalize by 0.5 m/s
      }
    }
    slidePenalty = Math.min(1, slidePenalty)

    // Jerk penalty (from velocities - simplified)
    let jerkPenalty = 0
    const handVelR = frame.velocities.rightHand
    const handVelL = frame.velocities.leftHand
    if (handVelR) {
      const speed = handVelR.length()
      if (speed > 3) jerkPenalty += (speed - 3) / 5 // Penalize > 3 m/s
    }
    if (handVelL) {
      const speed = handVelL.length()
      if (speed > 3) jerkPenalty += (speed - 3) / 5
    }
    jerkPenalty = Math.min(1, jerkPenalty)

    // Goal penalty placeholder (would be set based on targets)
    const goalPenalty = 0

    // Total (weighted)
    const total =
      0.4 * jointPenalty +
      0.3 * slidePenalty +
      0.2 * jerkPenalty +
      0.1 * goalPenalty

    frame.quality = {
      joint: jointPenalty,
      slide: slidePenalty,
      jerk: jerkPenalty,
      goal: goalPenalty,
      total,
    }
  }

  private storeForNextFrame(frame: PoseProbeFrame, t: number): void {
    this.prevPositions.clear()
    for (const [lm, pos] of Object.entries(frame.positions) as [Landmark, Vector3][]) {
      this.prevPositions.set(lm, pos.clone())
    }
    this.prevT = t
  }

  /**
   * Set the ground plane Y coordinate.
   */
  setGroundY(y: number): void {
    this.groundY = y
  }
}

/**
 * Create a PoseProbe for a calibrated rig.
 */
export function createPoseProbe(
  rig: VRMHumanoidRig,
  calibration: RigCalibration
): PoseProbe {
  return new PoseProbe(rig, calibration)
}
