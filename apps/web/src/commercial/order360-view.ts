import { el } from '../dom';
import type { FulfillmentViewContext } from './fulfillment-view-ports';
import {
  createRiskPolicyButton,
  createOrderRiskPolicyCard,
  appendOrderRiskEvaluation,
} from './order360-risk-controls';
import { createOrderEvidence } from './order360-evidence';

export function appendOrder360Content(
  context: FulfillmentViewContext,
  panel: HTMLElement,
  heading: HTMLElement,
  copy: HTMLElement,
  riskPolicies: readonly Record<string, unknown>[],
  riskOrders: readonly Record<string, unknown>[],
  riskPolicyControls: HTMLElement,
): void {
  const { workspace, controller, permissions } = context;
  const { recordText, displayMoney, businessStateLabel } = context.ports;
  const riskPercent = (value: string) => String(Number(value) / 100);
  if (permissions.has('risk-policy:manage')) {
    const create = createRiskPolicyButton(context);
    heading.append(copy);
    riskPolicyControls.append(create);
  } else heading.append(copy);
  panel.append(heading);
  const policyStrip = el('div', 'version-strip risk-policy-strip');
  for (const policy of riskPolicies) {
    const policyCard = createOrderRiskPolicyCard(context, policy, riskPercent);
    policyStrip.append(policyCard);
  }
  riskPolicyControls.append(policyStrip);
  appendOrderRiskEvaluation(context, riskOrders, riskPolicies, riskPolicyControls);
  const list = el('div', 'order-360-list');
  const renderOrderEvidence = (aggregate: Record<string, unknown>) =>
    createOrderEvidence(context, aggregate);
  for (const order of controller.views.get('/api/v1/sales-orders') ?? []) {
    if (typeof order.id !== 'string') continue;
    const orderId = order.id;
    const card = el('article', 'order-360-card');
    card.append(
      el('h3', '', recordText(order, 'orderNumber', 'order_number', orderId)),
      el(
        'p',
        '',
        `${displayMoney(recordText(order, 'currency', 'currency'), recordText(order, 'total', 'total', '—'))} · ${businessStateLabel(recordText(order, 'status', 'status'))}`,
      ),
    );
    const open = el('button', 'secondary compact-action', '查看全链路证据');
    open.type = 'button';
    open.setAttribute('aria-expanded', 'false');
    const feedback = el('p', 'muted');
    feedback.setAttribute('role', 'status');
    const detail = el('div', 'order-360-detail');
    detail.id = `order-evidence-${orderId}`;
    detail.hidden = true;
    open.setAttribute('aria-controls', detail.id);
    open.addEventListener('click', () => {
      if (!detail.hidden) {
        detail.hidden = true;
        open.setAttribute('aria-expanded', 'false');
        open.textContent = '查看全链路证据';
        return;
      }
      open.disabled = true;
      open.setAttribute('aria-busy', 'true');
      feedback.textContent = '正在加载该订单的合同、履约、回款与风险证据…';
      void controller
        .loadOrder360(orderId)
        .then((aggregate) => {
          detail.replaceChildren(renderOrderEvidence(aggregate));
          detail.hidden = false;
          open.setAttribute('aria-expanded', 'true');
          open.textContent = '收起全链路证据';
          feedback.textContent = '已读取最新订单证据；再次展开将刷新。';
        })
        .catch((failure: unknown) => {
          feedback.textContent = failure instanceof Error ? failure.message : '订单证据加载失败';
          open.textContent = '重试加载订单证据';
        })
        .finally(() => {
          open.disabled = false;
          open.removeAttribute('aria-busy');
        });
    });
    card.append(open, feedback, detail);
    list.append(card);
  }
  if (list.children.length === 0) list.append(el('p', 'pipeline-empty', '暂无可见订单证据。'));
  panel.append(list);
  workspace.append(panel);
}
