import { GoogleGenAI } from '@google/genai';
import config from '../../config';
import { createLogger } from '../../utils/logger';
import { PostOCRResult } from '../vision/index';
import { Category, CategoryDescriptions, CategoryLabels } from '../../types/category.enum';

// Interface para representar um produto em promoção
export interface GeminiPromotionProduct {
  description: string;
  price: string;
  category: string;
}

// Interface para representar um post dentro de uma promoção
export interface GeminiPromotionPost {
  postId: string;
  postCode: string;
  marketName: string;
  extractedText: string;
  products: GeminiPromotionProduct[];
}

// Interface para representar uma promoção
export interface GeminiPromotion {
  marketName: string;
  title: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  posts: GeminiPromotionPost[];
}

// Interface para resultado do processamento do Gemini
export interface GeminiProcessingResult {
  success: boolean;
  totalPosts: number;
  processedPosts: number;
  promotions: GeminiPromotion[];
  totalPromotions: number;
  duration: number;
  errors: string[];
}

export class GeminiService {
  private logger = createLogger('Gemini');
  private genAI: GoogleGenAI;
  //   private model: any;

  constructor() {
    this.genAI = new GoogleGenAI({ apiKey: config.google.APIKey });
    // this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  /**
   * Processar posts do Vision e extrair promoções estruturadas
   */
  public async execute(visionResults: PostOCRResult[]): Promise<GeminiProcessingResult> {
    const startTime = Date.now();
    const result: GeminiProcessingResult = {
      success: false,
      totalPosts: visionResults.length,
      processedPosts: 0,
      promotions: [],
      totalPromotions: 0,
      duration: 0,
      errors: [],
    };

    try {
      this.logger.info('🤖 Iniciando processamento com Gemini AI', {
        totalPosts: visionResults.length,
      });

      // Filtrar apenas posts que são catálogos de promoção
      const promotionPosts = visionResults.filter(
        (post) => post.isPromotionPost && post.combinedText.trim().length > 0,
      );

      if (promotionPosts.length === 0) {
        this.logger.warn('⚠️ Nenhum post de promoção encontrado para processar');
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      this.logger.info(`📋 Processando ${promotionPosts.length} posts de promoção`);

      // Agrupar posts por mercado para processamento em lote
      const postsByMarket = this.groupPostsByMarket(promotionPosts);

      // Processar cada mercado
      for (const [marketName, posts] of Object.entries(postsByMarket)) {
        try {
          const marketPromotions = await this.processMarketPosts(marketName, posts);
          result.promotions.push(...marketPromotions);
          result.processedPosts += posts.length;

          this.logger.info(`✅ Mercado processado: ${marketName}`, {
            posts: posts.length,
            promotions: marketPromotions.length,
          });
        } catch (error) {
          const errorMsg = `Erro ao processar mercado ${marketName}: ${error}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg, { marketName, postsCount: posts.length, error });
        }
      }

      // Agrupar promoções por período
      result.promotions = this.groupPromotionsByPeriod(result.promotions);
      result.totalPromotions = result.promotions.length;
      result.success = result.processedPosts > 0;
      result.duration = Date.now() - startTime;

      this.logger.info('📊 Processamento Gemini concluído', {
        totalPosts: result.totalPosts,
        processedPosts: result.processedPosts,
        totalPromotions: result.totalPromotions,
        errors: result.errors.length,
        duration: `${Math.round(result.duration / 1000)}s`,
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;

      this.logger.error('❌ Falha no processamento Gemini', { error, duration: result.duration });
      throw error;
    }
  }

  /**
   * Agrupar posts por mercado
   */
  private groupPostsByMarket(posts: PostOCRResult[]): Record<string, PostOCRResult[]> {
    return posts.reduce(
      (groups, post) => {
        const market = post.marketName;
        if (!groups[market]) {
          groups[market] = [];
        }
        groups[market].push(post);
        return groups;
      },
      {} as Record<string, PostOCRResult[]>,
    );
  }

  /**
   * Processar posts de um mercado específico
   */
  private async processMarketPosts(marketName: string, posts: PostOCRResult[]): Promise<GeminiPromotion[]> {
    this.logger.info(`🔍 Processando posts do mercado: ${marketName}`, { postsCount: posts.length });

    // Combinar todo o texto dos posts do mercado
    const combinedText = posts.map((post) => `POST ${post.postCode}:\n${post.combinedText}\n---\n`).join('\n');

    const prompt = this.buildPrompt(marketName, combinedText);

    try {
      // Usar a API correta do @google/genai
      const response = await this.genAI.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: {
          parts: [{ text: prompt }],
        },
      });

      const responseText = response.text!;

      this.logger.debug('🤖 Resposta do Gemini recebida', {
        marketName,
        responseLength: responseText.length,
      });

      // Parse da resposta JSON
      const promotionsData = this.parseGeminiResponse(responseText);

      // Converter para objetos Promotion
      const promotions = promotionsData.map((promoData) => this.createPromotionObject(promoData, posts, marketName));

      return promotions;
    } catch (error) {
      this.logger.error(`❌ Erro ao processar mercado ${marketName}`, { error });
      throw error;
    }
  }

  /**
   * Construir prompt para o Gemini
   */
  private buildPrompt(marketName: string, combinedText: string): string {
    const currentDate = new Date().toLocaleDateString('pt-BR');
    // Criar lista de categorias com descrições
    const categoriesWithDescriptions = Object.values(Category)
      .map((category) => {
        const description = CategoryDescriptions[category as keyof typeof CategoryDescriptions];
        return `${category} - ${description}`;
      })
      .join('\n');

    return `
Você é um especialista em análise de catálogos de promoções de supermercados. 
Analise o texto extraído via OCR dos posts do Instagram do mercado "${marketName}" e extraia as promoções estruturadas.

TEXTO DOS POSTS:
${combinedText}

CATEGORIAS DISPONÍVEIS:
${categoriesWithDescriptions}

INSTRUÇÕES:
1. Identifique TODAS as promoções mencionadas nos textos
2. Para cada promoção, extraia:
   - Título/descrição da promoção
   - Data de início (se não especificada, use a data atual: ${currentDate})
   - Data de fim (se não especificada, considere apenas 1 dia de duração)
   - Posts relacionados com seus respectivos produtos

3. Para cada produto, determine:
   - Descrição completa
   - Preço final da promoção
   - Categoria (escolha da lista de categorias disponíveis acima)

4. Agrupe promoções que tenham o MESMO PERÍODO de validade (startDate e endDate iguais)
5. Normalize as datas para o formato DD/MM/AAAA
6. Se o ano não for mencionado, considere o ano atual (2025)
7. Na descrição do produto, inclua todas as informações relevantes: nome, marca, quantidade, preço original (se houver), desconto, etc.

FORMATO DE RESPOSTA (JSON válido):
[
  {
    "title": "Nome da promoção",
    "startDate": "15/01/2025",
    "endDate": "20/01/2025",
    "posts": [
      {
        "postCode": "CÓDIGO_DO_POST",
        "products": [
          {
            "description": "Arroz Tio João 5kg - de R$ 25,90 por R$ 19,90 (23% de desconto)",
            "price": "R$ 19,90",
            "category": "MERCEARIA"
          },
          {
            "description": "Feijão Carioca Camil 1kg",
            "price": "R$ 8,50",
            "category": "MERCEARIA"
          },
          {
            "description": "Sabão em Pó OMO 1kg",
            "price": "R$ 12,99",
            "category": "LIMPEZA"
          }
        ]
      }
    ]
  }
]

REGRAS IMPORTANTES:
- Se não conseguir identificar nenhuma promoção válida, retorne um array vazio: []
- Mantenha apenas promoções com produtos e preços claramente identificados
- Ignore textos que não sejam relacionados a promoções
- Use apenas as informações presentes no texto, não invente dados
- Na descrição do produto, seja o mais completo possível incluindo detalhes como marca, tamanho, preço original se mencionado
- O campo "price" deve conter apenas o preço final da promoção no formato "R$ X,XX"
- O campo "category" deve ser exatamente uma das categorias da lista fornecida
- Associe corretamente os produtos aos posts onde foram encontrados
- Se não conseguir determinar a categoria exata, use "${Category.OUTROS}"

RESPOSTA (apenas JSON, sem explicações):`;
  }

  /**
   * Parse da resposta do Gemini
   */
  private parseGeminiResponse(responseText: string): any[] {
    try {
      // Limpar resposta e extrair JSON
      const cleanedResponse = responseText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(cleanedResponse);

      if (!Array.isArray(parsed)) {
        throw new Error('Resposta não é um array');
      }

      return parsed;
    } catch (error) {
      this.logger.error('❌ Erro ao fazer parse da resposta do Gemini', {
        error,
        responseText: responseText.substring(0, 200) + '...',
      });
      return [];
    }
  }

  /**
   * Criar objeto Promotion a partir dos dados parseados
   */
  private createPromotionObject(promoData: any, posts: PostOCRResult[], marketName: string): GeminiPromotion {
    // Converter datas para ISO string
    const startDate = this.parseDate(promoData.startDate);
    const endDate = this.parseDate(promoData.endDate);

    // Mapear posts do Gemini para posts completos
    const promotionPosts: GeminiPromotionPost[] =
      promoData.posts?.map((geminiPost: any) => {
        // Encontrar o post original pelo código
        const originalPost = posts.find((p) => p.postCode === geminiPost.postCode);

        return {
          postId: originalPost?.postId || '',
          postCode: geminiPost.postCode,
          marketName,
          extractedText: originalPost?.combinedText || '',
          products: geminiPost.products || [],
        };
      }) || [];

    return {
      marketName,
      title: promoData.title || 'Promoção',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      posts: promotionPosts,
    };
  }

  /**
   * Agrupar promoções por período igual
   */
  private groupPromotionsByPeriod(promotions: GeminiPromotion[]): GeminiPromotion[] {
    const grouped = new Map<string, GeminiPromotion>();

    promotions.forEach((promotion) => {
      const key = `${promotion.marketName}_${promotion.startDate}_${promotion.endDate}`;

      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        // Combinar posts
        existing.posts.push(...promotion.posts);
      } else {
        grouped.set(key, promotion);
      }
    });

    return Array.from(grouped.values());
  }

  /**
   * Parse de data em formato DD/MM/AAAA para Date
   */
  private parseDate(dateStr: string): Date {
    try {
      const [day, month, year] = dateStr.split('/').map(Number);
      return new Date(year || 2025, month - 1, day);
    } catch {
      // Fallback para data atual
      return new Date();
    }
  }
}
