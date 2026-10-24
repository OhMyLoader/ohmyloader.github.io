# 第一个 mod

## 前置

- Zulu JDK 27；
- 本地开发暂时需要把两个仓库都发布到本地 Maven 仓库：loader 提供运行时坐标，Gradle 插件提供
  `org.ohmyloader.gradle`。两者是独立工程，各自发布一次：

```bash
git clone https://github.com/OhMyLoader/OhMyLoader.git
git clone https://github.com/OhMyLoader/OhMyLoaderGradle.git
(cd OhMyLoader && ./gradlew publishToMavenLocal)
(cd OhMyLoaderGradle && ./gradlew publishToMavenLocal)
```

之后只改动了插件时，重新发布插件即可。

## 建立工程

`settings.gradle.kts` —— 插件必须在工程存在 **之前**就能从 `mavenLocal` 解析，而工程级的
`repositories { }` 管不到插件解析：

```kotlin
pluginManagement {
    repositories {
        mavenLocal()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        mavenLocal()
        mavenCentral()
    }
}

rootProject.name = "my-mod"
```

`build.gradle.kts`：

```kotlin
plugins {
    kotlin("jvm") version "2.5.0-Beta2"
    id("org.ohmyloader.gradle") version "0.1.0-SNAPSHOT"
}

kotlin {
    jvmToolchain(27)
}

oml {
    minecraftVersion.set("26.3")
}
```

Kotlin 版本必须能产出 Java 27 字节码，`2.5.0-Beta2` 正是 loader 自用的版本。

`oml-gradle` 插件会自动完成其余一切。编译类路径上它会放好 `oml-api`、版本面向的 `oml-api-<version>`
（26.3 即 `oml-api-26_3`，坐标由 `minecraftVersion` 推导；追快照时需要自己命名，见下文「追快照」）、
游戏自己的客户端 jar 与该版本的运行库 jar
——mod 源码可以直接命名 `net.minecraft.*` 类型，而它编译时所面对的就是游戏运行的那批类。此外它按版本解析
运行层（含 per-version adapter）、提供 `runClient` / `runServer`、下载并校验游戏 jar / 运行库 / natives / 资产。

由于版本面向工件的坐标由版本推导，`minecraftVersion` 现在是必填项——即使一个工程只编译、从不启动游戏也不
例外。缺它时解析 `compileOnly` 会以「无值」失败，而不是悄悄少掉那个工件。

::: warning 包名不要借用 `org.ohmyloader.`
mod 的类不要放在 `org.ohmyloader.` 这个前缀下。该命名空间是 parent-first：处在其中的 mod 由启动器层定义，而启动器层的搜索
路径只有游戏 jar、没有该版本的运行库，于是它第一次引用 `net.minecraft.*` 就会以 `NoClassDefFoundError`
失败。加载器在扫描 mods 目录时就会拒绝这种 jar，并点名是哪个 jar、哪些被打进去的类，所以它落在启动日志里，
而不是变成 mod 运行到一半的崩溃。换任何其他前缀（例如 `com.example.…`），就和所有真实 mod 一样按 child-first
加载。
:::

## 写代码

```kotlin
import org.ohmyloader.api.Mod
import org.ohmyloader.api.ModContext
import org.ohmyloader.api.OMLModInitializer
import org.ohmyloader.api26_3.event.Events

@Mod(id = "my_mod", name = "My Mod", version = "1.0.0")
class MyMod : OMLModInitializer {
    override fun onInitialize(context: ModContext) {
        println("hello, ${context.id}!")

        Events.CHAT_RECEIVED.register { event ->
            if (event.message == "hello") {
                event.cancel()
            }
        }
    }
}
```

游戏初始化完成后，加载器实例化 `@Mod` 类并调用 `onInitialize`；事件订阅是零反射的 lambda 注册。

## 运行

```bash
./gradlew runClient   # 运行客户端
./gradlew runServer   # 运行服务端
```

`runClient` 自动链式执行 `fetchClientJar` / `fetchLibraries` / `extractNatives` / `fetchAssets`（全部带
SHA-1 校验），本工程构建出的 jar 会被装进 `mods/`。游戏目录在 `run/client/`，服务端在 `run/server/`，
两者的 `assets/` 与 `mods/` 共享。

服务端首次启动会写 `run/server/eula.txt`——仅用于本地开发与自动化验收；真实部署请自行阅读并同意
[Minecraft EULA](https://aka.ms/MinecraftEULA)。

## 追快照

把版本改成字面量 `snapshot` 即可，运行期自动解析为版本清单里的最新快照，新快照发布无需改任何配置：

```kotlin
oml {
    minecraftVersion.set("snapshot")
    // 版本面向的 API 只有一份，快照也用它——不存在 oml-api-snapshot
    apiArtifact.set("oml-api-26_3")
}
```

此时运行层使用 `oml-adapter-snapshot`——它是 loader 仓库里跟随快照迭代的工作副本，钩子与快照的兼容性由
loader 仓库的形状测试持续验证。

`apiArtifact` 是追快照时唯一需要显式命名的属性：loader 只发布一份版本面向的 API 模块，快照适配器也是
针对它构建的，因此由游戏版本推导出的坐标（`oml-api-snapshot`）从未发布过。插件会在配置阶段直接失败并
点名这个属性，而不是把问题留给依赖解析去报告。
