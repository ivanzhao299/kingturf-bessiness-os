import './startup.css';
import { bootstrap } from './entry';

const root = document.querySelector<HTMLElement>('#app');

if (root === null) {
  throw new Error('Application root was not found');
}

void bootstrap(root);
