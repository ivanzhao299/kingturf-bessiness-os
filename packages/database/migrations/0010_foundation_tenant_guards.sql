-- Composite employee foreign keys make tenant identity a database invariant.
ALTER TABLE domain_event_outbox ADD FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id);
ALTER TABLE notifications ADD FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id);
ALTER TABLE notification_recipients ADD FOREIGN KEY(employee_id,tenant_id) REFERENCES employees(id,company_id);
ALTER TABLE notification_preferences ADD FOREIGN KEY(employee_id,tenant_id) REFERENCES employees(id,company_id);
ALTER TABLE notification_delivery_attempts ADD FOREIGN KEY(employee_id,tenant_id) REFERENCES employees(id,company_id);
ALTER TABLE attachments ADD FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id);
ALTER TABLE attachment_bindings ADD FOREIGN KEY(bound_by,tenant_id) REFERENCES employees(id,company_id);
ALTER TABLE business_object_definitions ADD FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id);
ALTER TABLE business_object_versions ADD FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id);
