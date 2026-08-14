-- Append-only correction: reassignment is a distinct privileged CRM action.
INSERT INTO permissions(capability,description)
VALUES ('customer-ownership:reassign','Reassign customer ownership')
ON CONFLICT(capability) DO NOTHING;
