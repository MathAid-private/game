# Shelved — ideas deferred or out of scope

> **Author:** MathAid
> **Status:** The explicit "not now" list. These are *not* in [`PROPOSALS.md`](./PROPOSALS.md)
> because they either violate the current constraints or are deliberately out of scope. Revisit only
> with a conscious decision.

Each entry records **why** it is shelved, so the reasoning survives.

---

## 1. `SplitHostLoop` — decoupled physics/render scheduling

**Why shelved:** it is a *scheduling* strategy (two independent schedulers — a `MessageChannel`
physics pump and a `requestAnimationFrame` render loop), not a *simulation step* strategy. The
`PROPOSALS.md` §1 constraint explicitly excludes step strategies that "do extra scheduling". It also
adds two schedulers for zero benefit to three 2D games.

**Revisit when:** a game needs physics to run at a rate independent of the display (e.g. a high-rate
server-authoritative simulation, or a throttled background tab). The concept remains documented in
`ARCHITECTURE.md` §4.3 as the "advanced loop" lesson.

---

## 2. WebGL renderer

**Why shelved:** none of the three games need a shader pipeline; WebGL is a large, separate learning
milestone that would stall the core. The command-list `IRenderer` design already leaves room for a
`WebGLRenderer` later (it is just another `IRenderer` implementation).

**Revisit when:** sprites/effects outgrow Canvas2D, or as a dedicated "shaders & WebGL" learning phase.

---

## 3. Full ECS (entity–component–system)

**Why shelved:** Space Invaders needs a *flat entity list*, not an archetype-based ECS. A full ECS
(components, systems, archetypes, queries) is over-engineering for three games and would bury the
learning under abstraction.

**Revisit when:** a game needs many heterogeneous entities with data-driven behaviour at scale.

---

## 4. 3D / depth buffering

**Why shelved:** "no 3D stuff yet" is an explicit constraint. `IRendererCapabilities.depth` exists as
a reserved flag, but nothing implements it.

**Revisit when:** a 3D or isometric game is planned.

---

## 5. Networking / lockstep multiplayer

**Why shelved:** no networking is in scope; the deterministic simulation (seeded RNG + fixed
timestep) makes lockstep *possible* later, but the transport and rollback machinery are a separate
project.

**Revisit when:** multiplayer is requested.
