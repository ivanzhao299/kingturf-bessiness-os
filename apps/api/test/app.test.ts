import { describe, expect, it, vi } from 'vitest';
import type { AuthorizationContext, AuthorizationRepository, EmployeeRepository, OrganizationRepository } from '@kingturf/domain';
import type { DataScope, EmployeeDto, OrganizationDto } from '@kingturf/types';
import { buildApp } from '../src/app.js';
import type { AuthenticationService } from '../src/security.js';

const employeeId='10000000-0000-4000-8000-000000000001';
const companyId='20000000-0000-4000-8000-000000000002';
const targetId='30000000-0000-4000-8000-000000000003';
const organizationId='40000000-0000-4000-8000-000000000004';
const context=(permissions:AuthorizationContext['permissions']):AuthorizationContext=>({actor:{employeeId,companyId},permissions});
const grant=(capability:`${string}:${string}`,scopes:readonly DataScope[]=['COMPANY'],fields:null|readonly string[]=null):AuthorizationContext['permissions']=>new Map([[capability,{scopes,fields}]]);
const organization:OrganizationDto={id:organizationId,ownerOrganizationId:companyId,parentId:null,code:'OPS',name:'Operations',locale:'zh-CN',currency:'CNY',active:true,version:1};
const employee:EmployeeDto={id:targetId,companyId,organizationId,employeeNumber:'E-1',displayName:'Employee',email:'employee@example.test',active:true,version:1};

function dependencies(authContext:AuthorizationContext|null){
  const logout=vi.fn(()=>Promise.resolve());
  const auth={authenticate:vi.fn(()=>Promise.resolve(authContext)),login:vi.fn(()=>Promise.resolve({token:'opaque',expiresAt:new Date().toISOString()})),logout,changePassword:vi.fn(()=>Promise.resolve())} as unknown as AuthenticationService;
  const organizations={create:vi.fn(()=>Promise.resolve(organization)),findById:vi.fn(()=>Promise.resolve(organization)),list:vi.fn(()=>Promise.resolve([organization])),update:vi.fn(()=>Promise.resolve(organization))} satisfies OrganizationRepository;
  const employees={create:vi.fn(()=>Promise.resolve(employee)),findById:vi.fn(()=>Promise.resolve(employee)),list:vi.fn(()=>Promise.resolve([employee])),update:vi.fn(()=>Promise.resolve(employee))} satisfies EmployeeRepository;
  const assign=vi.fn(()=>Promise.resolve());const grantPermission=vi.fn(()=>Promise.resolve());
  const authorization={listRoles:vi.fn(()=>Promise.resolve([])),createRole:vi.fn(()=>Promise.resolve({id:targetId,organizationId:companyId,code:'ADMIN',name:'Admin',version:1})),listPermissions:vi.fn(()=>Promise.resolve([])),createPermission:vi.fn(),listGrants:vi.fn(()=>Promise.resolve([])),grant:grantPermission,revoke:vi.fn(()=>Promise.resolve()),listAssignments:vi.fn(()=>Promise.resolve([])),assign,unassign:vi.fn(()=>Promise.resolve())} as unknown as AuthorizationRepository;
  return {auth,organizations,employees,authorization,assign,grantPermission,logout};
}
const dispatch=(deps:ReturnType<typeof dependencies>,method:string,pathname:string,body?:unknown,correlationId?:string)=>buildApp(deps).dispatch({method,pathname,headers:{authorization:'Bearer opaque','x-correlation-id':correlationId},body});

describe('authentication and protected API contracts',()=>{
  it('supports login, session validation, and logout',async()=>{const deps=dependencies(context(new Map()));expect((await buildApp(deps).dispatch({method:'POST',pathname:'/api/v1/auth/login',body:{login:'admin',password:'correct-password'}})).statusCode).toBe(200);expect((await dispatch(deps,'GET','/api/v1/auth/session')).body).toEqual({employeeId,companyId});expect((await dispatch(deps,'POST','/api/v1/auth/logout')).statusCode).toBe(204);expect(deps.logout).toHaveBeenCalledWith('opaque',expect.anything(),expect.stringMatching(/^[0-9a-f-]{36}$/u));});
  it('rejects missing/invalid sessions and defaults to deny',async()=>{const missing=dependencies(null);expect((await buildApp(missing).dispatch({method:'GET',pathname:'/api/v1/employees'})).statusCode).toBe(401);const denied=dependencies(context(new Map()));expect((await dispatch(denied,'GET','/api/v1/employees')).statusCode).toBe(403);expect(denied.employees.list).not.toHaveBeenCalled();});
});

describe('organization and employee tenant boundaries',()=>{
  it('exercises organization create and tenant-qualified read',async()=>{const createDeps=dependencies(context(grant('organization:create')));expect((await dispatch(createDeps,'POST','/api/v1/organizations',{code:'OPS',name:'Operations'})).statusCode).toBe(201);expect(createDeps.organizations.create).toHaveBeenCalledWith(expect.objectContaining({ownerOrganizationId:companyId,currency:'CNY',locale:'zh-CN'}),expect.objectContaining({companyId}),expect.stringMatching(/^[0-9a-f-]{36}$/u));const readDeps=dependencies(context(grant('organization:read')));await dispatch(readDeps,'GET',`/api/v1/organizations/${organizationId}`);expect(readDeps.organizations.findById).toHaveBeenCalledWith(organizationId,companyId);});
  it('passes update DataScope through and enforces field allowlists',async()=>{const deps=dependencies(context(grant('employee:update',['SELF'],['displayName'])));expect((await dispatch(deps,'PATCH',`/api/v1/employees/${targetId}`,{displayName:'New name',version:1})).statusCode).toBe(200);expect(deps.employees.update).toHaveBeenCalledWith(targetId,companyId,expect.anything(),1,expect.anything(),['SELF'],[],expect.stringMatching(/^[0-9a-f-]{36}$/u));expect((await dispatch(deps,'PATCH',`/api/v1/employees/${targetId}`,{organizationId,version:1})).statusCode).toBe(403);});
  it.each([{}, {version:'1'}, {version:0}, {version:1.2}])('returns 400 for an invalid PATCH version %#',async(body)=>{const deps=dependencies(context(grant('employee:update')));expect((await dispatch(deps,'PATCH',`/api/v1/employees/${targetId}`,body)).statusCode).toBe(400);expect(deps.employees.update).not.toHaveBeenCalled();});
  it('replaces a malformed caller correlation ID with an audit-safe UUID',async()=>{const deps=dependencies(context(new Map()));const response=await dispatch(deps,'GET','/api/v1/employees',undefined,'not-a-uuid');expect(response.statusCode).toBe(403);expect((response.body as {error:{correlationId:string}}).error.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/u);expect((response.body as {error:{correlationId:string}}).error.correlationId).not.toBe('not-a-uuid');});
});

describe('authorization management API',()=>{
  it('defaults role assignment management to deny',async()=>{const deps=dependencies(context(new Map()));expect((await dispatch(deps,'POST','/api/v1/assignments',{employeeId,targetId,roleId:organizationId})).statusCode).toBe(403);expect(deps.assign).not.toHaveBeenCalled();});
  it('secures and correlates role grants and assignments',async()=>{const deps=dependencies(context(grant('authorization:manage')));expect((await dispatch(deps,'POST','/api/v1/grants',{roleId:organizationId,permissionId:targetId,scopes:['SELF']})).statusCode).toBe(204);expect(deps.grantPermission).toHaveBeenCalledWith(expect.objectContaining({roleId:organizationId,permissionId:targetId,scopes:['SELF']}),expect.objectContaining({companyId}),expect.stringMatching(/^[0-9a-f-]{36}$/u));expect((await dispatch(deps,'POST','/api/v1/assignments',{employeeId:targetId,roleId:organizationId})).statusCode).toBe(204);expect(deps.assign).toHaveBeenCalledWith(targetId,organizationId,expect.objectContaining({companyId}),expect.stringMatching(/^[0-9a-f-]{36}$/u));});
});
