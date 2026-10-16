import { el } from '../dom';
import { openDocumentConnectorConfiguration } from './document-connector-configuration';
import type { DocumentConnector } from './online-editor-types';
import type { DocumentConnectorServices } from './document-connector-services';
export function appendDocumentConnectorCard(
  connector: DocumentConnector,
  connectorGrid: HTMLElement,
  renderDocumentConnectors: (connectorGrid: HTMLElement, saved?: boolean) => void,
  ports: DocumentConnectorServices,
) {
  const card = el('article', 'document-connector-card');
  card.append(
    el(
      'span',
      `role-task-state ${connector.status === 'READY' ? 'success' : 'warning'}`,
      connector.status === 'READY'
        ? '已配置'
        : connector.status === 'DISABLED'
          ? '已停用'
          : '待配置',
    ),
    el('strong', '', connector.label),
    el('small', '', `${connector.provider} · ${connector.senderIdentity ?? '未设置发送身份'}`),
  );
  const configure = el('button', 'secondary compact', '配置');
  configure.type = 'button';
  configure.addEventListener('click', () => {
    openDocumentConnectorConfiguration(connector, connectorGrid, renderDocumentConnectors, ports);
  });
  card.append(configure);
  connectorGrid.append(card);
}
