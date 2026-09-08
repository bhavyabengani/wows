-- =============================================================================
-- 0002  Auth support functions
-- =============================================================================
-- Two SECURITY DEFINER functions so the app can register and look up users
-- without ever bypassing RLS from application code.

-- Called once per sign-in. Creates the users row on first sign-in, grants
-- `applicant` if the user has no roles at all, and writes the audit entry.
-- The allowed email domain is enforced here, in the database, so a caller
-- that reaches Supabase Auth directly still cannot become a portal user.
CREATE OR REPLACE FUNCTION app_register_user(
  p_auth_identity uuid,
  p_email text,
  p_display_name text
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_id uuid;
  v_created boolean := false;
BEGIN
  IF split_part(v_email, '@', 2) <> 'ashoka.edu.in' THEN
    RAISE EXCEPTION 'email domain not allowed: %', split_part(v_email, '@', 2)
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id INTO v_id FROM users WHERE auth_identity = p_auth_identity;
  IF v_id IS NULL THEN
    INSERT INTO users (auth_identity, email, display_name)
      VALUES (p_auth_identity, v_email, COALESCE(nullif(trim(p_display_name), ''), split_part(v_email, '@', 1)))
      RETURNING id INTO v_id;
    v_created := true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_id) THEN
    INSERT INTO user_roles (user_id, role, season_id) VALUES (v_id, 'applicant', NULL);
  END IF;

  IF v_created THEN
    INSERT INTO audit_log (actor_id, action, entity_type, entity_id, after_json)
      VALUES (v_id, 'user.registered', 'users', v_id::text,
              jsonb_build_object('email', v_email, 'auth_identity', p_auth_identity));
  END IF;

  RETURN v_id;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_register_user(uuid, text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_register_user(uuid, text, text) TO wows_app;
--> statement-breakpoint

-- Resolves a Supabase Auth identity to the portal user id. Needed before
-- `app.user_id` can be set for the request.
CREATE OR REPLACE FUNCTION app_lookup_user(p_auth_identity uuid)
  RETURNS TABLE (id uuid, email text, display_name text, cohort_year integer)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT u.id, u.email, u.display_name, u.cohort_year
  FROM users u WHERE u.auth_identity = p_auth_identity
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_lookup_user(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_lookup_user(uuid) TO wows_app;
