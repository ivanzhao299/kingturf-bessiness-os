// Optional malformed-but-mapped 200 JSON. All request classification stays in the base router.
export function withBoundaryParserFixtures(base) {
  let malformedQuote = false;
  return {
    ...base,
    boundaryQuoteFailure(value) {
      malformedQuote = value;
    },
    async respond(pathname, method, parameters = new URLSearchParams()) {
      const reply = await base.respond(pathname, method, parameters);
      if (malformedQuote && pathname === '/api/v1/quotes')
        return { ...reply, value: { items: 'malformed-synthetic-list' } };
      return reply;
    },
  };
}
