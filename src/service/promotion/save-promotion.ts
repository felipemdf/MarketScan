import { getDataSource } from '../../database/connection';
import { Market } from '../../database/entities/market.entity';
import { Post } from '../../database/entities/post.entity';
import { Product } from '../../database/entities/product.entity';
import { Promotion } from '../../database/entities/promotion.entity';
import { GeminiProcessingResult, GeminiPromotion, GeminiPromotionPost, GeminiPromotionProduct } from '../gemini';
import { Repository } from 'typeorm';
import { Category } from '../../types/category.enum';
import { createLogger } from '../../utils/logger';

// Interface para resultado do salvamento no banco
export interface DatabaseSaveResult {
  success: boolean;
  totalPromotions: number;
  savedPromotions: number;
  totalPosts: number;
  savedPosts: number;
  totalProducts: number;
  savedProducts: number;
  duration: number;
  errors: string[];
}

export class SavePromotionService {
  private logger = createLogger('Database');
  private promotionRepository!: Repository<Promotion>;
  private postRepository!: Repository<Post>;
  private productRepository!: Repository<Product>;
  private marketRepository!: Repository<Market>;

  constructor() {
    this.initializeRepositories();
  }

  /**
   * Inicializar repositórios
   */
  private initializeRepositories(): void {
    const dataSource = getDataSource();
    this.promotionRepository = dataSource.getRepository(Promotion);
    this.postRepository = dataSource.getRepository(Post);
    this.productRepository = dataSource.getRepository(Product);
    this.marketRepository = dataSource.getRepository(Market);
  }

  /**
   * Salvar resultado do Gemini no banco de dados
   */
  public async saveGeminiResults(geminiResult: GeminiProcessingResult): Promise<DatabaseSaveResult> {
    const startTime = Date.now();
    const result: DatabaseSaveResult = {
      success: false,
      totalPromotions: geminiResult.promotions.length,
      savedPromotions: 0,
      totalPosts: 0,
      savedPosts: 0,
      totalProducts: 0,
      savedProducts: 0,
      duration: 0,
      errors: [],
    };

    try {
      this.logger.info('💾 Iniciando salvamento no banco de dados', {
        totalPromotions: geminiResult.promotions.length,
      });

      // Contar totais
      result.totalPosts = geminiResult.promotions.reduce((sum, promo) => sum + promo.posts.length, 0);
      result.totalProducts = geminiResult.promotions.reduce(
        (sum, promo) => sum + promo.posts.reduce((postSum, post) => postSum + post.products.length, 0),
        0,
      );

      // Processar cada promoção
      for (const geminiPromotion of geminiResult.promotions) {
        try {
          const saveStats = await this.savePromotion(geminiPromotion);

          result.savedPromotions += saveStats.savedPromotions;
          result.savedPosts += saveStats.savedPosts;
          result.savedProducts += saveStats.savedProducts;

          this.logger.info(`✅ Promoção processada: ${geminiPromotion.title}`, {
            market: geminiPromotion.marketName,
            savedPosts: saveStats.savedPosts,
            savedProducts: saveStats.savedProducts,
          });
        } catch (error) {
          const errorMsg = `Erro ao salvar promoção ${geminiPromotion.title}: ${error}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg, { error, promotion: geminiPromotion.title });
        }
      }

      result.success = result.savedPromotions > 0 || result.savedPosts > 0;
      result.duration = Date.now() - startTime;

      this.logger.info('📊 Salvamento no banco concluído', {
        totalPromotions: result.totalPromotions,
        savedPromotions: result.savedPromotions,
        totalPosts: result.totalPosts,
        savedPosts: result.savedPosts,
        totalProducts: result.totalProducts,
        savedProducts: result.savedProducts,
        errors: result.errors.length,
        duration: `${Math.round(result.duration / 1000)}s`,
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;

      this.logger.error('❌ Falha no salvamento no banco', { error, duration: result.duration });
      throw error;
    }
  }

  /**
   * Salvar uma promoção específica
   */
  private async savePromotion(geminiPromotion: GeminiPromotion): Promise<{
    savedPromotions: number;
    savedPosts: number;
    savedProducts: number;
  }> {
    const stats = { savedPromotions: 0, savedPosts: 0, savedProducts: 0 };

    // 1. Buscar ou criar o mercado
    const market = await this.findMarket(geminiPromotion.marketName);

    // 2. Verificar se a promoção já existe
    let promotion = await this.findExistingPromotion(
      market.id,
      new Date(geminiPromotion.startDate),
      new Date(geminiPromotion.endDate),
    );

    // 3. Criar nova promoção se não existir
    if (!promotion) {
      promotion = await this.createPromotion(geminiPromotion, market);
      stats.savedPromotions = 1;

      this.logger.info(`📝 Nova promoção criada`, {
        id: promotion.id,
        market: market.name,
        startDate: geminiPromotion.startDate,
        endDate: geminiPromotion.endDate,
      });
    } else {
      this.logger.info(`🔄 Promoção existente encontrada`, {
        id: promotion.id,
        market: market.name,
      });
    }

    // 4. Processar posts da promoção
    for (const geminiPost of geminiPromotion.posts) {
      try {
        const postStats = await this.savePost(geminiPost, promotion);
        stats.savedPosts += postStats.savedPosts;
        stats.savedProducts += postStats.savedProducts;
      } catch (error) {
        this.logger.error(`Erro ao salvar post ${geminiPost.postCode}`, { error });
      }
    }

    return stats;
  }

  /**
   * Buscar  mercado
   */
  private async findMarket(marketName: string): Promise<Market> {
    const market = await this.marketRepository.findOne({
      where: { name: marketName },
    });

    if (!market) {
      throw new Error(`Mercado não encontrado: ${marketName}`);
    }

    return market;
  }

  /**
   * Buscar promoção existente
   */
  private async findExistingPromotion(marketId: number, startDate: Date, endDate: Date): Promise<Promotion | null> {
    return await this.promotionRepository.findOne({
      where: {
        marketId,
        startDate,
        endDate,
      },
    });
  }

  /**
   * Criar nova promoção
   */
  private async createPromotion(geminiPromotion: GeminiPromotion, market: Market): Promise<Promotion> {
    const promotion = this.promotionRepository.create({
      marketId: market.id,
      startDate: new Date(geminiPromotion.startDate),
      endDate: new Date(geminiPromotion.endDate),
    });

    return await this.promotionRepository.save(promotion);
  }

  /**
   * Salvar post e seus produtos
   */
  private async savePost(
    geminiPost: GeminiPromotionPost,
    promotion: Promotion,
  ): Promise<{
    savedPosts: number;
    savedProducts: number;
  }> {
    const stats = { savedPosts: 0, savedProducts: 0 };

    // Verificar se o post já existe
    const existingPost = await this.postRepository.findOne({
      where: { postCode: geminiPost.postCode },
    });

    if (existingPost) {
      this.logger.debug(`📋 Post já existe: ${geminiPost.postCode}`, {
        postId: existingPost.id,
        promotionId: existingPost.promotionId,
      });
      return stats; // Não faz nada se o post já existe
    }

    // Criar novo post
    const post = this.postRepository.create({
      postCode: geminiPost.postCode,
      promotionId: promotion.id,
      publishedAt: new Date(), // Usar data atual ou extrair do geminiPost se disponível
      extractedAt: new Date(),
    });

    const savedPost = await this.postRepository.save(post);
    stats.savedPosts = 1;

    this.logger.info(`📝 Novo post criado: ${geminiPost.postCode}`, {
      postId: savedPost.id,
      promotionId: promotion.id,
      productsCount: geminiPost.products.length,
    });

    // Salvar produtos do post
    for (const geminiProduct of geminiPost.products) {
      try {
        await this.saveProduct(geminiProduct, savedPost);
        stats.savedProducts++;
      } catch (error) {
        this.logger.error(`Erro ao salvar produto do post ${geminiPost.postCode}`, {
          error,
          product: geminiProduct.description,
        });
      }
    }

    return stats;
  }

  /**
   * Salvar produto
   */
  private async saveProduct(geminiProduct: GeminiPromotionProduct, post: Post): Promise<Product> {
    const product = this.productRepository.create({
      postId: post.id,
      description: geminiProduct.description,
      price: this.extractNumericPrice(geminiProduct.price),
      category: Category[geminiProduct.category as keyof typeof Category] || Category.OUTROS,
    });

    const savedProduct = await this.productRepository.save(product);

    this.logger.debug(`🛍️ Produto salvo: ${geminiProduct.description}`, {
      productId: savedProduct.id,
      postId: post.id,
      price: geminiProduct.price,
    });

    return savedProduct;
  }

  /**
   * Extrair valor numérico do preço
   */
  private extractNumericPrice(priceString: string): number {
    try {
      // Remove "R$", espaços e converte vírgula para ponto
      const numericString = priceString
        .replace(/R\$\s*/g, '')
        .replace(/\./g, '') // Remove pontos (milhares)
        .replace(',', '.'); // Converte vírgula para ponto (decimais)

      return parseFloat(numericString) || 0;
    } catch {
      return 0;
    }
  }
}
