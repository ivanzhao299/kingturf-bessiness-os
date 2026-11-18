-- A1（TD-SEC-011）：凭证首登强制改密。
-- 纯加性列：NOT NULL DEFAULT false 对存量行回填 false；旧应用不读该列。
-- 置位 = 管理员 provisionIdentity；清位 = 本人 PUT /auth/credential 成功事务内。
ALTER TABLE password_credentials ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
