import { addViolation, type ValidationResult } from '../violations'

/**
 * Default performance budget in milliseconds per frame.
 */
export const DEFAULT_PERF_BUDGET_MS = 4 // ~250 fps headroom

/**
 * Performance tracking for motion validation.
 */
export class PerfTracker {
  private frameTimes: number[] = []
  private budgetMs: number

  constructor(budgetMs = DEFAULT_PERF_BUDGET_MS) {
    this.budgetMs = budgetMs
  }

  /**
   * Record a frame time.
   */
  recordFrame(timeMs: number): void {
    this.frameTimes.push(timeMs)
  }

  /**
   * Get average frame time.
   */
  getAverageMs(): number {
    if (this.frameTimes.length === 0) return 0
    const sum = this.frameTimes.reduce((a, b) => a + b, 0)
    return sum / this.frameTimes.length
  }

  /**
   * Get maximum frame time.
   */
  getMaxMs(): number {
    if (this.frameTimes.length === 0) return 0
    return Math.max(...this.frameTimes)
  }

  /**
   * Get the 95th percentile frame time.
   */
  getP95Ms(): number {
    if (this.frameTimes.length === 0) return 0
    const sorted = [...this.frameTimes].sort((a, b) => a - b)
    const index = Math.floor(sorted.length * 0.95)
    return sorted[Math.min(index, sorted.length - 1)]
  }

  /**
   * Check if performance budget was exceeded.
   */
  isBudgetExceeded(): boolean {
    return this.getMaxMs() > this.budgetMs
  }

  /**
   * Reset the tracker.
   */
  reset(): void {
    this.frameTimes = []
  }

  /**
   * Add violations for exceeded budget.
   */
  addViolations(result: ValidationResult): void {
    const maxMs = this.getMaxMs()
    const avgMs = this.getAverageMs()

    result.stats.avgFrameTimeMs = avgMs
    result.stats.maxFrameTimeMs = maxMs

    if (maxMs > this.budgetMs) {
      addViolation(result, {
        type: 'perf_budget_exceeded',
        severity: 'warning',
        message: `Performance budget exceeded: max ${maxMs.toFixed(2)}ms > budget ${this.budgetMs}ms (avg: ${avgMs.toFixed(2)}ms)`,
        value: { maxMs, avgMs, budgetMs: this.budgetMs },
      })
    }
  }
}

/**
 * Measure execution time of a function.
 */
export function measureTime(fn: () => void): number {
  const start = performance.now()
  fn()
  return performance.now() - start
}
