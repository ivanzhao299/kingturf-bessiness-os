import { el } from '../dom';
import { textValue } from '../shared/business-format';
import type { GovernanceActionContext } from './workspace-types';
export function appendGovernanceMasterDataActions(context: GovernanceActionContext) {
  const {
    surface,
    permissions,
    openAction,
    controller,
    choices,
    jsonField,
    actions,
    records,
    requiredValue,
  } = context;
  if (surface.id === 'master-data' && permissions.has('master-data:create')) {
    const category = el('button', 'secondary', '新建分类');
    category.addEventListener('click', () => {
      openAction(
        '新建主数据分类',
        '分类编码保持稳定；名称和生效区间可以通过新版本调整。',
        [
          { name: 'code', label: '分类编码', required: true },
          { name: 'name', label: '分类名称', required: true },
          { name: 'description', label: '说明', type: 'textarea' },
          { name: 'effectiveFrom', label: '生效时间', required: true },
        ],
        (values) =>
          controller.submit('/api/v1/master-data/categories', {
            code: values.code,
            name: values.name,
            description: values.description ?? null,
            effectiveFrom: values.effectiveFrom,
            effectiveTo: null,
          }),
      );
    });
    const entry = el('button', 'secondary', '新建条目');
    entry.addEventListener('click', () => {
      openAction(
        '新建主数据条目',
        '条目值使用结构化配置保存，并继承分类的公司隔离。',
        [
          {
            name: 'categoryId',
            label: '分类',
            type: 'select',
            required: true,
            options: choices(
              '/api/v1/master-data/categories',
              (item) => `${textValue(item.code, '')} · ${textValue(item.name, '')}`,
            ),
          },
          { name: 'code', label: '条目编码', required: true },
          { name: 'label', label: '显示名称', required: true },
          { name: 'value', label: '结构化值（高级配置）', type: 'textarea', required: true },
          { name: 'effectiveFrom', label: '生效时间', required: true },
        ],
        (values) =>
          controller.submit('/api/v1/master-data/entries', {
            categoryId: values.categoryId,
            code: values.code,
            label: values.label,
            value: jsonField(values.value, '结构化值'),
            effectiveFrom: values.effectiveFrom,
            effectiveTo: null,
          }),
      );
    });
    actions.append(category, entry);
  }
  if (surface.id === 'master-data' && permissions.has('master-data:update')) {
    const update = el('button', 'secondary', '更新主数据条目');
    update.addEventListener('click', () => {
      openAction(
        '更新主数据条目',
        '生成新的有效版本；服务器使用当前记录版本防止并发覆盖。',
        [
          {
            name: 'entryId',
            label: '条目',
            type: 'select',
            required: true,
            options: choices(
              '/api/v1/master-data/entries',
              (item) => `${textValue(item.code, '')} · ${textValue(item.label, '')}`,
            ),
          },
          { name: 'label', label: '显示名称', required: true },
          { name: 'value', label: '结构化值（高级配置）', type: 'textarea', required: true },
          { name: 'effectiveFrom', label: '生效时间', required: true },
        ],
        async (values) => {
          const selected = records('/api/v1/master-data/entries').find(
            (item) => item.id === values.entryId,
          );
          await controller.submit(
            `/api/v1/master-data/entries/${requiredValue(values.entryId, '主数据条目')}`,
            {
              label: values.label,
              value: jsonField(values.value, '结构化值'),
              effectiveFrom: values.effectiveFrom,
              effectiveTo: null,
              version: Number(selected?.version),
            },
            'PATCH',
          );
        },
      );
    });
    actions.append(update);
  }
  if (surface.id === 'master-data' && permissions.has('master-data:delete')) {
    const remove = el('button', 'secondary danger', '停用主数据条目');
    remove.addEventListener('click', () => {
      openAction(
        '停用主数据条目',
        '停用属于受控逻辑删除，历史版本和审计记录继续保留。',
        [
          {
            name: 'entryId',
            label: '条目',
            type: 'select',
            required: true,
            options: choices(
              '/api/v1/master-data/entries',
              (item) => `${textValue(item.code, '')} · ${textValue(item.label, '')}`,
            ),
          },
        ],
        async (values) => {
          const selected = records('/api/v1/master-data/entries').find(
            (item) => item.id === values.entryId,
          );
          await controller.submit(
            `/api/v1/master-data/entries/${requiredValue(values.entryId, '主数据条目')}?version=${String(Number(selected?.version))}`,
            {},
            'DELETE',
          );
        },
      );
    });
    actions.append(remove);
  }
}
