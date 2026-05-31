import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, UniqueConstraint, func
from .database import Base

class Setting(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True)
    value = Column(String, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class Repository(Base):
    __tablename__ = "repositories"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    language = Column(String, nullable=True)
    stars = Column(Integer, default=0)
    open_issues = Column(Integer, default=0)
    pushed_at = Column(DateTime, nullable=True)
    is_fork = Column(Boolean, default=False)
    has_npm = Column(Boolean, default=False)
    has_pypi = Column(Boolean, default=False)
    has_cargo = Column(Boolean, default=False)
    last_scanned = Column(DateTime, default=datetime.datetime.utcnow)

class Dependency(Base):
    __tablename__ = "dependencies"
    id = Column(Integer, primary_key=True, autoincrement=True)
    repo = Column(String, nullable=False)
    ecosystem = Column(String, nullable=False)  # 'npm' | 'pypi' | 'crates_io'
    package = Column(String, nullable=False)
    version = Column(String, nullable=True)
    scanned_at = Column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('repo', 'ecosystem', 'package', name='uq_repo_eco_pkg'),
    )

class RiskSnapshot(Base):
    __tablename__ = "risk_snapshots"
    id = Column(Integer, primary_key=True, autoincrement=True)
    repo = Column(String, nullable=False)
    package = Column(String, nullable=False)
    ecosystem = Column(String, nullable=False)
    your_version = Column(String, nullable=True)
    latest_version = Column(String, nullable=True)
    version_delta = Column(Integer, nullable=True)
    risk_score = Column(Float, nullable=False)
    repo_stale_days = Column(Integer, nullable=True)
    pkg_stale_days = Column(Integer, nullable=True)
    open_issues = Column(Integer, nullable=True)
    status = Column(String, nullable=True)
    snapshotted_at = Column(DateTime, default=datetime.datetime.utcnow)

class SecurityAlert(Base):
    __tablename__ = "security_alerts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    hn_id = Column(String, unique=True, nullable=True)  # Can be OSV advisory ID too
    hn_title = Column(String, nullable=False)
    hn_url = Column(String, nullable=True)
    points = Column(Integer, default=0)
    num_comments = Column(Integer, default=0)
    package = Column(String, nullable=False)
    ecosystem = Column(String, nullable=False)
    repo = Column(String, nullable=True)
    severity = Column(String, default="medium")
    dismissed = Column(Boolean, default=False)
    sent_to_telegram = Column(Boolean, default=False)
    found_at = Column(DateTime, default=datetime.datetime.utcnow)
    dismissed_at = Column(DateTime, nullable=True)

class MigrationGuide(Base):
    __tablename__ = "migration_guides"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    url = Column(String, unique=True, nullable=False)
    package = Column(String, nullable=True)
    ecosystem = Column(String, nullable=True)
    reactions = Column(Integer, default=0)
    reading_time_min = Column(Integer, nullable=True)
    sent_to_telegram = Column(Boolean, default=False)
    sent_at = Column(DateTime, nullable=True)
    cached_at = Column(DateTime, default=datetime.datetime.utcnow)

class QueryLog(Base):
    __tablename__ = "query_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    query_name = Column(String, nullable=True)
    query_sql = Column(String, nullable=True)
    execution_ms = Column(Integer, nullable=True)
    cache_status = Column(String, nullable=True)  # 'HIT' | 'MISS' | 'UNKNOWN'
    rows_returned = Column(Integer, nullable=True)
    source = Column(String, default="dashboard")
    fallback_used = Column(Boolean, default=False)
    executed_at = Column(DateTime, default=datetime.datetime.utcnow)

class TelegramHistory(Base):
    __tablename__ = "telegram_history"
    id = Column(Integer, primary_key=True, autoincrement=True)
    direction = Column(String, nullable=False)  # 'inbound' | 'outbound'
    message = Column(String, nullable=False)
    intent = Column(String, nullable=True)
    exec_ms = Column(Integer, nullable=True)
    executed_at = Column(DateTime, default=datetime.datetime.utcnow)

class ScanHistory(Base):
    __tablename__ = "scan_history"
    id = Column(Integer, primary_key=True, autoincrement=True)
    repos_scanned = Column(Integer, nullable=True)
    deps_found = Column(Integer, nullable=True)
    new_deps = Column(Integer, nullable=True)
    removed_deps = Column(Integer, nullable=True)
    new_alerts = Column(Integer, nullable=True)
    duration_sec = Column(Float, nullable=True)
    triggered_by = Column(String, nullable=True)
    scanned_at = Column(DateTime, default=datetime.datetime.utcnow)
