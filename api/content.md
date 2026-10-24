# Content Registration

Content comes in two tracks: the **code track** (`ContentRegistry`, this page) and the **data
track** (TOML content packs, at the end). Both share one pipeline: declarations are collected
during startup and materialized into native content at the **registry freeze point**, after which
they are indistinguishable from vanilla content.

::: warning The registry freezes
Minecraft's registries freeze early in startup; afterward nothing can be added or removed. OML
materializes your declarations at that freeze point — after it (including at runtime) no new
content can appear. Declare content inside [`declareContent`](#declarecontent).
:::

## declareContent

Make the `@Mod` class implement `OMLContentProvider`, and the loader calls it before the game's
main logic starts:

```kotlin
@Mod(id = "my_mod", name = "My Mod", version = "1.0.0")
class MyMod : OMLModInitializer, OMLContentProvider {
    override fun declareContent(registry: ContentRegistry) {
        // declare here
    }
}
```

The registry is already bound to the mod's namespace: ids in declarations carry no domain, and OML
binds them under the mod id.

## Blocks

```kotlin
val block = registry.declareBlock("ruby_ore") {
    hardness = 3.0f
    blastResistance = 6.0f
    dropsRequireCorrectTool = true
}
```

| Property                      | Default               | Meaning                          |
|-------------------------------|-----------------------|----------------------------------|
| `hardness`                 | vanilla default       | hardness (time to break)         |
| `blastResistance`         | follows `hardness` | blast resistance                 |
| `dropsRequireCorrectTool` | `false`               | drops only with the correct tool |

Every block automatically registers its block item. The returned `OMLBlock` exposes `platform`
(the native block object) once content registration completes — the escape hatch for
version-specific behavior.

### Behavior hooks

Blocks can carry declarative behavior hooks; their implementation is the version adapter's (it
materializes its own `Block` subclass), and your handlers are plain lambdas. The vanilla behavior
always still runs — a behavior block is a plain block plus hooks.

```kotlin
registry.declareBlock("trap_floor") {
    onStepOn { event ->
        if (!event.isClient) {
            // server side: apply damage, effects — via event.level / event.entity if needed
        }
    }
    onHit { event ->
        // a player just started breaking the block
    }
}
```

| Hook       | Fires                                                | Event                                                     |
|------------|------------------------------------------------------|-----------------------------------------------------------|
| `onStepOn` | every tick an entity stands on the block, both sides | `OMLStepOnEvent` — x/y/z, `isClient`, `level`, `entity`   |
| `onHit`    | a player starts breaking the block                   | `OMLBlockHitEvent` — x/y/z, `isClient`, `level`, `player` |

`level` and `entity`/`player` are the raw version objects — the same escape hatch as `platform`.
Gate gameplay effects on `isClient`: the hook fires on both sides.

### Block entities: machines

`blockEntity` gives the block a server-side tick and a **persistent data store** — the pieces a
machine is made of:

```kotlin
registry.declareBlock("press") {
    blockEntity {
        tick { event ->
            val progress = event.data.getInt("progress") + 1
            event.data.putInt("progress", progress)   // survives save/reload
        }
    }
}
```

- `tick` runs once per game tick while the chunk is loaded, **server side only** (the client never
  sees the event — a machine tick is a simulation concept).
- `event.data` is an `OMLBlockData`: primitive-typed key-value pairs (`int` / `long` / `float` /
  `double` / `boolean` / `string`) that persist with the world; writes mark the block entity for
  the next autosave. `getString` answers null for an absent key, and `hasKey` / `remove` / `keys` are the
  three answers a default cannot give — a stored zero and a missing key are different facts, and a machine
  that clears a setting has to be able to say so. `keys()` keeps write order and is a copy.
- The same store is reachable from outside the ticker by dimension and position, through
  [`blockDataAt`](/api/native#levels) — what lets a command, a packet handler or another block
  read a machine without going through its tick handler.
- A block may combine behavior hooks and a block entity freely.

### World generation: ores

`generateAsOre` makes the block generate naturally as a vein. It materializes into datapack
worldgen files merged into the target biomes — like any datapack ore, **only newly generated
chunks** are affected:

```kotlin
registry.declareBlock("ruby_ore") {
    hardness = 3.0f
    dropsRequireCorrectTool = true
    generateAsOre {
        veinSize = 8        // blocks per vein
        perChunk = 6        // placement attempts per chunk
        minY = 16
        maxY = 64           // trapezoid height distribution
        biomes += listOf("minecraft:forest", "minecraft:taiga")  // empty = every biome
    }
}
```

The vein replaces the stone family (`minecraft:stone_ore_replaceables`); an empty `biomes` list is
safe outside the overworld for the same reason — netherrack and end stone do not match.

## Items

```kotlin
registry.declareItem("ruby_sword") {
    maxDurability = 592
    attackDamage = 7.0
    attackSpeed = -2.4   // vanilla base 4.0 → effective 1.6
    miningSpeed = 1.0f
    toolDamagePerBlock = 2
    minesAndDrops("minecraft:stone", 8.0f)   // on stone: mining speed 8, drops loot
    overrideSpeed("minecraft:dirt", 4.0f)    // on dirt: mining speed 4, vanilla drops
    deniesDrops("minecraft:bedrock")         // never drops
}
```

| Property                     | Default            | Meaning                                                         |
|------------------------------|--------------------|-----------------------------------------------------------------|
| `maxDurability`                  | none (unbreakable) | max durability; > 0 shows the durability bar                    |
| `attackDamage`               | none               | main-hand attack damage **modifier** (vanilla fists: 1.0)       |
| `attackSpeed`                | none               | main-hand attack speed **modifier** (vanilla base: 4.0)         |
| `miningSpeed`                | –                  | default mining speed when no rule matches (requires tool rules) |
| `toolDamagePerBlock`         | `1`                | durability cost per broken block                                |
| `breaksBlocksInCreative` | `true`             | instant breaking in creative mode                               |

Tool rule semantics: `minesAndDrops` = matched blocks mine at the given speed **and drop loot**;
`overrideSpeed` = speed only, vanilla drops; `deniesDrops` = vanilla speed, never drops. These map
onto the native `DataComponents.TOOL`.

## Recipes and drops

### Crafting

```kotlin
// shaped: 2x2 ruby from 4 ruby items (pattern rows reference the key map, ' ' = empty cell)
registry.declareShapedCrafting(
    result = "my_mod:ruby_block",
    pattern = listOf("RR", "RR"),
    key = mapOf('R' to "my_mod:ruby"),
)

// shapeless: any arrangement of the ingredients
registry.declareShapelessCrafting(
    result = "my_mod:ruby",
    ingredients = listOf("my_mod:ruby_ore", "minecraft:stick"),
    count = 2,
)
```

Pattern rules: 1-3 rows of 1-3 cells, all rows the same width, every non-blank character must have
a key entry — a malformed pattern throws at declaration time, before the pack ever loads. Bare
ingredient ids are qualified with the mod's namespace. The datapack file id derives from the result
(`my_mod:ruby_block` → `my_mod_ruby_block`); two recipes with the same result get a numeric suffix.

### Smelting

```kotlin
// smelting (furnace: SMELTING / BLASTING / SMOKING, default SMELTING)
registry.declareSmelting(
    input = "minecraft:raw_iron",
    result = "minecraft:iron_ingot",
    experience = 0.7,
    cookingTime = 200,
)

// drop override: breaking ruby_ore drops 1–3 ruby
registry.declareBlockDrop(block = "ruby_ore", drop = "my_mod:ruby", dropCountMin = 1, dropCountMax = 3)
```

Recipes and loot tables materialize into datapack JSON served through OML's injected resource pack —
the **vanilla datapack reload path**, server-authoritative and synced to clients.

### Damage types

A mod's damage can have its own type, with its own name in the death message, its own difficulty scaling
and the vanilla hit sounds that go with it:

```kotlin
registry.declareDamageType(
    id = "melt",                       // becomes my_mod:melt in the registries and in hurt()
    messageId = "my_mod.melts",         // the death message's key
    scaling = "when_caused_by_living_non_player",
    effects = "burning",
    exhaustion = 0.3f,
)
```

`scaling` is `never`, `when_caused_by_living_non_player` or `always`; `effects` is `hurt`, `thorns`,
`drowning`, `burning`, `poking` or `freezing`; `deathMessageType` is `default`, `fall_variants` or
`intentional_game_design`. The two optional ones are omitted from the file when unset, so the game applies
its own default rather than OML guessing one.

This is the same datapack route as recipes: OML writes
`data/my_mod/damage_type/melt.json` into its injected pack and the game's reload registers it, so the type
is in `server.registry(Registries.DAMAGE_TYPE)` and the 26.3 [`hurt`](/api/native) extension accepts `"my_mod:melt"`
like
any vanilla id — and a handler sees the declared `messageId` in `LIVING_HURT`. An unknown enum name is
refused at declaration with a warning, because a file the datapack codec rejects would otherwise disappear
during reload with no owner to blame.

### Clocks and the moments on them

26.3 counts time in clocks addressed by registry id, and the named moments `/time set` moves a clock onto
are **markers** declared by a timeline. Both are datapack entries, so a mod can add its own time domain:

```kotlin
registry.declareClock("tide")                 // becomes my_mod:tide — a clock is nothing but its id
registry.declareTimeline("surge") {
    clock = "tide"                            // the clock these markers move; bare ids bind to this namespace
    periodTicks = 24000                       // one cycle; omit it and the markers never repeat
    marker("low_tide", 0)                     // not offered by /time set
    marker("high_tide", 12000, inCommands = true)
}
```

OML serves `data/my_mod/world_clock/tide.json` and `data/my_mod/timeline/surge.json` from the injected pack,
and the game's reload puts them in `Registries.WORLD_CLOCK` and `Registries.TIMELINE`. What the game then
does with them is the whole point: `ServerClockManager` runs an instance for **every registered clock**, so
`my_mod:tide` counts once per game tick and syncs to clients even though no dimension runs on it, and
[`applyMarker`](/api/native) can move it onto `"my_mod:high_tide"` — the same move `/time set` makes on the
overworld's clock. Reads that show the declaration landed are
[`timelineIds`, `clockDrivenBy` and `timeMarkersOf`](/api/native).

The refusals are the game's own rules, applied when the mod declares rather than when the pack loads: a
marker's tick must sit inside the declared cycle (the timeline codec's check), one marker belongs to one
timeline per clock (the registry validator's check, and a collision drops the whole timeline), a timeline
must name a clock, and a clock the pack declares no entry for is refused because the codec resolves the
reference at load and a broken reference leaves the timeline absent with nothing saying why. Declare the
clock before the timeline that drives it — collection is in order.

Tracks (a timeline's environment-attribute keyframes) have no declaration form: their value type is
per-attribute and version-facing, so write that JSON yourself.

### Dimensions

A dimension type and a dimension are datapack entries too, and 26.3 builds a level for **every** entry in its
`dimension` table when the server starts — so this is a whole dimension, not a registration a mod has to drive
itself:

```kotlin
registry.declareDimensionType("deep") {
    skyLight = false                      // part of the game's own open-sky test
    ceiling = true
    minY = 0
    height = 128
    logicalHeight = 128
    ambientLight = 0.1f
    skybox = "none"
    clock = "tide"                        // the dimension runs on the clock declared above
    timelines += "surge"
}
registry.declareDimension("deep_home") {
    type = "deep"                         // required; a bare id binds to this namespace
    layer("minecraft:bedrock", 1)         // the flat generator's floor, bottom-up
    biome = "minecraft:plains"
}
```

`server.levelById("my_mod:deep_home")` then answers with a live `ServerLevel`, whose
[`dimensionTypeId`, `dimensionType()` numbers and `clock`](/api/native) are what the declaration wrote. Those
fields are not cosmetic: the game's own `canHaveWeather()` is `hasSkyLight && !hasCeiling && dimension != theEnd`,
so a roofed, sunless type makes weather impossible there while the overworld, read through the same call, still
allows it.

`declareDimensionType`'s defaults are vanilla's own overworld values, because the game's codec marks eleven
fields required; the four the codec defaults on its own (`has_fixed_time`, `skybox`, `cardinal_light`,
`attributes`) are omitted from the file when the mod leaves them unset. `declareDimension` writes the three
generators the game can build without code: `flat` (a stack of layers), `noise` (a settings id with one fixed
biome) and `debug`.

The declaration-time refusals are the game's codec windows, since a file outside them leaves the type — and
every dimension naming it — absent from a registry with nothing in the log naming the pack: `min_y` in
-2032..2031, `height` in 16..4064, `logical_height` in 0..4064, `coordinate_scale` in 0.00001..30000000,
`ambient_light` in 0.0..1.0, light levels in 0..15, `infiniburn` a `#namespace:tag` reference, `skybox` one of
the game's three names, a flat layer a block id with a positive height, and a `type` or `clock` this pack has
not declared refused (declare them first: collection is in order).

### Tags

A tag is the game's own name for a group of registry entries, and the group is what behavior reads —
`#minecraft:is_fire` decides which damage a fire-immune mob shrugs off, `#minecraft:mineable/pickaxe` decides
what an ore drops. `declareTag` writes the file the game's tag loader reads,
`data/<tag namespace>/tags/<registry path>/<tag path>.json`:

```kotlin
registry.declareTag("minecraft:damage_type", "minecraft:is_fire") { element("melt") }
registry.declareTag("minecraft:damage_type", "melting_causes") {
    element("melt")
    tag("minecraft:is_drowning")                        // another group's members join this one
    element("minecraft:some_optional", required = false) // absent is fine, present is used
}
```

The tag's **namespace is where the file lands**, not who wrote it: naming `minecraft:is_fire` joins the vanilla
group, which is the ordinary case, and naming `melting_causes` bare opens a group in the declaring pack's own
namespace. Because the game reads one file per tag, every pack that names the same tag contributes to it — two
mods joining `#minecraft:is_fire` arrive in one file, in declaration order, deduplicated. A second declaration
that asks for the opposite `replace` is refused with both packs named: one file cannot both add to a group and
be its whole content, and OML does not pick by declaration order.

`replace = true` makes the file's members the group's entire content, which drops what the vanilla pack put
there. Measured on the real machine: a pack replacing `#minecraft:is_freezing` with one member leaves the game
holding exactly that member — which also says OML's injected pack ranks **above** the builtin resources for
tags.

Refused at declaration, because the game would otherwise store the file and simply never read it: a registry or
tag name that is not a datapack path (`worldgen/biome` is one name; `worldgen//biome` is not), a member id that
is not a datapack id, and a group with no members that is not replacing anything — a file that adds nothing has
nothing to say.

## Reading the registries back

The tables are the game's own — the same ones the declarations above are
materialized into, so a mod's content reads back exactly like a vanilla entry:

```kotlin
import org.ohmyloader.api26_3.*                        // the id-addressed reads

BuiltInRegistries.BLOCK.byId("my_mod:ruby_ore")          // the Block, or null
BuiltInRegistries.BLOCK.contains("my_mod:ruby_ore")      // does this id exist
BuiltInRegistries.BLOCK.ids()                            // every id in the table
BuiltInRegistries.BLOCK.membersOf(Registries.BLOCK, "minecraft:dirt")  // ids carrying this tag
BuiltInRegistries.BLOCK.tagsOf("minecraft:stone")        // tags this id belongs to
BuiltInRegistries.BLOCK.tagIds(Registries.BLOCK)         // every group this table holds
```

`tagIds` is the one read that separates an empty group from a group the game never loaded — a tag file in a
folder the loader does not scan leaves no tag at all, while an adopted group with no members is real. The other
two answers are the game's own: `membersOf` reads the holder set the reload built, `tagsOf` reads the tags the
holder carries.

Any of the game's tables can be read this way: `BuiltInRegistries.BLOCK`, `ITEM`, `MOB_EFFECT`,
`SOUND_EVENT`, `ENTITY_TYPE`, `ATTRIBUTE`, `GAME_RULE` and `PARTICLE_TYPE` are static, while damage types,
world clocks and timelines are datapack tables that need a running server — `server.registry(Registries.DAMAGE_TYPE)`,
[`clockById`](/api/native) and [`timelineIds`](/api/native) take their ids, as do
[`gameRuleValue` / `setGameRule`](/api/native).
An unregistered id answers `false` to `contains` and an empty list to `membersOf` / `tagsOf`, and
`byId` answers null rather than the table's default value: a typo is a quiet no, never air placed or
silence played.

::: warning Damage types, clocks and timelines need a running server
These three tables are not built into the game: they are loaded from datapacks, so reading them before a
server exists fails with a named error instead of returning an empty list — which would be a lie about the
damage types, clocks or timelines that exist.
:::

::: warning Read them after the game is up
The tables are filled by the game's own bootstrap, and a mod's initialization runs ahead of that —
reading during `onInitialize` fails the same way reading the game's registry early fails. Ask from an
event that has a running game behind it (a tick, a world load, a command).
:::

## The data track: TOML content packs

Content without code: a pack's declarations live in `content.toml` at the root of an **`.oml` archive**
(a plain zip renamed — see the distribution section below for the layout). The archive name is the
namespace, and the pack declares blocks, items and recipes:

```toml
[block.ruby_ore]
hardness = 3.0
blast_resistance = 6.0
drops_require_correct_tool = true

[item.ruby]
max_durability = 64
attack_damage = 2.0
# Tool rules are arrays of inline tables, one entry per block.
mines_and_drops = [{ block = "minecraft:stone", speed = 8.0 }]
override_speed = [{ block = "minecraft:dirt", speed = 4.0 }]

[crafting.ruby_block]
type = "shaped"
pattern = ["RR", "RR"]
key = { R = "ruby" }

[crafting.ruby_from_ore]
type = "shapeless"
count = 2
ingredients = ["ruby_ore", "minecraft:stick"]

[smelting.ruby]
input = "raw_ruby"
experience = 0.7
cooking_time = 100
# furnace = "blasting"   # smelting (default) / blasting / smoking

[loot.ruby_ore]
drop = "raw_ruby"
drop_count_min = 1
drop_count_max = 3

[damage_type.melt]
message_id = "ruby_pack.melts"
effects = "burning"
exhaustion = 0.3

[clock.tide]

[timeline.surge]
clock = "tide"
period_ticks = 24000
markers = { low_tide = 0, high_tide = { ticks = 12000, in_commands = true } }

[dimension_type.deep]
sky_light = false
ceiling = true
min_y = 0
height = 128
logical_height = 128
ambient_light = 0.1
skybox = "none"
clock = "tide"
timelines = ["surge"]

[dimension.deep_home]
type = "deep"
layers = [ { block = "minecraft:bedrock", height = 1 } ]
biome = "minecraft:plains"

[tag.fire_join]
registry = "minecraft:damage_type"
tag = "minecraft:is_fire"
values = ["melt", "#minecraft:is_projectile", { id = "minecraft:optional", required = false }]

[tag.my_group]
registry = "item"
tag = "ruby_tools"
values = ["ruby_sword"]
replace = true
```

The tag section is the one whose ids are **fields**: a TOML bare key cannot spell the `:` of
`minecraft:is_fire` or the `/` of `worldgen/biome`, both of which are ordinary tag names, so the section name
only labels the declaration while `registry` and `tag` say what the game reads. `values` entries are id strings,
optionally prefixed with `#` for a reference to another group, or inline tables carrying `id` and `required`.

The fields map one-to-one onto the code API (`hardness` → `hardness`, `blast_resistance` → `blastResistance`, …); `mines_and_drops`
and `override_speed` entries carry `block` and `speed`, `denies_drops` entries carry `block` alone.
A `[crafting.<result-id>]` section declares a crafting recipe whose result is that item: `type`
selects shaped / shapeless; shaped needs `pattern` (rows) plus a `key` inline table mapping
pattern characters to item ids; shapeless needs an `ingredients` list; `count` is optional (default 1). A
`[smelting.<result-id>]` section declares a furnace recipe (`input` required,
`furnace` selecting smelting / blasting / smoking, optional `experience` and `cooking_time`); a
`[loot.<block-id>]` section declares that breaking the block drops `drop` instead of itself. A
`[damage_type.<id>]` section declares a damage type (`message_id` required; `scaling`, `effects`,
`exhaustion` and `death_message_type` optional, with the same accepted names as the code API). A
`[clock.<id>]` section declares a world clock and takes no fields (a 26.3 clock is nothing but its id); a
`[timeline.<id>]` section declares a timeline (`clock` required, `period_ticks` optional, and `markers` an
inline table whose value is either a tick number or `{ ticks = …, in_commands = … }` — the two forms the
game's own codec takes). A `[dimension_type.<id>]` section takes the game's own field names in snake_case (`sky_light`,
`ceiling`, `dragon_fight`, `coordinate_scale`, `min_y`, `height`, `logical_height`, `infiniburn`,
`ambient_light`, `monster_spawn_light_level`, `monster_spawn_block_light_limit`, `fixed_time`, `skybox`, `clock`,
`timelines`), every one optional with vanilla's overworld as the default; a `[dimension.<id>]` section takes
`type` (required), `generator` (`flat`, `noise` or `debug`), `layers` (an array of
`{ block = …, height = … }` tables), `noise_settings`, `biome`, `features` and `lakes`. The
`ore` inline table on a block mirrors `generateAsOre` (`vein_size`, `per_chunk`, `min_y`, `max_y`,
`biomes`). Validation errors (ragged patterns, unknown types, missing fields) fail the pack
with the reason. TOML packs share
the same collect → freeze-materialize pipeline as code mods, and asset injection treats the pack's
namespace like a mod domain. A misspelled field is called out by name in the startup log — nothing
is silently ignored. What the data track does **not** cover: behavior hooks and block entities are
mod code and have no TOML form.

A loose `.toml` file dropped into `mods/` is **not** a pack form and is refused with an explicit
message: it cannot carry the pack's own textures, so its blocks would render with missing textures.
Ship the pack as an `.oml` archive.

## Distribution form: `.oml` archives

A content pack ships as a **`.oml` archive** (a plain zip renamed): `content.toml` at the root,
plus the pack's own `assets/` and `data/`:

```
MyPack.oml (zip)
├── content.toml
└── assets/
    └── my_pack/
        ├── textures/block/ruby_ore.png
        └── lang/en_us.json
```

Drop it into `mods/`. The archive name is the namespace; the archive's textures and lang files are
served through OML's injected resource pack.

## Hot reload

Recipes declared through the content tracks ride vanilla's datapack reload:

- **Textures / lang / models**: `F3+T` re-scans the mod jars and `.oml` archives — edited files are
  picked up on the spot.
- **Crafting / smelting recipes and loot**: edit the pack, then run `/reload` (or `F3+T`) — the
  loader re-reads the packs from disk and the datapack JSON is served fresh. Ore worldgen files
  reload the same way, but world generation itself only touches newly generated chunks.
- **Blocks / items themselves**: not reloadable. The registries freeze early in startup; adding or
  changing a block or item requires a restart. This is a vanilla constraint, not an OML limitation.
