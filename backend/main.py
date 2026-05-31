import os
import urllib.parse
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .database import get_db, engine, Base
from .models import (
    Setting, Repository, Dependency, RiskSnapshot, 
    SecurityAlert, MigrationGuide, QueryLog, TelegramHistory, ScanHistory
)
from .schemas import (
    GitHubSetupRequest, GitHubSelectReposRequest, TelegramSetupRequest, GeminiSetupRequest,
    AskRequest, AskResponse, TelegramSendRequest, RepositoryResponse
)
from .manifest_scanner import ManifestScanner
from .coral_client import CoralClient
from .gemini_client import GeminiClient
from .router import route_question
from .scheduler import start_scheduler, update_scheduler_interval
from .telegram_bot import start_bot_background, stop_bot_background

# Create tables if not exists
Base.metadata.create_all(bind=engine)

app = FastAPI(title="🪸 Rakshak — Personal Dependency Health Agent")

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event to start the APScheduler and Telegram bot
@app.on_event("startup")
def on_startup():
    start_scheduler()
    start_bot_background()

@app.on_event("shutdown")
def on_shutdown():
    stop_bot_background()

# Helper: Get setting value
def get_setting(db: Session, key: str, default: str = "") -> str:
    setting = db.query(Setting).filter_by(key=key).first()
    return setting.value if setting else default

# Helper: Set setting value
def set_setting(db: Session, key: str, value: str):
    setting = db.query(Setting).filter_by(key=key).first()
    if setting:
        setting.value = value
    else:
        db.add(Setting(key=key, value=value))
    db.commit()

# Helper: Parse version components for delta
def get_version_delta(v1: str, v2: str) -> Optional[int]:
    """Calculate major version lag if parseable."""
    if not v1 or not v2:
        return None
    # Strip non-digits
    v1_clean = re.sub(r'[^0-9\.]', '', v1).split('.')
    v2_clean = re.sub(r'[^0-9\.]', '', v2).split('.')
    try:
        major1 = int(v1_clean[0])
        major2 = int(v2_clean[0])
        return max(0, major2 - major1)
    except Exception:
        return None

import re

# ─────────────────────────────────────────
# SETUP & HEALTH ENDPOINTS
# ─────────────────────────────────────────

@app.get("/api/setup/status")
def get_setup_status(db: Session = Depends(get_db)):
    github_user = get_setting(db, "github_username")
    github_token = get_setting(db, "github_token")
    telegram_token = get_setting(db, "telegram_token")
    telegram_chat = get_setting(db, "telegram_chat_id")
    gemini_key = get_setting(db, "gemini_key")
    setup_complete = get_setting(db, "setup_complete") == "true"
    last_scan = get_setting(db, "last_scan_at")
    fallback = get_setting(db, "rakshak_demo_fallback", os.environ.get("RAKSHAK_DEMO_FALLBACK", "1"))
    
    import json
    selected_repos_str = get_setting(db, "selected_repos", "[]")
    try:
        selected_repos = json.loads(selected_repos_str)
    except Exception:
        selected_repos = []
    
    return {
        "setup_complete": setup_complete,
        "github_username": github_user,
        "github_token": github_token,
        "telegram_token": telegram_token,
        "telegram_chat_id": telegram_chat,
        "gemini_key": gemini_key,
        "github_configured": bool(github_user and github_token),
        "telegram_configured": bool(telegram_token and telegram_chat),
        "gemini_configured": bool(gemini_key and gemini_key != "dummy_gemini_key"),
        "last_scan_at": last_scan,
        "rakshak_demo_fallback": fallback == "1",
        "selected_repos": selected_repos
    }

@app.post("/api/setup/github")
def setup_github(req: GitHubSetupRequest, db: Session = Depends(get_db)):
    set_setting(db, "github_username", req.username)
    set_setting(db, "github_token", req.token)
    return {"status": "success", "message": "GitHub configuration saved."}

@app.get("/api/setup/github/repos")
async def get_github_repos(db: Session = Depends(get_db)):
    username = get_setting(db, "github_username")
    token = get_setting(db, "github_token")
    if not username:
        raise HTTPException(status_code=400, detail="GitHub username not configured.")
    
    scanner = ManifestScanner(username, token, db)
    repos = await scanner.fetch_all_repos()
    
    repo_list = []
    # Deduplicate repos by name case-insensitively before sending to UI
    seen = set()
    for r in repos:
        name = r.get("name")
        if name and name.lower() not in seen:
            seen.add(name.lower())
            repo_list.append({
                "name": name,
                "full_name": r.get("full_name"),
                "description": r.get("description"),
                "language": r.get("language"),
                "private": r.get("private", False),
                "stars": r.get("stargazers_count", 0),
            })
    return repo_list

@app.post("/api/setup/github/select")
def select_github_repos(req: GitHubSelectReposRequest, db: Session = Depends(get_db)):
    import json
    set_setting(db, "selected_repos", json.dumps(req.selected_repos))
    return {"status": "success", "message": "Selected repositories saved."}

@app.post("/api/setup/scan")
async def trigger_scan(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    username = get_setting(db, "github_username")
    token = get_setting(db, "github_token")
    if not username:
        raise HTTPException(status_code=400, detail="GitHub username not configured.")
        
    scanner = ManifestScanner(username, token, db)
    
    # Run scan synchronously or in background. For a better UX in demo, we run background rescan 
    # but immediately return a job status. To keep it simple, we scan synchronously here since it takes 1-3 seconds.
    try:
        stats = await scanner.run_full_scan(triggered_by="manual")
        return {"status": "success", "message": "Scan completed.", "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")

@app.post("/api/setup/telegram")
def setup_telegram(req: TelegramSetupRequest, db: Session = Depends(get_db)):
    set_setting(db, "telegram_token", req.token)
    set_setting(db, "telegram_chat_id", req.chat_id)
    return {"status": "success", "message": "Telegram configuration saved."}

@app.post("/api/setup/gemini")
def setup_gemini(req: GeminiSetupRequest, db: Session = Depends(get_db)):
    set_setting(db, "gemini_key", req.api_key)
    # Also update setup_complete to true once API keys are ready
    set_setting(db, "setup_complete", "true")
    return {"status": "success", "message": "Gemini configuration saved. Setup complete!"}


# ─────────────────────────────────────────
# OVERVIEW & LOGS
# ─────────────────────────────────────────

@app.get("/api/overview")
def get_overview(db: Session = Depends(get_db)):
    total_repos = db.query(Repository).count()
    total_deps = db.query(Dependency).count()
    
    # Calculate counts from latest risk_snapshots
    # Find most recent risk scan date
    latest_snap = db.query(RiskSnapshot).order_by(RiskSnapshot.snapshotted_at.desc()).first()
    critical_count = 0
    warning_count = 0
    healthy_count = total_deps
    
    if latest_snap:
        latest_time = latest_snap.snapshotted_at
        critical_count = db.query(RiskSnapshot).filter(
            RiskSnapshot.snapshotted_at == latest_time,
            RiskSnapshot.status == 'Critical'
        ).count()
        warning_count = db.query(RiskSnapshot).filter(
            RiskSnapshot.snapshotted_at == latest_time,
            RiskSnapshot.status == 'Warning'
        ).count()
        healthy_count = db.query(RiskSnapshot).filter(
            RiskSnapshot.snapshotted_at == latest_time,
            RiskSnapshot.status == 'Healthy'
        ).count()
        
    last_scan = get_setting(db, "last_scan_at")
    
    return {
        "total_repos": total_repos,
        "total_deps": total_deps,
        "critical_risk_count": critical_count,
        "warning_risk_count": warning_count,
        "healthy_risk_count": healthy_count,
        "last_scan_at": last_scan
    }

@app.get("/api/query-log")
def get_query_log(db: Session = Depends(get_db), limit: int = 50):
    logs = db.query(QueryLog).order_by(QueryLog.executed_at.desc()).limit(limit).all()
    return logs


# ─────────────────────────────────────────
# REPOSITORIES
# ─────────────────────────────────────────

@app.get("/api/repos")
def get_repositories(db: Session = Depends(get_db)):
    repos = db.query(Repository).order_by(Repository.name).all()
    return repos


# ─────────────────────────────────────────
# RISK ANALYSIS & HEATMAP
# ─────────────────────────────────────────

@app.get("/api/risk")
def run_risk_analysis(db: Session = Depends(get_db)):
    """Computes risk score for all scanned dependencies using Coral + OSV, updating snapshots."""
    deps = db.query(Dependency).all()
    if not deps:
        return {"status": "success", "message": "No dependencies found to analyze.", "snapshots": []}

    coral = CoralClient(db)
    
    # Store snapshot timestamp
    snap_time = datetime.utcnow()
    new_snapshots = []
    new_alerts_count = 0
    
    # Map ecosystem strings for deps.dev system parameter
    eco_system_map = {
        "npm": "NPM",
        "pypi": "PYPI",
        "crates_io": "CARGO"
    }

    # Map ecosystem strings for OSV ecosystem parameter
    eco_osv_map = {
        "npm": "npm",
        "pypi": "PyPI",
        "crates_io": "crates.io"
    }

    for dep in deps:
        system = eco_system_map.get(dep.ecosystem, "NPM")
        
        # URL encode scoped package name if NPM
        pkg_name_query = dep.package
        if dep.ecosystem == "npm" and dep.package.startswith("@"):
            pkg_name_query = urllib.parse.quote(dep.package)

        # 1. Fetch registry info from Coral deps_dev.versions
        health_result = coral.run_query("deps_dev_health", {
            "system": system,
            "package_name": pkg_name_query,
            "version": dep.version or "0.0.0"
        }, source="api_risk")

        latest_version = None
        published_at = None
        is_deprecated = False
        advisory_keys = []
        
        if health_result["rows"]:
            row = health_result["rows"][0]
            latest_version = row.get("version")
            published_at = row.get("published_at")
            is_deprecated = bool(row.get("is_deprecated", False))
            
            # advisory_keys can be list or string representation of list
            advs = row.get("advisory_keys")
            if isinstance(advs, list):
                advisory_keys = advs
            elif isinstance(advs, str) and advs:
                try:
                    advisory_keys = json.loads(advs)
                except Exception:
                    advisory_keys = [advs]

        # 2. Compute risk score in Python
        # Base score is 10
        risk_score = 10.0
        pkg_stale_days = None
        
        if published_at:
            try:
                # published_at format e.g. "2023-01-15T08:00:00Z"
                pub_date = datetime.strptime(published_at.split("T")[0], "%Y-%m-%d")
                pkg_stale_days = (datetime.utcnow() - pub_date).days
                # 0.1 risk points per day of stale version
                risk_score += max(0, pkg_stale_days) * 0.1
            except Exception:
                pass
                
        # If deprecated, huge risk hit
        if is_deprecated:
            risk_score += 100.0
            
        # Version lag penalty
        version_delta = get_version_delta(dep.version, latest_version)
        if version_delta:
            risk_score += version_delta * 25.0 # 25 points per major version behind

        # Advisory penalty
        if advisory_keys:
            risk_score += 120.0
            
        # Cap risk score at 200
        risk_score = round(min(200.0, risk_score), 1)

        # Status threshold mapping
        if risk_score > 120.0 or advisory_keys:
            status = "Critical"
        elif risk_score > 60.0:
            status = "Warning"
        else:
            status = "Healthy"

        # Downgrade status to Warning if dependency is not outdated and not deprecated
        is_outdated = False
        if dep.version and latest_version:
            try:
                v1_clean = [int(x) for x in re.sub(r'[^0-9\.]', '', dep.version).split('.') if x.isdigit()]
                v2_clean = [int(x) for x in re.sub(r'[^0-9\.]', '', latest_version).split('.') if x.isdigit()]
                is_outdated = v1_clean < v2_clean
            except Exception:
                is_outdated = dep.version != latest_version

        if status == "Critical" and not is_outdated and not is_deprecated:
            status = "Warning"

        # Save snapshot
        snapshot = RiskSnapshot(
            repo=dep.repo,
            package=dep.package,
            ecosystem=dep.ecosystem,
            your_version=dep.version,
            latest_version=latest_version or dep.version,
            version_delta=version_delta,
            risk_score=risk_score,
            pkg_stale_days=pkg_stale_days,
            status=status,
            snapshotted_at=snap_time
        )
        db.add(snapshot)
        new_snapshots.append(snapshot)

        # 3. If there are advisory keys or critical risk, fetch advisories from OSV
        if advisory_keys or status == "Critical":
            osv_result = coral.run_query("osv_vulns", {
                "package_name": dep.package,
                "ecosystem": eco_osv_map.get(dep.ecosystem, "npm"),
                "version": dep.version or "0.0.0"
            }, source="api_risk")

            if osv_result["rows"]:
                for vuln in osv_result["rows"]:
                    vuln_id = vuln.get("id")
                    
                    # Deduplicate alerts
                    existing_alert = db.query(SecurityAlert).filter_by(hn_id=vuln_id).first()
                    if not existing_alert:
                        db.add(SecurityAlert(
                            hn_id=vuln_id,
                            hn_title=vuln.get("summary") or f"Vulnerability in {dep.package}",
                            hn_url=f"https://osv.dev/vulnerability/{vuln_id}",
                            points=0,
                            num_comments=0,
                            package=dep.package,
                            ecosystem=dep.ecosystem,
                            repo=dep.repo,
                            severity=(vuln.get("severity") or "high").lower(),
                            dismissed=False
                        ))
                        new_alerts_count += 1
                        
        # 4. Trigger Hacker News search query to look for matching security threads
        hn_result = coral.run_query("hn_security", {
            "query": dep.package
        }, source="api_risk")

        if hn_result["rows"]:
            for story in hn_result["rows"]:
                hn_url = story.get("url") or f"https://news.ycombinator.com/item?id={story.get('title')}"
                story_title = story.get("title")
                
                # Use title as a unique key or URL if title can repeat
                existing_hn = db.query(SecurityAlert).filter_by(hn_title=story_title).first()
                if not existing_hn:
                    db.add(SecurityAlert(
                        hn_title=story_title,
                        hn_url=hn_url,
                        points=story.get("points", 0),
                        num_comments=story.get("num_comments", 0),
                        package=dep.package,
                        ecosystem=dep.ecosystem,
                        repo=dep.repo,
                        severity="medium",
                        dismissed=False
                    ))
                    new_alerts_count += 1

    # Record scan summary update
    last_scan = db.query(ScanHistory).order_by(ScanHistory.scanned_at.desc()).first()
    if last_scan:
        last_scan.new_alerts = new_alerts_count
        db.commit()

    db.commit()
    
    # Return serializable summary
    return {
        "status": "success",
        "timestamp": snap_time.isoformat(),
        "analyzed_count": len(deps),
        "new_alerts_found": new_alerts_count,
        "snapshots": [
            {
                "repo": s.repo,
                "package": s.package,
                "ecosystem": s.ecosystem,
                "your_version": s.your_version,
                "latest_version": s.latest_version,
                "risk_score": s.risk_score,
                "status": s.status
            } for s in new_snapshots
        ]
    }

@app.get("/api/risk/heatmap")
def get_risk_heatmap(db: Session = Depends(get_db)):
    """Returns coordinates/cells for the D3 risk heatmap."""
    # Find latest snapshot time
    latest_snap = db.query(RiskSnapshot).order_by(RiskSnapshot.snapshotted_at.desc()).first()
    if not latest_snap:
        return []
        
    latest_time = latest_snap.snapshotted_at
    snapshots = db.query(RiskSnapshot).filter(RiskSnapshot.snapshotted_at == latest_time).all()
    
    # Pre-fetch alerts to optimize lookup performance
    alerts = db.query(SecurityAlert.package, SecurityAlert.repo).all()
    alerts_set = {(a.package, a.repo) for a in alerts}
    
    return [
        {
            "id": s.id,
            "repo": s.repo,
            "package": s.package,
            "ecosystem": s.ecosystem,
            "your_version": s.your_version,
            "latest_version": s.latest_version,
            "risk_score": s.risk_score,
            "status": s.status,
            "pkg_stale_days": s.pkg_stale_days,
            "version_delta": s.version_delta,
            "has_alerts": (s.package, s.repo) in alerts_set,
            "is_deprecated": (s.risk_score - 10.0 - (s.pkg_stale_days or 0) * 0.1 - (s.version_delta or 0) * 25.0) >= 80.0
        } for s in snapshots
    ]

@app.get("/api/risk/{repo}")
def get_repo_risk(repo: str, db: Session = Depends(get_db)):
    latest_snap = db.query(RiskSnapshot).order_by(RiskSnapshot.snapshotted_at.desc()).first()
    if not latest_snap:
        raise HTTPException(status_code=404, detail="No snapshots available.")
    
    snapshots = db.query(RiskSnapshot).filter(
        RiskSnapshot.repo == repo,
        RiskSnapshot.snapshotted_at == latest_snap.snapshotted_at
    ).all()
    return snapshots

@app.get("/api/risk/{repo}/{package}")
def get_dependency_detail(repo: str, package: str, db: Session = Depends(get_db)):
    latest_snap = db.query(RiskSnapshot).order_by(RiskSnapshot.snapshotted_at.desc()).first()
    if not latest_snap:
        raise HTTPException(status_code=404, detail="No snapshots available.")
        
    snap = db.query(RiskSnapshot).filter(
        RiskSnapshot.repo == repo,
        RiskSnapshot.package == package,
        RiskSnapshot.snapshotted_at == latest_snap.snapshotted_at
    ).first()
    
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot detail not found.")
        
    # Get associated alerts
    alerts = db.query(SecurityAlert).filter_by(package=package, repo=repo).all()
    
    # Calculate granular risk reasons
    reasons = []
    reasons.append({
        "title": "Base Risk Score",
        "detail": "Standard baseline risk for all dependencies.",
        "score_impact": 10.0,
        "type": "base"
    })
    
    if snap.pkg_stale_days and snap.pkg_stale_days > 0:
        stale_penalty = round(snap.pkg_stale_days * 0.1, 1)
        reasons.append({
            "title": "Package Version Stale",
            "detail": f"This version has not been updated/published for {snap.pkg_stale_days} days.",
            "score_impact": stale_penalty,
            "type": "stale"
        })
        
    if snap.version_delta and snap.version_delta > 0:
        lag_penalty = round(snap.version_delta * 25.0, 1)
        reasons.append({
            "title": "Major Version Lag",
            "detail": f"You are running {snap.version_delta} major versions behind the latest release.",
            "score_impact": lag_penalty,
            "type": "lag"
        })
        
    if alerts:
        reasons.append({
            "title": "Security Vulnerabilities",
            "detail": f"Found {len(alerts)} active security vulnerabilities matching your package version.",
            "score_impact": 120.0,
            "type": "advisory"
        })
        
    accounted_score = 10.0
    if snap.pkg_stale_days:
        accounted_score += snap.pkg_stale_days * 0.1
    if snap.version_delta:
        accounted_score += snap.version_delta * 25.0
    if alerts:
        accounted_score += 120.0
        
    if snap.risk_score - accounted_score >= 80.0:
        reasons.append({
            "title": "Package Deprecated",
            "detail": "This package has been officially marked as deprecated by its maintainers.",
            "score_impact": 100.0,
            "type": "deprecation"
        })
        
    return {
        "snapshot": snap,
        "alerts": alerts,
        "reasons": reasons
    }


# ─────────────────────────────────────────
# SECURITY ALERTS
# ─────────────────────────────────────────

@app.get("/api/alerts")
def get_active_alerts(db: Session = Depends(get_db)):
    """Returns non-dismissed security alerts, excluding Hacker News stories."""
    alerts = db.query(SecurityAlert).filter(
        SecurityAlert.dismissed == False,
        SecurityAlert.hn_id.isnot(None)
    ).order_by(SecurityAlert.found_at.desc()).all()
    return alerts

@app.get("/api/alerts/all")
def get_all_alerts(db: Session = Depends(get_db)):
    """Returns all security alerts, excluding Hacker News stories."""
    alerts = db.query(SecurityAlert).filter(
        SecurityAlert.hn_id.isnot(None)
    ).order_by(SecurityAlert.found_at.desc()).all()
    return alerts

@app.post("/api/alerts/{id}/dismiss")
def dismiss_alert(id: int, db: Session = Depends(get_db)):
    alert = db.query(SecurityAlert).filter_by(id=id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
    alert.dismissed = True
    alert.dismissed_at = datetime.utcnow()
    db.commit()
    return {"status": "success", "message": "Alert dismissed."}


# ─────────────────────────────────────────
# MIGRATION GUIDES
# ─────────────────────────────────────────

@app.get("/api/guides")
def get_cached_guides(db: Session = Depends(get_db)):
    guides = db.query(MigrationGuide).order_by(MigrationGuide.reactions.desc()).all()
    return guides

@app.get("/api/guides/{package}")
def fetch_migration_guides(package: str, db: Session = Depends(get_db)):
    """Fetch migration guides using Dev.to source for a package, cache them, and return."""
    coral = CoralClient(db)
    
    guides_result = coral.run_query("devto_guides", {
        "tag": package.lower()
    }, source="guides")
    
    new_guides = []
    if guides_result["rows"]:
        for article in guides_result["rows"]:
            title = article.get("title")
            url = article.get("url")
            reactions = article.get("public_reactions_count", 0)
            time_min = article.get("reading_time_minutes", 0)
            ecosystem = "npm" # standard default
            
            # Check if this package belongs to an ecosystem
            dep = db.query(Dependency).filter_by(package=package).first()
            if dep:
                ecosystem = dep.ecosystem

            existing = db.query(MigrationGuide).filter_by(url=url).first()
            if not existing:
                guide = MigrationGuide(
                    title=title,
                    url=url,
                    package=package,
                    ecosystem=ecosystem,
                    reactions=reactions,
                    reading_time_min=time_min
                )
                db.add(guide)
                new_guides.append(guide)
            else:
                existing.reactions = reactions
                existing.reading_time_min = time_min
                new_guides.append(existing)
        db.commit()
        
    # Query all guides for this package
    db_guides = db.query(MigrationGuide).filter_by(package=package).all()
    return db_guides


# ─────────────────────────────────────────
# NATURAL LANGUAGE ENDPOINT
# ─────────────────────────────────────────

@app.post("/api/ask", response_model=AskResponse)
def ask_question(req: AskRequest, db: Session = Depends(get_db)):
    """Main LLM query router endpoint."""
    query_name = route_question(req.question)
    coral = CoralClient(db)
    
    # Extract package name filter if mentioned in question
    # (Simple heuristic regex for package matching in questions)
    package_param = None
    match = re.search(r"package\s+([A-Za-z0-9_\-\@\/]+)|for\s+([A-Za-z0-9_\-\@\/]+)", req.question.lower())
    if match:
        package_param = next(g for g in match.groups() if g is not None)
    
    # Execute query
    if not package_param:
        # No specific package was mentioned: run a local SQLite query on our scanned metrics
        if query_name in ["osv_vulns", "hn_security"]:
            # Retrieve scanned security alerts from SQLite
            db_alerts = db.query(SecurityAlert).filter_by(dismissed=False).all()
            
            # Filter by category if requested
            if "hacker" in req.question.lower() or "hn" in req.question.lower():
                db_alerts = [a for a in db_alerts if a.hn_url and "news.ycombinator.com" in a.hn_url]
            elif "npm" in req.question.lower():
                db_alerts = [a for a in db_alerts if a.ecosystem == "npm"]
            elif "pypi" in req.question.lower() or "python" in req.question.lower():
                db_alerts = [a for a in db_alerts if a.ecosystem == "pypi"]
            elif "cargo" in req.question.lower() or "rust" in req.question.lower():
                db_alerts = [a for a in db_alerts if a.ecosystem == "crates_io"]
                
            rows = [{
                "id": a.hn_id or "Alert",
                "summary": a.hn_title,
                "package": a.package,
                "ecosystem": a.ecosystem,
                "repo": a.repo,
                "severity": a.severity,
                "url": a.hn_url
            } for a in db_alerts]
            result = {
                "rows": rows,
                "execution_ms": 1,
                "cache_status": "HIT",
                "fallback_used": False
            }
        else:
            # Query risk snapshots for outdated or stale packages
            latest_snap = db.query(RiskSnapshot).order_by(RiskSnapshot.snapshotted_at.desc()).first()
            rows = []
            if latest_snap:
                snaps_query = db.query(RiskSnapshot).filter(RiskSnapshot.snapshotted_at == latest_snap.snapshotted_at)
                
                if "npm" in req.question.lower():
                    snaps_query = snaps_query.filter(RiskSnapshot.ecosystem == "npm")
                elif "pypi" in req.question.lower() or "python" in req.question.lower():
                    snaps_query = snaps_query.filter(RiskSnapshot.ecosystem == "pypi")
                elif "cargo" in req.question.lower() or "rust" in req.question.lower():
                    snaps_query = snaps_query.filter(RiskSnapshot.ecosystem == "crates_io")
                    
                snaps = snaps_query.all()
                
                if any(k in req.question.lower() for k in ["outdated", "stale", "worst", "vuln", "risk"]):
                    snaps = [s for s in snaps if s.status in ["Warning", "Critical"]]
                    
                rows = [{
                    "package_name": s.package,
                    "repo": s.repo,
                    "ecosystem": s.ecosystem,
                    "your_version": s.your_version,
                    "latest_version": s.latest_version,
                    "risk_score": s.risk_score,
                    "status": s.status,
                    "pkg_stale_days": s.pkg_stale_days
                } for s in snaps]
                
            result = {
                "rows": rows,
                "execution_ms": 1,
                "cache_status": "HIT",
                "fallback_used": False
            }
    else:
        # A specific package was requested: run a live query against the Coral engine
        params = {}
        if query_name == "deps_dev_health":
            eco = "NPM"
            if "pypi" in req.question.lower() or "python" in req.question.lower():
                eco = "PYPI"
            elif "cargo" in req.question.lower() or "rust" in req.question.lower():
                eco = "CARGO"
            params = {"system": eco, "package_name": package_param, "version": "18.2.0"}
        elif query_name == "osv_vulns":
            eco = "npm"
            if "pypi" in req.question.lower() or "python" in req.question.lower():
                eco = "PyPI"
            elif "cargo" in req.question.lower() or "rust" in req.question.lower():
                eco = "crates.io"
            params = {"package_name": package_param, "ecosystem": eco, "version": "1.0.0"}
        elif query_name == "hn_security":
            params = {"query": package_param}
        elif query_name == "devto_guides":
            params = {"tag": package_param}
        elif query_name == "crates_health":
            params = {"package_name": package_param}
        elif query_name == "unified_risk":
            params = {"package_name": package_param}
            
        result = coral.run_query(query_name, params, source="api_ask")
    
    # Summarize with Gemini
    gemini_key = get_setting(db, "gemini_key")
    summary = ""
    if gemini_key:
        client = GeminiClient(gemini_key)
        summary = client.summarize(result["rows"], channel="dashboard", question=req.question, query_name=query_name)
    
    return AskResponse(
        answer=summary,
        query_used=query_name,
        execution_ms=result["execution_ms"],
        cache_status=result["cache_status"],
        fallback_used=result["fallback_used"]
    )


# ─────────────────────────────────────────
# SCAN HISTORY
# ─────────────────────────────────────────

@app.get("/api/scan-history")
def get_scan_history(db: Session = Depends(get_db)):
    scans = db.query(ScanHistory).order_by(ScanHistory.scanned_at.desc()).all()
    return scans

@app.get("/api/latest-snapshot")
def get_latest_snapshot_summary(db: Session = Depends(get_db)):
    latest_snap = db.query(RiskSnapshot).order_by(RiskSnapshot.snapshotted_at.desc()).first()
    if not latest_snap:
        return {"status": "none", "counts": {"Critical": 0, "Warning": 0, "Healthy": 0}}
        
    latest_time = latest_snap.snapshotted_at
    snapshots = db.query(RiskSnapshot).filter(RiskSnapshot.snapshotted_at == latest_time).all()
    
    counts = {"Critical": 0, "Warning": 0, "Healthy": 0}
    for s in snapshots:
        counts[s.status] = counts.get(s.status, 0) + 1
        
    return {
        "status": "success",
        "snapshotted_at": latest_time.isoformat(),
        "counts": counts
    }


# ─────────────────────────────────────────
# TELEGRAM INTEGRATION
# ─────────────────────────────────────────

@app.get("/api/telegram/history")
def get_telegram_history(db: Session = Depends(get_db)):
    hist = db.query(TelegramHistory).order_by(TelegramHistory.executed_at.desc()).limit(50).all()
    return hist

@app.post("/api/telegram/send")
async def send_telegram_direct(req: TelegramSendRequest, db: Session = Depends(get_db)):
    """Deliver direct Telegram notification via request."""
    token = get_setting(db, "telegram_token")
    chat_id = get_setting(db, "telegram_chat_id")
    if not token or not chat_id:
        raise HTTPException(status_code=400, detail="Telegram bot not fully configured.")
        
    try:
        import httpx
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json={"chat_id": chat_id, "text": req.message, "parse_mode": "Markdown"})
            if res.status_code == 200:
                # Log outbound message
                db.add(TelegramHistory(
                    direction="outbound",
                    message=req.message,
                    intent="direct_send"
                ))
                db.commit()
                return {"status": "success"}
            else:
                raise HTTPException(status_code=500, detail=f"Telegram API error: {res.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/alerts/{id}/send-telegram")
async def send_alert_telegram(id: int, db: Session = Depends(get_db)):
    alert = db.query(SecurityAlert).filter_by(id=id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
        
    text = f"🔴 *SECURITY ALERT* for package `{alert.package}`\n\nTitle: {alert.hn_title}\nLink: {alert.hn_url}"
    # Reuse send_telegram_direct flow
    await send_telegram_direct(TelegramSendRequest(message=text), db)
    
    alert.sent_to_telegram = True
    db.commit()
    return {"status": "success"}

@app.post("/api/guides/{id}/send-telegram")
async def send_guide_telegram(id: int, db: Session = Depends(get_db)):
    guide = db.query(MigrationGuide).filter_by(id=id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found.")
        
    text = f"💡 *UPGRADE GUIDE* for `{guide.package}`\n\nTitle: {guide.title}\nURL: {guide.url}"
    await send_telegram_direct(TelegramSendRequest(message=text), db)
    
    guide.sent_to_telegram = True
    db.commit()
    return {"status": "success"}


# ─────────────────────────────────────────
# DEMO SAFETY ENDPOINTS
# ─────────────────────────────────────────

@app.delete("/api/demo/reset")
def reset_demo_database(db: Session = Depends(get_db)):
    """Reset DB and populate with clean mock seed data."""
    try:
        # Clear tables
        db.query(Repository).delete()
        db.query(Dependency).delete()
        db.query(RiskSnapshot).delete()
        db.query(SecurityAlert).delete()
        db.query(MigrationGuide).delete()
        db.query(QueryLog).delete()
        db.query(TelegramHistory).delete()
        db.query(ScanHistory).delete()
        
        # Add a couple of repositories
        db.add(Repository(
            name="cool-react-frontend",
            language="JavaScript",
            stars=12,
            open_issues=2,
            pushed_at=datetime.utcnow(),
            has_npm=True
        ))
        db.add(Repository(
            name="fastapi-backend-api",
            language="Python",
            stars=25,
            open_issues=0,
            pushed_at=datetime.utcnow(),
            has_pypi=True
        ))
        db.commit()
        
        # Add dependencies
        db.add(Dependency(repo="cool-react-frontend", ecosystem="npm", package="jsonwebtoken", version="8.5.1"))
        db.add(Dependency(repo="cool-react-frontend", ecosystem="npm", package="lodash", version="4.17.15"))
        db.add(Dependency(repo="cool-react-frontend", ecosystem="npm", package="react", version="18.2.0"))
        db.add(Dependency(repo="fastapi-backend-api", ecosystem="pypi", package="requests", version="2.25.1"))
        db.add(Dependency(repo="fastapi-backend-api", ecosystem="pypi", package="fastapi", version="0.95.0"))
        db.commit()
        
        # Enable fallback mode by default
        set_setting(db, "rakshak_demo_fallback", "1")
        set_setting(db, "last_scan_at", datetime.utcnow().isoformat())
        
        db.commit()
        return {"status": "success", "message": "Demo data reset successfully. Fallback mode enabled."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/demo/status")
def get_demo_status(db: Session = Depends(get_db)):
    fallback = get_setting(db, "rakshak_demo_fallback", "1")
    return {
        "rakshak_demo_fallback": fallback == "1"
    }

@app.post("/api/demo/toggle")
def toggle_demo_mode(db: Session = Depends(get_db)):
    current = get_setting(db, "rakshak_demo_fallback", "1")
    new_val = "0" if current == "1" else "1"
    set_setting(db, "rakshak_demo_fallback", new_val)
    return {"status": "success", "rakshak_demo_fallback": new_val == "1"}
