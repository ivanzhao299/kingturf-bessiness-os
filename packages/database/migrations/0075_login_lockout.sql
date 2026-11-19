-- A-F2a（A2-F1）：持久登录锁定。
-- 纯加性列：failed_attempts 存量回填 0、locked_until 存量 NULL；旧应用不读这两列。
-- 递增/置位 = 登录失败事务内（阈值/窗口 env 可配）；清零 = 成功登录建会话同事务。
ALTER TABLE identities ADD COLUMN failed_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE identities ADD COLUMN locked_until timestamptz;
