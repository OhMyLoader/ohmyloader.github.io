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
| `redirectCall(...)`                    | 重定向一处方法调用，或用静态工厂替换 `new`                        | `@Redirect`                  |
| `modifyArg(...)` / `modifyArgs(...)`   | 改写调用参数                                                     | `@ModifyArg` / `@ModifyArgs` |
| `modifyConstant(...)`                  | 改写常量                                                         | `@ModifyConstant`            |
| `modifyExpressionValue(...)`           | 改写表达式求值结果                                               | `@ModifyExpressionValue`     |
| `modifyVariable(...)`                  | 改写局部变量                                                     | `@ModifyVariable`            |
| `modifyReceiver(...)`                  | 改写实例调用 / 字段写入的接收者                                  | `@ModifyReceiver`            |
| `wrapWithCondition(...)`               | 用布尔处理器决定 void 调用、字段写入、数组创建或 `NEW` 是否执行；跳过创建时结果为 `null` | `@WrapWithCondition`         |
| `wrapBranch(...)`                      | 决定条件跳转：true = 跳转，false = 顺序执行下一句                | `@WrapBranch`（OML 自有）    |
| `wrapOperation(...)`                   | 用 `Operation<R>` 包装调用 / 字段 / `NEW` / 类型检查 / 数组 / 算术 / 数值强转指令 | `@WrapOperation`             |
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
与 `@Slice`——被前端翻译成与 DSL 相同的注入规则：同一条管线、同一套自检。`@Constant` 只匹配
显式写出的判别字段——`nullValue`、数值与字符串字段，或用于类字面量的 `classValue`。在 `@Merged`
或接口载具上写 `@Implements(ExtraIface::class, …)` 会把声明的接口加到目标类：接口默认方法随即可用，
也能把目标实例转换为该接口（不做名称前缀）。`@Borrowed` 字段上的 `@Mutable` 会清除目标字段的
`final`，使合并进来的、位于构造器之外的方法也能写它。

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

`@Cancellable` 标记 `@WrapOperation` handler 的最后一个参数：目标返回 void 时是 `HookContext`，
否则是 `HookValue<T>`。调用 `cancel()` 后，handler 一返回目标方法就立即返回；
`HookValue.setReturnValue(v)` 还会同时给出返回值。没有取消时，被包装操作的结果照常往下传递。
目前覆盖调用、字段、类型检查与数组锚点，尚不包括比较与 `NEW` 包装锚点。

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
  活跃局部变量，可限定只查参数槽）。`@DefinitionLocal` 设 `print = true` 会在匹配的读取指令处
  打印解析到的槽位与局部变量表；声明了却始终解析不到的局部变量会出现在未命中提示里。声明会在
  启动期检查：模式用到的每个标识符与类型都必须已声明（或属于默认的 `length` 与原始类型名），
  拼写错误会带着模式文本在启动时报错。完全没有命中时，织入日志会给出最接近的部分匹配——尝试匹配的
  子模式及其指令——或者报告 `ordinal` 越界。
- 捕获到的比较会物化为布尔值：上面的例子看到的是**源码层**的结果（max(…, 3) > 0 是否成立），
  分支会跟随改写后的值。表达式上的 `@WrapBranch` 则直接收到跳转比较的操作数，由 handler 决定
  分支走向；`long`/`float`/`double` 比较（lcmp/fcmp/dcmp 接跳转）会收到两个源操作数，由 handler
  决定原始分支。比较上的 `@WrapOperation` 会把比较值（复杂比较则是源操作数）和一个
  `Operation<Boolean>` 交给 handler，后者可用任意值重新求值源码层比较。
- 整段字符串拼接可以作为表达式匹配；方法引用、强转、`instanceof`、算术、数组读写与数组创建都在
  语法范围内。用 `@WrapOperation` 包装整段拼接时作用在它的 `invokedynamic` 上：handler 收到拼接的
  操作数，以及一个会重新执行同一调用点的 `Operation<String>`。数组的 `length` 可以写成 `?.length`
  匹配并包装：handler 收到数组与一个 `Operation<Integer>`。算术、移位、位运算、一元取负以及改变栈
  类型的数值强转（`i2l`、`d2i` 等）被表达式捕获后同样可以包装：handler 收到源操作数与一个会重新
  执行该指令的 `Operation<R>`。
- DSL 写法是 `atExpression("…")`，定义通过它的 `definitions` 参数传入。
- 复合指令按需展开：字符串拼接或 iinc 内部的捕获会精确落到对应部分。捕获的 `new` 在其构造器调用之后
  改写，数组字面量在最后一次写入之后改写。复合指令与拼接的捕获只对 `@ModifyExpressionValue` 和
  `@WrapOperation` 开放，其他注入器会报错。
- `@Redirect`、`@ModifyArg`、`@ModifyArgs`、`@ModifyReturnValue` 也接受 `@At("EXPRESSION")`：
  前三者作用于模式捕获到的调用，`@ModifyReturnValue` 则在捕获值产生之后替换它（handler 的参数与
  返回类型必须等于该值的类型）。`@Coerce` 用在 `@ModifyExpressionValue`、`@ModifyReturnValue`、
  `@ModifyArg`（单参数模式）、`@ModifyConstant`、`@ModifyVariable` 或 `@Redirect`（按参数位置）的
  handler 参数上可接受捕获值的引用父类型；标注在 handler 方法上则允许返回引用父类型，由引擎加
  `CHECKCAST` 转回。在 `@ModifyExpressionValue` 上，原始类型值会为引用参数装箱、并从引用返回值
  拆箱，因此 `(Object)Object` 也能用于原始类型表达式；其他注入器仍要求引用类型。此时 `@Redirect`
  的 handler 必须从被捕获调用的接收者与参数开始（实例调用要到织入期才能判定）；工厂重定向会被
  拒绝，而 `@ModifyArg(s)` 捕获 `new` 时会改写构造器参数。
- 多个 `@Expression` 可以用 `id` 区分，`@At(id = "…")` 选择其中一个，也可用作 `@Slice` 边界
  （`@Slice(from = @At(value = "EXPRESSION", id = "start"), …)`）。

不支持的 Fabric Mixin 形态（`Shift.BY`、动态 `targets`、`@Pseudo`、refmap、隐式模型切换）会启动期
报错，不会静默失效。

## Lambda 方法

Lambda 的生成名（`lambda$tick$0`）是编译器产物，任何改动都可能让它漂移。可以改为点名**包含**
lambda 的方法及它的函数式接口：

```java
@Lambda(interfaceType = Supplier.class, ordinal = 0)
@Inject(method = "tick", at = @At("HEAD"))
private static void onLambda(HookContext context) { … }
```

外层方法里有多个同接口 lambda 时，`ordinal` 选择第 N 个。引擎顺着 `LambdaMetafactory`
`invokedynamic` 的实现句柄找到合成方法，因此只支持实现体编译在**同一个类**里的 lambda；指向其他类的
方法引用不算。DSL 写法是 `lambdaMethod("tick", interfaceInternal = "java/util/function/Supplier") { … }`。
未命中时会列出外层方法里实际存在的 lambda。

## 性能

- `@Hooked` 载具上的处理器经生成的桥方法分发：每条桥是一个 invokedynamic 调用点，首次执行时绑定
  指向处理器的直接 MethodHandle，因此通知、值改写与重定向的稳定路径没有反射、没有捕获数组、也不装箱。
  可取消与可返回处理器使用按精确描述符生成的 stub（需要读回每次调用的上下文或句柄）；反射只作为失败回退。
- 最热的钩子优先用 `@Merged`：处理器就在目标类里，是普通直接调用。
- 热路径避免 `@ModifyArgs` 和可写 `LocalRef` 参数：两者每次调用都会分配对象（`@ModifyArg` 与只读
  `@Local` 不装箱）。`@WrapMethod` 的 Operation 捕获 `this`，每次调用分配；`@WrapOperation` 的
  Operation 是被缓存的无捕获 lambda。
- 结构性工作——dataflow 分析、表达式匹配与冲突检查——都发生在类加载期而不是每帧；解析后的表达式模式
  会跨多次解析缓存。

## 自检

所有规则在控制权交给游戏主线程之前重新验证：处理器存在性、静态性、签名一致性、命中数。两条会让锚点
指令**被替换**的规则（`@Redirect`、`@WrapOperation`、`@WrapBranch`、整方法包装）解析到同一处时，会在
类加载期报出双方身份——否则后者只会静默未命中；可叠加的载荷（通知、值改写、条件）不受影响。默认模式
`fail` 逐条打印问题并中止启动；`-Doml.injection.verify=warn` 只告警；`off` 关闭。要拿到改写耗时与
规模统计，加上 `-Doml.diagnostics=1`——这个开关是布尔的（任何非空且非 `false` 的值即启用，取值本身
没有含义）。
