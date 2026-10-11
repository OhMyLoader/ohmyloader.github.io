# mod 入口与事件系统

## mod 入口

`@Mod` 标记模组入口类，实现 [`OMLModInitializer`](https://github.com/OhMyLoader/OhMyLoader/blob/main/oml-api/src/main/kotlin/org/ohmyloader/api/OMLMod.kt) 接口。
游戏初始化完成后，加载器实例化该类并调用 `onInitialize`，传入模组自身的元数据：

```kotlin
@Mod(id = "my_mod", name = "My Mod", version = "1.0.0")
class MyMod : OMLModInitializer {
    override fun onInitialize(context: ModContext) {
        // context: id / name / version / config
    }
}
```

`id` 全小写，也是这个 mod 的资源命名空间（资产、内容 id 的默认域）。

## 事件注册

事件通过 `Events` 对象（`org.ohmyloader.api26_3.event.Events`）的函数式 lambda 注册，零反射、可追溯。处理器
签名即事件类型，取消类事件调用 `cancel()`（`canceled` 只读——后注册的处理器可以据此看到先前处理器的决定）。载荷字段就是游戏自己的类：

```kotlin
import org.ohmyloader.api26_3.event.Events

Events.CLIENT_TICK.register { /* 每逻辑 tick */ }
```

| 事件               | 触发时机                                            | 可取消 | 字段                                                                     |
|--------------------|-----------------------------------------------------|--------|--------------------------------------------------------------------------|
| `CLIENT_TICK`      | 客户端每逻辑 tick                                   | –      | –                                                                        |
| `SERVER_TICK`      | 服务端每逻辑 tick（专用或集成）                     | –      | –                                                                        |
| `LEVEL_TICK`       | 某个世界开始一次 tick                                | –      | `level: Level`                                                      |
| `CHUNK_STARTED_TICKING` | 一个区块成为某服务端世界的运行中区块                    | –           | `level: ServerLevel`、`chunk: LevelChunk`                                  |
| `CHUNK_UNLOADED`   | 一个区块正离开某服务端世界，此刻仍可读                     | –           | `level: ServerLevel`、`chunk: LevelChunk`                                  |
| `SERVER_STARTED`   | 每次服务端启动，在其首个 tick                       | –      | `server: MinecraftServer`                                                      |
| `SERVER_STOPPING`  | 每次关闭，在存档保存与循环退出之前                  | –      | `server: MinecraftServer`                                                      |
| `PLAYER_JOINED`    | 玩家完成进入世界                                    | –      | `player: ServerPlayer`                                                      |
| `PLAYER_LEFT`      | 玩家正在离开                                        | –      | `player: ServerPlayer`                                                      |
| `PLAYER_RESPAWNED` | 玩家完成重生                                        | –      | `player: ServerPlayer`（本次生命新建的那个实例）                            |
| `FRAME_RATE_LIMIT` | 每帧帧率上限计算                                    | –      | `currentLimit: Int`、可写 `limit: Int`（改写帧率上限）                    |
| `GUI_OPEN`         | 任意 GUI 显示前                                     | ✅     | `screen: Screen?`（null = 当前 GUI 正在关闭）                          |
| `CHAT_SENT`        | 玩家发送聊天消息                                    | ✅     | `message: String`、`packet: Packet<ClientGamePacketListener>`                            |
| `CHAT_RECEIVED`    | 收到聊天消息（显示前）                              | ✅     | `message: String`                                                        |
| `WORLD_LOAD`       | 进入世界 / 断开连接                                 | –      | `world: ClientLevel?`（null = 断开）                                        |
| `HUD_RENDER`       | 世界已加载时每帧一次                                | –      | `graphics: GuiGraphicsExtractor`                                               |
| `BLOCK_BREAK`      | 玩家即将破坏一个方块                                | ✅     | `player`、`position: BlockPos`、`state: BlockState`                      |
| `ENTITY_ATTACK`    | 玩家的一次攻击落到实体上                            | ✅     | `player`、`target: Entity`                                             |
| `ENTITY_INTERACT`  | 玩家右键实体                                        | ✅     | `player`、`target: Entity`、`hand: InteractionHand` |
| `BLOCK_USED`       | 玩家右键一个方块                                    | ✅     | `player`、`position: BlockPos`、`hit: BlockHitResult`、`state`、`stack: ItemStack`、`hand`    |
| `ITEM_USED`        | 玩家对手上的东西空点一下（没点到方块也没点到实体）  | ✅     | `player`、`stack: ItemStack`、`hand: InteractionHand`                                                |
| `LIVING_HURT`      | 伤害即将作用到某个生物实体                          | ✅     | `entity: LivingEntity`、**可写**的 `amount: Float`、`source: DamageSource` |
| `LIVING_DIED`      | 生物实体的死亡流程启动                              | ✅     | `entity: LivingEntity`、`source: DamageSource`                                             |

这些对象上还有什么可用，见[游戏对象与 26.3 扩展层](/zh/api/native)。递来的是游戏准备拿去行动的对象，不是副本，所以 handler 可以直接在其上调用游戏自己的方法。

`PLAYER_RESPAWNED` 是唯一交出**新对象**的生命周期事件：游戏为开始这一命新建一个玩家、丢弃它替代的那一个，
所以重生前存下的句柄读起来已是"已移除"，必须换成事件递来的这个。

`LEVEL_TICK` 的范围是**单个世界**而不是单个侧：服务端每 tick 为每个已加载世界派发一次，客户端则为它渲染
中的世界派发一次。因此单人游戏里两者都会触发——集成世界与渲染世界是同一维度的两个投影，用游戏自己的
[`Level.isClientSide`](/zh/api/native) 区分。

区块那一对事件是**服务端世界**上的观察而非决定：`CHUNK_STARTED_TICKING` 派发时游戏已经把这个区块提升到运行
状态，`CHUNK_UNLOADED` 则在区块仍可读、但已经拦不住它离开的那一刻派发。两者都直接带上 `LevelChunk` 本体，
位置就在里面，所以 mod 清理自己的按区块状态时不必再回查任何东西。没有任何东西会替 mod 留着区块——维度只在
玩家附近生成区块，想让它一直运行就得持有票据，那就是 [`forceLoadChunk`](/zh/api/native) 的用途。

### 示例

修改帧率上限：

```kotlin
Events.FRAME_RATE_LIMIT.register { event ->
    if (event.limit > 120) event.limit = 120
}
```

拦截聊天：

```kotlin
Events.CHAT_RECEIVED.register { event ->
    if (event.message.contains("bad_word")) {
        event.cancel()
    }
}
```

监听进世界与断开：

```kotlin
Events.WORLD_LOAD.register { event ->
    if (event.world == null) {
        println("left the world")
    }
}
```

限制谁能破坏方块：

```kotlin
Events.BLOCK_BREAK.register { event ->
    if (event.position == spawnPedestal) {
        event.cancel()
        event.player.sendSystemMessage("这块不动。")
    }
}
```

改写数值而不是取消：带耐药效果的实体挨打时伤害减半。

```kotlin
Events.LIVING_HURT.register { event ->
    if (event.entity.hasEffect("minecraft:resistance")) event.amount /= 2f
}
```

### 取消意味着什么

- `BLOCK_BREAK`——破坏被拒绝，游戏按自己的预测重新同步，玩家看到方块弹回原位；mod 不需要发包。
- `ENTITY_ATTACK`——整次挥击都被跳过：伤害、击退、暴击、音效与动画。
- `ENTITY_INTERACT`——原版按「那里没有实体」继续，于是这次点击落到它后面的方块上。
- `BLOCK_USED`——这次点击返回 `FAIL`，即游戏自己「这一下什么都没做成」的结果：方块的 use 与手上物品
  的 use 都不执行，客户端的预测由游戏本来就会为失败点击补发的那个包回滚。
- `ITEM_USED`——同样是 `FAIL`，只不过落在没点到方块也没点到实体的那一下：进食、拉弓、朝空气放置都不
  会开始。
- `LIVING_HURT`——伤害完全不生效。`amount` 起始是原版算出的值，**可写**：handler 写下的数字就是游戏作
  用的数字，同一次调用里随后的计算（盾牌减免、游戏自己的伤害冷却）也按它进行。取消优先于改写。mod 用
  `LivingEntity.hurt(damageTypeId, amount, attacker = null)` 扩展（`org.ohmyloader.api26_3`）造成的伤害和
  怪物的攻击落进同一个钩子，因此同样受这些 handler 约束。
- `LIVING_DIED`——死亡流程停止，实体停在 0 血，直到下一次伤害重新走一遍判定；原版不死图腾就是这一
  形状。
- `GUI_OPEN` / `CHAT_SENT` / `CHAT_RECEIVED`——GUI 不打开 / 消息不发出 / 不显示。

::: tip
专用服务端没有客户端事件源：`CLIENT_TICK` / `GUI_OPEN` / `FRAME_RATE_LIMIT` / `HUD_RENDER` /
`WORLD_LOAD` 只在客户端触发；而 `SERVER_TICK`、生命周期事件（`SERVER_STARTED` / `SERVER_STOPPING` /
`PLAYER_JOINED` / `PLAYER_LEFT`）与交互事件都在服务端线程派发——专用服务端如此，单人游戏的集成服务端
亦然（它就跑在客户端进程里）。连到远端服务器的客户端收不到任何交互事件：它们所钩的代码不在那个进程
里。同一份 mod 源码双端运行仍无需自行判边。
:::
