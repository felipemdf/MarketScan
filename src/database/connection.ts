import { DataSource, DataSourceOptions } from 'typeorm';
import path from 'path';
import fs from 'fs';
import config from '../config';
import { logger } from '../utils/logger';
import { Market } from './entities/market.entity';
import { Promotion } from './entities/promotion.entity';
import { Post } from './entities/post.entity';
import { Product } from './entities/product.entity';

class DatabaseConnection {
  private dataSource: DataSource | null = null;

  constructor() {
    this.setupDatabase();
  }

  private setupDatabase(): void {
    const baseConfig = {
      entities: [Market, Promotion, Post, Product],
      migrations: [path.join(__dirname, 'migrations/*.ts')],
      synchronize: config.app.nodeEnv === 'development',
      logging: config.app.nodeEnv === 'development' ? 'all' : ['error'],
      cache: true,
    };

    let dataSourceConfig: DataSourceOptions;

    if (config.database.type === 'sqlite') {
      // Ensure database directory exists
      const dbPath = path.resolve(config.database.database);
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      dataSourceConfig = {
        ...baseConfig,
        type: 'sqlite',
        database: dbPath,
      } as DataSourceOptions;
    } else {
      dataSourceConfig = {
        ...baseConfig,
        type: config.database.type as any,
        database: config.database.database,
        extra: {
          connectionLimit: 2,
          acquireTimeout: 60000,
          timeout: 60000,
          reconnect: true,
        },
      } as DataSourceOptions;
    }

    this.dataSource = new DataSource(dataSourceConfig);
  }

  public async initialize(): Promise<void> {
    try {
      if (!this.dataSource) throw new Error('DataSource not configured');

      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
        logger.info('Database connection established', {
          database: config.database.database,
          type: config.database.type,
        });
      }
    } catch (error) {
      logger.error('Failed to initialize database connection', {
        error: error instanceof Error ? error.message : error,
        database: config.database.database,
      });
      throw error;
    }
  }

  public async close(): Promise<void> {
    try {
      if (this.dataSource?.isInitialized) {
        await this.dataSource.destroy();
        logger.info('Database connection closed');
      }
    } catch (error) {
      logger.error('Error closing database connection', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  public getDataSource(): DataSource {
    if (!this.dataSource) {
      throw new Error('Database not initialized');
    }
    return this.dataSource;
  }
}

// Singleton instance
export const databaseConnection = new DatabaseConnection();

// Funções de conveniência
export const initializeDatabase = () => databaseConnection.initialize();
export const closeDatabase = () => databaseConnection.close();
export const getDataSource = () => databaseConnection.getDataSource();
// export const healthCheckDatabase = () => databaseConnection.healthCheck();

export default databaseConnection;
