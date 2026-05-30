import { execFile, spawn } from 'child_process'
import type { ChildProcess, ExecFileOptions, SpawnOptions } from 'child_process'
import { existsSync } from 'fs'
import { basename, dirname, resolve, win32 } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

interface HermesInvocation {
  command: string
  args: string[]
}

interface HermesExecResult {
  stdout: string
  stderr: string
}

type ExecFileAsync = (
  command: string,
  args: readonly string[],
  options?: ExecFileOptions,
) => Promise<HermesExecResult | string | Buffer>

function bundledPythonForHermesExe(command: string): string | null {
  if (process.platform !== 'win32') return null
  const pathApi = command.includes('\\') ? win32 : { basename, dirname, resolve }
  if (pathApi.basename(command).toLowerCase() !== 'hermes.exe') return null

  const envPython = process.env.HERMES_AGENT_BRIDGE_PYTHON?.trim()
  if (envPython) return envPython

  const python = pathApi.resolve(pathApi.dirname(command), '..', 'python.exe')
  return existsSync(python) ? python : null
}

export function resolveHermesInvocation(command: string, args: readonly string[]): HermesInvocation {
  const python = bundledPythonForHermesExe(command)
  if (python) return { command: python, args: ['-m', 'hermes_cli.main', ...args] }
  return { command, args: [...args] }
}

export function execHermesFile(command: string, args: readonly string[], options?: ExecFileOptions) {
  const invocation = resolveHermesInvocation(command, args)
  return (execFileAsync as ExecFileAsync)(invocation.command, invocation.args, { ...options, encoding: 'utf8' })
    .then((result): HermesExecResult => {
      if (typeof result === 'string' || Buffer.isBuffer(result)) {
        return { stdout: result.toString(), stderr: '' }
      }
      return {
        stdout: result.stdout?.toString() || '',
        stderr: result.stderr?.toString() || '',
      }
    })
}

export function spawnHermesFile(command: string, args: readonly string[], options?: SpawnOptions): ChildProcess {
  const invocation = resolveHermesInvocation(command, args)
  return spawn(invocation.command, invocation.args, options || {})
}
