import type { ApiDependencies } from '../app.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type WebsiteLeads = Pick<NonNullable<ApiDependencies['websiteLeads']>, 'ingest'>;
type Ingest = WebsiteLeads['ingest'];
type ValidatedIngest = Readonly<{
  repository: WebsiteLeads;
  ingest: Ingest;
  rawBody: Parameters<Ingest>[0];
  timestamp: Parameters<Ingest>[1];
  signature: Parameters<Ingest>[2];
}>;
type Context = Readonly<{
  repository: () => WebsiteLeads;
  correlationId: Parameters<Ingest>[3];
}>;

export function websiteLeadIngestRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) =>
        pathname === '/api/v1/integrations/website/leads' ? { params: [] } : null,
      validate: (request): ValidatedIngest => {
        const repository = context.repository();
        const ingest = repository.ingest;
        const rawBody = request.body;
        const timestamp = request.headers?.['x-kingturf-timestamp'];
        const signature = request.headers?.['x-kingturf-signature'];
        return { repository, ingest, rawBody, timestamp, signature };
      },
      handler: async (_request, _match, validated) => {
        const result = await validated.ingest.call(
          validated.repository,
          validated.rawBody,
          validated.timestamp,
          validated.signature,
          context.correlationId,
        );
        return { statusCode: result.duplicate ? 200 : 201, body: result };
      },
    }),
  ];
}
