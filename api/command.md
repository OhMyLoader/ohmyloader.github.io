# Slash Commands

Mods declare command trees against a loader type — never against Brigadier or a version command
class. `declareCommands` runs once, right after `onInitialize`, and the tree it leaves behind is
plain data; the per-version adapter translates it into the game's dispatcher every time the game
builds one (server start and every datapack reload). That split is what keeps a mod's commands
working across rebuilds of the dispatcher: a mod that registered into the dispatcher itself would
lose its commands on the first reload.

## declareCommands

Make the `@Mod` class implement `OMLCommandProvider`:

```kotlin
@Mod(id = "my_mod", name = "My Mod", version = "1.0.0")
class MyMod : OMLModInitializer, OMLCommandProvider {

    override fun declareCommands(commands: OMLCommandRegistry) {
        commands.register("mycmd") {
            permissionLevel = 2
            executes { source ->
                source.reply("hello from my_mod, executed by ${source.name}")
            }
            argument("count", OMLArgumentType.INTEGER) { count ->
                executes { source -> source.reply("count=${source[count]}") }
                subcommand("loud") {
                    executes { source -> source.reply("COUNT=${source[count]}") }
                }
            }
        }
    }
}
```

`register` declares the root literal (`/mycmd`). `subcommand` adds a literal child, `argument` a
typed one; `executes` may sit on any node, including one that has children — `/mycmd`, `/mycmd 5`
and `/mycmd 5 loud` above are three separate handlers. `argument` also passes its handle
(`OMLArgument<T>`) to the configure callback — capture it and read the value with `source[handle]`,
typed at compile time.

## Declaration members

| Member                     | Meaning                                                                                                                                           |
|----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| `subcommand(name) { }`     | a literal child: `/root <name> …`                                                                                                                 |
| `argument(name, type) { arg -> }` | a typed child: `/root <name> <value> …`                                                                                                           |
| `executes { source -> }`   | runs when this node terminates the command; the handler answers by calling `source.reply` / `source.replyError` — a value it returns goes nowhere |
| `permissionLevel`          | minimum level for this node **and everything below it**                                                                                           |
| `permissionNode`           | a fine-grained node id the invoker's set must answer (`mymod:build`)                                                                              |

`permissionLevel` defaults to `0` (everyone). Nodes at `0` get no check attached at all, so an
unprotected subcommand under a protected parent stays protected by the parent.

`permissionNode` is the finer gate and the two combine: with both set, the game's operator check **and** the
node check have to pass. The node is addressed by id — the same `minecraft:chat/send_messages` style ids the
game's own nodes use — and is answered by the invoker's own `PermissionSet`, which is where
[`grantPermissionNode`](/api/native) writes. A node nothing grants keeps the command invisible and
undispatchable; granting it to one player puts it back for that player alone.

## Argument types

| `OMLArgumentType` | Game parser           | Values read back as |
|-------------------|-----------------------|---------------------|
| `WORD`            | single unquoted word  | `String`            |
| `STRING`          | quoted or single word | `String`            |
| `GREEDY_STRING`   | the rest of the line  | `String`            |
| `INTEGER`         | whole number          | `Int`               |
| `FLOAT`           | number with fraction  | `Double`            |
| `BOOLEAN`         | `true` / `false`      | `Boolean`           |

The handle fixes both the argument's identity and its value type, so a misspelled or wrong-typed read
is a compile error, not a runtime cast. Reading an argument that is not part of the executed path
throws `… is not part of the executed path` inside the handler — the command bridge catches it and
answers the invoker with a red `[my_mod] command failed: …` while logging the stack trace.

## The command source

Handlers receive one `OMLCommandSource` per invocation:

| Member                | Meaning                                                                  |
|-----------------------|--------------------------------------------------------------------------|
| `name`                | the invoker's display name — `Server` for the console                    |
| `hasPlayer`           | true only when a player ran it (console, function, command block: false) |
| `reply(message)`      | success channel: chat for a player, plain stdout for the console         |
| `replyError(message)` | failure channel: rendered red for a player                               |
| `source[arg]`         | the value of one declared argument, typed by its `OMLArgument<T>` handle |
| `platform`            | the raw version source object (`CommandSourceStack` on 26.x)             |

`platform` is the usual escape hatch: reach the player, the level or the permission state the game
itself uses when the surface above is not enough.

## Permission levels

`permissionLevel` maps onto the game's operator levels, not onto a number OML invents:

| Value | Meaning          |
|-------|------------------|
| `0`   | everyone         |
| `1`   | moderators       |
| `2`   | game masters     |
| `3`   | admins           |
| `4`+  | the server owner |

## When a declaration stops being a declaration

Translation happens at dispatcher-construction time, in two hook points (the client's and the
dedicated server's), and every rebuilt dispatcher is registered into exactly once. Two consequences
worth knowing:

- Editing a command tree means a restart. `declareCommands` ran once, at mod init, and the game
  keeps using what it was given — a datapack reload rebuilds the dispatcher from the same trees.
- A malformed declaration is contained. Brigadier rejects an empty name, an illegal character or a
  duplicate root literal; the bridge logs `registering /<name> from mod [<id>] failed` and skips
  that one command, so the other mods' commands still land. Two mods claiming the same root literal:
  the one declared first wins and the other loses with that log line — pick namespaced roots (`my_mod_cool` rather than
  `cool`) if you expect collisions.

## Not covered yet

No argument suggestions or tab completion beyond the game's own literal completion, no command
aliases, no client-side-only commands. The loader itself registers
`/oml mods` (loaded mods with versions, failed inits in red) and `/oml version` through this same
API, as a working reference beyond the sample mod's `/techmod_ping`.

::: warning Still settling
The command DSL is in the *provided, still settling* tier: during 0.x its shape may change, with
the changes recorded in the release notes.
:::
