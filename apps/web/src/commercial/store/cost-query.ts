import type { CostMatrixQuery } from '../types';
export const initialCostMatrixQuery = (): CostMatrixQuery => ({
  page: 1,
  pageSize: 20,
  query: '',
  productFamily: '',
  attention: 'ALL',
  sort: 'ATTENTION',
});
