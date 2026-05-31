from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# Setup Schemas
class GitHubSetupRequest(BaseModel):
    username: str
    token: str

class GitHubSelectReposRequest(BaseModel):
    selected_repos: List[str]


class TelegramSetupRequest(BaseModel):
    token: str
    chat_id: str

class GeminiSetupRequest(BaseModel):
    api_key: str

# Ask Schema
class AskRequest(BaseModel):
    question: str

class AskResponse(BaseModel):
    answer: str
    query_used: str
    execution_ms: int
    cache_status: str
    fallback_used: bool

# Telegram Send Message
class TelegramSendRequest(BaseModel):
    message: str

# Database ORM-based responses (optional helper schemas)
class RepositoryResponse(BaseModel):
    id: int
    name: str
    language: Optional[str] = None
    stars: int
    open_issues: int
    pushed_at: Optional[datetime] = None
    is_fork: bool
    has_npm: bool
    has_pypi: bool
    has_cargo: bool
    last_scanned: datetime

    class Config:
        from_attributes = True

class DependencyResponse(BaseModel):
    id: int
    repo: str
    ecosystem: str
    package: str
    version: Optional[str] = None
    scanned_at: datetime

    class Config:
        from_attributes = True
