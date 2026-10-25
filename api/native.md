# Game Objects and the 26.3 Extensions

Game objects reach a mod as the game's own classes: a handler reads a `ServerPlayer`, a `BlockPos`, a
`DamageSource`; the capabilities OML adds are extension functions and properties on those types, declared
in the artifact `org.ohmyloader:oml-api-26_3` under the package `org.ohmyloader.api26_3`.

```kotlin
import org.ohmyloader.api26_3.*          // the extensions and OMLGame / OMLRegistries
import org.ohmyloader.api26_3.event.Events
```

Nothing wraps a game object, so there is nothing to hold stale: a read goes to the object the game is
mutating, a write goes through the method the game itself uses, and every "did it happen" verdict below is
the game's own state read back rather than OML's bookkeeping.

::: warning A mod's classes must not live under `org.ohmyloader.`
That prefix is parent-first: a mod inside it is defined by the launcher layer, whose search path carries the
game jar but not the version's libraries, so its first `net.minecraft.*` reference dies with
`NoClassDefFoundError`. The loader refuses such a jar while it scans the mods directory, naming the packed
classes. Mods are loaded child-first, and that is what makes the `net.minecraft` classes a mod sees the same
classes the game runs.
:::

## The running game

`OMLGame` answers from whichever side asks; both members are null when the object does not exist yet, which
is the normal answer during mod initialization on the client.

```kotlin
val server: MinecraftServer? = OMLGame.server   // dedicated, or singleplayer's integrated server
val client: Minecraft? = OMLGame.client         // null on a dedicated server
```

Singleplayer runs its integrated server inside the client process, so one mod sees both and needs no side
check. The server handle is the loader's own record of the server that is running — it exists from the
server's construction, before its first tick, and stops being handed out when that server shuts down.

### On `MinecraftServer`

| Call                               | Meaning                                                                                                       |
|------------------------------------|---------------------------------------------------------------------------------------------------------------|
| `dimensionIds`                     | registry ids of the loaded dimensions                                                                         |
| `onlinePlayers`                    | the players on the server now (`playerList.players` is the same list)                                         |
| `playerByName(name)`               | the online player with that scoreboard name, or null                                                          |
| `levelById(dimensionId)`           | the loaded `ServerLevel` of that dimension, null when not loaded                                              |
| `broadcastMessage(text)`           | shows `text` in every connected player's chat                                                                 |
| `gameRuleValue(ruleId)`            | the rule's value as the game spells it (`"true"`), null for an unknown id                                     |
| `setGameRule(ruleId, value)`       | writes it through the game's own serializer; false for an unknown id or an unparsable value                   |
| `clockById(clockId)`               | the `Holder<WorldClock>` that id names, null when nothing registers it                                        |
| `registry(registryKey)`            | a datapack table (`Registries.DAMAGE_TYPE`, `Registries.WORLD_CLOCK`), null when the server has not loaded it |
| `damageTypeIds` / `clockIds`       | the ids in those two datapack tables                                                                          |
| `tickCount`, `isDedicatedServer()` | the game's own members                                                                                        |

### On `Minecraft`

| Call                              | Meaning                                                                      |
|-----------------------------------|------------------------------------------------------------------------------|
| `player`, `level`, `gui.screen()` | the game's own members: this client's player, rendered level, current screen |
| `currentScreen`                   | `gui.screen()` as a property, null while the world is on screen              |
| `scaledWidth` / `scaledHeight`    | window size in GUI units, which is what HUD drawing addresses                |

## Levels

Reads work on any `Level`; the calls that change the world are declared on `ServerLevel`, because that is
where the game keeps authority — a client's level holds a prediction the server overwrites.

| Call on `Level`                                     | Meaning                                                                                     |
|-----------------------------------------------------|---------------------------------------------------------------------------------------------|
| `dimensionId`                                       | registry id of this dimension, e.g. `minecraft:overworld`                                   |
| `isClientSide`                                      | the game's own member: true for the rendered level                                          |
| `blockIdAt(pos)`                                    | registry id of the block at `pos`                                                           |
| `blockStateAt(pos)`                                 | the `BlockState` there, null when the chunk is not loaded                                   |
| `setBlockAt(pos, blockId)`                          | places the block's default state; false for an unknown id                                   |
| `setBlockAt(pos, state)`                            | places a state with neighbour updates, and reports whether the position now holds it        |
| `destroyBlock(pos)`                                 | breaks the block with its drops, break effects and block-entity cleanup — the game's own player-break path |
| `dropItem(stack, x, y, z)`                          | drops a real item entity into the world; pickup, stacking and despawn are vanilla's         |
| `isLoaded(pos)`                                     | the game's own member: whether the chunk holding `pos` is loaded                            |
| `containerAt(pos)`                                  | the block entity's `Container`, null where the block holds no slots                         |
| `blockEntityAt(pos)`                                | the block entity itself, null for an unloaded position or a block with none                 |
| `blockDataAt(pos)`                                  | the persistent `OMLBlockData` of a declared block entity — the same store its ticker writes |
| `playSoundAt(id, x, y, z, volume, pitch, category)` | plays a registered sound for everyone who can hear it                                       |
| `clock`                                             | the `Holder<WorldClock>` this dimension runs on, null when its dimension type names none    |
| `clockInstance`                                     | that clock as the game counts it (`ClockInstance`), null when there is none                 |

| Call on `ServerLevel`                                                  | Meaning                                                                                                                          |
|------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| `entities()`                                                           | every entity the level holds, as a snapshot taken at the call                                                                    |
| `entitiesOfType(typeId)`                                               | those whose type id matches, e.g. `minecraft:cow`                                                                                |
| `spawnEntity(typeId, x, y, z)`                                         | puts a registered type in through the `/summon` spawn path; null when the id is not an entity type or the game refused to add it |
| `spawnLivingEntity(typeId, x, y, z)`                                   | the same for a type the game makes living; null for a projectile rather than a healthless stand-in                               |
| `spawnParticles(id, x, y, z, count, offsetX, offsetY, offsetZ, speed)` | sends a simple particle to every client in range                                                                                 |
| `spawnItemParticles` / `spawnBlockParticles` / `spawnDustParticles`    | the same for a particle that carries arguments                                                                                   |
| `setWeather(raining, thundering, durationTicks)`                       | asks the server's one weather record for that state                                                                              |
| `explode(power, x, y, z)`                                              | the game's own TNT explosion — block breaks, drops and damage all vanilla's (creeper ~3, TNT 4)                                  |

| Call on `ClientLevel`    | Meaning                                                                 |
|--------------------------|-------------------------------------------------------------------------|
| `renderedEntities()`     | the entities the client renders — its own view, which lags the server's |
| `entitiesOfType(typeId)` | the same filter applied to that render list                             |

::: warning An unloaded position has no meaning
`blockIdAt` never fails, but for a position outside the loaded chunks its answer is whatever the game's own
getter holds there — `minecraft:air` on one run, real terrain on another, depending on the side and on what
the chunk manager happens to have loaded. `isLoaded` is the check that means
something; read a position only after it. `blockStateAt` returns null there for exactly that reason.
:::

::: warning Server-only writes are refused by the types, not at runtime
A weather write, a particle send, a clock write and an entity spawn are all declared on `ServerLevel`
(clocks on `ServerClockManager`), because that is where the game keeps them. A client's `ClientLevel` has no
such call to decline — the compile fails instead of returning false. The verification gates therefore assert
these refusals nowhere: the earlier surface reported them at runtime, this one makes them unrepresentable.
:::

## Block states

An id is only half the story: two chests facing different ways are both `minecraft:chest`. A `BlockState` is
the game's own object, and its properties are addressed by the names a blockstate JSON uses.

```kotlin
val state = level.blockStateAt(pos) ?: return          // null: the position is not loaded
val rotated = state.withProperty("facing", "east")     // null: no such property, or an illegal value
level.setBlockAt(pos, rotated)                         // neighbour updates and client resync included
level.blockStateAt(pos)?.property("facing")            // "east"
state.blockId                                          // "minecraft:chest"
state.propertyValues                                   // every property with the value it carries
```

`withProperty` answers null rather than an adjusted-but-wrong state, because whether a combination exists is
the game's own state table's decision — it goes back through the same argument parser `/setblock` uses, so a
value the property does not allow is refused exactly as the command refuses it.

## Entities, living entities and players

The game's own hierarchy does the work: `Entity`, `LivingEntity`, `Player`, `ServerPlayer`. Registry ids
still address the game's data, so the extensions take an id where the game takes a holder.

| On `Entity`                  | Meaning                                                                                                                                                       |
|------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `typeId`                     | registry id of the entity type, e.g. `minecraft:cow`                                                                                                          |
| `dimensionId`                | registry id of the dimension it is in                                                                                                                         |
| `discard()` then `isRemoved` | the game's own removal, read back — not for players: removing one only detaches it from the world, and its connection keeps pointing at the detached instance |

| On `LivingEntity`                                                                        | Meaning                                                                                                                                                                                                                                     |
|------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `hasEffect(effectId)`                                                                    | false for an unregistered id                                                                                                                                                                                                                |
| `applyEffect(effectId, durationTicks, amplifier = 0)`                                    | applies it; re-applying follows the game's own merge rule                                                                                                                                                                                   |
| `removeEffect(effectId)`                                                                 | false when the id is unknown or it was not on it                                                                                                                                                                                            |
| `attributeValue(id)` / `attributeBase(id)`                                               | the game's computed value (base + modifiers) and the base alone, addressed by `minecraft:max_health`-style ids; null when this kind of entity carries no such attribute — `minecraft:attack_damage` belongs to attackers, so a cow has none |
| `setAttributeBase(id, value)`                                                            | the game clamps the write into the attribute's range and applies its own consequence; false when there is no such instance to write                                                                                                         |
| `addAttributeModifier(attributeId, modifierId, amount, operation)`                       | a permanent modifier the game keeps until removed; `operation` is `add_value` / `add_multiplied_base` / `add_multiplied_total`; false for an attribute this entity does not carry                                                           |
| `removeAttributeModifier(attributeId, modifierId)`                                       | false when nothing was held under that id                                                                                                                                                                                                   |
| `hurt(damageTypeId, amount, attacker = null)`                                            | deals damage through the game's own damage path; false for an unregistered damage type, an entity not in a server-side level, or when the game applied nothing                                                                              |
| `ignite(ticks)` / `extinguish()`                                                         | the game's burning state read back after the request — a fire-immune mob answers `false` rather than the request being silently ignored                                                                                                     |
| `health`, `maxHealth`, `activeEffects`, `isOnFire`, `remainingFireTicks`, `heal(amount)` | the game's own members                                                                                                                                                                                                                      |

`activeEffects` hands out the game's `MobEffectInstance` objects; `effectId` is the registry id of one, its
`duration` is the remaining ticks and its `amplifier` is zero-based, so 0 is level I.

`hurt(damageTypeId, amount, attacker)` arrives through the same hook a mob's attack does, so a `LIVING_HURT`
handler sees it, can cancel it and can rewrite the number — it is a gameplay action, not a way around the
rules the event enforces.

| On `Player` / `ServerPlayer`            | Meaning                                                                                                                                                                                                                                                                                                    |
|-----------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `openedMenuId`                          | the menu the game has them using (`minecraft:generic_9x3`), null at rest                                                                                                                                                                                                                                   |
| `closeMenu()` (server)                  | the game's own close, which also returns the carried stack to the inventory; false when nothing was open                                                                                                                                                                                                   |
| `gameModeName`                          | `survival` / `creative` / `adventure` / `spectator`, or null before the server has sent one                                                                                                                                                                                                                |
| `permissionLevel`                       | vanilla's own level: 0 player, 1 moderator, 2 gamemaster, 3 admin, 4 owner                                                                                                                                                                                                                                 |
| `sendSystemMessage(text)`               | shows `text` to this player only — through its server-side connection, so a multiplayer client's own local player is a no-op                                                                                                                                                                               |
| `giveItem(itemId, count)`               | false when not everything fit — what fit stays, as with a vanilla pickup                                                                                                                                                                                                                                   |
| `raycast(distance)`                     | what the crosshair is on: the game's own block clip over the eye position and view vector — `OMLRayHit` (block id + position), null when the ray reaches the distance against nothing                                                                                                                     |
| `giveXp(points)`                        | experience through the game's own point path (level-ups included); negative takes away, stopping at zero total                                                                                                                                                                                            |
| `xpLevel` / `xpProgress`                | the current level, and how far into it (0.0 to just under 1.0)                                                                                                                                                                                                                                             |
| `foodLevel` / `saturation`              | hunger on the game's own 0–20 scale, and the saturation that keeps it from draining                                                                                                                                                                                                                        |
| `setFoodLevel(n)` / `feed(food, saturation)` | writes the hunger bar (the game applies its starvation schedule from the next tick) or feeds both bars in one go                                                                                                                                                                                       |
| `allowFlight` / `isFlying` / `invulnerable` | the game's own ability flags, synced to the client on write; turning flight off lands the player                                                                                                                                                                                               |
| `grantRecipes(ids)` / `revokeRecipes(ids)`  | unlocks or locks full recipe ids in the player's recipe book; answers how many actually moved. `ServerPlayer` for revoke                                                                                                                                                                               |
| `teleport(x, y, z, dimensionId = null)` | server-authoritative; false when the dimension id is unknown, the game refused the destination, or the handle is one the game has replaced — a death or a respawn hands out a new instance and the old one reads removed, so a mod that keeps a player addresses the server's live counterpart by its uuid |
| `playSound(id, volume, pitch)`          | plays so **this** player hears it, which is the game's own per-listener split                                                                                                                                                                                                                              |

### Boss bars

`OMLBossBar(title)` is the game's own boss bar (`ServerBossEvent`) behind a mod-facing shape —
the rendering, positioning and per-player sync are vanilla's:

```kotlin
val bar = OMLBossBar("The Ancient Kit")
bar.addPlayer(player)      // appears on that client
bar.progress = 0.5f        // 0.0 – 1.0, writable mid-fight
bar.title = "The Ancient Kit (enraged)"
bar.removePlayer(player)   // or removeAllPlayers() at the fight's end
```

### Worn items

| Call                                               | Meaning                                                                                                                                               |
|----------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| `itemIn(slotName)`                                 | what the game holds in `chest` / `feet` / `offhand` …, null for a name it never uses                                                                  |
| `equip(slotName, stack)`                           | writes it through the game's own slot write and returns what the slot held before, which the game leaves for the caller to place                      |
| `equip(slotName, itemId, count = 1)`               | the same addressed by registry id                                                                                                                     |
| `unequip(slotName)`                                | takes the worn stack off and hands it back                                                                                                            |
| `equipmentSlotOf(name)` / `EquipmentSlot.slotName` | the name ↔ slot conversion the game's own data uses                                                                                                   |
| `Inventory.indexOf(slotName)`                      | the player-container index a worn stack sits at (36..39 armour, `Inventory.SLOT_OFFHAND` the offhand), null for a slot the container does not address |

Whether an item belongs in a slot is the game's decision — `isEquippableInSlot` reads the item's own
`Equippable` component — so a refusal returns null and leaves whatever was worn exactly where it was, and the
same item the inventory screen would refuse. Reading the worn stack out of the entity and out of the player's
container at `indexOf` gives the same storage twice, not a copy.

## Stacks, containers and slots

```kotlin
val chest = level.containerAt(pos) ?: return            // null: no storage here
chest.setSlot(0, "minecraft:stone", 5)                  // false if the slot refuses
chest.takeSlot(0, 3)?.count                             // 3 — the game's own removal
chest.countOf("minecraft:stone")                        // 2 left
chest.openedByPlayerNames                               // who the game counts as using it
```

| Call                                                          | Meaning                                                                                                                           |
|---------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `ItemStack.itemId`                                            | registry id; an empty stack reports empty rather than air                                                                         |
| `Container.setSlot(slot, itemId, count)`                      | writes the slot after asking the block's own rule; false when it refuses, when the id is unknown, or when the slot does not exist |
| `Container.takeSlot(slot, count)`                             | what the game's removal actually gave up; null for a slot that does not exist                                                     |
| `Container.countOf(itemId)` / `canPlace(slot, itemId, count)` | the storage's own arithmetic and rule, without writing                                                                            |
| `Inventory.add(itemId, count)`                                | spreads across slots like vanilla pickup; false on overflow                                                                       |
| `Inventory.remove(itemId, count)`                             | takes up to `count` out and returns how many came out; matched by item id, so components need not match                           |
| `Inventory.selectHotbarSlot(slot)`                            | points the hand at a slot the game itself calls a hotbar slot                                                                     |

Which slot accepts what is the **block's** decision, not OML's: `setSlot` calls the game's `canPlaceItem`
before writing, so a furnace's output slot and its fuel slot refuse exactly as they refuse a player, and a
write cannot paste over a rule the block enforces. The game's own `getItem(index)` is the way to read a slot —
it throws out of range, as it does for the game, and `containerSize` is the bound.

Mutations carry no locking of their own: run them on the thread that owns the player, which is what
[Tick Scheduler](/api/scheduler) is for.

::: warning A menu is not a block id
`openedMenuId` names the **menu** the game has that player using, and the two ids differ: a single chest opens
`minecraft:generic_9x3`, not `minecraft:chest`. Every player always holds the inventory menu, which is not an
open screen, so it reports null.
:::

::: warning openedByPlayerNames follows the menu, not the neighborhood
The viewer list is the game's own bookkeeping, and a chest gets it from the **menu constructor**, so it names
a player only while a menu exists. Standing next to an open chest is not being recorded as using it.
:::

## Weather and game rules

Weather is **one record for the whole server**, and each dimension ramps a level of its own toward it.
`isRaining` / `isThundering` are the game's own live reads — it moves the level by 0.01 per weather tick and
calls it raining above 0.2, thundering above 0.9 — so a fresh write shows up twenty-odd ticks later for rain
and after roughly a hundred for thunder. Thunder is scaled by the rain level, so
`setWeather(raining = false, thundering = true)` is refused. Only a dimension with an open sky has weather at
all — the game's own check excludes the End by name — so elsewhere neither flag ever reads true.

```kotlin
val overworld = OMLGame.server?.levelById("minecraft:overworld") ?: return
overworld.setWeather(raining = true, durationTicks = 600)
overworld.isRaining                             // false for ~20 ticks, then true — the ramp is the game's
```

`durationTicks` is how long the game holds the state before its own cycle takes over; 0 lets the game pick,
the way `/weather` without a duration does. The write goes through the same entry the command calls, so a
clear timer that would otherwise veto the new state is cleared with it.

Game rules are addressed by registry id in the game's own spelling and read or written as the game spells the
value; `BuiltInRegistries.GAME_RULE` lists the ids, and `OMLRegistries.gameRule(id)` resolves one. Writing is
the game's own `GameRules.set`, so the dimensions it keeps in sync are in sync on its terms — and a boolean
rule asked for `"3"` is refused, not guessed at.

```kotlin
val server = OMLGame.server ?: return
server.gameRuleValue("minecraft:keep_inventory")           // "false"
server.setGameRule("minecraft:keep_inventory", "true")
server.setGameRule("minecraft:keep_inventory", "3")        // false: the rule's serializer refuses it
```

## Clocks

Time in 26.3 lives in **clocks**: each one is a tick counter with a rate, addressed by registry id and bound
to a dimension by its dimension type — the Nether names no clock, so `level.clock` is null there and there is
no time to read or write. The named moments `/time set` refers to (`minecraft:day`, `minecraft:noon`, …) are **markers**
declared against a clock, and the unit that declares them is a **timeline**.

A clock is addressed by its `Holder<WorldClock>` and read through a `ClockInstance`:

| Call                              | Meaning                                                                             |
|-----------------------------------|-------------------------------------------------------------------------------------|
| `level.clock`                     | the dimension's clock holder, or null                                               |
| `server.clockById(clockId)`       | a holder by id, whether or not a dimension runs on it                               |
| `clockManager.instanceOf(holder)` | the game's `ClockInstance`: `totalTicks()`, `partialTick()`, `rate()`, `isPaused()` |
| `level.clockInstance`             | the same, resolved for that dimension's own clock                                   |

The write side is `ServerClockManager` (`level.clockManager()` on a `ServerLevel`), and each call reads the
verdict back:

| Call                                                           | Meaning                                                                                              |
|----------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| `applyTotalTicks(holder, ticks)`                               | puts the clock there, reports whether the game holds it                                              |
| `applyTicks(holder, delta)`                                    | moves it by a number of ticks, negative to wind back                                                 |
| `applyPaused(holder, paused)`                                  | stops or resumes it, leaving the position where it is                                                |
| `applyRate(holder, rate)`                                      | sets the speed; false outside the game's own 0.00001..1000 window                                    |
| `markersOf(holder)`                                            | the marker ids `/time set` offers for this clock — only the declarations that set `show_in_commands` |
| `atMarker(holder, markerId)` / `applyMarker(holder, markerId)` | the game's own test, and the move `/time set` makes                                                  |

Reads work on both sides: the server owns the record and pushes it to clients as soon as it changes, so
`OMLGame.client?.level?.clockInstance` is the copy the game was told about. Writes belong to the server, and
a rate outside the window is refused because the game's clock manager would otherwise store a number the
command would not create.

### Timelines and their markers

A **timeline** is the declaration unit for named moments: it names a clock, an optional cycle length, and the
markers on it. The table they land in is the game's own, so OML reads it back instead of keeping a copy:

| Call                                                                       | Meaning                                                                |
|----------------------------------------------------------------------------|------------------------------------------------------------------------|
| `server.timelineIds`                                                       | every timeline the loaded packs registered                             |
| `timelines.clockDrivenBy(timelineId)`                                      | the clock that timeline moves; null for an unregistered id             |
| `timelines.timeMarkersOf(timelineId)`                                      | marker id → tick of the cycle, **including markers `/time set` hides** |
| `timelines.markerIdsDriving(clockId)` / `server.markerIdsDriving(clockId)` | every marker declared against that clock, by any timeline              |

where `timelines` is `server.registry(Registries.TIMELINE)`. Declaring one is on the
[content track](/api/content): `declareClock` / `declareTimeline` become
`data/<ns>/world_clock/<id>.json` and `data/<ns>/timeline/<id>.json` in OML's injected pack, and the game's own
reload registers them. The server's clock manager runs an instance for **every registered clock**, so a mod's
own clock counts once per game tick and syncs to clients with no dimension running on it.

::: warning The instance table is built when the server starts
`ServerClockManager` is created and initialized with the server, and it walks the clock and timeline
registries once at that point. A clock a `/reload` adds therefore has no instance until the world restarts —
`instanceOf` answers null where the game itself would throw — and the same holds for a marker a `/reload`
declares. Declare clocks and timelines in the pack, and treat a restart as what makes them count.
:::

::: warning A marker is a point, not a window
`atMarker` is the game's test, which is exact (or periodic, when the marker declares a period). It answers
true for one tick of each period, so it is not a day/night test: ask it right after an
`applyMarker`, or compare `totalTicks()` against the clock's own cycle.
:::

::: warning Clocks are loaded from datapacks
Clock holders and the marker table need a running server, like damage types: the table is built with the
world, not with the binary. A clock id nothing registers reads null rather than throwing — the game's own
clock manager answers an unregistered clock with an exception, so ids are resolved against the live registry
first and a typo cannot reach it. The game's `advance_time` game rule freezes every clock without pausing any
of them; a pause reaches clients as a zero rate.
:::

## Dimensions

A level is addressed by the dimension id the game knows it under, and the type it runs on is a registry entry
like any other — so these reads answer whether the game took a mod's declaration, and what it is actually
obeying:

| Call                            | Meaning                                                                                                                                |
|---------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| `server.dimensionIds`           | the dimensions the server has levels for                                                                                               |
| `server.levelById(dimensionId)` | that level, null when the server has not built one                                                                                     |
| `server.dimensionTypeIds`       | every dimension type, vanilla's and the ones a content pack declared                                                                   |
| `server.dimensionTypeById(id)`  | the type itself, null for an unregistered id                                                                                           |
| `level.dimensionTypeId`         | the id of the type this level runs on                                                                                                  |
| `level.dimensionType()`         | the game's own record: `height()`, `minY()`, `logicalHeight()`, `hasSkyLight()`, `hasCeiling()`, `coordinateScale()`, `ambientLight()` |

A dimension a mod declared is a level like any other once the game has built it: [`clock`](#clocks) answers for
the type's `default_clock`, and [`setWeather`](#weather-and-game-rules), [
`spawnEntity`](#entities-living-entities-and-players)
and the block reads work there exactly as they do in the overworld.

Reaching it is one call, and it is the game's own transition — the one portals and `/teleport` run:

| Call                                           | Meaning                                                                                                                   |
|------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| `entity.teleportToLevel(dimensionId, x, y, z)` | moves the entity and answers with the instance the game holds **after** the move; null when the destination is not loaded |
| `player.teleportToLevel(dimensionId, x, y, z)` | the same for a player, who stays the same instance while the game moves the connection along with them                    |
| `level.blockEntityAt(pos)`                     | the `BlockEntity` a block owns — position, state and all — null when the position is not loaded or its block has none     |
| `server.blockDataAt(dimensionId, pos)`         | the persistent `OMLBlockData` of a declared block entity in that dimension, reached from outside its ticker               |

The game holds one block entity per position **per level**, so the same coordinates in two dimensions are two
machines with two stores: measured with the same declared block stood at one position in each of two mod
dimensions, one store holding `side = 1` and the other `side = 2`, and neither seeing the other's keys. The
address is also the live store rather than a copy — the press counts a cycle in `progress` every tick, so a
value that does not move would mean the address reached something the game never ticks.

A level only generates chunks around players, so a dimension nobody visits holds nothing. Forcing a chunk is the
game's own ticket, not an OML counter:

| Call                                 | Meaning                                                                                |
|--------------------------------------|----------------------------------------------------------------------------------------|
| `level.forceLoadChunk(pos)`          | the `/forceload add` call for `pos`'s chunk; true when the game's ticket table changed |
| `level.releaseForceLoadedChunk(pos)` | `/forceload remove`; false when nothing was held there                                 |
| `level.isForceLoaded(pos)`           | asked of the same ticket table the command writes                                      |
| `level.forceLoadedChunkPositions`    | every chunk the table holds, unpacked from the longs the game packs                    |

A forced chunk is generated, sent and **ticked** without any player nearby, and the two chunk events report the
transitions the game made: `CHUNK_STARTED_TICKING` when a chunk of one of the server's levels becomes live (`chunk.pos`
names it), `CHUNK_UNLOADED` while it is still readable on its way out.

::: warning a chunk is writable only once it ticks
`CHUNK_STARTED_TICKING` is the signal that the game has finished the chunk. Until then a position can answer
`isLoaded` and still refuse a write — measured on the real machine: writing into a chunk the game promoted on
that very tick reports false and holds the block a tick later, while the same write one tick after the event
reports true. Force-load, wait for the event, then write.
:::

::: warning the game's weather test reads the declared flags
`level.canHaveWeather()` is the game's own `hasSkyLight() && !hasCeiling() && dimension != minecraft:the_end`,
so a type declared with a roof or without skylight can be written a weather record and still never show rain.
That is the declaration taking effect, not a failed write.
:::

## Spawns and respawn anchors

26.3 holds two anchors, and both are the game's own `LevelData.RespawnData`: a global position plus the yaw and
pitch a player is set to on arrival.

| Call                                                                   | Meaning                                                                                                                          |
|------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| `player.respawnAnchor`                                                 | the anchor as the game holds it; null means the player returns to the world's spawn                                              |
| `player.setRespawnAnchor(dimensionId, position, yaw, pitch, announce)` | moves it and reads it back; false for a dimension the server does not know, a non-server player, or an anchor that does not hold |
| `player.clearRespawnAnchor()`                                          | drops it, and reports that nothing is left                                                                                       |
| `server.worldSpawn`                                                    | the record players with no anchor of their own return to                                                                         |
| `server.setWorldSpawn(dimensionId, position, yaw, pitch)`              | re-points that record; false when the dimension is unknown or the game will not respawn a player at `position`                   |

The dimension an anchor names may be one a content pack declared, so a respawn can land in a mod's own level.
`announce` is the game's own chat message — the one `/spawnpoint` sends. An explicitly chosen position is marked
**forced**, which is the game's term for using it as given instead of re-checking whether a bed or respawn
anchor still stands there.

::: warning one world spawn record for the whole server
`ServerLevel`'s read and write of `respawnData` both forward to `MinecraftServer`, which keeps the record on the
overworld's data, so asking any level answers with the same one record and there is no per-dimension world
spawn to set alongside it. The record does carry a dimension, and the game resolves that dimension through its
loaded levels — falling back to the overworld when no level matches — so `setWorldSpawn` refuses an id the
server's registry does not list rather than storing a spawn that silently becomes an overworld one.
:::

::: warning what reads back is where a respawn lands
The server hands out a border-adjusted record: a position outside that dimension's world border is kept as
asked but reported at the border's center. Measured on the real machine with a mod dimension whose border was
set to 50 — a spawn aimed at (200, 41, 200) read back at (0, y, 0) in the same dimension, and the helper
answered false.
:::

## Permission nodes

26.3 gates authority on **nodes**, not only on the 0..4 operator level: the game's own checks are
`Permission.Atom` ids (`minecraft:chat/send_messages`, `minecraft:commands/entity_selectors`) plus
`Permission.HasCommandLevel(level)`, and a `PermissionSet` is nothing but `hasPermission(node)`. OML addresses
the same objects by id and adds one thing the game does not offer: a per-player override.

| Call                                                            | Meaning                                                                    |
|-----------------------------------------------------------------|----------------------------------------------------------------------------|
| `permissionNode(id)`                                            | the game's atom node for an id, null for a string the game cannot parse    |
| `permissionNodeId(node)`                                        | the id an atom carries, null for a command level (a level is not an id)    |
| `permissionLevelOf(name)`                                       | one of the game's levels by its own name (`all`, `moderators`, …)          |
| `set.hasNode(id)` / `set.hasCommandLevel(name)`                 | the two answers a set gives; an unparseable id is simply false             |
| `player.hasPermissionNode(id)` / `source.hasPermissionNode(id)` | read through the set the game is using for that player                     |
| `player.grantPermissionNode(id)` / `revokePermissionNode(id)`   | force the answer for this player; reports whether an override was written  |
| `player.clearPermissionNodeGrant(id)`                           | drop the override, so the game's own composition is the whole answer again |
| `player.permissionNodeOverrides`                                | what OML currently forces for this player, id to forced answer             |

The hook sits on `ServerPlayer.permissions()` — the one funnel every consumer of a player's authority reads
through, chat gates and command gates included — so granting changes what **the game** answers, not what an OML
mirror says. With no overrides for a player the game's own set is returned unchanged: no wrapper, no allocation.
Overrides are keyed by player id, not by the entity instance, and the loader drops them when the player leaves.

::: warning overrides cover atoms only
A command level is carried as `Permission.HasCommandLevel`, which has no id to name — granting or revoking
never touches it, and `hasCommandLevel` keeps reading the game's operator levels. Use `permissionLevel` on a
command for that, and a node for everything finer.
:::

## Registries and tags

Registry ids are still the currency, and the tables are the game's own: `BuiltInRegistries` for the built-ins,
`server.registry(Registries.DAMAGE_TYPE)` for the datapack ones. `OMLRegistries` resolves an id to the object
the game registered, and answers null rather than a default value — a typo in a mod's id must not place air or
play silence.

```kotlin
OMLRegistries.block("minecraft:stone")            // Block?, null when unregistered
OMLRegistries.mobEffect("minecraft:poison")       // Holder<MobEffect>, the shape the game's methods take
OMLRegistries.damageType(level, "my_mod:melt")    // datapack table, so it needs a level
OMLRegistries.blockState("minecraft:chest", mapOf("facing" to "east"))  // the /setblock parser

BuiltInRegistries.BLOCK.ids()                     // every id in the table
BuiltInRegistries.BLOCK.contains("my_mod:ruby_ore")
BuiltInRegistries.BLOCK.membersOf(Registries.BLOCK, "minecraft:dirt")   // ids carrying a tag
BuiltInRegistries.BLOCK.tagsOf("minecraft:stone")                       // tags this id belongs to
BuiltInRegistries.BLOCK.tagIds(Registries.BLOCK)                        // every tag this table holds
tagKeyOf(Registries.BLOCK, "minecraft:dirt")      // the TagKey the game's own tag reads take
```

`tagIds` separates an empty tag from one the game never loaded; what a mod *contributes* to a tag is a
declaration, not a write here — see [`declareTag`](/api/content#tags).

An id with no namespace is not a failure: the game fills in `minecraft`, so `"stone"` and
`"minecraft:stone"` are the same lookup. Only characters the game rejects answer null.

Mod-registered content reads back exactly like a vanilla entry, from either side and from any thread — the
tables are the game's statics, filled by its own bootstrap. That is also why reading them during mod
initialization fails the way reading them early fails in the game itself: registry reads belong to a moment
that has a running game behind them.

## Which event hands you what

| Event                                | Payload                                                                                |
|--------------------------------------|----------------------------------------------------------------------------------------|
| `SERVER_STARTED` / `SERVER_STOPPING` | `server: MinecraftServer`                                                              |
| `PLAYER_JOINED` / `PLAYER_LEFT`      | `player: ServerPlayer`                                                                 |
| `PLAYER_RESPAWNED`                   | `player: ServerPlayer` — the instance made for this life                               |
| `LEVEL_TICK`                         | `level: Level` (`isClientSide` says which side ticks it)                               |
| `BLOCK_BREAK`                        | `player`, `position: BlockPos`, `state: BlockState`                                    |
| `BLOCK_USED`                         | `player`, `hit: BlockHitResult`, `state`, `stack: ItemStack`, `hand: InteractionHand`  |
| `ITEM_USED`                          | `player`, `stack`, `hand`                                                              |
| `ENTITY_ATTACK` / `ENTITY_INTERACT`  | `player`, `target: Entity`, `hand` (interact)                                          |
| `LIVING_HURT` / `LIVING_DIED`        | `entity: LivingEntity`, `source: DamageSource` (`amount` on `LIVING_HURT` is writable) |
| `WORLD_LOAD`                         | `world: ClientLevel?` (null = disconnected)                                            |
| `GUI_OPEN`                           | `screen: Screen?`                                                                      |
| `HUD_RENDER`                         | `graphics: GuiGraphicsExtractor` (`drawText` writes to it)                             |
| `CHAT_RECEIVED`                      | `message: String`, `packet: Packet<ClientGamePacketListener>`                          |

Cancellable events stop the game's own action when `cancel()` is called; the payload fields are the objects
the game was about to act on, not copies — see [Mod Entry & Events](/api/events) for each event's timing.
