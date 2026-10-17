# 客户端 API

## 按键绑定

在 `@Mod` 类上实现 `OMLKeyBindingProvider` 即可声明按键。OML 会在 `onInitialize` 之后调用一次
`declareKeyBindings`：

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

- 按键的游戏名为 `key.<modId>.<id>`（如 `key.my_mod.zoom`）——按键设置界面与按键导出文件都以
  该名引用。
- 绑定出现在按键设置中共享的 `oml` 分类下。
- `defaultKey` 是 `InputConstants` 键名（如 `"key.keyboard.k"`）；无法解析的名字会退化为
  「未绑定」，不会让启动失败。
- 绑定在首个客户端 tick 懒应用，因此注册可以发生在 mod 初始化的任何时点。
- 仅客户端：专用服务器上永远不会调用 `declareKeyBindings`。

## HUD 渲染

`Events.HUD_RENDER` 在世界加载期间的每帧触发一次，先于 HUD 绘制：

```kotlin
Events.HUD_RENDER.register { event ->
    val graphics = event.graphics         // 游戏自己这一帧的绘制面
}
```

| 事件         | 触发时机             | 可取消 | 字段                             |
|--------------|----------------------|--------|----------------------------------|
| `HUD_RENDER` | 世界加载期间的每一帧 | –      | `graphics: GuiGraphicsExtractor` |

26.3 上 `graphics` 就是游戏自己的 `GuiGraphicsExtractor`，游戏有哪些绘制调用，mod 就有哪些。OML 只额外
提供 `drawText(text, x, y)`：用游戏默认字体绘制，并遵循 vanilla 的颜色代码。

::: tip
该事件的含义是「HUD 渲染流程开始」，而非「一定有像素被画出来」：流程内部的提前返回（加载
界面、F1）位于这次 HUD 流程内部、钩子之后。
:::

## 创造模式标签页

mod 物质化的每个物品都会自动进入共享的 `oml` 创造标签页（`itemGroup.oml.main`），在创造模式
物品栏中可见——无需任何额外 API。
