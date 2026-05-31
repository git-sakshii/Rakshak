SELECT
  title,
  url,
  points,
  num_comments,
  created_at
FROM hn.search
WHERE query = '{query} vulnerability OR security OR CVE'
  AND tags = 'story'
  AND numeric_filters = 'points>10'
ORDER BY points DESC
LIMIT 10
