import * as ts from 'typescript'

/**
 * List of forbidden imports for motion code.
 */
export const FORBIDDEN_IMPORTS = [
  'fs',
  'path',
  'child_process',
  'net',
  'http',
  'https',
  'dgram',
  'tls',
  'cluster',
  'worker_threads',
  'vm',
  'repl',
] as const

/**
 * List of forbidden global calls.
 */
export const FORBIDDEN_GLOBALS = [
  'eval',
  'Function',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
] as const

/**
 * Policy result for import checking.
 */
export interface ImportPolicyResult {
  valid: boolean
  violations: Array<{
    file: string
    line: number
    message: string
  }>
}

/**
 * Check a source file for forbidden imports.
 * This is a simple AST-based checker.
 */
export function checkForbiddenImports(
  sourceCode: string,
  fileName: string
): ImportPolicyResult {
  const result: ImportPolicyResult = {
    valid: true,
    violations: [],
  }

  // Simple regex-based check (for quick validation)
  // A more robust implementation would use the TypeScript AST

  for (const forbidden of FORBIDDEN_IMPORTS) {
    // Check for import statements
    const importRegex = new RegExp(`import\\s+.*from\\s+['"]${forbidden}['"]`, 'g')
    const requireRegex = new RegExp(`require\\s*\\(\\s*['"]${forbidden}['"]\\s*\\)`, 'g')

    const lines = sourceCode.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (importRegex.test(line) || requireRegex.test(line)) {
        result.valid = false
        result.violations.push({
          file: fileName,
          line: i + 1,
          message: `Forbidden import: "${forbidden}" is not allowed in motion code`,
        })
      }
    }
  }

  // Check for forbidden globals
  for (const forbidden of FORBIDDEN_GLOBALS) {
    const lines = sourceCode.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue

      // Check for eval() or new Function()
      const evalRegex = new RegExp(`\\b${forbidden}\\s*\\(`, 'g')
      const newRegex = new RegExp(`new\\s+${forbidden}\\s*\\(`, 'g')

      if (evalRegex.test(line) || newRegex.test(line)) {
        result.valid = false
        result.violations.push({
          file: fileName,
          line: i + 1,
          message: `Forbidden global: "${forbidden}" is not allowed in motion code`,
        })
      }
    }
  }

  return result
}

/**
 * List of allowed imports for motion code.
 */
export const ALLOWED_IMPORTS = [
  'three',
  '@posers/core',
  '@posers/motion-dsl',
  'zod',
] as const

/**
 * Check if an import is allowed.
 */
export function isImportAllowed(importPath: string): boolean {
  // Allow relative imports
  if (importPath.startsWith('.')) return true

  // Allow specific packages
  for (const allowed of ALLOWED_IMPORTS) {
    if (importPath === allowed || importPath.startsWith(`${allowed}/`)) {
      return true
    }
  }

  return false
}
