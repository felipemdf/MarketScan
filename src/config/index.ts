import dotenv from 'dotenv';
import DatabaseConfig from './interface/config/database.config';
import GoogleConfig from './interface/config/google.config';
import EmailConfig from './interface/config/email.config';
import InstagramConfig from './interface/config/instagram.config';
import AppConfig from './interface/config/app.config';

// Carrega variáveis de ambiente
dotenv.config();

class Config {
  public readonly database: DatabaseConfig;
  public readonly google: GoogleConfig;
  public readonly email: EmailConfig;
  public readonly instagram: InstagramConfig;
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

    this.google = {
      APIKey: this.getEnvVar('GOOGLE_API_KEY'),
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

    // Validação do banco
    if (!this.database.database) errors.push('DB_DATABASE is required');

    if (this.database.type !== 'sqlite') {
      if (!(this.database as any).host) errors.push('DB_HOST is required for non-SQLite databases');
      if (!(this.database as any).username) errors.push('DB_USER is required for non-SQLite databases');
    }

    //Validação Google
    if (!this.google.APIKey) errors.push('GOOGLE_API_KEY is required');

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
