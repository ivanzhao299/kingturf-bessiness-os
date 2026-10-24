import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openForm } from './shared/forms';
import { requestId } from './http';
import { createOnlineEditorSave } from './shared/online-editor-save';
import { createOnlineEditorReview } from './shared/online-editor-review';
import { openOnlineEditorSendForm } from './shared/online-editor-send-form';
import type { OnlineEditorPorts } from './shared/online-editor-types';
import {
  createBehaviorElement,
  findElement,
  flushBehaviorPromises,
  htmlElement,
} from '../test/fixtures/behavior-dom';

vi.mock('./shared/forms', () => ({ openForm: vi.fn() }));
vi.mock('./http', () => ({ requestId: vi.fn() }));
type Context = Parameters<typeof createOnlineEditorSave>[0] &
  Parameters<typeof createOnlineEditorReview>[0] &
  Parameters<typeof openOnlineEditorSendForm>[0];
const element = <K extends keyof HTMLElementTagNameMap>(tag: K) =>
  htmlElement(createBehaviorElement(tag)) as HTMLElementTagNameMap[K];
const deferred = <T>() => {
  let resolve: (value: T) => void = () => {
    throw new Error('Not initialized');
  };
  let reject: (reason: unknown) => void = () => {
    throw new Error('Not initialized');
  };
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
};
const setup = () => {
  const body = element('div');
  body.innerHTML = '<p>saved</p>';
  const api = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>(() =>
    Promise.resolve({ currentVersion: 8 }),
  );
  const apiReceivers: unknown[] = [];
  const onlineDocumentApi: OnlineEditorPorts['onlineDocumentApi'] = function <T>(
    this: unknown,
    path: string,
    init?: RequestInit,
  ) {
    apiReceivers.push(this);
    return api(path, init) as Promise<T>;
  };
  const cache = vi.fn(),
    onSaved = vi.fn(),
    addHistory = vi.fn(),
    historyGetter = vi.fn();
  const sanitize = vi.fn(() => '<p>clean</p>'),
    text = vi.fn(() => 'Clean text');
  const mode = vi.fn();
  const context: Context = {
    body,
    onlineDocumentApi,
    documentData: {
      id: 'document-1',
      templateKey: 'fixed',
      title: '固定文档',
      route: 'quotes',
      currentVersion: 3,
    },
    permissions: { manage: true, approve: true, send: true, translate: true, configure: false },
    state: {
      activeVersion: 7,
      documentState: 'DRAFT',
      latestContent: { html: '<p>saved</p>' },
      editable: true,
      savedEditorHtml: '<p>saved</p>',
    },
    versions: [{ version: 7, content: { html: '<p>saved</p>' }, changeSummary: 'old' }],
    upgradedLegacyOutline: false,
    sanitizeBusinessDocumentHtml: sanitize,
    businessDocumentText: text,
    versionStatus: element('p'),
    status: element('p'),
    summary: element('input'),
    save: element('button'),
    history: element('section'),
    actionPanel: element('section'),
    setViewMode: mode,
    clearSessionReadCache: cache,
    onSaved,
    callbacks: {
      get addVersionToHistory() {
        historyGetter();
        return addHistory;
      },
    },
  };
  return {
    context,
    api,
    apiReceivers,
    cache,
    onSaved,
    addHistory,
    historyGetter,
    sanitize,
    text,
    mode,
  };
};
const parseBody = (init?: RequestInit): unknown => {
  if (typeof init?.body !== 'string') throw new Error('Expected JSON request');
  return JSON.parse(init.body) as unknown;
};
beforeEach(() => {
  vi.mocked(openForm).mockClear();
  vi.mocked(requestId).mockReset();
  vi.stubGlobal('document', { createElement: createBehaviorElement, body: element('main') });
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T12:34:56Z'));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('real online document save callbacks, not the old broad submit source match', () => {
  it('sends the pinned version and independent sanitized payload once, updates history and preserves original old version', async () => {
    const f = setup(),
      initial = f.context.versions[0];
    const pending = deferred<{ currentVersion: number }>();
    f.api.mockReturnValueOnce(pending.promise);
    const controls = createOnlineEditorSave(f.context);
    controls.summary.value = '  调整数量  ';
    controls.save.click();
    controls.save.click();
    expect(f.api).toHaveBeenCalledTimes(1);
    expect(f.api.mock.calls[0]?.[0]).toBe('/api/v1/business-documents/document-1/versions');
    expect(f.api.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(parseBody(f.api.mock.calls[0]?.[1])).toEqual({
      expectedVersion: 7,
      content: { body: 'Clean text', html: '<p>clean</p>' },
      changeSummary: '  调整数量  ',
    });
    expect(f.apiReceivers).toEqual([undefined]);
    expect(f.sanitize).toHaveBeenCalledExactlyOnceWith('<p>saved</p>');
    expect(f.text).toHaveBeenCalledExactlyOnceWith({ html: '<p>clean</p>' });
    expect(controls.save.disabled).toBe(true);
    expect(f.historyGetter).not.toHaveBeenCalled();
    expect(f.onSaved).not.toHaveBeenCalled();
    pending.resolve({ currentVersion: 8 });
    await flushBehaviorPromises();
    expect(f.context.state).toMatchObject({
      activeVersion: 8,
      latestContent: { body: 'Clean text', html: '<p>clean</p>' },
      savedEditorHtml: '<p>clean</p>',
    });
    expect(f.context.body.innerHTML).toBe('<p>clean</p>');
    expect(f.context.versions[1]).toBe(initial);
    expect(f.context.versions[0]).toEqual({
      version: 8,
      content: { body: 'Clean text', html: '<p>clean</p>' },
      changeSummary: '调整数量',
      createdAt: '2026-10-17T12:34:56.000Z',
    });
    expect(f.historyGetter).toHaveBeenCalledTimes(1);
    expect(f.addHistory.mock.calls[0]?.[0]).toBe(f.context.versions[0]);
    expect(f.addHistory.mock.calls[0]?.[1]).toBe(true);
    expect(f.addHistory.mock.contexts[0]).toBeUndefined();
    expect(f.onSaved).toHaveBeenCalledExactlyOnceWith(8);
    expect(f.onSaved.mock.contexts[0]).toBeUndefined();
    expect(f.cache).toHaveBeenCalledTimes(1);
    expect(controls.save.disabled).toBe(false);
    expect(controls.summary.value).toBe('');
    expect(controls.status.dataset.state).toBe('success');
    expect(f.context.versionStatus.textContent).toContain('V8');
  });

  it('does not overwrite newer local edits when an earlier save resolves', async () => {
    const f = setup(),
      pending = deferred<{ currentVersion: number }>();
    f.api.mockReturnValueOnce(pending.promise);
    const controls = createOnlineEditorSave(f.context);
    controls.summary.value = '保存快照';
    controls.save.click();
    f.context.body.innerHTML = '<p>new local edit</p>';
    pending.resolve({ currentVersion: 8 });
    await flushBehaviorPromises();
    expect(f.context.body.innerHTML).toBe('<p>new local edit</p>');
    expect(f.context.state.savedEditorHtml).toBe('<p>clean</p>');
    expect(f.context.state.activeVersion).toBe(8);
  });

  it('rejects empty text/summary locally and exposes visibility as a UI rule, not an API permission guard', () => {
    const f = setup();
    f.text.mockReturnValueOnce('  ');
    const controls = createOnlineEditorSave(f.context);
    controls.save.click();
    expect(controls.status.textContent).toBe('文档正文不能为空');
    controls.save.click();
    expect(controls.status.textContent).toBe('请填写本版修改说明');
    expect(f.api).not.toHaveBeenCalled();
    expect(
      createOnlineEditorSave({
        ...f.context,
        permissions: { ...f.context.permissions, manage: false },
      }).save.hidden,
    ).toBe(true);
    expect(
      createOnlineEditorSave({ ...f.context, state: { ...f.context.state, editable: false } }).save
        .hidden,
    ).toBe(true);
  });

  it.each([new Error('fixed save failure'), null])(
    'retains old version on save failure and retries (%j)',
    async (failure) => {
      const f = setup();
      f.api.mockRejectedValueOnce(failure);
      const controls = createOnlineEditorSave(f.context);
      controls.summary.value = '重试保存';
      controls.save.click();
      await flushBehaviorPromises();
      expect(controls.status.textContent).toBe(
        failure instanceof Error ? 'fixed save failure' : '在线文档保存失败',
      );
      expect(f.context.state.activeVersion).toBe(7);
      expect(f.context.versions).toHaveLength(1);
      expect(f.cache).not.toHaveBeenCalled();
      expect(f.onSaved).not.toHaveBeenCalled();
      expect(controls.save.disabled).toBe(false);
      controls.save.click();
      await flushBehaviorPromises();
      expect(f.api).toHaveBeenCalledTimes(2);
      expect(parseBody(f.api.mock.calls[1]?.[1])).toMatchObject({ expectedVersion: 7 });
      expect(f.context.state.activeVersion).toBe(8);
    },
  );
});

describe('real online document review actions and receiver/version contract', () => {
  it('blocks unsaved submit and too-short reason before any command', () => {
    const f = setup();
    createOnlineEditorReview(f.context);
    f.context.body.innerHTML = 'new';
    const root = createBehaviorElement('main');
    htmlElement(root).append(f.context.actionPanel);
    findElement(root, (node) => node.tagName === 'BUTTON').click();
    expect(f.context.status.textContent).toContain('未保存');
    f.context.body.innerHTML = f.context.state.savedEditorHtml;
    findElement(root, (node) => node.tagName === 'BUTTON').click();
    expect(f.context.status.textContent).toContain('至少 2');
    expect(f.api).not.toHaveBeenCalled();
  });

  it.each([
    ['submit', '提交审核', 'DRAFT', 'IN_REVIEW', false],
    ['approve', '批准并锁版', 'IN_REVIEW', 'APPROVED', false],
    ['reject', '驳回修改', 'IN_REVIEW', 'REJECTED', true],
  ] as const)(
    'runs %s against active version and updates only after response',
    async (action, label, state, expectedState, editable) => {
      const f = setup();
      f.context.state.documentState = state;
      f.context.state.editable = state === 'DRAFT';
      const pending = deferred<unknown>();
      f.api.mockReturnValueOnce(pending.promise);
      const root = createBehaviorElement('main');
      htmlElement(root).append(f.context.actionPanel);
      const { reviewReason } = createOnlineEditorReview(f.context);
      reviewReason.value = '  固定审核意见  ';
      const button = findElement(
        root,
        (node) => node.tagName === 'BUTTON' && node.textContent === label,
      );
      button.click();
      button.click();
      expect(f.api).toHaveBeenCalledTimes(1);
      expect(f.api.mock.calls[0]?.[0]).toBe(`/api/v1/business-documents/document-1/${action}`);
      expect(f.api.mock.calls[0]?.[1]?.method).toBe('POST');
      expect(parseBody(f.api.mock.calls[0]?.[1])).toEqual({
        expectedVersion: 7,
        reason: '固定审核意见',
      });
      expect(f.apiReceivers).toEqual([undefined]);
      expect(f.context.state.documentState).toBe(state);
      pending.resolve({});
      await flushBehaviorPromises();
      expect(f.context.state.documentState).toBe(expectedState);
      expect(f.context.state.editable).toBe(editable);
      expect(f.mode).toHaveBeenCalledExactlyOnceWith(editable ? 'edit' : 'preview');
      expect(f.context.save.hidden).toBe(!editable);
      expect(f.context.summary.hidden).toBe(!editable);
      expect(reviewReason.value).toBe('');
      expect(f.cache).toHaveBeenCalledTimes(1);
      expect(f.onSaved).toHaveBeenCalledExactlyOnceWith(7);
      expect(f.onSaved.mock.contexts[0]).toBeUndefined();
      expect(f.context.status.dataset.state).toBe('success');
    },
  );

  it('retains review state on failed command and retries with the original active version', async () => {
    const f = setup();
    f.api.mockRejectedValueOnce(new Error('review rejected'));
    const root = createBehaviorElement('main');
    htmlElement(root).append(f.context.actionPanel);
    const { reviewReason } = createOnlineEditorReview(f.context);
    reviewReason.value = '固定审核意见';
    const button = findElement(root, (node) => node.tagName === 'BUTTON');
    button.click();
    await flushBehaviorPromises();
    expect(f.context.status.textContent).toBe('review rejected');
    expect(button.disabled).toBe(false);
    expect(f.context.state.documentState).toBe('DRAFT');
    expect(f.cache).not.toHaveBeenCalled();
    button.click();
    await flushBehaviorPromises();
    expect(parseBody(f.api.mock.calls[1]?.[1])).toEqual({
      expectedVersion: 7,
      reason: '固定审核意见',
    });
    expect(f.context.state.documentState).toBe('IN_REVIEW');
  });

  it('omits review actions without manage/approve permission', () => {
    const f = setup();
    const root = createBehaviorElement('main');
    htmlElement(root).append(f.context.actionPanel);
    createOnlineEditorReview({
      ...f.context,
      permissions: { ...f.context.permissions, manage: false, approve: false },
    });
    expect(root.descendants().filter((node) => node.tagName === 'BUTTON')).toEqual([]);
  });
});

describe('real document send form callback, not actual external delivery', () => {
  it('pins active version/translation, reuses retry key only for identical payload, and records queued receipt', async () => {
    const f = setup();
    const data: Context['documentData'] = {
      ...f.context.documentData,
      translations: [
        {
          id: 'translation-current',
          sourceVersion: 7,
          targetLocale: 'en-US',
          provider: 'MANUAL',
          status: 'READY',
        },
        {
          id: 'translation-old',
          sourceVersion: 6,
          targetLocale: 'de-DE',
          provider: 'MANUAL',
          status: 'READY',
        },
        {
          id: 'translation-queued',
          sourceVersion: 7,
          targetLocale: 'fr-FR',
          provider: 'CONNECTED_PROVIDER',
          status: 'QUEUED',
        },
      ],
    };
    openOnlineEditorSendForm({ ...f.context, documentData: data }, [
      {
        connector: 'EMAIL',
        label: '邮件',
        provider: 'SYNTHETIC',
        displayName: 'Synthetic',
        status: 'READY',
        version: 1,
      },
    ]);
    const call = vi.mocked(openForm).mock.calls[0];
    if (!call) throw new Error('Send form missing');
    expect(call[0]).toBe(document.body);
    expect(call[3].find((field) => field.name === 'translationId')?.options).toEqual([
      { value: '', label: '原文' },
      { value: 'translation-current', label: 'en-US 译文' },
    ]);
    vi.mocked(requestId)
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000002');
    const values = {
      channel: 'EMAIL',
      recipientName: 'Synthetic buyer',
      recipientAddress: 'buyer@example.test',
      subject: 'Fixed subject',
      message: 'Fixed message',
      translationId: 'translation-current',
    };
    f.api.mockRejectedValueOnce(new Error('queue unavailable'));
    await expect(call[5](values)).rejects.toThrow('queue unavailable');
    expect(f.cache).not.toHaveBeenCalled();
    expect(f.onSaved).not.toHaveBeenCalled();
    f.api.mockResolvedValueOnce({ id: 'send-1', status: 'QUEUED' });
    await call[5](values);
    expect(f.api.mock.calls[0]?.[0]).toBe('/api/v1/business-documents/document-1/send');
    expect(f.api.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(parseBody(f.api.mock.calls[1]?.[1])).toEqual({ expectedVersion: 7, ...values });
    expect(f.api.mock.calls[0]?.[1]?.headers).toEqual({
      'idempotency-key': '00000000-0000-4000-8000-000000000001',
    });
    expect(f.api.mock.calls[1]?.[1]?.headers).toEqual({
      'idempotency-key': '00000000-0000-4000-8000-000000000001',
    });
    expect(f.apiReceivers).toEqual([undefined, undefined]);
    expect(f.context.history.textContent).toContain('send-1');
    expect(f.context.history.textContent).not.toContain('buyer@example.test');
    expect(f.onSaved).toHaveBeenCalledExactlyOnceWith(7);
    f.api.mockResolvedValueOnce({ id: 'send-2', status: 'QUEUED' });
    f.context.state.activeVersion = 9;
    await call[5]({ ...values, subject: 'Changed subject', translationId: '' });
    expect(f.api.mock.calls[2]?.[1]?.headers).toEqual({
      'idempotency-key': '00000000-0000-4000-8000-000000000002',
    });
    expect(parseBody(f.api.mock.calls[2]?.[1])).toEqual({
      expectedVersion: 9,
      channel: 'EMAIL',
      recipientName: 'Synthetic buyer',
      recipientAddress: 'buyer@example.test',
      subject: 'Changed subject',
      message: 'Fixed message',
    });
    expect(requestId).toHaveBeenCalledTimes(2);
    expect(f.onSaved).toHaveBeenLastCalledWith(9);
  });
});
