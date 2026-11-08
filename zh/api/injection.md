# 注入 DSL 与 Mixin

当需要修改 Minecraft 内部未暴露的逻辑时，用 OML 的注入 DSL 替代 Mixin。规则是纯静态声明：处理器存在性 /
签名 / 规则自洽性在启动期逐条自检，目标存在性与命中数在目标类加载时强制校验（内置 adapter 的锚点在构建期
对真实游戏 jar 校验）——写错的规则尽早失败而不是在游戏里静默失效。

## 规则集骨架

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

- `classTarget` 的参数是目标类的内部名（`net/minecraft/...`，斜杠分隔）；
- 处理器（`onGameTick`）是 mod 自己的类里的静态方法，注入后由游戏直接调用；
- `require(1)` 声明命中数下限：不满足时启动失败并打印原因。 **必须命中的规则一定要声明**，
  否则目标漂移时规则会静默失效。

## 锚点

| 锚点                               | 语义                                                | 对应 Mixin                   |
|------------------------------------|-----------------------------------------------------|------------------------------|
| `atHead`                           | 方法头                                              | `HEAD`                       |
| `atConstructorHead`                | 构造器 `super()` 之后（此刻 `this` 才可用）         | –                            |
| `atReturn(ordinal)`                | 每条返回指令前；`atReturn()` 全部                   | `RETURN`                     |
| `atTail`                           | 最后一条返回前                                      | `TAIL`                       |
| `beforeCall` / `afterCall`         | 方法调用指令前 / 后                                 | `INVOKE` / `INVOKE_ASSIGN`   |
| `beforeField` / `afterField`       | 字段读写指令前 / 后                                 | `FIELD`                      |
| `beforeNew`                        | `new` 指令前                                        | `NEW`                        |
| `beforeConstant` / `afterConstant` | 常量加载前 / 后                                     | `CONSTANT`                   |
| `afterStore` / `beforeLoad`        | 局部变量写入后 / 读取前                             | `Store` / `Load`             |
| `point(Anchor.typeCheck(…))`       | `CHECKCAST` / `INSTANCEOF` 指令前                   | `CHECKCAST` / `INSTANCEOF`   |
| `point(Anchor.arrayAccess(…))`     | 数组读 / 写指令前                                   | `ARRAY_LOAD` / `ARRAY_STORE` |
| `point(Anchor.arrayCreate(…))`     | `NEWARRAY` / `ANEWARRAY` / `MULTIANEWARRAY` 指令前  | `NEW_ARRAY`                  |
| `within(from, to)`                 | 把搜索窗口限定在两个锚点之间（可嵌套，取交集）      | `@Slice`                     |

锚点支持按 owner / desc / ordinal 过滤（如 `atReturn(0)` 只命中第一条返回）。

## 载荷

每个锚点块内声明注入什么：

| 载荷                                   | 语义                                                             | 对应 Mixin                   |
|----------------------------------------|------------------------------------------------------------------|------------------------------|
| `call(owner, method, desc)`            | 在锚点处调用一个静态方法（参数可注入局部变量等）                 | `@Inject`                    |
| `redirectCall(...)`                    | 重定向一处方法调用                                               | `@Redirect`                  |
| `modifyArg(...)` / `modifyArgs(...)`   | 改写调用参数                                                     | `@ModifyArg` / `@ModifyArgs` |
| `modifyConstant(...)`                  | 改写常量                                                         | `@ModifyConstant`            |
| `modifyExpressionValue(...)`           | 改写表达式求值结果                                               | `@ModifyExpressionValue`     |
| `modifyVariable(...)`                  | 改写局部变量                                                     | `@ModifyVariable`            |
| `modifyReceiver(...)`                  | 改写实例调用 / 字段写入的接收者                                  | `@ModifyReceiver`            |
| `wrapWithCondition(...)`               | 用布尔处理器决定 void 调用或字段写入是否执行                     | `@WrapWithCondition`         |
| `wrapOperation(...)`                   | 用 `Operation<R>` 包装调用 / 字段 / `NEW` / 类型检查 / 数组指令  | `@WrapOperation`             |
| `wrapMethod(...)`                      | 用 `Operation` 接管整个方法体                                    | `@WrapMethod`                |
| `handlerCall(...)` / `mergedCall(...)` | 调用合并进目标类的处理器（`this` = 目标实例）                    | –                            |

## 命中数策略

| 声明         | 语义                                    |
|--------------|-----------------------------------------|
| `require(n)` | 至少命中 n 次，否则启动失败（下限）     |
| `allow(n)`   | 至多命中 n 次，超出即失败（防规则过宽） |
| `expect(n)`  | 预期命中 n 次，偏差只告警               |
| `optional()` | 允许零命中，压制"未命中"警告            |

## 访问改写与类合并

```kotlin
classTarget("net/minecraft/client/Minecraft") {
    field("proxy", desc = "Ljava/net/Proxy;") {
        makePublic()
        removeFinal()
    }
    methodAccess("runTick") { makePublic() }

    // 类合并：把 mod 里的一个类"真合并"进目标类，处理器可以 this = 目标实例运行
    merge("com/example/MyHooks")
}
```

`merge` 的源类里用 `@Borrowed`（声明"目标类已有此成员"）、`@Extra`（新增成员）、`@Replace`（替换方法体）、
`@FieldAccess` / `@MethodAccess`（合成字段访问器 / 私有方法调用器）标记成员——语义与 Mixin 一致，但发生在
字节码层，由引擎合成。

## Hook 注解

注解前端是 OML 自己的——不是 Fabric Mixin 的直接替代，但映射关系很近。`@Hooked(target = "…")`
标注的类是**纯规则载体**（所有 handler 都经引擎的桥分发；handler 可以把目标实例声明为类型化的
第一个参数）；`@Merged(target = "…")` 显式加入成员合并（handler 与合并成员里的 `this` 就是目标
实例）。方法注解——`@Inject` / `@Redirect` / `@ModifyArg` / `@ModifyArgs` / `@ModifyConstant` /
`@ModifyVariable` / `@ModifyReturnValue` / `@ModifyExpressionValue` / `@ModifyReceiver` /
`@WrapWithCondition` / `@WrapOperation` / `@WrapMethod`，配合 `@At`、`@Constant` 与 `@Slice`——
被前端翻译成与 DSL 相同的注入规则：同一条管线、同一套自检。

`@Local` 与 `@Share` 把 handler 参数绑定到局部变量。在 `@Inject` 上，糖参数位于尾部
`HookContext`/`HookValue` **之前**；在其他注入器上，它们是普通参数之后的**尾部后缀**。
`LocalRef<T>` 参数可写（handler 返回后引擎把它的最终值写回槽位），
`LocalIntRef`/`LocalLongRef`/`LocalFloatRef`/`LocalDoubleRef` 等原始类型专用变体避免装箱。
`@Share` 让同一次目标方法调用中的每个 handler 拿到同一个 `LocalRef`，先执行的 handler 可以
把值留给后面的 handler。

不支持的 Fabric Mixin 形态（`Shift.BY`、动态 `targets`、`@Pseudo`、refmap、隐式模型切换）会启动期
报错，不会静默失效。

## 自检

所有规则在控制权交给游戏主线程之前重新验证：处理器存在性、静态性、签名一致性、命中数。默认模式
`fail` 逐条打印问题并中止启动；`-Doml.injection.verify=warn` 只告警；`off` 关闭。要拿到改写耗时与
规模统计，加上 `-Doml.diagnostics=1`——这个开关是布尔的（任何非空且非 `false` 的值即启用，取值本身
没有含义）。
