import { setOperationStatus } from '../dom';
import { openForm } from './forms';
import type { OnlineEditorContext } from './online-editor-types';

export function bindOnlineEditorTranslation(
  context: Pick<
    OnlineEditorContext,
    | 'translate'
    | 'onlineDocumentApi'
    | 'documentData'
    | 'status'
    | 'clearSessionReadCache'
    | 'onSaved'
    | 'state'
  >,
) {
  const {
    translate,
    onlineDocumentApi,
    documentData,
    status,
    clearSessionReadCache,
    onSaved,
    state,
  } = context;
  translate.addEventListener('click', () => {
    openForm(
      document.body,
      '创建文档译文',
      '译文固定关联当前版本。可使用已配置的自动翻译服务，也可人工录入并复核译文。',
      [
        {
          name: 'targetLocale',
          label: '目标语言',
          type: 'select',
          required: true,
          options: [
            { value: 'en-US', label: '英语（美国）' },
            { value: 'en-GB', label: '英语（英国）' },
            { value: 'es-ES', label: '西班牙语' },
            { value: 'fr-FR', label: '法语' },
            { value: 'de-DE', label: '德语' },
            { value: 'ar-SA', label: '阿拉伯语' },
            { value: 'ja-JP', label: '日语' },
            { value: 'ko-KR', label: '韩语' },
          ],
        },
        {
          name: 'mode',
          label: '翻译方式',
          type: 'select',
          required: true,
          options: [
            { value: 'AUTO', label: '自动翻译（需管理员配置服务）' },
            { value: 'MANUAL', label: '人工录入并复核' },
          ],
        },
        {
          name: 'translatedContent',
          label: '人工译文正文',
          type: 'textarea',
          placeholder: '选择人工录入时填写；自动翻译时保持为空',
          hint: '人工译文会作为不可变版本保存，发送时可明确选择。',
        },
      ],
      '创建译文',
      async (values) => {
        const manual = values.mode === 'MANUAL';
        if (manual && !values.translatedContent?.trim())
          throw new Error('人工翻译方式必须填写译文正文');
        const translated = await onlineDocumentApi<{ status: 'QUEUED' | 'READY' }>(
          `/api/v1/business-documents/${documentData.id}/translations`,
          {
            method: 'POST',
            body: JSON.stringify({
              expectedVersion: state.activeVersion,
              targetLocale: values.targetLocale,
              ...(manual
                ? {
                    content: {
                      body: values.translatedContent?.trim(),
                      html: `<p>${(values.translatedContent ?? '')
                        .replaceAll('&', '&amp;')
                        .replaceAll('<', '&lt;')
                        .replaceAll('>', '&gt;')
                        .replaceAll('\n', '<br>')}</p>`,
                    },
                  }
                : {}),
            }),
          },
        );
        setOperationStatus(
          status,
          'success',
          translated.status === 'READY' ? '人工译文已保存并可用于发送' : '自动翻译任务已进入队列',
        );
        clearSessionReadCache();
        onSaved?.(state.activeVersion);
      },
    );
  });
}
