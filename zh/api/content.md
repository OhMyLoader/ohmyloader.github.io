# 内容注册

内容注册分两条轨： **代码轨**（`ContentRegistry`，本页）与 **数据轨**（TOML 内容包，见文末）。
两者共用同一条管线：声明在启动期收集，在 **注册表冻结点**一次性材料化为原生内容，之后与 vanilla
内容不可区分。

::: warning 注册表冻结
Minecraft 的注册表在启动早期冻结，冻结后不可增删。OML 在冻结点把声明的材料化进去——这之后
（包括运行期）都不能再新增内容。内容声明请写在 [`declareContent`](#declarecontent) 内。
:::

## declareContent

`@Mod` 类额外实现 `OMLContentProvider`，加载器会在游戏主逻辑启动前调用它：

```kotlin
@Mod(id = "my_mod", name = "My Mod", version = "1.0.0")
class MyMod : OMLModInitializer, OMLContentProvider {
    override fun declareContent(registry: ContentRegistry) {
        // 在这里声明
    }
}
```

`registry` 已绑定本 mod 的命名空间：声明里的 id 不带域名，OML 按 mod id 绑定。

## 方块

```kotlin
val block = registry.declareBlock("ruby_ore") {
    destroyTime = 3.0f
    explosionResistance = 6.0f
    requiresCorrectToolForDrops = true
}
```

| 属性                          | 默认               | 说明                   |
|-------------------------------|--------------------|------------------------|
| `destroyTime`                 | vanilla 默认       | 硬度（破坏耗时）       |
| `explosionResistance`         | 跟随 `destroyTime` | 爆炸抗性               |
| `requiresCorrectToolForDrops` | `false`            | 是否需要正确工具才掉落 |

每个方块自动注册对应的方块物品。返回的 `OMLBlock` 在内容注册完成后可访问 `platform`（原生方块对象）——
需要版本特定行为时的逃生舱。

### 行为钩子

方块可以携带声明式行为钩子： **行为实现由版本 adapter 提供**（它材料化自己的 `Block` 子类），mod 这边
只写普通 lambda。原版行为始终照常执行——行为方块就是"普通方块 + 钩子"。

```kotlin
registry.declareBlock("trap_floor") {
    onStepOn { event ->
        if (!event.isClient) {
            // 服务端：施加伤害、效果——需要时经 event.level / event.entity 逃生舱
        }
    }
    onHit { event ->
        // 玩家刚开始挖掘这个方块
    }
}
```

| 钩子       | 触发时机                                  | 事件                                                       |
|------------|-------------------------------------------|------------------------------------------------------------|
| `onStepOn` | 有实体站在方块上的每个 tick，双端都会触发 | `OMLStepOnEvent` —— x/y/z、`isClient`、`level`、`entity`   |
| `onHit`    | 玩家开始破坏方块                          | `OMLBlockHitEvent` —— x/y/z、`isClient`、`level`、`player` |

`level` 与 `entity`/`player` 是原生版本对象——与 `platform` 同一条逃生舱。玩法效果请以 `isClient`
为闸门：钩子双端都会触发。

### 方块实体：机器

`blockEntity` 给方块一个服务端 tick 和一个 **持久化数据存储**——机器就是这两块拼出来的：

```kotlin
registry.declareBlock("press") {
    blockEntity {
        tick { event ->
            val progress = event.data.getInt("progress") + 1
            event.data.putInt("progress", progress)   // 随存档持久化
        }
    }
}
```

- `tick` 在区块加载期间每个游戏 tick 运行一次， **仅服务端**（客户端收不到该事件——机器 tick 是
  模拟概念）。
- `event.data` 是 `OMLBlockData`：基础类型键值对（`int` / `long` / `float` / `double` / `boolean` /
  `string`），随世界持久化；写入会标记方块实体等待下次自动保存。
- 行为钩子与方块实体可以自由组合在同一个方块上。

### 世界生成：矿石

`generateAsOre` 让方块作为矿脉自然生成。它材料化为数据包 worldgen 文件并合并进目标生物群系——
与任何数据包矿石一样， **只影响新生成的区块**：

```kotlin
registry.declareBlock("ruby_ore") {
    destroyTime = 3.0f
    requiresCorrectToolForDrops = true
    generateAsOre {
        veinSize = 8        // 每条矿脉的方块数
        perChunk = 6        // 每区块的尝试次数
        minY = 16
        maxY = 64           // 梯形高度分布
        biomes += listOf("minecraft:forest", "minecraft:taiga")  // 留空 = 所有生物群系
    }
}
```

矿脉替换石器家族（`minecraft:stone_ore_replaceables`）；`biomes` 留空在下界/末地同样安全——
下界岩与末地石不匹配替换标签。

## 物品

```kotlin
registry.declareItem("ruby_sword") {
    maxDamage = 592
    attackDamage = 7.0
    attackSpeed = -2.4   // vanilla 基础 4.0 → 实际 1.6
    miningSpeed = 1.0f
    toolDamagePerBlock = 2
    minesAndDrops("minecraft:stone", 8.0f)   // 对石头：挖掘速度 8 且掉落
    overrideSpeed("minecraft:dirt", 4.0f)    // 对泥土：挖掘速度 4，掉落同 vanilla
    deniesDrops("minecraft:bedrock")         // 永不掉落
}
```

| 属性                         | 默认           | 说明                                        |
|------------------------------|----------------|---------------------------------------------|
| `maxDamage`                  | 无（不可损坏） | 最大耐久，>0 时显示耐久条                   |
| `attackDamage`               | 无             | 主手攻击伤害 **加成值**（vanilla 空手 1.0） |
| `attackSpeed`                | 无             | 主手攻击速度 **加成值**（vanilla 基础 4.0） |
| `miningSpeed`                | –              | 无匹配规则时的默认挖掘速度（需有工具规则）  |
| `toolDamagePerBlock`         | `1`            | 每破坏一个方块的耐久消耗                    |
| `canDestroyBlocksInCreative` | `true`         | 创造模式能否瞬间破坏                        |

工具规则的语义：`minesAndDrops` = 匹配方块按指定速度挖掘 **且掉落战利品**；`overrideSpeed` = 只改速度、
掉落同 vanilla；`deniesDrops` = vanilla 速度且永不掉落。这些映射到原生的 `DataComponents.TOOL`。

## 配方与掉落

### 合成

```kotlin
// 有序合成：4 个 ruby 合成 1 个 ruby_block（pattern 行引用 key 映射，' ' 为空格）
registry.declareShapedCrafting(
    result = "my_mod:ruby_block",
    pattern = listOf("RR", "RR"),
    key = mapOf('R' to "my_mod:ruby"),
)

// 无序合成：材料任意摆放
registry.declareShapelessCrafting(
    result = "my_mod:ruby",
    ingredients = listOf("my_mod:ruby_ore", "minecraft:stick"),
    count = 2,
)
```

pattern 规则：1-3 行、每行 1-3 格、各行等宽、每个非空格字符必须有 key 条目——格式错误在声明时
直接抛出，早于内容包加载。裸材料 id 自动补上 mod 命名空间。数据包文件 id 由 result 派生
（`my_mod:ruby_block` → `my_mod_ruby_block`）；两个配方产出相同时，第二个加数字后缀。

### 熔炼

```kotlin
// 熔炼（furnace 可选 SMELTING / BLASTING / SMOKING，默认 SMELTING）
registry.declareSmelting(
    input = "minecraft:raw_iron",
    result = "minecraft:iron_ingot",
    experience = 0.7,
    cookingTime = 200,
)

// 方块掉落改写：破坏 ruby_ore 掉 1~3 个 ruby
registry.declareBlockDrop(block = "ruby_ore", drop = "my_mod:ruby", dropCountMin = 1, dropCountMax = 3)
```

配方与掉落表材料化为数据包 JSON，经 OML 注入的资源包走 **vanilla 自己的数据包重载路径**——
服务端权威、自动同步到客户端。

### 伤害类型

mod 造成的伤害也可以有自己的类型：自己的死亡提示名、自己的难度缩放、以及配套的原版受击音效。

```kotlin
registry.declareDamageType(
    id = "melt",                       // 注册表与 hurt() 里看到的是 my_mod:melt
    messageId = "my_mod.melts",         // 死亡提示用的 key
    scaling = "when_caused_by_living_non_player",
    effects = "burning",
    exhaustion = 0.3f,
)
```

`scaling` 可取 `never`、`when_caused_by_living_non_player`、`always`；`effects` 可取 `hurt`、`thorns`、
`drowning`、`burning`、`poking`、`freezing`；`deathMessageType` 可取 `default`、`fall_variants`、
`intentional_game_design`。两个可选项未设置时不会写进文件，好让游戏套用自己的默认值，而不是由 OML 猜。

这与合成表走的是同一条数据包路径：OML 把 `data/my_mod/damage_type/melt.json` 写进注入的资源包，游戏的
重载把它注册成条目——于是它在 `server.registry(Registries.DAMAGE_TYPE)` 里读得回来，26.3 的
[`hurt`](/zh/api/native) 扩展也能像用原版 id 一样用 `"my_mod:melt"`，而 handler 在 `LIVING_HURT`
里读到的正是声明里写的 `messageId`。未知的枚举名在**声明处**就被拒绝并给出警告：否则那个文件会在数据包
重载时被 codec 悄悄丢弃，没人知道伤害类型为什么不见了。

### 时钟与它上面的时刻

26.3 的时间按注册表 id 寻址的**时钟**计，而 `/time set` 能把时钟移到的那些具名时刻，是时间线声明的
**标记（marker）**。两者都是数据包条目，所以 mod 可以给自己开一片时间域：

```kotlin
registry.declareClock("tide")                 // 变成 my_mod:tide——时钟除了身份什么都不带
registry.declareTimeline("surge") {
    clock = "tide"                            // 这些标记移动的是哪个时钟；裸 id 绑定到本命名空间
    periodTicks = 24000                       // 一个周期；不写则标记永不重复
    marker("low_tide", 0)                     // 不出现在 /time set 的候选里
    marker("high_tide", 12000, inCommands = true)
}
```

OML 把 `data/my_mod/world_clock/tide.json` 与 `data/my_mod/timeline/surge.json` 写进注入的资源包，游戏的重载
把它们注册进 `Registries.WORLD_CLOCK` 与 `Registries.TIMELINE`。游戏接下来做的事才是重点：
`ServerClockManager` 给**每一个已注册的时钟**都跑一个实例，于是 `my_mod:tide` 每个游戏 tick 走一格、也照常同步给
客户端，哪怕没有任何维度跑在它上面；而 [`applyMarker`](/zh/api/native) 能把它移到 `"my_mod:high_tide"`——这与
`/time set` 移动主世界时钟是同一条路径。用来确认声明真的落地的读取是
[`timelineIds`、`clockDrivenBy` 与 `timeMarkersOf`](/zh/api/native)。

拒绝用的还是游戏自己的规则，只是提前到 mod 声明时而不是数据包加载时：标记的 tick 必须落在声明的周期内
（时间线 codec 的检查）、一个标记在每个时钟上只属于一条时间线（注册表校验器的检查，冲突会让整条时间线
整条消失）、时间线必须指明时钟，而本包没有声明条目的时钟也会被拒绝——codec 在加载时解析这个引用，引用坏了
时间线就无声失踪。声明顺序有要求：**先声明时钟，再声明驱动它的时间线**（收集按顺序进行）。

轨道（tracks，时间线的属性关键帧那一半）没有声明形态：它的值类型逐属性而变、且面向版本，需要请自己写那份 JSON。

### 维度

维度类型与维度同样是数据包条目，而 26.3 在服务端启动时会为 `dimension` 表里的**每一条**建一个世界——
所以这是一整个维度，不是还需要 mod 自己驱动的一处注册：

```kotlin
registry.declareDimensionType("deep") {
    skyLight = false                      // 游戏自己的"露天"判定的输入之一
    ceiling = true
    minY = 0
    height = 128
    logicalHeight = 128
    ambientLight = 0.1f
    skybox = "none"
    clock = "tide"                        // 这个维度跑在上面声明的那个时钟
    timelines += "surge"
}
registry.declareDimension("deep_home") {
    type = "deep"                         // 必填；裸 id 绑定到本命名空间
    layer("minecraft:bedrock", 1)         // flat 生成器的地面，自下而上叠
    biome = "minecraft:plains"
}
```

于是 `server.levelById("my_mod:deep_home")` 会回一个活着的服务端世界，它的
[`dimensionTypeId`、`dimensionType()` 里的数字与 `clock`](/zh/api/native) 就是声明写下的那些。这些字段不是装饰：
游戏自己的 `canHaveWeather()` 是 `hasSkyLight && !hasCeiling && dimension != theEnd`，因此一个有顶、无日光
的类型让那里根本不可能有天气，而同一个调用在主世界仍然回答"可以"。

`declareDimensionType` 的默认值取自 vanilla 自己的主世界，因为游戏的 codec 把十一个字段标成必填；codec
自带默认的那四个（`has_fixed_time`、`skybox`、`cardinal_light`、`attributes`）在 mod 未设置时不写进文件。
`declareDimension` 写出游戏无需代码就能构建的三种生成器：`flat`（一层层叠起来的方块）、`noise`（一个
settings id 配一个固定生物群系）与 `debug`。

声明处的拒绝用的还是游戏 codec 的窗口，因为一个超出范围的包会让这个类型——以及所有指名它的维度——从注册表里
消失，而日志不会说是哪个包写的：`min_y` ∈ -2032..2031、`height` ∈ 16..4064、`logical_height` ∈ 0..4064、
`coordinate_scale` ∈ 0.00001..30000000、`ambient_light` ∈ 0.0..1.0、光照等级 ∈ 0..15、`infiniburn` 必须是
`#namespace:tag` 引用、`skybox` 必须是游戏那三个名字之一、flat 的每一层必须是正高度的方块 id；本包没声明过的
`type` 或 `clock` 同样被拒（**先声明它们**：收集按顺序进行）。

### 标签

标签是游戏自己给"一批注册表条目"起的名字，而行为读的就是这个组——`#minecraft:is_fire` 决定哪种伤害会被免疫火的
实体挡掉，`#minecraft:mineable/pickaxe` 决定矿石掉落什么。`declareTag` 写出的就是游戏标签加载器读的那个文件：
`data/<标签命名空间>/tags/<注册表路径>/<标签路径>.json`。

```kotlin
registry.declareTag("minecraft:damage_type", "minecraft:is_fire") { element("melt") }
registry.declareTag("minecraft:damage_type", "melting_causes") {
    element("melt")
    tag("minecraft:is_drowning")                        // 另一个组的成员并进来
    element("minecraft:some_optional", required = false) // 不存在也行，存在就用上
}
```

标签的**命名空间决定文件落在哪**，而不是谁写的：写 `minecraft:is_fire` 就是加入原版那个组（这是最常见的用法），
而裸写 `melting_causes` 会在声明方自己的命名空间里开一个新组。因为游戏对每个标签只读一个文件，凡是提到同一个标签
的包都会进到同一个文件里——两个 mod 加入 `#minecraft:is_fire`，成员按声明顺序合并并去重。第二个声明如果要求相反
的 `replace` 会被拒绝，日志会把两个包都点名：一个文件不可能既是"往组里加东西"又是"组的全部内容"，OML 不按声明
顺序猜。

`replace = true` 让文件里的成员成为该组的全部内容，原版包放进去的成员就此消失。真机实测：一个包把
`#minecraft:is_freezing` 换成自己的一条成员后，游戏拿到的就恰好只有那一条——这也说明 OML 注入的包在标签上排在
内置资源**之上**。

声明处就拒绝、而不是让游戏把文件存下却永远读不到情况有：注册表名或标签名不是合法的数据包路径（`worldgen/biome`
是一个名字，`worldgen//biome` 不是）、成员 id 不是数据包 id、以及一个既不想替换、又没有任何成员的组——什么都不加
的文件没有可说的内容。

## 读回注册表

这些表就是游戏自己的那几张——上面的声明正是材料化进它们，所以 mod 的内容与原版条目
完全同等地读得回来：

```kotlin
import org.ohmyloader.api26_3.*                        // 按 id 寻址的读取

BuiltInRegistries.BLOCK.byId("my_mod:ruby_ore")          // 那个 Block，或未注册时为 null
BuiltInRegistries.BLOCK.contains("my_mod:ruby_ore")      // 这个 id 存在吗
BuiltInRegistries.BLOCK.ids()                            // 表里的全部 id
BuiltInRegistries.BLOCK.membersOf(Registries.BLOCK, "minecraft:dirt")  // 带该标签的 id 列表
BuiltInRegistries.BLOCK.tagsOf("minecraft:stone")        // 该 id 属于哪些标签
BuiltInRegistries.BLOCK.tagIds(Registries.BLOCK)         // 这张表持有的全部标签
```

`tagIds` 分得清"空标签"与"游戏根本没读到的标签"：放在加载器不会扫的目录里的标签文件，根本不会留下标签，
而被采纳却没有成员的标签是真实存在的空标签。另外两个回答都来自游戏自己：`membersOf` 读重载建好的 holder
集合，`tagsOf` 读该 holder 身上挂的标签。

任何一张都可以这样读：`BuiltInRegistries.BLOCK`、`ITEM`、`MOB_EFFECT`、`SOUND_EVENT`、`ENTITY_TYPE`、
`ATTRIBUTE`、`GAME_RULE`、`PARTICLE_TYPE` 是静态表，而伤害类型、世界时钟与时间线是数据包表，需要运行中的服务端——
`server.registry(Registries.DAMAGE_TYPE)`、[`clockById`](/zh/api/native) 与
[`timelineIds`](/zh/api/native) 取的就是它们的 id，[`gameRuleValue` / `setGameRule`](/zh/api/native) 也一样。
未注册的 id 对 `contains` 答 `false`、对
`membersOf` / `tagsOf` 答空列表，而 `byId` 答 null 而不是表的默认值：写错的 id 是安静的「没有」，不会被当成空气或寂静。

::: warning 伤害类型、时钟与时间线要有运行中的服务端
这三张表不在游戏的内置表里：它们由数据包加载，所以在服务端存在之前读它们会抛出
一条指名道姓的错误，而不是回一个空列表——空列表会谎称「这些伤害类型 / 时钟 / 时间线都不存在」。
:::

::: warning 要等游戏起来再读
这些表由游戏自身的 bootstrap 填充，而 mod 的初始化跑在它前面——在 `onInitialize` 里读它们，失败方式
与过早读游戏注册表一样。请从背后已经有运行中游戏的事件里读（tick、进世界、命令执行）。
:::

## 数据轨：TOML 内容包

不需要写代码的内容：声明写在 **`.oml` 归档**根目录的 `content.toml`（普通 zip 改名，目录结构见下方
"分发形态"）。归档名即命名空间，包内可声明方块、物品与配方：

```toml
[block.ruby_ore]
destroy_time = 3.0
explosion_resistance = 6.0
requires_correct_tool = true

[item.ruby]
max_damage = 64
attack_damage = 2.0
# 工具规则是内联表数组，每个方块一项。
mines_and_drops = [{ block = "minecraft:stone", speed = 8.0 }]
override_speed = [{ block = "minecraft:dirt", speed = 4.0 }]

[crafting.ruby_block]
type = "shaped"
pattern = ["RR", "RR"]
key = { R = "ruby" }

[crafting.ruby_from_ore]
type = "shapeless"
count = 2
ingredients = ["ruby_ore", "minecraft:stick"]

[smelting.ruby]
input = "raw_ruby"
experience = 0.7
cooking_time = 100
# furnace = "blasting"   # smelting（默认）/ blasting / smoking

[loot.ruby_ore]
drop = "raw_ruby"
drop_count_min = 1
drop_count_max = 3

[damage_type.melt]
message_id = "ruby_pack.melts"
effects = "burning"
exhaustion = 0.3

[clock.tide]

[timeline.surge]
clock = "tide"
period_ticks = 24000
markers = { low_tide = 0, high_tide = { ticks = 12000, in_commands = true } }

[dimension_type.deep]
sky_light = false
ceiling = true
min_y = 0
height = 128
logical_height = 128
ambient_light = 0.1
skybox = "none"
clock = "tide"
timelines = ["surge"]

[dimension.deep_home]
type = "deep"
layers = [ { block = "minecraft:bedrock", height = 1 } ]
biome = "minecraft:plains"

[tag.fire_join]
registry = "minecraft:damage_type"
tag = "minecraft:is_fire"
values = ["melt", "#minecraft:is_projectile", { id = "minecraft:optional", required = false }]

[tag.my_group]
registry = "item"
tag = "ruby_tools"
values = ["ruby_sword"]
replace = true
```

标签段是唯一把 id 写在**字段**里的：TOML 的裸键写不出 `minecraft:is_fire` 里的 `:`，也写不出
`worldgen/biome` 里的 `/`，而这两个都是再正常不过的标签名。于是段名只是这条声明自己的标签，真正被游戏读取的是
`registry` 与 `tag`。`values` 的每一项可以是 id 字符串（前面加 `#` 就是引用另一个组），也可以是带 `id` 与
`required` 的内联表。

字段与代码 API 一一对应（`destroy_time` → `destroyTime` …）；`mines_and_drops` 与 `override_speed`
的条目带 `block` 与 `speed`，`denies_drops` 的条目只带 `block`。`[crafting.<产出物 id>]` 段声明一个合成配方：`type` 选择
shaped / shapeless；shaped 需要 `pattern`（行）与 `key` 内联表（图案字符 → 物品 id）；shapeless 需要
`ingredients` 列表；`count` 可选（默认 1）。`[smelting.<产出物 id>]` 段声明熔炼配方（`input` 必填，
`furnace` 选择 smelting / blasting / smoking，`experience` 与 `cooking_time` 可选）；`[loot.<方块 id>]`
段声明破坏该方块改为掉落 `drop`。`[damage_type.<id>]` 段声明伤害类型（`message_id` 必填，`scaling`、
`effects`、`exhaustion`、`death_message_type` 可选，可取值与代码 API 相同）。`[clock.<id>]` 段声明一个世界时钟，
不带任何字段（26.3 的时钟除了身份什么都不带）；`[timeline.<id>]` 段声明一条时间线（`clock` 必填，`period_ticks`
可选，`markers` 是内联表，其值要么是一个 tick 数，要么是 `{ ticks = …, in_commands = … }`——游戏自己的 codec
就接受这两种写法）。就接受这两种写法）。`[dimension_type.<id>]` 段用游戏自己的字段名（snake_case）：`sky_light`、`ceiling`、
`dragon_fight`、`coordinate_scale`、`min_y`、`height`、`logical_height`、`infiniburn`、`ambient_light`、
`monster_spawn_light_level`、`monster_spawn_block_light_limit`、`fixed_time`、`skybox`、`clock`、`timelines`，
全部可选且默认取 vanilla 主世界的值；`[dimension.<id>]` 段接受 `type`（必填）、`generator`（`flat` / `noise` /
`debug`）、`layers`（`{ block = …, height = … }` 内联表数组）、`noise_settings`、`biome`、`features`、`lakes`。
方块段里的 `ore` 内联表对应 `generateAsOre`（`vein_size`、
`per_chunk`、`min_y`、`max_y`、`biomes`）。格式错误（图案不齐、未知类型、缺字段）会让内容包加载失败
并说明原因。TOML 包与代码 mod 共享同一条
收集 → 冻结材料化管线，资产注入也把 TOML 包的命名空间当作 mod 域对待。字段拼错会在启动日志里
被逐条点名——不存在静默忽略。数据轨 **不**覆盖：行为钩子与方块实体是 mod 代码，没有 TOML 形态。

散装 `.toml` 文件丢进 `mods/` **不是**受支持的包形态：它无法携带自己的贴图，方块会渲染成缺失材质，
因此 loader 会明确报错并拒绝加载。请打成 `.oml` 归档。

## 分发形态：`.oml` 归档

内容包以 **`.oml` 归档**分发（普通 zip 改名）：根目录放 `content.toml`，随包携带自己的 `assets/`
与 `data/`：

```
MyPack.oml (zip)
├── content.toml
└── assets/
    └── my_pack/
        ├── textures/block/ruby_ore.png
        └── lang/en_us.json
```

丢进 `mods/`。归档名即命名空间；归档内的贴图与 lang 经 OML 注入的资源包对外服务。

## 热重载

内容轨的配方跟随 vanilla 的数据包重载：

- **贴图 / lang / 模型**：`F3+T` 会重新扫描 mod jar 与 `.oml` 归档，改动的文件当场生效。
- **合成 / 熔炼配方与掉落表**：修改包内声明后执行 `/reload`（或 `F3+T`），loader 从磁盘重新读取内容包，
  数据包 JSON 以最新内容应答。矿石 worldgen 文件同样随重载刷新，但世界生成本身只作用于新生成的区块。
- **方块 / 物品本体**：不可热重载。注册表在启动早期冻结，新增或修改方块 / 物品需要重启——
  这是 vanilla 的约束，不是 OML 的限制。
