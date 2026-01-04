'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import * as THREE from 'three'
import { VRM } from '@pixiv/three-vrm'
import { loadVRM, VRMHumanoidRig } from '@posers/vrm-runtime'
import { getMotion, getMotionIds, MotionRunner, type MotionId } from '@posers/motion-dsl'

/**
 * Validation page for headless screenshot capture.
 *
 * URL: /validate/[motion]?t=0.5&skeleton=true
 *
 * Renders just the VRM model with the specified motion at time t,
 * optionally with skeleton overlay. No UI chrome.
 */
export default function ValidatePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const motionId = params.motion as string
  const time = parseFloat(searchParams.get('t') || '0')
  const showSkeleton = searchParams.get('skeleton') === 'true'

  useEffect(() => {
    if (!containerRef.current) return

    let mounted = true
    let renderer: THREE.WebGLRenderer | null = null

    async function init() {
      try {
        // Set up Three.js scene
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x1a1a2e)

        const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100)
        camera.position.set(0, 1.2, 3)
        camera.lookAt(0, 1, 0)

        renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setSize(window.innerWidth, window.innerHeight)
        renderer.setPixelRatio(window.devicePixelRatio)
        containerRef.current?.appendChild(renderer.domElement)

        // Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.6)
        scene.add(ambient)
        const directional = new THREE.DirectionalLight(0xffffff, 0.8)
        directional.position.set(2, 3, 2)
        scene.add(directional)

        // Load VRM model
        const { vrm } = await loadVRM('/models/Seed-san.vrm')
        if (!mounted) return
        // Ensure VRM faces forward (toward camera at +Z)
        vrm.scene.rotation.y = 0  // Face -Z direction (toward camera)
        scene.add(vrm.scene)

        // Get motion
        const motionIds = getMotionIds()
        const normalizedId = motionId.replace(/_/g, '-') as MotionId

        if (!motionIds.includes(normalizedId)) {
          throw new Error(`Motion not found: ${motionId}. Available: ${motionIds.join(', ')}`)
        }

        const motion = getMotion(normalizedId)
        const rig = new VRMHumanoidRig(vrm)

        console.log(`[Validate] Motion: ${normalizedId}, Time: ${time}`)
        console.log(`[Validate] Available bones:`, rig.getAvailableBones())

        // Use MotionRunner for proper motion execution
        const runner = new MotionRunner(rig)
        runner.setMotion(motion)

        // Advance to the target time with small steps for stability
        const dt = 0.016 // ~60fps
        const steps = Math.ceil(time / dt)
        console.log(`[Validate] Running ${steps} update steps`)

        for (let i = 0; i < steps; i++) {
          runner.update(dt)
          rig.update(dt)
        }

        // One final update
        runner.update(0)
        rig.update(dt)

        // Log a bone rotation to verify motion is applied
        const leftUpperArm = rig.getRotation('leftUpperArm')
        console.log(`[Validate] leftUpperArm quaternion:`, leftUpperArm)

        // CRITICAL: Final vrm.update to sync normalized bones to raw bones before render
        vrm.update(0)

        // Add skeleton helper if requested
        if (showSkeleton && vrm.scene) {
          const skeletonHelper = new THREE.SkeletonHelper(vrm.scene)
          scene.add(skeletonHelper)
        }

        // Render single frame
        renderer.render(scene, camera)

        if (mounted) {
          setStatus('ready')
        }

      } catch (err) {
        console.error('Validation page error:', err)
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setStatus('error')
        }
      }
    }

    init()

    return () => {
      mounted = false
      if (renderer) {
        renderer.dispose()
        containerRef.current?.removeChild(renderer.domElement)
      }
    }
  }, [motionId, time, showSkeleton])

  return (
    <div
      ref={containerRef}
      style={{ width: '100vw', height: '100vh', position: 'relative' }}
      data-status={status}
      data-motion={motionId}
      data-time={time}
    >
      {status === 'loading' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
        }}>
          Loading...
        </div>
      )}
      {status === 'error' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'red',
        }}>
          Error: {error}
        </div>
      )}
    </div>
  )
}
