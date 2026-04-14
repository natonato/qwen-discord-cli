import { AISession, AISessionOptions, AISendResult } from './ai-session';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export class GeminiSession extends AISession {
  constructor(options: AISessionOptions) {
    super(options);
  }

  async start(): Promise<void> {
    // Ensure dedicated working directory exists for isolated Gemini sessions
    if (this.options.workingDir === process.cwd()) {
      // If no custom working dir, use a dedicated dir for ai-discord
      const dedicatedDir = path.join(os.homedir(), '.ai-discord-gemini');
      if (!fs.existsSync(dedicatedDir)) {
        fs.mkdirSync(dedicatedDir, { recursive: true });
        console.log(`[GeminiSession] Created dedicated session directory: ${dedicatedDir}`);
      }
      // Note: We can't change cwd of spawned process from here,
      // so we store the dedicated dir path and use it in spawn
      (this as any)._dedicatedDir = dedicatedDir;
    } else {
      (this as any)._dedicatedDir = this.options.workingDir;
    }
    console.log(`[GeminiSession] Session initialized`);
    this.isRunning = true;
  }

  async send(message: string): Promise<AISendResult> {
    return new Promise((resolve) => {
      const { spawn } = require('child_process');

      // Build args for Gemini headless mode
      const args = this.buildArgs();

      // Use -p flag for headless prompt (not stdin)
      args.push('-p', message);

      const isWindows = process.platform === 'win32';
      let command: string;
      let finalArgs: string[];

      // Use dedicated directory for isolated sessions
      const effectiveCwd = (this as any)._dedicatedDir || this.options.workingDir;

      if (isWindows) {
        command = 'cmd.exe';
        finalArgs = ['/c', 'gemini', ...args];
      } else {
        command = 'gemini';
        finalArgs = args;
      }

      if (this.options.debug) {
        console.log(`[GeminiSession] Running: ${command} ${finalArgs.join(' ')}`);
        console.log(`[GeminiSession] Working directory: ${effectiveCwd}`);
      }

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const proc = spawn(command, finalArgs, {
        cwd: effectiveCwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      // Set timeout (use configured value or default 5 minutes)
      const timeoutMs = this.options.timeoutMs || 300000;
      const timeout = setTimeout(() => {
        timedOut = true;
        proc.kill();
        console.error(`[GeminiSession] Process timed out after ${timeoutMs / 1000}s`);
        resolve({ response: '', error: `Request timed out (${timeoutMs / 1000}s limit)` });
      }, timeoutMs);

      proc.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        if (this.options.debug) {
          console.log(`[GeminiSession] stdout (${chunk.length} bytes): ${chunk.substring(0, 100)}...`);
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        if (this.options.debug) {
          console.log(`[GeminiSession] stderr: ${chunk.substring(0, 200)}`);
        }
      });

      proc.on('error', (error: Error) => {
        clearTimeout(timeout);
        if (!timedOut) {
          console.error(`[GeminiSession] Process error: ${error.message}`);
          resolve({ response: '', error: error.message });
        }
      });

      proc.on('exit', (code: number | null) => {
        clearTimeout(timeout);

        if (timedOut) return;

        if (this.options.debug) {
          console.log(`[GeminiSession] Exit code: ${code}`);
          console.log(`[GeminiSession] Full stdout (${stdout.length} chars): ${stdout.substring(0, 200)}`);
          if (stderr.trim()) {
            console.log(`[GeminiSession] Full stderr (${stderr.length} chars): ${stderr.substring(0, 200)}`);
          }
        }

        const response = stdout.trim();
        const error = code !== 0 && stderr.trim() ? stderr.trim() : null;

        resolve({ response, error });
      });
    });
  }

  clear(): void {
    try {
      const effectiveCwd = (this as any)._dedicatedDir || this.options.workingDir;
      const geminiDir = path.join(os.homedir(), '.gemini', 'tmp');

      if (!fs.existsSync(geminiDir)) {
        console.log(`[GeminiSession] No Gemini tmp directory found`);
        return;
      }

      // Find the project folder matching the working directory hash
      const projectFolders = fs.readdirSync(geminiDir);
      let targetPath: string | null = null;

      for (const folder of projectFolders) {
        const fullPath = path.join(geminiDir, folder);
        const chatsPath = path.join(fullPath, 'chats');

        if (fs.existsSync(chatsPath)) {
          // Check if this directory matches our effectiveCwd by comparing contents
          // Since we can't reverse the hash, we'll clear all if no specific match
          // For dedicated dir, we know it's the one we want
          if (effectiveCwd.includes('.ai-discord-gemini')) {
            // The hash is based on cwd, so the dedicated dir will have its own hash
            targetPath = chatsPath;
            break;
          }
        }
      }

      if (!targetPath) {
        console.log(`[GeminiSession] No session files found for current project`);
        return;
      }

      this.clearSessionFiles(targetPath);
    } catch (err) {
      console.error(`[GeminiSession] Error clearing session: ${err}`);
    }
  }

  kill(): void {
    this.isRunning = false;
    console.log(`[GeminiSession] Session closed`);
  }

  get commandName(): string {
    return 'gemini';
  }

  protected buildArgs(): string[] {
    const args: string[] = [];

    // Use --yolo for auto-approve in headless mode
    if (this.options.approvalMode === 'yolo') {
      args.push('--yolo');
    }

    // Resume the latest session within the dedicated working directory
    args.push('--resume', 'latest');

    return args;
  }
}
