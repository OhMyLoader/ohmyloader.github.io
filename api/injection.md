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
| `redirectCall(...)`                  | redirects one method call, or replaces `new` with a static factory        | `@Redirect`                  |
| `modifyArg(...)` / `modifyArgs(...)` | rewrites call arguments                                                   | `@ModifyArg` / `@ModifyArgs` |
| `modifyConstant(...)`                | rewrites a constant                                                       | `@ModifyConstant`            |
| `modifyExpressionValue(...)`         | rewrites an expression's value                                            | `@ModifyExpressionValue`     |
| `modifyVariable(...)`                | rewrites a local variable                                                 | `@ModifyVariable`            |
| `modifyReceiver(...)`                | rewrites the receiver of an instance call / field write                   | `@ModifyReceiver`            |
| `wrapWithCondition(...)`             | gates a void call, field write, array creation or `NEW`; a skipped creation yields `null` | `@WrapWithCondition`         |
| `wrapBranch(...)`                    | decides a conditional branch: true = take the jump, false = fall through  | `@WrapBranch` (OML-specific) |
| `wrapOperation(...)`                 | wraps a call / field / `NEW` / type check / array / arithmetic / numeric-cast instruction with `Operation<R>` | `@WrapOperation`     |
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
same startup checks. `@Constant` matches only explicitly written discriminators — `nullValue`, the
numeric and string fields, or `classValue` for a class literal. `@Implements(ExtraIface::class, …)`
on a `@Merged` or interface carrier adds the declared interfaces to the target, so their default
methods become available and casts to the interface succeed (no name prefixing). A `@Mutable`
`@Borrowed` field clears `final` on the target field, so merged methods outside the constructor can
write it.

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

`@Cancellable` marks the final parameter of a `@WrapOperation` handler as `HookContext` (void
target) or `HookValue<T>` (non-void target). Calling `cancel()` returns from the target method as
soon as the handler returns, and `HookValue.setReturnValue(v)` also supplies the value; without a
cancel call the wrapped operation's result flows on unchanged. It currently covers call, field,
type-check and array anchors, not comparison or `NEW` wrap anchors.

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
  variable (a slot, or the Nth live local of a type, optionally restricted to arguments). A
  `@DefinitionLocal` with `print = true` logs the resolved slot and the local table at the matching
  load, and a declared local that never resolves is named in the miss hint. The declarations are
  checked at startup: every identifier and type a pattern uses must be declared (or be one of the
  defaults `length` and the primitive type names), so a typo fails the launch with the pattern text.
  When nothing matches, the weaving log names the closest partial match — the sub-pattern and the
  instruction it was tried against — or reports an out-of-range `ordinal`.
- A captured comparison is materialized as a boolean value, so the example above sees the
  **source-level** result (is max(…, 3) > 0 true?) and the branch follows the rewritten value.
  `@WrapBranch` on an expression instead receives the jump's compared values and decides the branch
  itself; for `long`/`float`/`double` comparisons (lcmp/fcmp/dcmp feeding a jump) it receives the two
  source operands and decides the raw branch. `@WrapOperation` on a comparison hands the handler the
  compared values (the source operands for a complex comparison) plus an `Operation<Boolean>` that
  re-evaluates the source-level comparison with whatever values the handler supplies.
- The whole string concatenation is a matchable expression; method references, casts, `instanceof`,
  arithmetic, array load/store and array creation are part of the grammar. Wrapping a whole
  concatenation with `@WrapOperation` acts on its `invokedynamic`: the handler receives the
  concatenation's operands and an `Operation<String>` that re-runs the same call site. An array's
  `length` is matchable as `?.length` and wrappable too: the handler receives the array and an
  `Operation<Integer>`. Arithmetic, shifts, bitwise operations, unary negations and stack-changing
  numeric casts (`i2l`, `d2i`, …) captured by an expression can be wrapped the same way: the
  handler receives the source operands and an `Operation<R>` that re-runs the instruction.
- The DSL form is `atExpression("…")`, with the same definitions passed as its `definitions` argument.
- Compound instructions are expanded on demand: a capture inside a string concatenation or an iinc
  targets that exact part. A captured `new` is rewritten after its constructor call, and an array
  literal after its last store. Compound and concatenation captures are available to
  `@ModifyExpressionValue` and `@WrapOperation`; the other injectors reject them.
- `@Redirect`, `@ModifyArg`, `@ModifyArgs` and `@ModifyReturnValue` also accept
  `@At("EXPRESSION")`: the first three act on the call the pattern captured, while
  `@ModifyReturnValue` replaces the captured value after it is produced (the handler's parameter
  and return type must equal that value's type). `@Coerce` applies to every value/operation
  injector, static and merged: `@ModifyExpressionValue`, `@ModifyReturnValue`, `@ModifyArg`
  (single-argument mode), `@ModifyConstant`, `@ModifyVariable`, `@ModifyReceiver`, `@Redirect`,
  `@WrapOperation` (standard, `NEW` and comparison anchors), `@WrapWithCondition`, `@WrapBranch`
  and `@WrapMethod`. A handler parameter may accept a reference supertype of the actual value
  (primitive values are boxed), and the handler method may return a reference type that the engine
  casts or unboxes back. `@Inject` captures and `@ModifyArgs` stay exact: captures are copies and
  the argument list is an untyped `Args` handle. A
  `@Redirect` handler must start with the captured
  call's receiver plus arguments (an instance call is only classified at weaving time); factory
  redirects are rejected, while `@ModifyArg(s)` on a captured `new` rewrites the constructor's
  arguments.
- Repeated `@Expression`s can be told apart by `id`; `@At(id = "…")` picks one, including as a
  `@Slice` boundary (`@Slice(from = @At(value = "EXPRESSION", id = "start"), …)`).

Fabric-Mixin shapes that are not supported (`Shift.BY`, dynamic `targets`, `@Pseudo`, refmaps,
implicit merge-model switching) fail the startup with an explanation instead of failing silently.

## Lambda methods

A lambda's generated name (`lambda$tick$0`) is compiler output and drifts with any edit. Instead of
naming it, name the method that **contains** the lambda and its functional interface:

```java
@Lambda(interfaceType = Supplier.class, ordinal = 0)
@Inject(method = "tick", at = @At("HEAD"))
private static void onLambda(HookContext context) { … }
```

`ordinal` picks the Nth matching lambda when the enclosing method has several. The engine follows the
`LambdaMetafactory` `invokedynamic`'s implementation handle, so only lambdas whose body is compiled
into the same class are resolvable; a method reference to another class is not. The DSL form is
`lambdaMethod("tick", interfaceInternal = "java/util/function/Supplier") { … }`. A miss lists the
lambdas the enclosing method actually contains.

## Performance

- Handlers on `@Hooked` carriers are dispatched through generated bridge methods: each is an
  invokedynamic call site that binds a direct MethodHandle to the handler on its first execution, so
  the steady state has no reflection, no capture array and no boxing for notifications, value
  rewrites and redirects. Cancelable and returnable handlers use a generated exact-descriptor stub
  (they read a per-call context or handle back); reflection remains only as the failure fallback.
- Prefer `@Merged` for the hottest hooks: the handlers live in the target class and are plain direct
  calls.
- Avoid `@ModifyArgs` and writable `LocalRef` parameters on hot paths: both allocate per call
  (`@ModifyArg` and read-only `@Local` do not box). A `@WrapMethod` operation captures `this` and
  allocates per invocation, while a `@WrapOperation` operation is a cached non-capturing lambda.
- Structural work — dataflow analysis, expression matching and conflict checks — happens when the
  class loads, not per frame; parsed expression patterns are cached across resolutions.

## Startup checks

Every rule is re-verified before control is handed to the game's main thread: handler existence,
staticness, signature consistency and match counts. Two rules whose payloads **replace** what they
anchor on (`@Redirect`, `@WrapOperation`, `@WrapBranch`, whole-method wraps) resolving to the same
site fail with both named — the loser would otherwise silently miss; stacking payloads
(notifications, value modifiers, conditions) are unaffected. The default mode `fail` prints each problem and
aborts; `-Doml.injection.verify=warn` only warns; `off` disables. For timing and scale statistics,
add `-Doml.diagnostics=1` — that switch is boolean (any non-blank value other than `false` turns it
on; the value carries no meaning).
