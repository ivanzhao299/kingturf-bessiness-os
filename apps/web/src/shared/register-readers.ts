export function createRegisterReaders() {
  const recordName = (item: HTMLElement) =>
    item.querySelector<HTMLElement>('strong, h3, h4')?.textContent.trim() ?? '业务记录';
  const recordStatus = (item: HTMLElement) =>
    Array.from(item.querySelectorAll<HTMLElement>('.status-badge, .ctr-state, .version-pin'))
      .map((entry) => entry.textContent.trim())
      .filter(Boolean)
      .join('、');
  const recordDates = (item: HTMLElement) =>
    Array.from(item.textContent.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/gu), (match) =>
      Date.parse(`${match[1] ?? ''}T00:00:00Z`),
    ).filter(Number.isFinite);
  const recordAmounts = (item: HTMLElement) => {
    const text = item.textContent.replace(/,/gu, '');
    const values = [
      ...Array.from(text.matchAll(/(?:CNY|RMB|人民币|¥|￥)\s*(-?\d+(?:\.\d+)?)/giu), (match) =>
        Number(match[1]),
      ),
      ...Array.from(
        text.matchAll(
          /(?:金额|货值|应收|回款|到账|余额|成本|报价|合同额|差异)\s*[：:]?\s*(-?\d+(?:\.\d+)?)/gu,
        ),
        (match) => Number(match[1]),
      ),
    ];
    return values.filter(Number.isFinite);
  };
  return { recordName, recordStatus, recordDates, recordAmounts };
}
