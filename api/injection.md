# Injection DSL & Hooks

When you need to change Minecraft's unexposed internals, use OML's injection DSL instead of Mixin.
Rules are purely declarative and verified one by one at startup (handler existence, signatures,
match counts) — a wrong rule fails the launch instead of silently doing nothing in game.

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
| `beforeField` / `afterField`       | before / after a field access                                            | –                          |
| `beforeNew`                        | before a `new` instruction                                               | –                          |
| `beforeConstant` / `afterConstant` | before / after a constant load                                           | `CONSTANT`                 |
| `afterStore` / `beforeLoad`        | after a local-variable store / before a load                             | `Store` / `Load`           |
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
`@ModifyConstant` / `@ModifyVariable` / `@ModifyReturnValue` / `@ModifyExpressionValue`, with `@At`
and `@Slice` — compile into the same injection rules as the DSL: same pipeline, same startup
checks. Fabric-Mixin shapes that are not supported (`Shift.BY`, dynamic `targets`, `@Pseudo`,
refmaps, implicit merge-model switching) fail the startup with an explanation instead of failing
silently.

## Startup checks

Every rule is re-verified before control is handed to the game's main thread: handler existence,
staticness, signature consistency and match counts. The default mode `fail` prints each problem and
aborts; `-Doml.injection.verify=warn` only warns; `off` disables. For timing and scale statistics,
add `-Doml.diagnostics=1` — that switch is boolean (any non-blank value other than `false` turns it
on; the value carries no meaning).
