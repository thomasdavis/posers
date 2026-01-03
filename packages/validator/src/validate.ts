import type { HumanoidRig, MotionProgram, MotionContext } from '@posers/core'
import { createEmptyResult, type ValidationResult, type ViolationType } from './violations'
import { validateNaN } from './validators/nan-check'
import { validateNormalizedQuaternions } from './validators/normalized-quats'
import { validateJointLimits, type JointLimits, DEFAULT_JOINT_LIMITS } from './validators/joint-limits'
import { PerfTracker, measureTime, DEFAULT_PERF_BUDGET_MS } from './validators/perf-budget'
import type { VRMHumanBoneName } from '@posers/core'

/**
 * Options for motion validation.
 */
export interface ValidateMotionOptions {
  /** Duration to run the motion in seconds. Default: 10 */
  duration?: number
  /** Time step per frame in seconds. Default: 1/60 */
  timeStep?: number
  /** Enable NaN checking. Default: true */
  checkNaN?: boolean
  /** Enable quaternion normalization checking. Default: true */
  checkNormalization?: boolean
  /** Enable joint limit checking. Default: true */
  checkJointLimits?: boolean
  /** Custom joint limits. */
  jointLimits?: Partial<Record<VRMHumanBoneName, JointLimits>>
  /** Enable performance checking. Default: true */
  checkPerformance?: boolean
  /** Performance budget in ms per frame. Default: 4 */
  perfBudgetMs?: number
  /** Maximum number of violations to collect before stopping. Default: 100 */
  maxViolations?: number
  /** Stop on first error. Default: false */
  stopOnError?: boolean
}

const DEFAULT_OPTIONS: Required<ValidateMotionOptions> = {
  duration: 10,
  timeStep: 1 / 60,
  checkNaN: true,
  checkNormalization: true,
  checkJointLimits: true,
  jointLimits: DEFAULT_JOINT_LIMITS,
  checkPerformance: true,
  perfBudgetMs: DEFAULT_PERF_BUDGET_MS,
  maxViolations: 100,
  stopOnError: false,
}

/**
 * Validate a motion program by running it for a duration and checking for issues.
 */
export function validateMotion(
  motion: MotionProgram,
  rig: HumanoidRig,
  context: MotionContext,
  options: ValidateMotionOptions = {}
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const result = createEmptyResult()
  const perfTracker = new PerfTracker(opts.perfBudgetMs)

  let t = 0
  const dt = opts.timeStep
  let initialized = false

  // Run the motion for the specified duration
  while (t < opts.duration) {
    // Check if we should stop
    if (result.violations.length >= opts.maxViolations) {
      break
    }
    if (opts.stopOnError && !result.valid) {
      break
    }

    // Initialize on first frame
    if (!initialized && motion.init) {
      motion.init(rig, context)
      initialized = true
    }

    // Measure and run update
    const frameTime = measureTime(() => {
      motion.update(rig, context, t, dt)
    })
    perfTracker.recordFrame(frameTime)

    // Run validators
    if (opts.checkNaN) {
      validateNaN(rig, result, t)
    }

    if (opts.checkNormalization) {
      validateNormalizedQuaternions(rig, result, t)
    }

    if (opts.checkJointLimits) {
      validateJointLimits(rig, result, t, opts.jointLimits)
    }

    result.stats.framesChecked++
    t += dt
  }

  // Add performance violations
  if (opts.checkPerformance) {
    perfTracker.addViolations(result)
  }

  return result
}

/**
 * Quick validation - runs for a shorter duration with basic checks.
 */
export function quickValidate(
  motion: MotionProgram,
  rig: HumanoidRig,
  context: MotionContext
): ValidationResult {
  return validateMotion(motion, rig, context, {
    duration: 2,
    checkJointLimits: false,
    checkPerformance: false,
    maxViolations: 10,
    stopOnError: true,
  })
}

/**
 * Format validation result as a string for display.
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = []

  if (result.valid) {
    lines.push('✓ Validation passed')
  } else {
    lines.push('✗ Validation failed')
  }

  lines.push(`  Frames checked: ${result.stats.framesChecked}`)
  lines.push(`  Errors: ${result.stats.errorCount}`)
  lines.push(`  Warnings: ${result.stats.warningCount}`)

  if (result.stats.avgFrameTimeMs !== undefined) {
    lines.push(`  Avg frame time: ${result.stats.avgFrameTimeMs.toFixed(2)}ms`)
    lines.push(`  Max frame time: ${result.stats.maxFrameTimeMs?.toFixed(2)}ms`)
  }

  if (result.violations.length > 0) {
    lines.push('')
    lines.push('Violations:')
    for (const v of result.violations.slice(0, 20)) {
      const prefix = v.severity === 'error' ? '  ✗' : '  ⚠'
      const timeStr = v.time !== undefined ? ` @ t=${v.time.toFixed(2)}s` : ''
      lines.push(`${prefix} ${v.message}${timeStr}`)
    }
    if (result.violations.length > 20) {
      lines.push(`  ... and ${result.violations.length - 20} more`)
    }
  }

  return lines.join('\n')
}
