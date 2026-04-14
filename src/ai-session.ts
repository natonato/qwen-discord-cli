import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AISessionOptions {
  workingDir: string;
  approvalMode: 'yolo' | 'auto_edit' | 'default';
  debug?: boolean;
  timeoutMs?: number;
}

export interface AISendResult {
  response: string;
  error: string | null;
}

/**
 * Abstract base class for AI CLI sessions (Qwen, Gemini, etc.)
 */
export abstract class AISession {
  protected isRunning = false;

  constructor(protected options: AISessionOptions) {}

  /**
   * Start session (warm up)
   */
  abstract start(): Promise<void>;

  /**
   * Send a message to AI and get response
   */
  abstract send(message: string): Promise<AISendResult>;

  /**
   * Clear session data and start fresh
   */
  abstract clear(): void;

  /**
   * Kill any running processes (cleanup)
   */
  abstract kill(): void;

  get ready(): boolean {
    return this.isRunning;
  }

  /**
   * Get the CLI command name for this provider
   */
  abstract get commandName(): string;

  /**
   * Build the CLI args for sending a message
   */
  protected abstract buildArgs(): string[];

  /**
   * Common method to spawn a child process
   */
  protected spawnProcess(
    command: string,
    args: string[],
    message: string,
    onDebug: (msg: string) => void
  ): Promise<AISendResult> {
    return new Promise((resolve) => {
      const { spawn } = require('child_process');

      const isWindows = process.platform === 'win32';
      let finalCommand: string;
      let finalArgs: string[];

      if (isWindows) {
        finalCommand = 'cmd.exe';
        finalArgs = ['/c', command, ...args];
      } else {
        finalCommand = command;
        finalArgs = args;
      }

      onDebug(`Running: ${finalCommand} ${finalArgs.join(' ')}`);

      let stdout = '';
      let stderr = '';

      const proc = spawn(finalCommand, finalArgs, {
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
        onDebug(`stdout chunk: ${chunk.substring(0, 100)}...`);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        onDebug(`stderr chunk: ${chunk.substring(0, 100)}`);
      });

      proc.on('error', (error: Error) => {
        console.error(`[AISession] Process error: ${error.message}`);
        resolve({ response: '', error: error.message });
      });

      proc.on('exit', (code: number | null) => {
        onDebug(`Process exited with code ${code}`);

        const response = stdout.trim();
        const error = code !== 0 && stderr.trim() ? stderr.trim() : null;

        onDebug(`Response (${response.length} chars): ${response.substring(0, 100)}...`);

        resolve({ response, error });
      });
    });
  }

  /**
   * Common method to find and clear session files
   */
  protected clearSessionFiles(sessionDirPath: string): void {
    try {
      const chatsPath = sessionDirPath;

      if (!fs.existsSync(chatsPath)) {
        console.log(`[AISession] No session directory found at ${chatsPath}`);
        return;
      }

      // Delete all JSONL files in the chats directory
      const files = fs.readdirSync(chatsPath);
      let deletedCount = 0;

      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          fs.unlinkSync(path.join(chatsPath, file));
          deletedCount++;
        }
      }

      console.log(`[AISession] Deleted ${deletedCount} session file(s)`);
    } catch (err) {
      console.error(`[AISession] Error clearing session: ${err}`);
    }
  }
}
