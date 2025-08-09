import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Market } from './market.entity';
import { Promotion } from './promotion.entity';
import { Product } from './product.entity';

@Entity('post')
export class Post {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    name: 'post_code',
    type: 'varchar',
    length: 100,
    unique: true,
  })
  postCode!: string;


  @Column({
    name: 'published_at',
    type: 'date',
  })
  publishedAt!: Date;

  @Column({
    name: 'extracted_at',
    type: 'date',
  })
  extractedAt!: Date;

  @Column({ name: 'promotion_id' })
  promotionId!: number;

  @ManyToOne(() => Promotion, (promotion) => promotion.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promotion_id' })
  promotion!: Promotion;

  @OneToMany(() => Product, (product) => product.post, { cascade: ['remove'] })
  products!: Product[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  get postUrl(): string {
    return `https://www.instagram.com/p/${this.postCode}/`;
  }
}
