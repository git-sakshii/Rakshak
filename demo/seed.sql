-- Seed Settings
INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES 
('github_username', 'demo_coder', CURRENT_TIMESTAMP),
('github_token', 'ghp_mocktoken123456789abcdefghij', CURRENT_TIMESTAMP),
('telegram_token', '543216789:ABCdefGhIJKlmNoPQRsTUVwxyZ', CURRENT_TIMESTAMP),
('telegram_chat_id', '987654321', CURRENT_TIMESTAMP),
('gemini_key', 'AIzaSyMockGeminiKey123456789', CURRENT_TIMESTAMP),
('auto_scan_interval_hours', '24', CURRENT_TIMESTAMP),
('setup_complete', 'true', CURRENT_TIMESTAMP),
('last_scan_at', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rakshak_demo_fallback', '1', CURRENT_TIMESTAMP);

-- Seed Repositories
INSERT OR REPLACE INTO repositories (id, name, language, stars, open_issues, pushed_at, is_fork, has_npm, has_pypi, has_cargo, last_scanned) VALUES 
(1, 'coral-fork', 'Rust', 142, 5, CURRENT_TIMESTAMP, 0, 0, 0, 1, CURRENT_TIMESTAMP),
(2, 'cool-react-frontend', 'JavaScript', 35, 2, CURRENT_TIMESTAMP, 0, 1, 0, 0, CURRENT_TIMESTAMP),
(3, 'fastapi-backend-api', 'Python', 88, 0, CURRENT_TIMESTAMP, 0, 0, 1, 0, CURRENT_TIMESTAMP);

-- Seed Dependencies
INSERT OR REPLACE INTO dependencies (id, repo, ecosystem, package, version, scanned_at) VALUES 
(1, 'cool-react-frontend', 'npm', 'jsonwebtoken', '8.5.1', CURRENT_TIMESTAMP),
(2, 'cool-react-frontend', 'npm', 'lodash', '4.17.15', CURRENT_TIMESTAMP),
(3, 'cool-react-frontend', 'npm', 'react', '18.2.0', CURRENT_TIMESTAMP),
(4, 'fastapi-backend-api', 'pypi', 'requests', '2.25.1', CURRENT_TIMESTAMP),
(5, 'fastapi-backend-api', 'pypi', 'fastapi', '0.95.0', CURRENT_TIMESTAMP),
(6, 'coral-fork', 'crates_io', 'tokio', '1.30.0', CURRENT_TIMESTAMP),
(7, 'coral-fork', 'crates_io', 'serde', '1.0.150', CURRENT_TIMESTAMP);

-- Seed Risk Snapshots
INSERT OR REPLACE INTO risk_snapshots (id, repo, package, ecosystem, your_version, latest_version, version_delta, risk_score, pkg_stale_days, status, snapshotted_at) VALUES 
(1, 'cool-react-frontend', 'jsonwebtoken', 'npm', '8.5.1', '9.0.0', 1, 180.0, 420, 'Critical', CURRENT_TIMESTAMP),
(2, 'cool-react-frontend', 'lodash', 'npm', '4.17.15', '4.17.21', 0, 115.0, 950, 'Warning', CURRENT_TIMESTAMP),
(3, 'cool-react-frontend', 'react', 'npm', '18.2.0', '18.3.1', 0, 22.0, 150, 'Healthy', CURRENT_TIMESTAMP),
(4, 'fastapi-backend-api', 'requests', 'pypi', '2.25.1', '2.31.0', 0, 45.0, 680, 'Healthy', CURRENT_TIMESTAMP),
(5, 'fastapi-backend-api', 'fastapi', 'pypi', '0.95.0', '0.110.0', 0, 35.0, 280, 'Healthy', CURRENT_TIMESTAMP),
(6, 'coral-fork', 'tokio', 'crates_io', '1.30.0', '1.38.0', 0, 40.0, 310, 'Healthy', CURRENT_TIMESTAMP),
(7, 'coral-fork', 'serde', 'crates_io', '1.0.150', '1.0.204', 0, 85.0, 750, 'Warning', CURRENT_TIMESTAMP);

-- Seed Security Alerts
INSERT OR REPLACE INTO security_alerts (id, hn_id, hn_title, hn_url, points, num_comments, package, ecosystem, repo, severity, dismissed, sent_to_telegram, found_at) VALUES 
(1, 'GHSA-hj5v-5v8p-qcr6', 'jsonwebtoken signature verification bypass vulnerability', 'https://github.com/auth0/node-jsonwebtoken/security/advisories/GHSA-hj5v-5v8p-qcr6', 152, 45, 'jsonwebtoken', 'npm', 'cool-react-frontend', 'critical', 0, 0, CURRENT_TIMESTAMP),
(2, 'GHSA-35jh-p3h4-6532', 'Prototype pollution in lodash via zipObjectDeep', 'https://github.com/lodash/lodash/security/advisories/GHSA-35jh-p3h4-6532', 88, 12, 'lodash', 'npm', 'cool-react-frontend', 'high', 0, 0, CURRENT_TIMESTAMP),
(3, 'HN-12345', 'Show HN: Rakshak — personal dependency health agent', 'https://news.ycombinator.com/item?id=mock', 42, 5, 'react', 'npm', 'cool-react-frontend', 'medium', 0, 0, CURRENT_TIMESTAMP);

-- Seed Migration Guides
INSERT OR REPLACE INTO migration_guides (id, title, url, package, ecosystem, reactions, reading_time_min, sent_to_telegram, cached_at) VALUES 
(1, 'Migrating from jsonwebtoken v8 to v9 safely', 'https://dev.to/auth0/migrating-jsonwebtoken-v8-to-v9', 'jsonwebtoken', 'npm', 89, 5, 0, CURRENT_TIMESTAMP),
(2, 'How to secure your Node.js apps from prototype pollution', 'https://dev.to/security/prototype-pollution-prevention', 'lodash', 'npm', 124, 8, 0, CURRENT_TIMESTAMP),
(3, 'FastAPI version 0.95 to 0.110 upgrade instructions', 'https://dev.to/fastapi/upgrade-guide-095-0110', 'fastapi', 'pypi', 45, 6, 0, CURRENT_TIMESTAMP);

-- Seed Scan History
INSERT OR REPLACE INTO scan_history (id, repos_scanned, deps_found, new_deps, removed_deps, new_alerts, duration_sec, triggered_by, scanned_at) VALUES 
(1, 3, 7, 7, 0, 3, 2.45, 'manual', CURRENT_TIMESTAMP);
