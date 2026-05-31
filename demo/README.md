# 🪸 Rakshak — Demo Manual & Safety Nets

Rakshak provides complete safety nets to ensure a flawless demo on hackathon day, even if external registry APIs are down or rate-limited.

## Quick Database Reset
To wipe the SQLite database and populate it with pre-validated mock data (representing a live scanned workspace with vulnerabilities, outdated packages, and developer guides), click the **Reset Demo DB** button in the sidebar footer of the dashboard, or call the endpoint directly:

```bash
curl -X DELETE http://localhost:8000/api/demo/reset
```

## Toggling Demo/Fallback Mode
You can toggle between **Live Coral Queries** and **Cached Mock Data** by:
1. Clicking the **Demo Fallback** button in the top right of the dashboard.
2. Editing `RAKSHAK_DEMO_FALLBACK` inside the `.env` file (1 = fallback enabled, 0 = live queries only).
3. Calling the POST toggle endpoint:
   ```bash
   curl -X POST http://localhost:8000/api/demo/toggle
   ```

When Fallback Mode is **Active**:
- Coral queries are bypassed (or run with local mock data).
- The dashboard will render a yellow `Demo Fallback Mode Active` banner indicating it is showing seed data.
- Natural language questions in the search bar (e.g. "show npm packages with vulnerabilities") will instantly resolve and show high-fidelity simulated summaries.

When Fallback Mode is **Disabled**:
- All query operations will call Coral via `wsl bash -ic "coral sql --format json '...'"` to fetch real-time values from `deps_dev`, `osv`, `devto`, and `hn` APIs.
