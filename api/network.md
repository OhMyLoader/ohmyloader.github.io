# Custom Network Payloads

Mod traffic travels over Minecraft's custom-payload packets: 26.x assigns packet ids by
registration order, so a mod that added its own packet type would shift every id after it and
desync the vanilla client. Payloads are routed by **channel name** over two fixed packet ids, which
is why OML exposes channels rather than packet types.

A channel is declared once, on both sides, from the same code: the loader publishes every declared
channel in a client process and in a server process alike, so one mod jar works against an
integrated server (singleplayer) and a dedicated one without re-declaring.

## declareNetwork

Make the `@Mod` class implement `OMLNetworkProvider`; the loader calls it right after
`onInitialize`:

```kotlin
@Mod(id = "my_mod", name = "My Mod", version = "1.0.0")
class MyMod : OMLModInitializer, OMLNetworkProvider {

    override fun declareNetwork(network: OMLNetworkRegistry) {
        network.clientToServer(SYNC) { payload, context ->
            // this side receives it from a client — register this on the server side
        }
        network.serverToClient(SYNC) { payload, context ->
            // this side receives it from the server — register this on the client side
        }
    }
}
```

Each direction is the *receiving* direction of the side that registers it. A payload arriving in a
direction nobody declared is left to vanilla's own handling, and a channel is sendable only in the
direction it was declared for — sending the other way throws with the channel name in the message.

## Payload types and codecs

A channel is an id plus a codec over OML's own buffer. A bare id is published under the declaring
mod's id, so `sync` from `my_mod` becomes `my_mod:sync`:

```kotlin
data class Sync(val count: Int, val label: String)

val SYNC = OMLPayloadType(
    "sync",
    codec({ buffer, value ->
        buffer.writeInt(value.count)
        buffer.writeString(value.label)
    }, { buffer -> Sync(buffer.readInt(), buffer.readString()) }),
)
```

Channel names must match `<namespace>:<path>`, where the namespace allows lowercase letters,
digits, `.`, `-` and `_`, and the path additionally allows `/`. The name is validated when you
declare it, so an illegal channel is reported against the mod that declared it instead of crashing
game bootstrap. Two mods claiming the same channel in the same direction abort the declaration with a
message naming the first claimant; the other mods still load.

`OMLPacketBuffer` is the whole wire surface — no version-internal type appears in it:

| Write          | Read          | Framing                             |
|----------------|---------------|-------------------------------------|
| `writeBoolean` | `readBoolean` | 1 byte                              |
| `writeByte`    | `readByte`    | 1 byte                              |
| `writeInt`     | `readInt`     | variable-length (1–5 bytes)         |
| `writeLong`    | `readLong`    | variable-length (1–10 bytes)        |
| `writeFloat`   | `readFloat`   | 4 bytes                             |
| `writeDouble`  | `readDouble`  | 8 bytes                             |
| `writeString`  | `readString`  | length-prefixed UTF-8               |
| `writeUuid`    | `readUuid`    | 16 bytes                            |
| `writeBytes`   | `readBytes`   | length-prefixed, no argument needed |

`write` and `read` consume the same sequence positionally, so both sides must run the same codec —
which they do, since the declaration is shared. Keep codecs to pure field shuffling: they run on
the packet thread.

## Sending

```kotlin
OMLNetwork.sendToServer(SYNC, Sync(3, "hello"))        // client → server
OMLNetwork.sendToPlayer(SYNC, Sync(3, "hello"), "Steve") // one player
OMLNetwork.sendToAllPlayers(SYNC, Sync(3, "hello"))      // everyone online
```

Names are the players' scoreboard names. Sending to a name that is not online is reported as a
warning, not an exception — a player logging out mid-tick is a normal race. `sendToServer` needs a
client that is in a world; `sendToPlayer` and `sendToAllPlayers` reach whichever server this process
hosts (the dedicated one, or singleplayer's integrated server).

## The inbound context

Handlers receive an `OMLNetworkContext`:

| Member       | Meaning                                                               |
|--------------|-----------------------------------------------------------------------|
| `modId`      | the mod that declared the channel                                     |
| `senderName` | the remote end's name — `null` when the connection carries no player  |
| `platform`   | the raw version object behind the connection (the usual escape hatch) |

`senderName` is taken from the connection, never from the payload: a client decides what it sends,
not who it is. A server handler that needs to trust an identity reads this field.

## Threading and phase

::: warning Handlers run on the network thread
Both inbound handlers fire on the packet thread, not the server or client thread. Record state, or
answer with another payload; do not touch the level, the player list or a screen from here. Work that
belongs on the game thread goes to the [Tick Scheduler](/api/scheduler) — `OMLScheduler`'s queueing entry
points are safe from any thread.
:::

Channels are published into the game's **play-phase** payload registry. The configuration phase (login, capability
negotiation) uses a registry OML cannot extend, so a payload sent before the
play phase begins arrives on a channel the peer does not know. Send after the world is loaded.
