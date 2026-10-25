# 斜杠命令

mod 只对着 loader 的类型声明命令树，不碰 Brigadier，也不碰任何版本的命令类。`declareCommands` 在
`onInitialize` 之后被调用一次，它留下的只是一棵纯数据树；每版本适配器在游戏 **每次**构建 dispatcher 时
（服务端启动、以及每一次数据包重载）把这棵树翻译成真正的命令。这个分工正是命令能在 dispatcher 重建后
继续工作的原因：mod 自己往 dispatcher 里注册的话，第一次重载就会把命令丢掉。

## declareCommands

`@Mod` 类实现 `OMLCommandProvider`：

```kotlin
@Mod(id = "my_mod", name = "My Mod", version = "1.0.0")
class MyMod : OMLModInitializer, OMLCommandProvider {

    override fun declareCommands(commands: OMLCommandRegistry) {
        commands.register("mycmd") {
            permissionLevel = 2
            executes { source ->
                source.reply("hello from my_mod, executed by ${source.name}")
            }
            argument("count", OMLArgumentType.INTEGER) { count ->
                executes { source -> source.reply("count=${source[count]}") }
                subcommand("loud") {
                    executes { source -> source.reply("COUNT=${source[count]}") }
                }
            }
        }
    }
}
```

`register` 声明根字面量（`/mycmd`）。`subcommand` 加一个子命令字面量，`argument` 加一个带类型的参数；
`executes` 可以挂在任何节点上，包括已经有子节点的节点——上面的 `/mycmd`、`/mycmd 5`、`/mycmd 5 loud`
是三个各自独立的处理器。`argument` 还会把参数句柄（`OMLArgument<T>`）传给配置回调——捕获它，
用 `source[handle]` 读取值，类型在编译期就定死。

## 声明节点的成员

| 成员                       | 含义                                                                                                         |
|----------------------------|--------------------------------------------------------------------------------------------------------------|
| `subcommand(name) { }`     | 字面量子节点：`/root <name> …`                                                                               |
| `argument(name, type) { arg -> }` | 带类型的子节点：`/root <name> <value> …`                                                                     |
| `executes { source -> }`   | 该节点作为命令终点时执行；处理器靠调用 `source.reply` / `source.replyError` 回答——它返回的值不会送到任何地方 |
| `permissionLevel`          | 该节点**及其以下所有节点**的最低权限等级                                                                     |
| `permissionNode`           | 调用者的权限集必须回答的细粒度节点 id（`mymod:build`）                                                       |

`permissionLevel` 默认 `0`（所有人）。等级为 `0` 的节点根本不会挂权限检查，所以受保护父节点下面一个没设
权限的子节点，仍然受父节点保护。

`permissionNode` 是更细的一道闸，两者同时设置时 **都要**通过：游戏的 OP 等级检查与节点检查。节点按 id 寻址——
与游戏自己的 `minecraft:chat/send_messages` 同一套写法——并由调用者自己的 `PermissionSet` 回答，
[`grantPermissionNode`](/zh/api/native) 写的就是这里。没有任何东西授予的节点会让命令既看不见也调不动；给某个
玩家授予，就只对那个玩家恢复可用。

## 参数类型

| `OMLArgumentType` | 游戏侧解析       | 读回类型  |
|-------------------|------------------|-----------|
| `WORD`            | 单个不带引号的词 | `String`  |
| `STRING`          | 带引号或单个词   | `String`  |
| `GREEDY_STRING`   | 吞掉整行剩余输入 | `String`  |
| `INTEGER`         | 整数             | `Int`     |
| `FLOAT`           | 带小数的数       | `Double`  |
| `BOOLEAN`         | `true` / `false` | `Boolean` |

句柄同时固定了参数的身份和值的类型，所以拼错名字或拿错类型是编译错误，不是运行期强转。读一个不在执行
路径上的参数会在处理器里抛 `… is not part of the executed path`——命令桥接层接住它，给调用者回一条红色的
`[my_mod] command failed: …`，同时把堆栈打进日志。

## 命令来源

每次调用会给处理器一个 `OMLCommandSource`：

| 成员                  | 含义                                                          |
|-----------------------|---------------------------------------------------------------|
| `name`                | 调用者的显示名——控制台是 `Server`                             |
| `hasPlayer`           | 只有玩家执行时为 true（控制台、function、命令方块都是 false） |
| `reply(message)`      | 成功通道：玩家收到聊天消息，控制台是普通 stdout               |
| `replyError(message)` | 失败通道：玩家侧渲染为红色                                    |
| `source[arg]`         | 读取一个已声明参数的值，类型由其 `OMLArgument<T>` 句柄决定    |
| `platform`            | 原生版本对象（26.x 是 `CommandSourceStack`）                  |

`platform` 就是那个常规逃生舱：当上面这套表面不够用时，用它去拿玩家、世界或游戏自己的权限状态。

## 权限等级

`permissionLevel` 对应的就是游戏的 OP 等级，不是 OML 自造的数字：

| 值   | 含义                |
|------|---------------------|
| `0`  | 所有人              |
| `1`  | 管理员（moderator） |
| `2`  | 游戏主管理员        |
| `3`  | 服主级管理员        |
| `4`+ | 服务器所有者        |

## 声明什么时候变成真命令

翻译发生在 dispatcher 构建的时刻，有两个注入点（客户端与专用服务端各一个），而每个重建出来的
dispatcher 只会被注册进去一次。由此有两条必须知道的推论：

- 改命令树要重启。`declareCommands` 只在 mod 初始化时跑过一次，之后游戏用的就是那棵树——数据包重载只是
  拿同一批声明重建 dispatcher。
- 一条坏声明会被隔离。Brigadier 会拒绝空名字、非法字符和重复的根字面量；桥接层记录
  `registering /<name> from mod [<id>] failed` 并跳过这一条命令，其他 mod 的命令照常落地。两个 mod 抢同一个
  根字面量时，先声明的那个赢，另一个就是上面那行日志——预计会撞名就用带命名空间风格的根名字
  （`my_mod_cool` 而不是 `cool`）。

## 建议与别名

游戏字面量补全之外的 Tab 补全走 `OMLArgumentType.WithSuggestions`：一个带建议的 `WORD`
参数，补全时提供这条命令接受的值。提供器看得到调用者，所以动态列表（比如在线玩家）与
固定列表是同一个形状：

```kotlin
argument("type", OMLArgumentType.WithSuggestions { _ ->
    listOf("minecraft:cow", "minecraft:pig")
}) { type -> … }
```

客户端在玩家输入时给出这些字符串并自行过滤——建议列表不会放宽解析器接受的取值。

根节点可以带 `aliases`：各自是完整的命令树——同样的参数、同样的处理器、同样的权限闸
——注册在主名旁边。游戏自己的补全会像任何字面量一样提供它们：

```kotlin
commands.register("kit") {
    aliases = listOf("playground")   // /playground 就是 /kit
    …
}
```

## 暂未覆盖

没有纯客户端命令。loader 自己就是通过同一套 API 注册了 `/oml mods`（列出已加载 mod 及版本，
初始化失败的用红色标出）和 `/oml version`；除示例模组的 `/techmod_ping` 之外，这两条就是能跑的
真实参考。

::: warning 仍在沉淀
命令 DSL 属于 **已提供、仍在沉淀**层：0.x 阶段允许调整形态，调整会记进发布说明。
:::
