/**
 * Deterministic clock for motion playback.
 * Allows scrubbing, pausing, and speed control.
 */
export class DeterministicClock {
  private _time = 0
  private _speed = 1
  private _paused = false
  private _lastRealTime: number | null = null

  /**
   * Current playback time in seconds.
   */
  get time(): number {
    return this._time
  }

  /**
   * Playback speed multiplier (1 = normal, 0.5 = half speed, 2 = double speed).
   */
  get speed(): number {
    return this._speed
  }

  set speed(value: number) {
    this._speed = Math.max(0, value)
  }

  /**
   * Whether the clock is paused.
   */
  get paused(): boolean {
    return this._paused
  }

  /**
   * Pause playback.
   */
  pause(): void {
    this._paused = true
  }

  /**
   * Resume playback.
   */
  play(): void {
    this._paused = false
    this._lastRealTime = null
  }

  /**
   * Toggle pause/play.
   */
  toggle(): void {
    if (this._paused) {
      this.play()
    } else {
      this.pause()
    }
  }

  /**
   * Seek to a specific time.
   */
  seek(time: number): void {
    this._time = Math.max(0, time)
  }

  /**
   * Reset to time 0.
   */
  reset(): void {
    this._time = 0
    this._lastRealTime = null
  }

  /**
   * Update the clock. Call this each frame.
   * @param realDeltaTime - Real elapsed time in seconds (optional, uses performance.now if not provided)
   * @returns The delta time to use for motion updates
   */
  update(realDeltaTime?: number): number {
    if (this._paused) {
      return 0
    }

    let dt: number
    if (realDeltaTime !== undefined) {
      dt = realDeltaTime
    } else {
      const now = performance.now() / 1000
      if (this._lastRealTime === null) {
        this._lastRealTime = now
        return 0
      }
      dt = now - this._lastRealTime
      this._lastRealTime = now
    }

    const scaledDt = dt * this._speed
    this._time += scaledDt
    return scaledDt
  }

  /**
   * Manually advance time by a fixed amount (for deterministic testing).
   */
  advance(dt: number): number {
    if (this._paused) {
      return 0
    }
    const scaledDt = dt * this._speed
    this._time += scaledDt
    return scaledDt
  }
}
