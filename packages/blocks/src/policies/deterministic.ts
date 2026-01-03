/**
 * Non-deterministic patterns to detect in motion code.
 */
export const NON_DETERMINISTIC_PATTERNS = [
  {
    pattern: /Math\.random\s*\(\s*\)/g,
    message: 'Math.random() is non-deterministic. Use SeededRandom from @posers/core instead.',
  },
  {
    pattern: /Date\.now\s*\(\s*\)/g,
    message: 'Date.now() is non-deterministic. Use the provided time parameter instead.',
  },
  {
    pattern: /new\s+Date\s*\(\s*\)/g,
    message: 'new Date() without arguments is non-deterministic. Use the provided time parameter instead.',
  },
  {
    pattern: /performance\.now\s*\(\s*\)/g,
    message: 'performance.now() is non-deterministic in motion code. Use the provided time parameter instead.',
  },
  {
    pattern: /crypto\.getRandomValues/g,
    message: 'crypto.getRandomValues is non-deterministic. Use SeededRandom from @posers/core instead.',
  },
] as const

/**
 * Policy result for determinism checking.
 */
export interface DeterministicResult {
  valid: boolean
  violations: Array<{
    file: string
    line: number
    message: string
  }>
}

/**
 * Check source code for non-deterministic patterns.
 */
export function checkDeterministic(
  sourceCode: string,
  fileName: string
): DeterministicResult {
  const result: DeterministicResult = {
    valid: true,
    violations: [],
  }

  const lines = sourceCode.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue

    for (const { pattern, message } of NON_DETERMINISTIC_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0

      if (pattern.test(line)) {
        result.valid = false
        result.violations.push({
          file: fileName,
          line: i + 1,
          message,
        })
      }
    }
  }

  return result
}

/**
 * Allowed sources of randomness.
 */
export const ALLOWED_RANDOM_SOURCES = [
  'SeededRandom',
  'createRandom',
] as const

/**
 * Check if code uses allowed random sources.
 */
export function usesAllowedRandom(sourceCode: string): boolean {
  for (const source of ALLOWED_RANDOM_SOURCES) {
    if (sourceCode.includes(source)) {
      return true
    }
  }
  return false
}
