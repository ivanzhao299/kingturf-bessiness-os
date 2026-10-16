import type { RegisterContext, RegisterBindings } from './register-types';

export function createRegisterSearch(
  context: RegisterContext,
  bindings: Pick<RegisterBindings, 'recordDates' | 'recordAmounts' | 'renderItems'>,
) {
  const { sourceItems, registerState } = context;
  const { search, dateFrom, dateTo, amountFrom, amountTo, statusFilter, attentionFilter } =
    context.controls;
  const { recordDates, recordAmounts, renderItems } = bindings;
  const applySearch = () => {
    const query = search.value.trim().toLocaleLowerCase('zh-CN');
    const fromDate = dateFrom.value ? Date.parse(`${dateFrom.value}T00:00:00Z`) : undefined;
    const toDate = dateTo.value ? Date.parse(`${dateTo.value}T23:59:59Z`) : undefined;
    const minimumAmount = amountFrom.value.length > 0 ? Number(amountFrom.value) : undefined;
    const maximumAmount = amountTo.value.length > 0 ? Number(amountTo.value) : undefined;
    registerState.filteredItems = sourceItems.filter((item) => {
      const dates = recordDates(item);
      const amounts = recordAmounts(item);
      const dateMatches =
        fromDate === undefined && toDate === undefined
          ? true
          : dates.some(
              (date) =>
                (fromDate === undefined || date >= fromDate) &&
                (toDate === undefined || date <= toDate),
            );
      const amountMatches =
        minimumAmount === undefined && maximumAmount === undefined
          ? true
          : amounts.some(
              (amount) =>
                (minimumAmount === undefined || amount >= minimumAmount) &&
                (maximumAmount === undefined || amount <= maximumAmount),
            );
      return (
        (query.length === 0 || item.textContent.toLocaleLowerCase('zh-CN').includes(query)) &&
        (statusFilter.value.length === 0 ||
          Array.from(
            item.querySelectorAll<HTMLElement>('.status-badge, .ctr-state, .version-pin'),
          ).some((entry) => entry.textContent.trim() === statusFilter.value)) &&
        (attentionFilter.value.length === 0 ||
          (attentionFilter.value === 'attention'
            ? /逾期|驳回|未通过|隔离|待审|异常|冻结|退回/u.test(item.textContent)
            : item.querySelector('button:not(:disabled)') !== null)) &&
        dateMatches &&
        amountMatches
      );
    });
    if (registerState.sortMode === 'name')
      registerState.filteredItems.sort((left, right) =>
        left.textContent.localeCompare(right.textContent, 'zh-CN'),
      );
    if (registerState.sortMode === 'status')
      registerState.filteredItems.sort((left, right) => {
        const statusOf = (entry: HTMLElement) =>
          entry.querySelector<HTMLElement>('.status-badge, .ctr-state, .version-pin')
            ?.textContent ?? '';
        return statusOf(left).localeCompare(statusOf(right), 'zh-CN');
      });
    registerState.page = 1;
    renderItems();
  };
  return applySearch;
}
