-- Drop unique index to allow multiple runners to share the same configPath
DROP INDEX IF EXISTS "RunnerConfig_configPath_key";
