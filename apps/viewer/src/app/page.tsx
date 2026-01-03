'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { VRMDropZone } from '@/components/vrm-drop-zone'
import { MotionSelector } from '@/components/motion-selector'
import { TimelineControls } from '@/components/timeline-controls'
import { InspectorPanel } from '@/components/inspector-panel'
import { DebugControls } from '@/components/debug-controls'
import type { VRM } from '@pixiv/three-vrm'
import type { MotionProgram } from '@posers/core'
import { getMotion, getMotionIds, type MotionId } from '@posers/motion-dsl'
import { loadVRM } from '@posers/vrm-runtime'

// Dynamic import for Three.js components (client-only)
const VRMCanvas = dynamic(() => import('@/components/vrm-canvas').then(m => m.VRMCanvas), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full">Loading 3D viewer...</div>,
})

export default function ViewerPage() {
  const [vrm, setVrm] = useState<VRM | null>(null)
  const [currentModelName, setCurrentModelName] = useState<string | null>(null)
  const [selectedMotion, setSelectedMotion] = useState<MotionId | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [time, setTime] = useState(0)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [showAxes, setShowAxes] = useState(false)
  const [autoLoadAttempted, setAutoLoadAttempted] = useState(false)

  // Auto-load first model on mount
  useEffect(() => {
    if (autoLoadAttempted) return
    setAutoLoadAttempted(true)

    fetch('/api/models')
      .then(res => res.json())
      .then(async (data) => {
        const models = data.models || []
        if (models.length > 0) {
          const firstModel = models[0]
          try {
            const { vrm: loadedVrm } = await loadVRM(`/models/${firstModel}`)
            setVrm(loadedVrm)
            setCurrentModelName(firstModel)
            // Auto-select first motion
            const ids = getMotionIds()
            if (ids.length > 0) {
              setSelectedMotion(ids[0])
            }
          } catch (err) {
            console.error('Failed to auto-load model:', err)
          }
        }
      })
      .catch(() => {})
  }, [autoLoadAttempted])

  const handleVRMLoad = useCallback((loadedVrm: VRM, modelName?: string) => {
    setVrm(loadedVrm)
    setCurrentModelName(modelName || null)
    // Auto-select first motion
    const ids = getMotionIds()
    if (ids.length > 0 && !selectedMotion) {
      setSelectedMotion(ids[0])
    }
  }, [selectedMotion])

  const handleMotionSelect = useCallback((motionId: MotionId) => {
    setSelectedMotion(motionId)
    setTime(0)
  }, [])

  const currentMotion: MotionProgram | null = selectedMotion
    ? getMotion(selectedMotion)
    : null

  return (
    <div className="app-layout">
      {/* Left Sidebar */}
      <div className="sidebar">
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <div className="panel-header">VRM Model</div>
          <VRMDropZone
            onLoad={handleVRMLoad}
            hasModel={!!vrm}
            currentModel={currentModelName || undefined}
          />
        </div>

        <div className="panel">
          <div className="panel-header">Motions</div>
          <MotionSelector
            selectedId={selectedMotion}
            onSelect={handleMotionSelect}
          />
        </div>
      </div>

      {/* Main Canvas */}
      <div className="main-content">
        <VRMCanvas
          vrm={vrm}
          motion={currentMotion}
          isPlaying={isPlaying}
          speed={speed}
          onTimeUpdate={setTime}
          showSkeleton={showSkeleton}
          showAxes={showAxes}
        />

        {/* Debug overlay */}
        <div style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          zIndex: 10,
        }}>
          <DebugControls
            showSkeleton={showSkeleton}
            showAxes={showAxes}
            onToggleSkeleton={() => setShowSkeleton(!showSkeleton)}
            onToggleAxes={() => setShowAxes(!showAxes)}
          />
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="sidebar sidebar-right">
        <InspectorPanel
          vrm={vrm}
          motion={currentMotion}
          time={time}
        />
      </div>

      {/* Timeline */}
      <div className="timeline-bar">
        <TimelineControls
          isPlaying={isPlaying}
          speed={speed}
          time={time}
          onPlayPause={() => setIsPlaying(!isPlaying)}
          onSpeedChange={setSpeed}
          onSeek={setTime}
          onReset={() => setTime(0)}
        />
      </div>
    </div>
  )
}
