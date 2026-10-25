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
的运行库，于是它第一次引用 `net.minecraft.*` 就以 `NoClassDefFoundError` 收场。加载器在扫描 mods 目录时就
会拒绝这种 jar，并点名被打进去的那些类。mod 按 child-first 加载，这正是"mod 看到的 `net.minecraft` 与游戏
运行的那个是同一个类"的前提。
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

| 调用                               | 含义                                                                                      |
|------------------------------------|-------------------------------------------------------------------------------------------|
| `dimensionIds`                     | 已加载维度的注册表 id                                                                     |
| `onlinePlayers`                    | 当前在线玩家（与 `playerList.players` 同一份列表）                                        |
| `playerByName(name)`               | 按记分板名字找到在线玩家，找不到为 null                                                   |
| `levelById(dimensionId)`           | 该维度已加载的 `ServerLevel`，未加载为 null                                               |
| `broadcastMessage(text)`           | 在每位在线玩家的聊天里显示 `text`                                                         |
| `gameRuleValue(ruleId)`            | 游戏规则按游戏自己的拼法读回（`"true"`），未注册 id 为 null                               |
| `setGameRule(ruleId, value)`       | 用游戏自己的序列化器写入；id 未知或值解析不过返回 false                                   |
| `clockById(clockId)`               | 该 id 对应的 `Holder<WorldClock>`，没有注册则为 null                                      |
| `registry(registryKey)`            | 数据包表（`Registries.DAMAGE_TYPE`、`Registries.WORLD_CLOCK`），服务端未加载该表时为 null |
| `damageTypeIds` / `clockIds`       | 上面两张数据包表里的 id                                                                   |
| `tickCount`、`isDedicatedServer()` | 游戏自己的成员                                                                            |

### `Minecraft` 上

| 调用                              | 含义                                                     |
|-----------------------------------|----------------------------------------------------------|
| `player`、`level`、`gui.screen()` | 游戏自己的成员：本客户端的玩家、正在渲染的世界、当前界面 |
| `currentScreen`                   | `gui.screen()` 的属性写法，画面就是世界本身时为 null     |
| `scaledWidth` / `scaledHeight`    | GUI 单位下的窗口尺寸，也就是 HUD 绘制所面对的坐标空间    |

## 世界

读在任何 `Level` 上都行；改动世界的调用声明在 `ServerLevel` 上，因为权威在那里——客户端世界拿的是服务端
下一跳就会覆盖掉的预测。

| `Level` 上的调用                                    | 含义                                                                 |
|-----------------------------------------------------|----------------------------------------------------------------------|
| `dimensionId`                                       | 本维度的注册表 id，例如 `minecraft:overworld`                        |
| `isClientSide`                                      | 游戏自己的成员：渲染侧为 true                                        |
| `blockIdAt(pos)`                                    | 该位置方块的注册表 id                                                |
| `blockStateAt(pos)`                                 | 该位置的 `BlockState`，区块未加载时为 null                           |
| `setBlockAt(pos, blockId)`                          | 放置该方块的默认状态；id 未知返回 false                              |
| `setBlockAt(pos, state)`                            | 放置一个状态（含邻块更新与客户端同步），并回报该位置现在是否就是它   |
| `destroyBlock(pos)`                                 | 连掉落物、破坏特效与方块实体清理一起破坏方块——游戏自己的玩家破坏路径 |
| `dropItem(stack, x, y, z)`                          | 把一个真实的物品实体掉进世界；拾取、堆叠与消失都是 vanilla 的        |
| `isLoaded(pos)`                                     | 游戏自己的成员：该位置所在区块是否已加载                             |
| `containerAt(pos)`                                  | 方块实体的 `Container`；该方块没有槽位时为 null                      |
| `blockEntityAt(pos)`                                | 方块自己的 `BlockEntity`；位置未加载或该方块没有块实体时为 null      |
| `blockDataAt(pos)`                                  | 声明式方块实体的持久 `OMLBlockData`——与它的 ticker 写的是同一个存储  |
| `playSoundAt(id, x, y, z, volume, pitch, category)` | 为所有听得见的人播放一个已注册音效                                   |
| `clock`                                             | 本维度所运行时钟的 `Holder<WorldClock>`，维度类型没指定时钟时为 null |
| `clockInstance`                                     | 上面的时钟按游戏自己的计数读回（`ClockInstance`）                    |

| `ServerLevel` 上的调用                                                 | 含义                                                                                |
|------------------------------------------------------------------------|-------------------------------------------------------------------------------------|
| `entities()`                                                           | 该世界当前持有的全部实体——调用瞬间的快照，不是跟随变化的视图                        |
| `entitiesOfType(typeId)`                                               | 其中类型 id 匹配的，例如 `minecraft:cow`                                            |
| `spawnEntity(typeId, x, y, z)`                                         | 走 `/summon` 那条生成路径放进世界；id 不是实体类型、或游戏拒绝加入时返回 null       |
| `spawnLivingEntity(typeId, x, y, z)`                                   | 同上，但只认游戏视为"活体"的类型；抛射物返回 null，而不是当作一个没有血量的实体交出 |
| `spawnParticles(id, x, y, z, count, offsetX, offsetY, offsetZ, speed)` | 把简单粒子发给范围内所有客户端                                                      |
| `spawnItemParticles` / `spawnBlockParticles` / `spawnDustParticles`    | 需要自带参数的粒子走这三个具名调用                                                  |
| `setWeather(raining, thundering, durationTicks)`                       | 向服务端那一条天气记录请求该状态                                                    |

| `ClientLevel` 上的调用   | 含义                                                     |
|--------------------------|----------------------------------------------------------|
| `renderedEntities()`     | 客户端这一帧渲染的实体——它自己的视角，会落后于服务端列表 |
| `entitiesOfType(typeId)` | 对上面那份渲染列表做同样的过滤                           |

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

| `Entity` 上                    | 含义                                                                                   |
|--------------------------------|----------------------------------------------------------------------------------------|
| `typeId`                       | 实体类型的注册表 id，例如 `minecraft:cow`                                              |
| `dimensionId`                  | 它所在维度的注册表 id                                                                  |
| `discard()` 然后读 `isRemoved` | 游戏自己的移除，再回读判定——不适用于玩家：移除玩家实体只会让它与世界脱钩，连接还指着它 |

| `LivingEntity` 上                                                                        | 含义                                                                                                                                                           |
|------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `hasEffect(effectId)`                                                                    | 未注册 id 返回 false                                                                                                                                           |
| `applyEffect(effectId, durationTicks, amplifier = 0)`                                    | 施加效果；重复施加遵循游戏自己的合并规则                                                                                                                       |
| `removeEffect(effectId)`                                                                 | id 未知或本就没有该效果时返回 false                                                                                                                            |
| `attributeValue(id)` / `attributeBase(id)`                                               | 游戏算出的值（基础值 + 修正）与纯基础值，按 `minecraft:max_health` 这类 id 寻址；这类实体不带该属性时返回 null——`minecraft:attack_damage` 属于攻击者，牛就没有 |
| `setAttributeBase(id, value)`                                                            | 游戏会把写入值夹进该属性的取值范围，并施加它自己的后果；没有这个属性可写时返回 false                                                                           |
| `addAttributeModifier(attributeId, modifierId, amount, operation)`                       | 常驻修正，游戏会一直保留到被移除；`operation` 取 `add_value` / `add_multiplied_base` / `add_multiplied_total`；这类实体不带该属性时返回 false                  |
| `removeAttributeModifier(attributeId, modifierId)`                                       | 该 id 名下没有持有时返回 false                                                                                                                                 |
| `hurt(damageTypeId, amount, attacker = null)`                                            | 走游戏自己的伤害路径造成一次伤害；伤害类型未注册、实体不在服务端世界、或游戏未实际施加伤害时返回 false                                                         |
| `ignite(ticks)` / `extinguish()`                                                         | 请求之后回读游戏自己的燃烧状态——免疫火焰的生物答 `false`，而不是被静默忽略                                                                                     |
| `health`、`maxHealth`、`activeEffects`、`isOnFire`、`remainingFireTicks`、`heal(amount)` | 游戏自己的成员                                                                                                                                                 |

`activeEffects` 交出的是游戏自己的 `MobEffectInstance`；`effectId` 给出它的注册表 id，`duration` 是剩余
tick 数，`amplifier` 从 0 起算，所以 0 就是一级。

`hurt(damageTypeId, amount, attacker)` 与怪物攻击走同一个钩子，因此 `LIVING_HURT` 的 handler 看得见它、可以
取消它、也可以改写数值——它是一次游戏行为，不是绕过这些规则的后门。

| `Player` / `ServerPlayer` 上            | 含义                                                                                                                                                                                                 |
|-----------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `openedMenuId`                          | 游戏当前让玩家使用的菜单（`minecraft:generic_9x3`），静息时为 null                                                                                                                                   |
| `closeMenu()`（服务端）                 | 游戏自己的关闭，会把手上的物品退回物品栏；本来什么都没开时返回 false                                                                                                                                 |
| `gameModeName`                          | `survival` / `creative` / `adventure` / `spectator`，服务端尚未下发时为 null                                                                                                                         |
| `permissionLevel`                       | vanilla 自己的等级：0 玩家、1 管理员、2 游戏主管、3 操作员、4 服主                                                                                                                                   |
| `sendSystemMessage(text)`               | 只向这位玩家显示 `text`——经它的服务端连接，所以多人客户端的本地玩家是空操作                                                                                                                          |
| `giveItem(itemId, count)`               | 装不下时返回 false（装下的那部分仍然留下，与原版拾取一致）                                                                                                                                           |
| `raycast(distance)`                     | 准星落在什么上：游戏自己的方块裁剪（眼位 + 视线向量）——`OMLRayHit`（方块 id + 坐标）；射线到距离还没碰到东西时为 null                                                                               |
| `giveXp(points)`                        | 走游戏自己的经验点路径（含升级）；负数扣除，到零为止                                                                                                                                                  |
| `xpLevel` / `xpProgress`                | 当前等级，与该等级内的进度（0.0 到不足 1.0）                                                                                                                                                          |
| `foodLevel` / `saturation`              | 游戏自己的 0–20 饥饿刻度，与让饥饿条不流失的饱和度                                                                                                                                                    |
| `setFoodLevel(n)` / `feed(food, saturation)` | 写饥饿条（游戏的饥饿伤害调度从下一 tick 起作用），或一次喂饱两条                                                                                                                                  |
| `teleport(x, y, z, dimensionId = null)` | 服务端权威；维度 id 未知、游戏拒绝该目的地，或这个句柄已被游戏换掉时返回 false——死亡或重生会让游戏拿出一个新实例，旧的那个读作 removed，所以长期持有玩家的模组要按 uuid 去寻服务端当前持有的那个实例 |
| `playSound(id, volume, pitch)`          | 让**这位**玩家听见，正是游戏自己的分侧行为                                                                                                                                                           |

### 穿戴中的物品

| 调用                                               | 含义                                                                                                  |
|----------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| `itemIn(slotName)`                                 | 游戏在 `chest` / `feet` / `offhand` 这类槽里持有的堆；名字它不用则为 null                             |
| `equip(slotName, stack)`                           | 走游戏自己的槽写入，并返回该槽原本的堆——游戏把它留给调用者自己安放                                    |
| `equip(slotName, itemId, count = 1)`               | 同上，按注册表 id 寻址                                                                                |
| `unequip(slotName)`                                | 把穿着的那件取下并交回                                                                                |
| `equipmentSlotOf(name)` / `EquipmentSlot.slotName` | 槽与名字互转，用的就是游戏自己数据里的名字                                                            |
| `Inventory.indexOf(slotName)`                      | 穿戴物在玩家容器里的下标（36..39 是盔甲，副手是 `Inventory.SLOT_OFFHAND`）；该槽不被容器寻址时为 null |

一件东西能不能进某个槽由游戏决定——`isEquippableInSlot` 读的是物品自己的 `Equippable` 组件——所以被拒时返回
null、原本穿着的东西分毫未动，拒绝的方式与玩家在物品栏界面里遇到的完全一致。先从实体上读、再按 `indexOf` 的
下标从玩家容器里读同一个穿戴物，两次读数指向的是同一份存储，而不是 OML 另存的副本。

## 物品堆、容器与槽位

```kotlin
val chest = level.containerAt(pos) ?: return            // null：这里没有存储
chest.setSlot(0, "minecraft:stone", 5)                  // 槽位拒绝时返回 false
chest.takeSlot(0, 3)?.count                             // 3 —— 取物由游戏自己的移除决定
chest.countOf("minecraft:stone")                        // 还剩 2
chest.openedByPlayerNames                               // 游戏认为正在使用该方块的玩家
```

| 调用                                                          | 含义                                                                  |
|---------------------------------------------------------------|-----------------------------------------------------------------------|
| `ItemStack.itemId`                                            | 注册表 id；空堆报告空字符串，而不是报成空气                           |
| `Container.setSlot(slot, itemId, count)`                      | 先问方块自己的规则再写；被拒、id 未知、槽位不存在都返回 false         |
| `Container.takeSlot(slot, count)`                             | 如实回报游戏取出了多少；槽位不存在返回 null                           |
| `Container.countOf(itemId)` / `canPlace(slot, itemId, count)` | 存储自己的计数与规则，后者不写任何东西                                |
| `Inventory.add(itemId, count)`                                | 像原版拾取那样摊到多个槽位；放不下返回 false                          |
| `Inventory.remove(itemId, count)`                             | 最多取走 `count` 并回报实际取走的数量；只按物品 id 匹配，组件无需相同 |
| `Inventory.selectHotbarSlot(slot)`                            | 把手指指向游戏自己判定为快捷栏的槽位                                  |

哪个槽收什么东西，是 **方块**的决定而不是 OML 的决定：`setSlot` 写之前一定调用游戏的 `canPlaceItem`，因此熔炉
产出槽与燃料槽拒绝 OML 的方式与拒绝玩家完全一致——写不进去，不是加载器替方块做主。读槽位请用游戏自己的
`getItem(index)`：越界时与游戏一样抛异常，边界就是 `containerSize`。

修改本身不带锁：请在拥有该玩家的那条线程上执行，这正是 [主线程调度器](/zh/api/scheduler) 的用途。

::: warning 菜单 id 不是方块 id
`openedMenuId` 报的是游戏让玩家使用的那个 **菜单**，两者不同：单个箱子打开的是
`minecraft:generic_9x3`，不是 `minecraft:chest`。每位玩家都恒定持有物品栏菜单，那不算"打开了界面"，因此
此时报 null。
:::

::: warning openedByPlayerNames 跟着菜单，不跟着距离
这份名单是游戏自己的记账，而箱子的记账来自 **菜单的构造器**，所以只有菜单真实存在时名单里才有玩家。站在一个
开着的箱子旁边，不会被记成"正在使用它"。
:::

## 天气与游戏规则

天气是 **整个服务端一条记录**，每个维度各自朝它斜坡。`isRaining` / `isThundering` 就是游戏自己的实时读数——
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
布尔规则被要求写成 `"3"` 时是 **被拒**，不是被猜。

```kotlin
val server = OMLGame.server ?: return
server.gameRuleValue("minecraft:keep_inventory")           // "false"
server.setGameRule("minecraft:keep_inventory", "true")
server.setGameRule("minecraft:keep_inventory", "3")        // false：该规则的序列化器拒绝
```

## 时钟

26.3 的时间住在 **时钟**里：每个时钟是一个带速率的 tick 计数器，按注册表 id 寻址，并由维度类型
绑定到维度——下界不指定时钟，所以那里 `level.clock` 为 null，既没有时间可读也没有时间可写。
`/time set` 提到的那些具名时刻（`minecraft:day`、`minecraft:noon` 等）是 **标记（marker）**，而声明它们的单位
叫 **时间线（timeline）**。

时钟用它的 `Holder<WorldClock>` 寻址，读数走 `ClockInstance`：

| 调用                              | 含义                                                                            |
|-----------------------------------|---------------------------------------------------------------------------------|
| `level.clock`                     | 该维度的时钟 holder，没有则为 null                                              |
| `server.clockById(clockId)`       | 按 id 取 holder，无论当下有没有维度正运行它                                     |
| `clockManager.instanceOf(holder)` | 游戏的 `ClockInstance`：`totalTicks()`、`partialTick()`、`rate()`、`isPaused()` |
| `level.clockInstance`             | 直接取本维度所运行时钟的那份读数                                                |

写入侧是 `ServerClockManager`（服务端世界的 `level.clockManager()`），每个调用都把结论回读一遍：

| 调用                                                           | 含义                                                                      |
|----------------------------------------------------------------|---------------------------------------------------------------------------|
| `applyTotalTicks(holder, ticks)`                               | 把时钟放到该位置，并回报游戏是否停在它那里                                |
| `applyTicks(holder, delta)`                                    | 按 tick 数移动，负值回拨                                                  |
| `applyPaused(holder, paused)`                                  | 暂停或恢复，位置原地不动                                                  |
| `applyRate(holder, rate)`                                      | 设置速率；超出游戏自己的 0.00001..1000 窗口返回 false                     |
| `markersOf(holder)`                                            | `/time set` 在该时钟上提供的标记 id——只含声明了 `show_in_commands` 的那些 |
| `atMarker(holder, markerId)` / `applyMarker(holder, markerId)` | 游戏自己的"此刻是否在标记上"，与 `/time set` 的那一跳                     |

读数两侧都能做：记录归服务端所有，而它一变就推给客户端，所以
`OMLGame.client?.level?.clockInstance` 是游戏被告知的副本。写入归服务端；窗口外的速率被拒，是因为游戏的时钟
管理器本来会存下任何数字——OML 按命令能接受的范围先拦一道。

### 时间线与它声明的标记

**时间线**是具名时刻的声明单位：它指明一个时钟、可选的周期长度，以及落在上面的标记。这些条目进的是游戏
自己的表，所以 OML 把它读回来，而不是另存一份：

| 调用                                                                       | 含义                                                     |
|----------------------------------------------------------------------------|----------------------------------------------------------|
| `server.timelineIds`                                                       | 已加载的数据包注册的全部时间线                           |
| `timelines.clockDrivenBy(timelineId)`                                      | 该时间线驱动的是哪个时钟；未注册为 null                  |
| `timelines.timeMarkersOf(timelineId)`                                      | 标记 id → 周期内的 tick，**含 `/time set` 不展示的那些** |
| `timelines.markerIdsDriving(clockId)` / `server.markerIdsDriving(clockId)` | 该时钟上声明过的全部标记 id，不分来自哪条时间线          |

其中 `timelines` 就是 `server.registry(Registries.TIMELINE)`。声明走
[内容轨](/zh/api/content)：`declareClock` / `declareTimeline` 变成注入资源包里的
`data/<ns>/world_clock/<id>.json` 与 `data/<ns>/timeline/<id>.json`，由游戏自己的重载注册。服务端的时钟管理器
会给 **每一个已注册的时钟**跑一个实例，所以 mod 自己的时钟即使没有任何维度跑在它上面，也照样每 game tick
走一格并同步给客户端。

::: warning 实例表在服务端启动时建好
`ServerClockManager` 随服务端一起创建并初始化，它只在那一刻走一遍时钟与时间线两张表。因此靠 `/reload`
新增的时钟在世界重启前不会有实例——游戏自己会抛的地方，`instanceOf` 答 null——`/reload` 新增的标记同理。
时钟与时间线请写在包里，把重启当作让它们开始走的那一步。
:::

::: warning 标记是一个点，不是一段窗口
`atMarker` 用的是游戏自己的判定，它是精确的（若该声明了周期，则按周期），因此每个周期只有一个 tick 为真。它
不能替代按昼夜判断：要么紧接 `applyMarker` 之后问，要么把 `totalTicks()` 和时钟自己的周期做比较。
:::

::: warning 时钟由数据包加载
时钟 holder 与标记表都需要运行中的服务端，和伤害类型同理：这张表是随世界构建的，不是随二进制。未注册的时钟
id 读回 null 而不是抛异常——游戏的时钟管理器对未知时钟的回答就是异常，所以 id 先对着活的注册表解析，拼错
也到不了它。游戏的 `advance_time` 游戏规则会让所有时钟停住却不暂停任何一个；暂停推给客户端的形式是速率为 0。
:::

## 维度

世界按游戏认识的维度 id 寻址，而它跑在哪个维度类型上也是一条注册表条目——所以这些读取回答的是：游戏有没有
收下 mod 的声明，以及它此刻真正在遵守什么。

| 调用                            | 含义                                                                                                                            |
|---------------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| `server.dimensionIds`           | 服务端已经建好世界的维度                                                                                                        |
| `server.levelById(dimensionId)` | 那个世界，服务端没建时为 null                                                                                                   |
| `server.dimensionTypeIds`       | 全部维度类型，原版的与内容包声明的都算                                                                                          |
| `server.dimensionTypeById(id)`  | 那个类型本身，未注册为 null                                                                                                     |
| `level.dimensionTypeId`         | 这个世界跑在哪个类型上的 id                                                                                                     |
| `level.dimensionType()`         | 游戏自己的记录：`height()`、`minY()`、`logicalHeight()`、`hasSkyLight()`、`hasCeiling()`、`coordinateScale()`、`ambientLight()` |

mod 声明的维度一旦被游戏建好，就与其他世界无异：[`clock`](#时钟) 回的是该类型 `default_clock` 指明的时钟，
[`setWeather`](#天气与游戏规则)、[`spawnEntity`](#实体活体与玩家) 与方块读取在那里和在主世界一样可用。

要走到那里只需一个调用，而且用的就是游戏自己的传送流程——传送门与 `/teleport` 走的同一条：

| 调用                                           | 含义                                                                                    |
|------------------------------------------------|-----------------------------------------------------------------------------------------|
| `entity.teleportToLevel(dimensionId, x, y, z)` | 把实体移过去，并返回游戏**移动之后**持有的那个实例；目标维度未加载时为 null             |
| `player.teleportToLevel(dimensionId, x, y, z)` | 对玩家同理，而玩家仍是同一个实例——游戏把连接一起搬了过去                                |
| `level.blockEntityAt(pos)`                     | 方块自己的 `BlockEntity`——位置、方块状态都在里面；位置未加载或该方块没有块实体时为 null |
| `server.blockDataAt(dimensionId, pos)`         | 该维度里声明式方块实体的持久 `OMLBlockData`，从它自己的 ticker 之外取到                 |

游戏按 **每个维度、每个位置**各持有一个块实体，所以同一个坐标在两个维度里是两台机器、两份存储：真机实测把同一个
声明方块同时放进两个模组维度的同一坐标，一份存着 `side = 1`、另一份存着 `side = 2`，彼此看不见对方的键。取到的
地址也是游戏正在 tick 的那份存储而不是副本——techmod 的 press 每个 tick 都在 `progress` 里数一个周期，值不动就
说明地址取到了游戏根本没运行的东西。

世界只在玩家附近生成区块，所以没人去的维度里什么也没有。强制加载用的就是游戏自己的票据，不是 OML 的计数器：

| 调用                                 | 含义                                                                  |
|--------------------------------------|-----------------------------------------------------------------------|
| `level.forceLoadChunk(pos)`          | 对 `pos` 所在区块执行 `/forceload add`；游戏的票据表发生变化时为 true |
| `level.releaseForceLoadedChunk(pos)` | `/forceload remove`；那里本来没被持有则为 false                       |
| `level.isForceLoaded(pos)`           | 直接问同一张票据表，也就是命令写入的那一张                            |
| `level.forceLoadedChunkPositions`    | 票据表持有的全部区块，按游戏打包好的 long 解回来                      |

被强制加载的区块无需任何玩家在附近就会生成、发送并 **开始 tick**，而区块的两个事件把游戏做出的这两次状态转变
报告出来：服务端世界的某块区块转为运行时派发 `CHUNK_STARTED_TICKING`（位置在 `chunk.pos` 里），而它正在离开、
尚可读取时派发 `CHUNK_UNLOADED`。

::: warning 区块要等到开始 tick 才可写
`CHUNK_STARTED_TICKING` 就是游戏已经把这块区块建完的信号。在此之前一个位置可以答 `isLoaded` 却仍然拒绝写入
——真机实测：往游戏在这一 tick 刚提升的区块里写入会报 false，而一个 tick 之后再看，方块确实在那里；同样的写
入若在事件之后隔一个 tick 进行就报 true。所以：强制加载、等那个事件、再写。
:::

::: warning 游戏的天气判定读的就是声明的那些字段
`level.canHaveWeather()` 是游戏自己的 `hasSkyLight() && !hasCeiling() && dimension != minecraft:the_end`，
所以一个声明成有顶、或没有天光的类型，即使天气记录被写了进去也永远不会下雨。这是声明在生效，不是写入失败。
:::

## 出生点与重生锚点

26.3 存了两类锚点，两者都是游戏自己的 `LevelData.RespawnData`：一个全局坐标，加上到达时给玩家设好的 yaw 与
pitch。

| 调用                                                                   | 含义                                                                                             |
|------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| `player.respawnAnchor`                                                 | 游戏当前持有的锚点；null 表示这名玩家回到世界出生点                                              |
| `player.setRespawnAnchor(dimensionId, position, yaw, pitch, announce)` | 移动它并读回校验；维度不是服务器认识的那个、玩家不在服务端、或锚点没有落在请求的位置时返回 false |
| `player.clearRespawnAnchor()`                                          | 抹掉它，并回报确实已经不剩任何锚点                                                               |
| `server.worldSpawn`                                                    | 没有自己锚点的玩家会回去的那条记录                                                               |
| `server.setWorldSpawn(dimensionId, position, yaw, pitch)`              | 重新指向这条记录；维度不认识、或游戏不会把玩家重生放到 `position` 时返回 false                   |

锚点指向的维度可以是内容包声明的那个，所以重生可以落在模组自己的世界里。`announce` 是游戏自己的聊天提示，
也就是 `/spawnpoint` 发的那条。显式选定的位置会被标成 **forced**，这是游戏自己的说法：直接采用这个坐标，
而不再复查那里是否还立着一张床或一个重生锚。

::: warning 整个服务器只有一条世界出生点记录
`ServerLevel` 对 `respawnData` 的读与写都转发给 `MinecraftServer`，而那条记录存在主世界的存档数据里，所以问
任何一个 level 拿到的都是同一条，也不存在与之并列的"按维度的世界出生点"。但这条记录 **自带维度**，游戏在重生时
按它解析到已加载的世界——找不到对应世界才退回主世界——因此 `setWorldSpawn` 对服务器注册表里没有的 id 直接拒绝，
而不是存下一条会悄悄变成主世界出生点的记录。
:::

::: warning 读回来的就是重生真正会落的位置
服务端交出的是经过边界盒校正的记录：位置在该维度的世界边界之外时，请求照原样存下，读回来却是边界中心。真机
实测：把一个模组维度的边界盒设成 50，随后把出生点指向 (200, 41, 200)，读回来是同一维度的 (0, y, 0)，辅助函数
答 false。
:::

## 权限节点

26.3 的权限判定落在 **节点**上，而不只是 0..4 的 OP 等级：游戏自己的检查项是 `Permission.Atom` 形式的 id
（`minecraft:chat/send_messages`、`minecraft:commands/entity_selectors`），再加上
`Permission.HasCommandLevel(level)`，而 `PermissionSet` 说到底就是一个 `hasPermission(node)`。OML 用同样的
id 寻址这些对象，并补上游戏本身没有的一样东西：按玩家的覆盖表。

| 调用                                                            | 含义                                                      |
|-----------------------------------------------------------------|-----------------------------------------------------------|
| `permissionNode(id)`                                            | 该 id 对应的游戏 atom 节点；游戏无法解析的字符串返回 null |
| `permissionNodeId(node)`                                        | atom 携带的 id；命令等级返回 null（等级不是 id）          |
| `permissionLevelOf(name)`                                       | 按游戏自己的名字取等级（`all`、`moderators`…）            |
| `set.hasNode(id)` / `set.hasCommandLevel(name)`                 | 一个集合能给的两种回答；解析不了的 id 就是 false          |
| `player.hasPermissionNode(id)` / `source.hasPermissionNode(id)` | 穿过游戏此刻正在使用的那个集合去读                        |
| `player.grantPermissionNode(id)` / `revokePermissionNode(id)`   | 为该玩家强制规定回答；回报是否写入了覆盖                  |
| `player.clearPermissionNodeGrant(id)`                           | 撤下覆盖，让游戏自己的组合重新成为全部答案                |
| `player.permissionNodeOverrides`                                | OML 当前为该玩家强制了什么，id → 被规定的值               |

钩子打在 `ServerPlayer.permissions()` 上——玩家权限的每一个消费者（聊天闸门与命令闸门都算）都只经这一处读取。
因此授予改变的是 **游戏**的回答，而不是 OML 镜像里的说法。玩家没有任何覆盖时，返回的就是游戏自己那个集合，
原封不动：不包装、不分配。覆盖按玩家 id 记录而非实体实例，玩家离线时由加载器清掉。

::: warning 覆盖只作用于 atom 节点
命令等级由 `Permission.HasCommandLevel` 承载，它没有可用于命名的 id——授予或撤销都碰不到它，
`hasCommandLevel` 依旧读游戏的 OP 等级。要管那一层请用命令上的 `permissionLevel`，更细的才用节点。
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
BuiltInRegistries.BLOCK.tagIds(Registries.BLOCK)                        // 这张表持有的全部标签
tagKeyOf(Registries.BLOCK, "minecraft:dirt")      // 游戏自己的标签读取所取的 TagKey
```

`tagIds` 分得清"空标签"与"游戏根本没读到的标签"；mod 往标签里 *贡献*什么属于声明而不是这里的写入——见
[`declareTag`](/zh/api/content#标签)。

不带命名空间的 id 不算错误：游戏会补上 `minecraft`，所以 `"stone"` 与 `"minecraft:stone"` 是同一次查找。
只有游戏拒绝的字符才会答 null。

mod 自己注册的内容与原版条目同等可查，两侧、任意线程都行——这些表是游戏的静态成员，由游戏自己的 bootstrap
填充。也因此，在 mod 初始化阶段读它们，就会像在游戏里过早读注册表一样失败：注册表读数属于"背后已经有正在
运行的游戏"的那些时刻。

## 哪个事件交出什么

| 事件                                 | 载荷                                                                                  |
|--------------------------------------|---------------------------------------------------------------------------------------|
| `SERVER_STARTED` / `SERVER_STOPPING` | `server: MinecraftServer`                                                             |
| `PLAYER_JOINED` / `PLAYER_LEFT`      | `player: ServerPlayer`                                                                |
| `PLAYER_RESPAWNED`                   | `player: ServerPlayer` —— 为这一世新建的实例，不是它替换掉的那个                      |
| `LEVEL_TICK`                         | `level: Level`（`isClientSide` 说明是哪一侧在 tick）                                  |
| `BLOCK_BREAK`                        | `player`、`position: BlockPos`、`state: BlockState`                                   |
| `BLOCK_USED`                         | `player`、`hit: BlockHitResult`、`state`、`stack: ItemStack`、`hand: InteractionHand` |
| `ITEM_USED`                          | `player`、`stack`、`hand`                                                             |
| `ENTITY_ATTACK` / `ENTITY_INTERACT`  | `player`、`target: Entity`、`hand`（后者）                                            |
| `LIVING_HURT` / `LIVING_DIED`        | `entity: LivingEntity`、`source: DamageSource`（`LIVING_HURT` 的 `amount` 可写）      |
| `WORLD_LOAD`                         | `world: ClientLevel?`（null = 断开连接）                                              |
| `GUI_OPEN`                           | `screen: Screen?`                                                                     |
| `HUD_RENDER`                         | `graphics: GuiGraphicsExtractor`（`drawText` 写在它上面）                             |
| `CHAT_RECEIVED`                      | `message: String`、`packet: Packet<ClientGamePacketListener>`                         |

可取消事件在调用 `cancel()` 后拦住游戏自己的动作；载荷字段就是游戏准备拿去行动的那些对象，不是副本——每个
事件的确切时机见 [mod 入口与事件](/zh/api/events)。
