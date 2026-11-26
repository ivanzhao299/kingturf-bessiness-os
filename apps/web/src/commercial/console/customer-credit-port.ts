// TD-CRM-006：客户控制台的信用概要端口装配（纯函数，便于单测「无权限不请求」）。
// 仅当账号具备 credit:read 且 CRM HTTP 客户端带信用读取方法时才注入 loadCredit；否则不注入——
// 控制台因此不发任何信用请求、不显示卡片（与接线之前一致，也没有空白占位）。
import type { CrmController } from '../../crm/controller';
import type { CustomerConsolePorts } from './customer-ports';

type CreditSource = Pick<CrmController, 'creditSummary' | 'hasCreditReads'>;

export const creditPortFor = (
  permissions: ReadonlySet<string>,
  controller: CreditSource,
): Pick<CustomerConsolePorts, 'loadCredit'> =>
  permissions.has('credit:read') && controller.hasCreditReads
    ? { loadCredit: (customerId) => controller.creditSummary(customerId) }
    : {};
