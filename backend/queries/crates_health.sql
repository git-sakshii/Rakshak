SELECT
  name,
  description,
  newest_version,
  max_version,
  downloads,
  recent_downloads,
  updated_at,
  created_at,
  repository,
  homepage
FROM crates_io.crates
WHERE q = '{package_name}'
LIMIT 1
