// TD-WF-006（写流程真浏览器冒烟发现）：接口的校验与失败消息大多是英文，此前被各控制台原样写进
// 错误位（「Contact email or phone is required」「Internal server error」…）。这里把其中常见的转成
// 中文；认不出的一律回退到原文——宁可显示英文，也不吞掉信息。只映射文案：不改请求、状态或载荷。
// 各控制台在把失败写进状态之前经 failureMessage 转一遍。

const IDEMPOTENCY_MISSING = '请求缺少防重复提交标识，请刷新页面后重试';

/** 整句匹配：接口校验与传输层的固定文案，键是接口返回的 message 原文。 */
const EXACT: ReadonlyMap<string, string> = new Map([
  ['Contact email or phone is required', '联系人的邮箱和电话至少填一项'],
  [
    'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    '编码必须是 1 到 64 位大写字母、数字、下划线或连字符',
  ],
  // 同一个意思的四种写法（几个路由各写各的）。界面每次写请求都带该请求头，出现它说明页面不是
  // 最新版本，刷新即可。
  ['Idempotency-Key is required', IDEMPOTENCY_MISSING],
  ['Idempotency-Key is required and must be at most 128 characters', IDEMPOTENCY_MISSING],
  ['Idempotency-Key header is required', IDEMPOTENCY_MISSING],
  ['A bounded idempotency key is required', IDEMPOTENCY_MISSING],
  // 500 的响应信封不含内部细节，这句话本身没有可转述的信息；细节在服务端日志里。
  ['Internal server error', '服务器处理请求时出错，请稍后重试'],
  // 采购域仓储层的准入 / 超量守卫（写流程冒烟实测会遇到：未准入供应商下订单、超量收货）。
  [
    'Purchase item requires a valid supplier qualification',
    '该物料尚未准入给此供应商，请先完成物料准入审核',
  ],
  [
    'Quoted item requires a valid supplier qualification',
    '该物料尚未准入给此供应商，请先完成物料准入审核',
  ],
  ['Receipt quantity exceeds open purchase order quantity', '收货数量超过采购订单的未收数量'],
  ['Request validation failed', '提交的内容不符合要求，请检查后重试'],
  ['A JSON object body is required', '请求内容无效，请刷新页面后重试'],
  ['Route not found', '请求的功能不存在，请刷新页面后重试'],
]);

/** 带字段名（或数值）的消息：整句匹配的正则 → 中文文案（$1、$2… 是捕获到的字段名与数值）。
 *  都出自服务端的通用入参解析器，字段名是单个标识符；整句之外多一个词都不算命中。 */
const FAMILIES: readonly (readonly [pattern: RegExp, template: string])[] = [
  [/^(\S+) is required$/u, '缺少必填项：$1'],
  [/^(\S+) exceeds (\d+) characters$/u, '$1 超过 $2 个字符的上限'],
  [/^(\S+) must be an integer between (-?\d+) and (-?\d+)$/u, '$1 必须是 $2 到 $3 之间的整数'],
  [/^(\S+) must be non-negative$/u, '$1 不能是负数'],
  [/^(\S+) must be a UUID$/u, '$1 必须是有效的标识'],
  [/^(\S+) must be a valid YYYY-MM-DD date$/u, '$1 必须是有效日期（YYYY-MM-DD）'],
  [/^(\S+) must be an? (?:valid |ISO )?timestamp$/u, '$1 必须是有效的时间'],
  [/^Unsupported fields: (.+)$/u, '包含不支持的字段：$1'],
  // 乐观锁：界面提交的版本号已落后于库里的记录（别处改过）。
  [/^.+ version (?:is stale|conflict)$/u, '这条记录已在别处被修改，请刷新后重试'],
];

const HAS_CJK = /[\u3400-\u9fff]/u;

/** 把一条接口消息转成中文；认不出的原样返回（逐字节，不去空白）。 */
export const apiErrorMessage = (message: string): string => {
  // 已经是中文的（控制台自己抛出的业务提示、接口里本就中文的文案）不动。
  if (HAS_CJK.test(message)) return message;
  const text = message.trim();
  const exact = EXACT.get(text);
  if (exact !== undefined) return exact;
  for (const [pattern, template] of FAMILIES)
    if (pattern.test(text)) return text.replace(pattern, template);
  return message;
};

/** 一次失败要显示的文案：Error 取其消息并转成中文，其它值用调用方的兜底文案。 */
export const failureMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? apiErrorMessage(error.message) : fallback;
