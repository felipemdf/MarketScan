import { DataSource } from 'typeorm';
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
    const dbPath = path.dirname(config.database.database);
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
      logger.info(`Created database directory: ${dbPath}`);
    }
    this.dataSource = new DataSource({
      type: 'sqlite',
      database: config.database.database,
      entities: [Market, Promotion, Post, Product],
      migrations: [path.join(__dirname, 'migrations/*.ts')],
      synchronize: config.app.nodeEnv === 'development', // Auto-sync em dev
      logging: config.app.nodeEnv === 'development' ? 'all' : ['error'],
      cache: true,
    });
  }

  public async initialize(): Promise<void> {
    try {
      if (!this.dataSource) throw new Error('DataSource not configured');

      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
        logger.info('Database connection established', {
          database: config.database.database,
          type: 'sqlite',
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

  //   public async healthCheck(): Promise<boolean> {
  //     try {
  //       if (!this.dataSource?.isInitialized) {
  //         return false;
  //       }
  //       // Teste simples de query
  //       await this.dataSource.query('SELECT 1');
  //       return true;
  //     } catch (error) {
  //       logger.error('Database health check failed', {
  //         error: error instanceof Error ? error.message : error,
  //       });
  //       return false;
  //     }
  //   }
  //   /**
  //    * Executa uma query raw no banco (para casos específicos)
  //    */
  //   public async query(sql: string, parameters?: any[]): Promise<any> {
  //     try {
  //       if (!this.dataSource?.isInitialized) {
  //         throw new Error('Database not initialized');
  //       }
  //       return await this.dataSource.query(sql, parameters);
  //     } catch (error) {
  //       logger.error('Raw query failed', {
  //         sql,
  //         parameters,
  //         error: error instanceof Error ? error.message : error,
  //       });
  //       throw error;
  //     }
  //   }
  //   /**
  //    * Limpa dados antigos (para manutenção)
  //    */
  //   public async cleanup(daysToKeep: number = 30): Promise<void> {
  //     try {
  //       const cutoffDate = new Date();
  //       cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  //       if (!this.dataSource?.isInitialized) {
  //         throw new Error('Database not initialized');
  //       }
  //       const result = await this.dataSource
  //         .createQueryBuilder()
  //         .delete()
  //         .from(Promotion)
  //         .where('created_at < :cutoffDate', { cutoffDate })
  //         .execute();
  //       logger.info('Database cleanup completed', {
  //         daysToKeep,
  //         deletedRecords: result.affected || 0,
  //       });
  //     } catch (error) {
  //       logger.error('Database cleanup failed', {
  //         error: error instanceof Error ? error.message : error,
  //         daysToKeep,
  //       });
  //       throw error;
  //     }
  //   }
  //   /**
  //    * Backup do banco SQLite
  //    */
  //   public async backup(backupPath?: string): Promise<string> {
  //     try {
  //       const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  //       const finalBackupPath = backupPath || `./backups/mercado_radar_${timestamp}.db`;
  //       // Criar diretório de backup se não existir
  //       const backupDir = path.dirname(finalBackupPath);
  //       if (!fs.existsSync(backupDir)) {
  //         fs.mkdirSync(backupDir, { recursive: true });
  //       }
  //       // Copiar arquivo SQLite
  //       fs.copyFileSync(config.database.database, finalBackupPath);
  //       logger.info('Database backup created', {
  //         originalPath: config.database.database,
  //         backupPath: finalBackupPath,
  //       });
  //       return finalBackupPath;
  //     } catch (error) {
  //       logger.error('Database backup failed', {
  //         error: error instanceof Error ? error.message : error,
  //         backupPath,
  //       });
  //       throw error;
  //     }
  //   }
}

// Singleton instance
export const databaseConnection = new DatabaseConnection();

// Funções de conveniência
export const initializeDatabase = () => databaseConnection.initialize();
export const closeDatabase = () => databaseConnection.close();
export const getDataSource = () => databaseConnection.getDataSource();
// export const healthCheckDatabase = () => databaseConnection.healthCheck();

export default databaseConnection;
