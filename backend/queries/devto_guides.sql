SELECT
  title,
  url,
  tags,
  reading_time_minutes,
  public_reactions_count,
  published_at
FROM devto.articles
WHERE tag = '{tag}'
LIMIT 10
