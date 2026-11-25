const trimmed = (value: string | undefined): string => (value ?? '').trim();

export function paymentIntakePayload(values: Readonly<Record<string, string>>) {
  return {
    customerId: trimmed(values.customerId),
    currency: values.currency === undefined ? 'CNY' : trimmed(values.currency),
    amount: trimmed(values.amount),
    receivedAt: new Date(`${trimmed(values.receivedAt)}T12:00:00.000Z`).toISOString(),
    bankReference: trimmed(values.bankReference),
    rawPayload: { payer: trimmed(values.payer), source: 'MANUAL_BANK_RECEIPT' },
  };
}

export const reconciliationPayload = (paymentId: string) => ({ paymentId });
