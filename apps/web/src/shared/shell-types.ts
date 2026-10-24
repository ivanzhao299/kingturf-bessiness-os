import type { AppRoute } from './navigation';

export type Viewport = 'desktop' | 'tablet' | 'mobile';

type BusinessDocumentTemplate = Readonly<{
  name: string;
  description: string;
  file: string;
  routes: readonly AppRoute[];
}>;

export type RoleWorkspaceProfile = Readonly<{
  title: string;
  description: string;
  domains: readonly string[];
}>;

type OnlineBusinessDocument = Readonly<{
  id: string;
  templateKey: string;
  title: string;
  route: string;
  state?: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  currentVersion: number;
  customerId?: string;
  customerName?: string;
  salesOrderId?: string;
  salesOrderNumber?: string;
  operatorId?: string;
  operatorName?: string;
  salespersonId?: string;
  salespersonName?: string;
  assignedTo?: string;
  assigneeName?: string;
  reviewEvents?: readonly Readonly<{
    action: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    reason: string;
    createdAt?: string;
  }>[];
  versions?: readonly Readonly<{
    version: number;
    content: Readonly<{ body?: string; html?: string }>;
    changeSummary: string;
    createdAt?: string;
  }>[];
  translations?: readonly Readonly<{
    id: string;
    sourceVersion: number;
    targetLocale: string;
    provider: 'MANUAL' | 'CONNECTED_PROVIDER';
    status: 'QUEUED' | 'READY';
    content?: Readonly<{ body?: string; html?: string }>;
    createdAt?: string;
  }>[];
  dispatches?: readonly Readonly<{
    id: string;
    documentVersion: number;
    translationId?: string;
    channel: DocumentConnectorKey;
    recipientName: string;
    recipientMasked: string;
    subject: string;
    status: 'QUEUED' | 'DELIVERED' | 'RETRY' | 'FAILED';
    requestedAt?: string;
    deliveredAt?: string;
  }>[];
}>;

type DocumentConnectorKey =
  | 'EMAIL'
  | 'WECHAT_WORK'
  | 'WHATSAPP_BUSINESS'
  | 'MICROSOFT_TEAMS'
  | 'TELEGRAM'
  | 'LINE'
  | 'TRANSLATION';

type NavIconName =
  | 'overview'
  | 'sales'
  | 'operations'
  | 'customers'
  | 'opportunities'
  | 'cost'
  | 'contracts'
  | 'receivables'
  | 'production'
  | 'quality'
  | 'delivery'
  | 'governance';

export type { NavIconName, BusinessDocumentTemplate, OnlineBusinessDocument, DocumentConnectorKey };
