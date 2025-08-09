import dotenv from 'dotenv';
import DatabaseConfig from './interface/config/database.config';
import GoogleConfig from './interface/config/google.config';
import OpenAIConfig from './interface/config/open-ai.config';
import EmailConfig from './interface/config/email.config';
import InstagramConfig from './interface/config/instagram.config';
import AWSConfig from './interface/config/aws.config';
import AppConfig from './interface/config/app.config';

// Carrega variáveis de ambiente
dotenv.config();

class Config {
  public readonly database: DatabaseConfig;
  public readonly vision: GoogleConfig;
  public readonly gemini: GoogleConfig;
  //   public readonly openai: OpenAIConfig;
  public readonly email: EmailConfig;
  public readonly instagram: InstagramConfig;
  //   public readonly aws: AWSConfig;
  public readonly app: AppConfig;

  constructor() {
    this.database = {
      type: 'sqlite',
      database: this.getEnvVar('DB_DATABASE', './database/market_scan.db'),
    };

    this.instagram = {
      username: this.getEnvVar('INSTAGRAM_USERNAME'),
      password: this.getEnvVar('INSTAGRAM_PASSWORD'),
    };

    this.vision = {
      APIKey: this.getEnvVar('GOOGLE_VISION_API_KEY'),
    };

    this.gemini = {
      APIKey: this.getEnvVar('GOOGLE_GEMINI_API_KEY'),
    };

    this.email = {
      user: this.getEnvVar('EMAIL_USER'),
      password: this.getEnvVar('EMAIL_PASSWORD'),
      recipient: this.getEnvVar('EMAIL_RECIPIENT'),
    };

    this.app = this.buildAppConfig();
  }

  private getEnvVar(name: string, defaultValue?: string): string {
    const value = process.env[name];
    if (!value && !defaultValue) {
      throw new Error(`Environment variable ${name} is required`);
    }
    return value || defaultValue!;
  }

  //   private buildEmailConfig(): EmailConfig {
  //     const service = this.getEnvVar('EMAIL_SERVICE') as 'sendgrid' | 'ses';
  //     const recipients = this.getEnvVar('EMAIL_RECIPIENTS')
  //       .split(',')
  //       .map((email) => email.trim());

  //     const config: EmailConfig = {
  //       service,
  //       recipients,
  //     };

  //     if (service === 'sendgrid') {
  //       config.sendgrid = {
  //         apiKey: this.getEnvVar('SENDGRID_API_KEY'),
  //         fromEmail: this.getEnvVar('SENDGRID_FROM_EMAIL'),
  //         fromName: this.getEnvVar('SENDGRID_FROM_NAME'),
  //       };
  //     } else if (service === 'ses') {
  //       config.ses = {
  //         region: this.getEnvVar('AWS_REGION'),
  //         accessKeyId: this.getEnvVar('AWS_ACCESS_KEY_ID'),
  //         secretAccessKey: this.getEnvVar('AWS_SECRET_ACCESS_KEY'),
  //         fromEmail: this.getEnvVar('SES_FROM_EMAIL'),
  //       };
  //     }

  //     return config;
  //   }

  //   private buildInstagramConfig(): InstagramConfig {
  //     return {
  //       accounts: this.getEnvVar('INSTAGRAM_ACCOUNTS')
  //         .split(',')
  //         .map((account) => account.trim()),
  //       scraperDelay: parseInt(this.getEnvVar('INSTAGRAM_SCRAPER_DELAY', '2000')),
  //       maxPosts: parseInt(this.getEnvVar('INSTAGRAM_MAX_POSTS', '10')),
  //     };
  //   }

  //   private buildAWSConfig(): AWSConfig {
  //     return {
  //       region: this.getEnvVar('AWS_REGION', 'us-east-1'),
  //       accessKeyId: this.getEnvVar('AWS_ACCESS_KEY_ID'),
  //       secretAccessKey: this.getEnvVar('AWS_SECRET_ACCESS_KEY'),
  //     };
  //   }

  private buildAppConfig(): AppConfig {
    return {
      nodeEnv: this.getEnvVar('NODE_ENV', 'development'),
      logLevel: this.getEnvVar('LOG_LEVEL', 'info'),
      timezone: this.getEnvVar('TIMEZONE', 'America/Sao_Paulo'),
      //   tempDir: this.getEnvVar('TEMP_DIR', './temp'),
      //   s3Bucket: process.env.S3_BUCKET,
      //   maxRetries: parseInt(this.getEnvVar('MAX_RETRIES', '3')),
      //   retryDelay: parseInt(this.getEnvVar('RETRY_DELAY', '1000')),
      //   rateLimitDelay: parseInt(this.getEnvVar('RATE_LIMIT_DELAY', '500')),
      //   enableMetrics: this.getEnvVar('ENABLE_METRICS', 'true') === 'true',
      //   sentryDsn: process.env.SENTRY_DSN,
    };
  }

  /**
   * Valida se todas as configurações necessárias estão presentes
   */
  public validate(): void {
    const errors: string[] = [];

    // Validação do banco SQLite
    if (!this.database.database) errors.push('DB_DATABASE is required');

    //Validação Google
    if (!this.vision.APIKey) errors.push('GOOGLE_API_KEY is required');

    // Validação Email
    if (this.email.user == undefined || this.email.password == undefined || this.email.recipient == undefined) {
      errors.push('EMAIL_USER, EMAIL_PASSWORD and EMAIL_RECIPIENT are required');
    }

    // Validação Instagram
    if (this.instagram.username == undefined || this.instagram.password == undefined) {
      errors.push('INSTAGRAM_LOGIN and INSTAGRAM_PASSWORD are required');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }
}

export const config = new Config();

// Valida configuração na inicialização
config.validate();

export default config;
