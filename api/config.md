# Mod Config

Every mod gets one config file: `<gameDir>/config/<mod id>.toml`, reached through
`ModContext.config`. The model is declarative — the mod states its entries and defaults during
`onInitialize`, the loader writes whatever the file does not already carry, and reads answer from
the file when a key is present and from the default when it is not. Nothing in the surface exposes a
TOML type, a save/load cycle or a config GUI: those are the loader's problem, not the mod's.

Only mods that implement `OMLModInitializer` get a `ModContext`, so only those get a config.

## Define, then read

```kotlin
@Mod(id = "my_mod", name = "My Mod", version = "1.0.0")
class MyMod : OMLModInitializer {

    private lateinit var context: ModContext

    override fun onInitialize(context: ModContext) {
        this.context = context
        context.config.define("ping_prefix", "pong", "Prefix of the /mycmd reply")
        context.config.define("loud_by_default", false, "Whether the reply shouts")
        context.config.define("max_veins", 8, "Veins per chunk, 0 disables the feature")
        context.config.define("spread", 0.25, "Fraction of chunks affected")
    }
}
```

`define` takes four value types — `Int`, `Boolean`, `Double`, `String` — plus an optional comment
that lands in the file above the key. Declaring the same name twice replaces the earlier entry, and
a name that was never declared cannot be read: `getInt("nope")` throws
`IllegalStateException: config entry 'nope' was never defined by my_mod — define it before reading`.
Define during `onInitialize`, not lazily inside a getter, or a first read can beat the declaration.

## The file the loader writes

The file is generated right after `onInitialize` returns — the declarations above are what it is
built from — and looks like this:

```toml
ping_prefix = "pong"

# Whether the reply shouts
loud_by_default = false

# Veins per chunk, 0 disables the feature
max_veins = 8

# Fraction of chunks affected
spread = 0.25
```

Keys appear in declaration order, one `#` comment line each, entries separated by a blank line. **An existing file is
never rewritten**, so the user's edits and their own comments survive upgrades
— which also means an entry added in a new mod version does not show up in the player's file. Reads
still return the declared default for a key the file lacks, so the file being incomplete is not a
bug; a mod that wants its users to see a new option has to mention it itself.

::: warning Defaults that cannot be written back
String defaults are emitted between plain quotes with no escaping. A default containing a `"` or a
newline produces a file that does not parse, and an unparseable file fails that mod's init. Keep
string defaults single-line and free of quote characters.
:::

## Reading values

| Getter             | Declared with          |
|--------------------|------------------------|
| `getInt(name)`     | `define(name, 8)`      |
| `getBoolean(name)` | `define(name, false)`  |
| `getDouble(name)`  | `define(name, 0.25)`   |
| `getString(name)`  | `define(name, "pong")` |

A getter returns the file's value when the file carries the key with the matching type. Three
things can go wrong, and only one of them is fatal:

- **Missing key** → the declared default, silently. This is the normal state of a file written by an
  older version of the mod.
- **Wrong type in the file** (`max_veins = "lots"`) → a `Config` warning naming the file, the key and
  both types, then the default. A config typo must not crash the boot.
- **Malformed file** (hand-edited into something that does not parse) → the exception surfaces while
  the mod is being initialized, so that one mod is marked failed and logged, the game still starts,
  and fixing the file plus a restart brings the mod back.

## Reload semantics

The file is parsed **once**, while the mod is initialized. There is no file watcher, no
hot-reload and no `/reload` pickup: editing a config takes effect on the next start. Getters read
the in-memory snapshot rather than the disk, so calling them per tick is cheap — and caching a value
in the mod buys nothing but a stale one.

## How much TOML the file supports

Parsing runs through OML's own minimal TOML reader, and the config surface consults only the root
table. In practice that means:

| Works                                           | Does not                                                                                                 |
|-------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| `key = 42`, `key = true`, `key = "text"`        | `[section]` tables — parsed, then ignored                                                                |
| `#` comments, blank lines                       | `[[array of tables]]`, quoted keys, dates, hex integers                                                  |
| multi-line strings? no — values are single-line | arrays / inline tables — parsed, but they can never match a declared scalar type (warning, then default) |

A flat list of `key = scalar` entries is the whole supported shape, which is exactly what the loader
generates.

## Threading

The snapshot is filled at construction and never mutated afterward, and the entry table is written
only during `onInitialize`. Reads carry no lock and no side is enforced, so a config read from a
network or worker thread is safe — what it returns is the startup snapshot either way.

::: warning Still settling
`config` is in the *provided, still settling* tier: during 0.x its shape may change, with the
changes recorded in the release notes.
:::
