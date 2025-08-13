export default interface DatabaseConfig {
  type: 'sqlite' | 'mysql' | 'postgres' | 'mariadb';
  database: string;
}
