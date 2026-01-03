'use client'

import { useState, useMemo } from 'react'
import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'
import type { MotionProgram, VRMHumanBoneName } from '@posers/core'

interface InspectorPanelProps {
  vrm: VRM | null
  motion: MotionProgram | null
  time: number
}

// All VRM humanoid bones organized by category
const BONE_CATEGORIES: Record<string, VRMHumanBoneName[]> = {
  'Core (Spine)': [
    'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  ],
  'Left Arm': [
    'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  ],
  'Right Arm': [
    'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  ],
  'Left Leg': [
    'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
  ],
  'Right Leg': [
    'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
  ],
  'Left Hand Fingers': [
    'leftThumbMetacarpal', 'leftThumbProximal', 'leftThumbDistal',
    'leftIndexProximal', 'leftIndexIntermediate', 'leftIndexDistal',
    'leftMiddleProximal', 'leftMiddleIntermediate', 'leftMiddleDistal',
    'leftRingProximal', 'leftRingIntermediate', 'leftRingDistal',
    'leftLittleProximal', 'leftLittleIntermediate', 'leftLittleDistal',
  ],
  'Right Hand Fingers': [
    'rightThumbMetacarpal', 'rightThumbProximal', 'rightThumbDistal',
    'rightIndexProximal', 'rightIndexIntermediate', 'rightIndexDistal',
    'rightMiddleProximal', 'rightMiddleIntermediate', 'rightMiddleDistal',
    'rightRingProximal', 'rightRingIntermediate', 'rightRingDistal',
    'rightLittleProximal', 'rightLittleIntermediate', 'rightLittleDistal',
  ],
  'Face': [
    'leftEye', 'rightEye', 'jaw',
  ],
}

function radToDeg(rad: number): number {
  return rad * (180 / Math.PI)
}

function formatAngle(rad: number): string {
  return `${radToDeg(rad).toFixed(1)}°`
}

function formatQuat(q: { x: number; y: number; z: number; w: number }): string {
  return `(${q.x.toFixed(3)}, ${q.y.toFixed(3)}, ${q.z.toFixed(3)}, ${q.w.toFixed(3)})`
}

type TabType = 'bones' | 'meta' | 'expressions' | 'materials'

export function InspectorPanel({ vrm, motion, time }: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('bones')
  const [expandedBone, setExpandedBone] = useState<VRMHumanBoneName | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Core (Spine)')

  // Calculate bone statistics
  const boneStats = useMemo(() => {
    if (!vrm?.humanoid) return { total: 0, available: 0, missing: [] as string[] }

    const allBones = Object.values(BONE_CATEGORIES).flat()
    const available: string[] = []
    const missing: string[] = []

    allBones.forEach((bone) => {
      const node = vrm.humanoid?.getNormalizedBoneNode(bone)
      if (node) {
        available.push(bone)
      } else {
        missing.push(bone)
      }
    })

    return { total: allBones.length, available: available.length, missing }
  }, [vrm])

  if (!vrm) {
    return (
      <div className="panel">
        <div className="panel-header">Inspector</div>
        <div className="text-sm" style={{ color: '#888' }}>
          Load a VRM model to inspect rig properties
        </div>
      </div>
    )
  }

  const humanoid = vrm.humanoid
  const meta = vrm.meta

  // Tab buttons
  const tabs: { id: TabType; label: string }[] = [
    { id: 'bones', label: 'Bones' },
    { id: 'meta', label: 'Meta' },
    { id: 'expressions', label: 'Expr' },
    { id: 'materials', label: 'Mat' },
  ]

  return (
    <div className="panel" style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">Inspector</div>

      {/* Motion info */}
      {motion && (
        <div
          style={{
            marginBottom: '0.75rem',
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

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: '0.25rem',
          marginBottom: '0.75rem',
          borderBottom: '1px solid #333',
          paddingBottom: '0.5rem',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              background: activeTab === tab.id ? '#3b82f6' : 'transparent',
              border: 'none',
              borderRadius: '0.25rem',
              color: activeTab === tab.id ? 'white' : '#888',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'bones' && humanoid && (
          <>
            {/* Bone stats */}
            <div
              style={{
                padding: '0.5rem',
                background: '#1a1a1a',
                borderRadius: '0.375rem',
                marginBottom: '0.75rem',
              }}
            >
              <div className="text-xs" style={{ color: '#888' }}>
                Skeleton: {boneStats.available}/{boneStats.total} bones available
              </div>
              {boneStats.missing.length > 0 && (
                <div className="text-xs" style={{ color: '#f59e0b', marginTop: '0.25rem' }}>
                  Missing: {boneStats.missing.slice(0, 5).join(', ')}
                  {boneStats.missing.length > 5 && ` +${boneStats.missing.length - 5} more`}
                </div>
              )}
            </div>

            {/* Bone categories */}
            {Object.entries(BONE_CATEGORIES).map(([category, bones]) => {
              const isExpanded = expandedCategory === category
              const availableInCategory = bones.filter(
                (b) => humanoid.getNormalizedBoneNode(b)
              ).length

              return (
                <div key={category} style={{ marginBottom: '0.5rem' }}>
                  <div
                    className="hover-bg rounded"
                    style={{
                      padding: '0.5rem',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onClick={() => setExpandedCategory(isExpanded ? null : category)}
                  >
                    <span className="text-sm" style={{ fontWeight: 500 }}>
                      {isExpanded ? '▼' : '▶'} {category}
                    </span>
                    <span className="text-xs" style={{ color: '#888' }}>
                      {availableInCategory}/{bones.length}
                    </span>
                  </div>

                  {isExpanded && (
                    <div style={{ paddingLeft: '1rem' }}>
                      {bones.map((boneName) => {
                        const node = humanoid.getNormalizedBoneNode(boneName)
                        if (!node) {
                          return (
                            <div
                              key={boneName}
                              className="text-xs"
                              style={{
                                padding: '0.25rem',
                                color: '#666',
                                fontStyle: 'italic',
                              }}
                            >
                              {boneName} (missing)
                            </div>
                          )
                        }

                        const euler = node.rotation
                        const quat = node.quaternion
                        const pos = node.position
                        const scale = node.scale
                        const isBoneExpanded = expandedBone === boneName

                        return (
                          <div
                            key={boneName}
                            className="hover-bg rounded"
                            style={{
                              padding: '0.375rem',
                              marginBottom: '0.125rem',
                              cursor: 'pointer',
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedBone(isBoneExpanded ? null : boneName)
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs">{boneName}</span>
                              <span
                                className="text-xs font-mono"
                                style={{ color: '#888', fontSize: '0.65rem' }}
                              >
                                {formatAngle(euler.x)} {formatAngle(euler.y)} {formatAngle(euler.z)}
                              </span>
                            </div>

                            {isBoneExpanded && (
                              <div
                                className="text-xs font-mono"
                                style={{
                                  marginTop: '0.5rem',
                                  padding: '0.5rem',
                                  background: '#0a0a0a',
                                  borderRadius: '0.25rem',
                                  fontSize: '0.65rem',
                                }}
                              >
                                <div style={{ marginBottom: '0.5rem' }}>
                                  <div style={{ color: '#888' }}>Euler (XYZ):</div>
                                  <div>X: {formatAngle(euler.x)} ({euler.x.toFixed(4)} rad)</div>
                                  <div>Y: {formatAngle(euler.y)} ({euler.y.toFixed(4)} rad)</div>
                                  <div>Z: {formatAngle(euler.z)} ({euler.z.toFixed(4)} rad)</div>
                                </div>
                                <div style={{ marginBottom: '0.5rem' }}>
                                  <div style={{ color: '#888' }}>Quaternion (XYZW):</div>
                                  <div>{formatQuat(quat)}</div>
                                </div>
                                <div style={{ marginBottom: '0.5rem' }}>
                                  <div style={{ color: '#888' }}>Position:</div>
                                  <div>({pos.x.toFixed(4)}, {pos.y.toFixed(4)}, {pos.z.toFixed(4)})</div>
                                </div>
                                <div>
                                  <div style={{ color: '#888' }}>Scale:</div>
                                  <div>({scale.x.toFixed(3)}, {scale.y.toFixed(3)}, {scale.z.toFixed(3)})</div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {activeTab === 'meta' && meta && (
          <div style={{ fontSize: '0.75rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <div className="text-xs" style={{ color: '#888', marginBottom: '0.25rem' }}>
                Model Info
              </div>
              <div style={{ padding: '0.5rem', background: '#1a1a1a', borderRadius: '0.375rem' }}>
                <div><span style={{ color: '#888' }}>Name:</span> {meta.name || 'Unknown'}</div>
                <div><span style={{ color: '#888' }}>Version:</span> {meta.version || 'Unknown'}</div>
                {meta.authors && meta.authors.length > 0 && (
                  <div><span style={{ color: '#888' }}>Authors:</span> {meta.authors.join(', ')}</div>
                )}
                {meta.copyrightInformation && (
                  <div><span style={{ color: '#888' }}>Copyright:</span> {meta.copyrightInformation}</div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div className="text-xs" style={{ color: '#888', marginBottom: '0.25rem' }}>
                License
              </div>
              <div style={{ padding: '0.5rem', background: '#1a1a1a', borderRadius: '0.375rem' }}>
                <div><span style={{ color: '#888' }}>License:</span> {meta.licenseName || 'Not specified'}</div>
                {meta.allowExcessivelyViolentUsage !== undefined && (
                  <div>
                    <span style={{ color: '#888' }}>Violence:</span>{' '}
                    {meta.allowExcessivelyViolentUsage ? '✓ Allowed' : '✗ Not allowed'}
                  </div>
                )}
                {meta.allowExcessivelySexualUsage !== undefined && (
                  <div>
                    <span style={{ color: '#888' }}>Sexual:</span>{' '}
                    {meta.allowExcessivelySexualUsage ? '✓ Allowed' : '✗ Not allowed'}
                  </div>
                )}
                {meta.commercialUsage && (
                  <div><span style={{ color: '#888' }}>Commercial:</span> {meta.commercialUsage}</div>
                )}
                {meta.allowRedistribution !== undefined && (
                  <div>
                    <span style={{ color: '#888' }}>Redistribution:</span>{' '}
                    {meta.allowRedistribution ? '✓ Allowed' : '✗ Not allowed'}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs" style={{ color: '#888', marginBottom: '0.25rem' }}>
                Scene Info
              </div>
              <div style={{ padding: '0.5rem', background: '#1a1a1a', borderRadius: '0.375rem' }}>
                <div>
                  <span style={{ color: '#888' }}>VRM Scene:</span>{' '}
                  {vrm.scene ? `${vrm.scene.children.length} children` : 'None'}
                </div>
                {vrm.scene && (
                  <div>
                    <span style={{ color: '#888' }}>Meshes:</span>{' '}
                    {countMeshes(vrm.scene)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'expressions' && (
          <div style={{ fontSize: '0.75rem' }}>
            <div className="text-xs" style={{ color: '#888', marginBottom: '0.5rem' }}>
              Blend Shapes / Expressions
            </div>
            {vrm.expressionManager ? (
              <div>
                {vrm.expressionManager.expressions.map((expr, i) => (
                  <div
                    key={i}
                    className="hover-bg rounded"
                    style={{
                      padding: '0.375rem',
                      marginBottom: '0.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{expr.expressionName}</span>
                    <span className="font-mono" style={{ color: '#888' }}>
                      {(expr.weight * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#666' }}>No expressions available</div>
            )}
          </div>
        )}

        {activeTab === 'materials' && (
          <div style={{ fontSize: '0.75rem' }}>
            <div className="text-xs" style={{ color: '#888', marginBottom: '0.5rem' }}>
              Materials
            </div>
            {vrm.materials && vrm.materials.length > 0 ? (
              <div>
                {vrm.materials.map((mat, i) => (
                  <div
                    key={i}
                    className="hover-bg rounded"
                    style={{
                      padding: '0.375rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <div>{mat.name || `Material ${i}`}</div>
                    <div className="text-xs" style={{ color: '#888' }}>
                      Type: {mat.type}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#666' }}>No materials found</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Helper to count meshes in scene
function countMeshes(obj: THREE.Object3D): number {
  let count = 0
  obj.traverse((child: THREE.Object3D) => {
    if ('isMesh' in child && child.isMesh) count++
  })
  return count
}
