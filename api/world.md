# World, Player & Entity APIs

Game state is reached through typed projections: small interfaces that read the live game object on
every call, so a handle held across ticks cannot go stale. Every projection carries `platform` — the
underlying game object — as the escape hatch, so a mod is never capped by what OML types.

## Getting the running game

`OMLGame` answers for whichever side asks. Both members are nullable, and null is the normal answer
at a hook where the object does not exist yet:

```kotlin
val server = OMLGame.server   // dedicated server, or singleplayer's integrated server
val client = OMLGame.client   // null on a dedicated server
```

A singleplayer game runs its integrated server inside the client process, so one mod sees both
handles and needs no side check.

### `OMLServer`

| Member                        | Meaning                                                          |
|-------------------------------|------------------------------------------------------------------|
| `platform`                    | the underlying `MinecraftServer`                                  |
| `dimensionIds`                | registry ids of the loaded dimensions                             |
| `players`                     | players currently on the server                                   |
| `tickCount`                   | ticks this server has run — compare deltas, not absolutes         |
| `isDedicated`                 | false for a singleplayer game's integrated server                 |
| `playerByName(name)`          | the online player with that scoreboard name, or null              |
| `level(dimensionId)`          | the loaded level of that dimension, null when it is not loaded     |
| `broadcast(text)`             | shows `text` in every connected player's chat                     |
| `gameRule(ruleId)`            | that rule's value as the game spells it (`"true"`), null for an unregistered id |
| `setGameRule(ruleId, value)`  | writes it with the game's own serializer; false for an unknown id or a value that does not parse |
| `clock(clockId)`              | the loaded clock with that registry id, null when none is registered |

### `OMLClient`

| Member         | Meaning                                                        |
|----------------|----------------------------------------------------------------|
| `platform`     | the underlying `Minecraft`                                     |
| `player`       | the player this client controls, null at the main menu         |
| `world`        | the level being rendered, null outside a world                 |
| `currentScreen`| the screen on top of the game, null while the world is shown   |
| `guiWidth` / `guiHeight` | window size in GUI units, which is what HUD drawing addresses |

## Worlds

`OMLWorld` is either the client's rendered level or a server-side level — `isClient` says which, and
it follows from where the event handed it to you.

| Member                | Meaning                                                                   |
|-----------------------|---------------------------------------------------------------------------|
| `platform`            | the underlying `ClientLevel` / `ServerLevel`                              |
| `dimensionId`         | registry id of this dimension, e.g. `minecraft:overworld`                 |
| `isClient`            | true for the rendered level                                               |
| `blockAt(pos)`        | registry id of the block at `pos`                                         |
| `setBlock(pos, id)`   | places the block, returns false for an unknown id or an unloaded position |
| `isLoaded(pos)`       | whether the chunk holding `pos` is loaded                                 |
| `playSound(id, x, y, z, volume, pitch, category)` | plays a registered sound at a position for everyone who can hear it |
| `entities`            | the entities the level holds — a server's live list, a client's render list |
| `entitiesOfType(id)`  | the entities whose type id matches, e.g. `minecraft:cow`                 |
| `spawnEntity(id, x, y, z)` | puts a registered entity in a server world; null when it cannot       |
| `spawnLivingEntity(id, x, y, z)` | the same for a mob — the handle carries health and attributes      |
| `blockStateAt(pos)`   | the block **and its property values** at a loaded position, else null    |
| `setBlockState(pos, state)` | places a state, neighbour updates and client resync included         |
| `spawnParticles(id, x, y, z, count, offsetX, offsetY, offsetZ, speed)` | sends a simple particle out from a server world |
| `spawnItemParticles` / `spawnBlockParticles` / `spawnDustParticles` | the same for a particle that needs arguments |
| `isRaining` / `isThundering`  | whether this dimension's live weather reads as raining / thundering |
| `setWeather(raining, thundering, durationTicks)` | asks the server's weather record for that state |
| `clock`                       | the clock this dimension runs on, null where the dimension type names none |

::: warning Block writes need a server-side world
`setBlock` on the client's level changes a prediction the server overwrites on the next update, so it
takes effect only on a server world. Read from either side, write through `OMLGame.server`.
:::

::: warning An unloaded position has no meaning
`blockAt` never fails, but for a position outside the loaded chunks its answer is whatever the game's
own getter holds there — `minecraft:air` on one run, real terrain on another, depending on the side and
on what the chunk manager happens to have. `isLoaded` is the check that means something; read a
position only after it.
:::

## Block states

An id is only half the story: two chests facing different ways are both `minecraft:chest`.
`blockStateAt` answers the block together with its property values, addressed by the names the game
gives them — the names a blockstate JSON uses.

```kotlin
val state = world.blockStateAt(pos) ?: return      // null: the position is not loaded
val rotated = state.with("facing", "east")         // null: no such property, or an illegal value
world.setBlockState(pos, rotated)                  // neighbour updates and client resync included
world.blockStateAt(pos)?.value("facing")           // "east"
```

`with` answers null rather than an adjusted-but-wrong state, because whether a combination exists is the
game's own state table's decision — the same code `/setblock` runs through, so a value the property does
not allow is refused exactly as the command refuses it.

## Spawning, motion and particles

`spawnEntity` puts a registered entity into a **server** world through the game's own spawn path (the
reason `/summon` passes), so the despawn and event rules apply to it like to any other mob; it answers
null for an unregistered id or a client-side level. `spawnLivingEntity` is the same call for the types the
game makes living, and answers null for a projectile rather than handing one over as a healthless entity —
which is how a mod reaches health, attributes and fire without casting. `entities` and `entitiesOfType`
read the level's own list, so what you spawned comes back out of the query it entered.

```kotlin
val cow = world.spawnEntity("minecraft:cow", x, y, z)
cow?.velocity = OMLVec3(0.6, 0.0, 0.0)             // the game integrates this into the position
```

`spawnParticles` sends a particle out from a server world to every client in range. `count` of 0 means one
particle at the exact position — the game's own convention — and a larger count spreads that many through
the offset box; `speed` is the game's per-particle parameter, whose meaning belongs to the particle type.

A particle that needs arguments of its own cannot be addressed by a bare id, so `spawnParticles` refuses it
and three named calls build the options object for it: `spawnItemParticles` shows an item's texture
breaking, `spawnBlockParticles` the default state of a block, `spawnDustParticles` a `0xRRGGBB` colour at a
size. All four go through the game's own send path and answer false for an unregistered id or a client-side
level, where the game takes the particle from the server instead.

## Weather and game rules

Weather is **one record for the whole server**, and each dimension ramps a level of its own toward it.
`isRaining` / `isThundering` read that live level — the game moves it by 0.01 per tick and calls it raining
above 0.2, thundering above 0.9 — so a fresh write shows up twenty-odd ticks later for rain and after
roughly a hundred for thunder. Thunder is scaled by the rain level, so it cannot be set without rain:
`setWeather(raining = false, thundering = true)` is refused. Only a dimension with an open sky can have
weather at all — the game's own check excludes the End by name — so elsewhere neither flag ever reads true,
however the record is set.

```kotlin
OMLGame.server?.level("minecraft:overworld")?.setWeather(raining = true, durationTicks = 600)
world.isRaining                                     // false for ~20 ticks, then true — the ramp is the game's
```

`durationTicks` is how long the game holds the state before its own cycle takes over; 0 lets the game pick
a duration, the way `/weather` without one does. The write goes through the same entry the command calls,
so a clear timer that would otherwise veto the new state is cleared with it. A client-side level answers
false: it shows the weather the server tells it about, it does not own any.

Game rules are addressed by their registry id in the game's own spelling (`minecraft:keep_inventory`) and
read or written as the game spells the value (`"true"`, `"3"`) — `OMLRegistries.gameRules` lists the ids.

```kotlin
val server = OMLGame.server ?: return
server.gameRule("minecraft:keep_inventory")          // "false"
server.setGameRule("minecraft:keep_inventory", "true")
server.setGameRule("minecraft:keep_inventory", "3")  // false: a boolean rule will not parse that
```

Writing is the game's own `GameRules.set`, so the dimensions it keeps in sync are in sync on its terms;
`gameRule` answering null for an unregistered id is the only "does this rule exist" check there is.

## Clocks

26.3 has no day-time counter. Time lives in **clocks**, each one a tick counter with a rate, addressed by
registry id (`minecraft:overworld`, `minecraft:the_end`) and bound to a dimension by its dimension type —
the Nether names no clock, so `world.clock` is null there and there is no time to read or write. The day
and night a mod used to compute out of `dayTime % 24000` are now **markers** registered against a clock
(`minecraft:day`, `minecraft:noon`, `minecraft:night`, `minecraft:midnight` …), which is what
`/time set <marker>` moves the clock onto.

| `OMLClock`              | Meaning                                                            |
|-------------------------|---------------------------------------------------------------------|
| `platform`              | the underlying `ClockInstance`                                        |
| `clockId`               | registry id of this clock, e.g. `minecraft:overworld`                 |
| `totalTicks`            | ticks the clock has counted — writable, and the game's own record     |
| `partialTick`           | the fraction of a tick the game has accumulated but not yet counted   |
| `rate`                  | ticks added per game tick: 1.0 normally, 2.0 twice as fast            |
| `isPaused`              | whether the clock stands still                                        |
| `markerIds`             | the markers this clock offers                                         |
| `isAtMarker(id)`        | the game's own test for sitting on that marker                        |
| `moveToMarker(id)`      | jumps to the marker's next occurrence; false for a marker it lacks    |
| `setTotalTicks(ticks)`  | puts the clock at an absolute position                                |
| `addTicks(ticks)`       | moves it by a number of ticks, negative to wind back                  |
| `setPaused(paused)`     | stops or resumes it, leaving the position where it is                 |
| `setRate(rate)`         | sets the speed; false outside the game's own 0.00001..1000 window      |

```kotlin
val clock = OMLGame.server?.level("minecraft:overworld")?.clock ?: return
clock.totalTicks                                   // the game's own count, live on every read
clock.moveToMarker("minecraft:noon")               // the same move /time set minecraft:noon makes
clock.isAtMarker("minecraft:noon")                 // true — the game agrees it is there
clock.setPaused(true)                              // the clock stops; the position stays
```

Reads work on both sides: the server owns the record, and its clock reaches every client as soon as it
changes, so `OMLGame.client.world.clock` is the copy the game was told about rather than a value OML keeps.
Writes are the server's — a client-side clock answers false to every one of them and moves nothing, and so
does `setRate` with a number the game's own command would refuse, because the game's clock manager would
otherwise store anything.

::: warning A marker is a point, not a window
`isAtMarker` is the game's test, which is exact (or periodic, when the marker declares a period). It answers
true for one tick of each period, so it is not a replacement for the old `isDay()`: ask it right after a
`moveToMarker`, or compare `totalTicks` against the clock's own cycle.
:::

::: warning Clocks are loaded from datapacks
`OMLRegistries.worldClocks` and every clock handle need a running server, like damage types: the table is
built with the world, not with the binary. A clock id nothing registers reads null rather than throwing —
the game's own clock manager answers an unregistered clock with an exception, and OML resolves ids against
the live registry first so a typo cannot reach it.
:::

## Entities, players, inventories

`OMLEntity` is anything in a level; `OMLLivingEntity` adds health; `OMLPlayer` adds the player-only
surface. Each is a superset of the previous one:

| `OMLEntity`              | Meaning                                                     |
|--------------------------|-------------------------------------------------------------|
| `platform`               | the underlying game entity                                  |
| `typeId`                 | registry id of the entity type, e.g. `minecraft:cow`         |
| `name`                   | display name as the game renders it                          |
| `uuid`                   | persistent identity of this instance                         |
| `position` / `blockPosition` | world position, and the block it stands in             |
| `dimensionId` / `world`  | which dimension this entity is in                            |
| `removed`                | true once it left the level (last position still readable)   |
| `onFire`                 | whether it is burning                                        |
| `velocity`               | motion in blocks per tick, readable **and writable**          |
| `remove()`               | takes it out of the level; false when the game left it in     |

Writing `velocity` replaces the vector the game holds, and its friction and gravity then work on that
number. A **living** entity recomputes the vector from its own movement input every tick, so a write to a
mob is integrated on the tick it lands and replaced on the next; a projectile or an item keeps what was
written. `remove()` is for entities rather than players: removing a player entity detaches it from the
level while its connection keeps pointing at it.

| `OMLLivingEntity` | Meaning                                                              |
|-------------------|----------------------------------------------------------------------|
| `health`          | current health                                                        |
| `maxHealth`       | the health cap                                                        |
| `alive`           | still present and above zero health (a dying entity stays alive)      |
| `effects`         | the effects on it now, each with its remaining duration and amplifier |
| `hasEffect(id)`   | whether that effect is on it; false for an unregistered id            |
| `applyEffect(id, durationTicks, amplifier)` | applies it, false for an unregistered id    |
| `removeEffect(id)`| takes it off; false when the id is unknown or it was not on it        |
| `heal(amount)`    | restores health the way the game's own healing does                   |
| `attributeValue(id)` / `attributeBase(id)` | the game's computed value (base + modifiers) and the base alone, by attribute id (`minecraft:max_health`) |
| `setAttributeBase(id, value)` | writes the base; the game clamps it and applies its own consequence |
| `addAttributeModifier(attributeId, modifierId, amount, operation)` | a permanent modifier the game keeps until removed |
| `removeAttributeModifier(attributeId, modifierId)` | takes it off again; false when nothing was held under that id |
| `hurt(damageTypeId, amount, attacker?)` | deals damage through the game's own damage path |
| `fireTicks` / `setOnFire(ticks)` / `clearFire()` | the game's burning state, read and written |

`effects` reports the **remaining** duration in ticks and a zero-based amplifier, so `amplifier = 0` is
level I. Re-applying an effect that is already there follows the game's own merge rule rather than
replacing it.

### Attributes, dealt damage and fire

Health, speed and attack damage are the game's own attributes, addressed by registry id
(`minecraft:max_health`, `minecraft:attack_damage` — `OMLRegistries.attributes` lists them).
`attributeValue` is what the game computes including modifiers; `attributeBase` and `setAttributeBase`
are the number underneath, and the game clamps a write into the attribute's range and applies its own
consequence: raising the maximum-health base moves the health **cap** the entity reports, and does not
refill the health itself.

```kotlin
living.setAttributeBase("minecraft:max_health", 30.0)   // the game now caps health at 30
living.addAttributeModifier("minecraft:attack_damage", "my_mod:buff", 4.0, "add_value")
living.removeAttributeModifier("minecraft:attack_damage", "my_mod:buff")
```

A modifier is permanent in the game's own sense: it stays until removed, and adding one under an id the
attribute already holds replaces it. The three operations are the game's, named in lower case —
`add_value`, `add_multiplied_base`, `add_multiplied_total`.

`hurt(damageTypeId, amount, attacker)` deals damage through the game's damage path, and it arrives at the
same `LIVING_HURT` hook an attack does — so a handler can cancel it or rewrite the number, and there is no
way for a mod to bypass the rules it enforces. `setOnFire(ticks)` / `clearFire()` answer with the game's
own burning state, which is how a fire-immune mob reports back: asking it to light is a `false`, not a
silently ignored call.

| `OMLPlayer`                     | Meaning                                                       |
|---------------------------------|---------------------------------------------------------------|
| `inventory`                     | the player's main container                                   |
| `gameMode`                      | `survival` / `creative` / `adventure` / `spectator`, or null   |
| `mainHandItem` / `offhandItem`  | the held stacks                                               |
| `permissionLevel`               | vanilla's own level: 0 player, 1 moderator, 2 gamemaster, 3 admin, 4 owner |
| `sendSystemMessage(text)`       | shows `text` to this player only                              |
| `giveItem(itemId, count)`       | puts items in the inventory, false when not everything fit      |
| `teleport(x, y, z, dimensionId)`| moves them, and across dimensions when an id is given          |
| `playSound(id, volume, pitch)`  | plays a registered sound so **this** player hears it           |

`teleport` is server-authoritative: a client-side player is served through the integrated server's
counterpart of the same uuid, and false means there was no counterpart to move, the dimension id is
unknown, or the game refused the destination. `playSound` is per-listener — a packet to that one client
from a server-side player, a local sound on a client-side one — where `OMLWorld.playSound` reaches
everyone nearby and takes the sound category that decides which of the client's volume sliders applies.

`gameMode` is nullable because the game's own accessor is: a client-side player can be read before
the server has sent a game type.

### Stacks and slots

| `OMLItemStack` | Meaning                                                              |
|----------------|----------------------------------------------------------------------|
| `platform`     | the underlying game stack                                             |
| `id`           | registry id, e.g. `minecraft:iron_ingot` (empty stack reports empty)  |
| `count`        | stack size                                                            |
| `isEmpty`      | the game's own emptiness check                                        |
| `displayName`  | as the game shows it, including a custom name                         |
| `damageValue`  | durability — data values are components in the modern game            |

| `OMLInventory`             | Meaning                                                          |
|----------------------------|------------------------------------------------------------------|
| `size`                     | addressable main-inventory slots (36 for a vanilla player)        |
| `selectedSlot` / `selected`| hotbar index being held, and that stack                          |
| `itemAt(slot)`             | the stack, or null when the index is out of range                 |
| `set(slot, itemId, count)` | replaces a slot; false for an unknown id or out-of-range index    |
| `add(itemId, count)`       | spreads across slots like vanilla pickup; false on overflow       |
| `countOf(itemId)`          | total across the addressable slots                                |
| `remove(itemId, count)`    | takes up to `count` out and returns how many actually came out    |
| `selectHotbarSlot(slot)`   | points the hand at `slot` (0..8)                                  |

Indices follow the game's own container layout: 0..35 are the main inventory, and the armor and
offhand slots of the same object are not addressed here. `remove` matches stacks by item id only, so a
damaged or renamed stack still counts; asking for more than the container holds takes what is there.
Mutations have no locking of their own — run them on the thread that owns the player, which is what
[Tick Scheduler](/api/scheduler) is for.

## Positions

`OMLBlockPos` (integer, block units) and `OMLVec3` (world units) compare by value, so a position
recorded in one event matches the one handed to another — which is what lets a handler gate on
"the break I was waiting for".

## Which event hands you which projection

| Event                                        | Projections                                                      |
|----------------------------------------------|------------------------------------------------------------------|
| `SERVER_STARTED` / `SERVER_STOPPING`         | `server: OMLServer`                                              |
| `PLAYER_JOINED` / `PLAYER_LEFT`              | `player: OMLPlayer`                                              |
| `PLAYER_RESPAWNED`                           | `player: OMLPlayer` — a new instance, not the one it replaced    |
| `BLOCK_BREAK`                                | `player`, `position: OMLBlockPos`, `blockId`                     |
| `BLOCK_USED`                                 | `player`, `position`, `blockId`, `itemId`, `hand`, `face`        |
| `ITEM_USED`                                  | `player`, `itemId`, `hand`                                       |
| `ENTITY_ATTACK` / `ENTITY_INTERACT`          | `player`, `target: OMLEntity`                                    |
| `LIVING_HURT` / `LIVING_DIED`                | `entity: OMLLivingEntity`, `attacker: OMLEntity?` (`amount` on `LIVING_HURT` is writable) |
| `WORLD_LOAD`                                 | `world: OMLWorld?`                                               |

Cancellables stop the game's own action when `cancel()` is called; the fields are what the game was
about to act on, not a copy — see [Mod Entry & Events](/api/events) for each event's timing.
