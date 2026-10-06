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
| `broadcast(text)`             | shows `text` in every connected player's chat                     |

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

::: warning Block writes need a server-side world
`setBlock` on the client's level changes a prediction the server overwrites on the next update, so it
takes effect only on a server world. Read from either side, write through `OMLGame.server`.
:::

Unloaded positions are not an error: the game's own getter answers air for them, so `blockAt` reports
`minecraft:air` there instead of failing.

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

| `OMLLivingEntity` | Meaning                                                              |
|-------------------|----------------------------------------------------------------------|
| `health`          | current health                                                        |
| `maxHealth`       | the health cap                                                        |
| `alive`           | still present and above zero health (a dying entity stays alive)      |

| `OMLPlayer`                     | Meaning                                                       |
|---------------------------------|---------------------------------------------------------------|
| `inventory`                     | the player's main container                                   |
| `gameMode`                      | `survival` / `creative` / `adventure` / `spectator`, or null   |
| `mainHandItem` / `offhandItem`  | the held stacks                                               |
| `sendSystemMessage(text)`       | shows `text` to this player only                              |
| `giveItem(itemId, count)`       | puts items in the inventory, false when not everything fit      |

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
| `selectHotbarSlot(slot)`   | points the hand at `slot` (0..8)                                  |

Indices follow the game's own container layout: 0..35 are the main inventory, and the armor and
offhand slots of the same object are not addressed here. Mutations have no locking of their own — run
them on the thread that owns the player, which is what [Tick Scheduler](/api/scheduler) is for.

## Positions

`OMLBlockPos` (integer, block units) and `OMLVec3` (world units) compare by value, so a position
recorded in one event matches the one handed to another — which is what lets a handler gate on
"the break I was waiting for".

## Which event hands you which projection

| Event                                        | Projections                                                      |
|----------------------------------------------|------------------------------------------------------------------|
| `SERVER_STARTED` / `SERVER_STOPPING`         | `server: OMLServer`                                              |
| `PLAYER_JOINED` / `PLAYER_LEFT`              | `player: OMLPlayer`                                              |
| `BLOCK_BREAK`                                | `player`, `position: OMLBlockPos`, `blockId`                     |
| `ENTITY_ATTACK` / `ENTITY_INTERACT`          | `player`, `target: OMLEntity`                                    |
| `LIVING_HURT` / `LIVING_DIED`                | `entity: OMLLivingEntity`, `attacker: OMLEntity?`                |
| `WORLD_LOAD`                                 | `world: OMLWorld?`                                               |

Cancellables stop the game's own action when `cancel()` is called; the fields are what the game was
about to act on, not a copy — see [Mod Entry & Events](/api/events) for each event's timing.
