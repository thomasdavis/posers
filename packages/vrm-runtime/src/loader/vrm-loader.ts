import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRM } from '@pixiv/three-vrm'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface VRMLoadResult {
  vrm: VRM
  gltf: GLTF
}

export interface VRMLoadError {
  type: 'load_error' | 'no_vrm' | 'invalid_humanoid'
  message: string
}

/**
 * Load a VRM file from a URL or File.
 */
export async function loadVRM(source: string | File): Promise<VRMLoadResult> {
  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))

  let url: string
  let shouldRevoke = false

  if (source instanceof File) {
    url = URL.createObjectURL(source)
    shouldRevoke = true
  } else {
    url = source
  }

  try {
    const gltf = await loader.loadAsync(url)
    const vrm = gltf.userData.vrm as VRM | undefined

    if (!vrm) {
      throw createError('no_vrm', 'File does not contain VRM data')
    }

    // Rotate VRM to face forward (VRM models face +Z by default)
    vrm.scene.rotation.y = Math.PI

    return { vrm, gltf }
  } finally {
    if (shouldRevoke) {
      URL.revokeObjectURL(url)
    }
  }
}

/**
 * Load VRM from an ArrayBuffer.
 */
export async function loadVRMFromBuffer(buffer: ArrayBuffer, filename = 'model.vrm'): Promise<VRMLoadResult> {
  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  const file = new File([blob], filename)
  return loadVRM(file)
}

function createError(type: VRMLoadError['type'], message: string): VRMLoadError & Error {
  const error = new Error(message) as VRMLoadError & Error
  error.type = type
  return error
}
