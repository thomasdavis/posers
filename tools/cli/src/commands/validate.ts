import { Command } from 'commander'
import { spawn } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import {
  checkForbiddenImports,
  checkMotionInterface,
  checkDeterministic,
} from '@posers/blocks'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const validateCommand = new Command('validate')
  .description('Validate the project (lint, typecheck, tests, motion policies)')
  .option('--skip-typecheck', 'Skip TypeScript type checking')
  .option('--skip-lint', 'Skip linting')
  .option('--skip-test', 'Skip tests')
  .option('--skip-policies', 'Skip motion policy checks')
  .action(async (options) => {
    console.log('🔍 Validating Posers project...')
    console.log('')

    const workspaceRoot = resolve(__dirname, '../../../../')
    let hasErrors = false

    // Run lint
    if (!options.skipLint) {
      console.log('📝 Running lint...')
      const lintResult = await runCommand('pnpm', ['lint'], workspaceRoot)
      if (!lintResult) {
        hasErrors = true
        console.log('   ❌ Lint failed')
      } else {
        console.log('   ✓ Lint passed')
      }
      console.log('')
    }

    // Run typecheck
    if (!options.skipTypecheck) {
      console.log('🔤 Running typecheck...')
      const typecheckResult = await runCommand('pnpm', ['typecheck'], workspaceRoot)
      if (!typecheckResult) {
        hasErrors = true
        console.log('   ❌ Typecheck failed')
      } else {
        console.log('   ✓ Typecheck passed')
      }
      console.log('')
    }

    // Run tests
    if (!options.skipTest) {
      console.log('🧪 Running tests...')
      const testResult = await runCommand('pnpm', ['test'], workspaceRoot)
      if (!testResult) {
        hasErrors = true
        console.log('   ❌ Tests failed')
      } else {
        console.log('   ✓ Tests passed')
      }
      console.log('')
    }

    // Run motion policy checks
    if (!options.skipPolicies) {
      console.log('📋 Checking motion policies...')
      const policyResult = checkMotionPolicies(workspaceRoot)
      if (!policyResult) {
        hasErrors = true
        console.log('   ❌ Policy checks failed')
      } else {
        console.log('   ✓ Policy checks passed')
      }
      console.log('')
    }

    // Final result
    if (hasErrors) {
      console.log('❌ Validation failed')
      process.exit(1)
    } else {
      console.log('✅ Validation passed')
    }
  })

function runCommand(cmd: string, args: string[], cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
    })

    child.on('error', () => resolve(false))
    child.on('exit', (code) => resolve(code === 0))
  })
}

function checkMotionPolicies(workspaceRoot: string): boolean {
  const motionsDir = join(workspaceRoot, 'packages', 'motion-dsl', 'src', 'motions')

  try {
    const files = getMotionFiles(motionsDir)
    let allPassed = true

    for (const file of files) {
      if (file.endsWith('index.ts')) continue

      const content = readFileSync(file, 'utf-8')
      const relativePath = file.replace(workspaceRoot, '')

      // Check forbidden imports
      const importResult = checkForbiddenImports(content, relativePath)
      if (!importResult.valid) {
        allPassed = false
        for (const v of importResult.violations) {
          console.log(`   ❌ ${v.file}:${v.line} - ${v.message}`)
        }
      }

      // Check motion interface
      const interfaceResult = checkMotionInterface(content, relativePath)
      if (!interfaceResult.valid) {
        allPassed = false
        for (const v of interfaceResult.violations.filter(v => v.type === 'error')) {
          console.log(`   ❌ ${v.file} - ${v.message}`)
        }
      }

      // Check determinism
      const deterministicResult = checkDeterministic(content, relativePath)
      if (!deterministicResult.valid) {
        allPassed = false
        for (const v of deterministicResult.violations) {
          console.log(`   ❌ ${v.file}:${v.line} - ${v.message}`)
        }
      }
    }

    return allPassed
  } catch (err) {
    console.log(`   ⚠ Could not check motion policies: ${err}`)
    return true // Don't fail if motions dir doesn't exist yet
  }
}

function getMotionFiles(dir: string): string[] {
  const files: string[] = []

  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const path = join(dir, entry)
      const stat = statSync(path)
      if (stat.isFile() && entry.endsWith('.ts')) {
        files.push(path)
      }
    }
  } catch {
    // Directory may not exist
  }

  return files
}
