import os
import subprocess
import json
import time
import re
from sqlalchemy.orm import Session
from .database import get_db
from .models import QueryLog

# Fallback seed data in case Coral queries are unavailable or RAKSHAK_DEMO_FALLBACK is enabled
MOCK_DATA = {
    "deps_dev_health": [
        {
            "package_name": "jsonwebtoken",
            "version": "9.0.0",
            "published_at": "2023-01-15T08:00:00Z",
            "is_default": True,
            "is_deprecated": False,
            "licenses": ["MIT"],
            "advisory_keys": ["GHSA-hj5v-5v8p-qcr6"],
            "links": {"homepage": "https://github.com/auth0/node-jsonwebtoken"}
        },
        {
            "package_name": "lodash",
            "version": "4.17.21",
            "published_at": "2021-02-20T12:00:00Z",
            "is_default": True,
            "is_deprecated": False,
            "licenses": ["MIT"],
            "advisory_keys": ["GHSA-35jh-p3h4-6532"],
            "links": {"homepage": "https://lodash.com/"}
        },
        {
            "package_name": "requests",
            "version": "2.31.0",
            "published_at": "2023-05-22T10:00:00Z",
            "is_default": True,
            "is_deprecated": False,
            "licenses": ["Apache-2.0"],
            "advisory_keys": [],
            "links": {"homepage": "https://requests.readthedocs.io"}
        },
        {
            "package_name": "serde",
            "version": "1.0.200",
            "published_at": "2024-01-10T14:30:00Z",
            "is_default": True,
            "is_deprecated": False,
            "licenses": ["MIT", "Apache-2.0"],
            "advisory_keys": [],
            "links": {"homepage": "https://serde.rs"}
        }
    ],
    "osv_vulns": [
        {
            "id": "GHSA-hj5v-5v8p-qcr6",
            "summary": "jsonwebtoken signature verification bypass",
            "details": "jsonwebtoken before 9.0.0 allows signature verification bypass if the key is a public key and the algorithm is set to HS256.",
            "severity": "CRITICAL",
            "aliases": ["CVE-2022-23529"],
            "published": "2022-12-22T19:00:00Z",
            "modified": "2023-01-10T10:00:00Z"
        },
        {
            "id": "GHSA-35jh-p3h4-6532",
            "summary": "Prototype pollution in lodash",
            "details": "lodash before 4.17.21 is vulnerable to prototype pollution via zipObjectDeep.",
            "severity": "HIGH",
            "aliases": ["CVE-2020-8203"],
            "published": "2020-06-15T10:00:00Z",
            "modified": "2021-02-22T12:00:00Z"
        }
    ],
    "hn_security": [
        {
            "title": "jsonwebtoken vulnerability lets attackers bypass signature verification",
            "url": "https://github.com/auth0/node-jsonwebtoken/security/advisories/GHSA-hj5v-5v8p-qcr6",
            "points": 142,
            "num_comments": 48,
            "created_at": "2023-01-05T14:00:00Z"
        },
        {
            "title": "Ask HN: How do you track dependency security alerts in your CI?",
            "url": None,
            "points": 35,
            "num_comments": 12,
            "created_at": "2024-03-12T09:30:00Z"
        }
    ],
    "devto_guides": [
        {
            "title": "Migrating from jsonwebtoken v8 to v9 safely",
            "url": "https://dev.to/auth0/migrating-jsonwebtoken-v8-to-v9",
            "tags": "javascript,security,node",
            "reading_time_minutes": 5,
            "public_reactions_count": 89,
            "published_at": "2023-01-20T10:00:00Z"
        },
        {
            "title": "How to secure your Node.js apps from prototype pollution",
            "url": "https://dev.to/security/prototype-pollution-prevention",
            "tags": "node,security,javascript",
            "reading_time_minutes": 8,
            "public_reactions_count": 124,
            "published_at": "2022-11-15T08:00:00Z"
        }
    ],
    "crates_health": [
        {
            "name": "serde",
            "description": "A generic serialization/deserialization framework for Rust",
            "newest_version": "1.0.204",
            "max_version": "1.0.204",
            "downloads": 154000000,
            "recent_downloads": 8200000,
            "updated_at": "2024-05-15T10:00:00Z",
            "created_at": "2015-05-01T12:00:00Z",
            "repository": "https://github.com/serde-rs/serde",
            "homepage": "https://serde.rs"
        }
    ]
}

class CoralClient:
    def __init__(self, db_session: Session):
        self.db = db_session
        self.use_wsl = os.environ.get("USE_WSL_FOR_CORAL", "1") == "1"
        self.demo_fallback = os.environ.get("RAKSHAK_DEMO_FALLBACK", "0") == "1"
        
        # Load query files from queries folder
        self.queries_dir = os.path.join(os.path.dirname(__file__), "queries")
        self.queries = {}
        if os.path.exists(self.queries_dir):
            for file in os.listdir(self.queries_dir):
                if file.endswith(".sql"):
                    name = file[:-4]
                    with open(os.path.join(self.queries_dir, file), "r", encoding="utf-8") as f:
                        self.queries[name] = f.read()

    def run_query(self, query_name: str, params: dict = None, source: str = "dashboard") -> dict:
        """Execute a predefined Coral query, with string parameter interpolation and error fallback."""
        if params is None:
            params = {}
            
        sql_template = self.queries.get(query_name)
        if not sql_template:
            # Fallback if query file doesn't exist
            return {"rows": [], "execution_ms": 0, "cache_status": "UNKNOWN", "fallback_used": False}

        # Interpolate params in SQL template
        try:
            sql = sql_template.format(**params)
        except KeyError as e:
            print(f"Missing parameter {e} for query {query_name}")
            sql = sql_template

        start_time = time.time()
        
        # Check if fallback is forced
        if self.demo_fallback:
            return self._return_fallback(query_name, sql, start_time, source)

        # Run Coral CLI subprocess
        try:
            rows, stderr_output = self._execute_coral_process(sql)
            execution_ms = int((time.time() - start_time) * 1000)
            
            # Cache status determination
            # Time-based heuristic (under 250ms is highly likely a cache hit for external APIs)
            cache_status = "HIT" if execution_ms < 250 else "MISS"
            if "cache" in stderr_output.lower() or "cached" in stderr_output.lower():
                cache_status = "HIT"

            self._log_query(query_name, sql, execution_ms, cache_status, len(rows), source, False)
            
            return {
                "rows": rows,
                "execution_ms": execution_ms,
                "cache_status": cache_status,
                "fallback_used": False
            }
            
        except Exception as e:
            print(f"Coral query {query_name} failed: {e}. Falling back to demo seed data.")
            return self._return_fallback(query_name, sql, start_time, source)

    def _execute_coral_process(self, sql: str) -> tuple[list, str]:
        """Execute the coral CLI command in the subprocess environment."""
        if self.use_wsl:
            # For WSL, escape single quotes in SQL statement to fit bash -ic "coral sql --format json 'SQL'"
            escaped_sql = sql.replace("'", "'\\''")
            command = ["wsl", "bash", "-ic", f"coral sql --format json '{escaped_sql}'"]
        else:
            # For native Windows
            command = ["coral", "sql", "--format json", sql]

        # Run the command
        process = subprocess.run(
            command,
            capture_output=True,
            text=True,
            shell=True if not self.use_wsl else False
        )
        
        if process.returncode != 0:
            raise RuntimeError(f"Coral execution failed: {process.stderr}")

        stdout = process.stdout.strip()
        stderr = process.stderr.strip()
        
        if not stdout:
            return [], stderr

        try:
            rows = json.loads(stdout)
            # Make sure it's returned as a list
            if isinstance(rows, dict):
                rows = [rows]
            return rows, stderr
        except json.JSONDecodeError:
            print(f"JSON Decode Error. Raw stdout: {stdout}")
            raise RuntimeError("Invalid JSON output from Coral CLI")

    def _return_fallback(self, query_name: str, sql: str, start_time: float, source: str) -> dict:
        """Returns mock/seed data for the given query."""
        time.sleep(0.05)  # Simulate small delay
        execution_ms = int((time.time() - start_time) * 1000)
        
        # Get fallback rows from MOCK_DATA
        rows = MOCK_DATA.get(query_name, [])
        
        # If query is for a specific package, try filtering mock data by package name
        # (This makes mock data feel more interactive/real)
        # e.g., in params we might pass package_name='jsonwebtoken'
        # Or parse the SQL query string for filters
        package_match = re.search(r"package_name\s*=\s*'([^']+)'|package\s*=\s*'([^']+)'|q\s*=\s*'([^']+)'|tag\s*=\s*'([^']+)'", sql)
        if package_match:
            pkg_name = next(g for g in package_match.groups() if g is not None)
            # Filter rows where package name matches
            filtered_rows = []
            for row in rows:
                if any(str(v).lower() == pkg_name.lower() for v in row.values()):
                    filtered_rows.append(row)
            if filtered_rows:
                rows = filtered_rows

        self._log_query(query_name, sql, execution_ms, "HIT", len(rows), source, True)
        
        return {
            "rows": rows,
            "execution_ms": execution_ms,
            "cache_status": "HIT",
            "fallback_used": True
        }

    def _log_query(self, query_name: str, sql: str, execution_ms: int, cache_status: str, rows_count: int, source: str, fallback: bool):
        """Write query execution log to database."""
        try:
            log_entry = QueryLog(
                query_name=query_name,
                query_sql=sql,
                execution_ms=execution_ms,
                cache_status=cache_status,
                rows_returned=rows_count,
                source=source,
                fallback_used=fallback
            )
            self.db.add(log_entry)
            self.db.commit()
        except Exception as e:
            print(f"Error logging query to database: {e}")
            self.db.rollback()
