import os
import asyncio
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import Setting
from .manifest_scanner import ManifestScanner

scheduler = BackgroundScheduler()

def run_background_scan():
    """Triggered by APScheduler. Runs scanner inside a new event loop and db session."""
    db = SessionLocal()
    try:
        # Check settings
        username_setting = db.query(Setting).filter_by(key="github_username").first()
        token_setting = db.query(Setting).filter_by(key="github_token").first()
        
        if not username_setting or not username_setting.value:
            print("Background scan skipped: GitHub username not configured.")
            return

        username = username_setting.value
        token = token_setting.value if token_setting else ""
        
        print(f"Starting scheduled background dependency scan at {datetime.now()}...")
        scanner = ManifestScanner(username, token, db)
        
        # Run async function in sync background job
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(scanner.run_full_scan(triggered_by="scheduled"))
        loop.close()
        
        print(f"Scheduled scan completed: {result}")
    except Exception as e:
        print(f"Error during background scheduled scan: {e}")
    finally:
        db.close()

def start_scheduler():
    """Start the APScheduler background thread."""
    if not scheduler.running:
        db = SessionLocal()
        interval_hours = 24
        try:
            interval_setting = db.query(Setting).filter_by(key="auto_scan_interval_hours").first()
            if interval_setting and interval_setting.value:
                interval_hours = int(interval_setting.value)
        except Exception:
            pass
        finally:
            db.close()
            
        scheduler.add_job(
            run_background_scan,
            'interval',
            hours=interval_hours,
            id='github_rescan',
            replace_existing=True
        )
        scheduler.start()
        print(f"APScheduler started: Scanning every {interval_hours} hours.")

def update_scheduler_interval(hours: int):
    """Dynamically update scan interval settings."""
    if scheduler.running:
        scheduler.reschedule_job(
            'github_rescan',
            trigger='interval',
            hours=hours
        )
        print(f"APScheduler interval updated to {hours} hours.")
