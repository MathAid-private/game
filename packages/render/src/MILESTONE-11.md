## Milestone 11: Command and builder extension

**Goal.** Extend the union with state commands and shape commands. Extend the builder with matching methods.

**Deliverables.**

- `command.ts` updated with the new variants.
- The `rect` variant removed. The `rect` builder method emits `fill-shape` and `stroke-shape` with a `RectShape`.
- `frame-builder.ts` extended with all methods listed in section 5.
- `frame.ts` `IFrameBuilder` interface extended.
- Tests updated to reflect the new command kinds.
- New tests for state commands, shape commands, and transform commands.

**Not in scope.**

- No renderer changes. The renderers will not compile against the new union. That is expected. They are fixed in Milestone 12.
- No capture.
- No serialization.

**Done when.**

- The builder tests pass.
- Every builder method has at least one test.
- The command union has no `default` case anywhere it is consumed.

**Cost.** Two to three days.
