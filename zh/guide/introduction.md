# 项目介绍

**OhMyLoader（OML）** 是一个面向 Minecraft Java Edition 的模组加载器。它提供自研字节码注入引擎、两层
mod API 与声明式内容注册，支持客户端与专用服务端。当前稳定主线为 26.3，全线运行在 Java 27 上。

## 设计

### 统一语义 API

mod 使用高层游戏语义（事件、生命周期、内容注册）编程，不接触版本内部结构。版本差异由 per-version
adapter 在语义层之下吸收，不向上泄漏。

### 注入引擎

加载器实现自己的注入引擎，替代 SpongePowered Mixin 与 Access Transformer 层：

- **注入 DSL**：`atHead` / `atReturn` / `beforeCall` 等锚点，配合 `call` / `modifyArg` /
  `redirectCall` 等载荷。语义与 Mixin 一致，但规则是声明式的，并在启动期校验。
- **Mixin 类合并**：支持 `@Shadow` / `@Overwrite` / `@Unique` / `@Accessor` / `@Invoker`。
- **注解前端**：使用 Mixin 的 mod 仍可编写 `@Mixin` / `@Inject`；加载器把注解编译成注入规则，走同一条管线。

每条规则在启动期校验处理器存在性、静态性、签名一致性与命中数。写错的规则会使启动失败，而不是在游戏里
静默少做一件事。

### 薄 Adapter

每个游戏版本有一个薄适配层（`oml-adapter-*`），只负责钩子锚点与原生类型映射。稳定主线是 26.3。
`oml-adapter-snapshot` 跟随最新快照，并与 26.3 适配层共享实现；26.4 正式版需要形状核对与映射，不是重写。

### 双轨内容

- **代码轨**：用 `ContentRegistry` 声明方块、物品与配方；在注册表冻结点材料化为原生内容。
- **数据轨**：在 `.oml` 归档的 `content/` 目录下，以一文件一实体的 TOML 声明数据驱动的方块与物品，无需代码。

## 仓库结构

| 仓库 | 内容 |
|---|---|
| [OhMyLoader](https://github.com/OhMyLoader/OhMyLoader) | 加载器本体：内核、API、版本 adapter、安装器、原生库 |
| [OhMyLoaderGradle](https://github.com/OhMyLoader/OhMyLoaderGradle) | 官方 Gradle 插件：运行环境装配与 `runClient` / `runServer` |
| [OhMyLoaderTestMod](https://github.com/OhMyLoader/OhMyLoaderTestMod) | 端到端验证模组，以外部 mod 工程的身份走完整消费路径 |

三个仓库互相只按 Maven 坐标消费。详细模块划分见 loader 仓库 README。

## API 稳定性

面向 mod 的接口分三层，契约见 loader 仓库的
[`oml-api/README.md`](https://github.com/OhMyLoader/OhMyLoader/blob/main/oml-api/README.md)：

- **契约层**：`@Mod` 入口、`OMLModInitializer` / `ModContext`、`Events`、内容声明 DSL 与注入 DSL。
  0.x 阶段破坏性变更以 `!` 提交直接落地，不留弃用窗口；迁移方式写入提交正文。1.0 起冻结：破坏性变更
  升为大版本事件，旧签名经弃用保留一个大版本。
- **已提供、仍在沉淀**：命令、配置、网络、按键、HUD 与创造标签。1.0 前允许调整；变更记录进发布说明。
- **版本面向，随游戏版本变动**：`oml-api-26_3` 工件。事件载荷与扩展函数直接命名游戏自己的类
  （`ServerPlayer`、`BlockPos`、`DamageSource`）。中间没有包装层；游戏类型就是游戏类型。这一层只对
  单一游戏版本负责；换游戏版本就是换 `oml-api-<version>` 工件。个别句柄（`OMLCommandSource`、
  `OMLNetworkContext`、`OMLBlock`）保留 `platform` 属性，用于拿到原生游戏对象。
