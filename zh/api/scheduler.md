# 主线程调度器

`OMLScheduler` 把工作排进游戏自身的线程队列，这是离开非游戏线程的唯一受支持方式：网络入站处理器
跑在 Netty 线程上，而它接到的游戏对象（`ServerLevel`、`ServerPlayer`、物品栏）只有从驱动它们 tick 的线程改动才是安全的。

```kotlin
OMLScheduler.schedule(OMLSide.SERVER) {
    OMLGame.server?.broadcastMessage("从数据包线程同步过来")
}
```

## 接口

| 调用                                                                  | 运行时机                   |
|-----------------------------------------------------------------------|----------------------------|
| `schedule(side, delayTicks = 0, task)`                                 | 在 `delayTicks` 之后运行一次 |
| `repeat(side, intervalTicks, initialDelay = 0, task)`                  | 每 `intervalTicks` 运行一次  |
| `OMLTask.cancel()` / `OMLTask.canceled`                                | 取消，可重复调用             |

- `delayTicks = 0` 表示「下一个 tick」。任务绝不会早于入队后的那个 tick 运行，而入队本身在任意线程
  都安全。
- `repeat` 要求 `intervalTicks >= 1`——周期为 0 会无限重入同一个 tick。
- `cancel()` 在任意线程都安全，且在该任务下一个到期 tick 生效，因此重复任务不会再多跑一次。
- 抛异常的任务会被记录并丢弃，同一 tick 里其余任务照常运行。

## 两侧

`OMLSide` 选择队列，每个队列随自己的 tick 事件前进：

| 边       | 由谁推进                                              |
|----------|-------------------------------------------------------|
| `CLIENT` | `CLIENT_TICK`——客户端逻辑/渲染线程                      |
| `SERVER` | `SERVER_TICK`——专用或集成服务端线程                     |

::: warning 不 tick 的一侧永远不会运行你的任务
专用服务端没有客户端 tick，因此在上面排给 `OMLSide.CLIENT` 的任务会无限留在队列里。反过来同样成立：
纯客户端 mod 在主菜单排给 `OMLSide.SERVER`，等的可能是一个永不启动的服务端。请按你要改动的状态属于
哪一侧来排队。
:::

单人游戏里两个队列都会前进——客户端线程与集成服务端线程同时存在——所以一份 mod 可以向任一侧排队。

## 顺序

同一 tick 到期的任务按入队顺序运行；在运行中的任务里再排的任务到期于下一个 tick，而不是当前这个。
调度器没有挂钟概念：延迟以 tick 计，因此游戏暂停时队列也一起暂停。
