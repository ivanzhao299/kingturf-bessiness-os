// Isolated opt-in overlay: no new permission, route or write API.
export function withRegisterTools(router) {
  return {
    ...router,
    async respond(pathname, method, parameters = new URLSearchParams()) {
      if (pathname === '/api/v1/quotes' && parameters.toString() !== '')
        throw new Error('unmapped synthetic API request query');
      const response = await router.respond(pathname, method, parameters);
      if (pathname !== '/api/v1/quotes' || response.status !== 200) return response;
      const first = response.value.items[0] ?? {
        id: 'cdp-quote-version-a',
        quoteId: 'cdp-quote-a',
        quoteNumber: 'CDP-Q-A',
        revision: 1,
        status: 'DRAFT',
        currency: 'CNY',
        total: '25000',
        discount: '0',
        costTotal: '20000',
        margin: '5000',
        marginBasisPoints: 2000,
        lines: [
          {
            description: 'CDP草坪甲',
            quantity: '100',
            unit_code: 'M2',
            unit_price: '250',
            total: '25000',
          },
        ],
      };
      return {
        ...response,
        value: {
          ...response.value,
          items: [
            first,
            ...Array.from({ length: 11 }, (_, index) => {
              const number = 11 - index;
              return {
                ...first,
                id: `cdp-register-version-${String(number)}`,
                quoteId: `cdp-register-quote-${String(number)}`,
                quoteNumber: `CDP-REG-${String(number).padStart(2, '0')}`,
                status: number % 2 ? 'DRAFT' : 'REJECTED',
                total: String(11000 + number),
                lines: [
                  {
                    description: `CDP register ${String(number)} 2026-01-${String(number).padStart(2, '0')}`,
                    quantity: '1',
                    unit_code: 'M2',
                    unit_price: String(11000 + number),
                    total: String(11000 + number),
                  },
                ],
              };
            }),
          ],
          nextCursor: null,
        },
      };
    },
  };
}
