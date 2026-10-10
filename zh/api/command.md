# 斜杠命令

mod 只对着 loader 的类型声明命令树，不碰 Brigadier，也不碰任何版本的命令类。`declareCommands` 在
`onInitialize` 之后被调用一次，它留下的只是一棵纯数据树；每版本适配器在游戏**每次**构建 dispatcher 时
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
            argument("count", OMLArgumentType.INTEGER) {
                executes { source -> source.reply("count=${source.getInt("count")}") }
                subcommand("loud") {
                    executes { source -> source.reply("COUNT=${source.getInt("count")}") }
                }
            }
        }
    }
}
```

`register` 声明根字面量（`/mycmd`）。`subcommand` 加一个子命令字面量，`argument` 加一个带类型的参数；
`executes` 可以挂在任何节点上，包括已经有子节点的节点——上面的 `/mycmd`、`/mycmd 5`、`/mycmd 5 loud`
是三个各自独立的处理器。参数值在处理器里按 `argument` 给的名字读取，且只有当这个参数真的落在被执行的那条
路径上时才读得到。

## 声明节点的成员

| 成员                               | 含义                                                            |
|------------------------------------|-----------------------------------------------------------------|
| `subcommand(name) { }`             | 字面量子节点：`/root <name> …`                                  |
| `argument(name, type) { }`         | 带类型的子节点：`/root <name> <value> …`                        |
| `executes { source -> }`           | 该节点作为命令终点时执行                                        |
| `permissionLevel`                  | 该节点**及其以下所有节点**的最低权限等级                        |
| `permissionNode`                   | 调用者的权限集必须回答的细粒度节点 id（`mymod:build`）           |

`permissionLevel` 默认 `0`（所有人）。等级为 `0` 的节点根本不会挂权限检查，所以受保护父节点下面一个没设
权限的子节点，仍然受父节点保护。

`permissionNode` 是更细的一道闸，两者同时设置时**都要**通过：游戏的 OP 等级检查与节点检查。节点按 id 寻址——
与游戏自己的 `minecraft:chat/send_messages` 同一套写法——并由调用者自己的 `PermissionSet` 回答，
[`grantPermissionNode`](/zh/api/native) 写的就是这里。没有任何东西授予的节点会让命令既看不见也调不动；给某个
玩家授予，就只对那个玩家恢复可用。

## 参数类型

| `OMLArgumentType` | 游戏侧解析         | 值类型    | 读取方式         |
|-------------------|--------------------|-----------|------------------|
| `WORD`            | 单个不带引号的词   | `String`  | `getString`      |
| `STRING`          | 带引号或单个词     | `String`  | `getString`      |
| `GREEDY_STRING`   | 吞掉整行剩余输入   | `String`  | `getString`      |
| `INTEGER`         | 整数               | `Int`     | `getInt`         |
| `FLOAT`           | 带小数的数         | `Double`  | `getDouble`      |
| `BOOLEAN`         | `true` / `false`   | `Boolean` | `getBoolean`     |

每种类型只对应一个 getter。getter 内部是不做检查的强转，因此拿错 getter 会在你的处理器里抛
`ClassCastException`——命令桥接层接住它，给调用者回一条红色的 `[my_mod] command failed: …`，同时把堆栈
打进日志。读一个不在执行路径上的参数名也是同一套表现（`… is not part of the executed path`）。

## 命令来源

每次调用会给处理器一个 `OMLCommandSource`：

| 成员                                    | 含义                                                          |
|-----------------------------------------|---------------------------------------------------------------|
| `name`                                  | 调用者的显示名——控制台是 `Server`                             |
| `hasPlayer`                             | 只有玩家执行时为 true（控制台、function、命令方块都是 false） |
| `reply(message)`                        | 成功通道：玩家收到聊天消息，控制台是普通 stdout               |
| `replyError(message)`                   | 失败通道：玩家侧渲染为红色                                    |
| `getString/getInt/getDouble/getBoolean` | 按声明名读取参数值                                            |
| `platform`                              | 原生版本对象（26.x 是 `CommandSourceStack`）                  |

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

## 暂未覆盖

除了游戏自带的字面量补全之外没有参数建议 / Tab 补全，没有命令别名，也没有纯客户端命令。
loader 自己就是通过同一套 API 注册了 `/oml mods`（列出已加载 mod 及版本，初始化失败的用红色标出）和
`/oml version`；除示例模组的 `/techmod_ping` 之外，这两条就是能跑的真实参考。

::: warning 仍在沉淀
命令 DSL 属于**已提供、仍在沉淀**层：0.x 阶段允许调整形态，调整会记进发布说明。
::
