import os
import re
import json
import base64
import asyncio
from datetime import datetime
from typing import Optional, List, Tuple
import httpx
from sqlalchemy import func
from sqlalchemy.orm import Session

# Try importing tomllib (Python 3.11+), fallback to tomli or simple parser
try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib
    except ImportError:
        tomllib = None

from .database import get_db
from .models import Repository, Dependency, ScanHistory, Setting

class ManifestScanner:
    def __init__(self, username: str, token: str, db_session: Session):
        self.username = username
        self.token = token
        self.db = db_session
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
        }
        if self.token and self.token.strip():
            self.headers["Authorization"] = f"token {self.token.strip()}"

    async def fetch_all_repos(self) -> list[dict]:
        """Fetch all repositories for the user, handling pagination."""
        repos = []
        url = "https://api.github.com/user/repos"
        # If no token is provided, fetch public repos of user
        if not self.token or not self.token.strip():
            url = f"https://api.github.com/users/{self.username}/repos"

        async with httpx.AsyncClient(timeout=15.0) as client:
            while url:
                try:
                    response = await client.get(url, headers=self.headers, params={"per_page": 100})
                    if response.status_code == 401 and "users" not in url:
                        # Fallback to public user endpoint if token is unauthorized
                        url = f"https://api.github.com/users/{self.username}/repos"
                        continue
                    elif response.status_code != 200:
                        print(f"Error fetching repos from {url}: {response.status_code} - {response.text}")
                        break
                    
                    data = response.json()
                    if not isinstance(data, list):
                        break
                    repos.extend(data)
                    
                    # Pagination logic
                    link_header = response.headers.get("Link", "")
                    next_url = None
                    if link_header:
                        links = link_header.split(",")
                        for link in links:
                            if 'rel="next"' in link:
                                match = re.search(r'<(.*?)>', link)
                                if match:
                                    next_url = match.group(1)
                                    break
                    url = next_url
                except Exception as e:
                    print(f"Exception fetching repos: {e}")
                    break
        return repos

    async def fetch_file_content(self, client: httpx.AsyncClient, owner: str, repo: str, filepath: str) -> Optional[str]:
        """Fetch base64 file content from GitHub API and decode it."""
        url = f"https://api.github.com/repos/{owner}/{repo}/contents/{filepath}"
        try:
            response = await client.get(url, headers=self.headers)
            if response.status_code == 200:
                data = response.json()
                if "content" in data and data.get("encoding") == "base64":
                    # Remove newlines before decoding
                    encoded_content = data["content"].replace("\n", "").replace("\r", "")
                    return base64.b64decode(encoded_content).decode("utf-8", errors="ignore")
            return None
        except Exception as e:
            print(f"Error fetching {filepath} for {owner}/{repo}: {e}")
            return None

    def parse_npm(self, content: str) -> list[tuple[str, str]]:
        """Returns list of (package_name, version)."""
        try:
            data = json.loads(content)
            results = []
            for section in ("dependencies", "devDependencies"):
                for name, version_raw in data.get(section, {}).items():
                    # Clean symbols like ^, ~, >=, etc.
                    clean_version = re.sub(r'^[\^~>=<]+', '', version_raw).strip()
                    # Handle version ranges or wildcards - get first alphanumeric component
                    if "," in clean_version:
                        clean_version = clean_version.split(",")[0].strip()
                    results.append((name, clean_version or None))
            return results
        except Exception:
            return []

    def parse_pypi(self, content: str) -> list[tuple[str, str]]:
        """Returns list of (package_name, version)."""
        results = []
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            # Handle: package==1.2.3, package>=1.0, package~=2.0, package[extra]==1.0
            match = re.match(r'^([A-Za-z0-9_\-\.]+)(?:\[.*?\])?(?:[=<>~!]+(.+?))?(?:\s*[;#].*)?$', line)
            if match:
                name = match.group(1).strip().lower()
                version = match.group(2).strip() if match.group(2) else None
                # Strip spaces or comments in version
                if version:
                    version = re.sub(r'[\^~>=<]+', '', version).strip()
                    # Splitting at multiple qualifiers if present
                    version = re.split(r'[,;]', version)[0].strip()
                if name:
                    results.append((name, version))
        return results

    def parse_cargo(self, content: str) -> list[tuple[str, str]]:
        """Returns list of (package_name, version)."""
        results = []
        if tomllib:
            try:
                data = tomllib.loads(content)
                for section in ("dependencies", "dev-dependencies"):
                    for name, val in data.get(section, {}).items():
                        if name == "std":
                            continue
                        if isinstance(val, str):
                            version = re.sub(r'^[\^~>=<]+', '', val).strip()
                        elif isinstance(val, dict):
                            version = val.get("version", "")
                            version = re.sub(r'^[\^~>=<]+', '', version).strip()
                        else:
                            version = None
                        results.append((name, version or None))
                return results
            except Exception as e:
                print(f"Error parsing Cargo.toml with tomllib: {e}")

        # Fallback regex parser for Cargo.toml
        # Find dependencies block
        in_deps = False
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("[") and line.endswith("]"):
                sec_name = line[1:-1].strip()
                in_deps = sec_name in ("dependencies", "dev-dependencies")
                continue
            if in_deps and "=" in line:
                parts = line.split("=", 1)
                name = parts[0].strip()
                val_raw = parts[1].strip()
                version = None
                # Check if it's inline table like `tokio = { version = "1.0", features = [...] }`
                if val_raw.startswith("{") and "version" in val_raw:
                    v_match = re.search(r'version\s*=\s*"([^"]+)"', val_raw)
                    if v_match:
                        version = v_match.group(1)
                # Or standard string like `tokio = "1.0"`
                elif val_raw.startswith('"') and val_raw.endswith('"'):
                    version = val_raw[1:-1]
                
                if version:
                    version = re.sub(r'^[\^~>=<]+', '', version).strip()
                results.append((name, version))
        return results

    async def scan_repo(self, client: httpx.AsyncClient, repo_meta: dict) -> dict:
        """Scan a single repository for dependency manifest files recursively."""
        owner = repo_meta["owner"]["login"]
        repo_name = repo_meta["name"]
        default_branch = repo_meta.get("default_branch", "main")
        
        manifests = {
            "npm": [],
            "pypi": [],
            "crates_io": []
        }
        
        # Fetch file tree recursively to find manifest files in subdirectories
        tree_url = f"https://api.github.com/repos/{owner}/{repo_name}/git/trees/{default_branch}?recursive=1"
        try:
            response = await client.get(tree_url, headers=self.headers)
            if response.status_code == 200:
                tree_data = response.json()
                paths = [item["path"] for item in tree_data.get("tree", []) if item.get("type") == "blob"]
                
                # Filter for manifest files
                npm_paths = [p for p in paths if p.endswith("package.json")]
                pypi_paths = [p for p in paths if p.endswith("requirements.txt")]
                cargo_paths = [p for p in paths if p.endswith("Cargo.toml")]
                
                # Limit to first 3 files per type to prevent abuse and excessive requests
                for path in npm_paths[:3]:
                    content = await self.fetch_file_content(client, owner, repo_name, path)
                    if content:
                        manifests["npm"].extend(self.parse_npm(content))
                        
                for path in pypi_paths[:3]:
                    content = await self.fetch_file_content(client, owner, repo_name, path)
                    if content:
                        manifests["pypi"].extend(self.parse_pypi(content))
                        
                for path in cargo_paths[:3]:
                    content = await self.fetch_file_content(client, owner, repo_name, path)
                    if content:
                        manifests["crates_io"].extend(self.parse_cargo(content))
            else:
                # Fallback to root level check if tree API is not available
                npm_content = await self.fetch_file_content(client, owner, repo_name, "package.json")
                if npm_content:
                    manifests["npm"].extend(self.parse_npm(npm_content))
                
                pypi_content = await self.fetch_file_content(client, owner, repo_name, "requirements.txt")
                if pypi_content:
                    manifests["pypi"].extend(self.parse_pypi(pypi_content))
                
                cargo_content = await self.fetch_file_content(client, owner, repo_name, "Cargo.toml")
                if cargo_content:
                    manifests["crates_io"].extend(self.parse_cargo(cargo_content))
        except Exception as e:
            print(f"Error recursive scanning {owner}/{repo_name}: {e}")
            
        # Clean empty lists so they don't count as having that ecosystem if empty
        clean_manifests = {}
        for eco, lst in manifests.items():
            if lst:
                clean_manifests[eco] = lst
                
        return {
            "name": repo_name,
            "manifests": clean_manifests
        }

    async def run_full_scan(self, triggered_by: str = "manual") -> dict:
        """Scan all repos, update database state, and return scan stats."""
        start = datetime.now()
        repos = await self.fetch_all_repos()
        if not repos:
            return {
                "repos_scanned": 0,
                "deps_found": 0,
                "new_deps": 0,
                "removed_deps": 0,
                "duration_sec": round((datetime.now() - start).total_seconds(), 2)
            }

        # Deduplicate repositories by name case-insensitively to prevent UNIQUE constraint failures
        seen_names = set()
        unique_repos = []
        for r in repos:
            name = r.get("name")
            if name:
                name_lower = name.lower()
                if name_lower not in seen_names:
                    seen_names.add(name_lower)
                    unique_repos.append(r)
        repos = unique_repos

        # Filter by selected repositories if configured
        selected_setting = self.db.query(Setting).filter_by(key="selected_repos").first()
        if selected_setting and selected_setting.value:
            try:
                selected_names = json.loads(selected_setting.value)
                if selected_names:  # Only filter if list is non-empty
                    selected_set = {name.lower() for name in selected_names}
                    repos = [r for r in repos if r.get("name") and r.get("name").lower() in selected_set]
            except Exception as e:
                print(f"Error filtering selected repos: {e}")

        # Use semaphore to limit concurrent HTTP requests
        semaphore = asyncio.Semaphore(5)
        async def safe_scan(client, repo):
            async with semaphore:
                return await self.scan_repo(client, repo)

        async with httpx.AsyncClient(timeout=15.0) as client:
            tasks = [safe_scan(client, r) for r in repos]
            scan_results = await asyncio.gather(*tasks)

        # Snapshot current dependencies state for removed_deps calculation
        previous_packages = set(
            (d.repo, d.ecosystem, d.package)
            for d in self.db.query(Dependency).all()
        )

        total_deps = 0
        new_deps = 0
        current_packages = set()

        for repo_data, repo_meta in zip(scan_results, repos):
            repo_name = repo_meta["name"]
            
            # Upsert Repository record case-insensitively
            existing_repo = self.db.query(Repository).filter(func.lower(Repository.name) == repo_name.lower()).first()
            
            pushed_at_str = repo_meta.get("pushed_at")
            pushed_at = None
            if pushed_at_str:
                # GitHub dates look like "2011-01-26T19:01:12Z"
                try:
                    pushed_at = datetime.strptime(pushed_at_str, "%Y-%m-%dT%H:%M:%SZ")
                except ValueError:
                    pass

            has_npm = "npm" in repo_data["manifests"]
            has_pypi = "pypi" in repo_data["manifests"]
            has_cargo = "crates_io" in repo_data["manifests"]

            if existing_repo:
                existing_repo.language = repo_meta.get("language")
                existing_repo.stars = repo_meta.get("stargazers_count", 0)
                existing_repo.open_issues = repo_meta.get("open_issues_count", 0)
                existing_repo.pushed_at = pushed_at
                existing_repo.is_fork = repo_meta.get("fork", False)
                existing_repo.has_npm = has_npm
                existing_repo.has_pypi = has_pypi
                existing_repo.has_cargo = has_cargo
                existing_repo.last_scanned = datetime.utcnow()
            else:
                self.db.add(Repository(
                    name=repo_name,
                    language=repo_meta.get("language"),
                    stars=repo_meta.get("stargazers_count", 0),
                    open_issues=repo_meta.get("open_issues_count", 0),
                    pushed_at=pushed_at,
                    is_fork=repo_meta.get("fork", False),
                    has_npm=has_npm,
                    has_pypi=has_pypi,
                    has_cargo=has_cargo,
                    last_scanned=datetime.utcnow()
                ))

            # Upsert Dependencies
            for ecosystem, pkg_list in repo_data["manifests"].items():
                seen_pkgs = {}
                for pkg, version in pkg_list:
                    if pkg:
                        pkg_lower = pkg.lower()
                        if pkg_lower not in seen_pkgs:
                            seen_pkgs[pkg_lower] = (pkg, version)

                for pkg_lower, (pkg, version) in seen_pkgs.items():
                    key = (repo_name, ecosystem, pkg)
                    current_packages.add(key)
                    
                    existing_dep = self.db.query(Dependency).filter(
                        func.lower(Dependency.repo) == repo_name.lower(),
                        func.lower(Dependency.ecosystem) == ecosystem.lower(),
                        func.lower(Dependency.package) == pkg.lower()
                    ).first()
                    
                    if not existing_dep:
                        self.db.add(Dependency(
                            repo=repo_name,
                            ecosystem=ecosystem,
                            package=pkg,
                            version=version,
                            scanned_at=datetime.utcnow()
                        ))
                        new_deps += 1
                    else:
                        existing_dep.version = version
                        existing_dep.scanned_at = datetime.utcnow()
                    
                    total_deps += 1

        # Delete dependencies that are no longer in the manifests
        removed_packages = previous_packages - current_packages
        for (repo_name, ecosystem, pkg) in removed_packages:
            self.db.query(Dependency).filter_by(
                repo=repo_name, ecosystem=ecosystem, package=pkg
            ).delete()

        # Calculate scan stats
        removed_deps = len(removed_packages)
        duration = (datetime.now() - start).total_seconds()

        # Record scan history
        scan_record = ScanHistory(
            repos_scanned=len(repos),
            deps_found=total_deps,
            new_deps=new_deps,
            removed_deps=removed_deps,
            new_alerts=0,  # Computed later in risk check
            duration_sec=round(duration, 2),
            triggered_by=triggered_by,
            scanned_at=datetime.utcnow()
        )
        self.db.add(scan_record)
        self.db.commit()

        # Update setting with last scan time
        last_scan_setting = self.db.query(Setting).filter_by(key="last_scan_at").first()
        if last_scan_setting:
            last_scan_setting.value = datetime.utcnow().isoformat()
        else:
            self.db.add(Setting(key="last_scan_at", value=datetime.utcnow().isoformat()))
        
        self.db.commit()

        return {
            "repos_scanned": len(repos),
            "deps_found": total_deps,
            "new_deps": new_deps,
            "removed_deps": removed_deps,
            "duration_sec": round(duration, 2)
        }
