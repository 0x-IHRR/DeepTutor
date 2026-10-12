"""Exact outline preview differences, independent of model summaries."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from deeptutor.learning.models import LearningProgress


def state_digest(progress: LearningProgress) -> str:
    state = progress.model_dump(mode="json", exclude={"version", "updated_at"})
    return hashlib.sha256(
        json.dumps(state, ensure_ascii=False, sort_keys=True, allow_nan=False).encode("utf-8")
    ).hexdigest()


def exact_diff(before: Any, after: Any, path: str = "") -> list[dict[str, Any]]:
    """JSON-pointer changes with exact old/new values, including additions/removals."""
    if isinstance(before, dict) and isinstance(after, dict):
        changes = []
        for key in sorted(before.keys() | after.keys()):
            pointer = path + "/" + str(key).replace("~", "~0").replace("/", "~1")
            if key in before and key in after:
                changes.extend(exact_diff(before[key], after[key], pointer))
            else:
                changes.append(
                    {
                        "path": pointer,
                        "before_exists": key in before,
                        "after_exists": key in after,
                        "before": before.get(key),
                        "after": after.get(key),
                    }
                )
        return changes
    if isinstance(before, list) and isinstance(after, list) and len(before) == len(after):
        return [
            change
            for i, (a, b) in enumerate(zip(before, after))
            for change in exact_diff(a, b, f"{path}/{i}")
        ]
    if type(before) is type(after) and before == after:
        return []
    return [
        {
            "path": path,
            "before_exists": True,
            "after_exists": True,
            "before": before,
            "after": after,
        }
    ]
