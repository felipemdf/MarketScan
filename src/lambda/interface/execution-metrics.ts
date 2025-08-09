export default interface ExecutionMetrics {
  executionId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'success' | 'partial' | 'failed';
  postsScraped: number;
  imagesProcessed: number;
  productsFound: number;
  promotionsSaved: number;
  errors: string[];
}