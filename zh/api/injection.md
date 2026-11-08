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
| `atJump(opcode)`                   | 条件跳转前（`IFEQ`…`IF_ACMPNE`、`IFNULL`/`IFNONNULL`） | `JUMP`                     |
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
| `wrapBranch(...)`                      | 决定条件跳转：true = 跳转，false = 顺序执行下一句                | `@WrapBranch`（OML 自有）    |
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
`@WrapWithCondition` / `@WrapBranch` / `@WrapOperation` / `@WrapMethod`，配合 `@At`、`@Constant`
与 `@Slice`——被前端翻译成与 DSL 相同的注入规则：同一条管线、同一套自检。

`@WrapBranch` 是 OML 自己的落点：处理器拿到条件跳转所比较的值，返回是否执行这条跳转。
操作数按跳转的栈形态排列——`IFEQ` 族是 `(I)Z`，`IF_ICMP*` 是 `(II)Z`，`IF_ACMP*` 是
`(Object, Object)Z`，`IFNULL`/`IFNONNULL` 是 `(Object)Z`；处理的是**字节码层**的分支而不是
源码层的条件：`if (x > 10)` 编译成“`x <= 10` 时跳转”，要调整阈值就得返回这个取反后的判断。

`@Local` 与 `@Share` 把 handler 参数绑定到局部变量。在 `@Inject` 上，糖参数位于尾部
`HookContext`/`HookValue` **之前**；在其他注入器上，它们是普通参数之后的**尾部后缀**。
`LocalRef<T>` 参数可写（handler 返回后引擎把它的最终值写回槽位），
`LocalIntRef`/`LocalLongRef`/`LocalFloatRef`/`LocalDoubleRef` 等原始类型专用变体避免装箱。
`@Share` 让同一次目标方法调用中的每个 handler 拿到同一个 `LocalRef`，先执行的 handler 可以
把值留给后面的 handler。

## 表达式

`@Expression("…")` 匹配的是从目标方法字节码重建出来的、类 Java 的表达式，而不是单条指令。
注入器使用 `@At("EXPRESSION")`，模式里用到的每个标识符都要用 `@Definition` 声明：

```java
@Definition(id = "max", method = "Ljava/lang/Math;max(II)I")
@Expression("max(?, 3) > 0")
@ModifyExpressionValue(method = "tick", at = @At("EXPRESSION"))
private static boolean onTick(boolean original) {
    return !original;
}
```

- `?` 是通配符；`@(…)` 显式标出捕获部分（不写则捕获整个表达式）；`ordinal` 按方法顺序选中第 N 个
  捕获到的指令。
- `@Definition` 声明标识符：`method` 与 `field` 接受和 `@At(target = …)` 相同的字符串，`type`
  接受 `instanceof`、强转与实例化中用到的类，`local` 用来命名局部变量（指定槽位，或第 N 个该类型的
  活跃局部变量，可限定只查参数槽）。
- 捕获到的比较会物化为布尔值：上面的例子看到的是**源码层**的结果（max(…, 3) > 0 是否成立），
  分支会跟随改写后的值。表达式上的 `@WrapBranch` 则直接收到跳转比较的操作数，由 handler 决定
  分支走向。`long`/`float`/`double` 比较（lcmp/fcmp/dcmp 接跳转）同样支持。
- 整段字符串拼接可以作为表达式匹配；方法引用、强转、`instanceof`、算术、数组读写与数组创建都在
  语法范围内。
- DSL 写法是 `atExpression("…")`，定义通过它的 `definitions` 参数传入。
- 复合指令按需展开：字符串拼接或 iinc 内部的捕获会精确落到对应部分。`NEW` 或数组字面量所产生值的
  改写、表达式 id 与以表达式为边界的 `@Slice` 暂未实现。

不支持的 Fabric Mixin 形态（`Shift.BY`、动态 `targets`、`@Pseudo`、refmap、隐式模型切换）会启动期
报错，不会静默失效。

## 自检

所有规则在控制权交给游戏主线程之前重新验证：处理器存在性、静态性、签名一致性、命中数。默认模式
`fail` 逐条打印问题并中止启动；`-Doml.injection.verify=warn` 只告警；`off` 关闭。要拿到改写耗时与
规模统计，加上 `-Doml.diagnostics=1`——这个开关是布尔的（任何非空且非 `false` 的值即启用，取值本身
没有含义）。
