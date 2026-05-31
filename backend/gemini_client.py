import os
import json
from google import genai
from google.genai import types

SUMMARY_SYSTEM_PROMPT = """
You are Rakshak, a dependency health assistant.
You receive a JSON array of query results and summarize them for the user.

Rules:
- Be direct and actionable. Lead with the single most important finding.
- End with exactly one concrete next step.
- Never say "Based on the data" or "It appears that" or "According to".
- For Telegram: use Telegram markdown (*bold*, _italic_), emojis 🔴🟡🟢, max 200 words.
- For dashboard: plain text, bullet points OK, no markdown symbols.
- If results are empty, explain why there are no results based on the query name and user question (e.g. no security alerts found for that specific package).
"""

class GeminiClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        # Use dummy client if api_key is dummy to avoid crash during setup
        if not api_key or api_key == "dummy_gemini_key":
            self.client = None
        else:
            self.client = genai.Client(api_key=api_key)
        self.model = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")

    def summarize(self, result_json: list, channel: str = "dashboard", question: str = None, query_name: str = None) -> str:
        """Summarize a Coral query result in plain language."""
        if not self.client:
            # Fallback mock summary for dev/testing when no key is set
            return (
                "Mock Summary: 🔴 Found 3 outdated dependencies (jsonwebtoken, lodash, semver). "
                "jsonwebtoken has a Critical CVSS 9.8 vulnerability. "
                "Recommendation: Upgrade jsonwebtoken immediately to version 9.0.0."
            )

        prompt = f"Channel: {channel}\n"
        if question:
            prompt += f"User Question: {question}\n"
        if query_name:
            prompt += f"Query Script: {query_name}.sql\n"
        prompt += f"\nQuery result:\n{json.dumps(result_json[:30], indent=2)}\n\nSummarize this for the user."
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SUMMARY_SYSTEM_PROMPT,
                    temperature=0.2,
                    max_output_tokens=500,
                )
            )
            return response.text.strip()
        except Exception as e:
            return f"Summary unavailable ({e})"
