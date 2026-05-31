KEYWORD_QUERY_MAP = {
    # Risk-related keywords
    "risk": "unified_risk",
    "risky": "unified_risk",
    "worst": "unified_risk",
    "outdated": "unified_risk",
    "stale": "unified_risk",
    
    # Vulnerability/Security keywords
    "security": "osv_vulns",
    "vuln": "osv_vulns",
    "cve": "osv_vulns",
    "advisory": "osv_vulns",
    "exploit": "osv_vulns",
    "hn": "hn_security",
    "hack": "hn_security",
    
    # Package ecosystem keywords
    "npm": "deps_dev_health",
    "node": "deps_dev_health",
    "pypi": "deps_dev_health",
    "python": "deps_dev_health",
    "cargo": "crates_health",
    "rust": "crates_health",
    
    # Guide keywords
    "guide": "devto_guides",
    "upgrade": "devto_guides",
    "migrate": "devto_guides",
}

def route_question(question: str) -> str:
    """Map a free-text question to a pre-written query name."""
    q = question.lower()
    for keyword, query_name in KEYWORD_QUERY_MAP.items():
        if keyword in q:
            return query_name
    return "unified_risk"  # default safe fallback
