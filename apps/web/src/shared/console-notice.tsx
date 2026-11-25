import './console-notice.css';

// TD-WF-014①（写流程冒烟 WS-P3-01）：所有写操作都没有成功提示，唯一的反馈是抽屉关闭 / 列表变化；在「草稿」
// 筛选下发布物料后那一行直接从列表消失，看起来像点了没反应。
//
// 这里是一条轻量的状态行（同仓库里既有的状态行 / console-hint 一类呈现，不是会自动消失的浮层，也不用
// alert）：写成功后由控制台写一句话进来，用户开始下一个动作（打开别的记录或表单）时清空。节点一直挂着、
// 没有内容时不显示——读屏的 live region 要先于内容存在才会播报。
// 位置：详情抽屉开着时放抽屉底部的 footer（桌面与手机上都看得见，不随抽屉体滚走），否则放页头下方。
export type Notice = Readonly<{ message: string }>;

export const ConsoleNotice = ({ message }: Notice) => (
  <p class="console-notice" role="status" data-testid="console-notice">
    {message}
  </p>
);
