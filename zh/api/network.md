# 自定义网络载荷

mod 的流量走 Minecraft 的自定义载荷包（custom payload）。26.x 按注册顺序分配包 id，mod 若新增自己的
包类型，会把其后的所有 id 往后挪，直接让原版客户端解包错位。载荷走的是 **两个固定的包 id + 按通道名
路由**，所以 OML 暴露的是"通道"而不是"包类型"。

通道只声明一次，双端共用同一份代码：loader 在客户端进程和服务端进程里发布的是同一批声明，所以同一个
mod jar 既能对单人模式（集成服务端）工作，也能对专用服务端工作，不需要分别声明。

## declareNetwork

`@Mod` 类实现 `OMLNetworkProvider`，loader 会在 `onInitialize` 之后紧接着调用它：

```kotlin
@Mod(id = "my_mod", name = "My Mod", version = "1.0.0")
class MyMod : OMLModInitializer, OMLNetworkProvider {

    override fun declareNetwork(network: OMLNetworkRegistry) {
        network.clientToServer(SYNC) { payload, context ->
            // 本端接收来自客户端的包 —— 在服务端一侧注册
        }
        network.serverToClient(SYNC) { payload, context ->
            // 本端接收来自服务端的包 —— 在客户端一侧注册
        }
    }
}
```

每个方向指的都是 **注册它的那一端要接收的方向**。没有任何一端声明该方向的包会交回原版逻辑处理；
发送同理——一个类型只能按它声明时的方向发出去，方向不符会抛异常，消息里带上通道名。

## 载荷类型与编解码

一个通道 = 一个 id + 一个基于 OML 自有 buffer 的编解码器。不带命名空间的 id 会以声明它的 mod id
作为命名空间发布，于是 `my_mod` 声明的 `sync` 就是 `my_mod:sync`：

```kotlin
data class Sync(val count: Int, val label: String)

object SyncCodec : OMLPayloadCodec<Sync> {
    override fun write(buffer: OMLPacketBuffer, value: Sync) {
        buffer.writeInt(value.count)
        buffer.writeString(value.label)
    }

    override fun read(buffer: OMLPacketBuffer): Sync = Sync(buffer.readInt(), buffer.readString())
}

val SYNC = OMLPayloadType("sync", SyncCodec)
```

通道名必须匹配 `<namespace>:<path>`：命名空间允许小写字母、数字、`.`、`-`、`_`，路径额外允许 `/`。
校验发生在声明时，所以非法名字会指名道姓地报错是哪个 mod，而不是等到游戏启动时在一个与 mod 无关的
位置崩溃。两个 mod 在同一方向上抢占同一个通道时，后声明的那条声明会直接失败并指出先占用的那一个；其余 mod 照常加载。

`OMLPacketBuffer` 就是全部的线路接口——它不暴露任何版本内部类型：

| 写             | 读            | 编码方式                   |
|----------------|---------------|----------------------------|
| `writeBoolean` | `readBoolean` | 1 字节                     |
| `writeByte`    | `readByte`    | 1 字节                     |
| `writeInt`     | `readInt`     | 变长（1–5 字节）           |
| `writeLong`    | `readLong`    | 变长（1–10 字节）          |
| `writeFloat`   | `readFloat`   | 4 字节                     |
| `writeDouble`  | `readDouble`  | 8 字节                     |
| `writeString`  | `readString`  | 长度前缀 UTF-8             |
| `writeUuid`    | `readUuid`    | 16 字节                    |
| `writeBytes`   | `readBytes`   | 长度前缀，读取时不需传长度 |

`write` 与 `read` 按位置消费同一串字段，两端必须写同样的顺序——这由共享的声明本身保证。编解码里只做
字段搬运：它跑在网络线程上。

## 发送

```kotlin
OMLNetwork.sendToServer(SYNC, Sync(3, "hello"))          // 客户端 → 服务端
OMLNetwork.sendToPlayer(SYNC, Sync(3, "hello"), "Steve") // 指定玩家
OMLNetwork.sendToAllPlayers(SYNC, Sync(3, "hello"))      // 所有在线玩家
```

玩家名用的是 scoreboard name。发给一个不在线的名字只会打一条 warn，不抛异常——玩家正好退出是正常
竞态。`sendToServer` 要求客户端已经在世界里；`sendToPlayer` 与 `sendToAllPlayers` 找的是本进程承载的
那个服务端（专用服务端，或单人模式的集成服务端）。

## 接收上下文

处理函数会收到一个 `OMLNetworkContext`：

| 成员         | 含义                                  |
|--------------|---------------------------------------|
| `modId`      | 声明该通道的 mod                      |
| `senderName` | 对端的名字——连接上没有玩家时为 `null` |
| `platform`   | 连接背后的原生版本对象（惯例逃生舱）  |

`senderName` 取自连接本身，绝不取自载荷：客户端能决定发什么，但不能决定自己是谁。服务端处理函数若要
信任某个身份，读这个字段。

## 线程与阶段

::: warning 处理函数运行在网络线程
两端的接包处理都在网络线程上触发，不是服务端线程或客户端线程。在这里只做记录状态、或再回一个载荷；
不要直接改世界、玩家列表或界面。需要回到游戏线程的工作交给[主线程调度器](/zh/api/scheduler)排队——
`OMLScheduler` 的入队接口在任意线程都安全。
:::

通道发布进的是游戏的**游玩阶段（play phase）**载荷注册表。配置阶段（登录、能力协商）用的注册表 OML
无法扩展，所以在游玩阶段之前发出的包，对端根本不认识这个通道。请等世界加载完成再发。
