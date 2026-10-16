import type { OnlineBusinessDocument, DocumentConnectorKey } from './shell-types';
import type { createOnlineEditorHeading } from './online-editor-heading';
import type { createOnlineEditorWorkspace } from './online-editor-workspace';
export type DocumentConnector = Readonly<{
  connector: DocumentConnectorKey;
  label: string;
  provider: string;
  displayName: string;
  senderIdentity?: string;
  secretReference?: string;
  configuration?: Readonly<Record<string, unknown>>;
  status: 'UNCONFIGURED' | 'READY' | 'DISABLED';
  version: number;
  configuredAt?: string;
}>;
export type BusinessDocumentPageSize = 'adaptive' | 'a4-portrait' | 'a4-landscape' | 'a3-portrait';
export type OnlineEditorPermissions = Readonly<{
  manage: boolean;
  approve: boolean;
  send: boolean;
  translate: boolean;
  configure: boolean;
}>;
export type OnlineEditorState = {
  activeVersion: number;
  documentState: OnlineBusinessDocument['state'];
  latestContent: NonNullable<OnlineBusinessDocument['versions']>[number]['content'];
  editable: boolean;
  savedEditorHtml: string;
};
export type OnlineEditorPorts = Readonly<{
  businessDocumentOption: (label: string, value: string) => HTMLOptionElement;
  sanitizeBusinessDocumentHtml: (value: string) => string;
  businessDocumentText: (content: Readonly<{ body?: string; html?: string }>) => string;
  onlineDocumentApi: <T>(path: string, init?: RequestInit) => Promise<T>;
  clearSessionReadCache: () => void;
  renderBusinessDocumentComparison: (
    container: HTMLElement,
    previous: string,
    current: string,
    previousVersion: number,
    currentVersion: number,
  ) => void;
  renderDocumentConnectors: (connectorGrid: HTMLElement, saved?: boolean) => void;
  printOnlineBusinessDocument: (
    title: string,
    html: string,
    pageSize: BusinessDocumentPageSize,
  ) => void;
}>;
export type OnlineEditorContext = OnlineEditorPorts &
  ReturnType<typeof createOnlineEditorHeading> &
  ReturnType<typeof createOnlineEditorWorkspace> &
  Readonly<{
    documentData: OnlineBusinessDocument;
    permissions: OnlineEditorPermissions;
    onSaved: ((currentVersion: number) => void) | undefined;
    state: OnlineEditorState;
    current: NonNullable<OnlineBusinessDocument['versions']>[number] | undefined;
    versions: NonNullable<OnlineBusinessDocument['versions']>[number][];
    setViewMode: (mode: 'edit' | 'preview') => void;
    updateDocumentPagination: () => void;
    summary: HTMLInputElement;
    status: HTMLParagraphElement;
    save: HTMLButtonElement;
    reviewReason: HTMLInputElement;
    comparison: HTMLElement;
    callbacks: Readonly<{
      addVersionToHistory: (
        item: NonNullable<OnlineBusinessDocument['versions']>[number],
        newest?: boolean,
      ) => void;
    }>;
  }>;
