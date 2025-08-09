import nodemailer from 'nodemailer';
import { getDataSource } from '../../database/connection';
import { Promotion } from '../../database/entities/promotion.entity';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { createLogger } from '../../utils/logger';
import config from '../../config';

// Interface para o resultado do envio de email
export interface EmailSendResult {
  success: boolean;
  totalPromotions: number;
  emailsSent: number;
  duration: number;
  errors: string[];
}

// Interface para produto no email
interface ProductEmailData {
  description: string;
  price: number;
  category: string;
  validUntil: string;
  postUrl: string;
  marketName: string;
}

// Interface para categoria agrupada
interface CategoryGroup {
  categoryName: string;
  products: ProductEmailData[];
}

export class EmailService {
  private logger = createLogger('Email');
  private promotionRepository!: Repository<Promotion>;
  private transporter!: nodemailer.Transporter;

  constructor() {
    this.initializeRepositories();
    this.initializeTransporter();
  }

  /**
   * Inicializar repositórios
   */
  private initializeRepositories(): void {
    const dataSource = getDataSource();
    this.promotionRepository = dataSource.getRepository(Promotion);
  }

  /**
   * Inicializar transporter do nodemailer
   */
  private initializeTransporter(): void {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });
  }

  /**
   * Enviar email com promoções ativas
   */
  public async sendActivePromotions(): Promise<EmailSendResult> {
    const startTime = Date.now();
    const result: EmailSendResult = {
      success: false,
      totalPromotions: 0,
      emailsSent: 0,
      duration: 0,
      errors: [],
    };

    try {
      this.logger.info('📧 Iniciando envio de emails das promoções ativas');

      // 1. Buscar promoções ativas no dia atual
      const activePromotions = await this.getActivePromotions();
      result.totalPromotions = activePromotions.length;

      if (activePromotions.length === 0) {
        this.logger.warn('⚠️ Nenhuma promoção ativa encontrada para hoje');
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      this.logger.info(`📋 Encontradas ${activePromotions.length} promoções ativas`);

      // 2. Extrair todos os produtos das promoções
      const allProducts = this.extractAllProducts(activePromotions);

      // 3. Agrupar produtos por categoria
      const categorizedProducts = this.groupProductsByCategory(allProducts);

      // 4. Gerar HTML do email
      const emailHtml = this.generateEmailHtml(categorizedProducts);

      // 5. Enviar email
      await this.sendEmail(emailHtml);
      result.emailsSent = 1;

      result.success = true;
      result.duration = Date.now() - startTime;

      this.logger.info('📊 Envio de emails concluído', {
        totalPromotions: result.totalPromotions,
        emailsSent: result.emailsSent,
        duration: `${Math.round(result.duration / 1000)}s`,
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;

      this.logger.error('❌ Falha no envio de emails', { error, duration: result.duration });
      throw error;
    }
  }

  /**
   * Buscar promoções ativas no dia atual
   */
  private async getActivePromotions(): Promise<Promotion[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Início do dia

    const promotions = await this.promotionRepository.find({
      where: {
        startDate: LessThanOrEqual(today),
        endDate: MoreThanOrEqual(today),
      },
      relations: ['market', 'posts', 'posts.products'],
      order: {
        market: { name: 'ASC' },
        startDate: 'ASC',
      },
    });

    this.logger.info(`🔍 Consultando promoções ativas para ${today.toLocaleDateString('pt-BR')}`, {
      foundPromotions: promotions.length,
    });

    return promotions;
  }

  /**
   * Extrair todos os produtos das promoções
   */
  private extractAllProducts(promotions: Promotion[]): ProductEmailData[] {
    const products: ProductEmailData[] = [];

    promotions.forEach((promotion) => {
      promotion.posts.forEach((post) => {
        post.products.forEach((product) => {
          products.push({
            description: product.description,
            price: product.price,
            category: product.category,
            validUntil: promotion.endDate.toLocaleDateString('pt-BR'),
            postUrl: post.postUrl || `https://www.instagram.com/p/${post.postCode}/`,
            marketName: promotion.market.name,
          });
        });
      });
    });

    return products;
  }

  /**
   * Agrupar produtos por categoria
   */
  private groupProductsByCategory(products: ProductEmailData[]): CategoryGroup[] {
    const grouped = products.reduce(
      (acc, product) => {
        if (!acc[product.category]) {
          acc[product.category] = [];
        }
        acc[product.category].push(product);
        return acc;
      },
      {} as Record<string, ProductEmailData[]>,
    );

    // Ordenar categorias alfabeticamente e produtos por preço
    return Object.keys(grouped)
      .sort()
      .map((categoryName) => ({
        categoryName,
        products: grouped[categoryName].sort((a, b) => a.price - b.price),
      }));
  }

  /**
   * Gerar HTML do email
   */
  private generateEmailHtml(categories: CategoryGroup[]): string {
    const currentDate = new Date().toLocaleDateString('pt-BR');
    const totalProducts = categories.reduce((sum, cat) => sum + cat.products.length, 0);

    const categoriesHtml = categories
      .map((category) => {
        const productsHtml = category.products
          .map((product) => {
            return `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">
              <strong>${product.description}</strong><br>
              <small style="color: #666; font-size: 12px;">📍 ${product.marketName}</small>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
              <span style="background: #f8f9fa; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                ${product.validUntil}
              </span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #27ae60; font-size: 16px;">
              R$ ${product.price.toFixed(2).replace('.', ',')}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
              <a href="${product.postUrl}" target="_blank" style="color: #3498db; text-decoration: none; font-size: 18px;">
                🔗
              </a>
            </td>
          </tr>
        `;
          })
          .join('');

        return `
      <div style="margin-bottom: 30px;">
        <h3 style="color: #2c3e50; margin: 0 0 15px 0; padding: 10px 0; border-bottom: 2px solid #3498db; font-size: 20px;">
          📦 ${category.categoryName} (${category.products.length} produtos)
        </h3>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <thead>
            <tr style="background: #34495e; color: white;">
              <th style="padding: 15px; text-align: left; font-weight: 600;">Produto</th>
              <th style="padding: 15px; text-align: center; font-weight: 600;">Válido até</th>
              <th style="padding: 15px; text-align: right; font-weight: 600;">Preço</th>
              <th style="padding: 15px; text-align: center; font-weight: 600;">Ver Post</th>
            </tr>
          </thead>
          <tbody>
            ${productsHtml}
          </tbody>
        </table>
      </div>
    `;
      })
      .join('');

    return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Market Scan - Promoções do Dia</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4;">
    <div style="max-width: 900px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1);">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">📊 Market Scan</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
          📅 Relatório de promoções do dia ${currentDate}
        </p>
      </div>

      <!-- Content -->
      <div style="padding: 30px;">
        <div style="background: #e8f5e8; border-left: 4px solid #27ae60; padding: 15px; margin-bottom: 30px; border-radius: 5px;">
          <p style="margin: 0; color: #27ae60; font-weight: bold;">
            ✅ Encontramos ${totalProducts} produto(s) em promoção hoje!
          </p>
        </div>

        ${categoriesHtml}
      </div>

      <!-- Footer -->
      <div style="background: #ecf0f1; padding: 20px; text-align: center; color: #7f8c8d;">
        <p style="margin: 0; font-size: 14px;">
          🤖 Email gerado automaticamente pelo Market Scan<br>
          <small>Sistema de monitoramento de promoções de supermercados</small>
        </p>
      </div>
    </div>
  </body>
  </html>
`;
  }

  /**
   * Enviar email
   */
  private async sendEmail(htmlContent: string): Promise<void> {
    const currentDate = new Date().toLocaleDateString('pt-BR');

    const mailOptions = {
      from: config.email.user,
      to: config.email.recipient,
      subject: `📊 Market Scan - Promoções do Dia ${currentDate}`,
      html: htmlContent,
    };

    await this.transporter.sendMail(mailOptions);

    this.logger.info('📧 Email enviado com sucesso', {
      to: config.email.recipient,
      subject: mailOptions.subject,
    });
  }
}
