---
title: Editor Collaboration (Yjs + Comments + Diagnostics)
scope: workspace
tags: [editor, yjs, collaboration, comments, diagnostics, svelte]
---

Purpose
-------
Provide a reusable skill that documents how the repository's in-browser editor implements real-time collaboration, comment threads, diagnostics, and focused-file state. The skill is intended for agent use (triage, automation, remediation recipes, and guided troubleshooting) and is scoped to this workspace.

When to invoke
--------------
- Triage editor collaboration bugs (cursor drift, lost comments, sync failures).
- Add small fixes or diagnostics (retry logic, visibility fixes, comment deletion handlers).
- Automate checks and test prompts that reproduce editor-state problems.

Prerequisites
-------------
- Familiarity with Svelte 5 Runes patterns (`$state`, `$derived`, `$effect`).
- Basic Yjs concepts: `Y.Doc`, `Y.Text`, `RelativePosition` and `awareness`.
- CodeMirror 6 extensions and decorations.

Primary files and responsibilities
----------------------------------
- `routes.bak/(app)/editor/[projectId]/+page.svelte` — main editor orchestrator (yjs setup, sync connectors, state).
- `lib/yjs.ts` — Yjs Doc & provider lifecycle, IndexedDB persistence helpers.
- `lib/projectSync.ts` — project/file/asset websocket sync (non-Yjs metadata changes).
- `lib/commentSync.ts` — websocket notifications for comment thread/reply events.
- `lib/codemirror/comments.ts` — `CommentRangeTracker` + CodeMirror decorations and comment binding.
- `lib/services/api.ts` — REST endpoints used for comment thread CRUD and file metadata.
- `lib/components/editor/*` — `EditorPane.svelte`, `CodeEditor.svelte`, `CommentsPanel.svelte`, `UserPresence.svelte`, `PreviewPane.svelte` (diagnostics).

High-level workflows (step-by-step)
----------------------------------
1. Project & Yjs initialization
   - Load project metadata via REST.
   - Call `createProjectYjs(projectId)` which:
     - Creates `new Y.Doc()`.
     - Attaches `IndexeddbPersistence('project-{id}', ydoc)` for offline/Local persistence.
     - Creates a `WebsocketProvider` (pycrdt-websocket) for realtime Yjs sync.
     - Sets `awareness` local state with user info and `currentItem` (file/asset).

2. File selection and binding
   - When `selectedFile` changes, pick `ydoc.getText('file-{fileId}')`.
   - Destroy old `CommentRangeTracker`, instantiate a new one for the new file + editor view.
   - Bind the Y.Text to CodeMirror so keystrokes update Yjs immediately.

3. Comment creation
   - User selects text and drafts a comment in the UI.
   - On submit: compute relative positions using Yjs helpers, then POST to REST: `/projects/{id}/comments/threads` with anchor/head in relative JSON.
   - Server stores thread + relative positions and broadcasts the event via `commentSync` websocket channel.
   - Clients receive `thread_created` and update local comment stores; `CommentRangeTracker` reads Y.Map entries (or REST-loaded threads) and applies CodeMirror decorations.

4. Diagnostics flow
   - `PreviewPane` (Typst) compiles content and emits diagnostics.
   - Diagnostics are normalized and added to page-level `diagnostics` state.
   - `CodeEditor` displays gutter markers and highlights ranges; `IssuesPanel` shows list; clicking an issue switches `selectedFile` and scrolls to range.

5. Presence & awareness
   - Local client sets `awareness.setLocalStateField('user', ...)` and `('currentItem', {type,id})`.
   - `UserPresence` listens to `awareness` changes and renders remote cursors and presence list.

6. Project / metadata sync
   - `projectSync` websocket notifies clients of CRUD on files/assets; UI updates files[]/assets[].

Decision points and checks
--------------------------
- Persist vs broadcast: edits are persisted locally to IndexedDB (Yjs) and broadcast immediately via Yjs websocket.
- When to reload comments: on file change, on websocket reconnect, and when comment-related broadcasts arrive.
- Permission loss: on 401/403 from REST or a `permission_changed` message, the frontend destroys write connections and falls back to read-only.
- Anchor resolution: after any doc mutation Yjs relative → absolute position conversion occurs (watch for race conditions under heavy concurrent edits).

Quality criteria / completion checks
----------------------------------
- Real-time typing should converge across two clients within ~500ms under normal network.
- New comment creation: appears locally instantly and is present on other clients within one broadcast round-trip.
- Diagnostics navigation: clicking an issue navigates to correct file and line range.
- Presence: awareness shows all active users and their `currentItem` accurately within 1s of change.

Checklist for triage
-------------------
- Reproduce: Open two browser sessions (different users), edit same file, and confirm text convergence.
- Comments: Create a comment, confirm relative anchors survive nearby edits and appear in the other session.
- Offline: Edit while offline, reconnect, and inspect for merge anomalies.
- Permission changes: remove write permission server-side; confirm client becomes read-only and alerts user.
- Diagnostics: cause a Typst error and verify gutter/issue navigation.

Ambiguities & follow-ups
------------------------
- Offline merging semantics for comments after prolonged offline edits (need backend contract clarity).
- Comment deletion propagation path (REST vs websocket canonical source-of-truth).
- Retry/backoff strategy for `projectSync` and `commentSync` websockets.
- IndexedDB lifecycle: cleanup policy per-project and multi-tab interaction guarantees.

Example agent prompts (try these)
--------------------------------
- "Run the Editor Collaboration skill and list likely causes if comments jump when text is typed concurrently."
- "Explain how to add exponential backoff to projectSync websocket reconnects and where to patch code." 
- "Check why diagnostics don't navigate to file when multiple files share the same basename; suggest code changes." 
- "Generate a minimal test script that opens two headless browsers and verifies Yjs convergence for a simple file edit."

Suggested next actions (automation & fixes)
-----------------------------------------
1. Add explicit reconnect/backoff for `projectSync` and `commentSync`.
2. Add optimistic local comment append before REST round-trip to improve perceived latency.
3. Add unit/integration tests that simulate Yjs updates and comment anchor resolution across reconnects.
4. Add logging around relative → absolute position conversion to capture race conditions.

Save & usage
------------
- Saved here: `.vscode/skills/editor-collaboration-SKILL.md` (workspace-scoped).
- To use: ask the agent to "Run Editor Collaboration skill" or reference sample prompts above; the skill focuses agent behavior and suggestions on the documented flows.

If you want, I can also:
- commit this file to a branch and open a PR, or
- add short remediation code snippets for the top 2 suggested fixes.

Signed-off-by: agent
