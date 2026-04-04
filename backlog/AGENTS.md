# Backlog System — Agent Instructions

The `docs/backlog/` directory holds the Roost product backlog. Stories and epics are plain Markdown
files with YAML frontmatter. A sync script regenerates all index tables from frontmatter on demand.

## Directory Layout

```
docs/backlog/
  index.md                      ← master stack-ranked list (auto-generated tables)
  AGENTS.md                     ← this file
  E00-infrastructure/
    index.md                    ← epic index (auto-generated tables)
    S33-importmap/
      index.md                  ← story file (hand-written + execution plan)
    .completed/
      S34-js-lib-cleanup/
        index.md                ← completed stories live here
  E01-auth/
    ...
```

## Story Frontmatter

Every `index.md` inside a story directory begins with a YAML frontmatter block:

```yaml
---
epic: E01 · Auth & Onboarding # human-readable epic label
story_id: S-01 # canonical ID, always S-<number> with dash
title: User Login # short title (used in index tables)
points: 3 # story-point estimate (Fibonacci: 1 2 3 5 8 13)
status: backlog # backlog | in_progress | done
added: 2026-03-15 # date the story was added to the backlog (YYYY-MM-DD)
# --- set when work begins ---
# --- set when work is complete ---
commit: 986324d # short git hash of the completing commit
completed: 2026-03-15 # date marked done (YYYY-MM-DD)
---
```

### Field Reference

| Field       | Required | Values                         | Notes                                         |
| ----------- | -------- | ------------------------------ | --------------------------------------------- |
| `epic`      | yes      | `E<nn> · <Name>`               | Human label; epic index uses `epic_id`        |
| `story_id`  | yes      | `S-<nn>` (dash required)       | Unique across the entire backlog              |
| `title`     | yes      | short string                   | Appears in all index tables                   |
| `points`    | yes      | 1 2 3 5 8 13                   | Fibonacci; epic and backlog totals roll up    |
| `status`    | yes      | `backlog` `in_progress` `done` | drives table placement in sync output         |
| `added`     | yes      | `YYYY-MM-DD`                   | Date story was added; set once, never changed |
| `commit`    | on done  | short hash                     | Set at the same time as `status: done`        |
| `completed` | on done  | `YYYY-MM-DD`                   | Set at the same time as `status: done`        |

## Epic Frontmatter

Every `E<nn>-*/index.md` begins with:

```yaml
---
epic_id: E00
title: Infrastructure
points: 7 # auto-updated by bl sync (sum of all stories)
---
```

## Lifecycle of a Story

```
backlog → in_progress → done
```

1. **backlog** — story exists, not yet started. Lives in `E<nn>-*/S<nn>-*/`.
2. **in_progress** — work has begun. Frontmatter `status` updated; execution plan appended.
   Use `bl workon S<nn>` to do this automatically (creates a worktree + Claude session).
3. **done** — work committed. `commit` and `completed` set. Directory moved to `.completed/`.
   Use `bl done S<nn> <commit>` or the `/bl-done` skill to do this automatically.

After any status change, `bl sync` regenerates the index files.

## Tooling

All backlog operations use the `bl` CLI (or equivalent `/bl-*` Claude Code skills):

### `bl new`

Creates a new story (or a new epic + story) with the correct next ID, today's `added` date, and a
scaffolded `index.md`. Always use this instead of creating story files manually.

```bash
bl new                                                      # fully interactive
bl new --epic E00 --title "My Story" --points 3
bl new --epic new --epic-title "My Epic" --title "First Story" --points 2
```

Claude Code skill: `/bl-new --epic E00 --title "My Story" --points 3`

### `bl sync`

Reads every story from disk (including `.completed/` subdirs) and rewrites:

- Each `E<nn>-*/index.md` — Stories table (active) + Completed table
- `docs/backlog/index.md` — Epics table, Backlog table, Completed table

```bash
bl sync
```

Claude Code skill: `/bl-sync`

### `bl workon`

Locates a story, creates a git worktree, and launches an interactive Claude session that will:

- Set `status: in_progress`
- Implement the story according to the execution plan
- Commit work with meaningful messages

```bash
bl workon S34                 # dash optional; case-insensitive
bl workon s-34
```

### `bl refine`

Creates a worktree and launches a Claude session focused on **refinement only — no implementation**:

- Explores the codebase to understand the story's scope
- Refines acceptance criteria and resolves ambiguities
- Creates a detailed execution plan with concrete steps
- Can create child stories via `bl new` if the story should be split
- May edit related stories (only if not being worked on)
- Presents a summary and invites discussion

```bash
bl refine S34
```

Claude Code skill: `/bl-refine S34` (runs inline, no worktree)

### `bl list`

Show all active story worktrees and their status.

```bash
bl list
```

### `bl done`

Marks a story complete, syncs, and archives it:

- Sets `status: done`, `commit`, `completed` in frontmatter
- Moves story directory to `E<nn>-*/.completed/S<nn>-*/`
- Runs sync

```bash
bl done S34                   # uses HEAD commit hash
bl done S34 abc1234           # explicit commit hash
```

Claude Code skill: `/bl-done S34`

### `bl cleanup`

After a story is complete, merges the worktree branch into main, syncs, pushes, and removes the worktree:

```bash
bl cleanup S34
```

## Conventions for Agents

- **Never** hand-edit the generated tables in `index.md` files — always edit story frontmatter
  then run `bl sync`.
- When adding a new story, set `added` to today (`YYYY-MM-DD`).
- `story_id` format is always `S-<number>` with a hyphen (e.g. `S-40`). Directory names omit
  the hyphen (e.g. `S40-my-feature/`).
- Points use the Fibonacci sequence: 1, 2, 3, 5, 8, 13. Never use other values.
- Only set `status: done` after a real commit exists. Set `commit` and `completed` simultaneously.
- The `.completed/` directory inside an epic is managed by `bl done`. Do not move story
  directories manually.
- **Do NOT run `bl sync` from a worktree** — it causes merge conflicts across agents.
  Sync runs on main after merge via `bl cleanup`.

## Plugins

Plugins run shell commands at lifecycle stages (`new`, `refine`, `workon`, `cleanup`, `done`).
They are defined in `.backlog.json` and activated via frontmatter.

### Configuration

Register plugins in `.backlog.json`:

```json
{
  "plugins": {
    "session-stack": {
      "workon": "../containers/scripts/session-up.sh {{sessionId}} {{worktreePath}}",
      "cleanup": "../containers/scripts/session-down.sh {{sessionId}}"
    }
  }
}
```

Each plugin maps stage names to shell commands. Commands support `{{variable}}` interpolation:

| Variable           | Example                                    |
| ------------------ | ------------------------------------------ |
| `{{sessionId}}`    | `s67`                                      |
| `{{storyId}}`      | `S-67`                                     |
| `{{worktreePath}}` | `/home/.../app.roost.cc-worktrees/s67-...` |
| `{{branchName}}`   | `s67-spa-navigation`                       |
| `{{epicId}}`       | `E00`                                      |
| `{{repoRoot}}`     | `/home/.../app.roost.cc`                   |

### Activation via Frontmatter

Plugins are activated in backlog frontmatter and cascade: **root → epic → story**.

**Root `docs/backlog/index.md`** — defaults for all stories:

```yaml
plugins: session-stack
```

**Epic `E00-infrastructure/index.md`** — override for the epic:

```yaml
plugins: -session-stack
```

**Story `S99-my-story/index.md`** — override for a single story:

```yaml
plugins: session-stack
```

- Bare names (`session-stack`) add the plugin
- Prefixed with `-` (`-session-stack`) removes it
- Stage-specific overrides: `plugins-workon: -session-stack` (only affects the `workon` stage)

### Lifecycle Stages

| Stage     | When it runs                                                |
| --------- | ----------------------------------------------------------- |
| `new`     | After `bl new` creates a story and runs sync                |
| `refine`  | After `bl refine` sets up the worktree (new worktrees only) |
| `workon`  | After `bl workon` sets up the worktree (new worktrees only) |
| `cleanup` | During `bl cleanup`, before worktree removal                |
| `done`    | After `bl done` marks the story complete and syncs          |
