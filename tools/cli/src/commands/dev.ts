import { Command } from 'commander'
import { spawn } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const devCommand = new Command('dev')
  .description('Start the viewer in development mode')
  .option('-p, --port <port>', 'Port to run the viewer on', '3000')
  .action(async (options) => {
    console.log('🚀 Starting Posers development server...')
    console.log(`   Viewer will be available at http://localhost:${options.port}`)
    console.log('')

    // Find the workspace root
    const workspaceRoot = resolve(__dirname, '../../../../')

    // Start the viewer using turbo
    const child = spawn('pnpm', ['--filter', '@posers/viewer', 'dev'], {
      cwd: workspaceRoot,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        PORT: options.port,
      },
    })

    child.on('error', (err) => {
      console.error('Failed to start development server:', err)
      process.exit(1)
    })

    child.on('exit', (code) => {
      process.exit(code ?? 0)
    })

    // Handle termination
    process.on('SIGINT', () => {
      child.kill('SIGINT')
    })

    process.on('SIGTERM', () => {
      child.kill('SIGTERM')
    })
  })
