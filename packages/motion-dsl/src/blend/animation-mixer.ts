/**
 * Animation Mixer
 *
 * Manages multiple animation layers with independent weights and blending.
 * Allows complex motion composition with base poses, additive layers,
 * and override layers.
 */

import { Quaternion, Vector3 } from 'three'
import type { Pose, VRMHumanBoneName } from '@posers/core'
import { createEmptyPose } from '@posers/core'

/**
 * Animation layer types
 */
export type LayerBlendMode = 'override' | 'additive'

/**
 * Animation layer configuration
 */
export interface AnimationLayer {
  /** Unique identifier for this layer */
  id: string
  /** Current weight of this layer (0-1) */
  weight: number
  /** Target weight for smooth transitions */
  targetWeight: number
  /** Blend mode for this layer */
  blendMode: LayerBlendMode
  /** Optional bone mask - only affects these bones */
  boneMask?: Set<VRMHumanBoneName>
  /** Current pose from this layer */
  pose: Pose
  /** Layer priority (higher = applied later) */
  priority: number
  /** Fade speed (units per second) */
  fadeSpeed: number
}

/**
 * Animation mixer for layered motion composition
 */
export interface AnimationMixer {
  /** Add a new animation layer */
  addLayer(config: Partial<AnimationLayer> & { id: string }): AnimationLayer
  /** Remove a layer by ID */
  removeLayer(id: string): void
  /** Get a layer by ID */
  getLayer(id: string): AnimationLayer | undefined
  /** Set layer weight with optional fade */
  setLayerWeight(id: string, weight: number, immediate?: boolean): void
  /** Set layer pose */
  setLayerPose(id: string, pose: Pose): void
  /** Update layer weights (call each frame) */
  update(dt: number): void
  /** Get the final blended pose */
  getBlendedPose(): Pose
  /** Fade out all layers */
  fadeOutAll(speed?: number): void
  /** Get all layer IDs */
  getLayerIds(): string[]
}

/**
 * Create an animation mixer
 */
export function createAnimationMixer(): AnimationMixer {
  const layers = new Map<string, AnimationLayer>()

  function getSortedLayers(): AnimationLayer[] {
    return Array.from(layers.values()).sort((a, b) => a.priority - b.priority)
  }

  return {
    addLayer(config) {
      const layer: AnimationLayer = {
        id: config.id,
        weight: config.weight ?? 0,
        targetWeight: config.targetWeight ?? config.weight ?? 0,
        blendMode: config.blendMode ?? 'override',
        boneMask: config.boneMask,
        pose: config.pose ?? createEmptyPose(),
        priority: config.priority ?? layers.size,
        fadeSpeed: config.fadeSpeed ?? 5,
      }
      layers.set(config.id, layer)
      return layer
    },

    removeLayer(id) {
      layers.delete(id)
    },

    getLayer(id) {
      return layers.get(id)
    },

    setLayerWeight(id, weight, immediate = false) {
      const layer = layers.get(id)
      if (layer) {
        layer.targetWeight = Math.max(0, Math.min(1, weight))
        if (immediate) {
          layer.weight = layer.targetWeight
        }
      }
    },

    setLayerPose(id, pose) {
      const layer = layers.get(id)
      if (layer) {
        layer.pose = pose
      }
    },

    update(dt) {
      for (const layer of layers.values()) {
        if (layer.weight !== layer.targetWeight) {
          const delta = layer.targetWeight - layer.weight
          const step = layer.fadeSpeed * dt
          if (Math.abs(delta) < step) {
            layer.weight = layer.targetWeight
          } else {
            layer.weight += Math.sign(delta) * step
          }
        }
      }
    },

    getBlendedPose() {
      const result = createEmptyPose()
      const sortedLayers = getSortedLayers()

      // Track accumulated rotations per bone
      const boneRotations = new Map<VRMHumanBoneName, Quaternion>()
      let hipsOffset = new Vector3()

      for (const layer of sortedLayers) {
        if (layer.weight <= 0) continue

        for (const [bone, rotation] of layer.pose.rotations) {
          // Check bone mask
          if (layer.boneMask && !layer.boneMask.has(bone)) continue

          const existing = boneRotations.get(bone) ?? new Quaternion()

          if (layer.blendMode === 'additive') {
            // Additive: multiply quaternions
            const additive = new Quaternion().slerpQuaternions(
              new Quaternion(),
              rotation,
              layer.weight
            )
            existing.multiply(additive)
          } else {
            // Override: slerp toward this layer's rotation
            existing.slerp(rotation, layer.weight)
          }

          boneRotations.set(bone, existing)
        }

        // Handle hips offset
        if (layer.pose.hipsOffset) {
          if (layer.blendMode === 'additive') {
            hipsOffset.add(layer.pose.hipsOffset.clone().multiplyScalar(layer.weight))
          } else {
            hipsOffset.lerp(layer.pose.hipsOffset, layer.weight)
          }
        }
      }

      // Copy to result
      for (const [bone, rotation] of boneRotations) {
        result.rotations.set(bone, rotation.normalize())
      }
      if (hipsOffset.lengthSq() > 0) {
        result.hipsOffset = hipsOffset
      }

      return result
    },

    fadeOutAll(speed = 5) {
      for (const layer of layers.values()) {
        layer.targetWeight = 0
        layer.fadeSpeed = speed
      }
    },

    getLayerIds() {
      return Array.from(layers.keys())
    }
  }
}

/**
 * Preset layer configurations
 */
export const LayerPresets = {
  /** Base body pose layer */
  base: {
    id: 'base',
    priority: 0,
    blendMode: 'override' as const,
    fadeSpeed: 3,
  },
  /** Breathing overlay */
  breathing: {
    id: 'breathing',
    priority: 10,
    blendMode: 'additive' as const,
    fadeSpeed: 2,
  },
  /** Micro-movement noise layer */
  microMovement: {
    id: 'micro',
    priority: 20,
    blendMode: 'additive' as const,
    fadeSpeed: 5,
  },
  /** Arm gesture overlay */
  armGesture: {
    id: 'arm-gesture',
    priority: 30,
    blendMode: 'override' as const,
    fadeSpeed: 4,
  },
  /** Head/eye look layer */
  lookAt: {
    id: 'look-at',
    priority: 40,
    blendMode: 'override' as const,
    fadeSpeed: 6,
  },
  /** Expression layer (face) */
  expression: {
    id: 'expression',
    priority: 50,
    blendMode: 'override' as const,
    fadeSpeed: 4,
  },
} as const
