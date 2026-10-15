import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['quality']>, 'createPlan'>;
type CreatePlan = Repository['createPlan'];
type Input = Readonly<Parameters<CreatePlan>[0]>;
type Characteristic = Input['characteristics'][number];
type ScopeContext = Readonly<Parameters<CreatePlan>[1]>;
type CorrelationId = Parameters<CreatePlan>[2];
type ValidatedPlan = Readonly<{
  repository: Repository;
  createPlan: CreatePlan;
  input: Input;
  scopeContext: ScopeContext;
  correlationId: CorrelationId;
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: CorrelationId;
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    uuid: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string, nonnegative?: boolean) => string;
    timestamp: (value: unknown, name: string) => string;
    array: (value: unknown, name: string) => readonly unknown[];
    jsonObject: (value: unknown, name: string) => Input['acceptanceRule'];
    stableCode: (value: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

function parseCharacteristic(
  entry: unknown,
  index: number,
  parsers: Context['parsers'],
): Characteristic {
  const item = parsers.objectBody(entry);
  parsers.allow(item, [
    'code',
    'name',
    'dataType',
    'unitCode',
    'lowerLimit',
    'upperLimit',
    'required',
    'instructions',
  ]);
  const dataType = parsers.string(item.dataType, `characteristics[${String(index)}].dataType`);
  if (!['NUMERIC', 'BOOLEAN', 'TEXT'].includes(dataType))
    throw new DomainError('invalid_request', 'characteristic dataType is unsupported');
  if (typeof item.required !== 'boolean')
    throw new DomainError('invalid_request', 'characteristic required must be boolean');
  return {
    code: parsers.stableCode(parsers.string(item.code, 'code')),
    name: parsers.string(item.name, 'name'),
    dataType: dataType as Characteristic['dataType'],
    ...(item.unitCode === undefined ? {} : { unitCode: parsers.string(item.unitCode, 'unitCode') }),
    ...(item.lowerLimit === undefined
      ? {}
      : { lowerLimit: parsers.decimal(item.lowerLimit, 'lowerLimit', false) }),
    ...(item.upperLimit === undefined
      ? {}
      : { upperLimit: parsers.decimal(item.upperLimit, 'upperLimit', false) }),
    required: item.required,
    instructions: parsers.string(item.instructions, 'instructions'),
  };
}

export function qualityPlanCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/quality-plans' ? { params: [] } : null),
      validate: (request): ValidatedPlan => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'code',
          'name',
          'itemVersionId',
          'inspectionStage',
          'samplingMethod',
          'acceptanceRule',
          'effectiveAt',
          'characteristics',
          'publish',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'quality-plan:manage',
          Object.keys(body),
        );
        const stage = context.parsers.string(body.inspectionStage, 'inspectionStage');
        if (!['INCOMING', 'IN_PROCESS', 'FINAL'].includes(stage))
          throw new DomainError('invalid_request', 'inspectionStage is unsupported');
        const characteristics = context.parsers
          .array(body.characteristics, 'characteristics')
          .map((entry, index) => parseCharacteristic(entry, index, context.parsers));
        if (typeof body.publish !== 'boolean')
          throw new DomainError('invalid_request', 'publish must be boolean');
        const repository = context.repository();
        const createPlan = repository.createPlan;
        const input: Input = {
          code: context.parsers.stableCode(context.parsers.string(body.code, 'code')),
          name: context.parsers.string(body.name, 'name'),
          itemVersionId: context.parsers.uuid(body.itemVersionId, 'itemVersionId'),
          inspectionStage: stage as Input['inspectionStage'],
          samplingMethod: context.parsers.string(body.samplingMethod, 'samplingMethod'),
          acceptanceRule: context.parsers.jsonObject(body.acceptanceRule, 'acceptanceRule'),
          effectiveAt: context.parsers.timestamp(body.effectiveAt, 'effectiveAt'),
          characteristics,
          publish: body.publish,
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, createPlan, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<CreatePlan>> = await validated.createPlan.call(
          validated.repository,
          validated.input,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'quality-plan:read'),
        };
      },
    }),
  ];
}
