# 下载与安装

## 玩家：安装器

1. 从 [GitHub Releases](https://github.com/OhMyLoader/OhMyLoader/releases) 下载最新安装器
   `oml-installer-<版本>.jar`。
2. 双击运行，或 `java -jar oml-installer-<版本>.jar`。
3. 选择目标：

| 目标         | 说明                                                                                                     |
|--------------|----------------------------------------------------------------------------------------------------------|
| 标准启动器   | 写一个 `inheritsFrom` 指向原版版本的启动器版本 + OML 运行层，装进 PCL2 / HMCL 等任何标准启动器的游戏目录 |
| Prism 启动器 | 注册为 Prism 的实例组件                                                                                  |
| 专用服务端   | 落地一个带启动脚本的服务端目录                                                                           |

4. 安装完成后，在启动器里选择 OML 版本（如 `26.3-OML`）即可进游戏。 **游戏本体（客户端 jar / 运行库 /
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
| `oml-adapter-26_3`     | 26.3 稳定主线驱动（运行时层）                                   |
| `oml-adapter-snapshot` | 最新快照驱动（追快照用）                                        |
| `oml-native`           | Zstd 编解码原生库（可选，缺失时降级 vanilla 实现）              |

当前发布渠道是 GitHub Packages（正式 Maven 仓库上线前的过渡；读取需要 GitHub token），本地开发直接用
`mavenLocal`——先 clone loader 仓库执行 `./gradlew publishToMavenLocal`，详见[第一个 mod](/zh/guide/first-mod)。
