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
  qwenApprovalMode: 'yolo' | 'auto_edit' | 'default';
  qwenWorkingDir: string;
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
  const qwenApprovalMode = (process.env.QWEN_APPROVAL_MODE as Config['qwenApprovalMode']) || 'yolo';
  const qwenWorkingDir = process.env.QWEN_WORKING_DIR || process.cwd();
  const logLevel = (process.env.LOG_LEVEL as Config['logLevel']) || 'info';

  if (!discordBotToken) {
    throw new Error('DISCORD_BOT_TOKEN is not set in .env file');
  }

  if (allowedChannelIds.length === 0) {
    throw new Error('ALLOWED_CHANNEL_IDS is not set in .env file');
  }

  if (!['yolo', 'auto_edit', 'default'].includes(qwenApprovalMode)) {
    throw new Error('QWEN_APPROVAL_MODE must be one of: yolo, auto_edit, default');
  }

  return {
    discordBotToken,
    allowedChannelIds,
    allowedUserIds,
    qwenApprovalMode,
    qwenWorkingDir,
    logLevel,
  };
}
