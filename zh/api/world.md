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

::: warning 写方块需要服务端侧的世界
对客户端世界调用 `setBlock` 改的是服务端下一次更新就会覆盖掉的预测，因此只在服务端世界生效。
读取两侧都行，写入请走 `OMLGame.server`。
:::

未加载的位置不是错误：游戏自身的 getter 对它回答 air，所以 `blockAt` 在那里报 `minecraft:air`，
不会抛异常。

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

| `OMLLivingEntity` | 含义                                                                  |
|-------------------|-----------------------------------------------------------------------|
| `health`          | 当前血量                                                               |
| `maxHealth`       | 血量上限                                                               |
| `alive`           | 仍存在且血量大于 0（正在死亡动画中的实体仍算 alive）                    |

| `OMLPlayer`                     | 含义                                                       |
|---------------------------------|------------------------------------------------------------|
| `inventory`                     | 玩家本人的主容器                                            |
| `gameMode`                      | `survival` / `creative` / `adventure` / `spectator`，可为 null |
| `mainHandItem` / `offhandItem`  | 主手与副手的堆叠                                            |
| `sendSystemMessage(text)`       | 只向这位玩家显示 `text`                                     |
| `giveItem(itemId, count)`       | 往物品栏放入物品，放不下时返回 false                        |

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
| `selectHotbarSlot(slot)`   | 把手指向 `slot`（0..8）                                          |

槽位下标沿用游戏自身的容器布局：0..35 是主物品栏，同一对象上的护甲与副手槽不在这里寻址。
改动不加任何锁——请在拥有该玩家的线程上执行，这正是[主线程调度器](/zh/api/scheduler)的用途。

## 位置

`OMLBlockPos`（整数，方块单位）与 `OMLVec3`（世界单位）按值比较，因此一个事件里记下的位置能与另一个
事件递来的位置对上——处理器据此判断「就是我在等的那次破坏」。

## 哪个事件交出哪个投影

| 事件                                             | 投影                                                               |
|--------------------------------------------------|--------------------------------------------------------------------|
| `SERVER_STARTED` / `SERVER_STOPPING`             | `server: OMLServer`                                                 |
| `PLAYER_JOINED` / `PLAYER_LEFT`                  | `player: OMLPlayer`                                                 |
| `BLOCK_BREAK`                                    | `player`、`position: OMLBlockPos`、`blockId`                        |
| `ENTITY_ATTACK` / `ENTITY_INTERACT`              | `player`、`target: OMLEntity`                                       |
| `LIVING_HURT` / `LIVING_DIED`                    | `entity: OMLLivingEntity`、`attacker: OMLEntity?`                   |
| `WORLD_LOAD`                                     | `world: OMLWorld?`                                                  |

可取消事件调用 `cancel()` 即阻止游戏自身的动作；字段是游戏即将操作的对象本身，不是副本——每个事件的
精确时机见[mod 入口与事件系统](/zh/api/events)。
