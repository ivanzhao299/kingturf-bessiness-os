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
const CAPABILITY=/^[a-z][a-z0-9_.-]*:[a-z][a-z0-9_.-]*$/u;
const correlation=(value:string|undefined):string=>value&&UUID.test(value)?value:randomUUID();
const uuid=(value:unknown,name:string):string=>{const result=string(value,name);if(!UUID.test(result))throw new DomainError('invalid_request',`${name} must be a UUID`);return result;};
const allow=(body:Record<string,unknown>,fields:readonly string[]):void=>{const unexpected=Object.keys(body).filter(key=>!fields.includes(key));if(unexpected.length)throw new DomainError('invalid_request',`Unsupported fields: ${unexpected.sort().join(', ')}`);};
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
        if(request.method==='GET'&&id){authorizeQuery(context,'organization:read');const found=await dependencies.organizations.findById(uuid(id,'organizationId'),context.actor.companyId);return found?{statusCode:200,body:found}:error(404,'not_found','Organization not found',correlationId);}
        if(request.method==='POST'&&!id){authorizeQuery(context,'organization:create');const b=objectBody(request.body);allow(b,['parentId','code','name','locale','currency']);const created=await dependencies.organizations.create({ownerOrganizationId:context.actor.companyId,parentId:b.parentId===null||b.parentId===undefined?null:uuid(b.parentId,'parentId'),code:string(b.code,'code'),name:string(b.name,'name'),locale:typeof b.locale==='string'?b.locale:'zh-CN',currency:typeof b.currency==='string'?b.currency:'CNY',active:true},context.actor,correlationId);return{statusCode:201,body:created};}
        if(request.method==='PATCH'&&id){const b=objectBody(request.body);allow(b,['name','parentId','active','locale','currency','version']);const fields=Object.keys(b).filter(k=>k!=='version');authorizeQuery(context,'organization:update',fields);const patch={...(typeof b.name==='string'?{name:string(b.name,'name')}:{}),...(Object.hasOwn(b,'parentId')?{parentId:b.parentId===null?null:uuid(b.parentId,'parentId')}:{}),...(typeof b.active==='boolean'?{active:b.active}:{}),...(typeof b.locale==='string'?{locale:string(b.locale,'locale')}:{}),...(typeof b.currency==='string'?{currency:string(b.currency,'currency')}:{})};const updated=await dependencies.organizations.update(uuid(id,'organizationId'),context.actor.companyId,patch,version(b.version),context.actor,correlationId);return{statusCode:200,body:updated};}
      }
      const employeeMatch=/^\/api\/v1\/employees(?:\/([0-9a-f-]+))?$/u.exec(request.pathname);
      if(employeeMatch){
        const id=employeeMatch[1];
        if(request.method==='GET'&&!id){const grant=authorizeQuery(context,'employee:read');return{statusCode:200,body:await dependencies.employees.list(context.actor.companyId,grant.scopes,context.actor.employeeId,grant.anchors)};}
        if(request.method==='GET'&&id){const grant=authorizeQuery(context,'employee:read');const found=await dependencies.employees.findById(uuid(id,'employeeId'),context.actor.companyId,grant.scopes,context.actor.employeeId,grant.anchors);return found?{statusCode:200,body:found}:error(404,'not_found','Employee not found',correlationId);}
        if(request.method==='POST'&&!id){authorizeQuery(context,'employee:create');const b=objectBody(request.body);allow(b,['organizationId','employeeNumber','displayName','email']);const created=await dependencies.employees.create({companyId:context.actor.companyId,organizationId:uuid(b.organizationId,'organizationId'),employeeNumber:string(b.employeeNumber,'employeeNumber'),displayName:string(b.displayName,'displayName'),email:string(b.email,'email'),active:true},context.actor,correlationId);return{statusCode:201,body:created};}
        if(request.method==='PATCH'&&id){const b=objectBody(request.body);allow(b,['displayName','email','organizationId','active','version']);const fields=Object.keys(b).filter(k=>k!=='version');const grant=authorizeQuery(context,'employee:update',fields);const patch={...(typeof b.displayName==='string'?{displayName:string(b.displayName,'displayName')}:{}),...(typeof b.email==='string'?{email:string(b.email,'email')}:{}),...(typeof b.organizationId==='string'?{organizationId:uuid(b.organizationId,'organizationId')}:{}),...(typeof b.active==='boolean'?{active:b.active}:{})};const updated=await dependencies.employees.update(uuid(id,'employeeId'),context.actor.companyId,patch,version(b.version),context.actor,grant.scopes,grant.anchors,correlationId);return{statusCode:200,body:updated};}
      }
      const authorizationMatch=/^\/api\/v1\/(roles|permissions|grants|assignments|scope-grants)(?:\/([0-9a-f-]+))?$/u.exec(request.pathname);
      if(authorizationMatch){const capability:PermissionKey=`authorization:${request.method==='GET'?'read':'manage'}`;authorizeQuery(context,capability);const repository=dependencies.authorization;if(!repository)return error(503,'internal_error','Authorization repository is unavailable',correlationId);const resource=authorizationMatch[1];const b=request.method==='GET'||(request.method==='DELETE'&&Boolean(authorizationMatch[2]))?{}:objectBody(request.body);
        const itemId=authorizationMatch[2];
        if(resource==='roles'&&!itemId){if(request.method==='GET')return{statusCode:200,body:await repository.listRoles(context.actor.companyId)};if(request.method==='POST'){allow(b,['code','name']);return{statusCode:201,body:await repository.createRole({code:string(b.code,'code'),name:string(b.name,'name')},context.actor,correlationId)};}}
        if(resource==='permissions'&&!itemId){if(request.method==='GET')return{statusCode:200,body:await repository.listPermissions()};if(request.method==='POST'){allow(b,['capability','description']);const value=string(b.capability,'capability');if(!CAPABILITY.test(value))throw new DomainError('invalid_request','capability must use resource:action syntax');return{statusCode:201,body:await repository.createPermission({capability:value as PermissionKey,description:string(b.description,'description')},context.actor,correlationId)};}}
        if(resource==='grants'&&!itemId){if(request.method==='GET')return{statusCode:200,body:await repository.listGrants(context.actor.companyId)};allow(b,['roleId','permissionId','scopes','fields']);const roleId=uuid(b.roleId,'roleId'),permissionId=uuid(b.permissionId,'permissionId');if(request.method==='POST'){const fields=b.fields===null||b.fields===undefined?null:strings(b.fields,'fields');if(fields?.some(field=>!/^[A-Za-z][A-Za-z0-9]*$/u.test(field)))throw new DomainError('invalid_request','fields contains an unsupported field name');await repository.grant({roleId,permissionId,scopes:scopes(b.scopes),fields},context.actor,correlationId);return{statusCode:204,body:{}};}if(request.method==='DELETE'){await repository.revoke(roleId,permissionId,context.actor,correlationId);return{statusCode:204,body:{}};}}
        if(resource==='assignments'&&!itemId){if(request.method==='GET')return{statusCode:200,body:await repository.listAssignments(context.actor.companyId)};allow(b,['employeeId','roleId']);const employeeId=uuid(b.employeeId,'employeeId'),roleId=uuid(b.roleId,'roleId');if(request.method==='POST'){await repository.assign(employeeId,roleId,context.actor,correlationId);return{statusCode:204,body:{}};}if(request.method==='DELETE'){await repository.unassign(employeeId,roleId,context.actor,correlationId);return{statusCode:204,body:{}};}}
        if(resource==='scope-grants'){if(request.method==='GET'&&!itemId)return{statusCode:200,body:await repository.listScopeGrants(context.actor.companyId)};if(request.method==='POST'&&!itemId){allow(b,['employeeId','permissionId','scope','organizationId']);const selected=scopes([b.scope])[0];if(!selected)throw new DomainError('invalid_request','scope is required');const organizationId=b.organizationId===null||b.organizationId===undefined?null:uuid(b.organizationId,'organizationId');const typed=selected==='TEAM'||selected==='DEPARTMENT'||selected==='REGION';if(typed!==Boolean(organizationId))throw new DomainError('invalid_request',typed?'Typed scopes require organizationId':'SELF, COMPANY, and GROUP do not accept organizationId');return{statusCode:201,body:await repository.grantScope({employeeId:uuid(b.employeeId,'employeeId'),permissionId:uuid(b.permissionId,'permissionId'),scope:selected,organizationId},context.actor,correlationId)};}if(request.method==='DELETE'&&itemId){allow(b,[]);await repository.revokeScope(uuid(itemId,'scopeGrantId'),context.actor,correlationId);return{statusCode:204,body:{}};}}
      }
      return error(404,'not_found','Route not found',correlationId);
    } catch(cause) { if(cause instanceof DomainError){const status=cause.code==='forbidden'?403:cause.code==='not_found'?404:cause.code==='conflict'?409:400;return error(status,cause.code,cause.message,correlationId);} return error(500,'internal_error','Internal server error',correlationId); }
  }};
}
