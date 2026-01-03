/**
 * Required exports for a motion module.
 */
export const REQUIRED_EXPORTS = [
  'meta',
  'paramsSchema',
] as const

/**
 * Recommended exports for a motion module.
 */
export const RECOMMENDED_EXPORTS = [
  'createMotion', // Factory function
] as const

/**
 * Policy result for motion interface checking.
 */
export interface MotionInterfaceResult {
  valid: boolean
  violations: Array<{
    file: string
    message: string
    type: 'error' | 'warning'
  }>
}

/**
 * Check if a module exports the required motion interface.
 * This is a simple check - a full implementation would use TypeScript's type checker.
 */
export function checkMotionInterface(
  sourceCode: string,
  fileName: string
): MotionInterfaceResult {
  const result: MotionInterfaceResult = {
    valid: true,
    violations: [],
  }

  // Check for required exports
  for (const required of REQUIRED_EXPORTS) {
    const exportRegex = new RegExp(`export\\s+(const|let|function|class)\\s+${required}\\b`)
    const namedExportRegex = new RegExp(`export\\s*\\{[^}]*\\b${required}\\b[^}]*\\}`)

    if (!exportRegex.test(sourceCode) && !namedExportRegex.test(sourceCode)) {
      result.valid = false
      result.violations.push({
        file: fileName,
        message: `Missing required export: "${required}"`,
        type: 'error',
      })
    }
  }

  // Check for recommended exports (warnings only)
  for (const recommended of RECOMMENDED_EXPORTS) {
    const exportRegex = new RegExp(`export\\s+(const|let|function|class)\\s+${recommended}\\b`)
    const namedExportRegex = new RegExp(`export\\s*\\{[^}]*\\b${recommended}\\b[^}]*\\}`)

    if (!exportRegex.test(sourceCode) && !namedExportRegex.test(sourceCode)) {
      result.violations.push({
        file: fileName,
        message: `Missing recommended export: "${recommended}"`,
        type: 'warning',
      })
    }
  }

  // Check for MotionProgram implementation
  const hasMotionProgram = sourceCode.includes('MotionProgram')
  if (!hasMotionProgram) {
    result.violations.push({
      file: fileName,
      message: 'Motion should implement MotionProgram interface',
      type: 'warning',
    })
  }

  // Check for update function
  const hasUpdate = /update\s*\(\s*rig\s*[,:]/i.test(sourceCode)
  if (!hasUpdate) {
    result.violations.push({
      file: fileName,
      message: 'Motion should have an update(rig, ctx, t, dt) method',
      type: 'warning',
    })
  }

  return result
}
