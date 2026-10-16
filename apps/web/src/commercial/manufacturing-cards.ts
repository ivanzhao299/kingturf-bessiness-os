import { el } from '../dom';
import type { OperationsViewContext, ManufacturingDefinition } from './operations-view-ports';
import {
  openItemVersionForm,
  openBomVersionForm,
  openRoutingVersionForm,
} from './manufacturing-forms';

export function createManufacturingCard(
  context: OperationsViewContext,
  definition: ManufacturingDefinition,
): HTMLElement {
  const { status, controller, permissions } = context;
  const { recordText, businessStateLabel } = context.ports;
  const card = el('article', 'manufacturing-card');
  card.append(el('h3', '', definition.title));
  const items = controller.views.get(definition.path) ?? [];
  for (const item of items) {
    const row = el('div', 'manufacturing-version');
    row.append(
      el('strong', '', recordText(item, 'sku', 'code', recordText(item, 'name', 'name', '未命名'))),
      el(
        'span',
        `ctr-state state-${recordText(item, 'status', 'status', 'DRAFT').toLowerCase()}`,
        `${businessStateLabel(recordText(item, 'status', 'status', 'DRAFT'))} · 第 ${recordText(item, 'version', 'version', '1')} 版`,
      ),
      el(
        'p',
        'muted',
        recordText(
          item,
          'name',
          'name',
          recordText(item, 'canonical_hash', 'canonical_hash').slice(0, 16),
        ),
      ),
    );
    if (
      permissions.has(definition.manage) &&
      recordText(item, 'status', 'status') === 'DRAFT' &&
      typeof item.id === 'string'
    ) {
      const publish = el('button', 'secondary', '发布版本');
      publish.addEventListener('click', () => {
        void controller
          .submit(`/api/v1/${definition.publish}-versions/${item.id as string}/publish`, {})
          .then(async () => {
            await controller.load();
            status.textContent = controller.message;
          });
      });
      row.append(publish);
    }
    card.append(row);
  }
  if (!items.length) card.append(el('p', 'pipeline-empty', '暂无版本。'));
  if (permissions.has(definition.manage)) {
    const create = el('button', 'primary', '＋ 创建版本');
    create.addEventListener('click', () => {
      openManufacturingCreate(context, definition);
    });
    card.append(create);
  }
  return card;
}

function openManufacturingCreate(
  context: OperationsViewContext,
  definition: ManufacturingDefinition,
): void {
  const { status, controller } = context;
  const { recordText } = context.ports;
  const publishedItems = (controller.views.get('/api/v1/manufacturing-items') ?? []).filter(
    (item) => recordText(item, 'status', 'status') === 'PUBLISHED',
  );
  const itemOptions = publishedItems.map((item) => ({
    value: String(item.id),
    label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
  }));
  const finish = async (payload: Record<string, unknown>) => {
    await controller.submit(definition.path, payload);
    await controller.load();
    status.textContent = controller.message;
  };
  if (definition.path === '/api/v1/manufacturing-items') openItemVersionForm(context, finish);
  else if (definition.path === '/api/v1/manufacturing-boms')
    openBomVersionForm(context, publishedItems, itemOptions, finish);
  else openRoutingVersionForm(context, publishedItems, itemOptions, finish);
}
