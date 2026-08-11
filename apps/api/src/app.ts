import { randomUUID } from 'node:crypto';
import { DomainError, type AuthorizationRepository, type EmployeeRepository, type OrganizationRepository } from '@kingturf/domain';
import { DATA_SCOPES, type DataScope, type EmployeeDto, type ErrorCode, type ErrorEnvelope, type HealthStatus, type OrganizationDto, type PermissionKey } from '@kingturf/types';
import { authorizeQuery } from './policy.ts';
import type { AuthenticationService } from './security.ts';

type Json = HealthStatus | ErrorEnvelope | OrganizationDto | EmployeeDto | readonly unknown[] | Readonly<Record<string, unknown>>;
export type ApiRequest = Readonly<{ method: string; pathname: string; headers?: Readonly<Record<string,string|undefined>>; body?: unknown }>;
export type ApiResponse = Readonly<{ body: Json; statusCode: number; headers?: Readonly<Record<string,string>> }>;
export type ApiDependencies = Readonly<{ auth: AuthenticationService; organizations: OrganizationRepository; employees: EmployeeRepository; authorization?:AuthorizationRepository }>;
export type ApiApplication = Readonly<{ dispatch(request: ApiRequest): Promise<ApiResponse> }>;
const error = (statusCode:number, code:ErrorCode, message:string, correlationId:string, details?:readonly string[]):ApiResponse=>({statusCode,body:{error:{code,message,correlationId,...(details?{details}: {})}}});
const objectBody=(body:unknown):Record<string,unknown>=>{if(typeof body!=='object'||body===null||Array.isArray(body))throw new DomainError('invalid_request','A JSON object body is required');return body as Record<string,unknown>;};
const string=(value:unknown,name:string):string=>{if(typeof value!=='string'||!value.trim())throw new DomainError('invalid_request',`${name} is required`);return value.trim();};
const bearer=(headers:Readonly<Record<string,string|undefined>>):string|null=>{const value=headers.authorization;if(!value?.startsWith('Bearer '))return null;return value.slice(7);};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const correlation=(value:string|undefined):string=>value&&UUID.test(value)?value:randomUUID();
const version=(value:unknown):number=>{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1)throw new DomainError('invalid_request','version must be a positive integer');return value;};
const strings=(value:unknown,name:string):readonly string[]=>{if(!Array.isArray(value)||value.some(v=>typeof v!=='string'||!v.trim()))throw new DomainError('invalid_request',`${name} must be an array of non-empty strings`);return [...new Set(value as string[])].sort();};
const scopes=(value:unknown):readonly DataScope[]=>{const values=strings(value,'scopes');if(values.length===0||values.some(v=>!DATA_SCOPES.includes(v as DataScope)))throw new DomainError('invalid_request','scopes contains an unsupported DataScope');return values as DataScope[];};

export function buildApp(dependencies?: ApiDependencies): ApiApplication {
  return { async dispatch(request) {
    const correlationId = correlation(request.headers?.['x-correlation-id']);
    try {
      if(request.method==='GET'&&request.pathname==='/health')return{statusCode:200,body:{status:'ok'}};
      if(!dependencies)return error(503,'internal_error','Application dependencies are unavailable',correlationId);
      if(request.method==='POST'&&request.pathname==='/api/v1/auth/login'){
        const body=objectBody(request.body);const result=await dependencies.auth.login(string(body.login,'login'),string(body.password,'password'),correlationId);
        return result?{statusCode:200,body:result}:{statusCode:401,body:{error:{code:'authentication_required',message:'Invalid credentials',correlationId}}};
      }
      const token=bearer(request.headers??{});const context=token?await dependencies.auth.authenticate(token):null;
      if(context===null)return error(401,'authentication_required','A valid session is required',correlationId);
      if(token===null)return error(401,'authentication_required','A valid session is required',correlationId);
      if(request.method==='POST'&&request.pathname==='/api/v1/auth/logout'){await dependencies.auth.logout(token,context,correlationId);return{statusCode:204,body:{}};}
      if(request.method==='GET'&&request.pathname==='/api/v1/auth/session')return{statusCode:200,body:{employeeId:context.actor.employeeId,companyId:context.actor.companyId}};
      if(request.method==='PUT'&&request.pathname==='/api/v1/auth/credential'){const body=objectBody(request.body);await dependencies.auth.changePassword(context,string(body.password,'password'),correlationId);return{statusCode:204,body:{}};}
      const organizationMatch=/^\/api\/v1\/organizations(?:\/([0-9a-f-]+))?$/u.exec(request.pathname);
      if(organizationMatch){
        const id=organizationMatch[1];
        if(request.method==='GET'&&!id){authorizeQuery(context,'organization:read');return{statusCode:200,body:await dependencies.organizations.list(context.actor.companyId)};}
        if(request.method==='GET'&&id){authorizeQuery(context,'organization:read');const found=await dependencies.organizations.findById(id,context.actor.companyId);return found?{statusCode:200,body:found}:error(404,'not_found','Organization not found',correlationId);}
        if(request.method==='POST'&&!id){authorizeQuery(context,'organization:create');const b=objectBody(request.body);const created=await dependencies.organizations.create({ownerOrganizationId:context.actor.companyId,parentId:typeof b.parentId==='string'?b.parentId:null,code:string(b.code,'code'),name:string(b.name,'name'),locale:typeof b.locale==='string'?b.locale:'zh-CN',currency:typeof b.currency==='string'?b.currency:'CNY',active:true},context.actor,correlationId);return{statusCode:201,body:created};}
        if(request.method==='PATCH'&&id){const b=objectBody(request.body);const fields=Object.keys(b).filter(k=>k!=='version');authorizeQuery(context,'organization:update',fields);const updated=await dependencies.organizations.update(id,context.actor.companyId,b,version(b.version),context.actor,correlationId);return{statusCode:200,body:updated};}
      }
      const employeeMatch=/^\/api\/v1\/employees(?:\/([0-9a-f-]+))?$/u.exec(request.pathname);
      if(employeeMatch){
        const id=employeeMatch[1];
        if(request.method==='GET'&&!id){const grant=authorizeQuery(context,'employee:read');return{statusCode:200,body:await dependencies.employees.list(context.actor.companyId,grant.scopes,context.actor.employeeId,grant.anchors)};}
        if(request.method==='GET'&&id){const grant=authorizeQuery(context,'employee:read');const found=await dependencies.employees.findById(id,context.actor.companyId,grant.scopes,context.actor.employeeId,grant.anchors);return found?{statusCode:200,body:found}:error(404,'not_found','Employee not found',correlationId);}
        if(request.method==='POST'&&!id){authorizeQuery(context,'employee:create');const b=objectBody(request.body);const created=await dependencies.employees.create({companyId:context.actor.companyId,organizationId:string(b.organizationId,'organizationId'),employeeNumber:string(b.employeeNumber,'employeeNumber'),displayName:string(b.displayName,'displayName'),email:string(b.email,'email'),active:true},context.actor,correlationId);return{statusCode:201,body:created};}
        if(request.method==='PATCH'&&id){const b=objectBody(request.body);const fields=Object.keys(b).filter(k=>k!=='version');const grant=authorizeQuery(context,'employee:update',fields);const updated=await dependencies.employees.update(id,context.actor.companyId,b,version(b.version),context.actor,grant.scopes,grant.anchors,correlationId);return{statusCode:200,body:updated};}
      }
      const authorizationMatch=/^\/api\/v1\/(roles|permissions|grants|assignments)$/u.exec(request.pathname);
      if(authorizationMatch){const capability:PermissionKey=`authorization:${request.method==='GET'?'read':'manage'}`;authorizeQuery(context,capability);const repository=dependencies.authorization;if(!repository)return error(503,'internal_error','Authorization repository is unavailable',correlationId);const resource=authorizationMatch[1];const b=request.method==='GET'?{}:objectBody(request.body);
        if(resource==='roles'){if(request.method==='GET')return{statusCode:200,body:await repository.listRoles(context.actor.companyId)};if(request.method==='POST')return{statusCode:201,body:await repository.createRole({code:string(b.code,'code'),name:string(b.name,'name')},context.actor,correlationId)};}
        if(resource==='permissions'){if(request.method==='GET')return{statusCode:200,body:await repository.listPermissions()};if(request.method==='POST')return{statusCode:201,body:await repository.createPermission({capability:string(b.capability,'capability') as PermissionKey,description:string(b.description,'description')},context.actor,correlationId)};}
        if(resource==='grants'){if(request.method==='GET')return{statusCode:200,body:await repository.listGrants(context.actor.companyId)};const roleId=string(b.roleId,'roleId'),permissionId=string(b.permissionId,'permissionId');if(request.method==='POST'){await repository.grant({roleId,permissionId,scopes:scopes(b.scopes),fields:b.fields===null||b.fields===undefined?null:strings(b.fields,'fields')},context.actor,correlationId);return{statusCode:204,body:{}};}if(request.method==='DELETE'){await repository.revoke(roleId,permissionId,context.actor,correlationId);return{statusCode:204,body:{}};}}
        if(resource==='assignments'){if(request.method==='GET')return{statusCode:200,body:await repository.listAssignments(context.actor.companyId)};const employeeId=string(b.employeeId,'employeeId'),roleId=string(b.roleId,'roleId');if(request.method==='POST'){await repository.assign(employeeId,roleId,context.actor,correlationId);return{statusCode:204,body:{}};}if(request.method==='DELETE'){await repository.unassign(employeeId,roleId,context.actor,correlationId);return{statusCode:204,body:{}};}}
      }
      return error(404,'not_found','Route not found',correlationId);
    } catch(cause) { if(cause instanceof DomainError){const status=cause.code==='forbidden'?403:cause.code==='not_found'?404:cause.code==='conflict'?409:400;return error(status,cause.code,cause.message,correlationId);} return error(500,'internal_error','Internal server error',correlationId); }
  }};
}
