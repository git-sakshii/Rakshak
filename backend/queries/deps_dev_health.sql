SELECT
  package_name,
  version,
  published_at,
  is_default,
  is_deprecated,
  licenses,
  advisory_keys,
  links
FROM deps_dev.versions
WHERE system = '{system}'
  AND package_name = '{package_name}'
  AND version = '{version}'
LIMIT 1
