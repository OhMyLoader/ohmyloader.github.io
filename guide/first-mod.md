# Your First Mod

## Prerequisites

- Zulu JDK 27;
- For now, local development requires publishing both repositories to your local Maven repository:
  the loader provides the runtime coordinates, the Gradle plugin provides `org.ohmyloader.gradle`.
  They are independent projects, so publish each one:

```bash
git clone https://github.com/OhMyLoader/OhMyLoader.git
git clone https://github.com/OhMyLoader/OhMyLoaderGradle.git
(cd OhMyLoader && ./gradlew publishToMavenLocal)
(cd OhMyLoaderGradle && ./gradlew publishToMavenLocal)
```

When only the plugin changed, republishing the plugin is enough.

## Set up the project

`settings.gradle.kts` — the plugin has to be resolvable from `mavenLocal` *before* the project
exists, and project-level `repositories { }` does not cover plugin resolution:

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

`build.gradle.kts`:

```kotlin
plugins {
    kotlin("jvm") version "2.5.0-Beta1"
    id("org.ohmyloader.gradle") version "0.1.0-SNAPSHOT"
}

kotlin {
    jvmToolchain(27)
}

oml {
    minecraftVersion.set("26.3")
}
```

The Kotlin version has to be one that can target Java 27 class files; `2.5.0-Beta1` is what the
loader itself is built with.

The `oml-gradle` plugin does everything else. On the compile classpath it puts `oml-api`, the
version-facing `oml-api-<version>` (`oml-api-26_3` for 26.3, named from `minecraftVersion` —
[Tracking snapshots](#tracking-snapshots) covers the case where a project has to name it), the game's
own client jar and that version's library jars — a mod's sources can name `net.minecraft.*` types, and
they compile against the same classes the game runs. It also resolves the runtime layer (including the
per-version adapter), provides `runClient` / `runServer`, and downloads and verifies the game jar,
libraries, natives and assets.

Because the version-facing artifact's coordinate is derived from it, `minecraftVersion` is now required —
also for a project that only compiles and never launches the game. Without it, resolving `compileOnly`
fails with "no value" rather than quietly dropping the artifact.

::: warning Name your packages somewhere else
Keep mod classes out of the `org.ohmyloader.` prefix. That namespace is parent-first: a mod inside it is
defined by the launcher layer, whose search path carries the game jar but not the version's libraries, so
its first `net.minecraft.*` reference fails with `NoClassDefFoundError`. Any other prefix — `com.example.…`
— is loaded child-first like every real mod.
:::

## Write the code

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

After the game finishes initializing, the loader instantiates the `@Mod` class and calls
`onInitialize`. Event subscription is reflection-free lambda registration.

## Run

```bash
./gradlew runClient   # runs the client
./gradlew runServer   # runs the server
```

`runClient` chains `fetchClientJar` / `fetchLibraries` / `extractNatives` / `fetchAssets` (all
SHA-1-verified) and installs this project's jar into `mods/`. The client's game directory is
`run/client/`, the server's is `run/server/`; their `assets/` and `mods/` directories are shared.

The server writes `run/server/eula.txt` on first start — for local development and automated
acceptance only; real deployments must read and accept the
[Minecraft EULA](https://aka.ms/MinecraftEULA) themselves.

## Tracking snapshots

Set the version to the literal `snapshot` — the runtime resolves it to the manifest's latest
snapshot, and a new snapshot needs no configuration change:

```kotlin
oml {
    minecraftVersion.set("snapshot")
    // one version-facing API module covers the snapshots too — there is no oml-api-snapshot
    apiArtifact.set("oml-api-26_3")
}
```

The runtime layer then uses `oml-adapter-snapshot`, the working copy in the loader repository that
iterates with the snapshots. Its compatibility with the snapshot is continuously verified by the
loader's shape tests.

`apiArtifact` is the one property a snapshot project has to name: the loader publishes a single
version-facing API module and builds the snapshot adapter against it, so the coordinate derived from
the game version (`oml-api-snapshot`) was never published. The plugin fails the configuration naming
this property instead of leaving dependency resolution to report it.
