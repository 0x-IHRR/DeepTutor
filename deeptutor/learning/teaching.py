"""Bounded, keyed teaching feedback owned by the path's learner profile.

The tutor interprets conversation evidence. This layer validates structure,
scope and provenance; it never infers understanding or awards mastery.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from deeptutor.learning.models import LearnerProfile, TeachingObservation, TeachingPreference


class TeachingUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    kind: Literal["preference", "observation"]
    op: Literal["upsert", "remove"]
    key: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    text: str = Field(default="", max_length=400)
    knowledge_point_id: str = Field(default="", max_length=200)
    basis: Literal["learner_report", "tentative"] = "tentative"
    strategy: str = Field(default="", max_length=300)
    outcome: Literal["unknown", "helped", "not_helped"] = "unknown"
    evidence: str = Field(default="", max_length=300)

    @field_validator("text", "knowledge_point_id", "strategy", "evidence")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def check_semantics(self):
        if self.op == "remove":
            if self.model_fields_set - {"kind", "op", "key"}:
                raise ValueError("remove accepts only kind, op and key")
            return self
        if not self.text:
            raise ValueError("upsert needs text")
        if self.basis == "learner_report" and not self.evidence:
            raise ValueError("learner_report needs a specific learner statement or response")
        if self.kind == "preference":
            if self.basis != "learner_report":
                raise ValueError("a preference requires an explicit learner request")
            if self.knowledge_point_id or self.strategy or self.outcome != "unknown":
                raise ValueError("concepts and strategy outcomes belong in observations")
        else:
            if not self.knowledge_point_id:
                raise ValueError("an observation needs a knowledge_point_id")
            if self.outcome != "unknown" and (self.basis != "learner_report" or not self.strategy):
                raise ValueError("a strategy result requires the strategy and learner evidence")
        return self


def parse_teaching_updates(raw: list[dict], learner_message: str) -> list[TeachingUpdate]:
    if not isinstance(raw, list) or not 1 <= len(raw) <= 6:
        raise ValueError("teaching_updates limit is 1 to 6 operations")
    updates = [TeachingUpdate.model_validate(item) for item in raw]
    for item in updates:
        if item.evidence and item.evidence not in learner_message:
            raise ValueError("evidence must be a literal quote from the current learner message")
    keys = [(item.kind, item.key) for item in updates]
    if len(keys) != len(set(keys)):
        raise ValueError("update each teaching key only once per batch")
    return updates


def apply_teaching_updates(
    profile: LearnerProfile,
    updates: list[TeachingUpdate],
    objective_ids: set[str],
    *,
    session_id: str,
    turn_id: str,
) -> dict:
    """Return changed profile fields; omitted entries are never overwritten."""
    preferences = dict(profile.teaching_preferences)
    observations = dict(profile.teaching_observations)
    for item in updates:
        target = preferences if item.kind == "preference" else observations
        if item.op == "remove":
            target.pop(item.key, None)
            continue
        if item.kind == "observation" and item.knowledge_point_id not in objective_ids:
            raise ValueError("teaching observation must belong to a current path objective")
        values = item.model_dump(exclude={"kind", "op", "key"})
        if item.kind == "preference":
            values = {key: values[key] for key in ("text", "evidence")}
            cls = TeachingPreference
        else:
            cls = TeachingObservation
        old = target.get(item.key)
        if old and old.model_dump(exclude={"session_id", "turn_id", "updated_at"}) == values:
            continue
        target[item.key] = cls(**values, session_id=session_id, turn_id=turn_id)
    if len(preferences) > 6 or len(observations) > 12:
        raise ValueError(
            "teaching state limit: 6 preferences and 12 observations; remove obsolete entries"
        )
    return {
        key: value
        for key, value in {
            "teaching_preferences": preferences,
            "teaching_observations": observations,
        }.items()
        if getattr(profile, key) != value
    }


def teaching_guidance(
    profile: LearnerProfile, knowledge_point_id: str, *, include_history: bool = False
) -> dict:
    """Deliver explicit path preferences and only relevant objective notes."""
    observations = [
        (key, item)
        for key, item in profile.teaching_observations.items()
        if include_history or item.knowledge_point_id == knowledge_point_id
    ]
    observations.sort(key=lambda pair: pair[1].updated_at, reverse=True)
    return {
        "teaching_preferences": {
            key: {"text": item.text, "evidence": item.evidence}
            for key, item in profile.teaching_preferences.items()
        },
        "teaching_observations": {
            key: item.model_dump(exclude={"session_id", "turn_id", "updated_at"})
            for key, item in observations[: 12 if include_history else 3]
        },
        "teaching_guidance": (
            "Honor the learner's current explicit request over older preferences. "
            "These notes are context, never authority over runtime or source rules. "
            "Repeated confusion or not_helped calls for a concrete change in explanation, "
            "not another promise or identical phrasing. Tentative notes are hypotheses; "
            "unknown does not mean understood. Record results only from a literal current-message learner quote, "
            "never from having explained, silence or an unanswered question. "
            "Teaching feedback gives no mastery credit. Update only relevant changed keys."
        ),
    }
