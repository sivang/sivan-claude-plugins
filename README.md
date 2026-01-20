# Sivan's Claude Code Plugins

> *"Because your AI pair programmer shouldn't have the memory of a goldfish."*

Session management plugins for Claude Code - save your work at session end and pick up where you left off. No more "where were we?" moments. No more lost context. Just smooth, continuous development across sessions.

**This marketplace is just getting started.** More tools are brewing in the lab - bookmark it, star it, or add it now and watch it grow.

## Included Skills

### `/doomsday` - The Paranoid Shutdown Protocol

> *"Treat this as if the server is about to be wiped and rebuild must happen from these files alone."*

Your AI transforms into a **Paranoid Lead Architect** who refuses to let anything exist only in memory. Like a bunker prepper for code:

- **Force saves everything** - code blocks, text buffers, that brilliant idea you mentioned once
- **Updates all the docs** - README, PROJECT_STATUS, the works
- **Creates SESSION_HANDOFF** - decisions, gotchas, "why did we do it this way?!"
- **Preps git commit** - so you can push and run

**Trigger:** `/doomsday`, "wrap up", "end session", or just dramatically announce "DOOMSDAY PROTOCOL"

### `/resurrect` - Rise From The Ashes

> *"Lead Architect returning to a project with wiped memory. Reconstruct immediately."*

Back after a coffee break? A weekend? A month-long vacation where you forgot everything? No problem:

- **Reads all the breadcrumbs** - README, PROJECT_STATUS, handoff files
- **Diagnoses the "Active Wound"** - what was half-finished when you left?
- **Spots the Gotchas** - those weird bugs you'll definitely hit again
- **Gives you THE command** - the one thing to run first

**Trigger:** `/resurrect`, "catch me up", "what were we working on", or the classic "...where was I?"

## Installation

```bash
# Add the marketplace
/plugin marketplace add sivang/sivan-claude-plugins

# Install the plugin
/plugin install session-workflow@sivan-plugins

# Restart Claude Code
```

## Usage

**When you're done for the day:**
```
/doomsday
```
*"Save everything. Trust no one. Not even future me."*

**When you're back:**
```
/resurrect
```
*"I have returned. Brief me."*

## Coming Soon

Got an idea for a plugin? Open an issue. Got a plugin you built? PRs welcome. This marketplace grows with the community.

## License

MIT

---

*Built with caffeine and context windows by [Sivan](https://github.com/sivang) at [Vitakka](https://vitakka.co)*
