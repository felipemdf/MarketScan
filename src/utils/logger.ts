import winston from 'winston';
import config from '../config';

// Definir formato customizado para os logs
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]`;

    if (context) {
      logMessage += ` [${context}]`;
    }

    logMessage += `: ${message}`;

    // Adiciona metadados se existirem
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }

    return logMessage;
  }),
);

// Configurar transports baseado no ambiente
const transports: winston.transport[] = [
  new winston.transports.Console({
    format:
      config.app.nodeEnv === 'development'
        ? winston.format.combine(winston.format.colorize(), customFormat)
        : customFormat,
  }),
];

// Criar instância do logger
const winstonLogger = winston.createLogger({
  level: config.app.logLevel,
  format: customFormat,
  defaultMeta: {
    service: 'mercado-radar',
    version: '1.0.0',
  },
  transports,
  exitOnError: false,
});

// Classe wrapper para facilitar o uso
export class Logger {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  private formatMessage(message: string, meta: Record<string, any> = {}): [string, Record<string, any>] {
    const finalMeta = {
      ...meta,
      ...(this.context && { context: this.context }),
    };

    return [message, finalMeta];
  }

  info(message: string, meta?: Record<string, any>): void {
    const [msg, finalMeta] = this.formatMessage(message, meta);
    winstonLogger.info(msg, finalMeta);
  }

  error(message: string, meta?: Record<string, any>): void {
    const [msg, finalMeta] = this.formatMessage(message, meta);
    winstonLogger.error(msg, finalMeta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    const [msg, finalMeta] = this.formatMessage(message, meta);
    winstonLogger.warn(msg, finalMeta);
  }

  debug(message: string, meta?: Record<string, any>): void {
    const [msg, finalMeta] = this.formatMessage(message, meta);
    winstonLogger.debug(msg, finalMeta);
  }
}

// Instância padrão
export const logger = new Logger();

// Factory para criar loggers com contexto
export const createLogger = (context: string): Logger => {
  return new Logger(context);
};

export default logger;
