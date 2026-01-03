import { NextResponse } from 'next/server'
import { readdir } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    const modelsDir = join(process.cwd(), 'public', 'models')
    const files = await readdir(modelsDir)
    const vrmFiles = files.filter(f => f.endsWith('.vrm'))

    return NextResponse.json({ models: vrmFiles })
  } catch {
    // Directory doesn't exist or can't be read
    return NextResponse.json({ models: [] })
  }
}
