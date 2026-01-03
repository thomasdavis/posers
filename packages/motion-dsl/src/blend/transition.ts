/**
 * Transition System
 *
 * Provides smooth fade-in/fade-out for motion programs.
 * All motions should use this for fluid chaining.
 */

import { Easing, type EasingFunction } from '@posers/core'

/**
 * Transition state
 */
export type TransitionPhase = 'idle' | 'fade_in' | 'active' | 'fade_out' | 'complete'

/**
 * Transition configuration
 */
export interface TransitionConfig {
  /** Duration of fade-in (seconds) */
  fadeInDuration: number
  /** Duration of fade-out (seconds) */
  fadeOutDuration: number
  /** Easing function for fade-in */
  fadeInEasing: EasingFunction
  /** Easing function for fade-out */
  fadeOutEasing: EasingFunction
}

/**
 * Transition state machine
 */
export interface TransitionState {
  /** Current phase */
  phase: TransitionPhase
  /** Time spent in current phase */
  phaseTime: number
  /** Current blend weight (0-1) */
  weight: number
  /** Total time the motion has been active */
  totalTime: number
}

/**
 * Transition controller
 */
export interface TransitionController {
  /** Get current state */
  getState(): TransitionState
  /** Get current weight */
  getWeight(): number
  /** Start the transition (fade in) */
  start(): void
  /** Begin fade out */
  stop(): void
  /** Update the transition */
  update(dt: number): void
  /** Check if fully complete (faded out) */
  isComplete(): boolean
  /** Check if currently active (not idle or complete) */
  isActive(): boolean
  /** Reset to idle state */
  reset(): void
  /** Force to a specific weight */
  setWeight(weight: number): void
}

/**
 * Default transition config
 */
export const defaultTransitionConfig: TransitionConfig = {
  fadeInDuration: 0.3,
  fadeOutDuration: 0.3,
  fadeInEasing: Easing.easeOutCubic,
  fadeOutEasing: Easing.easeInCubic,
}

/**
 * Create a transition controller
 */
export function createTransition(config: Partial<TransitionConfig> = {}): TransitionController {
  const cfg: TransitionConfig = {
    ...defaultTransitionConfig,
    ...config,
  }

  const state: TransitionState = {
    phase: 'idle',
    phaseTime: 0,
    weight: 0,
    totalTime: 0,
  }

  return {
    getState() {
      return { ...state }
    },

    getWeight() {
      return state.weight
    },

    start() {
      if (state.phase === 'idle' || state.phase === 'complete') {
        state.phase = 'fade_in'
        state.phaseTime = 0
      } else if (state.phase === 'fade_out') {
        // Reverse fade out - go back to fade in from current weight
        state.phase = 'fade_in'
        // Calculate equivalent fade-in time for current weight
        state.phaseTime = cfg.fadeInDuration * state.weight
      }
    },

    stop() {
      if (state.phase === 'fade_in' || state.phase === 'active') {
        state.phase = 'fade_out'
        // Calculate equivalent fade-out time for current weight
        state.phaseTime = cfg.fadeOutDuration * (1 - state.weight)
      }
    },

    update(dt: number) {
      state.totalTime += dt

      switch (state.phase) {
        case 'idle':
          state.weight = 0
          break

        case 'fade_in':
          state.phaseTime += dt
          if (state.phaseTime >= cfg.fadeInDuration) {
            state.phase = 'active'
            state.phaseTime = 0
            state.weight = 1
          } else {
            const t = state.phaseTime / cfg.fadeInDuration
            state.weight = cfg.fadeInEasing(t)
          }
          break

        case 'active':
          state.weight = 1
          state.phaseTime += dt
          break

        case 'fade_out':
          state.phaseTime += dt
          if (state.phaseTime >= cfg.fadeOutDuration) {
            state.phase = 'complete'
            state.phaseTime = 0
            state.weight = 0
          } else {
            const t = state.phaseTime / cfg.fadeOutDuration
            state.weight = 1 - cfg.fadeOutEasing(t)
          }
          break

        case 'complete':
          state.weight = 0
          break
      }
    },

    isComplete() {
      return state.phase === 'complete'
    },

    isActive() {
      return state.phase !== 'idle' && state.phase !== 'complete'
    },

    reset() {
      state.phase = 'idle'
      state.phaseTime = 0
      state.weight = 0
      state.totalTime = 0
    },

    setWeight(weight: number) {
      state.weight = Math.max(0, Math.min(1, weight))
      if (weight >= 1) {
        state.phase = 'active'
      } else if (weight <= 0) {
        state.phase = 'idle'
      }
    }
  }
}

/**
 * Transition presets for different motion types
 */
export const TransitionPresets = {
  /** Quick, snappy transitions */
  quick: {
    fadeInDuration: 0.15,
    fadeOutDuration: 0.15,
    fadeInEasing: Easing.easeOutQuad,
    fadeOutEasing: Easing.easeInQuad,
  } as Partial<TransitionConfig>,

  /** Smooth, natural transitions */
  smooth: {
    fadeInDuration: 0.4,
    fadeOutDuration: 0.4,
    fadeInEasing: Easing.easeInOutCubic,
    fadeOutEasing: Easing.easeInOutCubic,
  } as Partial<TransitionConfig>,

  /** Slow, deliberate transitions */
  slow: {
    fadeInDuration: 0.8,
    fadeOutDuration: 0.6,
    fadeInEasing: Easing.contemplative,
    fadeOutEasing: Easing.easeInCubic,
  } as Partial<TransitionConfig>,

  /** Breathing/organic transitions */
  organic: {
    fadeInDuration: 0.5,
    fadeOutDuration: 0.5,
    fadeInEasing: Easing.breathe,
    fadeOutEasing: Easing.breathe,
  } as Partial<TransitionConfig>,

  /** Gesture/action transitions */
  gesture: {
    fadeInDuration: 0.25,
    fadeOutDuration: 0.35,
    fadeInEasing: Easing.armRaise,
    fadeOutEasing: Easing.easeOutCubic,
  } as Partial<TransitionConfig>,

  /** Walk cycle transitions */
  locomotion: {
    fadeInDuration: 0.6,
    fadeOutDuration: 0.4,
    fadeInEasing: Easing.standard,
    fadeOutEasing: Easing.decelerate,
  } as Partial<TransitionConfig>,

  /** Instant (no fade) */
  instant: {
    fadeInDuration: 0,
    fadeOutDuration: 0,
    fadeInEasing: Easing.linear,
    fadeOutEasing: Easing.linear,
  } as Partial<TransitionConfig>,
}

/**
 * Crossfade helper - manages transition between two motions
 */
export interface CrossfadeController {
  /** Start crossfade from A to B */
  crossfade(duration: number): void
  /** Get weight for motion A */
  getWeightA(): number
  /** Get weight for motion B */
  getWeightB(): number
  /** Update crossfade */
  update(dt: number): void
  /** Check if crossfade is complete */
  isComplete(): boolean
  /** Swap A and B (after crossfade completes) */
  swap(): void
}

export function createCrossfade(
  easing: EasingFunction = Easing.easeInOutCubic
): CrossfadeController {
  let crossfading = false
  let crossfadeTime = 0
  let crossfadeDuration = 0
  let progress = 0

  return {
    crossfade(duration: number) {
      crossfading = true
      crossfadeTime = 0
      crossfadeDuration = duration
      progress = 0
    },

    getWeightA() {
      return 1 - progress
    },

    getWeightB() {
      return progress
    },

    update(dt: number) {
      if (!crossfading) return

      crossfadeTime += dt
      if (crossfadeTime >= crossfadeDuration) {
        progress = 1
        crossfading = false
      } else {
        progress = easing(crossfadeTime / crossfadeDuration)
      }
    },

    isComplete() {
      return !crossfading && progress >= 1
    },

    swap() {
      progress = 0
      crossfading = false
    }
  }
}
