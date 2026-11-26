import { useEffect, useState } from 'preact/hooks';
import { failureMessage } from '../../shared/api-error-message';
import { PurchaseOrderCreateDrawer, purchaseOrderPayload } from './po-create';
import type { MrpChoice, MrpRow } from './mrp-ports';
import type { MrpViewState } from './mrp-console-actions';
import { idOf, textOf } from './mrp-state';

type Props = Readonly<{ state: MrpViewState; origin: MrpRow; close: () => void }>;

// TD-MFG-013：来源取自已授权读取的建议行，固定在闭包中；不从表单或 URL 重新取引用。
export function MrpPurchaseOrderDrawer({ state, origin, close }: Props) {
  const [suppliers, setSuppliers] = useState<readonly MrpChoice[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void state.ports.loadPurchaseSuppliers?.().then(
      (choices) => {
        if (live) setSuppliers(choices);
      },
      (failure: unknown) => {
        if (live) setError(failureMessage(failure, '供应商候选加载失败，可填写供应商编号'));
      },
    );
    return () => {
      live = false;
    };
  }, []);
  return (
    <PurchaseOrderCreateDrawer
      ports={{ supplierChoices: suppliers, itemVersionChoices: state.ports.itemVersionChoices }}
      origin={{
        id: idOf(origin),
        itemVersionId: textOf(origin.item_version_id),
        quantity: textOf(origin.quantity),
        requiredAt: textOf(origin.due_at).slice(0, 10),
      }}
      error={error}
      close={close}
      submit={async (values) => {
        setError('');
        try {
          await state.ports.submit(
            '/api/v1/purchase-orders',
            purchaseOrderPayload({ ...values, mrpProposalId: idOf(origin) }),
          );
        } catch (failure: unknown) {
          setError(failureMessage(failure, '创建采购订单失败'));
          return;
        }
        close();
        await state.runRefresh();
      }}
    />
  );
}
