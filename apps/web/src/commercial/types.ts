export type Opportunity = Readonly<{
  id: string;
  customerId?: string | null;
  leadId?: string | null;
  name?: string;
  status?: string;
  value?: Readonly<{ amount: string; currency: string }>;
  probabilityBasisPoints?: number;
  expectedCloseDate?: string;
  version?: number;
}>;

export type CommercialApi = Readonly<{
  listOpportunities(): Promise<readonly Opportunity[]>;
  list(path: string): Promise<readonly Record<string, unknown>[]>;
  listCostMatrixSummaries?(query: CostMatrixQuery): Promise<CostMatrixPage>;
  get?(path: string): Promise<Record<string, unknown>>;
  submit(
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH',
  ): Promise<Record<string, unknown>>;
  uploadCtrAttachment(versionId: string, file: File): Promise<Record<string, unknown>>;
  uploadContractDocument?(
    businessType: 'SALES' | 'PURCHASE',
    subjectType: 'contract-revision' | 'purchase-order',
    subjectId: string,
    file: File,
  ): Promise<Record<string, unknown>>;
  command(
    revisionId: string,
    action: 'approve' | 'issue',
    payload?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}>;

export type CostMatrixAttention =
  | 'ALL'
  | 'NEEDS_INPUT'
  | 'NEEDS_CALCULATION'
  | 'READY_FOR_QUOTE'
  | 'IN_QUOTE';
export type CostMatrixSort = 'ATTENTION' | 'CODE' | 'UPDATED' | 'COST_DESC';
export type CostMatrixQuery = Readonly<{
  page: number;
  pageSize: number;
  query: string;
  productFamily: string;
  attention: CostMatrixAttention;
  sort: CostMatrixSort;
}>;
export type CostMatrixPage = Readonly<{
  items: readonly Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}>;
