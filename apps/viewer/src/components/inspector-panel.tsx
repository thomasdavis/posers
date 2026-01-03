'use client'

import { useState } from 'react'
import type { VRM } from '@pixiv/three-vrm'
import type { MotionProgram, VRMHumanBoneName } from '@posers/core'

interface InspectorPanelProps {
  vrm: VRM | null
  motion: MotionProgram | null
  time: number
}

const MAIN_BONES: VRMHumanBoneName[] = [
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'leftUpperArm',
  'leftLowerArm',
  'rightUpperArm',
  'rightLowerArm',
  'leftUpperLeg',
  'leftLowerLeg',
  'rightUpperLeg',
  'rightLowerLeg',
]

function radToDeg(rad: number): number {
  return rad * (180 / Math.PI)
}

function formatAngle(rad: number): string {
  return `${radToDeg(rad).toFixed(1)}°`
}

export function InspectorPanel({ vrm, motion, time }: InspectorPanelProps) {
  const [expandedBone, setExpandedBone] = useState<VRMHumanBoneName | null>(null)

  if (!vrm) {
    return (
      <div className="panel">
        <div className="panel-header">Inspector</div>
        <div className="text-sm" style={{ color: '#888' }}>
          Load a VRM model to inspect bones
        </div>
      </div>
    )
  }

  const humanoid = vrm.humanoid
  if (!humanoid) {
    return (
      <div className="panel">
        <div className="panel-header">Inspector</div>
        <div className="text-sm" style={{ color: '#888' }}>
          No humanoid data found
        </div>
      </div>
    )
  }

  return (
    <div className="panel" style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">Inspector</div>

      {/* Motion info */}
      {motion && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.5rem',
            background: '#1a1a1a',
            borderRadius: '0.375rem',
          }}
        >
          <div className="text-sm" style={{ fontWeight: 500 }}>
            {motion.meta.name}
          </div>
          <div className="text-xs font-mono" style={{ color: '#888' }}>
            t = {time.toFixed(2)}s
          </div>
        </div>
      )}

      {/* Bone list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div className="text-xs" style={{ color: '#888', marginBottom: '0.5rem' }}>
          Bone Rotations (Euler XYZ)
        </div>
        {MAIN_BONES.map((boneName) => {
          const node = humanoid.getNormalizedBoneNode(boneName)
          if (!node) return null

          const euler = node.rotation
          const isExpanded = expandedBone === boneName

          return (
            <div
              key={boneName}
              className="hover-bg rounded"
              style={{
                padding: '0.375rem',
                marginBottom: '0.25rem',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedBone(isExpanded ? null : boneName)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm">{boneName}</span>
                <span className="text-xs font-mono" style={{ color: '#888' }}>
                  {formatAngle(euler.x)} {formatAngle(euler.y)} {formatAngle(euler.z)}
                </span>
              </div>
              {isExpanded && (
                <div
                  className="text-xs font-mono"
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    background: '#1a1a1a',
                    borderRadius: '0.25rem',
                  }}
                >
                  <div>X: {formatAngle(euler.x)} ({euler.x.toFixed(4)} rad)</div>
                  <div>Y: {formatAngle(euler.y)} ({euler.y.toFixed(4)} rad)</div>
                  <div>Z: {formatAngle(euler.z)} ({euler.z.toFixed(4)} rad)</div>
                  <div style={{ marginTop: '0.5rem', color: '#888' }}>
                    Pos: ({node.position.x.toFixed(3)}, {node.position.y.toFixed(3)}, {node.position.z.toFixed(3)})
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
