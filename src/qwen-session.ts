import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface QwenSessionOptions {
  workingDir: string;
  approvalMode: 'yolo' | 'auto_edit' | 'default';
  debug?: boolean;
}

export class QwenSession {
  private isRunning = false;

  constructor(private options: QwenSessionOptions) {}

  /**
   * Start session (warm up - no persistent process needed)
   */
  async start(): Promise<void> {
    console.log(`[QwenSession] Session initialized`);
    this.isRunning = true;
  }

  /**
   * Send a message to Qwen and get response
   */
  async send(message: string): Promise<{ response: string; error: string | null }> {
    return new Promise((resolve) => {
      const args = [
        '--approval-mode', this.options.approvalMode,
        '--continue',
        '--output-format', 'text',
      ];

      let stdout = '';
      let stderr = '';

      // On Windows, spawn via cmd.exe to handle .cmd files properly
      const isWindows = process.platform === 'win32';
      let command: string;
      let finalArgs: string[];

      if (isWindows) {
        command = 'cmd.exe';
        finalArgs = ['/c', 'qwen', ...args];
      } else {
        command = 'qwen';
        finalArgs = args;
      }

      if (this.options.debug) {
        console.log(`[QwenSession] Running: ${command} ${finalArgs.join(' ')}`);
      }

      const proc = spawn(command, finalArgs, {
        cwd: this.options.workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      // Send message via stdin
      proc.stdin?.write(message + '\n');
      proc.stdin?.end();

      proc.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        if (this.options.debug) {
          console.log(`[QwenSession] stdout chunk: ${chunk.substring(0, 100)}...`);
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        if (this.options.debug) {
          console.log(`[QwenSession] stderr chunk: ${chunk.substring(0, 100)}`);
        }
      });

      proc.on('error', (error: Error) => {
        console.error(`[QwenSession] Process error: ${error.message}`);
        resolve({ response: '', error: error.message });
      });

      proc.on('exit', (code: number | null) => {
        if (this.options.debug) {
          console.log(`[QwenSession] Process exited with code ${code}`);
        }

        const response = stdout.trim();
        const error = code !== 0 && stderr.trim() ? stderr.trim() : null;

        if (this.options.debug) {
          console.log(`[QwenSession] Response (${response.length} chars): ${response.substring(0, 100)}...`);
        }

        resolve({ response, error });
      });
    });
  }

  /**
   * Clear session data and start fresh
   * Deletes the Qwen session JSONL files for the current working directory
   */
  clear(): void {
    try {
      // Qwen stores sessions at ~/.qwen/projects/<sanitized-cwd>/chats/*.jsonl
      const qwenDir = path.join(os.homedir(), '.qwen', 'projects');

      if (!fs.existsSync(qwenDir)) {
        console.log(`[QwenSession] No Qwen projects directory found`);
        return;
      }

      // Find the project folder matching the working directory
      const projectFolders = fs.readdirSync(qwenDir);
      let targetPath: string | null = null;

      for (const folder of projectFolders) {
        const fullPath = path.join(qwenDir, folder);
        const chatsPath = path.join(fullPath, 'chats');

        if (fs.existsSync(chatsPath)) {
          targetPath = chatsPath;
          break;
        }
      }

      if (!targetPath) {
        console.log(`[QwenSession] No session files found for current project`);
        return;
      }

      // Delete all JSONL files in the chats directory
      const files = fs.readdirSync(targetPath);
      let deletedCount = 0;

      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          fs.unlinkSync(path.join(targetPath, file));
          deletedCount++;
        }
      }

      console.log(`[QwenSession] Deleted ${deletedCount} session file(s)`);
    } catch (err) {
      console.error(`[QwenSession] Error clearing session: ${err}`);
    }
  }

  /**
   * Kill any running processes (cleanup)
   */
  kill(): void {
    this.isRunning = false;
    console.log(`[QwenSession] Session closed`);
  }

  get ready(): boolean {
    return this.isRunning;
  }
}
