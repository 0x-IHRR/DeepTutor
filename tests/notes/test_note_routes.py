import json
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from deeptutor.api.routers import co_writer
from deeptutor.capabilities.notes.capability import NotesCapability
from deeptutor.capabilities.notes.tools import NoteReadTool, NoteSuggestTool
from deeptutor.co_writer.storage import CoWriterStorage
from deeptutor.notes.review import due_cards, grade_card
from tests.notes.test_block_pages import Paths, block


@pytest.fixture
def storage(tmp_path):
    return CoWriterStorage(Paths(tmp_path))


@pytest.fixture
def client(storage, monkeypatch):
    monkeypatch.setattr(co_writer, "get_co_writer_storage", lambda: storage)
    app = FastAPI()
    app.include_router(co_writer.router, prefix="/api")
    return TestClient(app)


def test_invalid_blocks_and_parent_are_client_errors(client):
    assert client.post("/api/documents", json={"parent_id": "aaaaaaaa"}).status_code == 400
    assert (
        client.post("/api/documents", json={"blocks": [{"type": "paragraph"}]}).status_code == 400
    )
    bad = {**block(), "type": "heading", "props": {"level": "bad"}}
    assert client.post("/api/documents", json={"blocks": [bad]}).status_code == 400
    bad = {**block(), "content": [{"type": "link", "href": "javascript:alert(1)", "content": []}]}
    assert client.post("/api/documents", json={"blocks": [bad]}).status_code == 400


def test_atomic_review_and_stale_editor_api(client):
    page = client.post("/api/documents", json={"blocks": [block()]}).json()
    root = "/api/documents/" + page["id"]
    suggestion = client.post(
        root + "/suggestions", json={"operation": "replace", "block_id": "a", "markdown": "changed"}
    ).json()
    accepted = client.post(
        root + "/suggestions/" + suggestion["id"],
        json={"accept": True, "blocks": [block(text="changed")]},
    )
    assert accepted.status_code == 200
    assert accepted.json()["content"] == "changed"
    assert client.put(root, json={"blocks": [block()], "expected_revision": 0}).status_code == 409
    assert client.get(root).json()["content"] == "changed"
    assert (
        client.post(
            root + "/clips",
            json={"title": "Original", "markdown": "source", "source_url": "/chat/test"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            root + "/clips",
            json={"title": "Original", "markdown": "source", "source_url": "javascript:alert(1)"},
        ).status_code
        == 400
    )


def test_assets_are_scoped_and_cannot_escape(client, storage):
    page = storage.create_document(blocks=[block()])
    other = storage.create_document(blocks=[block()])
    response = client.post(
        f"/api/documents/{page.id}/assets", files={"file": ("x.png", b"png-data", "image/png")}
    )
    assert response.status_code == 200
    url = response.json()["url"]
    assert client.get(url).content == b"png-data"
    assert client.get(url.replace(page.id, other.id)).status_code == 404
    assert (
        client.post(
            f"/api/documents/{page.id}/assets", files={"file": ("x.html", "<script/>", "text/html")}
        ).status_code
        == 400
    )


def test_flashcard_schedule_follows_content_and_rejects_unknown_cards(storage):
    cards = [{"front": "Frequency?", "back": "Cycles per second"}]
    page = storage.create_document(
        blocks=[
            {
                "id": "flash",
                "type": "learning",
                "props": {"kind": "flashcards", "data": json.dumps({"cards": cards})},
            }
        ]
    )
    due = due_cards(storage)
    assert len(due) == 1
    grade_card(storage, page.id, due[0]["card_id"], True)
    assert not due_cards(storage)
    with pytest.raises(ValueError):
        grade_card(storage, page.id, "invented", True)
    cards[0]["front"] = "A changed question"
    blocks = page.blocks
    blocks[0]["props"]["data"] = json.dumps({"cards": cards})
    storage.update_document(page.id, blocks=blocks, expected_revision=0)
    assert len(due_cards(storage)) == 1


@pytest.mark.asyncio
async def test_note_tools_are_server_bound_and_do_not_write_body(storage, monkeypatch):
    import deeptutor.capabilities.notes.tools as tools

    monkeypatch.setattr(tools, "get_co_writer_storage", lambda: storage)
    page = storage.create_document(blocks=[block()])
    other = storage.create_document(blocks=[block(text="Other")])
    extension = NotesCapability()
    context = SimpleNamespace(metadata={"note_document_id": page.id})
    kwargs = extension.augment_kwargs("note_read", {"_note_document_id": other.id}, context)
    read = await NoteReadTool().execute(**kwargs)
    assert json.loads(read.content)["id"] == page.id
    suggested = await NoteSuggestTool().execute(
        operation="replace", block_id="a", markdown="Proposed", **kwargs
    )
    assert suggested.success
    assert storage.load_document(page.id).content == "Hello"
    assert not (await NoteReadTool().execute()).success


@pytest.mark.asyncio
async def test_model_cannot_overwrite_typing_between_read_and_suggestion(storage, monkeypatch):
    import deeptutor.capabilities.notes.tools as tools

    monkeypatch.setattr(tools, "get_co_writer_storage", lambda: storage)
    page = storage.create_document(blocks=[block()])
    context = SimpleNamespace(metadata={"note_document_id": page.id})
    extension = NotesCapability()
    await NoteReadTool().execute(**extension.augment_kwargs("note_read", {}, context))
    storage.update_document(
        page.id, blocks=[block(text="User typed while model was thinking")], expected_revision=0
    )
    result = await NoteSuggestTool().execute(
        **extension.augment_kwargs(
            "note_suggest",
            {"operation": "replace", "block_id": "a", "markdown": "Stale rewrite"},
            context,
        )
    )
    assert not result.success and "changed after it was read" in result.content
    assert storage.load_document(page.id).content == "User typed while model was thinking"


def test_generated_result_cannot_capture_a_newer_block(client):
    original = block()
    page = client.post("/api/documents", json={"blocks": [original]}).json()
    root = "/api/documents/" + page["id"]
    assert (
        client.put(
            root, json={"blocks": [block(text="User edit")], "expected_revision": 0}
        ).status_code
        == 200
    )
    response = client.post(
        root + "/suggestions",
        json={
            "operation": "replace",
            "block_id": "a",
            "expected_original": original,
            "markdown": "Generated answer",
        },
    )
    assert response.status_code == 409
    assert client.get(root).json()["content"] == "User edit"
    assert client.get(root + "/suggestions").json()["suggestions"] == []


def test_multiple_inline_reviews_survive_editor_normalization(client):
    first, second = block("a"), block("b", "Second")
    page = client.post("/api/documents", json={"blocks": [first, second]}).json()
    root = "/api/documents/" + page["id"]
    replace = client.post(
        root + "/suggestions", json={"operation": "replace", "block_id": "a", "markdown": "Revised"}
    ).json()
    insert = client.post(
        root + "/suggestions", json={"operation": "insert", "block_id": "b", "markdown": "Added"}
    ).json()
    accepted = client.post(
        root + "/suggestions/" + replace["id"],
        json={"accept": True, "blocks": [block("a", "Revised")]},
    ).json()
    normalized = accepted["blocks"]
    for item in normalized:
        item["props"] = {
            "textColor": "default",
            "backgroundColor": "default",
            "textAlignment": "left",
        }
    assert (
        client.put(
            root, json={"blocks": normalized, "expected_revision": accepted["revision"]}
        ).status_code
        == 200
    )
    result = client.post(
        root + "/suggestions/" + insert["id"],
        json={"accept": True, "blocks": [block("c", "Added")]},
    )
    assert result.status_code == 200
    assert [b["id"] for b in result.json()["blocks"]] == ["a", "b", "c"]


def test_replayed_generation_does_not_duplicate_or_reapply_a_review(client):
    page = client.post("/api/documents", json={"blocks": [block()]}).json()
    root = "/api/documents/" + page["id"]
    request = {
        "operation": "replace",
        "block_id": "a",
        "markdown": "Generated",
        "source_turn_id": "turn-test",
    }
    first = client.post(root + "/suggestions", json=request).json()
    second = client.post(root + "/suggestions", json=request).json()
    assert first["id"] == second["id"]
    client.post(
        root + "/suggestions/" + first["id"],
        json={"accept": True, "blocks": [block("new", "Accepted")]},
    )
    replay = client.post(root + "/suggestions", json=request)
    assert replay.status_code == 200
    assert replay.json()["status"] == "accepted"
    assert len(client.get(root + "/suggestions").json()["suggestions"]) == 1
    assert client.get(root).json()["content"] == "Accepted"
