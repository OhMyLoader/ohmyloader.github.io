# 下载与安装

## 玩家：安装器

安装器尚未发布——项目处于预发布阶段。从 loader 源码构建并运行：

```bash
git clone https://github.com/OhMyLoader/OhMyLoader.git
cd OhMyLoader && ./gradlew :oml-installer:shadowJar
java -jar dist/oml-installer-*.jar
```

选择目标：

| 目标         | 说明                                                                                                     |
|--------------|----------------------------------------------------------------------------------------------------------|
| 标准启动器   | 写一个 `inheritsFrom` 指向原版版本的启动器版本 + OML 运行层，装进 PCL2 / HMCL 等任何标准启动器的游戏目录 |
| Prism 启动器 | 注册为 Prism 的实例组件                                                                                  |
| 专用服务端   | 落地一个带启动脚本的服务端目录                                                                           |

安装完成后，在启动器里选择 OML 版本（`<game-version>-OML`）即可进游戏。**游戏本体（客户端 jar / 运行库 /
natives / 资产）由启动器自行下载**，安装器只安装 OML 层。

## 内容包：浏览器编辑器

内容包作者可以在浏览器里搭建并校验 TOML 内容包 —— 无需安装、无需构建。编辑器导出的
`.oml` 归档按普通内容包加载：[OhMyLoader 编辑器](/editor/)。

## 开发者：Maven 坐标

所有构件在 `org.ohmyloader` 组下，当前版本 `0.1.0-SNAPSHOT`：

| 构件                   | 用途                                                            |
|------------------------|-----------------------------------------------------------------|
| `oml-api`              | mod 编译时唯一需要的依赖：事件 / 生命周期 / 内容声明 / 注入 DSL |
| `oml-core`             | 加载器内核（运行时层）                                          |
| `oml-launcher`         | 启动自举头（运行时层）                                          |
| `oml-adapter`          | 游戏适配层（运行时层）                                          |
| `oml-native`           | Zstd 编解码原生库（可选，缺失时降级 vanilla 实现）              |

目前还没有构件仓库。预发布阶段，工程从本地 Maven 仓库解析 `org.ohmyloader:*`：clone loader 与插件仓库，
各自执行 `./gradlew publishToMavenLocal`——完整步骤见[第一个 mod](/zh/guide/first-mod)。
