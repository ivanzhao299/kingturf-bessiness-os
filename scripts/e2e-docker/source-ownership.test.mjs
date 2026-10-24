import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {
  createSourceOwnership,
  validateSourceControl,
  verifySourceControl,
} from './source-ownership.mjs';
import { validateLocalCommand } from './private-contract.mjs';

const identity = { database: 'synthetic_test', started: 'fixed-start', instance: 'fixed-instance' };
function fakeDatabase() {
  const calls = [];
  let marker, schema;
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes('pg_control_system()')) return { rows: [{ ...identity }] };
      if (sql.startsWith('CREATE SCHEMA ')) schema = sql.slice('CREATE SCHEMA '.length);
      if (sql.startsWith('INSERT INTO ')) marker = values[0];
      if (sql.startsWith('SELECT marker ')) return { rows: [{ marker }] };
      if (sql.startsWith('DROP SCHEMA ')) schema = undefined;
      if (sql.includes('FROM pg_namespace')) return { rows: [{ n: schema === undefined ? 0 : 1 }] };
      return { rows: [] };
    },
  };
  return {
    calls,
    transaction: (work) => work(client),
    client,
    corrupt: () => {
      marker = 'wrong';
    },
  };
}

test('Source ownership is exact, parameterizes marker values and verifies identity before DROP', async () => {
  const db = fakeDatabase();
  const owner = await createSourceOwnership(db, identity);
  assert.equal(validateSourceControl(owner.control), owner.control);
  assert(
    db.calls.some(
      ({ sql, values }) => sql.includes('VALUES($1)') && values[0] === owner.control.marker,
    ),
  );
  assert(db.calls.every(({ sql }) => !sql.includes(owner.control.marker)));
  await owner.close();
  const drop = db.calls.findIndex(({ sql }) => sql.startsWith('DROP SCHEMA '));
  assert(drop > 0);
  assert(
    db.calls.slice(0, drop).filter(({ sql }) => sql.startsWith('SELECT marker ')).length === 2,
  );
  assert(
    db.calls.some(
      ({ sql, values }) => sql.includes('FROM pg_namespace') && values[0] === owner.control.schema,
    ),
  );
  const count = db.calls.length;
  await owner.close();
  assert.equal(db.calls.length, count);
});

test('wrong private marker retains the exact schema instead of deleting a guessed resource', async () => {
  const db = fakeDatabase();
  const owner = await createSourceOwnership(db, identity);
  db.corrupt();
  await assert.rejects(owner.close(), /marker mismatch/u);
  assert(!db.calls.some(({ sql }) => sql.startsWith('DROP SCHEMA ')));
});

test('foreign instance or malformed ownership never permits schema creation or deletion', async () => {
  const db = fakeDatabase();
  await assert.rejects(
    createSourceOwnership(db, { ...identity, instance: 'foreign' }),
    /instance mismatch/u,
  );
  assert(!db.calls.some(({ sql }) => /^(?:CREATE|DROP)/u.test(sql)));
  const valid = { schema: `authz_http_${'a'.repeat(32)}`, marker: 'b'.repeat(64), identity };
  for (const change of [
    { schema: 'public' },
    { schema: `${valid.schema};DROP` },
    { marker: '' },
    { identity: {} },
    { extra: true },
  ])
    assert.throws(() => validateSourceControl({ ...valid, ...change }));
  await assert.rejects(
    verifySourceControl(db.client, { ...valid, identity: { ...identity, started: 'foreign' } }),
    /instance mismatch/u,
  );
  assert(!db.calls.some(({ sql }) => sql.startsWith('SELECT marker ')));
});

test('Source lifecycle fault entry is bounded to Source, not P1/runtime/production', () => {
  for (const fault of ['source-cancel', 'source-kill', 'source-failure']) {
    validateLocalCommand('source', 'fixed-source-check', fault);
    for (const kind of ['p1', 'runtime', 'cost', 'production-readonly'])
      assert.throws(() => validateLocalCommand(kind, 'fixed-source-check', fault));
  }
});

test('all original 19 producer test call bodies remain byte-identical to the accepted baseline', () => {
  const source = readFileSync(
    new URL('../../apps/api/test/authorization-http-postgres.integration.test.ts', import.meta.url),
    'utf8',
  );
  const ast = ts.createSourceFile('producer.ts', source, ts.ScriptTarget.Latest, true);
  const bodies = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'it'
    )
      bodies.push(node.getText(ast));
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.equal(bodies.length, 19);
  assert.equal(
    createHash('sha256').update(JSON.stringify(bodies)).digest('hex'),
    'de059920e9bee2c63dfa158f9577ffbbf6d80d4760ad9f8caa8cf4f0e06dc645',
  );
  assert(source.includes('if (externalOwner)'));
  assert(
    source.includes(
      'ownedSchema !== undefined || ownedMarker !== undefined || ownedIdentity !== undefined',
    ),
  );
  assert(
    source.includes('cleanup.push(() => admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`))'),
  );
});
