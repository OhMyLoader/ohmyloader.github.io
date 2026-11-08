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

## Expressions

`@Expression("…")` targets a Java-like expression reconstructed from the target method's bytecode
instead of a single instruction. The injector uses `@At("EXPRESSION")`, and every identifier in the
pattern is declared with `@Definition`:

```java
@Definition(id = "max", method = "Ljava/lang/Math;max(II)I")
@Expression("max(?, 3) > 0")
@ModifyExpressionValue(method = "tick", at = @At("EXPRESSION"))
private static boolean onTick(boolean original) {
    return !original;
}
```

- `?` is a wildcard; `@(…)` marks the captured part explicitly (without it the whole expression is
  captured); `ordinal` selects the Nth captured instruction in method order.
- `@Definition` declares identifiers: `method` and `field` take the same strings as `@At(target = …)`,
  `type` takes classes used by `instanceof`, casts and instantiations, and `local` names a local
  variable (a slot, or the Nth live local of a type, optionally restricted to arguments).
- A captured comparison is materialized as a boolean value, so the example above sees the
  **source-level** result (is max(…, 3) > 0 true?) and the branch follows the rewritten value.
  `@WrapBranch` on an expression instead receives the jump's compared values and decides the branch
  itself. `long`/`float`/`double` comparisons (lcmp/fcmp/dcmp feeding a jump) work the same way.
- The whole string concatenation is a matchable expression; method references, casts, `instanceof`,
  arithmetic, array load/store and array creation are part of the grammar.
- The DSL form is `atExpression("…")`, with the same definitions passed as its `definitions` argument.
- Compound instructions are expanded on demand: a capture inside a string concatenation or an iinc
  targets that exact part. A captured `new` is rewritten after its constructor call, and an array
  literal after its last store. Expression ids and expression-backed `@Slice` bounds are not
  implemented yet.

Fabric-Mixin shapes that are not supported (`Shift.BY`, dynamic `targets`, `@Pseudo`, refmaps,
implicit merge-model switching) fail the startup with an explanation instead of failing silently.

## Startup checks

Every rule is re-verified before control is handed to the game's main thread: handler existence,
staticness, signature consistency and match counts. The default mode `fail` prints each problem and
aborts; `-Doml.injection.verify=warn` only warns; `off` disables. For timing and scale statistics,
add `-Doml.diagnostics=1` — that switch is boolean (any non-blank value other than `false` turns it
on; the value carries no meaning).
