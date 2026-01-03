#!/usr/bin/env node

import { Command } from 'commander'
import { devCommand } from './commands/dev.js'
import { validateCommand } from './commands/validate.js'
import { motionNewCommand } from './commands/motion-new.js'

const program = new Command()

program
  .name('posers')
  .description('Posers CLI - Procedural motion engine for VRM humanoids')
  .version('0.1.0')

program.addCommand(devCommand)
program.addCommand(validateCommand)
program.addCommand(motionNewCommand)

program.parse()
