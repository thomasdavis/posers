import type { VRMHumanBoneName } from '@posers/core'

/**
 * Types of validation violations.
 */
export type ViolationType =
  | 'nan_rotation'
  | 'nan_position'
  | 'unnormalized_quaternion'
  | 'joint_limit_exceeded'
  | 'perf_budget_exceeded'
  | 'infinite_value'

/**
 * Severity levels for violations.
 */
export type ViolationSeverity = 'error' | 'warning'

/**
 * A validation violation.
 */
export interface Violation {
  type: ViolationType
  severity: ViolationSeverity
  message: string
  bone?: VRMHumanBoneName
  time?: number
  value?: unknown
}

/**
 * Result of a validation run.
 */
export interface ValidationResult {
  valid: boolean
  violations: Violation[]
  stats: {
    framesChecked: number
    totalViolations: number
    errorCount: number
    warningCount: number
    avgFrameTimeMs?: number
    maxFrameTimeMs?: number
  }
}

/**
 * Create an empty validation result.
 */
export function createEmptyResult(): ValidationResult {
  return {
    valid: true,
    violations: [],
    stats: {
      framesChecked: 0,
      totalViolations: 0,
      errorCount: 0,
      warningCount: 0,
    },
  }
}

/**
 * Add a violation to a result.
 */
export function addViolation(result: ValidationResult, violation: Violation): void {
  result.violations.push(violation)
  result.stats.totalViolations++

  if (violation.severity === 'error') {
    result.stats.errorCount++
    result.valid = false
  } else {
    result.stats.warningCount++
  }
}

/**
 * Merge multiple validation results.
 */
export function mergeResults(...results: ValidationResult[]): ValidationResult {
  const merged = createEmptyResult()

  for (const result of results) {
    merged.violations.push(...result.violations)
    merged.stats.framesChecked += result.stats.framesChecked
    merged.stats.totalViolations += result.stats.totalViolations
    merged.stats.errorCount += result.stats.errorCount
    merged.stats.warningCount += result.stats.warningCount

    if (!result.valid) {
      merged.valid = false
    }
  }

  return merged
}
