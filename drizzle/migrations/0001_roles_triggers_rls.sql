-- =============================================================================
-- 0001  Roles, helper functions, invariant triggers, row-level security
-- =============================================================================
-- Hand-written. Drizzle cannot express roles, triggers or policies, so every
-- database-level rule lives here (and in later hand-written migrations).
-- Read src/db/schema.ts first. Forward-only: never edit once applied.
--
-- Connection model (CLAUDE.md > Conventions):
--   The app connects with the project's `postgres` credentials and, inside
--   every request transaction, runs
--       SET LOCAL ROLE wows_app;
--       SELECT set_config('app.user_id', '<uuid>', true);
--   `wows_app` is NOLOGIN, NOBYPASSRLS and does not own the tables, so every
--   policy below applies to it. Migrations, seed and backups run as
--   `postgres` without SET ROLE and are the only paths that bypass RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Application role
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wows_app') THEN
    CREATE ROLE wows_app NOLOGIN NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;
--> statement-breakpoint
GRANT wows_app TO postgres;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO wows_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wows_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wows_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wows_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO wows_app;
--> statement-breakpoint

-- PostgREST (anon / authenticated / service_role) is not a data path for this
-- app. Supabase grants those roles access to public tables by default; take
-- it away now and for every future table.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
    END IF;
  END LOOP;
END
$$;
--> statement-breakpoint

-- Append-only tables (H7, H8, H9, H31): the app role simply has no privilege.
REVOKE UPDATE, DELETE ON price_bars, orders, fills, theses, audit_log FROM wows_app;
--> statement-breakpoint
-- Scenario configs are never edited in place (H6).
REVOKE UPDATE ON scenarios FROM wows_app;
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 2. Helper functions used by policies and triggers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
  LANGUAGE sql STABLE
  SET search_path = public, pg_temp
AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;
--> statement-breakpoint

-- SECURITY DEFINER so policy evaluation can read user_roles without recursing
-- into user_roles' own policies.
CREATE OR REPLACE FUNCTION app_has_role(p_role role, p_season uuid DEFAULT NULL) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = app_user_id()
      AND ur.role = p_role
      AND (p_season IS NULL OR ur.season_id = p_season)
  )
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_is_core() RETURNS boolean
  LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT app_has_role('core') $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_is_faculty() RETURNS boolean
  LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT app_has_role('faculty') $$;
--> statement-breakpoint

-- Staff read everything. Faculty never appear in a write policy.
CREATE OR REPLACE FUNCTION app_is_staff() RETURNS boolean
  LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT app_has_role('core') OR app_has_role('faculty') $$;
--> statement-breakpoint

-- Anyone admitted to the club in any capacity; applicants are not.
CREATE OR REPLACE FUNCTION app_is_participant() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = app_user_id()
      AND ur.role IN ('member', 'lead', 'core', 'faculty', 'alum')
  )
$$;
--> statement-breakpoint

-- Can write activity (orders, forecasts, theses, ...) in a given season.
CREATE OR REPLACE FUNCTION app_can_play(p_season uuid) RETURNS boolean
  LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT app_has_role('member', p_season) OR app_has_role('lead', p_season) $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_is_lead(p_season uuid) RETURNS boolean
  LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT app_has_role('lead', p_season) $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_is_lead_anywhere() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = app_user_id() AND ur.role = 'lead'
  )
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION season_is_settled(p_season uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM seasons s WHERE s.id = p_season AND s.state IN ('settled', 'archived')
  )
$$;
--> statement-breakpoint

-- Season lookups for tables that reach their season indirectly.
CREATE OR REPLACE FUNCTION season_of_run(p_run uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT gi.season_id FROM runs r JOIN game_instances gi ON gi.id = r.game_instance_id WHERE r.id = p_run
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION season_of_order(p_order uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT season_of_run(o.run_id) FROM orders o WHERE o.id = p_order $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION season_of_position(p_position uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT p.season_id FROM positions p WHERE p.id = p_position $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION season_of_question(p_question uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT q.season_id FROM forecast_questions q WHERE q.id = p_question $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION season_of_note(p_note uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT n.season_id FROM research_notes n WHERE n.id = p_note $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION season_of_event(p_event uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT e.season_id FROM events e WHERE e.id = p_event $$;
--> statement-breakpoint

-- Owner lookups for row-scoping policies.
CREATE OR REPLACE FUNCTION owner_of_run(p_run uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT r.user_id FROM runs r WHERE r.id = p_run $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION owner_of_order(p_order uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT owner_of_run(o.run_id) FROM orders o WHERE o.id = p_order $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION owner_of_position(p_position uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT p.user_id FROM positions p WHERE p.id = p_position $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION owner_of_note(p_note uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT n.author_id FROM research_notes n WHERE n.id = p_note $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION question_is_resolved(p_question uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT q.resolved_at IS NOT NULL FROM forecast_questions q WHERE q.id = p_question $$;
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 3. Append-only triggers (H7, H8, H9, H31, H6)
--    Fire for every role, including postgres, so even a maintenance session
--    cannot mutate these tables by accident.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wows_reject_mutation() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'table % is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END
$$;
--> statement-breakpoint
CREATE TRIGGER price_bars_append_only BEFORE UPDATE OR DELETE ON price_bars
  FOR EACH ROW EXECUTE FUNCTION wows_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER price_bars_no_truncate BEFORE TRUNCATE ON price_bars
  FOR EACH STATEMENT EXECUTE FUNCTION wows_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER orders_append_only BEFORE UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION wows_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER orders_no_truncate BEFORE TRUNCATE ON orders
  FOR EACH STATEMENT EXECUTE FUNCTION wows_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER fills_append_only BEFORE UPDATE OR DELETE ON fills
  FOR EACH ROW EXECUTE FUNCTION wows_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER fills_no_truncate BEFORE TRUNCATE ON fills
  FOR EACH STATEMENT EXECUTE FUNCTION wows_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION wows_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION wows_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER theses_append_only BEFORE UPDATE OR DELETE ON theses
  FOR EACH ROW EXECUTE FUNCTION wows_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER theses_no_truncate BEFORE TRUNCATE ON theses
  FOR EACH STATEMENT EXECUTE FUNCTION wows_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER scenarios_no_update BEFORE UPDATE ON scenarios
  FOR EACH ROW EXECUTE FUNCTION wows_reject_mutation();
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 4. Forecast window (H10, H20): server time decides, and revisions are counted.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wows_forecast_guard() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_closes_at timestamptz;
  v_question uuid := COALESCE(NEW.question_id, OLD.question_id);
BEGIN
  SELECT closes_at INTO v_closes_at FROM forecast_questions WHERE id = v_question;
  IF v_closes_at IS NULL THEN
    RAISE EXCEPTION 'forecast question % does not exist', v_question;
  END IF;
  IF now() >= v_closes_at THEN
    RAISE EXCEPTION 'forecast question % closed at % (server time %)', v_question, v_closes_at, now()
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.question_id <> OLD.question_id OR NEW.user_id <> OLD.user_id THEN
      RAISE EXCEPTION 'a forecast cannot be moved to another question or user'
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.revised_count := OLD.revised_count + 1;
    NEW.submitted_at := OLD.submitted_at;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  NEW.revised_count := 0;
  NEW.submitted_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER forecasts_window BEFORE INSERT OR UPDATE OR DELETE ON forecasts
  FOR EACH ROW EXECUTE FUNCTION wows_forecast_guard();
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 5. Season state machine: draft → open → closed → settled → archived
--    Once settled, the only permitted change is state → archived.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wows_season_transition() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.state IN ('settled', 'archived') THEN
    IF NEW.state = OLD.state AND ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
      RAISE EXCEPTION 'season % is % and cannot be modified', OLD.id, OLD.state
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.state <> OLD.state AND (NEW.name, NEW.starts_at, NEW.ends_at) IS DISTINCT FROM (OLD.name, OLD.starts_at, OLD.ends_at) THEN
      RAISE EXCEPTION 'season % is %: only the state may change', OLD.id, OLD.state
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF NEW.state = OLD.state THEN
    RETURN NEW;
  END IF;
  IF NOT (
       (OLD.state = 'draft'   AND NEW.state = 'open')
    OR (OLD.state = 'open'    AND NEW.state = 'closed')
    OR (OLD.state = 'closed'  AND NEW.state = 'settled')
    OR (OLD.state = 'settled' AND NEW.state = 'archived')
  ) THEN
    RAISE EXCEPTION 'invalid season transition % → %', OLD.state, NEW.state
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER seasons_transition BEFORE UPDATE ON seasons
  FOR EACH ROW EXECUTE FUNCTION wows_season_transition();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION wows_season_no_delete() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.state <> 'draft' THEN
    RAISE EXCEPTION 'only draft seasons can be deleted' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END
$$;
--> statement-breakpoint
CREATE TRIGGER seasons_delete_guard BEFORE DELETE ON seasons
  FOR EACH ROW EXECUTE FUNCTION wows_season_no_delete();
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 6. Settled-season guard (H5): season-scoped rows are frozen once the season
--    is settled or archived. INSERT is blocked too: a settled season is final.
--    Corrections after settlement need an append-only adjustments table, which
--    a later phase adds if the club ever needs one.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wows_guard_settled_season() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_season uuid;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'memberships', 'game_instances', 'positions', 'forecast_questions',
         'research_notes', 'events', 'scores' THEN
      v_season := COALESCE(
        CASE WHEN TG_OP <> 'DELETE' THEN NEW.season_id END,
        CASE WHEN TG_OP <> 'INSERT' THEN OLD.season_id END);
    WHEN 'runs' THEN
      SELECT gi.season_id INTO v_season FROM game_instances gi
        WHERE gi.id = COALESCE(
          CASE WHEN TG_OP <> 'DELETE' THEN NEW.game_instance_id END,
          CASE WHEN TG_OP <> 'INSERT' THEN OLD.game_instance_id END);
    WHEN 'orders', 'holdings_cache' THEN
      v_season := season_of_run(COALESCE(
        CASE WHEN TG_OP <> 'DELETE' THEN NEW.run_id END,
        CASE WHEN TG_OP <> 'INSERT' THEN OLD.run_id END));
    WHEN 'fills' THEN
      v_season := season_of_order(COALESCE(
        CASE WHEN TG_OP <> 'DELETE' THEN NEW.order_id END,
        CASE WHEN TG_OP <> 'INSERT' THEN OLD.order_id END));
    WHEN 'theses' THEN
      v_season := season_of_position(COALESCE(
        CASE WHEN TG_OP <> 'DELETE' THEN NEW.position_id END,
        CASE WHEN TG_OP <> 'INSERT' THEN OLD.position_id END));
    WHEN 'forecasts' THEN
      v_season := season_of_question(COALESCE(
        CASE WHEN TG_OP <> 'DELETE' THEN NEW.question_id END,
        CASE WHEN TG_OP <> 'INSERT' THEN OLD.question_id END));
    WHEN 'reviews' THEN
      v_season := season_of_note(COALESCE(
        CASE WHEN TG_OP <> 'DELETE' THEN NEW.note_id END,
        CASE WHEN TG_OP <> 'INSERT' THEN OLD.note_id END));
    WHEN 'rsvps', 'attendance' THEN
      v_season := season_of_event(COALESCE(
        CASE WHEN TG_OP <> 'DELETE' THEN NEW.event_id END,
        CASE WHEN TG_OP <> 'INSERT' THEN OLD.event_id END));
    ELSE
      RAISE EXCEPTION 'wows_guard_settled_season is not configured for %', TG_TABLE_NAME;
  END CASE;

  IF v_season IS NOT NULL AND season_is_settled(v_season) THEN
    RAISE EXCEPTION 'season % is settled: % on % is not allowed', v_season, TG_OP, TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'memberships', 'game_instances', 'runs', 'orders', 'fills', 'holdings_cache',
    'positions', 'theses', 'forecast_questions', 'forecasts', 'scores',
    'research_notes', 'reviews', 'events', 'rsvps', 'attendance'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION wows_guard_settled_season()',
      t || '_settled_guard', t);
  END LOOP;
END
$$;
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 7. updated_at maintenance
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wows_set_updated_at() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER research_notes_updated_at BEFORE UPDATE ON research_notes
  FOR EACH ROW EXECUTE FUNCTION wows_set_updated_at();
--> statement-breakpoint
CREATE TRIGGER modules_updated_at BEFORE UPDATE ON modules
  FOR EACH ROW EXECUTE FUNCTION wows_set_updated_at();
--> statement-breakpoint
CREATE TRIGGER rsvps_updated_at BEFORE UPDATE ON rsvps
  FOR EACH ROW EXECUTE FUNCTION wows_set_updated_at();
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 8. Row-level security policies (H2, H4). All policies are TO wows_app.
--    RLS is already enabled on every table by migration 0000.
--    Reading: own rows, staff (core + faculty) read everything, and
--    club-wide reference data is readable by any participant.
--    Writing: own rows for members of the season; core for admin tables;
--    faculty never write.
-- -----------------------------------------------------------------------------

-- users
CREATE POLICY users_select ON users FOR SELECT TO wows_app
  USING (id = app_user_id() OR app_is_participant());
--> statement-breakpoint
CREATE POLICY users_update_self ON users FOR UPDATE TO wows_app
  USING (id = app_user_id()) WITH CHECK (id = app_user_id());
--> statement-breakpoint
CREATE POLICY users_admin ON users FOR ALL TO wows_app
  USING (app_is_core()) WITH CHECK (app_is_core());
--> statement-breakpoint

-- user_roles
CREATE POLICY user_roles_select ON user_roles FOR SELECT TO wows_app
  USING (user_id = app_user_id() OR app_is_staff()
         OR (role IN ('member', 'lead') AND app_is_participant()));
--> statement-breakpoint
CREATE POLICY user_roles_admin ON user_roles FOR ALL TO wows_app
  USING (app_is_core()) WITH CHECK (app_is_core());
--> statement-breakpoint

-- seasons, verticals, instruments, scenarios, game_instances, tracks
CREATE POLICY seasons_select ON seasons FOR SELECT TO wows_app USING (app_is_participant());
--> statement-breakpoint
CREATE POLICY seasons_admin ON seasons FOR ALL TO wows_app USING (app_is_core()) WITH CHECK (app_is_core());
--> statement-breakpoint
CREATE POLICY verticals_select ON verticals FOR SELECT TO wows_app USING (app_is_participant());
--> statement-breakpoint
CREATE POLICY verticals_admin ON verticals FOR ALL TO wows_app USING (app_is_core()) WITH CHECK (app_is_core());
--> statement-breakpoint
CREATE POLICY instruments_select ON instruments FOR SELECT TO wows_app USING (app_is_participant());
--> statement-breakpoint
CREATE POLICY instruments_admin ON instruments FOR ALL TO wows_app USING (app_is_core()) WITH CHECK (app_is_core());
--> statement-breakpoint
CREATE POLICY price_bars_select ON price_bars FOR SELECT TO wows_app USING (app_is_participant());
--> statement-breakpoint
CREATE POLICY price_bars_insert ON price_bars FOR INSERT TO wows_app WITH CHECK (app_is_core());
--> statement-breakpoint
CREATE POLICY scenarios_select ON scenarios FOR SELECT TO wows_app USING (app_is_participant());
--> statement-breakpoint
CREATE POLICY scenarios_insert ON scenarios FOR INSERT TO wows_app WITH CHECK (app_is_core());
--> statement-breakpoint
CREATE POLICY scenarios_delete ON scenarios FOR DELETE TO wows_app USING (app_is_core());
--> statement-breakpoint
CREATE POLICY game_instances_select ON game_instances FOR SELECT TO wows_app USING (app_is_participant());
--> statement-breakpoint
CREATE POLICY game_instances_admin ON game_instances FOR ALL TO wows_app
  USING (app_is_core() OR app_is_lead(season_id)) WITH CHECK (app_is_core() OR app_is_lead(season_id));
--> statement-breakpoint
CREATE POLICY tracks_select ON tracks FOR SELECT TO wows_app USING (app_is_participant());
--> statement-breakpoint
CREATE POLICY tracks_admin ON tracks FOR ALL TO wows_app USING (app_is_core()) WITH CHECK (app_is_core());
--> statement-breakpoint

-- memberships
CREATE POLICY memberships_select ON memberships FOR SELECT TO wows_app
  USING (user_id = app_user_id() OR app_is_participant());
--> statement-breakpoint
CREATE POLICY memberships_admin ON memberships FOR ALL TO wows_app
  USING (app_is_core()) WITH CHECK (app_is_core());
--> statement-breakpoint

-- applications
CREATE POLICY applications_select ON applications FOR SELECT TO wows_app
  USING (user_id = app_user_id() OR app_is_staff());
--> statement-breakpoint
CREATE POLICY applications_insert_own ON applications FOR INSERT TO wows_app
  WITH CHECK (user_id = app_user_id());
--> statement-breakpoint
CREATE POLICY applications_decide ON applications FOR UPDATE TO wows_app
  USING (app_is_core()) WITH CHECK (app_is_core());
--> statement-breakpoint

-- runs / orders / fills / holdings_cache: owner via run, staff read all
CREATE POLICY runs_select ON runs FOR SELECT TO wows_app
  USING (user_id = app_user_id() OR app_is_staff());
--> statement-breakpoint
CREATE POLICY runs_insert_own ON runs FOR INSERT TO wows_app
  WITH CHECK (user_id = app_user_id()
              AND app_can_play((SELECT gi.season_id FROM game_instances gi WHERE gi.id = game_instance_id)));
--> statement-breakpoint
CREATE POLICY runs_update_own ON runs FOR UPDATE TO wows_app
  USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
--> statement-breakpoint
CREATE POLICY orders_select ON orders FOR SELECT TO wows_app
  USING (owner_of_run(run_id) = app_user_id() OR app_is_staff());
--> statement-breakpoint
CREATE POLICY orders_insert_own ON orders FOR INSERT TO wows_app
  WITH CHECK (owner_of_run(run_id) = app_user_id());
--> statement-breakpoint
CREATE POLICY fills_select ON fills FOR SELECT TO wows_app
  USING (owner_of_order(order_id) = app_user_id() OR app_is_staff());
--> statement-breakpoint
CREATE POLICY fills_insert_own ON fills FOR INSERT TO wows_app
  WITH CHECK (owner_of_order(order_id) = app_user_id());
--> statement-breakpoint
CREATE POLICY holdings_cache_select ON holdings_cache FOR SELECT TO wows_app
  USING (owner_of_run(run_id) = app_user_id() OR app_is_staff());
--> statement-breakpoint
CREATE POLICY holdings_cache_write_own ON holdings_cache FOR ALL TO wows_app
  USING (owner_of_run(run_id) = app_user_id()) WITH CHECK (owner_of_run(run_id) = app_user_id());
--> statement-breakpoint

-- positions / theses: own; others only after the season settles (H4)
CREATE POLICY positions_select ON positions FOR SELECT TO wows_app
  USING (user_id = app_user_id() OR app_is_staff()
         OR (app_is_participant() AND season_is_settled(season_id)));
--> statement-breakpoint
CREATE POLICY positions_insert_own ON positions FOR INSERT TO wows_app
  WITH CHECK (user_id = app_user_id() AND app_can_play(season_id));
--> statement-breakpoint
CREATE POLICY positions_update_own ON positions FOR UPDATE TO wows_app
  USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
--> statement-breakpoint
CREATE POLICY theses_select ON theses FOR SELECT TO wows_app
  USING (owner_of_position(position_id) = app_user_id() OR app_is_staff()
         OR (app_is_participant() AND season_is_settled(season_of_position(position_id))));
--> statement-breakpoint
CREATE POLICY theses_insert_own ON theses FOR INSERT TO wows_app
  WITH CHECK (owner_of_position(position_id) = app_user_id());
--> statement-breakpoint

-- forecast_questions / forecasts: others' forecasts only once resolved
CREATE POLICY forecast_questions_select ON forecast_questions FOR SELECT TO wows_app
  USING (app_is_participant());
--> statement-breakpoint
CREATE POLICY forecast_questions_admin ON forecast_questions FOR ALL TO wows_app
  USING (app_is_core() OR app_is_lead(season_id)) WITH CHECK (app_is_core() OR app_is_lead(season_id));
--> statement-breakpoint
CREATE POLICY forecasts_select ON forecasts FOR SELECT TO wows_app
  USING (user_id = app_user_id() OR app_is_staff()
         OR (app_is_participant() AND question_is_resolved(question_id)));
--> statement-breakpoint
CREATE POLICY forecasts_insert_own ON forecasts FOR INSERT TO wows_app
  WITH CHECK (user_id = app_user_id() AND app_can_play(season_of_question(question_id)));
--> statement-breakpoint
CREATE POLICY forecasts_update_own ON forecasts FOR UPDATE TO wows_app
  USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
--> statement-breakpoint
CREATE POLICY forecasts_delete_own ON forecasts FOR DELETE TO wows_app
  USING (user_id = app_user_id());
--> statement-breakpoint

-- scores: readable club-wide; written server-side (core path until Phase 7)
CREATE POLICY scores_select ON scores FOR SELECT TO wows_app USING (app_is_participant());
--> statement-breakpoint
CREATE POLICY scores_admin ON scores FOR ALL TO wows_app USING (app_is_core()) WITH CHECK (app_is_core());
--> statement-breakpoint

-- research_notes / reviews: drafts are private to the author (H2)
CREATE POLICY research_notes_select ON research_notes FOR SELECT TO wows_app
  USING (author_id = app_user_id() OR app_is_staff()
         OR (app_is_participant() AND state = 'published'));
--> statement-breakpoint
CREATE POLICY research_notes_insert_own ON research_notes FOR INSERT TO wows_app
  WITH CHECK (author_id = app_user_id() AND app_can_play(season_id));
--> statement-breakpoint
CREATE POLICY research_notes_update_own ON research_notes FOR UPDATE TO wows_app
  USING (author_id = app_user_id()) WITH CHECK (author_id = app_user_id());
--> statement-breakpoint
CREATE POLICY research_notes_delete_own_draft ON research_notes FOR DELETE TO wows_app
  USING (author_id = app_user_id() AND state = 'draft');
--> statement-breakpoint
CREATE POLICY research_notes_admin ON research_notes FOR UPDATE TO wows_app
  USING (app_is_core()) WITH CHECK (app_is_core());
--> statement-breakpoint
CREATE POLICY reviews_select ON reviews FOR SELECT TO wows_app
  USING (reviewer_id = app_user_id() OR app_is_staff() OR owner_of_note(note_id) = app_user_id());
--> statement-breakpoint
CREATE POLICY reviews_insert ON reviews FOR INSERT TO wows_app
  WITH CHECK (reviewer_id = app_user_id() AND (app_is_core() OR app_is_lead_anywhere()));
--> statement-breakpoint

-- modules / progress
CREATE POLICY modules_select ON modules FOR SELECT TO wows_app
  USING (app_is_staff() OR (app_is_participant() AND state = 'published'));
--> statement-breakpoint
CREATE POLICY modules_admin ON modules FOR ALL TO wows_app USING (app_is_core()) WITH CHECK (app_is_core());
--> statement-breakpoint
CREATE POLICY progress_select ON progress FOR SELECT TO wows_app
  USING (user_id = app_user_id() OR app_is_staff());
--> statement-breakpoint
CREATE POLICY progress_write_own ON progress FOR ALL TO wows_app
  USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id() AND app_is_participant());
--> statement-breakpoint

-- events / rsvps / attendance
CREATE POLICY events_select ON events FOR SELECT TO wows_app USING (app_is_participant());
--> statement-breakpoint
CREATE POLICY events_admin ON events FOR ALL TO wows_app
  USING (app_is_core() OR app_is_lead(season_id)) WITH CHECK (app_is_core() OR app_is_lead(season_id));
--> statement-breakpoint
CREATE POLICY rsvps_select ON rsvps FOR SELECT TO wows_app
  USING (user_id = app_user_id() OR app_is_staff() OR app_is_lead(season_of_event(event_id)));
--> statement-breakpoint
CREATE POLICY rsvps_write_own ON rsvps FOR ALL TO wows_app
  USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id() AND app_is_participant());
--> statement-breakpoint
CREATE POLICY attendance_select ON attendance FOR SELECT TO wows_app
  USING (user_id = app_user_id() OR app_is_staff() OR app_is_lead(season_of_event(event_id)));
--> statement-breakpoint
CREATE POLICY attendance_mark ON attendance FOR INSERT TO wows_app
  WITH CHECK (marked_by = app_user_id() AND (app_is_core() OR app_is_lead(season_of_event(event_id))));
--> statement-breakpoint

-- audit_log: staff read; any acting user may append their own entry
CREATE POLICY audit_log_select ON audit_log FOR SELECT TO wows_app USING (app_is_staff());
--> statement-breakpoint
CREATE POLICY audit_log_insert ON audit_log FOR INSERT TO wows_app
  WITH CHECK (actor_id = app_user_id());
