export function commercialDashboardQuery(): URLSearchParams {
  const year = new Date().getUTCFullYear();
  return new URLSearchParams({
    from: `${String(year)}-01-01T00:00:00.000Z`,
    to: `${String(year + 1)}-01-01T00:00:00.000Z`,
    currency: 'CNY',
  });
}
