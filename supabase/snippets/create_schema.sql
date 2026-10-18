DO $$
DECLARE
  schema_name text;
BEGIN
  FOREACH schema_name IN ARRAY ARRAY[
    'test',
    'core',
    'budgeting'
  ]
  LOOP
    -- 1. Create schema if it does not exist
    EXECUTE format(
      'CREATE SCHEMA IF NOT EXISTS %I',
      schema_name
    );

    -- 2. Ensure postgres owns the schema
    EXECUTE format(
      'ALTER SCHEMA %I OWNER TO postgres',
      schema_name
    );

    -- 3. Reset schema privileges
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON SCHEMA %I FROM PUBLIC',
      schema_name
    );

    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON SCHEMA %I FROM anon, authenticated, service_role, authenticator',
      schema_name
    );

    -- 4. Reset privileges on existing tables and views
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I FROM PUBLIC, anon, authenticated, service_role',
      schema_name
    );

    -- 5. Reset privileges on existing sequences
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I FROM PUBLIC, anon, authenticated, service_role',
      schema_name
    );

    -- 6. Reset privileges on existing functions and procedures
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA %I FROM PUBLIC, anon, authenticated, service_role',
      schema_name
    );

    -- 7. Reset default privileges for future objects created by postgres
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated, service_role',
      schema_name
    );

    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role',
      schema_name
    );

    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I REVOKE ALL PRIVILEGES ON ROUTINES FROM PUBLIC, anon, authenticated, service_role',
      schema_name
    );

    -- 8. Grant schema usage to API roles and authenticator
    EXECUTE format(
      'GRANT USAGE ON SCHEMA %I TO authenticated, service_role, authenticator',
      schema_name
    );

    -- 9. Grant privileges on existing objects
    EXECUTE format(
      'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I TO authenticated, service_role',
      schema_name
    );

    EXECUTE format(
      'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I TO authenticated, service_role',
      schema_name
    );

    EXECUTE format(
      'GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA %I TO authenticated, service_role',
      schema_name
    );

    -- 10. Set default privileges for future objects created by postgres
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I GRANT ALL PRIVILEGES ON TABLES TO authenticated, service_role',
      schema_name
    );

    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I GRANT ALL PRIVILEGES ON SEQUENCES TO authenticated, service_role',
      schema_name
    );

    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I GRANT ALL PRIVILEGES ON ROUTINES TO authenticated, service_role',
      schema_name
    );

  END LOOP;
END $$;