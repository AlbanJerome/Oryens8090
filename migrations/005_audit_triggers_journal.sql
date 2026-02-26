-- Database-level audit: capture OLD/NEW row snapshots for journal_entries and journal_entry_lines
-- into audit_log (including metadata JSONB). Ensures changes made in Supabase Dashboard are also audited.
-- Run after 001_global_scale_schema.sql (audit_log and metadata columns exist).

-- Helper: insert one audit_log row with old_record/new_record payload
CREATE OR REPLACE FUNCTION audit_log_journal_entries_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_entity_id UUID;
  v_old_json JSONB;
  v_new_json JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_tenant_id := OLD.tenant_id;
    v_entity_id := OLD.id;
    v_old_json := to_jsonb(OLD);
    v_new_json := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_tenant_id := NEW.tenant_id;
    v_entity_id := NEW.id;
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);
  ELSE
    v_tenant_id := NEW.tenant_id;
    v_entity_id := NEW.id;
    v_old_json := NULL;
    v_new_json := to_jsonb(NEW);
  END IF;

  INSERT INTO audit_log (tenant_id, user_id, action, entity_type, entity_id, payload, created_at)
  VALUES (
    v_tenant_id,
    NULL,
    'journal_entries.' || TG_OP,
    'journal_entries',
    v_entity_id::TEXT,
    jsonb_build_object('old_record', v_old_json, 'new_record', v_new_json),
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_trigger_journal_entries ON journal_entries;
CREATE TRIGGER audit_trigger_journal_entries
  AFTER INSERT OR UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE PROCEDURE audit_log_journal_entries_trigger_fn();


-- journal_entry_lines: resolve tenant_id from parent journal_entries
CREATE OR REPLACE FUNCTION audit_log_journal_entry_lines_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_entry_id UUID;
  v_entity_id UUID;
  v_old_json JSONB;
  v_new_json JSONB;
BEGIN
  v_entry_id := COALESCE(NEW.entry_id, OLD.entry_id);

  SELECT tenant_id INTO v_tenant_id
  FROM journal_entries WHERE id = v_entry_id;

  IF v_tenant_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_entity_id := OLD.id;
    v_old_json := to_jsonb(OLD);
    v_new_json := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := NEW.id;
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);
  ELSE
    v_entity_id := NEW.id;
    v_old_json := NULL;
    v_new_json := to_jsonb(NEW);
  END IF;

  INSERT INTO audit_log (tenant_id, user_id, action, entity_type, entity_id, payload, created_at)
  VALUES (
    v_tenant_id,
    NULL,
    'journal_entry_lines.' || TG_OP,
    'journal_entry_lines',
    v_entity_id::TEXT,
    jsonb_build_object('old_record', v_old_json, 'new_record', v_new_json),
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_trigger_journal_entry_lines ON journal_entry_lines;
CREATE TRIGGER audit_trigger_journal_entry_lines
  AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
  FOR EACH ROW EXECUTE PROCEDURE audit_log_journal_entry_lines_trigger_fn();
