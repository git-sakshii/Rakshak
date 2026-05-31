# Coral Sources Verification

This document records the verified capabilities, tables, columns, and constraints of Coral's query engine and sources as of May 28, 2026. This verification is crucial for ensuring the SQL queries executed by Rakshak do not fail at runtime.

## Core SQL Engine
- **Engine**: Apache DataFusion 53.
- **Dialect**: Standard ANSI SQL with DataFusion features. DuckDB-specific functions like `date_diff('day', ...)` or custom type casting via `::DATE` must be verified or replaced with DataFusion-compatible equivalents (e.g., standard interval calculations or date functions).
- **SQLite Local Source**: **NOT supported**. Coral has no SQLite backend. Rakshak uses a fallback pattern where local package data is queried from SQLite first, and then the lists are injected into Coral queries.

## Source Verification

### 1. `deps_dev` (Community Source)
- **Status**: Verified and fully functional.
- **Why**: Replaces the missing `npm` and empty `pypi` sources.
- **Tables & Schema**:
  - `packages`: Requires `system` and `package_name`. Returns `versions`.
  - `versions`: Requires `system`, `package_name`, and `version`.
    - Columns: `package_name`, `version`, `published_at`, `is_default`, `is_deprecated`, `licenses`, `advisory_keys`, `links`.
  - `advisories`: Requires `advisory_id`.
  - `projects`: Contains OpenSSF Scorecard data.

### 2. `osv` (Community Source)
- **Status**: Verified and fully functional.
- **Table**: `query_by_version`
  - Required Filters: `package_name`, `ecosystem`, `version`.
  - Columns: `id`, `summary`, `details`, `severity`, `aliases`, `published`, `modified`.
- **Ecosystem values**: `'npm'`, `'PyPI'`, `'crates.io'`.

### 3. `crates_io` (Community Source)
- **Status**: Verified.
- **Table**: `crates` (Note: not `crate`).
  - Required Filter: `q` (search query).
  - Columns: `name`, `description`, `newest_version`, `max_version`, `downloads`, `recent_downloads`, `updated_at`, `created_at`, `repository`, `homepage`.

### 4. `hn` (Community Source)
- **Status**: Verified.
- **Table**: `search`
  - Required Filters: `query`, `tags`, `numeric_filters` (as parameters).
  - Columns: `title`, `url`, `points`, `num_comments`, `created_at`.

### 5. `devto` (Community Source)
- **Status**: Verified.
- **Table**: `articles`
  - Required Filter: `tag`.
  - Columns: `title`, `url`, `tags` (Note: not `tag_list`), `reading_time_minutes`, `public_reactions_count`, `published_at`.
