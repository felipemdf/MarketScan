import config from '../../config';
import { getDataSource } from '../../database/connection';
import { Market } from '../../database/entities/market.entity';
import { IgApiClient } from 'instagram-private-api';
import { createLogger } from '../../utils/logger';

// Interface para post do Instagram
export interface InstagramPost {
  id: string;
  marketId: number;
  marketName: string;
  marketUsername: string;
  postCode: string;
  postUrl: string;
  caption: string;
  publishedAt: Date;
  images: InstagramImage[];
  isCarousel: boolean;
}

// Interface para imagem do post
export interface InstagramImage {
  url: string;
  width: number;
  height: number;
}

// Interface para resultado do scraping
export interface InstagramScrapingResult {
  success: boolean;
  totalMarkets: number;
  processedMarkets: number;
  totalPosts: number;
  filteredPosts: number;
  posts: InstagramPost[];
  errors: string[];
  duration: number;
  targetDate: Date;
}

export interface InstagramScrapingOptions {
  targetDate?: Date; // Data específica para buscar posts (opcional)
  includePreviousDay?: boolean; // Se true, busca posts do dia anterior
}

export class InstagramService {
  private logger = createLogger('Instagram');
  private ig: IgApiClient;
  private isLoggedIn: boolean = false;

  constructor() {
    this.ig = new IgApiClient();
  }

  /**
   * Método principal para buscar posts de todos os mercados
   */
  public async execute(options: InstagramScrapingOptions = {}): Promise<InstagramScrapingResult> {
    const startTime = Date.now();

    // Determinar a data alvo
    const targetDate = this.determineTargetDate(options);

    const result: InstagramScrapingResult = {
      success: false,
      totalMarkets: 0,
      processedMarkets: 0,
      totalPosts: 0,
      filteredPosts: 0,
      posts: [],
      errors: [],
      duration: 0,
      targetDate: targetDate,
    };

    try {
      this.logger.info('🚀 Iniciando scraping do Instagram');

      // 1. Login no Instagram
      await this.login();

      // 2. Buscar mercados ativos no banco
      const markets = await this.getMarkets();
      result.totalMarkets = markets.length;

      if (markets.length === 0) {
        throw new Error('Nenhum mercado encontrado no banco');
      }

      this.logger.info(`📍 Encontrados ${markets.length} mercados para processar`);

      // 3. Processar cada mercado
      for (const market of markets) {
        try {
          const marketPosts = await this.scrapeMarketPosts(market);
          result.posts.push(...marketPosts);
          result.totalPosts += marketPosts.length;
          result.processedMarkets++;

          this.logger.info(`✅ Mercado ${market.name}: ${marketPosts.length} posts encontrados`);
        } catch (error) {
          const errorMsg = `Erro ao processar mercado ${market.name}: ${error}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg, { marketId: market.id, error });
        }
      }

      // 4. Filtrar posts do dia atual
      result.posts = this.filterPostsByDate(result.posts, result.targetDate);
      result.filteredPosts = result.posts.length;

      result.success = result.errors.length === 0 || result.posts.length > 0;
      result.duration = Date.now() - startTime;

      this.logger.info('✅ Scraping concluído', {
        totalMarkets: result.totalMarkets,
        processedMarkets: result.processedMarkets,
        totalPosts: result.totalPosts,
        filteredPosts: result.filteredPosts,
        errors: result.errors.length,
        duration: `${Math.round(result.duration / 1000)}s`,
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;

      this.logger.error('❌ Falha no scraping do Instagram', { error, duration: result.duration });
      throw error;
    }
  }

  /**
   * Login no Instagram usando credenciais do .env
   */
  private async login(): Promise<void> {
    if (this.isLoggedIn) {
      this.logger.info('✅ Já logado no Instagram');
      return;
    }

    try {
      this.logger.info('🔐 Fazendo login no Instagram');

      // Configurar device
      this.ig.state.generateDevice(config.instagram.username);

      // Fazer login
      await this.ig.account.login(config.instagram.username, config.instagram.password);

      this.isLoggedIn = true;
      this.logger.info('✅ Login realizado com sucesso');
    } catch (error) {
      this.logger.error('❌ Falha no login do Instagram', { error });
      throw new Error(`Falha no login: ${error}`);
    }
  }

  /**
   * Buscar mercados no banco de dados
   */
  private async getMarkets(): Promise<Market[]> {
    try {
      const dataSource = getDataSource();
      const marketRepo = dataSource.getRepository(Market);

      const markets = await marketRepo.find();

      this.logger.info('📋 Mercados carregados', {
        count: markets.length,
        markets: markets.map((m) => ({ id: m.id, name: m.name, username: m.instagramUsername })),
      });

      return markets;
    } catch (error) {
      this.logger.error('❌ Erro ao buscar mercados no banco', { error });
      throw new Error('Falha ao carregar mercados do banco');
    }
  }

  /**
   * Buscar posts de um mercado específico
   */
  private async scrapeMarketPosts(market: Market): Promise<InstagramPost[]> {
    this.logger.info(`🔍 Processando mercado: ${market.name}`, {
      username: market.instagramUsername,
      city: market.city,
    });

    try {
      // Buscar usuário pelo username
      const userId = await this.ig.user.getIdByUsername(market.instagramUsername);

      // Buscar posts do usuário
      const userFeed = this.ig.feed.user(userId);
      const posts = await userFeed.items();

      this.logger.info(`📸 ${posts.length} posts encontrados para ${market.instagramUsername}`);

      const instagramPosts: InstagramPost[] = [];

      for (const post of posts) {
        try {
          // Pular vídeos
          if (post.video_versions && post.video_versions.length > 0) {
            this.logger.debug(`⏭️ Pulando vídeo: ${post.code}`);
            continue;
          }

          // Processar imagens do post
          const images = this.extractImages(post);

          if (images.length === 0) {
            this.logger.debug(`⏭️ Post sem imagens válidas: ${post.code}`);
            continue;
          }

          const instagramPost: InstagramPost = {
            id: post.id,
            marketId: market.id,
            marketName: market.name,
            marketUsername: market.instagramUsername,
            postCode: post.code,
            postUrl: `https://instagram.com/p/${post.code}`,
            caption: post.caption?.text || '',
            publishedAt: new Date(post.taken_at * 1000),
            images,
            isCarousel: (post.carousel_media_count ?? 0) > 1,
          };

          instagramPosts.push(instagramPost);

          this.logger.debug(`✅ Post processado: ${post.code}`, {
            images: images.length,
            isCarousel: instagramPost.isCarousel,
            publishedAt: instagramPost.publishedAt,
          });
        } catch (error) {
          this.logger.error(`❌ Erro ao processar post ${post.code}`, { error });
        }
      }

      this.logger.info(`✅ ${instagramPosts.length} posts válidos para ${market.name}`);
      return instagramPosts;
    } catch (error) {
      this.logger.error(`❌ Erro ao buscar posts de ${market.instagramUsername}`, { error });
      throw new Error(`Falha ao processar ${market.name}: ${error}`);
    }
  }

  /**
   * Extrair imagens do post (incluindo carrossel)
   */
  private extractImages(post: any): InstagramImage[] {
    const images: InstagramImage[] = [];

    try {
      // Se for carrossel, processar todas as imagens
      if (post.carousel_media && post.carousel_media.length > 0) {
        for (const media of post.carousel_media) {
          if (media.image_versions2 && media.image_versions2.candidates) {
            const bestImage = media.image_versions2.candidates[0];
            images.push({
              url: bestImage.url,
              width: bestImage.width,
              height: bestImage.height,
            });
          }
        }
      }
      // Se for post simples, pegar a imagem principal
      else if (post.image_versions2 && post.image_versions2.candidates) {
        const bestImage = post.image_versions2.candidates[0];
        images.push({
          url: bestImage.url,
          width: bestImage.width,
          height: bestImage.height,
        });
      }
    } catch (error) {
      this.logger.error('❌ Erro ao extrair imagens do post', { postId: post.id, error });
    }

    return images;
  }

  /**
   * Filtrar posts publicados hoje
   */
  private filterPostsByDate(posts: InstagramPost[], targetDate: Date): InstagramPost[] {
    // Normalizar a data alvo para início do dia
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    // Fim do dia
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const filteredPosts = posts.filter((post) => {
      return post.publishedAt >= startOfDay && post.publishedAt < endOfDay;
    });

    this.logger.info(
      `🗓️ Posts filtrados para ${targetDate.toISOString().split('T')[0]}: ${filteredPosts.length}/${posts.length}`,
      {
        targetDate: targetDate.toISOString().split('T')[0],
        filteredPosts: filteredPosts.map((p) => ({
          market: p.marketName,
          postCode: p.postCode,
          publishedAt: p.publishedAt.toISOString(),
        })),
      },
    );

    return filteredPosts;
  }

  /**
   * Logout do Instagram (cleanup)
   */
  public async logout(): Promise<void> {
    if (!this.isLoggedIn) return;

    try {
      this.logger.info('👋 Fazendo logout do Instagram');
      // Note: instagram-private-api não tem método de logout explícito
      this.isLoggedIn = false;
      this.logger.info('✅ Logout realizado');
    } catch (error) {
      this.logger.error('⚠️ Erro no logout', { error });
    }
  }

  /**
   * Método utilitário para testar conexão com um mercado específico
   */
  public async testMarketConnection(username: string): Promise<boolean> {
    try {
      await this.login();

      const userId = await this.ig.user.getIdByUsername(username);
      const userInfo = await this.ig.user.info(userId);

      this.logger.info(`✅ Teste de conexão: ${username}`, {
        fullName: userInfo.full_name,
        followers: userInfo.follower_count,
        posts: userInfo.media_count,
      });

      return true;
    } catch (error) {
      this.logger.error(`❌ Falha no teste de conexão: ${username}`, { error });
      return false;
    }
  }

  private determineTargetDate(options: InstagramScrapingOptions): Date {
    if (options.targetDate) {
      this.logger.info('📅 Usando data específica fornecida', {
        targetDate: options.targetDate.toISOString().split('T')[0],
      });
      return new Date(options.targetDate);
    }

    const today = new Date();

    if (options.includePreviousDay) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      this.logger.info('📅 Usando dia anterior', {
        targetDate: yesterday.toISOString().split('T')[0],
      });

      return yesterday;
    }

    this.logger.info('📅 Usando dia atual', {
      targetDate: today.toISOString().split('T')[0],
    });

    return today;
  }
}
