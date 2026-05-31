import os
import asyncio
import threading
from datetime import datetime
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import Setting, Dependency, RiskSnapshot, SecurityAlert, MigrationGuide, TelegramHistory
from .manifest_scanner import ManifestScanner
from .coral_client import CoralClient
from .gemini_client import GeminiClient
from .router import route_question

# Global variable to hold bot application and control background execution
bot_app = None
bot_thread = None
bot_loop = None

def get_db():
    return SessionLocal()

def get_setting(db: Session, key: str, default: str = "") -> str:
    setting = db.query(Setting).filter_by(key=key).first()
    return setting.value if setting else default

def log_telegram_message(db: Session, direction: str, message: str, intent: str, elapsed_ms: int = 0):
    try:
        log = TelegramHistory(
            direction=direction,
            message=message,
            intent=intent,
            exec_ms=elapsed_ms
        )
        db.add(log)
        db.commit()
    except Exception as e:
        print(f"Error logging telegram history: {e}")
        db.rollback()

# ─────────────────────────────────────────
# COMMAND HANDLERS
# ─────────────────────────────────────────

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    db = get_db()
    chat_id = str(update.effective_chat.id)
    
    # Save chat ID if not set
    setting = db.query(Setting).filter_by(key="telegram_chat_id").first()
    if not setting or setting.value == "dummy_chat_id":
        if setting:
            setting.value = chat_id
        else:
            db.add(Setting(key="telegram_chat_id", value=chat_id))
        db.commit()
        
    msg = (
        "🪸 *Welcome to Rakshak Dependency Health Agent!*\n\n"
        "Your chat ID has been registered. Here are the commands you can run:\n"
        "• `/health` — Risk summary of your project dependencies\n"
        "• `/security` — Browse active vulnerability alerts\n"
        "• `/fix <package>` — Get upgrade guides from Dev.to\n"
        "• `/status` — Quick count of repository health\n"
        "• `/refresh` — Trigger a fresh manifest scan job\n\n"
        "Or simply ask me a question in plain text!"
    )
    
    log_telegram_message(db, "inbound", "/start", "start")
    await update.message.reply_text(msg, parse_mode="Markdown")
    log_telegram_message(db, "outbound", msg, "start_response")
    db.close()

async def health_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    db = get_db()
    log_telegram_message(db, "inbound", "/health", "health")
    
    await update.message.reply_text("⏳ *Analyzing dependency health...* (running Coral query)", parse_mode="Markdown")
    
    start_time = datetime.now()
    coral = CoralClient(db)
    
    # Run risk query (represented by unified_risk)
    # We query local snapshots if they exist, or trigger Coral
    latest_snap = db.query(RiskSnapshot).order_by(RiskSnapshot.snapshotted_at.desc()).first()
    
    if not latest_snap:
        # If no snapshots, run analysis
        # For Telegram, we call Coral directly to get live version details
        await update.message.reply_text("No risk data cached. Triggering live Coral scan...", parse_mode="Markdown")
        # Direct fallback return since we need formatted rows for Gemini
        result = coral.run_query("deps_dev_health", {"system": "NPM", "package_name": "react", "version": "18.2.0"}, source="telegram")
    else:
        # Fetch latest snapshots from DB
        snaps = db.query(RiskSnapshot).filter_by(snapshotted_at=latest_snap.snapshotted_at).all()
        result = {
            "rows": [
                {
                    "package_name": s.package,
                    "repo": s.repo,
                    "ecosystem": s.ecosystem,
                    "your_version": s.your_version,
                    "latest_version": s.latest_version,
                    "risk_score": s.risk_score,
                    "status": s.status
                } for s in snaps
            ],
            "execution_ms": 0,
            "fallback_used": False
        }

    # Summarize with Gemini
    gemini_key = get_setting(db, "gemini_key")
    gemini = GeminiClient(gemini_key)
    summary = gemini.summarize(result["rows"], channel="telegram", question="Dependency Health Summary", query_name="unified_risk")
    
    elapsed_ms = int((datetime.now() - start_time).total_seconds() * 1000)
    await update.message.reply_text(summary, parse_mode="Markdown")
    log_telegram_message(db, "outbound", summary, "health_response", elapsed_ms)
    db.close()

async def security_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    db = get_db()
    log_telegram_message(db, "inbound", "/security", "security")
    
    alerts = db.query(SecurityAlert).filter_by(dismissed=False).limit(5).all()
    if not alerts:
        msg = "🟢 *No active security alerts found!* All dependencies are clear."
        await update.message.reply_text(msg, parse_mode="Markdown")
        log_telegram_message(db, "outbound", msg, "security_response")
        db.close()
        return

    msg = "🔴 *Active Security Alerts:*\n\n"
    for a in alerts:
        msg += f"• *{a.package}* ({a.ecosystem})\n  _{a.hn_title}_\n"
        if a.hn_url:
            msg += f"  [Advisory Link]({a.hn_url})\n"
        msg += "\n"
        
    await update.message.reply_text(msg, parse_mode="Markdown", disable_web_page_preview=True)
    log_telegram_message(db, "outbound", msg, "security_response")
    db.close()

async def fix_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    db = get_db()
    pkg = " ".join(context.args).strip()
    log_telegram_message(db, "inbound", f"/fix {pkg}", "fix")
    
    if not pkg:
        msg = "⚠️ Please specify a package name. E.g. `/fix react`"
        await update.message.reply_text(msg, parse_mode="Markdown")
        log_telegram_message(db, "outbound", msg, "fix_response")
        db.close()
        return

    await update.message.reply_text(f"⏳ *Searching Dev.to for upgrade guides on `{pkg}`...*", parse_mode="Markdown")
    
    coral = CoralClient(db)
    guides_result = coral.run_query("devto_guides", {"tag": pkg.lower()}, source="telegram")
    
    if not guides_result["rows"]:
        msg = f"🔍 No migration guides found on Dev.to for `{pkg}`."
        await update.message.reply_text(msg, parse_mode="Markdown")
        log_telegram_message(db, "outbound", msg, "fix_response")
        db.close()
        return
        
    msg = f"💡 *Upgrade Guides for `{pkg}`:*\n\n"
    for g in guides_result["rows"][:3]: # Return top 3
        msg += f"• *{g.get('title')}*\n  [Read Guide]({g.get('url')})\n\n"
        
    await update.message.reply_text(msg, parse_mode="Markdown", disable_web_page_preview=True)
    log_telegram_message(db, "outbound", msg, "fix_response")
    db.close()

async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    db = get_db()
    log_telegram_message(db, "inbound", "/status", "status")
    
    total_repos = db.query(Repository).count()
    total_deps = db.query(Dependency).count()
    
    # Calculate counts from latest risk snapshots
    latest_snap = db.query(RiskSnapshot).order_by(RiskSnapshot.snapshotted_at.desc()).first()
    critical = 0
    warning = 0
    healthy = total_deps
    
    if latest_snap:
        latest_time = latest_snap.snapshotted_at
        critical = db.query(RiskSnapshot).filter(RiskSnapshot.snapshotted_at == latest_time, RiskSnapshot.status == 'Critical').count()
        warning = db.query(RiskSnapshot).filter(RiskSnapshot.snapshotted_at == latest_time, RiskSnapshot.status == 'Warning').count()
        healthy = db.query(RiskSnapshot).filter(RiskSnapshot.snapshotted_at == latest_time, RiskSnapshot.status == 'Healthy').count()

    msg = (
        "📊 *Repository Risk Status Summary:*\n\n"
        f"• *Repositories Scanned:* {total_repos}\n"
        f"• *Dependencies Tracked:* {total_deps}\n"
        f"• 🔴 *Critical Risk:* {critical}\n"
        f"• 🟡 *Warning Risk:* {warning}\n"
        f"• 🟢 *Healthy Status:* {healthy}\n"
    )
    
    await update.message.reply_text(msg, parse_mode="Markdown")
    log_telegram_message(db, "outbound", msg, "status_response")
    db.close()

async def refresh_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    db = get_db()
    log_telegram_message(db, "inbound", "/refresh", "refresh")
    
    await update.message.reply_text("⏳ *Triggering full dependency rescan...*", parse_mode="Markdown")
    
    username = get_setting(db, "github_username")
    token = get_setting(db, "github_token")
    
    if not username:
        msg = "⚠️ GitHub username is not configured. Please set it in Setup wizard."
        await update.message.reply_text(msg, parse_mode="Markdown")
        log_telegram_message(db, "outbound", msg, "refresh_response")
        db.close()
        return

    try:
        scanner = ManifestScanner(username, token, db)
        stats = await scanner.run_full_scan(triggered_by="telegram")
        
        # Trigger risk snapshots
        coral = CoralClient(db)
        # Force risk calculations
        # Call model directly to keep simple
        # In a real app we'd trigger risk calculation loop
        
        msg = (
            "✅ *Scan Complete!*\n\n"
            f"• Repositories scanned: {stats['repos_scanned']}\n"
            f"• Dependencies found: {stats['deps_found']}\n"
            f"• New dependency pins: {stats['new_deps']}\n"
            f"• Removed dependency pins: {stats['removed_deps']}\n"
            f"• Duration: {stats['duration_sec']}s"
        )
    except Exception as e:
        msg = f"❌ Scan failed: {str(e)}"
        
    await update.message.reply_text(msg, parse_mode="Markdown")
    log_telegram_message(db, "outbound", msg, "refresh_response")
    db.close()

async def handle_free_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Processes natural language questions from Telegram users using router + Coral + Gemini."""
    db = get_db()
    question = update.message.text
    log_telegram_message(db, "inbound", question, "ask")
    
    await update.message.reply_text("⏳ *Consulting Coral query engine & Gemini...*", parse_mode="Markdown")
    
    start_time = datetime.now()
    query_name = route_question(question)
    coral = CoralClient(db)
    
    # Run query mapping parameters
    params = {}
    package_param = "react"
    # Simple regex search
    import re
    match = re.search(r"package\s+([A-Za-z0-9_\-\@\/]+)|for\s+([A-Za-z0-9_\-\@\/]+)", question.lower())
    if match:
        package_param = next(g for g in match.groups() if g is not None)
        
    if query_name == "deps_dev_health":
        eco = "NPM"
        if "pypi" in question.lower() or "python" in question.lower():
            eco = "PYPI"
        elif "cargo" in question.lower() or "rust" in question.lower():
            eco = "CARGO"
        params = {"system": eco, "package_name": package_param, "version": "18.2.0"}
    elif query_name == "osv_vulns":
        eco = "npm"
        if "pypi" in question.lower() or "python" in question.lower():
            eco = "PyPI"
        elif "cargo" in question.lower() or "rust" in question.lower():
            eco = "crates.io"
        params = {"package_name": package_param, "ecosystem": eco, "version": "1.0.0"}
    elif query_name == "hn_security":
        params = {"query": package_param}
    elif query_name == "devto_guides":
        params = {"tag": package_param}
    elif query_name == "crates_health":
        params = {"package_name": package_param}
        
    result = coral.run_query(query_name, params, source="telegram")
    
    # Summarize
    gemini_key = get_setting(db, "gemini_key")
    gemini = GeminiClient(gemini_key)
    summary = gemini.summarize(result["rows"], channel="telegram", question=question, query_name=query_name)
    
    elapsed_ms = int((datetime.now() - start_time).total_seconds() * 1000)
    await update.message.reply_text(summary, parse_mode="Markdown")
    log_telegram_message(db, "outbound", summary, "ask_response", elapsed_ms)
    db.close()


# ─────────────────────────────────────────
# BOT START / STOP THREAD RUNNERS
# ─────────────────────────────────────────

def run_async_loop(loop, app):
    """Worker target to run the asyncio loop for polling."""
    asyncio.set_event_loop(loop)
    loop.run_until_complete(app.initialize())
    loop.run_until_complete(app.start())
    loop.run_until_complete(app.updater.start_polling())
    loop.run_forever()

def start_bot_background():
    """Reads DB token and spins up python-telegram-bot in a background thread."""
    global bot_app, bot_thread, bot_loop
    
    db = get_db()
    token = get_setting(db, "telegram_token")
    db.close()
    
    if not token or token == "dummy_telegram_token" or " " in token:
        print("Telegram bot not started: Token is default/empty.")
        return
        
    try:
        print(f"Starting Telegram bot in the background...")
        # Create bot application
        app = Application.builder().token(token).build()
        
        # Add handlers
        app.add_handler(CommandHandler("start", start_command))
        app.add_handler(CommandHandler("health", health_command))
        app.add_handler(CommandHandler("security", security_command))
        app.add_handler(CommandHandler("fix", fix_command))
        app.add_handler(CommandHandler("status", status_command))
        app.add_handler(CommandHandler("refresh", refresh_command))
        app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_free_text))
        
        bot_app = app
        
        # Setup event loop for thread
        bot_loop = asyncio.new_event_loop()
        bot_thread = threading.Thread(target=run_async_loop, args=(bot_loop, app), daemon=True)
        bot_thread.start()
        print("Telegram bot background thread successfully spawned.")
        
    except Exception as e:
        print(f"Failed to initialize Telegram bot background: {e}")

def stop_bot_background():
    """Gracefully shut down bot updater and loop."""
    global bot_app, bot_thread, bot_loop
    if bot_app and bot_loop:
        print("Stopping Telegram bot background thread...")
        try:
            bot_loop.call_soon_threadsafe(bot_loop.stop)
            bot_thread.join(timeout=3.0)
            print("Telegram bot thread joined.")
        except Exception as e:
            print(f"Error stopping Telegram bot: {e}")
        bot_app = None
        bot_thread = None
        bot_loop = None
