# Injection DSL & Hooks

When you need to change Minecraft's unexposed internals, use OML's injection DSL instead of Mixin.
Rules are purely declarative. Handler existence, signatures, and rule sanity are self-checked at startup;
target existence and match counts are enforced when the target class loads (the bundled adapters' anchors
are checked against the real game jar at build time) — a wrong rule fails fast instead of silently doing
nothing in game.

## Rule set skeleton

```kotlin
@RuleSource("my_mod")
object MyRules : RuleSetProvider {
    override fun rules(): RuleSet = injection {
        classTarget("net/minecraft/client/Minecraft") {
            method("runTick") {
                atHead { call("com/example/MyRules", "onGameTick", "()V") }
                require(1)
            }
        }
    }
}
```

- `classTarget` takes the target class's **internal name** (`net/minecraft/...`, slash-separated);
- the handler (`onGameTick`) is a static method in your own class, called directly by the injected
  bytecode;
- `require(1)` declares a match-count lower bound: not met, the launch fails with the reason
  printed. **Always declare it on must-hit rules** — otherwise a drifted target makes the rule
  silently do nothing.

## Anchors

| Anchor                             | Semantics                                                                | Mixin equivalent           |
|------------------------------------|--------------------------------------------------------------------------|----------------------------|
| `atHead`                           | method head                                                              | `HEAD`                     |
| `atConstructorHead`                | after `super()` in a constructor (from here, `this` is usable)           | –                          |
| `atReturn(ordinal)`                | before every return; `atReturn()` = all                                  | `RETURN`                   |
| `atTail`                           | before the last return                                                   | `TAIL`                     |
| `beforeCall` / `afterCall`         | before / after a method call                                             | `INVOKE` / `INVOKE_ASSIGN` |
| `beforeField` / `afterField`       | before / after a field access                                            | `FIELD`                    |
| `beforeNew`                        | before a `new` instruction                                               | `NEW`                      |
| `beforeConstant` / `afterConstant` | before / after a constant load                                           | `CONSTANT`                 |
| `afterStore` / `beforeLoad`        | after a local-variable store / before a load                             | `Store` / `Load`           |
| `point(Anchor.typeCheck(…))`       | before a `CHECKCAST` / `INSTANCEOF`                                      | `CHECKCAST` / `INSTANCEOF` |
| `point(Anchor.arrayAccess(…))`     | before an array load / store                                             | `ARRAY_LOAD` / `ARRAY_STORE` |
| `point(Anchor.arrayCreate(…))`     | before `NEWARRAY` / `ANEWARRAY` / `MULTIANEWARRAY`                       | `NEW_ARRAY`                |
| `atJump(opcode)`                   | before a conditional branch (`IFEQ`…`IF_ACMPNE`, `IFNULL`/`IFNONNULL`)   | `JUMP`                     |
| `within(from, to)`                 | restricts the search window between two anchors (nestable, intersection) | `@Slice`                   |

Anchors accept owner / desc / ordinal filters (`atReturn(0)` hits only the first return).

## Payloads

Each anchor block declares what to inject:

| Payload                              | Semantics                                                                 | Mixin equivalent             |
|--------------------------------------|---------------------------------------------------------------------------|------------------------------|
| `call(owner, method, desc)`          | calls a static method at the anchor (locals can be injected as arguments) | `@Inject`                    |
| `redirectCall(...)`                  | redirects one method call                                                 | `@Redirect`                  |
| `modifyArg(...)` / `modifyArgs(...)` | rewrites call arguments                                                   | `@ModifyArg` / `@ModifyArgs` |
| `modifyConstant(...)`                | rewrites a constant                                                       | `@ModifyConstant`            |
| `modifyExpressionValue(...)`         | rewrites an expression's value                                            | `@ModifyExpressionValue`     |
| `modifyVariable(...)`                | rewrites a local variable                                                 | `@ModifyVariable`            |
| `modifyReceiver(...)`                | rewrites the receiver of an instance call / field write                   | `@ModifyReceiver`            |
| `wrapWithCondition(...)`             | gates a void call or field write on a boolean handler                     | `@WrapWithCondition`         |
| `wrapBranch(...)`                    | decides a conditional branch: true = take the jump, false = fall through  | `@WrapBranch` (OML-specific) |
| `wrapOperation(...)`                 | wraps a call / field / `NEW` / type check / array instruction with `Operation<R>` | `@WrapOperation`     |
| `wrapMethod(...)`                    | replaces a whole method body behind an `Operation`                        | `@WrapMethod`                |
| `handlerCall(...)` / `mergedCall(...)` | calls a handler merged into the target class (`this` = target)          | –                            |

## Match-count policies

| Declaration  | Semantics                                                 |
|--------------|-----------------------------------------------------------|
| `require(n)` | at least n hits, otherwise the launch fails (lower bound) |
| `allow(n)`   | at most n hits, more fails (guards over-broad rules)      |
| `expect(n)`  | expects n hits; deviation only warns                      |
| `optional()` | zero hits allowed, suppressing the "no match" warning     |

## Access rewriting and class merging

```kotlin
classTarget("net/minecraft/client/Minecraft") {
    field("proxy", desc = "Ljava/net/Proxy;") {
        makePublic()
        removeFinal()
    }
    methodAccess("runTick") { makePublic() }

    // class merging: a mod class is *merged into* the target class; its handlers
    // run with `this` = the target instance
    merge("com/example/MyHooks")
}
```

Inside a `merge` source, mark members with `@Borrowed` ("the target class already has this member"),
`@Extra` (new member), `@Replace` (replace a method body) and `@FieldAccess` / `@MethodAccess`
(synthesized field accessors / private-method callers) — Mixin semantics, synthesized at the
bytecode level by the engine.

## Hook annotations

The annotation front-end is OML's own — not a Fabric Mixin drop-in, but a close mapping. A class
annotated `@Hooked(target = "…")` is a pure rule carrier (every handler dispatched through the
engine's bridge; a handler may declare the target instance as a typed first parameter), and
`@Merged(target = "…")` opts into member merge (`this` = the target instance inside handlers and
merged members). The method annotations — `@Inject` / `@Redirect` / `@ModifyArg` / `@ModifyArgs` /
`@ModifyConstant` / `@ModifyVariable` / `@ModifyReturnValue` / `@ModifyExpressionValue` /
`@ModifyReceiver` / `@WrapWithCondition` / `@WrapBranch` / `@WrapOperation` / `@WrapMethod`, with
`@At`, `@Constant` and `@Slice` — compile into the same injection rules as the DSL: same pipeline,
same startup checks.

`@WrapBranch` is OML's own landing point: the handler receives the values a conditional jump
compares and returns whether the branch is taken. The operands follow the jump's stack form —
`(I)Z` for `IFEQ`-family, `(II)Z` for `IF_ICMP*`, `(Object, Object)Z` for `IF_ACMP*`,
`(Object)Z` for `IFNULL`/`IFNONNULL` — and the branch is the **bytecode** test, not the
source-level condition: `if (x > 10)` compiles to "jump when `x <= 10`", so changing the threshold
means returning that inverted test.

`@Local` and `@Share` bind a handler parameter to a local variable. On `@Inject` the sugar
parameters sit **before** the trailing `HookContext`/`HookValue`; on every other injector they are
a **trailing suffix** after the handler's ordinary parameters. A `LocalRef<T>` parameter is
writable (the engine writes its final value back to the slot after the handler returns), and the
primitive-specialized `LocalIntRef`/`LocalLongRef`/`LocalFloatRef`/`LocalDoubleRef` variants avoid
boxing. `@Share` hands the same `LocalRef` to every handler of one target-method invocation, so an
earlier handler can leave a value for a later one.

Fabric-Mixin shapes that are not supported (`Shift.BY`, dynamic `targets`, `@Pseudo`, refmaps,
implicit merge-model switching) fail the startup with an explanation instead of failing silently.

## Startup checks

Every rule is re-verified before control is handed to the game's main thread: handler existence,
staticness, signature consistency and match counts. The default mode `fail` prints each problem and
aborts; `-Doml.injection.verify=warn` only warns; `off` disables. For timing and scale statistics,
add `-Doml.diagnostics=1` — that switch is boolean (any non-blank value other than `false` turns it
on; the value carries no meaning).
