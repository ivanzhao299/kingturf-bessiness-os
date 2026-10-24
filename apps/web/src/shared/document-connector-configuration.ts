import { openForm } from './forms';
import type { DocumentConnector } from './online-editor-types';
import type { DocumentConnectorServices } from './document-connector-services';
export function openDocumentConnectorConfiguration(
  connector: DocumentConnector,
  connectorGrid: HTMLElement,
  renderDocumentConnectors: (connectorGrid: HTMLElement, saved?: boolean) => void,
  ports: DocumentConnectorServices,
) {
  openForm(
    document.body,
    `配置${connector.label}`,
    '只填写非敏感元数据和密钥引用名称。真实密钥由运维放入受控密钥存储。',
    [
      {
        name: 'provider',
        label: '服务提供方代码',
        required: true,
        value: connector.provider,
        placeholder: '例如 RESEND 或 META_CLOUD_API',
      },
      {
        name: 'displayName',
        label: '内部显示名称',
        required: true,
        value: connector.displayName,
      },
      {
        name: 'senderIdentity',
        label: '发送身份/账号',
        value: connector.senderIdentity ?? '',
      },
      {
        name: 'secretReference',
        label: '安全密钥引用',
        value: connector.secretReference ?? '',
        placeholder: 'KINGTURF_CONNECTOR_…',
        hint: '只填密钥名称，不得在此粘贴令牌、密码或 API Key。',
      },
      {
        name: 'configuration',
        label: '非敏感配置 JSON',
        type: 'textarea',
        value: JSON.stringify(connector.configuration ?? {}, undefined, 2),
      },
      {
        name: 'status',
        label: '状态',
        type: 'select',
        required: true,
        value: connector.status,
        options: [
          { value: 'UNCONFIGURED', label: '待配置' },
          { value: 'READY', label: '启用' },
          { value: 'DISABLED', label: '停用' },
        ],
      },
    ],
    '保存连接器配置',
    async (values) => {
      const configurationText = values.configuration ?? '';
      const senderIdentity = values.senderIdentity?.trim() ?? '';
      const secretReference = values.secretReference?.trim() ?? '';
      let configuration: Record<string, unknown>;
      try {
        configuration = JSON.parse(
          configurationText.length > 0 ? configurationText : '{}',
        ) as Record<string, unknown>;
      } catch {
        throw new Error('非敏感配置必须是有效 JSON');
      }
      const onlineDocumentApi = ports.onlineDocumentApi;
      await onlineDocumentApi(`/api/v1/document-connectors/${connector.connector}`, {
        method: 'PUT',
        body: JSON.stringify({
          provider: values.provider,
          displayName: values.displayName,
          senderIdentity: senderIdentity.length > 0 ? senderIdentity : null,
          secretReference: secretReference.length > 0 ? secretReference : null,
          configuration,
          status: values.status,
          expectedVersion: connector.version,
        }),
      });
      renderDocumentConnectors(connectorGrid, true);
    },
  );
}
