import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { localCases, safeLocalCases } from './private-contract.mjs';

// This reporter writes only inside the owned container tmpfs. Other original reporters stay raw
// there too. The controller separately validates and re-encodes this bounded result document.
export default class PrivateReporter {
  cases = [];
  discovered = 0;
  invalid = false;

  onBegin(_config, suite) {
    this.discovered = suite.allTests().length;
  }

  onError() {
    this.invalid = true;
  }

  onTestEnd(test, result) {
    const kind = process.env.KINGTURF_PRIVATE_KIND;
    assert(Object.hasOwn(localCases, kind), 'unknown private reporter target');
    const index = localCases[kind].indexOf(test.title);
    if (index < 0) {
      this.invalid = true;
      return;
    }
    this.cases.push({
      index,
      status: result.status,
      durationMs: Math.round(result.duration),
      line: test.location.line,
    });
  }

  async onEnd() {
    const kind = process.env.KINGTURF_PRIVATE_KIND;
    await writeFile(
      '/tmp/kingturf-private/cases.json',
      JSON.stringify({
        discovered: this.discovered,
        complete: !this.invalid && this.cases.length === this.discovered,
        cases: safeLocalCases(kind, this.cases),
      }),
      { mode: 0o600 },
    );
  }
}
