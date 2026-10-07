# 世界、玩家与实体 API

游戏状态通过类型化投影读取：小而稳定的接口，每次调用都直接读底层游戏对象，因此跨 tick 持有的句柄
不会失效。每个投影都带 `platform`——底层游戏对象——作为逃生舱，OML 的类型面不会成为能力上限。

## 取到正在运行的游戏

`OMLGame` 按询问的一侧作答。两个成员都可空，而在对象尚未建立的钩子上读到 null 是正常结果：

```kotlin
val server = OMLGame.server   // 专用服务端，或单人的集成服务端
val client = OMLGame.client   // 专用服务端上为 null
```

单人游戏把集成服务端跑在客户端进程里，所以同一份 mod 能同时看到两个句柄，无需自行判边。

### `OMLServer`

| 成员                          | 含义                                                             |
|-------------------------------|------------------------------------------------------------------|
| `platform`                    | 底层 `MinecraftServer`                                             |
| `dimensionIds`                | 已加载维度的注册表 id                                              |
| `players`                     | 当前在线玩家                                                       |
| `tickCount`                   | 该服务端已运行的 tick 数——用于算增量，不是绝对值                   |
| `isDedicated`                 | 单人游戏的集成服务端为 false                                       |
| `playerByName(name)`          | 该记分板名的在线玩家，不在场返回 null                              |
| `level(dimensionId)`          | 该维度已加载的世界；未加载返回 null，而不是空世界                    |
| `broadcast(text)`             | 在每位在线玩家的聊天框显示 `text`                                  |

### `OMLClient`

| 成员             | 含义                                                              |
|------------------|-------------------------------------------------------------------|
| `platform`       | 底层 `Minecraft`                                                    |
| `player`         | 本客户端控制的玩家，主菜单为 null                                   |
| `world`          | 正在渲染的世界，不在世界内为 null                                   |
| `currentScreen`  | 盖在游戏画面上的界面，直接看世界时为 null                           |
| `guiWidth` / `guiHeight` | 以 GUI 单位计的窗口尺寸，HUD 绘制寻址的就是这套坐标            |

## 世界

`OMLWorld` 要么是客户端渲染的世界，要么是服务端侧的世界，由 `isClient` 标明——取决于事件在哪一侧
把它交给你。

| 成员                | 含义                                                                |
|---------------------|---------------------------------------------------------------------|
| `platform`          | 底层 `ClientLevel` / `ServerLevel`                                    |
| `dimensionId`       | 本维度的注册表 id，如 `minecraft:overworld`                           |
| `isClient`          | 渲染中的世界为 true                                                   |
| `blockAt(pos)`      | `pos` 处方块的注册表 id                                               |
| `setBlock(pos, id)` | 放置方块；id 未知或位置未加载时返回 false                             |
| `isLoaded(pos)`     | `pos` 所在区块是否已加载                                              |
| `playSound(id, x, y, z, volume, pitch, category)` | 在某个位置播放已注册音效，凡是听得到的玩家都听到 |
| `entities`          | 这个世界持有的实体——服务端是实时列表，客户端是它渲染的列表 |
| `entitiesOfType(id)`| 类型 id 匹配的实体，如 `minecraft:cow`                             |
| `spawnEntity(id, x, y, z)` | 在服务端世界放入一个已注册实体；做不到时返回 null               |
| `blockStateAt(pos)` | 已加载位置上「方块 + 属性值」的状态，未加载返回 null                |
| `setBlockState(pos, state)` | 放置一个状态，含邻居更新与客户端同步                          |
| `spawnParticles(id, x, y, z, count, offsetX, offsetY, offsetZ, speed)` | 从服务端世界发出一个简单粒子 |

::: warning 写方块需要服务端侧的世界
对客户端世界调用 `setBlock` 改的是服务端下一次更新就会覆盖掉的预测，因此只在服务端世界生效。
读取两侧都行，写入请走 `OMLGame.server`。
:::

::: warning 未加载的位置没有意义
`blockAt` 不会失败，但对落在已加载区块之外的位置，它给出的是游戏自身 getter 当时持有的东西——
一次是 `minecraft:air`，另一次是真实地形，取决于哪一侧、以及区块管理器恰好做了什么。
需要可靠结论时先调用 `isLoaded`，再读位置。
:::

## 方块状态

id 只说了半个故事：朝向不同的两个箱子都是 `minecraft:chest`。`blockStateAt` 把方块和它的属性值一起
给出，属性按游戏自己给的名字寻址——也就是 blockstate JSON 里用的那些名字。

```kotlin
val state = world.blockStateAt(pos) ?: return      // null：该位置未加载
val rotated = state.with("facing", "east")         // null：没有该属性，或取值非法
world.setBlockState(pos, rotated)                  // 含邻居更新与客户端同步
world.blockStateAt(pos)?.value("facing")           // "east"
```

`with` 返回 null 而不是「改过但不对」的状态：某种组合是否存在由游戏自己的状态表决定，走的是 `/setblock`
同一段代码，所以属性不允许的取值也和命令一样被拒。

## 生成实体、运动与粒子

`spawnEntity` 通过游戏自己的生成路径把已注册实体放进**服务端**世界（用的正是 `/summon` 传的 reason），
因此消失规则与事件规则对它和其他怪物一视同仁；id 未注册或这是客户端世界时返回 null。
`entities` 与 `entitiesOfType` 读的是世界自己的列表，生成的实体会从它进入的那个查询里查回来。

```kotlin
val cow = world.spawnEntity("minecraft:cow", x, y, z)
cow?.velocity = OMLVec3(0.6, 0.0, 0.0)             // 游戏把它积分进位置
```

`spawnParticles` 从服务端世界把粒子发给范围内每个客户端。它需要对自身带参数的粒子（尘埃颜色、掉落物）
返回 false——光靠注册表 id 表达不了那些参数；那类粒子要经 `platform` 拿游戏的 options 对象。

## 实体、玩家与物品栏

`OMLEntity` 是场景里的任何实体；`OMLLivingEntity` 加上血量；`OMLPlayer` 再加上玩家专属的面。三者
逐层超集：

| `OMLEntity`                  | 含义                                                          |
|------------------------------|---------------------------------------------------------------|
| `platform`                   | 底层游戏实体                                                    |
| `typeId`                     | 实体类型的注册表 id，如 `minecraft:cow`                         |
| `name`                       | 游戏渲染的显示名                                                |
| `uuid`                       | 该实例的持久身份                                                |
| `position` / `blockPosition` | 世界坐标，以及它所在的方块                                      |
| `dimensionId` / `world`      | 所在维度                                                        |
| `removed`                    | 已离开世界（仍可读到最后位置）                                  |
| `onFire`                     | 是否正在燃烧                                                    |
| `velocity`                   | 每 tick 移动多少方块，可读**可写**                              |
| `remove()`                   | 把它从世界里取走；游戏没移除时返回 false                        |

写 `velocity` 换掉游戏持有的向量，随后的摩擦与重力都按这个数走。但**生物每 tick 会按自己的行走输入重算这个
向量**，所以往怪物身上写一个数只在写入那一 tick 被积分，下一 tick 就被覆盖；投射物与掉落物没有这套重算，
会保留写进去的向量。`remove()` 面向实体而不是玩家：移除玩家实体只是把它从世界里摘掉，它的连接仍指向它。

| `OMLLivingEntity` | 含义                                                                  |
|-------------------|-----------------------------------------------------------------------|
| `health`          | 当前血量                                                               |
| `maxHealth`       | 血量上限                                                               |
| `alive`           | 仍存在且血量大于 0（正在死亡动画中的实体仍算 alive）                    |
| `effects`         | 此刻身上的效果，各自带剩余时长与等级                                    |
| `hasEffect(id)`   | 是否带有该效果；id 未注册返回 false                                     |
| `applyEffect(id, durationTicks, amplifier)` | 施加效果；id 未注册返回 false            |
| `removeEffect(id)`| 摘掉效果；id 未知或本来就没有时返回 false                               |
| `heal(amount)`    | 按游戏自身的回血方式恢复血量                                            |

`effects` 报的是**剩余**时长（tick）和从 0 起的等级，所以 `amplifier = 0` 是一级。对已有的效果再次
`applyEffect` 遵循游戏自身的合并规则，不是简单覆盖。

| `OMLPlayer`                     | 含义                                                       |
|---------------------------------|------------------------------------------------------------|
| `inventory`                     | 玩家本人的主容器                                            |
| `gameMode`                      | `survival` / `creative` / `adventure` / `spectator`，可为 null |
| `mainHandItem` / `offhandItem`  | 主手与副手的堆叠                                            |
| `permissionLevel`               | 原版等级：0 普通玩家、1 调解员、2 游戏管理员、3 管理员、4 服主 |
| `sendSystemMessage(text)`       | 只向这位玩家显示 `text`                                     |
| `giveItem(itemId, count)`       | 往物品栏放入物品，放不下时返回 false                        |
| `teleport(x, y, z, dimensionId)`| 移动玩家；给出维度 id 时同时跨维度移动                      |
| `playSound(id, volume, pitch)`  | 播放已注册音效，**只让这位玩家**听到                        |

`teleport` 由服务端做主：客户端侧的玩家由集成服务端里同一 uuid 的对应实体代为实现，返回 false 意味着
没有可移动的对象、维度 id 未知，或游戏拒绝了目标位置。`playSound` 是逐听众的——服务端侧玩家给那个客户
端发包，客户端侧玩家本地播放；要按位置放给所有听得到的玩家，用 `OMLWorld.playSound`，它还要指定音效
分类，决定它受客户端哪一条音量滑条控制。

`gameMode` 可空是因为游戏的 getter 本身可空：客户端侧的玩家可能在服务端还没下发游戏类型时就被读取。

### 堆叠与槽位

| `OMLItemStack` | 含义                                                                |
|----------------|---------------------------------------------------------------------|
| `platform`     | 底层游戏堆叠                                                          |
| `id`           | 注册表 id，如 `minecraft:iron_ingot`（空堆叠返回空串）                |
| `count`        | 数量                                                                  |
| `isEmpty`      | 游戏自身的空判定                                                        |
| `displayName`  | 游戏显示的名字，含自定义名                                              |
| `damageValue`  | 耐久——现代版本的数据值已改由组件承载                                    |

| `OMLInventory`             | 含义                                                            |
|----------------------------|-----------------------------------------------------------------|
| `size`                     | 可寻址的主物品栏槽位数（原版玩家 36）                            |
| `selectedSlot` / `selected`| 当前手持的热键槽序号与该堆叠                                     |
| `itemAt(slot)`             | 该槽堆叠，越界返回 null                                          |
| `set(slot, itemId, count)` | 替换整槽；id 未知或越界返回 false 且不做任何事                   |
| `add(itemId, count)`       | 像原版拾取一样分摊到各槽；放不下返回 false（已放入的留在栏内）    |
| `countOf(itemId)`          | 该物品在可寻址槽位中的总数                                       |
| `remove(itemId, count)`    | 取出至多 `count` 个，返回真正取出了多少                          |
| `selectHotbarSlot(slot)`   | 把手指向 `slot`（0..8）                                          |

槽位下标沿用游戏自身的容器布局：0..35 是主物品栏，同一对象上的护甲与副手槽不在这里寻址。
`remove` 只按物品 id 匹配堆叠，带耐久或自定义名字的物品同样被算进去；要取的数量超过存量时，取出全部
现存并如实报数。改动不加任何锁——请在拥有该玩家的线程上执行，这正是[主线程调度器](/zh/api/scheduler)的用途。

## 位置

`OMLBlockPos`（整数，方块单位）与 `OMLVec3`（世界单位）按值比较，因此一个事件里记下的位置能与另一个
事件递来的位置对上——处理器据此判断「就是我在等的那次破坏」。

## 哪个事件交出哪个投影

| 事件                                             | 投影                                                               |
|--------------------------------------------------|--------------------------------------------------------------------|
| `SERVER_STARTED` / `SERVER_STOPPING`             | `server: OMLServer`                                                 |
| `PLAYER_JOINED` / `PLAYER_LEFT`                  | `player: OMLPlayer`                                                 |
| `PLAYER_RESPAWNED`                               | `player: OMLPlayer`——新实例，不是它替代掉的那个                      |
| `BLOCK_BREAK`                                    | `player`、`position: OMLBlockPos`、`blockId`                        |
| `BLOCK_USED`                                     | `player`、`position`、`blockId`、`itemId`、`hand`、`face`           |
| `ITEM_USED`                                      | `player`、`itemId`、`hand`                                          |
| `ENTITY_ATTACK` / `ENTITY_INTERACT`              | `player`、`target: OMLEntity`                                       |
| `LIVING_HURT` / `LIVING_DIED`                    | `entity: OMLLivingEntity`、`attacker: OMLEntity?`（`LIVING_HURT` 的 `amount` 可写） |
| `WORLD_LOAD`                                     | `world: OMLWorld?`                                                  |

可取消事件调用 `cancel()` 即阻止游戏自身的动作；字段是游戏即将操作的对象本身，不是副本——每个事件的
精确时机见[mod 入口与事件系统](/zh/api/events)。
