import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load .env file from current working directory
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

export interface Config {
  discordBotToken: string;
  allowedChannelIds: string[];
  allowedUserIds: string[];
  aiProvider: 'qwen' | 'gemini';
  approvalMode: 'yolo' | 'auto_edit' | 'default';
  workingDir: string;
  aiTimeoutMs: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export function loadConfig(): Config {
  const discordBotToken = process.env.DISCORD_BOT_TOKEN;
  const allowedChannelIds = process.env.ALLOWED_CHANNEL_IDS
    ? process.env.ALLOWED_CHANNEL_IDS.split(',').map(id => id.trim()).filter(id => id.length > 0)
    : [];
  const allowedUserIds = process.env.ALLOWED_USER_IDS
    ? process.env.ALLOWED_USER_IDS.split(',').map(id => id.trim()).filter(id => id.length > 0)
    : [];
  const aiProvider = (process.env.AI_PROVIDER as Config['aiProvider']) || 'qwen';
  const approvalMode = (process.env.APPROVAL_MODE as Config['approvalMode']) || 'yolo';
  const workingDir = process.env.WORKING_DIR || process.cwd();
  const aiTimeoutMs = parseInt(process.env.AI_TIMEOUT_MS || '300000', 10); // default 5 minutes
  const logLevel = (process.env.LOG_LEVEL as Config['logLevel']) || 'info';

  if (!discordBotToken) {
    throw new Error('DISCORD_BOT_TOKEN is not set in .env file');
  }

  if (allowedChannelIds.length === 0) {
    throw new Error('ALLOWED_CHANNEL_IDS is not set in .env file');
  }

  if (!['qwen', 'gemini'].includes(aiProvider)) {
    throw new Error('AI_PROVIDER must be one of: qwen, gemini');
  }

  if (!['yolo', 'auto_edit', 'default'].includes(approvalMode)) {
    throw new Error('APPROVAL_MODE must be one of: yolo, auto_edit, default');
  }

  if (isNaN(aiTimeoutMs) || aiTimeoutMs < 10000) {
    throw new Error('AI_TIMEOUT_MS must be a number >= 10000 (10 seconds)');
  }

  return {
    discordBotToken,
    allowedChannelIds,
    allowedUserIds,
    aiProvider,
    approvalMode,
    workingDir,
    aiTimeoutMs,
    logLevel,
  };
}
