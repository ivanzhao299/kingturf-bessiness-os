import { describe, expect, it, vi } from 'vitest';
import type { Database, SqlClient } from '@kingturf/database';
import { PostgresEmployeeRepository, PostgresSecurityStore } from '../src/repositories.js';

describe('PostgreSQL authorization repositories',()=>{
  it('includes DataScope and destination organization ownership in employee updates',async()=>{
    const query=vi.fn()
      .mockResolvedValueOnce({rows:[{organization_id:'actor-org'}],rowCount:1})
      .mockResolvedValueOnce({rows:[],rowCount:0});
    const repository=new PostgresEmployeeRepository({query} as SqlClient);
    await expect(repository.update('target','company',{organizationId:'destination'},1,{employeeId:'actor'},['SELF'])).rejects.toMatchObject({code:'conflict'});
    const [sql,values]=query.mock.calls[1] as [string,unknown[]];
    expect(sql).toContain('e.id = $9');
    expect(sql).toContain('o.owner_organization_id=$2');
    expect(values).toEqual(['target','company',null,null,'destination',null,'actor',1,'actor']);
  });

  it('deterministically unions scopes and field allowlists from multiple roles',async()=>{
    const transaction=vi.fn(async(work:(tx:SqlClient)=>Promise<unknown>)=>work({query:vi.fn()
      .mockResolvedValueOnce({rows:[{employee_id:'employee',company_id:'company'}],rowCount:1})
      .mockResolvedValueOnce({rows:[
        {capability:'employee:update',field_allowlist:['displayName'],data_scopes:['SELF']},
        {capability:'employee:update',field_allowlist:['email'],data_scopes:['COMPANY','SELF']},
      ],rowCount:2})}));
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
      ],rowCount:2})}));
    const store=new PostgresSecurityStore({transaction} as unknown as Database);
    expect((await store.resolveSession('hash',new Date()))?.permissions.get('employee:read')).toEqual({fields:null,scopes:['SELF','TEAM']});
  });
});
