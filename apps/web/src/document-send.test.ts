import { describe, expect, it } from 'vitest';
import { documentDispatchStatus, documentSendBlockReason } from './document-send';

describe('document sending feedback', () => {
  it('only permits an approved document bound to a customer', () => {
    expect(documentSendBlockReason('APPROVED', 'customer')).toBe('');
    for (const state of [undefined, 'DRAFT', 'REJECTED', 'IN_REVIEW', 'ARCHIVED'])
      expect(documentSendBlockReason(state, 'customer')).not.toBe('');
    expect(documentSendBlockReason('APPROVED')).toContain('尚未绑定客户');
    expect(documentSendBlockReason('IN_REVIEW', 'customer')).toContain('等待审批人');
    expect(documentSendBlockReason('DRAFT', 'customer')).toContain('当前文档为草稿');
    expect(documentSendBlockReason('REJECTED', 'customer')).toContain('已被驳回');
    expect(documentSendBlockReason('ARCHIVED', 'customer')).toContain('已归档');
  });
  it('never represents queued, retrying or unknown dispatches as delivered', () => {
    expect(documentDispatchStatus('DELIVERED')).toBe('已送达');
    expect(documentDispatchStatus('QUEUED')).toContain('尚未确认送达');
    expect(documentDispatchStatus('FAILED')).toBe('发送失败');
    expect(documentDispatchStatus('RETRY')).toBe('等待重试');
    expect(documentDispatchStatus('unexpected')).toBe('状态待确认');
  });
});
