# 游戏对象与 26.3 扩展层

游戏对象以游戏自己的类交给 mod：handler 读到的是 `ServerPlayer`、`BlockPos`、`DamageSource`；OML 提供的
能力是挂在这些类型上的扩展函数与属性，位于工件 `org.ohmyloader:oml-api-26_3` 的
`org.ohmyloader.api26_3` 包。

```kotlin
import org.ohmyloader.api26_3.*          // 扩展函数，以及 OMLGame / OMLRegistries
import org.ohmyloader.api26_3.event.Events
```

没有任何包装对象，也就没有"过期"这回事：读就是读游戏正在改的那个对象，写就走游戏自己的那条方法；下面
每一条"到底成没成"的判定都是回读游戏状态，而不是 OML 自己记的账。

::: warning mod 的类不要放在 `org.ohmyloader.` 前缀下
那一段是 parent-first：处在该前缀里的 mod 由启动器层定义，而启动器层的搜索路径只有游戏 jar、没有该版本
的运行库，于是它第一次引用 `net.minecraft.*` 就以 `NoClassDefFoundError` 收场。mod 按 child-first 加载，
这正是"mod 看到的 `net.minecraft` 与游戏运行的那个是同一个类"的前提。
:::

## 正在运行的游戏

`OMLGame` 按提问的一侧回答；两个成员都可能为 null，而在客户端 mod 初始化阶段拿到 null 是正常答案。

```kotlin
val server: MinecraftServer? = OMLGame.server   // 专用服务端，或单人的集成服务端
val client: Minecraft? = OMLGame.client         // 专用服务端上为 null
```

单人游戏把集成服务端跑在客户端进程里，因此同一份 mod 两侧都能拿到，不必自己判边。服务端句柄是加载器对
"当前在运行的那个服务端"的记录：它从服务端构造起就存在（早于第一个 tick），并在该服务端关闭后不再交出。

### `MinecraftServer` 上

| 调用                           | 含义                                                             |
|--------------------------------|--------------------------------------------------------------------|
| `dimensionIds`                 | 已加载维度的注册表 id                                              |
| `onlinePlayers`                | 当前在线玩家（与 `playerList.players` 同一份列表）                 |
| `playerByName(name)`           | 按记分板名字找到在线玩家，找不到为 null                            |
| `levelById(dimensionId)`       | 该维度已加载的 `ServerLevel`，未加载为 null                        |
| `broadcastMessage(text)`       | 在每位在线玩家的聊天里显示 `text`                                  |
| `gameRuleValue(ruleId)`        | 游戏规则按游戏自己的拼法读回（`"true"`），未注册 id 为 null        |
| `setGameRule(ruleId, value)`   | 用游戏自己的序列化器写入；id 未知或值解析不过返回 false            |
| `clockById(clockId)`           | 该 id 对应的 `Holder<WorldClock>`，没有注册则为 null               |
| `registry(registryKey)`        | 数据包表（`Registries.DAMAGE_TYPE`、`Registries.WORLD_CLOCK`），无服务端时为 null |
| `damageTypeIds` / `clockIds`   | 上面两张数据包表里的 id                                            |
| `tickCount`、`isDedicatedServer()` | 游戏自己的成员                                                |

### `Minecraft` 上

| 调用                      | 含义                                                          |
|---------------------------|----------------------------------------------------------------|
| `player`、`level`、`gui.screen()` | 游戏自己的成员：本客户端的玩家、正在渲染的世界、当前界面   |
| `currentScreen`           | `gui.screen()` 的属性写法，画面就是世界本身时为 null           |
| `scaledWidth` / `scaledHeight` | GUI 单位下的窗口尺寸，也就是 HUD 绘制所面对的坐标空间       |

## 世界

读在任何 `Level` 上都行；改动世界的调用声明在 `ServerLevel` 上，因为权威在那里——客户端世界拿的是服务端
下一跳就会覆盖掉的预测。

| `Level` 上的调用          | 含义                                                            |
|---------------------------|------------------------------------------------------------------|
| `dimensionId`             | 本维度的注册表 id，例如 `minecraft:overworld`                     |
| `isClientSide`            | 游戏自己的成员：渲染侧为 true                                     |
| `blockIdAt(pos)`          | 该位置方块的注册表 id                                            |
| `blockStateAt(pos)`       | 该位置的 `BlockState`，区块未加载时为 null                        |
| `setBlockAt(pos, blockId)`| 放置该方块的默认状态；id 未知返回 false                          |
| `setBlockAt(pos, state)`  | 放置一个状态（含邻块更新与客户端同步），并回报该位置现在是否就是它 |
| `isLoaded(pos)`           | 游戏自己的成员：该位置所在区块是否已加载                         |
| `containerAt(pos)`        | 方块实体的 `Container`；该方块没有槽位时为 null                  |
| `playSoundAt(id, x, y, z, volume, pitch, category)` | 为所有听得见的人播放一个已注册音效          |
| `clock`                   | 本维度所运行时钟的 `Holder<WorldClock>`，维度类型没指定时钟时为 null |
| `clockInstance`           | 上面的时钟按游戏自己的计数读回（`ClockInstance`）                |

| `ServerLevel` 上的调用             | 含义                                                        |
|------------------------------------|--------------------------------------------------------------|
| `entities()`                       | 该世界当前持有的全部实体——调用瞬间的快照，不是跟随变化的视图 |
| `entitiesOfType(typeId)`           | 其中类型 id 匹配的，例如 `minecraft:cow`                     |
| `spawnEntity(typeId, x, y, z)`     | 走 `/summon` 那条生成路径放进世界；id 不是实体类型、或游戏拒绝加入时返回 null |
| `spawnLivingEntity(typeId, x, y, z)` | 同上，但只认游戏视为"活体"的类型；抛射物返回 null，而不是当作一个没有血量的实体交出 |
| `spawnParticles(id, x, y, z, count, offsetX, offsetY, offsetZ, speed)` | 把简单粒子发给范围内所有客户端 |
| `spawnItemParticles` / `spawnBlockParticles` / `spawnDustParticles` | 需要自带参数的粒子走这三个具名调用 |
| `setWeather(raining, thundering, durationTicks)` | 向服务端那一条天气记录请求该状态       |

| `ClientLevel` 上的调用    | 含义                                                        |
|---------------------------|--------------------------------------------------------------|
| `renderedEntities()`      | 客户端这一帧渲染的实体——它自己的视角，会落后于服务端列表     |
| `entitiesOfType(typeId)`  | 对上面那份渲染列表做同样的过滤                               |

::: warning 未加载的位置没有意义
`blockIdAt` 不会失败，但对已加载区块之外的位置，它给出的是游戏自己的 getter 当下持有的东西——这次是
`minecraft:air`，下次可能是真实地形，取决于哪一侧、以及区块管理器恰好加载了什么。有意义的判定是
`isLoaded`；`blockStateAt` 在那种位置返回 null 正是为了说清这一点。
:::

::: warning 服务端专属的写，由类型拒绝而不是运行期拒绝
天气写、粒子发、时钟写、实体生成都声明在 `ServerLevel`（时钟在 `ServerClockManager`）上，因为游戏把权威放在
那里。客户端的 `ClientLevel` 根本没有这个调用可拒——编译期就过不去。因此真机门禁里不再有这几条"被拒"的断言：
旧的包装面能在运行期回报 false，这一版让它无法被表达。
:::

## 方块状态

id 只是半个故事：朝向不同的两个箱子都是 `minecraft:chest`。`BlockState` 是游戏自己的对象，属性按
blockstate JSON 使用的名字寻址。

```kotlin
val state = level.blockStateAt(pos) ?: return          // null：该位置未加载
val rotated = state.withProperty("facing", "east")     // null：没有这个属性，或值不合法
level.setBlockAt(pos, rotated)                         // 含邻块更新与客户端同步
level.blockStateAt(pos)?.property("facing")            // "east"
state.blockId                                          // "minecraft:chest"
state.propertyValues                                   // 该方块的全部属性及其当前值
```

`withProperty` 不给"改了一半但状态错误"的结果，而是返回 null：某个组合是否存在由游戏自己的状态表决定。改写
会回到 `/setblock` 用的那个参数解析器，所以属性不接受的值，被拒的方式与命令完全一致。

## 实体、活体与玩家

继承关系用游戏自己的：`Entity`、`LivingEntity`、`Player`、`ServerPlayer`。数据仍由注册表 id 寻址，因此凡是
游戏要 holder 的地方，扩展就收一个 id。

| `Entity` 上                | 含义                                                          |
|----------------------------|----------------------------------------------------------------|
| `typeId`                   | 实体类型的注册表 id，例如 `minecraft:cow`                       |
| `dimensionId`              | 它所在维度的注册表 id                                          |
| `discard()` 然后读 `isRemoved` | 游戏自己的移除，再回读判定——不适用于玩家：移除玩家实体只会让它与世界脱钩，连接还指着它 |

| `LivingEntity` 上         | 含义                                                            |
|----------------------------|------------------------------------------------------------------|
| `hasEffect(effectId)`      | 未注册 id 返回 false                                             |
| `applyEffect(effectId, durationTicks, amplifier = 0)` | 施加效果；重复施加遵循游戏自己的合并规则 |
| `removeEffect(effectId)`   | id 未知或本就没有该效果时返回 false                              |
| `attributeValue(id)` / `attributeBase(id)` | 游戏算出的值（基础值 + 修正）与纯基础值，按 `minecraft:max_health` 这类 id 寻址 |
| `setAttributeBase(id, value)` | 游戏会把写入值夹进该属性的取值范围，并施加它自己的后果         |
| `addAttributeModifier(attributeId, modifierId, amount, operation)` | 常驻修正，游戏会一直保留到被移除；`operation` 取 `add_value` / `add_multiplied_base` / `add_multiplied_total` |
| `removeAttributeModifier(attributeId, modifierId)` | 该 id 名下没有持有时返回 false                               |
| `hurt(damageTypeId, amount, attacker = null)` | 走游戏自己的伤害路径造成一次伤害                    |
| `ignite(ticks)` / `extinguish()` | 请求之后回读游戏自己的燃烧状态——免疫火焰的生物答 `false`，而不是被静默忽略 |
| `health`、`maxHealth`、`activeEffects`、`isOnFire`、`remainingFireTicks`、`heal(amount)` | 游戏自己的成员 |

`activeEffects` 交出的是游戏自己的 `MobEffectInstance`；`effectId` 给出它的注册表 id，`duration` 是剩余
tick 数，`amplifier` 从 0 起算，所以 0 就是一级。

`hurt(damageTypeId, amount, attacker)` 与怪物攻击走同一个钩子，因此 `LIVING_HURT` 的 handler 看得见它、可以
取消它、也可以改写数值——它是一次游戏行为，不是绕过这些规则的后门。

| `Player` / `ServerPlayer` 上 | 含义                                                         |
|-------------------------------|----------------------------------------------------------------|
| `openedMenuId`                | 游戏当前让玩家使用的菜单（`minecraft:generic_9x3`），静息时为 null |
| `closeMenu()`（服务端）       | 游戏自己的关闭，会把手上的物品退回物品栏；本来什么都没开时返回 false |
| `gameModeName`                | `survival` / `creative` / `adventure` / `spectator`，服务端尚未下发时为 null |
| `permissionLevel`             | vanilla 自己的等级：0 玩家、1 管理员、2 游戏主管、3 操作员、4 服主 |
| `sendSystemMessage(text)`     | 只向这位玩家显示 `text`——经它的服务端连接，所以多人客户端的本地玩家是空操作 |
| `giveItem(itemId, count)`     | 装不下时返回 false（装下的那部分仍然留下，与原版拾取一致）        |
| `teleport(x, y, z, dimensionId = null)` | 服务端权威；维度 id 未知或游戏拒绝该目的地时返回 false     |
| `playSound(id, volume, pitch)` | 让**这位**玩家听见，正是游戏自己的分侧行为                     |

## 物品堆、容器与槽位

```kotlin
val chest = level.containerAt(pos) ?: return            // null：这里没有存储
chest.setSlot(0, "minecraft:stone", 5)                  // 槽位拒绝时返回 false
chest.takeSlot(0, 3)?.count                             // 3 —— 取物由游戏自己的移除决定
chest.countOf("minecraft:stone")                        // 还剩 2
chest.openedByPlayerNames                               // 游戏认为正在使用该方块的玩家
```

| 调用                       | 含义                                                          |
|----------------------------|----------------------------------------------------------------|
| `ItemStack.itemId`         | 注册表 id；空堆报告空字符串，而不是报成空气                     |
| `Container.setSlot(slot, itemId, count)` | 先问方块自己的规则再写；被拒、id 未知、槽位不存在都返回 false |
| `Container.takeSlot(slot, count)` | 如实回报游戏取出了多少；槽位不存在返回 null              |
| `Container.countOf(itemId)` / `canPlace(slot, itemId, count)` | 存储自己的计数与规则，后者不写任何东西           |
| `Inventory.add(itemId, count)` | 像原版拾取那样摊到多个槽位；放不下返回 false                |
| `Inventory.remove(itemId, count)` | 最多取走 `count` 并回报实际取走的数量；只按物品 id 匹配，组件无需相同 |
| `Inventory.selectHotbarSlot(slot)` | 把手指指向游戏自己判定为快捷栏的槽位                     |

哪个槽收什么东西，是**方块**的决定而不是 OML 的决定：`setSlot` 写之前一定调用游戏的 `canPlaceItem`，因此熔炉
产出槽与燃料槽拒绝 OML 的方式与拒绝玩家完全一致——写不进去，不是加载器替方块做主。读槽位请用游戏自己的
`getItem(index)`：越界时与游戏一样抛异常，边界就是 `containerSize`。

修改本身不带锁：请在拥有该玩家的那条线程上执行，这正是 [主线程调度器](/api/scheduler) 的用途。

::: warning 菜单 id 不是方块 id
`openedMenuId` 报的是游戏让玩家使用的那个**菜单**，两者不同：单个箱子打开的是
`minecraft:generic_9x3`，不是 `minecraft:chest`。每位玩家都恒定持有物品栏菜单，那不算"打开了界面"，因此
此时报 null。
:::

::: warning openedByPlayerNames 跟着菜单，不跟着距离
这份名单是游戏自己的记账，而箱子的记账来自**菜单的构造器**，所以只有菜单真实存在时名单里才有玩家。站在一个
开着的箱子旁边，不会被记成"正在使用它"。
:::

## 天气与游戏规则

天气是**整个服务端一条记录**，每个维度各自朝它斜坡。`isRaining` / `isThundering` 就是游戏自己的实时读数——
它每个天气 tick 移动 0.01，并在 0.2 以上称为下雨、0.9 以上称为雷暴——于是一次写入二十来 tick 后才显出雨，
雷暴要近百 tick。雷暴按雨量缩放，因此 `setWeather(raining = false, thundering = true)` 被拒。只有露天维度
可能有天气（游戏自己的判定把末地按名字排除），别处无论记录怎么设都不会读到 true。

```kotlin
val overworld = OMLGame.server?.levelById("minecraft:overworld") ?: return
overworld.setWeather(raining = true, durationTicks = 600)
overworld.isRaining                             // 约 20 个 tick 内是 false，之后是 true——斜坡归游戏
```

`durationTicks` 是游戏维持该状态多久后交给它自己的循环；0 让游戏自己挑，就像不带时长的 `/weather`。写入走的
就是命令调用的那个入口，因此一并清掉本来会否决新状态的晴天计时器。

游戏规则按注册表 id 寻址、按游戏自己的拼法读写；id 列在 `BuiltInRegistries.GAME_RULE`，
`OMLRegistries.gameRule(id)` 解析它。写入是游戏自己的 `GameRules.set`，向各已加载维度的传播也归游戏——而
布尔规则被要求写成 `"3"` 时是**被拒**，不是被猜。

```kotlin
val server = OMLGame.server ?: return
server.gameRuleValue("minecraft:keep_inventory")           // "false"
server.setGameRule("minecraft:keep_inventory", "true")
server.setGameRule("minecraft:keep_inventory", "3")        // false：该规则的序列化器拒绝
```

## 时钟

26.3 没有昼夜计数器。时间住在**时钟**里：每个时钟是一个带速率的 tick 计数器，按注册表 id 寻址，并由维度类型
绑定到维度——下界不指定时钟，所以那里 `level.clock` 为 null，既没有时间可读也没有时间可写。mod 过去用
`dayTime % 24000` 自己算的白天黑夜，现在是注册在时钟上的**具名时刻标记**（`minecraft:day`、
`minecraft:noon`、`minecraft:night`、`minecraft:midnight` …），`/time set <marker>` 动的就是它。

时钟用它的 `Holder<WorldClock>` 寻址，读数走 `ClockInstance`：

| 调用                                       | 含义                                                  |
|--------------------------------------------|---------------------------------------------------------|
| `level.clock`                              | 该维度的时钟 holder，没有则为 null                       |
| `server.clockById(clockId)`                | 按 id 取 holder，无论当下有没有维度正运行它              |
| `clockManager.instanceOf(holder)`          | 游戏的 `ClockInstance`：`totalTicks()`、`partialTick()`、`rate()`、`isPaused()` |
| `level.clockInstance`                      | 直接取本维度所运行时钟的那份读数                         |

写入侧是 `ServerClockManager`（服务端世界的 `server.clockManager()`），每个调用都把结论回读一遍：

| 调用                                        | 含义                                                    |
|---------------------------------------------|-----------------------------------------------------------|
| `applyTotalTicks(holder, ticks)`            | 把时钟放到该位置，并回报游戏是否停在它那里               |
| `applyTicks(holder, delta)`                 | 按 tick 数移动，负值回拨                                 |
| `applyPaused(holder, paused)`               | 暂停或恢复，位置原地不动                                 |
| `applyRate(holder, rate)`                   | 设置速率；超出游戏自己的 0.00001..1000 窗口返回 false     |
| `markersOf(holder)`                         | 该时钟提供的具名时刻标记 id                              |
| `atMarker(holder, markerId)` / `applyMarker(holder, markerId)` | 游戏自己的"此刻是否在标记上"，与 `/time set` 的那一跳 |

读数两侧都能做：记录归服务端所有，而它一变就推给客户端，所以
`OMLGame.client?.level?.clockInstance` 是游戏被告知的副本。写入归服务端；窗口外的速率被拒，是因为游戏的时钟
管理器本来会存下任何数字——OML 按命令能接受的范围先拦一道。

::: warning 标记是一个点，不是一段窗口
`atMarker` 用的是游戏自己的判定，它是精确的（若该声明了周期，则按周期），因此每个周期只true 一个 tick。它
不能替代过去的 `isDay()`：要么紧接 `applyMarker` 之后问，要么把 `totalTicks()` 和时钟自己的周期做比较。
:::

::: warning 时钟由数据包加载
时钟 holder 与标记表都需要运行中的服务端，和伤害类型同理：这张表是随世界构建的，不是随二进制。未注册的时钟
id 读回 null 而不是抛异常——游戏的时钟管理器对未知时钟的回答就是异常，所以 id 先against活的注册表解析，拼错
也到不了它。游戏的 `advance_time` 游戏规则会让所有时钟停住却不暂停任何一个；暂停推给客户端的形式是速率为 0。
:::

## 注册表与标签

id 仍然是通货，表仍然是游戏自己的：内置表在 `BuiltInRegistries`，数据包表走
`server.registry(Registries.DAMAGE_TYPE)`。`OMLRegistries` 把一个 id 解析成游戏注册的那个对象，未注册时答
null 而不是默认值——mod 写错的 id 不该悄悄放下空气或播出一段寂静。

```kotlin
OMLRegistries.block("minecraft:stone")            // Block?，未注册为 null
OMLRegistries.mobEffect("minecraft:poison")       // Holder<MobEffect>，游戏方法要的形状
OMLRegistries.damageType(level, "my_mod:melt")    // 数据包表，因此需要 level
OMLRegistries.blockState("minecraft:chest", mapOf("facing" to "east"))  // /setblock 那个解析器

BuiltInRegistries.BLOCK.ids()                     // 表里全部 id
BuiltInRegistries.BLOCK.contains("my_mod:ruby_ore")
BuiltInRegistries.BLOCK.membersOf(Registries.BLOCK, "minecraft:dirt")   // 带该标签的 id
BuiltInRegistries.BLOCK.tagsOf("minecraft:stone")                       // 该 id 属于哪些标签
tagKeyOf(Registries.BLOCK, "minecraft:dirt")      // 游戏自己的标签读取所取的 TagKey
```

不带命名空间的 id 不算错误：游戏会补上 `minecraft`，所以 `"stone"` 与 `"minecraft:stone"` 是同一次查找。
只有游戏拒绝的字符才会答 null。

mod 自己注册的内容与原版条目同等可查，两侧、任意线程都行——这些表是游戏的静态成员，由游戏自己的 bootstrap
填充。也因此，在 mod 初始化阶段读它们，就会像在游戏里过早读注册表一样失败：注册表读数属于"背后已经有正在
运行的游戏"的那些时刻。

## 哪个事件交出什么

| 事件                                   | 载荷                                                             |
|----------------------------------------|--------------------------------------------------------------------|
| `SERVER_STARTED` / `SERVER_STOPPING`   | `server: MinecraftServer`                                          |
| `PLAYER_JOINED` / `PLAYER_LEFT`        | `player: ServerPlayer`                                             |
| `PLAYER_RESPAWNED`                     | `player: ServerPlayer` —— 为这一世新建的实例，不是它替换掉的那个    |
| `LEVEL_TICK`                           | `level: Level`（`isClientSide` 说明是哪一侧在 tick）                |
| `BLOCK_BREAK`                          | `player`、`position: BlockPos`、`state: BlockState`                 |
| `BLOCK_USED`                           | `player`、`hit: BlockHitResult`、`state`、`stack: ItemStack`、`hand: InteractionHand` |
| `ITEM_USED`                            | `player`、`stack`、`hand`                                          |
| `ENTITY_ATTACK` / `ENTITY_INTERACT`    | `player`、`target: Entity`、`hand`（后者）                         |
| `LIVING_HURT` / `LIVING_DIED`          | `entity: LivingEntity`、`source: DamageSource`（`LIVING_HURT` 的 `amount` 可写） |
| `WORLD_LOAD`                           | `world: ClientLevel?`（null = 断开连接）                           |
| `GUI_OPEN`                             | `screen: Screen?`                                                 |
| `HUD_RENDER`                           | `graphics: GuiGraphicsExtractor`（`drawText` 写在它上面）          |
| `CHAT_RECEIVED`                        | `message: String`、`packet: Packet<ClientGamePacketListener>`       |

可取消事件在调用 `cancel()` 后拦住游戏自己的动作；载荷字段就是游戏准备拿去行动的那些对象，不是副本——每个
事件的确切时机见 [mod 入口与事件](/zh/api/events)。
