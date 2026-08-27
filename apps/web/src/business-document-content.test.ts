import { describe, expect, it } from 'vitest';
import { buildBusinessDocumentTemplateHtml } from './business-document-content';

describe('business document content blueprints', () => {
  const files = Array.from(
    { length: 25 },
    (_, index) => `${String(index + 1).padStart(2, '0')}-模板.docx`,
  );

  it('provides detailed, editable content for all 25 controlled templates', () => {
    for (const file of files) {
      const html = buildBusinessDocumentTemplateHtml(
        file,
        `模板${file.slice(0, 2)}`,
        '说明',
        '',
        '2026/8/28',
      );
      expect(html).toContain('基本信息');
      expect(html).toContain('审批与确认');
      expect(html).toContain('版本与附件');
      expect(html.length).toBeGreaterThan(900);
      expect(html).not.toContain('一、基本信息</p><p>二、业务内容');
    }
  });

  it('prefills linked business information and escapes untrusted values', () => {
    const html = buildBusinessDocumentTemplateHtml(
      '13-报价.docx',
      '项目正式报价单',
      '说明',
      '客户名称：<测试&客户>',
      '2026/8/28',
    );
    expect(html).toContain('关联业务信息');
    expect(html).toContain('客户名称：&lt;测试&amp;客户&gt;');
    expect(html).not.toContain('<测试&客户>');
  });

  it('fails closed when a template has no reviewed blueprint', () => {
    expect(() =>
      buildBusinessDocumentTemplateHtml('99-未知.docx', '未知模板', '说明', '', '2026/8/28'),
    ).toThrow('未配置在线正文模板');
  });
});
