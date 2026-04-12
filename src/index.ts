#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig } from './config';
import { DiscordBot } from './discord-bot';

const program = new Command();

program
  .name('qwen-discord')
  .description('Bridge Qwen CLI with Discord channels')
  .version('1.0.0');

program
  .command('start')
  .description('Start the Qwen-Discord bridge bot')
  .action(async () => {
    try {
      console.log('🚀 Starting Qwen-Discord Bridge...');
      
      // Load configuration
      const config = loadConfig();
      console.log(`✓ Configuration loaded`);
      console.log(`  - Allowed Channels: ${config.allowedChannelIds.join(', ')}`);
      console.log(`  - Allowed Users: ${config.allowedUserIds.length > 0 ? config.allowedUserIds.length + ' user(s)' : 'All users'}`);
      console.log(`  - Approval Mode: ${config.qwenApprovalMode}`);
      console.log(`  - Working Directory: ${config.qwenWorkingDir}`);

      // Create and start bot
      const bot = new DiscordBot(config);
      
      // Handle graceful shutdown
      const shutdown = (signal: string) => {
        console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
        bot.stop();
        process.exit(0);
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      
      // Handle uncaught exceptions
      process.on('uncaughtException', (error) => {
        console.error('💥 Uncaught Exception:', error);
        bot.stop();
        process.exit(1);
      });

      process.on('unhandledRejection', (reason) => {
        console.error('💥 Unhandled Rejection:', reason);
        bot.stop();
        process.exit(1);
      });

      await bot.start();
      
      console.log('✅ Bot is running! Press Ctrl+C to stop.');
    } catch (error) {
      console.error('❌ Failed to start bot:', error);
      process.exit(1);
    }
  });

program
  .command('info')
  .description('Show current configuration (without sensitive data)')
  .action(() => {
    try {
      const config = loadConfig();
      console.log('📋 Configuration:');
      console.log(`  - Discord Token: ${config.discordBotToken ? '***' + config.discordBotToken.slice(-4) : 'NOT SET'}`);
      console.log(`  - Allowed Channel IDs: ${config.allowedChannelIds.length > 0 ? config.allowedChannelIds.join(', ') : 'NOT SET'}`);
      console.log(`  - Allowed User IDs: ${config.allowedUserIds.length > 0 ? config.allowedUserIds.join(', ') : 'All users'}`);
      console.log(`  - Approval Mode: ${config.qwenApprovalMode}`);
      console.log(`  - Working Directory: ${config.qwenWorkingDir}`);
      console.log(`  - Log Level: ${config.logLevel}`);
    } catch (error) {
      console.error('❌ Configuration error:', error);
      process.exit(1);
    }
  });

program.parse();
