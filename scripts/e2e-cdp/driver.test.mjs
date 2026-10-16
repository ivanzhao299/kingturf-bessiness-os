import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { createDriver } from './driver.mjs';

function syntheticDom({
  positions = [60, 60],
  visible = true,
  hit = true,
  animations = [],
  groupContains = true,
  groupBefore = false,
  replaceAt = Infinity,
} = {}) {
  let samples = 0;
  let scrolls = 0;
  let queries = 0;
  const inputs = [];
  const group = {
    contains: () => groupContains,
    compareDocumentPosition: () => (groupBefore ? 4 : 2),
    getAnimations: () => (typeof animations === 'function' ? animations(samples) : animations),
  };
  const sidebar = { querySelectorAll: () => [group] };
  const node = {
    isConnected: true,
    dataset: { appRoute: 'different', routeView: 'different' },
    getClientRects: () => (visible ? [1] : []),
    scrollIntoView: () => {
      scrolls++;
    },
    getBoundingClientRect: () => {
      const x = positions[Math.min(samples++, positions.length - 1)];
      return { x, y: 100, width: 10, height: 20 };
    },
    contains: (candidate) => candidate === node,
    closest: () => sidebar,
  };
  const context = createContext({
    document: {
      querySelector: (selector) =>
        selector.includes('.nav-parent') ? null : ++queries >= replaceAt ? { ...node } : node,
      querySelectorAll: () => [node],
      elementFromPoint: () => (hit ? node : {}),
    },
    innerWidth: 1000,
    innerHeight: 1000,
    scrollX: 0,
    scrollY: 0,
    Node: { DOCUMENT_POSITION_FOLLOWING: 4 },
  });
  const send = async (method, params) => {
    if (method === 'Runtime.evaluate') {
      try {
        return { result: { value: await runInContext(params.expression, context) } };
      } catch {
        return { exceptionDetails: {} };
      }
    }
    assert.equal(method, 'Input.dispatchMouseEvent');
    inputs.push(params);
  };
  return { driver: createDriver(send), inputs, samples: () => samples, scrolls: () => scrolls };
}

test('real click waits for moving geometry and uses its final stable point without a second scroll', async () => {
  const probe = syntheticDom({ positions: [10, 35, 60, 60] });
  await probe.driver.click('[data-app-route="costing"]');
  assert.deepEqual(
    probe.inputs.map((event) => [event.type, event.x, event.y]),
    [
      ['mousePressed', 65, 110],
      ['mouseReleased', 65, 110],
    ],
  );
  assert.equal(probe.scrolls(), 1);
  assert.ok(probe.samples() >= 4);
});

test('related running max-height transitions must finish even when geometry briefly stops', async () => {
  const probe = syntheticDom({
    animations: (samples) =>
      samples < 3 ? [{ transitionProperty: 'max-height', playState: 'running' }] : [],
  });
  await probe.driver.click('[data-app-route="costing"]');
  assert.ok(probe.samples() >= 4);
  assert.equal(probe.inputs.length, 2);
});

test('preceding navigation group layout transitions also affect the target position', async () => {
  const probe = syntheticDom({
    groupContains: false,
    groupBefore: true,
    animations: (samples) =>
      samples < 3 ? [{ transitionProperty: 'max-height', pending: true }] : [],
  });
  await probe.driver.click('[data-app-route="costing"]');
  assert.ok(probe.samples() >= 4);
});

test('unrelated following layout animations and non-layout animations do not block clicks', async () => {
  for (const options of [
    {
      groupContains: false,
      animations: [{ transitionProperty: 'max-height', playState: 'running' }],
    },
    {
      animations: [
        { transitionProperty: 'opacity', playState: 'running' },
        { playState: 'running' },
      ],
    },
  ]) {
    const probe = syntheticDom(options);
    await probe.driver.click('[data-app-route="costing"]');
    assert.equal(probe.samples(), 2);
    assert.equal(probe.inputs.length, 2);
  }
});

test('a replaced real node cannot inherit the old target coordinate', async () => {
  const probe = syntheticDom({ replaceAt: 3 });
  await assert.rejects(
    probe.driver.click('[data-app-route="costing"]'),
    /CDP DOM evaluation failed/u,
  );
  assert.equal(probe.inputs.length, 0);
});

for (const [name, options] of [
  ['hidden', { visible: false }],
  ['occluded by a neighboring item', { hit: false }],
  ['outside viewport', { positions: [1100, 1100] }],
  ['continuously moving', { positions: Array.from({ length: 60 }, (_, index) => index * 10) }],
])
  test(`the original shared deadline rejects a target ${name} without dispatch`, async (context) => {
    let now = 0;
    context.mock.method(Date, 'now', () => (now += 1000));
    const probe = syntheticDom(options);
    await assert.rejects(
      probe.driver.click('[data-app-route="costing"]'),
      /stable unobscured click target/u,
    );
    assert.equal(probe.inputs.length, 0);
    assert.equal(probe.scrolls(), 1);
    assert.ok(probe.samples() <= 60);
    assert.equal(now, 4000);
  });

test('route mismatch still fails rather than rewriting hash or retrying the click', async () => {
  const probe = syntheticDom();
  await assert.rejects(probe.driver.route('costing'), /exclusive route costing/u);
  assert.equal(probe.inputs.length, 2);
  assert.equal(probe.scrolls(), 1);
});
