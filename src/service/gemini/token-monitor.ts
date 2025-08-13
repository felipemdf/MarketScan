import { GoogleGenAI } from '@google/genai';
import config from '../../config';
import { createLogger } from '../../utils/logger';

// Interface para metadados de uso de tokens
export interface TokenUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  thoughtsTokenCount?: number;
}

// Interface para resultado do monitoramento
export interface TokenMonitoringResult {
  success: boolean;
  totalTokensUsed: number;
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens?: number;
  duration: number;
  error?: string;
}

export class TokenMonitorService {
  private logger = createLogger('TokenMonitor');
  private genAI: GoogleGenAI;

  constructor() {
    this.genAI = new GoogleGenAI({ apiKey: config.google.APIKey });
  }

  /**
   * Fazer requisição genérica para capturar uso de tokens
   */
  public async checkTokenUsage(): Promise<TokenMonitoringResult> {
    const startTime = Date.now();
    const result: TokenMonitoringResult = {
      success: false,
      totalTokensUsed: 0,
      promptTokens: 0,
      candidatesTokens: 0,
      duration: 0,
    };

    try {
      this.logger.info('🔍 Verificando uso de tokens do Gemini');

      // Prompt genérico simples para testar tokens
      const genericPrompt = `
Responda apenas "OK" para esta mensagem de teste.
Esta é uma requisição de monitoramento de tokens.
`;

      const response = await this.genAI.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: {
          parts: [{ text: genericPrompt }],
        },
      });

      // Capturar metadados de uso de tokens
      if (response.usageMetadata) {
        result.totalTokensUsed = response.usageMetadata.totalTokenCount || 0;
        result.promptTokens = response.usageMetadata.promptTokenCount || 0;
        result.candidatesTokens = response.usageMetadata.candidatesTokenCount || 0;
        result.thoughtsTokens = response.usageMetadata.thoughtsTokenCount;
        result.success = true;

        this.logger.info('📊 Token usage capturado com sucesso', {
          totalTokens: result.totalTokensUsed,
          promptTokens: result.promptTokens,
          candidatesTokens: result.candidatesTokens,
          thoughtsTokens: result.thoughtsTokens,
        });
      } else {
        throw new Error('usageMetadata não disponível na resposta');
      }

      result.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.error = errorMsg;
      result.duration = Date.now() - startTime;

      this.logger.error('❌ Falha ao verificar uso de tokens', {
        error: errorMsg,
        duration: result.duration,
      });

      return result;
    }
  }
}
