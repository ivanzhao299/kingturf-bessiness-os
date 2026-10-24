import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendContextualDocuments } from './shared/contextual-documents';
import type { AppRoute } from './shared/navigation';
import type { OnlineBusinessDocument } from './shared/shell-types';
import {
  createBehaviorElement,
  findElement,
  flushBehaviorPromises,
  htmlElement,
  type BehaviorElement,
} from '../test/fixtures/behavior-dom';

type Ports = Parameters<typeof appendContextualDocuments>[2];
const deferred = <T>() => {
  let resolve: (value: T) => void = () => {
    throw new Error('Deferred not initialized');
  };
  let reject: (reason: unknown) => void = () => {
    throw new Error('Deferred not initialized');
  };
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
};
const object = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Expected request object');
  return value as Record<string, unknown>;
};
const byText = (root: BehaviorElement, text: string) =>
  findElement(root, (node) => node.textContent === text);
const byLabel = (root: BehaviorElement, label: string) =>
  findElement(root, (node) => node.getAttribute('aria-label') === label);
const buttons = (root: BehaviorElement, text: string) =>
  root.descendants().filter((node) => node.tagName === 'BUTTON' && node.textContent === text);
const created: OnlineBusinessDocument = {
  id: 'document-created',
  templateKey: 'fixed-template',
  title: 'Created DTO',
  route: 'quotes',
  currentVersion: 1,
};
const references = {
  customers: [{ id: 'customer-1', name: '客户 <A>', number: 'C-1' }],
  orders: [{ id: 'order-1', name: 'SO-1', customerId: 'customer-1' }],
  employees: [{ id: 'employee-1', name: 'Employee A', number: 'E-1' }],
};
const setup = (permissions: readonly string[] = []) => {
  const content = createBehaviorElement('main');
  const read = vi.fn<(path: string) => Promise<unknown>>((path) => {
    if (path === '/subjects') return Promise.resolve([]);
    if (path.endsWith('/reference-data')) return Promise.resolve(references);
    if (path.startsWith('/api/v1/business-documents?')) return Promise.resolve({ items: [] });
    throw new Error('Unexpected read path');
  });
  const api = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>(() =>
    Promise.resolve(created),
  );
  const editor = vi.fn<Ports['openOnlineDocumentEditor']>();
  const prefill = vi.fn<Ports['businessDocumentPrefill']>(() => 'CONTROLLED-PREFILL');
  const label = vi.fn<Ports['businessDocumentSubjectLabel']>(() => 'CONTROLLED-SUBJECT');
  const first = {
    name: '模板 <A>',
    description: 'Controlled template',
    file: '01-controlled.docx',
    routes: ['quotes'] as const,
  };
  const second = {
    name: '模板 B',
    description: 'Second template',
    file: '03-controlled.docx',
    routes: ['quotes', 'technical-requirements'] as const,
  };
  const ports: Ports = {
    visibleAppRoutes: () => new Set<AppRoute>(['quotes']),
    BUSINESS_DOCUMENT_TEMPLATES: [first, second],
    BUSINESS_DOCUMENT_SUBJECTS: {
      quotes: { endpoint: '/subjects', type: 'QUOTE', numberKeys: ['quoteNumber'] },
    },
    templatesForRoute: (route) =>
      [first, second].filter((template) => template.routes.some((item) => item === route)),
    businessDocumentOption: (text, value) => {
      const option = createBehaviorElement('option');
      option.textContent = text;
      option.value = value;
      return htmlElement(option) as HTMLOptionElement;
    },
    businessDocumentSubjectLabel: label,
    businessDocumentPrefill: prefill,
    onlineTemplateKey: () => 'fixed-template',
    onlineDocumentRead: <T>(path: string) => read(path) as Promise<T>,
    onlineDocumentApi: <T>(path: string, init?: RequestInit) => api(path, init) as Promise<T>,
    openOnlineDocumentEditor: editor,
  };
  const mount = (overrides: Partial<Ports> = {}) => {
    appendContextualDocuments(htmlElement(content), new Set(permissions), {
      ...ports,
      ...overrides,
    });
  };
  return { content, read, api, editor, prefill, label, ports, mount };
};

beforeEach(() => {
  vi.stubGlobal('document', { createElement: createBehaviorElement });
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('contextual documents real callback behavior through explicit ports', () => {
  it('deduplicates permitted routes and keeps downloads independent of document permissions', () => {
    const fixture = setup();
    fixture.mount();
    expect(fixture.content.querySelectorAll('section')).toHaveLength(1);
    expect(fixture.read).not.toHaveBeenCalled();
    expect(fixture.api).not.toHaveBeenCalled();
    expect(buttons(fixture.content, '新建在线文档')).toEqual([]);
    const cards = fixture.content.querySelectorAll('article');
    const downloadButtons = buttons(fixture.content, '下载 Word');
    const first = cards[0],
      second = cards[1];
    const firstDownload = downloadButtons[0],
      secondDownload = downloadButtons[1];
    if (!first || !second || !firstDownload || !secondDownload)
      throw new Error('Rendered cards missing');
    firstDownload.click();
    expect(first.classList.contains('selected')).toBe(true);
    secondDownload.click();
    expect(first.classList.contains('selected')).toBe(false);
    expect(second.classList.contains('selected')).toBe(true);
    const anchor = second.querySelector('a');
    expect(anchor?.href).toBe('/business-templates/03-controlled.docx');
    expect(anchor?.download).toBe('03-controlled.docx');
    expect(anchor?.clickCalls).toBe(1);
    expect(byText(fixture.content, '已下载“模板 B”Word 交换文件').dataset.state).toBe('success');
  });

  it.each([false, true])(
    'binds the original subject object and fixed bindings before creation (wrapped=%s)',
    async (wrapped) => {
      const fixture = setup([
        'business-document:manage',
        'business-document:read',
        'business-document:approve',
        'business-document:send',
        'business-document:translate',
        'business-document:configure',
      ]);
      const subjects: Record<string, unknown>[] = [
        { id: 0 },
        ...Array.from({ length: 100 }, (_, index) => ({
          id: `subject-${String(index + 1)}`,
          quoteNumber: `Q-${String(index + 1)}`,
        })),
      ];
      fixture.read.mockImplementation((path) =>
        Promise.resolve(
          path === '/subjects'
            ? wrapped
              ? { items: subjects }
              : subjects
            : path.endsWith('/reference-data')
              ? references
              : { items: [] },
        ),
      );
      const pending = deferred<OnlineBusinessDocument>();
      fixture.api.mockReturnValueOnce(pending.promise);
      fixture.mount();
      await flushBehaviorPromises();
      const subject = byLabel(fixture.content, '关联业务单据');
      expect(subject.children).toHaveLength(100); // Placeholder + 99 valid IDs within the first 100 entries.
      expect(subject.children.some((node) => node.value === 'subject-100')).toBe(false);
      expect(fixture.label).toHaveBeenCalledWith(subjects[1], ['quoteNumber']);
      expect(fixture.label.mock.calls[0]?.[0]).toBe(subjects[1]);
      subject.value = 'subject-1';
      const order = byLabel(fixture.content, '销售订单');
      order.value = 'order-1';
      order.dispatchEvent(new Event('change'));
      expect(byLabel(fixture.content, '客户').value).toBe('customer-1');
      for (const role of ['经办人', '业务员', '下一处理人'])
        byLabel(fixture.content, role).value = 'employee-1';
      const button = buttons(fixture.content, '新建在线文档')[0];
      if (!button) throw new Error('Create action missing');
      button.click();
      button.click();
      expect(fixture.api).toHaveBeenCalledTimes(1);
      expect(button.disabled).toBe(true);
      const call = fixture.api.mock.calls[0];
      if (!call || typeof call[1]?.body !== 'string') throw new Error('Creation body missing');
      const payload = object(JSON.parse(call[1].body));
      expect(call[0]).toBe('/api/v1/business-documents');
      expect(call[1].method).toBe('POST');
      expect(payload).toMatchObject({
        templateKey: 'fixed-template',
        route: 'quotes',
        subjectType: 'QUOTE',
        subjectId: 'subject-1',
        customerId: 'customer-1',
        salesOrderId: 'order-1',
        operatorId: 'employee-1',
        salespersonId: 'employee-1',
        assignedTo: 'employee-1',
      });
      expect(payload.title).toMatch(/^模板 <A> · .*2026/u);
      const html = object(payload.content).html;
      expect(html).toContain('CONTROLLED-PREFILL');
      expect(html).toContain('客户：客户 &lt;A&gt;');
      expect(html).toContain('销售订单：SO-1');
      expect(html).toContain('经办人：Employee A');
      expect(html).toContain('业务员：Employee A');
      expect(html).toContain('下一处理人：Employee A');
      expect(html).toContain('模板 &lt;A&gt;');
      expect(fixture.prefill).toHaveBeenCalledWith(subjects[1]);
      expect(fixture.prefill.mock.calls[0]?.[0]).toBe(subjects[1]);
      pending.resolve(created);
      await flushBehaviorPromises();
      expect(fixture.editor).toHaveBeenCalledTimes(1);
      const editor = fixture.editor.mock.calls[0];
      if (!editor?.[2]) throw new Error('Save completion missing');
      expect(editor[0]).toBe(created);
      expect(editor[1]).toEqual({
        manage: true,
        approve: true,
        send: true,
        translate: true,
        configure: true,
      });
      expect(button.disabled).toBe(false);
      editor[2](7);
      expect(
        byText(
          fixture.content,
          '“模板 <A>”已保存为 V7；关闭编辑窗口后可在“已保存在线文档”中重新打开。',
        ).dataset.state,
      ).toBe('success');
    },
  );

  it.each([new Error('Controlled creation rejection'), 17])(
    'restores failed creation for retry and omits empty optional bindings (%s)',
    async (failure) => {
      const fixture = setup(['business-document:manage']);
      fixture.api.mockRejectedValueOnce(failure);
      fixture.mount();
      await flushBehaviorPromises();
      const button = buttons(fixture.content, '新建在线文档')[0];
      if (!button) throw new Error('Create action missing');
      button.click();
      await flushBehaviorPromises();
      expect(button.disabled).toBe(false);
      expect(
        byText(fixture.content, failure instanceof Error ? failure.message : '在线文档创建失败')
          .dataset.state,
      ).toBe('error');
      const call = fixture.api.mock.calls[0];
      if (!call || typeof call[1]?.body !== 'string') throw new Error('Creation body missing');
      const payload = object(JSON.parse(call[1].body));
      expect(Object.keys(payload).sort()).toEqual(['content', 'route', 'templateKey', 'title']);
      expect(fixture.prefill).toHaveBeenCalledWith(undefined);
      button.click();
      await flushBehaviorPromises();
      expect(fixture.api).toHaveBeenCalledTimes(2);
      expect(fixture.editor).toHaveBeenCalledTimes(1);
    },
  );

  it('surfaces independent subject/reference/register load failures without creating anything', async () => {
    const fixture = setup(['business-document:manage', 'business-document:read']);
    fixture.read.mockRejectedValue(new Error('Controlled list rejection'));
    fixture.mount();
    await flushBehaviorPromises();
    expect(
      byLabel(fixture.content, '关联业务单据').children.map((node) => node.textContent),
    ).toEqual(['业务单据加载失败，可稍后重试']);
    expect(byText(fixture.content, '业务绑定数据加载失败，请刷新后重试')).toBeDefined();
    expect(byText(fixture.content, 'Controlled list rejection').className).toBe('error');
    expect(fixture.api).not.toHaveBeenCalled();
    expect(fixture.editor).not.toHaveBeenCalled();
  });

  it('reads at most eight saved documents and defers full reads until clicks', async () => {
    const fixture = setup(['business-document:read', 'business-document:approve']);
    const items: OnlineBusinessDocument[] = Array.from({ length: 9 }, (_, index) => ({
      id: `saved-${String(index)}`,
      templateKey: 'fixed-template',
      title: `Saved ${String(index)}`,
      route: 'quotes',
      currentVersion: 2,
      ...(index === 0 ? { assigneeName: 'Assignee A' } : {}),
    }));
    fixture.read.mockResolvedValue({ items });
    const pending = deferred<OnlineBusinessDocument>();
    fixture.api.mockReturnValueOnce(pending.promise);
    fixture.mount();
    await flushBehaviorPromises();
    expect(fixture.read).toHaveBeenCalledExactlyOnceWith('/api/v1/business-documents?route=quotes');
    expect(fixture.api).not.toHaveBeenCalled();
    const saved = fixture.content.querySelectorAll('.business-document-open');
    expect(saved).toHaveLength(8);
    expect(saved.some((node) => node.textContent.includes('Saved 8'))).toBe(false);
    const first = saved[0];
    if (!first) throw new Error('Saved button missing');
    expect(first.textContent).toBe('Saved 0 · V2 · 待办：Assignee A');
    first.click();
    first.click();
    expect(first.disabled).toBe(true);
    expect(fixture.api).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/business-documents/saved-0',
      undefined,
    );
    const full = { ...created, id: 'saved-0' };
    pending.resolve(full);
    await flushBehaviorPromises();
    expect(first.disabled).toBe(false);
    const editor = fixture.editor.mock.calls[0];
    if (!editor?.[2]) throw new Error('Saved completion missing');
    expect(editor[0]).toBe(full);
    expect(editor[1]).toEqual({
      manage: false,
      approve: true,
      send: false,
      translate: false,
      configure: false,
    });
    editor[2](9);
    expect(first.textContent).toBe('Saved 0 · V9 · 待办：Assignee A');
    expect(
      byText(fixture.content, 'Saved 0 已保存为 V9，仍保留在当前业务页的“已保存在线文档”。').dataset
        .state,
    ).toBe('success');
  });

  it.each([new Error('Controlled full read rejection'), null])(
    'restores saved buttons on full-read failure (%s)',
    async (failure) => {
      const fixture = setup(['business-document:read']);
      fixture.read.mockResolvedValue({ items: [created] });
      fixture.api.mockRejectedValueOnce(failure);
      fixture.mount();
      await flushBehaviorPromises();
      const button = fixture.content.querySelector('.business-document-open');
      if (!button) throw new Error('Saved button missing');
      button.click();
      await flushBehaviorPromises();
      expect(button.disabled).toBe(false);
      expect(fixture.editor).not.toHaveBeenCalled();
      expect(
        byText(fixture.content, failure instanceof Error ? failure.message : '在线文档读取失败')
          .dataset.state,
      ).toBe('error');
      button.click();
      await flushBehaviorPromises();
      expect(fixture.editor).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps empty and failed saved registers distinct and supports routes without subject config', async () => {
    const fixture = setup(['business-document:manage', 'business-document:read']);
    fixture.mount({ BUSINESS_DOCUMENT_SUBJECTS: {} });
    await flushBehaviorPromises();
    expect(fixture.read).not.toHaveBeenCalledWith('/subjects');
    expect(byText(fixture.content, '暂无，选择上方模板新建')).toBeDefined();
    const technical = setup(['business-document:read']);
    technical.read.mockRejectedValue(5);
    technical.mount({ visibleAppRoutes: () => new Set<AppRoute>(['technical-requirements']) });
    await flushBehaviorPromises();
    expect(byText(technical.content, '技术需求常用模板')).toBeDefined();
    expect(byText(technical.content, '读取失败')).toBeDefined();
    expect(technical.content.querySelectorAll('section')).toHaveLength(1);
  });
});
