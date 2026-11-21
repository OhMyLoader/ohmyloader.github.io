# Download & Install

## Players: the installer

1. Download the latest `oml-installer-<version>.jar` from
   [GitHub Releases](https://github.com/OhMyLoader/OhMyLoader/releases).
2. Double-click it, or run `java -jar oml-installer-<version>.jar`.
3. Pick a target:

| Target            | What it does                                                                                                                                                |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Standard launcher | Writes a launcher version that `inheritsFrom` the vanilla one, plus the OML runtime layer, into the game directory of any standard launcher (PCL2, HMCL, …) |
| Prism launcher    | Registers an OML component on a Prism instance                                                                                                              |
| Dedicated server  | Lands a server directory with start scripts                                                                                                                 |

4. After installing, select the OML version (e.g. `26.3-OML`) in your launcher and start the game. **The game itself (
   client jar, libraries, natives, assets) is downloaded by the launcher** — the
   installer only installs the OML layer.

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
| `oml-adapter-26_3`     | The 26.3 stable-line adapter (runtime layer)                                                        |
| `oml-adapter-snapshot` | The latest-snapshot adapter (for snapshot tracking)                                                 |
| `oml-native`           | The Zstd codec native library (optional; falls back to vanilla implementations)                     |

The current publishing channel is GitHub Packages (an interim server until a dedicated Maven
repository exists; reading it requires a GitHub token). For local development, use `mavenLocal` —
clone the loader repository and run `./gradlew publishToMavenLocal`, see
[Your First Mod](/guide/first-mod).
