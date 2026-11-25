import { DetailDrawer } from '@kingturf/ui';
import {
  FinFacts,
  FinLink,
  FinSection,
  FinTable,
  finDay,
  finRecord,
  finRows,
  finText,
  finWhen,
  type FinRow,
} from './fin-kit';
import {
  findQuoteLine,
  lineId,
  quoteId,
  quoteLines,
  quoteReference,
  rfqNumber,
  supplierName,
} from './sq-data';

export function SupplierQuoteDetail({
  quote,
  all,
  rfqs,
  close,
}: Readonly<{
  quote: FinRow;
  all: readonly FinRow[];
  rfqs: readonly FinRow[];
  close: () => void;
}>) {
  const reference = quoteReference(quote);
  const selectedRfq = finRecord(quote.rfq);
  const rfqId = finText(quote, 'rfq_id', 'rfqId');
  const lines = quoteLines(quote);
  return (
    <DetailDrawer title={`供应商报价详情 · ${reference}`} size="wide" onClose={close}>
      <FinSection testId="kt-sq-detail" title="报价全文">
        <FinFacts
          items={[
            ['报价编号', reference],
            ['供应商', supplierName(quote)],
            ['收件时间', finWhen(quote, 'received_at', 'receivedAt')],
            ['报价有效期', finDay(quote, 'valid_until', 'validUntil')],
            [
              '报价条款',
              Object.keys(finRecord(quote.terms)).length ? JSON.stringify(quote.terms) : '—',
            ],
          ]}
        />
        <FinTable
          testId="kt-sq-detail-lines"
          head={['询价明细', '单价', '最小订购量', '承诺到货日']}
          empty="暂无行项"
          rows={lines.map((line) => {
            const item = findQuoteLine(quote, rfqs, lineId(line));
            return [
              finText(item ?? {}, 'sku') || finText(line, 'lineNumber'),
              finText(line, 'unit_price'),
              finText(line, 'minimum_order_quantity'),
              finDay(line, 'promised_at'),
            ];
          })}
        />
      </FinSection>
      <FinSection testId="kt-sq-detail-rfq" title="对应询价单">
        {rfqId ? (
          <FinLink
            href={`#/procurement/rfqs?rfq=${encodeURIComponent(rfqId)}`}
            testId="kt-sq-rfq-link"
            onNavigate={close}
          >
            {rfqNumber(quote)}
          </FinLink>
        ) : (
          '—'
        )}
        <FinFacts
          items={[
            ['询价币种', finText(selectedRfq, 'currency') || '—'],
            ['报价截止日', finDay(selectedRfq, 'responseDueAt')],
          ]}
        />
        <FinTable
          testId="kt-sq-rfq-lines"
          head={['明细', 'SKU', '询价数量', '需求日期']}
          empty="暂无询价明细"
          rows={finRows(selectedRfq.lines).map((line) => [
            finText(line, 'lineNumber'),
            finText(line, 'sku'),
            finText(line, 'quantity'),
            finDay(line, 'requiredAt'),
          ])}
        />
      </FinSection>
      {lines.map((line) => {
        const id = lineId(line);
        const sku = finText(findQuoteLine(quote, rfqs, id) ?? {}, 'sku');
        const rows = all
          .filter(
            (other) =>
              finText(other, 'rfq_id', 'rfqId') === rfqId &&
              finText(other, 'supplier_id', 'supplierId') !==
                finText(quote, 'supplier_id', 'supplierId'),
          )
          .flatMap((other) =>
            quoteLines(other)
              .filter((candidate) => lineId(candidate) === id)
              .map((candidate) => [
                supplierName(other),
                quoteReference(other),
                finText(candidate, 'unit_price'),
                finText(candidate, 'minimum_order_quantity'),
                finDay(candidate, 'promised_at'),
                finDay(other, 'valid_until'),
              ]),
          );
        return (
          <FinSection
            key={id}
            testId={`kt-sq-comparison-${quoteId(line)}`}
            title={`同一询价明细报价对比${sku ? ` · ${sku}` : ''}`}
          >
            <FinTable
              testId={`kt-sq-comparison-table-${quoteId(line)}`}
              head={['供应商', '报价编号', '单价', '最小订购量', '承诺到货日', '有效期']}
              empty="暂无其他供应商报价"
              rows={[
                [
                  `${supplierName(quote)}（本报价）`,
                  reference,
                  finText(line, 'unit_price'),
                  finText(line, 'minimum_order_quantity'),
                  finDay(line, 'promised_at'),
                  finDay(quote, 'valid_until'),
                ],
                ...rows,
              ]}
            />
          </FinSection>
        );
      })}
    </DetailDrawer>
  );
}
