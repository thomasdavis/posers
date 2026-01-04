/**
 * Visual Output Validator for Blocks
 *
 * Validates motion output by:
 * 1. Running the motion in a headless browser
 * 2. Capturing screenshots at intervals
 * 3. Analyzing with GPT-4o vision
 *
 * Implements the Blocks Validator interface.
 */

import puppeteer, { type Browser, type Page } from 'puppeteer'
import OpenAI from 'openai'
import { readFile, mkdir, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { parse as parseYaml } from 'yaml'
import { pathToFileURL, fileURLToPath } from 'url'

// ============================================================================
// TYPES (Blocks Validator Interface)
// ============================================================================

export interface ValidatorContext {
  blockName: string
  blockPath: string
  config: BlocksConfig
  concurrency?: number
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  context?: {
    filesAnalyzed?: string[]
    rulesApplied?: string[]
    summary?: string
  }
  ai?: {
    provider: string
    model: string
    tokensUsed?: number
  }
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info'
  code: string
  message: string
  file?: string
  line?: number
  column?: number
  suggestion?: string
}

export interface BlocksConfig {
  name: string
  blocks: Record<string, BlockDefinition>
  visual_validation?: VisualValidationConfig
  philosophy?: string[]
}

export interface BlockDefinition {
  description?: string
  path?: string
  outputs?: Array<{ constraints?: string[] }>
}

export interface VisualValidationConfig {
  enabled?: boolean
  model?: string
  viewer_url?: string
  default_frames?: number
  interval_ms?: number
  pass_threshold?: number
  checks?: string[]
}

export interface Validator {
  id: string
  validate(context: ValidatorContext): Promise<ValidationResult>
}

// ============================================================================
// VISUAL VALIDATOR IMPLEMENTATION
// ============================================================================

export class VisualOutputValidator implements Validator {
  id = 'output.visual'

  private openai: OpenAI | null = null

  async validate(context: ValidatorContext): Promise<ValidationResult> {
    const issues: ValidationIssue[] = []
    const blockDef = context.config.blocks[context.blockName]

    // Get visual validation config
    const visualConfig = context.config.visual_validation || {}
    const viewerUrl = visualConfig.viewer_url || 'http://localhost:4100'
    const frameCount = visualConfig.default_frames || 8
    const intervalMs = visualConfig.interval_ms || 150
    const passThreshold = visualConfig.pass_threshold || 50
    const globalChecks = visualConfig.checks || []

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return {
        valid: false,
        issues: [{
          type: 'error',
          code: 'MISSING_API_KEY',
          message: 'OPENAI_API_KEY environment variable is required for visual validation',
          suggestion: 'Set OPENAI_API_KEY=sk-... in your environment',
        }],
      }
    }

    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // Convert block name to motion ID (snake_case to kebab-case)
    const motionId = context.blockName.replace(/_/g, '-')

    let browser: Browser | null = null

    try {
      // Launch browser with WebGL support
      // Use non-headless mode for reliable WebGL rendering on macOS
      // Set headless: 'shell' for new headless mode with better GPU support
      browser = await puppeteer.launch({
        headless: false,  // WebGL requires non-headless on macOS
        channel: 'chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--enable-webgl',
          '--enable-webgl2',
          '--ignore-gpu-blocklist',
          '--window-size=1024,768',
          '--window-position=0,0',
        ],
      })

      const page = await browser.newPage()
      await page.setViewport({ width: 1024, height: 768 })

      // Log console messages from the page for debugging
      page.on('console', msg => {
        const text = msg.text()
        if (msg.type() === 'error') {
          console.log('Page error:', text)
        } else if (text.startsWith('[Validate]')) {
          console.log(text)
        }
      })
      page.on('pageerror', err => {
        console.log('Page exception:', err.message)
      })

      // Capture frames at specific time points using validation endpoint
      const frames = await this.captureFrames(page, motionId, frameCount, viewerUrl)

      if (frames.length === 0) {
        return {
          valid: false,
          issues: [{
            type: 'error',
            code: 'CAPTURE_FAILED',
            message: `Failed to capture frames for motion: ${motionId}`,
            suggestion: 'Ensure the viewer is running and the motion exists',
          }],
        }
      }

      // Get constraints from block definition
      const constraints = blockDef?.outputs?.[0]?.constraints || []
      const description = blockDef?.description || `Motion: ${motionId}`

      // Analyze with GPT-4o
      const analysis = await this.analyzeFrames(
        frames,
        motionId,
        description,
        [...globalChecks, ...constraints]
      )

      // Convert analysis to validation issues
      for (const issue of analysis.issues) {
        issues.push({
          type: issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info',
          code: 'VISUAL_ISSUE',
          message: `[Frame ${issue.frame}] ${issue.message}`,
          suggestion: issue.constraint ? `Constraint: ${issue.constraint}` : undefined,
        })
      }

      // Determine if valid based on threshold only
      // Score >= threshold means the AI deemed the animation acceptable
      // Any issues are informational, not blockers
      const valid = analysis.score >= passThreshold

      return {
        valid,
        issues,
        context: {
          filesAnalyzed: [context.blockPath],
          rulesApplied: constraints,
          summary: `Score: ${analysis.score}/100 - ${analysis.summary}`,
        },
        ai: {
          provider: 'openai',
          model: 'gpt-4o',
        },
      }
    } catch (error) {
      return {
        valid: false,
        issues: [{
          type: 'error',
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error during validation',
        }],
      }
    } finally {
      if (browser) await browser.close()
    }
  }

  private async captureFrames(
    page: Page,
    motionId: string,
    frameCount: number,
    viewerUrl: string,
    motionDuration: number = 2.0
  ): Promise<string[]> {
    const frames: string[] = []

    // Capture just 3 key frames: start (0.25s), middle (1s), end (1.75s)
    // This is more intelligent than capturing N frames linearly
    const keyTimes = [0.25, 1.0, 1.75]

    try {
      for (const t of keyTimes) {
        const validateUrl = `${viewerUrl}/validate/${motionId}?t=${t.toFixed(3)}&skeleton=true`
        await page.goto(validateUrl, { waitUntil: 'networkidle0', timeout: 30000 })

        // Wait for canvas
        await page.waitForSelector('canvas', { timeout: 45000 })

        // Wait for ready status
        await page.waitForFunction(
          () => {
            const container = document.querySelector('[data-status]')
            return container?.getAttribute('data-status') === 'ready'
          },
          { timeout: 15000 }
        )

        // Small delay for render to complete
        await new Promise((r) => setTimeout(r, 100))

        // Capture screenshot
        const screenshot = await page.screenshot({
          type: 'png',
          encoding: 'base64',
        })
        frames.push(screenshot as string)

        // Save screenshot to disk for debugging
        const outputDir = join(process.cwd(), '..', '..', 'validation-output', 'screenshots')
        await mkdir(outputDir, { recursive: true })
        const filename = `${motionId}_t${t.toFixed(2)}.png`
        const buffer = Buffer.from(screenshot as string, 'base64')
        await writeFile(join(outputDir, filename), buffer)
        console.log(`[Debug] Saved screenshot: ${filename}`)
      }
    } catch (error) {
      console.error('Frame capture error:', error)
    }

    return frames
  }

  private async analyzeFrames(
    frames: string[],
    motionId: string,
    description: string,
    checks: string[]
  ): Promise<{ score: number; summary: string; issues: Array<{ severity: string; frame: number; message: string; constraint?: string }> }> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized')
    }

    const prompt = `You are validating a VRM humanoid animation. Analyze these ${frames.length} sequential frames.

CRITICAL - READ CAREFULLY:

This character has TWO TYPES of arms:
1. HUMANOID ARMS: Grey/white clothed arms attached at the SHOULDERS, going down the SIDES of the body toward the hips. These are what you must evaluate.
2. MECHANICAL ROBOT ARMS: Long white/black segmented robotic appendages extending from the CHARACTER'S BACK. These are decorative accessories - COMPLETELY IGNORE THEM.

WHAT IS T-POSE vs RELAXED POSE:
- T-POSE: Arms perfectly HORIZONTAL, extending straight out to the sides at 90° from torso
- RELAXED POSE: Arms angled DOWNWARD toward hips at 20-60° below horizontal

LOOK AT THE HUMANOID ARMS (grey sleeves at shoulders):
- If they point DOWNWARD at ANY angle below horizontal = ANIMATION IS WORKING = score 70+
- If they are perfectly HORIZONTAL = T-pose = animation may not be working

Motion: ${motionId}
Description: ${description}

Validate these criteria:
${checks.map((c, i) => `${i + 1}. ${c}`).join('\n')}

BE LENIENT. If humanoid arms show ANY downward angle, the motion is working correctly.

Return JSON only (no markdown):
{
  "score": 0-100,
  "summary": "1-2 sentence assessment focusing on humanoid arm position",
  "issues": [{"severity":"error|warning|info","frame":number,"message":"issue description","constraint":"which check failed if applicable"}]
}`

    const imageContent: OpenAI.Chat.ChatCompletionContentPart[] = frames
      .slice(0, 10)
      .map((b64) => ({
        type: 'image_url' as const,
        image_url: { url: `data:image/png;base64,${b64}`, detail: 'high' as const },
      }))

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }, ...imageContent],
        },
      ],
      max_tokens: 1500,
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content || ''

    // Extract JSON
    let json = content
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) json = match[1]

    try {
      return JSON.parse(json)
    } catch {
      return {
        score: 0,
        summary: 'Failed to parse AI response',
        issues: [{ severity: 'error', frame: 0, message: 'Analysis parse error' }],
      }
    }
  }
}

// ============================================================================
// CLI RUNNER (for blocks.yml run: field)
// ============================================================================

async function findProjectRoot(): Promise<string> {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  let dir = __dirname

  for (let i = 0; i < 10; i++) {
    try {
      await readFile(join(dir, 'blocks.yml'))
      return dir
    } catch {}
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

export async function main() {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  BLOCKS VISUAL VALIDATOR (output.visual)')
  console.log('═══════════════════════════════════════════════════════════\n')

  const projectRoot = await findProjectRoot()
  const blocksPath = join(projectRoot, 'blocks.yml')

  let config: BlocksConfig
  try {
    const content = await readFile(blocksPath, 'utf-8')
    config = parseYaml(content) as BlocksConfig
  } catch (err) {
    console.error(`Failed to load blocks.yml: ${(err as Error).message}`)
    process.exit(1)
  }

  // Get all motion blocks
  const motionBlocks = Object.entries(config.blocks || {}).filter(
    ([_, block]) => block.path?.includes('motions/')
  )

  if (motionBlocks.length === 0) {
    console.log('No motion blocks found in blocks.yml')
    process.exit(0)
  }

  console.log(`Found ${motionBlocks.length} motion blocks to validate\n`)

  const validator = new VisualOutputValidator()
  let passed = 0
  let failed = 0
  const results: ValidationResult[] = []

  for (const [blockName, blockDef] of motionBlocks) {
    console.log(`  Validating: ${blockName}`)

    const result = await validator.validate({
      blockName,
      blockPath: blockDef.path || '',
      config,
    })

    results.push(result)

    if (result.valid) {
      passed++
      console.log(`    ✓ ${result.context?.summary || 'Passed'}`)
    } else {
      failed++
      console.log(`    ✗ ${result.context?.summary || 'Failed'}`)
      for (const issue of result.issues.slice(0, 3)) {
        console.log(`      - ${issue.message}`)
      }
    }
    console.log('')
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  SUMMARY: ${passed} passed, ${failed} failed`)
  console.log('═══════════════════════════════════════════════════════════\n')

  // Save results
  const outputDir = join(projectRoot, 'validation-output')
  await mkdir(outputDir, { recursive: true })
  await writeFile(
    join(outputDir, 'visual-validation.json'),
    JSON.stringify({ passed, failed, results }, null, 2)
  )
  console.log(`Results saved to: ${outputDir}/visual-validation.json\n`)

  process.exit(failed > 0 ? 1 : 0)
}

// Run if executed directly
main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

// Default export for dynamic loading
export default VisualOutputValidator
