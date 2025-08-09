import 'reflect-metadata';
import { ScheduledEvent, Context, Handler } from 'aws-lambda';
import { createLogger } from '../utils/logger';
import { closeDatabase, initializeDatabase } from '../database/connection';
import config from '../config';
import { InstagramPost } from '../service/instagram/index';
import { VisionProcessingResult } from '../service/vision/index';
import { GeminiProcessingResult } from '../service/gemini/index';
import { DatabaseSaveResult } from '../service/promotion/save-promotion';
import { EmailSendResult } from '../service/email/index';
import { TokenMonitoringResult } from '../service/gemini/token-monitor';

// Interface para o retorno do Lambda
interface LambdaResponse {
  statusCode: number;
  body: string;
}

class LambdaHandler {
  private executionLogger = createLogger('Lambda');

  public async execute(): Promise<LambdaResponse> {
    this.executionLogger.info('🚀 Mercado Radar execution started');

    const startTime = Date.now();

    try {
      // 1. Validar configurações
      this.validateConfig();

      // 2. Inicializar banco de dados
      await this.initializeDatabase();

      // await this.runTokenMonitoring();

      // 3. Executar lógica principal (placeholder)
      await this.executeMainLogic();

      // 4. Calcular duração
      const duration = Date.now() - startTime;

      this.executionLogger.info('✅ Pipeline completed successfully', {
        duration: `${Math.round(duration / 1000)}s`,
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Pipeline executed successfully',
          duration,
          timestamp: new Date().toISOString(),
          environment: this.getEnvironment(),
        }),
      };
    } catch (error) {
      return this.handleError(error, startTime);
    } finally {
      await this.cleanup();
    }
  }

  private getEnvironment(): string {
    // Detecta se está rodando na AWS ou localmente
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return 'aws-lambda';
    }
    return 'local';
  }

  private validateConfig(): void {
    this.executionLogger.info('Validating configuration');

    // Verificar se configurações essenciais estão presentes
    if (!config.database.database) {
      throw new Error('Database path not configured');
    }

    this.executionLogger.info('✅ Configuration valid', {
      nodeEnv: config.app.nodeEnv,
      database: config.database.database,
      timezone: config.app.timezone,
      environment: this.getEnvironment(),
    });
  }

  private async initializeDatabase(): Promise<void> {
    this.executionLogger.info('Initializing database connection');

    try {
      await initializeDatabase();
      this.executionLogger.info('✅ Database connected successfully');
    } catch (error) {
      this.executionLogger.error('❌ Database connection failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw new Error(`Database initialization failed: ${error}`);
    }
  }

  private async executeMainLogic(): Promise<void> {
    this.executionLogger.info('Executing main logic');

    // // 1. Instagram Scraping
    // const instagramPosts = await this.runInstagramScraping();

    // // TODO: 2. Google Vision processing
    // const visionResult = await this.runVisionProcessing(instagramPosts);

    // // TODO: 3. Gemini AI processing
    // const geminiResult = await this.runGeminiProcessing(visionResult.results);
    // // TODO: 4. Save to database
    // await this.runSavePromotions(geminiResult);

    // // TODO: 5. Send emails
    // await this.runEmailSend();

    this.executionLogger.info('✅ Main logic completed');
  }

  private async runInstagramScraping(): Promise<InstagramPost[]> {
    this.executionLogger.info('🔍 Starting Instagram scraping');

    try {
      const { InstagramService } = await import('../service/instagram/index');
      const instagramService = new InstagramService();

      const result = await instagramService.execute({
        includePreviousDay: false,
      });

      this.executionLogger.info('📊 Instagram scraping completed', {
        success: result.success,
        totalMarkets: result.totalMarkets,
        processedMarkets: result.processedMarkets,
        totalPosts: result.totalPosts,
        filteredPosts: result.filteredPosts,
        errors: result.errors.length,
        duration: `${Math.round(result.duration / 1000)}s`,
      });

      if (result.errors.length > 0) {
        this.executionLogger.warn('⚠️ Instagram scraping had errors', {
          errors: result.errors,
        });
      }

      // Cleanup
      await instagramService.logout();

      if (!result.success) {
        throw new Error('Instagram scraping failed');
      }

      // Retornar os posts para processamento posterior
      return result.posts;
    } catch (error) {
      this.executionLogger.error('❌ Instagram scraping failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  private async runVisionProcessing(posts: InstagramPost[]): Promise<VisionProcessingResult> {
    this.executionLogger.info('🔍 Starting Google Vision processing');

    try {
      const { VisionService } = await import('../service/vision/index');
      const visionService = new VisionService();

      // Filtrar apenas posts com imagens
      const postsWithImages = posts.filter((post) => post.images && post.images.length > 0);

      if (postsWithImages.length === 0) {
        this.executionLogger.warn('⚠️ No posts with images found for Vision processing');

        return {
          success: true,
          totalPosts: 0,
          processedPosts: 0,
          totalImages: 0,
          processedImages: 0,
          promotionPosts: 0,
          duration: 0,
          results: [],
          errors: [],
        };
      }

      const result = await visionService.execute(postsWithImages);

      this.executionLogger.info('📊 Google Vision processing completed', {
        success: result.success,
        totalPosts: result.totalPosts,
        processedPosts: result.processedPosts,
        totalImages: result.totalImages,
        processedImages: result.processedImages,
        promotionPosts: result.promotionPosts,
        errors: result.errors.length,
        duration: `${Math.round(result.duration / 1000)}s`,
      });

      if (result.errors.length > 0) {
        this.executionLogger.warn('⚠️ Vision processing had errors', {
          errors: result.errors,
        });
      }

      if (!result.success) {
        throw new Error('Vision processing failed');
      }

      return result;
    } catch (error) {
      this.executionLogger.error('❌ Google Vision processing failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  private async runGeminiProcessing(visionResults: any[]): Promise<GeminiProcessingResult> {
    this.executionLogger.info('🤖 Starting Gemini AI processing');

    try {
      const { GeminiService } = await import('../service/gemini/index');
      const geminiService = new GeminiService();

      if (visionResults.length === 0) {
        this.executionLogger.warn('⚠️ No vision results found for Gemini processing');
        return {
          success: true,
          totalPosts: 0,
          processedPosts: 0,
          promotions: [],
          totalPromotions: 0,
          duration: 0,
          errors: [],
        };
      }

      const result = await geminiService.execute(visionResults);

      this.executionLogger.info('📊 Gemini AI processing completed', {
        success: result.success,
        totalPosts: result.totalPosts,
        processedPosts: result.processedPosts,
        totalPromotions: result.totalPromotions,
        errors: result.errors.length,
        duration: `${Math.round(result.duration / 1000)}s`,
      });

      if (result.errors.length > 0) {
        this.executionLogger.warn('⚠️ Gemini processing had errors', {
          errors: result.errors,
        });
      }

      if (!result.success) {
        throw new Error('Gemini processing failed');
      }

      return result;
    } catch (error) {
      this.executionLogger.error('❌ Gemini AI processing failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  private async runSavePromotions(geminiResult: GeminiProcessingResult): Promise<DatabaseSaveResult> {
    this.executionLogger.info('💾 Starting database save');

    try {
      const { SavePromotionService } = await import('../service/promotion/save-promotion');
      const savePromotionService = new SavePromotionService();

      if (geminiResult.promotions.length === 0) {
        this.executionLogger.warn('⚠️ No promotions found to save');
        return {
          success: true,
          totalPromotions: 0,
          savedPromotions: 0,
          totalPosts: 0,
          savedPosts: 0,
          totalProducts: 0,
          savedProducts: 0,
          duration: 0,
          errors: [],
        };
      }

      const result = await savePromotionService.saveGeminiResults(geminiResult);

      this.executionLogger.info('📊 Database save completed', {
        success: result.success,
        totalPromotions: result.totalPromotions,
        savedPromotions: result.savedPromotions,
        totalPosts: result.totalPosts,
        savedPosts: result.savedPosts,
        totalProducts: result.totalProducts,
        savedProducts: result.savedProducts,
        errors: result.errors.length,
        duration: `${Math.round(result.duration / 1000)}s`,
      });

      if (result.errors.length > 0) {
        this.executionLogger.warn('⚠️ Database save had errors', {
          errors: result.errors,
        });
      }

      if (!result.success) {
        throw new Error('Database save failed');
      }

      return result;
    } catch (error) {
      this.executionLogger.error('❌ Database save failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  private async runEmailSend(): Promise<EmailSendResult> {
    this.executionLogger.info('📧 Starting email send');

    try {
      const { EmailService } = await import('../service/email/index');
      const emailService = new EmailService();

      const result = await emailService.sendActivePromotions();

      this.executionLogger.info('📊 Email send completed', {
        success: result.success,
        totalPromotions: result.totalPromotions,
        emailsSent: result.emailsSent,
        errors: result.errors.length,
        duration: `${Math.round(result.duration / 1000)}s`,
      });

      if (result.errors.length > 0) {
        this.executionLogger.warn('⚠️ Email send had errors', {
          errors: result.errors,
        });
      }

      if (!result.success) {
        throw new Error('Email send failed');
      }

      return result;
    } catch (error) {
      this.executionLogger.error('❌ Email send failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  private async runTokenMonitoring(): Promise<TokenMonitoringResult> {
    this.executionLogger.info('📊 Starting token usage monitoring');

    try {
      const { TokenMonitorService } = await import('../service/gemini/token-monitor');
      const tokenMonitorService = new TokenMonitorService();

      const result = await tokenMonitorService.checkTokenUsage();

      this.executionLogger.info('📊 Token monitoring completed', {
        success: result.success,
        totalTokensUsed: result.totalTokensUsed,
        promptTokens: result.promptTokens,
        candidatesTokens: result.candidatesTokens,
        thoughtsTokens: result.thoughtsTokens,
        duration: `${Math.round(result.duration / 1000)}s`,
        error: result.error,
      });

      if (!result.success) {
        this.executionLogger.warn('⚠️ Token monitoring failed', {
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      this.executionLogger.error('❌ Token monitoring failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  private async handleError(error: unknown, startTime: number): Promise<LambdaResponse> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const duration = Date.now() - startTime;

    this.executionLogger.error('❌ Lambda execution failed', {
      error: errorMessage,
      duration: `${Math.round(duration / 1000)}s`,
      environment: this.getEnvironment(),
      ...(error instanceof Error && { stack: error.stack }),
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Pipeline execution failed',
        message: errorMessage,
        duration,
        timestamp: new Date().toISOString(),
        environment: this.getEnvironment(),
        ...(config.app.nodeEnv === 'development' && {
          stack: error instanceof Error ? error.stack : undefined,
        }),
      }),
    };
  }

  private async cleanup(): Promise<void> {
    try {
      this.executionLogger.info('Starting cleanup');

      // Fechar conexão do banco
      await closeDatabase();

      this.executionLogger.info('✅ Cleanup completed');
    } catch (error) {
      this.executionLogger.error('⚠️ Cleanup failed', {
        error: error instanceof Error ? error.message : error,
      });
      // Não falhar a execução por causa da limpeza
    }
  }
}

// Handler para AWS Lambda (eventos agendados)
export const scheduledHandler: Handler<ScheduledEvent> = async (event: ScheduledEvent, context: Context) => {
  const executionLogger = createLogger('AWS-Lambda');

  executionLogger.info('Received scheduled event from AWS', {
    requestId: context.awsRequestId,
    scheduledTime: event.time,
    region: event.region,
    source: event.source,
  });

  const handler = new LambdaHandler();
  return handler.execute();
};

// Handler genérico para AWS Lambda
export const handler: Handler = async (event: any, context: Context) => {
  const executionLogger = createLogger('AWS-Lambda');

  executionLogger.info('Received event from AWS', {
    eventType: event.source || 'unknown',
    requestId: context.awsRequestId,
    functionName: context.functionName,
  });

  // Se for um evento agendado, usar o handler específico
  if (event.source === 'aws.events' && event['detail-type'] === 'Scheduled Event') {
    return scheduledHandler(event as ScheduledEvent, context, () => {});
  }

  // Para outros tipos de evento, executar normalmente
  const lambdaHandler = new LambdaHandler();
  return lambdaHandler.execute();
};

// Função para execução direta (local)
export async function runLocal(): Promise<void> {
  const executionLogger = createLogger('Local');

  executionLogger.info('Starting local execution');

  try {
    const handler = new LambdaHandler();
    const result = await handler.execute();

    executionLogger.info('Local execution completed', {
      statusCode: result.statusCode,
      success: result.statusCode === 200,
    });

    // Em ambiente local, mostrar resultado no console
    if (result.statusCode === 200) {
      console.log('\n🎉 Execução local bem-sucedida!');
      console.log('Resultado:', JSON.parse(result.body));
    } else {
      console.log('\n❌ Execução local falhou!');
      console.log('Erro:', JSON.parse(result.body));
      process.exit(1);
    }
  } catch (error) {
    executionLogger.error('Local execution failed', {
      error: error instanceof Error ? error.message : error,
    });

    console.log('\n💥 Erro não tratado na execução local!');
    console.error(error);
    process.exit(1);
  }
}

// Auto-execução quando chamado diretamente
if (require.main === module) {
  runLocal();
}

// Export default para compatibilidade
export default handler;
