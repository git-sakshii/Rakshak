SELECT
  id,
  summary,
  details,
  severity,
  aliases,
  published,
  modified
FROM osv.query_by_version
WHERE package_name = '{package_name}'
  AND ecosystem = '{ecosystem}'
  AND version = '{version}'
