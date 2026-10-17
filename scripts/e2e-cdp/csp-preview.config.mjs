// Opt-in harness preview only. No API proxy: every synthetic API call must be intercepted.
import { CONTENT_SECURITY_POLICY } from '../../packages/config/src/csp.ts';

export default {
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    headers: { 'Content-Security-Policy-Report-Only': CONTENT_SECURITY_POLICY },
  },
};
