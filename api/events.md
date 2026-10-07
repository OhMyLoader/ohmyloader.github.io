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

Events are registered as reflection-free lambdas on the `Events` object. The handler signature is
the event type; cancellable events are canceled by calling `cancel()` (`canceled` is a read-only
projection of it — reading it lets a later handler observe an earlier one's decision):

```kotlin
Events.CLIENT_TICK.register { /* every logical tick */ }
```

| Event              | Fired                                                                 | Cancellable | Fields                                                                     |
|--------------------|-----------------------------------------------------------------------|-------------|------------------------------------------------------------------------------|
| `CLIENT_TICK`      | every client logical tick                                             | –           | –                                                                          |
| `SERVER_TICK`      | every server logical tick (dedicated or integrated)                   | –           | –                                                                          |
| `SERVER_STARTED`   | once per server start, on its first tick                              | –           | `server: OMLServer`                                                        |
| `SERVER_STOPPING`  | once per shutdown, before the worlds are saved                        | –           | `server: OMLServer`                                                        |
| `PLAYER_JOINED`    | a player finished entering the world                                  | –           | `player: OMLPlayer`                                                        |
| `PLAYER_LEFT`      | a player is leaving                                                   | –           | `player: OMLPlayer`                                                        |
| `FRAME_RATE_LIMIT` | every frame's frame-rate calculation                                  | –           | `currentLimit: Int`, writable `limit: Int` (overrides the limit)           |
| `GUI_OPEN`         | before any GUI is shown                                               | ✅          | `screen: OMLScreen?` (null = the current GUI is being closed)              |
| `CHAT_SENT`        | the player sends a chat message                                       | ✅          | `message: String`                                                          |
| `CHAT_RECEIVED`    | a chat message is received (before display)                           | ✅          | `message: String`                                                          |
| `WORLD_LOAD`       | entering a world / disconnecting                                      | –           | `world: OMLWorld?` (null = disconnected)                                   |
| `HUD_RENDER`       | once per frame while a world is loaded                                | –           | `graphics: OMLGuiGraphics`                                                 |
| `BLOCK_BREAK`      | a player is about to destroy a block                                  | ✅          | `player`, `position: OMLBlockPos`, `blockId: String`                       |
| `ENTITY_ATTACK`    | a player's attack landed on an entity                                 | ✅          | `player`, `target: OMLEntity`                                              |
| `ENTITY_INTERACT`  | a player right-clicked an entity                                      | ✅          | `player`, `target: OMLEntity`, `hand: String` (`main_hand` / `off_hand`)   |
| `BLOCK_USED`       | a player right-clicked a block                                        | ✅          | `player`, `position: OMLBlockPos`, `blockId`, `itemId`, `hand`, `face`     |
| `ITEM_USED`        | a player used the held item on nothing                                | ✅          | `player`, `itemId`, `hand`                                                 |
| `LIVING_HURT`      | damage is about to be applied to a living entity                      | ✅          | `entity`, writable `amount: Float`, `damageType: String`, `attacker: OMLEntity?` |
| `LIVING_DIED`      | a living entity's death routine is starting                           | ✅          | `entity`, `damageType: String`                                             |

The projection types behind these fields are on the [World, Player & Entity
API](/api/world) page; the payload fields are the game's own objects, not copies.

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
  cancel wins over a rewrite.
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
