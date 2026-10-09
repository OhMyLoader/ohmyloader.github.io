# Client APIs

## Key bindings

Implement `OMLKeyBindingProvider` on the `@Mod` class to declare bindings. OML calls
`declareKeyBindings` once after `onInitialize`:

```kotlin
@Mod(id = "my_mod", name = "My Mod", version = "1.0.0")
class MyMod : OMLModInitializer, OMLKeyBindingProvider {
    override fun declareKeyBindings(keyBindings: OMLKeyBindingRegistry) {
        keyBindings.register("zoom", "key.keyboard.k") {
            println("K pressed")
        }
    }
}
```

- The binding's game name is `key.<modId>.<id>` (`key.my_mod.zoom`) — the controls screen and
  keybinding export files refer to it by that name.
- Bindings appear under the shared `oml` category in the controls screen.
- `defaultKey` is an `InputConstants` key name (e.g. `"key.keyboard.k"`); an unresolvable name
  degrades to an unbound key instead of failing startup.
- Bindings are applied lazily on the first client tick, so registration may happen at any point
  during mod initialization.
- Client-only: `declareKeyBindings` is never invoked on a dedicated server.

## HUD rendering

`Events.HUD_RENDER` fires once per frame while a world is loaded, before the HUD is drawn:

```kotlin
Events.HUD_RENDER.register { event ->
    val graphics = event.graphics         // the game's own draw surface for this frame
}
```

| Event        | Fired                            | Cancellable | Fields                      |
|--------------|----------------------------------|-------------|-----------------------------|
| `HUD_RENDER` | every frame with a world loaded  | –           | `graphics: GuiGraphicsExtractor` |

On 26.3 `graphics` is the game's own `GuiGraphicsExtractor`, so every draw call the game has is available
to a mod. `drawText(text, x, y)` is the one convenience OML adds: it draws in the game's default font with
vanilla's colour codes honoured.

::: tip
The event means "the HUD pass begins", not "pixels will follow": the pass's internal early-returns
(loading screens, F1) sit inside it.
:::

## Creative tab

Every item a mod materializes is added automatically to the shared `oml` creative tab
(`itemGroup.oml.main`), visible in the creative screen — no API needed.
