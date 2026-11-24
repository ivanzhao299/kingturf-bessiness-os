import { describe, expect, it } from 'vitest';
import { apiErrorMessage, failureMessage } from './shared/api-error-message';

// TD-WF-006（写流程真浏览器冒烟发现）：错误位直接显示接口英文原文。映射模块只认常见的那一部分，
// 认不出的一律回退到原文——这些用例两头都守：命中的转成中文，未命中的逐字节不变。
const hasCjk = (text: string): boolean => /[\u3400-\u9fff]/u.test(text);

describe('apiErrorMessage（接口错误文案转中文）', () => {
  // 冒烟里实际出现的四类。
  it.each([
    ['Contact email or phone is required', '联系人的邮箱和电话至少填一项'],
    [
      'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
      '编码必须是 1 到 64 位大写字母、数字、下划线或连字符',
    ],
    ['Idempotency-Key is required', '请求缺少防重复提交标识，请刷新页面后重试'],
    ['Internal server error', '服务器处理请求时出错，请稍后重试'],
  ])('translates the message seen in the write-flow smoke: %s', (message, chinese) => {
    expect(apiErrorMessage(message)).toBe(chinese);
    expect(hasCjk(apiErrorMessage(message))).toBe(true);
  });

  it('translates the other spellings of the idempotency and transport messages', () => {
    for (const message of [
      'Idempotency-Key is required and must be at most 128 characters',
      'Idempotency-Key header is required',
      'A bounded idempotency key is required',
    ])
      expect(apiErrorMessage(message)).toBe('请求缺少防重复提交标识，请刷新页面后重试');
    expect(apiErrorMessage('Request validation failed')).toBe('提交的内容不符合要求，请检查后重试');
    expect(apiErrorMessage('A JSON object body is required')).toBe(
      '请求内容无效，请刷新页面后重试',
    );
    expect(apiErrorMessage('Route not found')).toBe('请求的功能不存在，请刷新页面后重试');
  });

  // 采购域仓储层的准入 / 超量守卫：写流程冒烟实测会遇到（未准入供应商下订单、超量收货），
  // 各控制台已把失败显示在表单里，这两句也须是中文。
  it('translates the procurement guard messages seen in the write-flow smoke', () => {
    expect(apiErrorMessage('Purchase item requires a valid supplier qualification')).toBe(
      '该物料尚未准入给此供应商，请先完成物料准入审核',
    );
    expect(apiErrorMessage('Quoted item requires a valid supplier qualification')).toBe(
      '该物料尚未准入给此供应商，请先完成物料准入审核',
    );
    expect(apiErrorMessage('Receipt quantity exceeds open purchase order quantity')).toBe(
      '收货数量超过采购订单的未收数量',
    );
  });

  // 带字段名的消息出自服务端的通用入参解析器：字段名与数值原样带进中文文案。
  it.each([
    ['customerId is required', '缺少必填项：customerId'],
    ['recipientName exceeds 200 characters', 'recipientName 超过 200 个字符的上限'],
    [
      'overdueGraceDays must be an integer between 0 and 365',
      'overdueGraceDays 必须是 0 到 365 之间的整数',
    ],
    ['amount must be non-negative', 'amount 不能是负数'],
    ['customerId must be a UUID', 'customerId 必须是有效的标识'],
    ['requiredAt must be a valid YYYY-MM-DD date', 'requiredAt 必须是有效日期（YYYY-MM-DD）'],
    ['receivedAt must be a valid timestamp', 'receivedAt 必须是有效的时间'],
    ['effectiveAt must be an ISO timestamp', 'effectiveAt 必须是有效的时间'],
    ['Unsupported fields: foo, bar', '包含不支持的字段：foo, bar'],
    ['Lead version is stale', '这条记录已在别处被修改，请刷新后重试'],
    ['Opportunity version conflict', '这条记录已在别处被修改，请刷新后重试'],
  ])('carries the field name and the numbers: %s', (message, chinese) => {
    expect(apiErrorMessage(message)).toBe(chinese);
  });

  it('falls back to the original text for everything it does not recognise', () => {
    for (const message of [
      'Open purchase order not found',
      'Contact phone is malformed',
      'submit rejected',
      'Cost matrices require company scope',
      // 整句才匹配：多一个词就不是字段消息，不能被改写成「缺少必填项」。
      'The credit limit is required for this operation',
      // 带后缀的版本冲突另有原因（越权范围、记录不可用），不能被改写成「已被修改」。
      'Employee version is stale, outside the granted data scope, or record is unavailable',
      'Request validation failed: lines',
      // 只去掉首尾空白再比对：句子中间或末尾多一个词都不算命中。
      'Internal server error occurred',
      '',
      '   ',
    ])
      expect(apiErrorMessage(message)).toBe(message);
    expect(hasCjk(apiErrorMessage('Open purchase order not found'))).toBe(false);
  });

  it('leaves a message that is already in Chinese untouched', () => {
    for (const message of [
      '销售政策未通过：毛利率低于 22% 红线',
      '报价未关联有效客户',
      '成本模型没有成本因子，不能执行核算',
      // 已是中文的消息即使形状像字段消息也不改写。
      '报价 is required',
    ])
      expect(apiErrorMessage(message)).toBe(message);
  });

  it('matches ignoring surrounding whitespace and never returns an inherited property', () => {
    expect(apiErrorMessage('  Internal server error\n')).toBe('服务器处理请求时出错，请稍后重试');
    // 未命中时连首尾空白一起原样返回（不替调用方修剪）。
    expect(apiErrorMessage('  not recognised  ')).toBe('  not recognised  ');
    for (const key of ['constructor', 'toString', '__proto__', 'hasOwnProperty'])
      expect(apiErrorMessage(key)).toBe(key);
  });
});

describe('failureMessage（控制台把失败写进状态之前的那一步）', () => {
  it('translates the message of an Error and keeps non-Error failures on the fallback', () => {
    expect(failureMessage(new Error('Internal server error'), '线索创建失败')).toBe(
      '服务器处理请求时出错，请稍后重试',
    );
    expect(
      failureMessage(new TypeError('Contact email or phone is required'), '联系人创建失败'),
    ).toBe('联系人的邮箱和电话至少填一项');
    expect(failureMessage(new Error('sku 已存在'), '物料创建失败')).toBe('sku 已存在');
    for (const value of [
      'Internal server error',
      { message: 'Internal server error' },
      null,
      undefined,
      42,
    ])
      expect(failureMessage(value, '线索创建失败')).toBe('线索创建失败');
    // 与此前各控制台的写法一致：Error 没有消息时仍是空串，不换成兜底文案。
    expect(failureMessage(new Error(''), '线索创建失败')).toBe('');
  });
});
