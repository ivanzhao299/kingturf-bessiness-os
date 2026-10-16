import type { RegisterProfile } from './register-profile';
import type { RegisterControls } from './register-controls';

export type RegisterState = {
  page: number;
  filteredItems: HTMLElement[];
  sortMode: 'business' | 'name' | 'status';
  compact: boolean;
  fields: 'complete' | 'key';
  selectedItem: HTMLElement | undefined;
  selectedItems: Set<HTMLElement>;
};

export type RegisterContext = Readonly<{
  list: HTMLElement & { parentElement: HTMLElement };
  sourceItems: HTMLElement[];
  profile: RegisterProfile;
  controls: RegisterControls;
  pageSize: number;
  viewKey: string;
  selectAll: HTMLInputElement;
  registerState: RegisterState;
}>;

export type RegisterBindings = Readonly<{
  recordName: (item: HTMLElement) => string;
  recordStatus: (item: HTMLElement) => string;
  recordDates: (item: HTMLElement) => number[];
  recordAmounts: (item: HTMLElement) => number[];
  updateFieldMode: () => void;
  updateSelection: () => void;
  renderItems: () => void;
  applySearch: () => void;
  showDrawer: (profile: RegisterProfile, title: string, content: HTMLElement) => void;
  openDetailDrawer: (item: HTMLElement, profile: RegisterProfile) => void;
}>;
