# 项目介绍

**OhMyLoader（OML）** 是一个面向 Minecraft Java Edition 的模组加载器：自研字节码注入引擎、统一的高层
mod API、数据驱动的声明式内容注册，客户端与专用服务端双端支持。当前稳定主线为 26.3，全线运行在 Java 27 上。

## 设计理念

### 统一语义 API

mod 面向统一的高层游戏语义编程（事件、生命周期、内容注册），不直接接触版本内部结构。跨版本的底层代差只发生在
语义层之下的驱动层（adapter），不向上泄漏。

### 自研字节码引擎

内核自带轻量级字节码手术刀，替代繁重的 SpongePowered Mixin 与 Access Transformer 底层：

- **注入 DSL**：`atHead` / `atReturn` / `beforeCall` 等锚点 + `call` / `modifyArg` / `redirectCall` 等
  载荷，语义对齐 Mixin，但完全静态声明、启动期自检；
- **Mixin 类合并**：`@Shadow` / `@Overwrite` / `@Unique` / `@Accessor` / `@Invoker` 全支持；
- **注解前端**：习惯 Mixin 的开发者可以直接写 `@Mixin` / `@Inject`，加载器编译成注入规则后走同一条管线。

每条规则启动期都会做处理器存在性、静态性、签名一致性与命中数自检——写错的规则在启动时炸，而不是在游戏里
静默地"少做一件事"。

### 极薄 Adapter

每个游戏版本只有一个薄适配层（`oml-adapter-*`），只负责钩子锚点与原生类型桥接。当前稳定主线是 **26.3**；
最新快照由 `oml-adapter-snapshot` 单独跟随迭代，它与 26.3 适配层共享全部实现——26.4 正式版落地只差一次
形状核对，不是重写。

### 双轨内容

- **代码轨**：`ContentRegistry` 声明方块 / 物品 / 配方，在注册表冻结点材料化为原生内容；
- **数据轨**：在 `.oml` 归档的 `content/` 目录树下以一文件一实体的 TOML 声明数据驱动的方块与物品，无需任何代码。

## 仓库结构

| 仓库                                                                 | 内容                                                       |
|----------------------------------------------------------------------|------------------------------------------------------------|
| [OhMyLoader](https://github.com/OhMyLoader/OhMyLoader)               | 加载器本体：内核、API、版本 adapter、安装器、原生库        |
| [OhMyLoaderGradle](https://github.com/OhMyLoader/OhMyLoaderGradle)   | 官方 Gradle 插件：运行环境装配与 `runClient` / `runServer` |
| [OhMyLoaderTestMod](https://github.com/OhMyLoader/OhMyLoaderTestMod) | 端到端验证模组，以外部 mod 工程的身份走完整消费路径        |

三个仓库互相只按 Maven 坐标消费。详细的模块划分见 loader 仓库 README。

## API 稳定性

面向 mod 的接口分三层，契约见 loader 仓库的
[`oml-api/README.md`](https://github.com/OhMyLoader/OhMyLoader/blob/main/oml-api/README.md)：

- **契约层**：`@Mod` 入口、`OMLModInitializer` / `ModContext`、`Events`、内容声明 DSL 与注入
  DSL。0.x 阶段破坏性变更以 `!` 提交直接落地——不留弃用过渡，迁移方式写入提交正文；1.0 起
  冻结：破坏性变更升为大版本事件，旧签名经弃用保留一个大版本。
- **已提供、仍在沉淀**：命令、配置、网络、按键 / HUD / 创造标签——已交付，1.0 前允许调整，
  变更记录进发布说明。
- **版本面向，随游戏版本变动**：整个 `oml-api-26_3` 工件——事件载荷与扩展函数直接命名游戏自己的类
  （`ServerPlayer`、`BlockPos`、`DamageSource`…），中间没有包装层，需要游戏类型的那一层直接就是
  游戏类型。这一层只对单一游戏版本负责，不跨版本兼容——换游戏版本就是换 `oml-api-<version>` 工件。
  个别句柄（`OMLCommandSource`、`OMLNetworkContext`、`OMLBlock`）保留 `platform` 属性，用于拿到原生游戏对象。
