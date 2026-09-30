# ADR-005: Opponent Strategy Interface

**Status:** Accepted
**Date:** 2026-09-30
**Decision Makers:** Michael Schlottmann

## Context

Rivals are rule-based today (`aiTurn` in legacy, directly mutating the state) and should later be
driven by an LLM. The LLM must not be able to break the rules.

## Decision

Rivals implement `OpponentStrategy.decide(view, legalActions, ctx): Promise<Action[]>`. The engine
applies the returned actions through the same `applyAction` validation as player actions and skips
invalid ones. Rival minigame challenges are resolved by the engine with the legacy probabilities.

## Consequences

- `RuleBasedOpponent` and `LlmOpponent` are interchangeable per rival and can be compared in
  bot-vs-bot simulations.
- The legacy AI has to be rewritten in terms of actions (small behavioural differences are acceptable).
- `endQuarter` becomes async.
