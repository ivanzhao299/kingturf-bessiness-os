import './style.css';
import { bootstrap } from './bootstrap';

const root = document.querySelector<HTMLElement>('#app');

if (root === null) {
  throw new Error('Application root was not found');
}

void bootstrap(root);
