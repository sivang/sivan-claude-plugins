# Sivan's Claude Code Plugins

> *"Because your AI pair programmer shouldn't have the memory of a goldfish."*

Session management plugins for Claude Code - save your work at session end and pick up where you left off. No more "where were we?" moments. No more lost context. Just smooth, continuous development across sessions.

**This marketplace is just getting started.** More tools are brewing in the lab - bookmark it, star it, or add it now and watch it grow.

## Included Skills

### Doomsday Protocol (`/doomsday`)
End-of-session shutdown protocol that:
- Forces save of all discussed code and changes
- Updates README.md, PROJECT_STATUS.md, and other docs
- Creates SESSION_HANDOFF with decisions, gotchas, and next actions
- Generates git commit message

**Trigger:** "end session", "shutdown", "wrap up", "doomsday protocol"

### Session Resurrect
Context reload for returning to projects:
- Reads README, PROJECT_STATUS, and handoff files
- Reconstructs project state and active issues
- Identifies next priority action
- Provides start command

**Trigger:** "resurrect session", "reload context", "catch me up", "what were we working on"

## Installation

```bash
# Add the marketplace
/plugin marketplace add sivang/sivan-claude-plugins

# Install the plugin
/plugin install session-workflow@sivan-plugins

# Restart Claude Code
```

## Usage

**End of session:**
```
/doomsday
```
or just say "wrap up the session" or "doomsday protocol"

**Start of session:**
Say "resurrect the session" or "catch me up on where we left off"

## Coming Soon

Got an idea for a plugin? Open an issue. Got a plugin you built? PRs welcome. This marketplace grows with the community.

## License

MIT

---

*Built with caffeine and context windows by [Sivan](https://github.com/sivang) at [Vitakka](https://vitakka.co)*
