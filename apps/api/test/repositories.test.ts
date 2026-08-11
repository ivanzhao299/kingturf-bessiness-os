import { describe, expect, it, vi } from 'vitest';
import type { Database, SqlClient } from '@kingturf/database';
import { PostgresEmployeeRepository, PostgresSecurityStore } from '../src/repositories.js';

describe('PostgreSQL authorization repositories',()=>{
  it('includes DataScope and destination organization ownership in employee updates',async()=>{
    const query=vi.fn().mockResolvedValueOnce({rows:[],rowCount:0});
    const transaction=vi.fn(async(work:(tx:SqlClient)=>Promise<unknown>)=>work({query} as SqlClient));
    const repository=new PostgresEmployeeRepository({query,transaction} as unknown as Database);
    await expect(repository.update('target','company',{organizationId:'destination'},1,{employeeId:'actor',companyId:'company'},['SELF'],[],'00000000-0000-4000-8000-000000000001')).rejects.toMatchObject({code:'conflict'});
    const [sql,values]=query.mock.calls[0] as [string,unknown[]];
    expect(sql).toContain('e.id=$9');
    expect(sql).toContain('o.owner_organization_id=$2');
    expect(values).toEqual(['target','company',null,null,'destination',null,'actor',1,'actor','actor','company']);
  });

  it('deterministically unions scopes and field allowlists from multiple roles',async()=>{
    const transaction=vi.fn(async(work:(tx:SqlClient)=>Promise<unknown>)=>work({query:vi.fn()
      .mockResolvedValueOnce({rows:[{employee_id:'employee',company_id:'company'}],rowCount:1})
      .mockResolvedValueOnce({rows:[
        {capability:'employee:update',field_allowlist:['displayName'],data_scopes:['SELF']},
        {capability:'employee:update',field_allowlist:['email'],data_scopes:['COMPANY','SELF']},
      ],rowCount:2})
      .mockResolvedValueOnce({rows:[],rowCount:0})}));
    const store=new PostgresSecurityStore({transaction} as unknown as Database);
    const result=await store.resolveSession('hash',new Date());
    expect(result?.permissions.get('employee:update')).toEqual({fields:['displayName','email'],scopes:['COMPANY','SELF']});
  });

  it('treats any unrestricted field grant as unrestricted when roles are merged',async()=>{
    const transaction=vi.fn(async(work:(tx:SqlClient)=>Promise<unknown>)=>work({query:vi.fn()
      .mockResolvedValueOnce({rows:[{employee_id:'employee',company_id:'company'}],rowCount:1})
      .mockResolvedValueOnce({rows:[
        {capability:'employee:read',field_allowlist:['displayName'],data_scopes:['SELF']},
        {capability:'employee:read',field_allowlist:null,data_scopes:['TEAM']},
      ],rowCount:2})
      .mockResolvedValueOnce({rows:[],rowCount:0})}));
    const store=new PostgresSecurityStore({transaction} as unknown as Database);
    expect((await store.resolveSession('hash',new Date()))?.permissions.get('employee:read')).toEqual({fields:null,scopes:['SELF','TEAM']});
  });

  it('keeps persisted typed anchors separate from role scopes',async()=>{
    const transaction=vi.fn(async(work:(tx:SqlClient)=>Promise<unknown>)=>work({query:vi.fn()
      .mockResolvedValueOnce({rows:[{employee_id:'employee',company_id:'company'}],rowCount:1})
      .mockResolvedValueOnce({rows:[{capability:'employee:read',field_allowlist:null,data_scopes:['SELF']}],rowCount:1})
      .mockResolvedValueOnce({rows:[{capability:'employee:read',scope:'TEAM',scope_organization_id:'team'}],rowCount:1})}));
    const result=await new PostgresSecurityStore({transaction} as unknown as Database).resolveSession('hash',new Date());
    expect(result?.permissions.get('employee:read')?.scopes).toEqual(['SELF']);
    expect(result?.scopeAnchors?.get('employee:read')).toEqual([{scope:'TEAM',organizationId:'team'}]);
  });
});
