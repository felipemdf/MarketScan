import config from '../../config';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { createLogger } from '../../utils/logger';
import { InstagramImage, InstagramPost } from '../instagram/index';

// Interface para resultado do OCR
export interface OCRResult {
  success: boolean;
  text: string;
  confidence: number;
  imageUrl: string;
  processingTime: number;
  isPromotionCatalog: boolean;
  error?: string;
}

// Interface para resultado do processamento de um post
export interface PostOCRResult {
  postId: string;
  postCode: string;
  marketName: string;
  success: boolean;
  totalImages: number;
  processedImages: number;
  ocrResults: OCRResult[];
  combinedText: string;
  isPromotionPost: boolean;
  processingTime: number;
  errors: string[];
}

// Interface para resultado geral do Vision processing
export interface VisionProcessingResult {
  success: boolean;
  totalPosts: number;
  processedPosts: number;
  totalImages: number;
  processedImages: number;
  promotionPosts: number;
  duration: number;
  results: PostOCRResult[];
  errors: string[];
}

export class VisionService {
  private logger = createLogger('Vision');
  private client: ImageAnnotatorClient;

  // Palavras-chave que indicam catálogo de promoção
  private readonly PROMOTION_KEYWORDS = [
    'promoção',
    'promocao',
    'oferta',
    'desconto',
    'liquidação',
    'liquidacao',
    'barato',
    'preço',
    'preco',
    'real',
    'r$',
    'por',
    'de',
    'ate',
    'até',
    'super',
    'mega',
    'hiper',
    'extra',
    'especial',
    'imperdível',
    'imperdivel',
    'queima',
    'saldão',
    'saldao',
    'black',
    'friday',
    'feira',
    'semana',
    'válido',
    'valido',
    'dias',
    'domingo',
    'segunda',
    'terça',
    'terca',
    'quarta',
    'quinta',
    'sexta',
    'sábado',
    'sabado',
  ];

  // Padrões regex para identificar preços
  private readonly PRICE_PATTERNS = [
    /R\$\s*\d+[,.]?\d*/gi,
    /\d+[,.]?\d*\s*reais?/gi,
    /por\s+\d+[,.]?\d*/gi,
    /de\s+\d+[,.]?\d*\s+por\s+\d+[,.]?\d*/gi,
  ];

  constructor() {
    this.client = new ImageAnnotatorClient({ apiKey: config.vision.APIKey });
  }

  /**
   * Processar todos os posts do Instagram com Google Vision
   */
  public async execute(posts: InstagramPost[]): Promise<VisionProcessingResult> {
    const startTime = Date.now();
    const result: VisionProcessingResult = {
      success: false,
      totalPosts: posts.length,
      processedPosts: 0,
      totalImages: 0,
      processedImages: 0,
      promotionPosts: 0,
      duration: 0,
      results: [],
      errors: [],
    };

    try {
      this.logger.info('🔍 Iniciando processamento com Google Vision', {
        totalPosts: posts.length,
      });

      // Contar total de imagens
      result.totalImages = posts.reduce((sum, post) => sum + post.images.length, 0);

      // Processar cada post
      for (const post of posts) {
        try {
          const postResult = await this.processPost(post);
          result.results.push(postResult);

          if (postResult.success) {
            result.processedPosts++;
            result.processedImages += postResult.processedImages;

            if (postResult.isPromotionPost) {
              result.promotionPosts++;
            }
          }

          if (postResult.errors.length > 0) {
            result.errors.push(...postResult.errors);
          }

          this.logger.info(`✅ Post processado: ${post.postCode}`, {
            market: post.marketName,
            images: postResult.processedImages,
            isPromotion: postResult.isPromotionPost,
            textLength: postResult.combinedText.length,
          });
        } catch (error) {
          const errorMsg = `Erro ao processar post ${post.postCode}: ${error}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg, { postId: post.id, error });
        }
      }

      result.success = result.processedPosts > 0;
      result.duration = Date.now() - startTime;

      this.logger.info('📊 Processamento Vision concluído', {
        totalPosts: result.totalPosts,
        processedPosts: result.processedPosts,
        totalImages: result.totalImages,
        processedImages: result.processedImages,
        promotionPosts: result.promotionPosts,
        errors: result.errors.length,
        duration: `${Math.round(result.duration / 1000)}s`,
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;

      this.logger.error('❌ Falha no processamento Vision', { error, duration: result.duration });
      throw error;
    }
  }

  /**
   * Processar um post específico do Instagram
   */
  private async processPost(post: InstagramPost): Promise<PostOCRResult> {
    const startTime = Date.now();
    const result: PostOCRResult = {
      postId: post.id,
      postCode: post.postCode,
      marketName: post.marketName,
      success: false,
      totalImages: post.images.length,
      processedImages: 0,
      ocrResults: [],
      combinedText: '',
      isPromotionPost: false,
      processingTime: 0,
      errors: [],
    };

    try {
      this.logger.info(`🖼️ Processando post ${post.postCode}`, {
        market: post.marketName,
        images: post.images.length,
        isCarousel: post.isCarousel,
      });

      // Processar cada imagem do post
      for (let i = 0; i < post.images.length; i++) {
        try {
          const image = post.images[i];
          const ocrResult = await this.processImage(image);

          result.ocrResults.push(ocrResult);

          if (ocrResult.success) {
            result.processedImages++;
            result.combinedText += ocrResult.text + '\n';
          }

          this.logger.debug(`📝 Imagem ${i + 1}/${post.images.length} processada`, {
            success: ocrResult.success,
            textLength: ocrResult.text.length,
            confidence: ocrResult.confidence,
            isPromotion: ocrResult.isPromotionCatalog,
          });
        } catch (error) {
          const errorMsg = `Erro na imagem ${i + 1}: ${error}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg, { postCode: post.postCode, imageIndex: i, error });
        }
      }

      // Verificar se é post de promoção baseado no texto combinado
      result.isPromotionPost = this.isPromotionCatalog(result.combinedText);
      result.success = result.processedImages > 0;
      result.processingTime = Date.now() - startTime;

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      result.processingTime = Date.now() - startTime;

      this.logger.error(`❌ Falha ao processar post ${post.postCode}`, { error });
      return result;
    }
  }

  /**
   * Processar uma imagem individual com Google Vision OCR
   */
  private async processImage(image: InstagramImage): Promise<OCRResult> {
    const startTime = Date.now();
    const result: OCRResult = {
      success: false,
      text: '',
      confidence: 0,
      imageUrl: image.url,
      processingTime: 0,
      isPromotionCatalog: false,
    };

    try {
      this.logger.debug('🔍 Executando OCR na imagem', {
        url: image.url,
        dimensions: `${image.width}x${image.height}`,
      });

      // Baixar a imagem e converter para base64
      const imageBuffer = await this.downloadImage(image.url);
      const base64Image = imageBuffer.toString('base64');

      // Fazer requisição para Google Vision API
      const [response] = await this.client.textDetection({
        image: {
          content: base64Image,
        },
      });
      const detections = response.textAnnotations || [];

      if (detections.length === 0) {
        result.error = 'Nenhum texto detectado na imagem';
        this.logger.debug('⚠️ Nenhum texto encontrado na imagem');
        return result;
      }

      // O primeiro elemento contém todo o texto detectado
      const fullTextAnnotation = detections[0];
      result.text = fullTextAnnotation.description || '';
      result.confidence = this.calculateConfidence(detections);
      result.success = true;
      result.isPromotionCatalog = this.isPromotionCatalog(result.text);
      result.processingTime = Date.now() - startTime;

      this.logger.debug('✅ OCR concluído', {
        textLength: result.text.length,
        confidence: result.confidence,
        isPromotion: result.isPromotionCatalog,
        processingTime: `${result.processingTime}ms`,
      });

      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Erro desconhecido';
      result.processingTime = Date.now() - startTime;

      this.logger.error('❌ Erro no OCR', {
        imageUrl: image.url,
        error: result.error,
        processingTime: `${result.processingTime}ms`,
      });

      return result;
    }
  }

  /**
   * Verificar se o texto indica um catálogo de promoção
   */
  private isPromotionCatalog(text: string): boolean {
    if (!text || text.trim().length === 0) {
      return false;
    }

    const normalizedText = text.toLowerCase();

    // Verificar palavras-chave de promoção
    const hasPromotionKeywords = this.PROMOTION_KEYWORDS.some((keyword) => normalizedText.includes(keyword));

    // Verificar padrões de preço
    const hasPricePatterns = this.PRICE_PATTERNS.some((pattern) => pattern.test(text));

    // Contar palavras-chave encontradas
    const keywordCount = this.PROMOTION_KEYWORDS.filter((keyword) => normalizedText.includes(keyword)).length;

    // Lógica de decisão
    const isPromotion = (hasPromotionKeywords && hasPricePatterns) || keywordCount >= 3;

    this.logger.debug('🎯 Análise de catálogo de promoção', {
      hasPromotionKeywords,
      hasPricePatterns,
      keywordCount,
      isPromotion,
      textPreview: text.substring(0, 100) + '...',
    });

    return isPromotion;
  }

  /**
   * Calcular confiança média das detecções
   */
  private calculateConfidence(detections: any[]): number {
    if (detections.length === 0) return 0;

    // Pular o primeiro elemento (texto completo) e calcular média dos demais
    const wordDetections = detections.slice(1);
    if (wordDetections.length === 0) return 0.8; // Confiança padrão se só tem texto completo

    const totalConfidence = wordDetections.reduce((sum, detection) => {
      return sum + (detection.confidence || 0.8);
    }, 0);

    return Math.round((totalConfidence / wordDetections.length) * 100) / 100;
  }

  /**
   * Extrair preços do texto usando regex
   */
  public extractPrices(text: string): string[] {
    const prices: string[] = [];

    this.PRICE_PATTERNS.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        prices.push(...matches);
      }
    });

    // Remover duplicatas e normalizar
    return [...new Set(prices)].map((price) => price.trim());
  }

  /**
   * Baixar imagem da URL e retornar como Buffer
   */
  private async downloadImage(url: string): Promise<Buffer> {
    try {
      this.logger.debug('📥 Baixando imagem', { url });

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept: 'image/*,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-US,en;q=0.9,pt;q=0.8',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error(`Tipo de conteúdo inválido: ${contentType}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      this.logger.debug('✅ Imagem baixada com sucesso', {
        url,
        size: `${Math.round(buffer.length / 1024)}KB`,
        contentType,
      });

      return buffer;
    } catch (error) {
      this.logger.error('❌ Erro ao baixar imagem', { url, error });
      throw new Error(`Falha ao baixar imagem: ${error}`);
    }
  }
}
