import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

const identitySql =
  'SELECT current_database() AS database,pg_postmaster_start_time()::text AS started,system_identifier::text AS instance FROM pg_control_system()';

export function validateSourceControl(control) {
  assert(control && typeof control === 'object');
  assert.deepEqual(Object.keys(control).sort(), ['identity', 'marker', 'schema']);
  assert.match(control.schema, /^authz_http_[a-f0-9]{32}$/u);
  assert.match(control.marker, /^[a-f0-9]{64}$/u);
  assert.deepEqual(Object.keys(control.identity).sort(), ['database', 'instance', 'started']);
  for (const value of Object.values(control.identity))
    assert(typeof value === 'string' && value.length > 0 && value.length <= 512);
  return control;
}

// The connection has already passed the loopback guard and host/container identity check.
// Values remain private; only the generated, validated identifier enters SQL text.
export async function verifySourceControl(client, control) {
  validateSourceControl(control);
  const actual = (await client.query(identitySql)).rows[0];
  assert(
    actual &&
      ['database', 'started', 'instance'].every((key) => actual[key] === control.identity[key]),
    'source owner instance mismatch',
  );
  const rows = (await client.query(`SELECT marker FROM ${control.schema}.source_owner_marker`))
    .rows;
  assert(rows.length === 1 && rows[0].marker === control.marker, 'source owner marker mismatch');
}

export async function createSourceOwnership(admin, expected) {
  const control = validateSourceControl({
    schema: `authz_http_${randomUUID().replaceAll('-', '')}`,
    marker: randomBytes(32).toString('hex'),
    identity: {
      database: expected.database,
      started: expected.started,
      instance: expected.instance,
    },
  });
  // One transaction: no schema-without-owner-marker setup gap.
  await admin.transaction(async (client) => {
    const actual = (await client.query(identitySql)).rows[0];
    assert(
      actual && Object.keys(control.identity).every((key) => actual[key] === control.identity[key]),
      'source owner setup instance mismatch',
    );
    await client.query(`CREATE SCHEMA ${control.schema}`);
    await client.query(`CREATE TABLE ${control.schema}.source_owner_marker (marker text NOT NULL)`);
    await client.query(`INSERT INTO ${control.schema}.source_owner_marker(marker) VALUES($1)`, [
      control.marker,
    ]);
  });
  let closed = false;
  return {
    control,
    // Only the host calls this, after its exact owned container and children are gone.
    async close() {
      if (closed) return;
      await admin.transaction(async (client) => {
        await verifySourceControl(client, control);
        await client.query(
          `LOCK TABLE ${control.schema}.source_owner_marker IN ACCESS EXCLUSIVE MODE`,
        );
        await verifySourceControl(client, control);
        await client.query(`DROP SCHEMA ${control.schema} CASCADE`);
        const remaining = await client.query(
          'SELECT count(*)::int AS n FROM pg_namespace WHERE nspname=$1',
          [control.schema],
        );
        assert.equal(remaining.rows[0].n, 0, 'source owner removal unconfirmed');
      });
      closed = true;
    },
  };
}
