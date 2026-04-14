import { AISession, AISessionOptions } from './ai-session';
import * as path from 'path';
import * as os from 'os';

export class QwenSession extends AISession {
  constructor(options: AISessionOptions) {
    super(options);
  }

  async start(): Promise<void> {
    console.log(`[QwenSession] Session initialized`);
    this.isRunning = true;
  }

  async send(message: string): Promise<{ response: string; error: string | null }> {
    const args = this.buildArgs();
    return this.spawnProcess('qwen', args, message, (msg) => {
      if (this.options.debug) {
        console.log(`[QwenSession] ${msg}`);
      }
    });
  }

  clear(): void {
    // Qwen stores sessions at ~/.qwen/projects/<sanitized-cwd>/chats/*.jsonl
    const qwenDir = path.join(os.homedir(), '.qwen', 'projects');

    if (!require('fs').existsSync(qwenDir)) {
      console.log(`[QwenSession] No Qwen projects directory found`);
      return;
    }

    // Find the project folder matching the working directory
    const projectFolders = require('fs').readdirSync(qwenDir);
    let targetPath: string | null = null;

    for (const folder of projectFolders) {
      const fullPath = path.join(qwenDir, folder);
      const chatsPath = path.join(fullPath, 'chats');

      if (require('fs').existsSync(chatsPath)) {
        targetPath = chatsPath;
        break;
      }
    }

    if (!targetPath) {
      console.log(`[QwenSession] No session files found for current project`);
      return;
    }

    this.clearSessionFiles(targetPath);
  }

  kill(): void {
    this.isRunning = false;
    console.log(`[QwenSession] Session closed`);
  }

  get commandName(): string {
    return 'qwen';
  }

  protected buildArgs(): string[] {
    return [
      '--approval-mode', this.options.approvalMode,
      '--continue',
      '--output-format', 'text',
    ];
  }
}
