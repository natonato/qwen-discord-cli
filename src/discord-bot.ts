import { Client, GatewayIntentBits, TextChannel, Message } from 'discord.js';
import { QwenSession } from './qwen-session';
import { Config } from './config';

export class DiscordBot {
  private client: Client;
  private qwenSession: QwenSession;
  private isProcessing = false;
  private messageQueue: { userId: string; content: string; channel: TextChannel }[] = [];

  constructor(
    private config: Config,
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    // Create Qwen session
    this.qwenSession = new QwenSession({
      workingDir: config.qwenWorkingDir,
      approvalMode: config.qwenApprovalMode,
      debug: config.logLevel === 'debug',
    });

    this.setupEventHandlers();
  }

  /**
   * Setup Discord event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('ready', () => {
      console.log(`[DiscordBot] Logged in as ${this.client.user?.tag}`);
    });

    this.client.on('messageCreate', (message: Message) => {
      this.handleMessage(message);
    });

    this.client.on('error', (error: Error) => {
      console.error(`[DiscordBot] Client error: ${error.message}`);
    });
  }

  /**
   * Handle commands that start with !
   */
  private async handleCommand(message: Message, content: string): Promise<void> {
    const channel = message.channel as TextChannel;
    const parts = content.split(' ');
    const command = parts[0].toLowerCase();

    if (command === '!help') {
      const helpText = [
        '**Available Commands:**',
        '',
        '`!help` — Show this help message',
        '`!session clear` — Clear Qwen session context and start fresh',
      ].join('\n');
      await channel.send(helpText);
      return;
    }

    if (command === '!session') {
      const subcommand = parts[1]?.toLowerCase();

      if (subcommand === 'clear') {
        console.log(`[DiscordBot] Session clear requested by ${message.author.tag}`);
        this.qwenSession.clear();
        await channel.send('✅ Session has been cleared. Starting fresh!');
        return;
      }
    }

    // If not a recognized command, treat as regular message
    console.log(`[DiscordBot] Received message from ${message.author.tag}: ${content.substring(0, 50)}...`);

    this.messageQueue.push({
      userId: message.author.id,
      content,
      channel: channel,
    });

    this.processQueue();
  }

  /**
   * Handle incoming Discord messages
   */
  private async handleMessage(message: Message): Promise<void> {
    // Ignore messages from the bot itself
    if (message.author.bot) return;

    // Only process messages from allowed channels
    if (!this.config.allowedChannelIds.includes(message.channel.id)) return;

    // Only process text channels
    if (!(message.channel instanceof TextChannel)) return;

    // Check if user is allowed
    if (this.config.allowedUserIds.length > 0 && !this.config.allowedUserIds.includes(message.author.id)) {
      console.log(`[DiscordBot] Ignored message from unauthorized user: ${message.author.tag}`);
      return;
    }

    const content = message.content.trim();
    if (!content) return;

    // Handle commands
    if (content.startsWith('!')) {
      return this.handleCommand(message, content);
    }

    console.log(`[DiscordBot] Received message from ${message.author.tag}: ${content.substring(0, 50)}...`);

    // Queue the message
    this.messageQueue.push({
      userId: message.author.id,
      content,
      channel: message.channel as TextChannel,
    });

    // Process queue if not already processing
    this.processQueue();
  }

  /**
   * Process queued messages
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) return;

    const { userId, content, channel } = this.messageQueue.shift()!;
    this.isProcessing = true;

    console.log(`[DiscordBot] Processing message from user ${userId}, remaining queue: ${this.messageQueue.length}`);

    try {
      // Show typing indicator
      await channel.sendTyping();

      // Send to Qwen and get response
      const { response, error } = await this.qwenSession.send(content);

      if (error) {
        console.error(`[DiscordBot] Qwen error: ${error}`);
        await channel.send(`⚠️ Qwen error:\n\`\`\`${error.substring(0, 1800)}\`\`\``);
      } else if (response) {
        const messages = this.splitMessage(response);
        for (const msg of messages) {
          await channel.send(msg);
        }
      } else {
        await channel.send('⚠️ Qwen returned an empty response.');
      }
    } catch (err) {
      console.error(`[DiscordBot] Error processing message: ${err}`);
      await channel.send('⚠️ An error occurred while processing your request.');
    } finally {
      this.isProcessing = false;
      // Process next message after a short delay
      setTimeout(() => this.processQueue(), 500);
    }
  }

  /**
   * Split message into chunks that fit Discord's 2000 char limit
   */
  private splitMessage(text: string, maxLength: number = 1900): string[] {
    const messages: string[] = [];
    
    if (text.length <= maxLength) {
      return [text];
    }

    // Try to split on newlines first
    const lines = text.split('\n');
    let current = '';

    for (const line of lines) {
      if ((current + line + '\n').length > maxLength) {
        if (current) {
          messages.push(current.trim());
          current = '';
        }
        
        // If single line is too long, force split
        if (line.length > maxLength) {
          for (let i = 0; i < line.length; i += maxLength) {
            messages.push(line.substring(i, i + maxLength));
          }
        } else {
          current = line + '\n';
        }
      } else {
        current += line + '\n';
      }
    }

    if (current.trim()) {
      messages.push(current.trim());
    }

    return messages;
  }

  /**
   * Start the Discord bot and Qwen session
   */
  async start(): Promise<void> {
    console.log('[DiscordBot] Starting Qwen session...');
    await this.qwenSession.start();

    console.log('[DiscordBot] Logging in to Discord...');
    await this.client.login(this.config.discordBotToken);
  }

  /**
   * Stop the bot and kill Qwen session
   */
  stop(): void {
    console.log('[DiscordBot] Shutting down...');
    this.qwenSession.kill();
    this.client.destroy();
  }
}
