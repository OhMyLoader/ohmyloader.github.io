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

## 界面

客户端 mod 用游戏自己的界面机制展示自己的 UI：声明一个 `Screen` 子类（游戏自己的类——控件、
布局与渲染都是 vanilla 的），然后打开它：

```kotlin
Events.CLIENT_TICK.register { // 在 mod 自己的触发点上调用一次
    OMLGame.client?.openScreen(MyConfigScreen())
}
```

| `Minecraft`（客户端）上 | 含义                                                                                |
|------------------------|-------------------------------------------------------------------------------------|
| `openScreen(screen)`   | 显示 mod 的界面——走游戏自己的打开路径，因此 `GUI_OPEN` 能观察到它、也可以取消它     |
| `closeScreen()`        | 关闭当前界面，世界重新接管屏幕                                                      |
| `currentScreen`        | 当前显示的界面；世界在屏幕上时为 null                                               |

打开是客户端自治的：服务器无权决定客户端给自己显示什么。**服务器驱动**的 UI——机器的操作界面、
箱子——走菜单而非界面：服务端的 `MENU_OPEN` / `MENU_CLOSED`，以及声明式容器自己的界面。给 mod
不拥有的界面加控件（改 vanilla 的界面）没有 API 面——那类需求用注入规则。

## 创造模式标签页

mod 物质化的每个物品都会自动进入共享的 `oml` 创造标签页（`itemGroup.oml.main`），在创造模式
物品栏中可见——无需任何额外 API。
