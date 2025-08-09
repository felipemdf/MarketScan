import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Promotion } from './promotion.entity';
import { City } from '../../types/city.enum';

@Entity('market')
export class Market {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', enum: City, enumName: 'city_enum' })
  city!: City;

  @Column({
    name: 'instagram_username',
    type: 'varchar',
    length: 100,
    unique: true,
  })
  instagramUsername!: string;

  // Relacionamentos
  @OneToMany(() => Promotion, (promotion) => promotion.market, { cascade: ['remove'] })
  promotions!: Promotion[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  public getInstagramUrl(): string {
    return `https://instagram.com/${this.instagramUsername}`;
  }
}
