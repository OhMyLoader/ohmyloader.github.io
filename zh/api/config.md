# mod 配置

每个 mod 一个配置文件：`<gameDir>/config/<mod id>.toml`，通过 `ModContext.config` 访问。模型是声明式的
——mod 在 `onInitialize` 里声明自己的条目和默认值，loader 把文件里还缺的部分写进去，之后读取时文件里有
这个键就用文件的值、没有就用默认值。这套表面里不出现 TOML 类型、不出现存/读循环、也不出现配置界面：
那些是 loader 的事，不是 mod 的事。

只有实现了 `OMLModInitializer` 的 mod 才拿得到 `ModContext`，因此也只有它们有配置。

## 先声明，再读取

```kotlin
@Mod(id = "my_mod", name = "My Mod", version = "1.0.0")
class MyMod : OMLModInitializer {

    private lateinit var context: ModContext

    override fun onInitialize(context: ModContext) {
        this.context = context
        context.config.define("ping_prefix", "pong", "Prefix of the /mycmd reply")
        context.config.define("loud_by_default", false, "Whether the reply shouts")
        context.config.define("max_veins", 8, "Veins per chunk, 0 disables the feature")
        context.config.define("spread", 0.25, "Fraction of chunks affected")
    }
}
```

`define` 接受四种值类型——`Int`、`Boolean`、`Double`、`String`——外加一个可选注释，注释会写到文件里这一行
键的上方。同名声明两次会替换前一次；从未声明过的名字读不到：`getInt("nope")` 抛
`IllegalStateException: config entry 'nope' was never defined by my_mod — define it before reading`。
声明要放在 `onInitialize` 里，不要放进某个 getter 里懒做——否则第一次读取可能跑在声明之前。

## loader 写出来的文件长什么样

文件在 `onInitialize` 返回之后立刻生成（内容就来自上面那些声明），长这样：

```toml
ping_prefix = "pong"

# Whether the reply shouts
loud_by_default = false

# Veins per chunk, 0 disables the feature
max_veins = 8

# Fraction of chunks affected
spread = 0.25
```

键按声明顺序出现，每条前面一行 `#` 注释，条目之间空一行。 **已有文件永远不会被重写**，所以用户自己的改动
和手写的注释都能跨版本保留——副作用是新版 mod 新增的条目不会出现在玩家已有的文件里。文件里缺某个键时读取
仍返回声明的默认值，所以文件不完整不算 bug；想让使用者看到新选项，得 mod 自己去说。

::: warning 写不回去的默认值
字符串默认值是用普通引号包起来写出的，不做转义。默认值里含 `"` 或换行就会写出一个解析不了的文件，而解析失败
的文件会让这个 mod 的初始化失败。字符串默认值请保持单行、不含引号字符。
:::

## 读取值

| 读取方法           | 对应的声明             |
|--------------------|------------------------|
| `getInt(name)`     | `define(name, 8)`      |
| `getBoolean(name)` | `define(name, false)`  |
| `getDouble(name)`  | `define(name, 0.25)`   |
| `getString(name)`  | `define(name, "pong")` |

文件里带着这个键、且类型对得上，getter 就返回文件的值。三种情况会出岔子，其中只有一种是致命的：

- **键缺失** → 静默返回声明的默认值。这正是旧版 mod 写出的文件的常态。
- **类型不符**（`max_veins = "lots"`）→ 记一条 `Config` 警告，带上文件名、键名和两边的类型，然后返回默认值。
  配置写错不该把启动搞崩。
- **文件本身解析不了**（手改坏了）→ 异常在这个 mod 初始化时抛出，于是这一个 mod 被标记为失败并记日志，游戏仍然
  启动；改好文件再重启，这个 mod 就回来了。

## 重载语义

文件只在 mod 初始化时解析 **一次**。没有文件监听、没有热重载、`/reload` 也不会重新读它：改配置要下一次启动才
生效。getter 读的是内存里的那份快照而不是磁盘，所以每 tick 调一次也谈不上开销——反过来，mod 自己再缓存一层
也只是多养一份过期值。

## 文件实际支持多少 TOML

解析走 OML 自带的极简 TOML reader，而配置表面只看根表。实际边界是：

| 可用                                     | 不可用                                                                  |
|------------------------------------------|-------------------------------------------------------------------------|
| `key = 42`、`key = true`、`key = "text"` | `[section]` 表——解析得到，但被忽略                                      |
| `#` 注释、空行                           | `[[数组套表]]`、带引号的键、日期、十六进制整数                          |
| 值必须是单行（不支持多行字符串）         | 数组 / 内联表——能解析，但永远匹配不上声明的标量类型（警告后回落默认值） |

平铺的一串 `key = 标量` 就是全部支持的形状，也正是 loader 自己生成的形状。

## 线程

文件值在构造时填好，之后不再改动；条目表只在 `onInitialize` 里写。读取既没有锁也不限侧，所以从网络线程或
工作线程读配置都是安全的——读到的都是启动时那份快照。

::: warning 仍在沉淀
`config` 属于 **已提供、仍在沉淀**层：0.x 阶段允许调整形态，调整会记进发布说明。
:::
