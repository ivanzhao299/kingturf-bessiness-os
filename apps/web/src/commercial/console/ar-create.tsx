// FIN-1：过账应收抽屉——字段、标签、说明与提交文字沿用旧版「过账应收发票」表单；选项集与旧版一致
//（销售订单视图里的全部订单，不做收紧）。载荷与旧版逐字节一致（ar-payload.ts）；失败原因显示在
// 表单自己的提示区（FormSection 的 error）。
import { DetailDrawer, FormSection } from '@kingturf/ui';
import type { ArViewState } from './ar-state';

export const ArCreateDrawer = ({ state }: Readonly<{ state: ArViewState }>) => (
  <DetailDrawer title="过账应收发票" onClose={state.closeForm}>
    <FormSection
      title="过账应收发票"
      description="发票固定关联已释放订单，余额将进入信用敞口。"
      fields={[
        {
          name: 'salesOrderId',
          label: '销售订单',
          type: 'select',
          required: true,
          options: state.ports.salesOrderChoices,
        },
        { name: 'documentNumber', label: '发票号码', required: true },
        { name: 'amount', label: '发票金额', type: 'number', required: true },
        { name: 'dueAt', label: '到期日', type: 'date', required: true },
      ]}
      submitLabel="确认过账"
      error={state.submitError}
      onSubmit={(values) => state.runCreate(values)}
    />
  </DetailDrawer>
);
