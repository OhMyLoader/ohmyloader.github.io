# Download & Install

## Players: the installer

The installer is not published yet — the project is pre-release. Build it from the loader source and run:

```bash
git clone https://github.com/OhMyLoader/OhMyLoader.git
cd OhMyLoader && ./gradlew :oml-installer:shadowJar
java -jar dist/oml-installer-*.jar
```

Pick a target:

| Target            | What it does                                                                                                                                                |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Standard launcher | Writes a launcher version that `inheritsFrom` the vanilla one, plus the OML runtime layer, into the game directory of any standard launcher (PCL2, HMCL, …) |
| Prism launcher    | Registers an OML component on a Prism instance                                                                                                              |
| Dedicated server  | Lands a server directory with start scripts                                                                                                                 |

After installing, select the OML version (`<game-version>-OML`) in your launcher and start the game.
**The game itself (client jar, libraries, natives, assets) is downloaded by the launcher** — the installer
only installs the OML layer.

## Content packs: the browser editor

Pack authors can build and validate a TOML content pack in the browser — no install, no build step.
The editor exports an `.oml` archive that loads like any content pack: [OhMyLoader Editor](/editor/).

## Developers: Maven coordinates

All artifacts live under the `org.ohmyloader` group, current version `0.1.0-SNAPSHOT`:

| Artifact               | Purpose                                                                                             |
|------------------------|-----------------------------------------------------------------------------------------------------|
| `oml-api`              | The only compile-time dependency a mod needs: events, lifecycle, content declaration, injection DSL |
| `oml-core`             | The loader core (runtime layer)                                                                     |
| `oml-launcher`         | The bootstrap header (runtime layer)                                                                |
| `oml-adapter`          | The game adapter (runtime layer)                                                                    |
| `oml-native`           | The Zstd codec native library (optional; falls back to vanilla implementations)                     |

There is no artifact repository yet. During pre-release, projects resolve `org.ohmyloader:*` from the
local Maven repository: clone the loader and the plugin, run `./gradlew publishToMavenLocal` in each —
see [Your First Mod](/guide/first-mod) for the full setup.
