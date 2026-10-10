# Mod Entry & Events

## Mod entry

`@Mod` marks the mod's entry class, which implements the [`OMLModInitializer`](https://github.com/OhMyLoader/OhMyLoader)
interface. After the
game finishes initializing, the loader instantiates the class and calls `onInitialize` with the
mod's own metadata:

```kotlin
@Mod(id = "my_mod", name = "My Mod", version = "1.0.0")
class MyMod : OMLModInitializer {
    override fun onInitialize(context: ModContext) {
        // context: id / name / version / config
    }
}
```

The `id` is all-lowercase and doubles as the mod's resource namespace (the default domain for
assets and content ids).

## Event registration

Events are registered as reflection-free lambdas on the `Events` object
(`org.ohmyloader.api26_3.event.Events`). The handler signature is the event type; cancellable events are
canceled by calling `cancel()` (`canceled` is read-only — reading it lets a later handler observe an
earlier one's decision). Payload fields are the game's own classes:

```kotlin
import org.ohmyloader.api26_3.event.Events

Events.CLIENT_TICK.register { /* every logical tick */ }
```

| Event              | Fired                                                                 | Cancellable | Fields                                                                     |
|--------------------|-----------------------------------------------------------------------|-------------|------------------------------------------------------------------------------|
| `CLIENT_TICK`      | every client logical tick                                             | –           | –                                                                          |
| `SERVER_TICK`      | every server logical tick (dedicated or integrated)                   | –           | –                                                                          |
| `LEVEL_TICK`       | one level starting one tick                                             | –           | `level: Level`                                                             |
| `CHUNK_STARTED_TICKING` | a chunk became a ticking chunk of a server level              | –           | `level: ServerLevel`, `chunk: LevelChunk`                                  |
| `CHUNK_UNLOADED`   | a chunk is leaving a server level, while still readable                  | –           | `level: ServerLevel`, `chunk: LevelChunk`                                  |
| `SERVER_STARTED`   | once per server start, on its first tick                              | –           | `server: MinecraftServer`                                                        |
| `SERVER_STOPPING`  | once per shutdown, before the worlds are saved                        | –           | `server: MinecraftServer`                                                        |
| `PLAYER_JOINED`    | a player finished entering the world                                  | –           | `player: ServerPlayer`                                                        |
| `PLAYER_LEFT`      | a player is leaving                                                   | –           | `player: ServerPlayer`                                                        |
| `PLAYER_RESPAWNED` | a player finished respawning                                          | –           | `player: ServerPlayer` (the instance made for this life)                      |
| `FRAME_RATE_LIMIT` | every frame's frame-rate calculation                                  | –           | `currentLimit: Int`, writable `limit: Int` (overrides the limit)           |
| `GUI_OPEN`         | before any GUI is shown                                               | ✅          | `screen: Screen?` (null = the current GUI is being closed)                 |
| `CHAT_SENT`        | the player sends a chat message                                       | ✅          | `message: String`                                                          |
| `CHAT_RECEIVED`    | a chat message is received (before display)                           | ✅          | `message: String`, `packet: Packet<ClientGamePacketListener>`              |
| `WORLD_LOAD`       | entering a world / disconnecting                                      | –           | `world: ClientLevel?` (null = disconnected)                                |
| `HUD_RENDER`       | once per frame while a world is loaded                                | –           | `graphics: GuiGraphicsExtractor`                                           |
| `BLOCK_BREAK`      | a player is about to destroy a block                                  | ✅          | `player`, `position: BlockPos`, `state: BlockState`                        |
| `ENTITY_ATTACK`    | a player's attack landed on an entity                                 | ✅          | `player`, `target: Entity`                                                 |
| `ENTITY_INTERACT`  | a player right-clicked an entity                                      | ✅          | `player`, `target: Entity`, `hand: InteractionHand`                        |
| `BLOCK_USED`       | a player right-clicked a block                                        | ✅          | `player`, `hit: BlockHitResult`, `state`, `stack: ItemStack`, `hand`       |
| `ITEM_USED`        | a player used the held item on nothing                                | ✅          | `player`, `stack: ItemStack`, `hand: InteractionHand`                      |
| `LIVING_HURT`      | damage is about to be applied to a living entity                      | ✅          | `entity: LivingEntity`, writable `amount: Float`, `source: DamageSource`   |
| `LIVING_DIED`      | a living entity's death routine is starting                           | ✅          | `entity: LivingEntity`, `source: DamageSource`                             |

What else lives on those objects is on the [Game Objects and 26.3 Extensions](/api/native) page — the
payload fields are the objects the game was about to act on, not copies, so a handler can call the game's
own methods on them directly.

`PLAYER_RESPAWNED` is the one lifecycle event that hands over a **new** object: the game builds a fresh
player for the life that starts and discards the one it replaced, so a handle kept from before the respawn
reads as removed and has to be swapped for the one the event carries.

`LEVEL_TICK` is scoped per dimension rather than per side: a server dispatches it once for each loaded level
per server tick, and a client for the level it renders. In singleplayer that means both — the integrated
level and the rendered one, two objects for the same dimension, told apart by the game's own
[`Level.isClientSide`](/api/native).

The chunk pair is a server-level observation, not a decision: the game has already promoted the chunk by the
time `CHUNK_STARTED_TICKING` arrives, and `CHUNK_UNLOADED` is dispatched while the chunk is still readable but
cannot be kept. Both carry the `LevelChunk` itself, position included, so a mod sweeping its own per-chunk
state does not have to look anything up again. Nothing loads a chunk on its own — a dimension only generates
around players unless something holds a ticket, which is what
[`forceLoadChunk`](/api/native) is for.

### Examples

Capping the frame rate:

```kotlin
Events.FRAME_RATE_LIMIT.register { event ->
    if (event.limit > 120) event.limit = 120
}
```

Filtering chat:

```kotlin
Events.CHAT_RECEIVED.register { event ->
    if (event.message.contains("bad_word")) {
        event.cancel()
    }
}
```

Watching world joins and disconnects:

```kotlin
Events.WORLD_LOAD.register { event ->
    if (event.world == null) {
        println("left the world")
    }
}
```

Gating who may break a block:

```kotlin
Events.BLOCK_BREAK.register { event ->
    if (event.position == spawnPedestal) {
        event.cancel()
        event.player.sendSystemMessage("That one stays.")
    }
}
```

Halving incoming damage for an effect, which is a rewrite rather than a cancel:

```kotlin
Events.LIVING_HURT.register { event ->
    if (event.entity.hasEffect("minecraft:resistance")) event.amount /= 2f
}
```

### What cancelling does
- `BLOCK_BREAK` — the break is refused and the game resyncs its own prediction, so the block visibly
  snaps back. The mod sends nothing.
- `ENTITY_ATTACK` — the whole swing is skipped: damage, knockback, crit, sound and animation.
- `ENTITY_INTERACT` — vanilla proceeds as though the entity were not there, so the click falls through
  to the block behind it.
- `BLOCK_USED` — the click answers `FAIL`, the game's own "this click did nothing": neither the block's
  use nor the held item's use runs, and the client's prediction is rolled back by the resync the game
  already schedules for a failed click.
- `ITEM_USED` — the same `FAIL` for the click that hit no block and no entity, so eating, drawing a bow
  or placing into open air never starts.
- `LIVING_HURT` — the damage is not applied at all. `amount` starts as what vanilla computed and is
  **writable**: the number a handler writes is the number the game applies, and the arithmetic that
  follows it in the same call (shield reduction, the game's own damage cooldown) runs on it too. A
  cancel wins over a rewrite. Damage a mod deals through `OMLLivingEntity.hurt` arrives here the same way
  an attack does, so it is subject to the same handlers.
- `LIVING_DIED` — the death routine stops and the entity stays at zero health until the next damage
  re-runs the check; that is the shape of the game's own totem path.
- `GUI_OPEN`, `CHAT_SENT`, `CHAT_RECEIVED` — the GUI does not open / the message is not sent / it is
  not displayed.

::: tip
The dedicated server has no client event sources: `CLIENT_TICK`, `GUI_OPEN`, `FRAME_RATE_LIMIT`,
`HUD_RENDER` and `WORLD_LOAD` only fire on the client, while `SERVER_TICK`, the lifecycle events
(`SERVER_STARTED` / `SERVER_STOPPING` / `PLAYER_JOINED` / `PLAYER_LEFT`) and the interaction events are
dispatched on the server thread — on a dedicated server, and on singleplayer's integrated server,
which runs inside the client process. A client connected to a remote server receives none of the
interaction events: the code they hook does not run in that process. A mod built for both sides still
needs no side checks of its own.
:::
