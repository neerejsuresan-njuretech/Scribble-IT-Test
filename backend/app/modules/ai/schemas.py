from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictAiModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --- 1. Incident Triage ---
class IncidentTriageRequest(StrictAiModel):
    id: str | None = Field(default=None, max_length=128)
    title: str = Field(min_length=2, max_length=300)
    description: str = Field(default="", max_length=8000)
    category: str | None = Field(default=None, max_length=64)
    priority: str | None = Field(default=None, max_length=16)
    affectedCI: str | None = Field(default=None, max_length=160)
    recentActivity: list[str] = Field(default_factory=list, max_length=20)
    availableQueues: list[str] = Field(default_factory=list, max_length=30)


class IncidentTriageResponse(BaseModel):
    recommendedPriority: Literal["P1", "P2", "P3", "P4"]
    recommendedCategory: Literal["hardware", "software", "network", "access", "security", "telephony"]
    suggestedQueue: str
    rootCauseHypothesis: str
    diagnosticSteps: list[str]
    draftResolutionNote: str
    draftCustomerReply: str
    advisoryOnly: bool = True
    requiresHumanApproval: bool = True
    model: str
    generatedAt: str


# --- 2. Real-Time Incident Triage Assistant ---
class TriageAssistantKbCandidate(StrictAiModel):
    id: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=240)
    category: str = Field(default="Operations", max_length=80)
    tags: list[str] = Field(default_factory=list, max_length=15)
    excerpt: str = Field(default="", max_length=600)


class TriageAssistantRequest(StrictAiModel):
    id: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=2, max_length=300)
    description: str = Field(default="", max_length=8000)
    priority: str = Field(default="P3", max_length=16)
    status: str = Field(default="new", max_length=32)
    category: str = Field(default="software", max_length=64)
    assignmentGroup: str | None = Field(default=None, max_length=160)
    affectedCI: str | None = Field(default=None, max_length=160)
    slaDeadline: str | None = Field(default=None, max_length=64)
    recentActivity: list[str] = Field(default_factory=list, max_length=20)
    kbArticles: list[TriageAssistantKbCandidate] = Field(default_factory=list, max_length=30)


class MatchedKbSuggestionOut(BaseModel):
    kbId: str
    title: str
    relevanceReason: str
    matchConfidence: Literal["high", "medium", "low"]


class SuggestedNewKbTopicOut(BaseModel):
    title: str
    category: str
    summary: str
    draftBody: str


class TriageAssistantResponse(BaseModel):
    realTimeSummary: str
    urgencySignal: Literal["critical", "elevated", "normal"]
    slaAssessment: str
    recommendedPriority: Literal["P1", "P2", "P3", "P4"]
    recommendedCategory: Literal["hardware", "software", "network", "access", "security", "telephony"]
    suggestedQueue: str
    rootCauseHypothesis: str
    nextSteps: list[str]
    matchedKbArticles: list[MatchedKbSuggestionOut]
    suggestedNewKbTopics: list[SuggestedNewKbTopicOut]
    draftResolutionNote: str
    draftCustomerReply: str
    advisoryOnly: bool = True
    requiresHumanApproval: bool = True
    model: str
    generatedAt: str


# --- 3. Change / CAB Risk Assessment ---
class ChangeAssessRequest(StrictAiModel):
    id: str | None = Field(default=None, max_length=128)
    title: str = Field(min_length=2, max_length=300)
    type: str = Field(default="normal", max_length=32)
    reason: str = Field(default="", max_length=4000)
    implementationPlan: str = Field(default="", max_length=6000)
    rollbackPlan: str = Field(default="", max_length=6000)
    testPlan: str = Field(default="", max_length=6000)


class ChangeAssessResponse(BaseModel):
    assessedRisk: Literal["low", "medium", "high", "critical"]
    readinessScore: int
    riskFindings: list[str]
    missingControls: list[str]
    recommendedCabGuidance: str
    advisoryOnly: bool = True
    requiresHumanApproval: bool = True
    model: str
    generatedAt: str


# --- 4. Knowledge Article Generation ---
class DraftKbRequest(StrictAiModel):
    topic: str = Field(min_length=2, max_length=300)
    category: str | None = Field(default="Operations", max_length=80)
    sourceIncidentTitle: str | None = Field(default=None, max_length=300)
    sourceIncidentDescription: str | None = Field(default=None, max_length=4000)
    sourceResolution: str | None = Field(default=None, max_length=4000)


class DraftKbResponse(BaseModel):
    title: str
    category: str
    tags: list[str]
    content: str
    advisoryOnly: bool = True
    requiresHumanApproval: bool = True
    model: str
    generatedAt: str


# --- 5. Wiki Assistance ---
class WikiAssistRequest(StrictAiModel):
    query: str = Field(min_length=2, max_length=500)
    mode: Literal["documentation_update", "industry_news", "page_refresh"] = "documentation_update"
    existingTitle: str | None = Field(default=None, max_length=240)
    existingSection: str | None = Field(default=None, max_length=120)
    existingContent: str | None = Field(default=None, max_length=8000)


class GroundingSourceOut(BaseModel):
    title: str
    uri: str


class WikiAssistResponse(BaseModel):
    summary: str
    sources: list[GroundingSourceOut]
    searchQueries: list[str]
    advisoryOnly: bool = True
    requiresHumanApproval: bool = True
    model: str
    generatedAt: str


# --- 6. ITSM Operations Copilot ---
class CopilotTurnMessageIn(StrictAiModel):
    role: Literal["user", "model"]
    text: str = Field(min_length=1, max_length=4000)


class CopilotRequest(StrictAiModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[CopilotTurnMessageIn] = Field(default_factory=list, max_length=12)
    tenantContext: str = Field(default="", max_length=10000)


class CopilotResponse(BaseModel):
    reply: str
    advisoryOnly: bool = True
    requiresHumanApproval: bool = True
    model: str
    generatedAt: str


# --- 7. AI Usage & Audit Reporting ---
class AiInteractionLogOut(BaseModel):
    id: uuid.UUID
    actor_email: str
    action_type: str
    model_name: str
    target_entity_type: str | None
    target_entity_id: str | None
    prompt_chars: int
    response_chars: int
    latency_ms: int
    status: str
    requires_human_approval: bool
    advisory_summary: str
    created_at: datetime


class AiUsageSummaryOut(BaseModel):
    organization_id: uuid.UUID
    daily_limit: int
    used_today: int
    remaining_today: int
    rate_limit_per_minute: int
    model: str
    recent_logs: list[AiInteractionLogOut]
