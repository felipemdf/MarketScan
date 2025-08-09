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
import { Post } from './post.entity';

@Entity('promotion')
export class Promotion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    name: 'start_date',
    type: 'date',
  })
  startDate!: Date;

  @Column({
    name: 'end_date',
    type: 'date',
  })
  endDate!: Date;

  @Column({ name: 'market_id' })
  marketId!: number;

  @ManyToOne(() => Market, (market) => market.promotions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'market_id' })
  market!: Market;

  @OneToMany(() => Post, (post) => post.promotion, { cascade: ['remove'] })
  posts!: Post[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  public isCurrentlyActive(): boolean {
    const now = new Date();
    return this.startDate <= now && now <= this.endDate;
  }
}
