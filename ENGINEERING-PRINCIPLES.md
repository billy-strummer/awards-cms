# Engineering Principles

One page. If a change doesn't clearly serve these, it doesn't ship.

## How we classify every request, before writing any code
- **Bug Fix** — behaviour doesn't match intended behaviour. Fix now.
- **Reliability Improvement** — works today, but fragile (race condition, silent failure, missing error handling). Fix now if customer-facing risk is real.
- **Performance Improvement** — works correctly, too slow at real scale. Fix now only if customers are actually affected.
- **Security Improvement** — fix now, always, no exceptions.
- **UX Improvement** — confusing, inconsistent, or friction-heavy but functionally correct. Fix now if it blocks a customer; otherwise V1.1 backlog.
- **Technical Debt Reduction** — no user-visible symptom, but slows future work. Batch it, don't chase it reactively.
- **Operational Improvement** — monitoring, backups, deploy safety, support tooling. Fix now if it closes a real gap.
- **New Feature (V1.1+)** — genuinely new capability, no urgency. Backlog it, explain why.
- **Strategic Feature (V2+)** — depends on real customer evidence not yet collected. Say so, don't build it speculatively.

## Principles
1. **Backwards compatibility first.** Every existing tenant's workflow, data, and integrations must keep working. A change that requires a customer to "just re-do" something is a last resort, not a first draft.
2. **Simplicity over cleverness.** The simplest change that correctly solves the actual problem wins, even if a more elegant one exists. Future maintainers (including future us) read code far more often than we write it.
3. **One source of truth.** Configuration, credentials, and business rules live in exactly one place. If two things can drift out of sync, they will — the fix is removing the duplication, not disciplining ourselves to remember both.
4. **Prefer configuration over duplication.** A new variant of existing behaviour is a flag or a parameter, not a copy-pasted second version of the code.
5. **Test before merge.** Lint, build, and the full automated test suite pass before any change is considered done — not as a formality, but because a green suite is the fastest way to know a "small" change didn't break something three tabs away.
6. **No feature without a measurable user benefit.** If we can't say who needs it and why, it belongs in the backlog, not in the codebase.
7. **Documentation updated in the same commit as the code.** A workflow change that doesn't update `ADMIN-GUIDE.md` (or the relevant guide) in the same commit is an incomplete change, not a follow-up task.
8. **Security and data integrity take precedence over convenience.** Every time. A slower, safer path beats a fast one that risks another tenant's data or a customer's trust.
9. **Reversibility over speed for anything destructive.** Prefer soft-delete/archive over hard delete, additive-only migrations over destructive ones, and a confirmation step over a shortcut — exactly the pattern already used throughout this codebase.
10. **The smallest safe change beats the most complete one.** Solve the problem in front of us; don't redesign the system around it. If a bigger change is genuinely warranted, say so explicitly and let it be a deliberate decision, not a side effect of fixing something else.

## What justifies added complexity
Only a clear, statable answer to *"what breaks without this?"* — for a real customer, a real security boundary, or a real operational failure mode. "It's more correct in theory" or "we might need this later" don't qualify. If the complexity isn't justified, the simpler solution ships instead, and the idea goes to `V1.1-BACKLOG.md` if it's worth remembering.
