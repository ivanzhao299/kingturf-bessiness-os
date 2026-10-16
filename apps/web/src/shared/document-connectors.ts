import { el } from '../dom';
import { appendDocumentConnectorCard } from './document-connector-card';
import type { DocumentConnector } from './online-editor-types';
import type { DocumentConnectorServices } from './document-connector-services';
export function createDocumentConnectorRenderer(ports: DocumentConnectorServices) {
  const renderDocumentConnectors = (connectorGrid: HTMLElement, saved = false): void => {
    const progress = el(
      'p',
      'operation-status',
      saved ? '配置已保存，正在刷新渠道状态…' : '正在加载发送与翻译连接器…',
    );
    progress.setAttribute('role', 'status');
    connectorGrid.replaceChildren(progress);
    const onlineDocumentApi = ports.onlineDocumentApi;
    void onlineDocumentApi<{ items: readonly DocumentConnector[] }>('/api/v1/document-connectors')
      .then(({ items }) => {
        connectorGrid.replaceChildren();
        if (saved) {
          progress.textContent = '配置已保存。返回文档后可重新检查发送条件。';
          connectorGrid.append(progress);
        }
        if (items.length === 0) throw new Error('未读取到连接器，请重试或联系管理员');
        for (const connector of items) {
          appendDocumentConnectorCard(connector, connectorGrid, renderDocumentConnectors, ports);
        }
      })
      .catch((failure: unknown) => {
        connectorGrid.replaceChildren(
          el(
            'p',
            'error',
            (saved ? '配置已保存，但刷新失败：' : '') +
              (failure instanceof Error ? failure.message : '连接器配置加载失败'),
          ),
        );
        const retry = el('button', 'secondary', '重试加载配置');
        retry.type = 'button';
        retry.addEventListener('click', () => {
          renderDocumentConnectors(connectorGrid, saved);
        });
        connectorGrid.append(retry);
      });
  };
  return renderDocumentConnectors;
}
