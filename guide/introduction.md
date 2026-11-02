# Introduction

**OhMyLoader (OML)** is a mod loader for Minecraft Java Edition. It provides a custom bytecode injection
engine, a two-layer mod API, and declarative content registration on the client and the dedicated server.
The current stable line is 26.3; the full stack runs on Java 27.

## Design

### Unified semantic API

Mods use high-level game semantics (events, lifecycle, content registration) and do not touch version
internals. The per-version adapter absorbs version differences below that layer; they do not leak upward.

### Injection engine

The loader implements its own injection engine and replaces the SpongePowered Mixin and Access Transformer
layers:

- **Injection DSL**: anchors such as `atHead`, `atReturn`, and `beforeCall`, with payloads such as `call`,
  `modifyArg`, and `redirectCall`. The semantics match Mixin, but the rules are declarative and checked at
  startup.
- **Mixin class merging**: `@Shadow`, `@Overwrite`, `@Unique`, `@Accessor`, and `@Invoker` are supported.
- **Annotation front end**: mods that use Mixin can keep writing `@Mixin` and `@Inject`; the loader compiles
  the annotations into injection rules and runs them through the same pipeline.

Every rule is verified at startup: handler existence, staticness, signature consistency, and match counts. A
wrong rule fails the launch instead of silently doing less in game.

### Thin adapters

Each game version has a thin adapter module (`oml-adapter-*`) that maps hook anchors and native types. The
stable line is 26.3. `oml-adapter-snapshot` tracks the latest snapshot and shares its implementation with the
26.3 adapter; a 26.4 release needs a shape check and mapping, not a rewrite.

### Two content tracks

- **Code track**: declare blocks, items, and recipes with `ContentRegistry`; they materialize into native
  content at the registry freeze point.
- **Data track**: declare data-driven blocks and items as per-entity TOML files under `content/` in an `.oml`
  archive, with no code.

## Repositories

| Repository | Contents |
|---|---|
| [OhMyLoader](https://github.com/OhMyLoader/OhMyLoader) | Loader: core, API, version adapters, installer, native library |
| [OhMyLoaderGradle](https://github.com/OhMyLoader/OhMyLoaderGradle) | Official Gradle plugin: runtime assembly and `runClient` / `runServer` |
| [OhMyLoaderTestMod](https://github.com/OhMyLoader/OhMyLoaderTestMod) | End-to-end verification mod, consumed exactly like an external mod project |

The three repositories consume each other only by Maven coordinate. The loader README documents the module
layout.

## API stability

The mod-facing surface has three tiers, defined in the loader's
[`oml-api/README.md`](https://github.com/OhMyLoader/OhMyLoader/blob/main/oml-api/README.md):

- **Contracted**: the `@Mod` entry, `OMLModInitializer` / `ModContext`, `Events`, the content declaration DSL,
  and the injection DSL. During 0.x, breaking changes land directly as `!` commits with no deprecation window;
  each commit body gives the migration. From 1.0, the tier freezes: breaking changes become major-version
  events, and old signatures remain deprecated for one major release.
- **Provided, settling**: commands, config, network, keybindings, HUD, and creative tabs. These may change
  until 1.0; changes are recorded in the release notes.
- **Version-facing, tracks the game**: the `oml-api-26_3` artifact. Event payloads and extensions name the
  game's own classes (`ServerPlayer`, `BlockPos`, `DamageSource`). There is no wrapper layer; a game type is
  the game type. This tier is contracted to one game version. A new game version uses the matching
  `oml-api-<version>` artifact. A few handles (`OMLCommandSource`, `OMLNetworkContext`, `OMLBlock`) keep a
  `platform` property for reaching the raw game object.
