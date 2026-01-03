import { Command } from 'commander'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const motionNewCommand = new Command('motion:new')
  .description('Create a new motion from template')
  .argument('<name>', 'Name of the motion (e.g., "wave-hand")')
  .option('-d, --description <desc>', 'Description of the motion')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .action(async (name, options) => {
    const workspaceRoot = resolve(__dirname, '../../../../')
    const motionsDir = join(workspaceRoot, 'packages', 'motion-dsl', 'src', 'motions')

    // Convert name to various formats
    const kebabName = name.toLowerCase().replace(/\s+/g, '-')
    const camelName = kebabName.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase())
    const pascalName = camelName.charAt(0).toUpperCase() + camelName.slice(1)

    const fileName = `${kebabName}.ts`
    const filePath = join(motionsDir, fileName)

    // Check if file already exists
    if (existsSync(filePath)) {
      console.error(`❌ Motion "${kebabName}" already exists at ${filePath}`)
      process.exit(1)
    }

    // Ensure directory exists
    if (!existsSync(motionsDir)) {
      mkdirSync(motionsDir, { recursive: true })
    }

    // Generate template
    const template = generateMotionTemplate({
      kebabName,
      camelName,
      pascalName,
      description: options.description || `${pascalName} motion`,
      tags: options.tags?.split(',').map((t: string) => t.trim()) || [],
    })

    // Write file
    writeFileSync(filePath, template)

    console.log(`✅ Created new motion: ${filePath}`)
    console.log('')
    console.log('Next steps:')
    console.log(`  1. Edit the update() function to implement your motion`)
    console.log(`  2. Add parameters to the params schema if needed`)
    console.log(`  3. Export from packages/motion-dsl/src/motions/index.ts`)
    console.log(`  4. Run 'posers validate' to check your motion`)
  })

interface TemplateOptions {
  kebabName: string
  camelName: string
  pascalName: string
  description: string
  tags: string[]
}

function generateMotionTemplate(opts: TemplateOptions): string {
  const tagsStr = opts.tags.length > 0
    ? `['${opts.tags.join("', '")}']`
    : '[]'

  return `import { Quaternion } from 'three'
import { z } from 'zod'
import type { MotionProgram, MotionMeta, HumanoidRig, MotionContext } from '@posers/core'
import { osc, quatFromAxisAngle } from '@posers/core'

/**
 * Parameters for the ${opts.pascalName} motion.
 */
export const ${opts.camelName}ParamsSchema = z.object({
  /** Animation speed multiplier. Default: 1.0 */
  speed: z.number().min(0.1).max(3).default(1.0),
  /** Animation intensity (0-1). Default: 1.0 */
  intensity: z.number().min(0).max(1).default(1.0),
})

export type ${opts.pascalName}Params = z.infer<typeof ${opts.camelName}ParamsSchema>

/**
 * Metadata for the ${opts.pascalName} motion.
 */
export const ${opts.camelName}Meta: MotionMeta = {
  id: '${opts.kebabName}',
  name: '${opts.pascalName}',
  description: '${opts.description}',
  tags: ${tagsStr},
  author: 'posers',
}

/**
 * Create the ${opts.pascalName} motion.
 */
export function create${opts.pascalName}(params: ${opts.pascalName}Params): MotionProgram<${opts.pascalName}Params> {
  const validatedParams = ${opts.camelName}ParamsSchema.parse(params)

  return {
    meta: ${opts.camelName}Meta,
    paramsSchema: ${opts.camelName}ParamsSchema,

    update(rig: HumanoidRig, ctx: MotionContext, t: number, dt: number): void {
      const { speed, intensity } = validatedParams

      // TODO: Implement motion logic here
      // Example: Rotate the right arm
      // const angle = osc(t, 0.5 * speed, 0, 0.3 * intensity)
      // if (rig.hasBone('rightUpperArm')) {
      //   const rot = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, angle)
      //   rig.setRotation('rightUpperArm', rot)
      // }
    },
  }
}

/**
 * Default ${opts.pascalName} motion with default parameters.
 */
export const ${opts.camelName}: MotionProgram<${opts.pascalName}Params> = create${opts.pascalName}({})
`
}
