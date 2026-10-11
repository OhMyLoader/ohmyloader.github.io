---
layout: home

hero:
  name: OhMyLoader
  text: 现代 Minecraft 模组加载器
  tagline: 自研字节码注入引擎 · 统一 Mod API · 声明式内容注册 · 客户端与服务端双端支持
  actions:
    - theme: brand
      text: 下载安装器
      link: /zh/guide/download
    - theme: alt
      text: 写第一个 Mod
      link: /zh/guide/first-mod
    - theme: alt
      text: 项目介绍
      link: /zh/guide/introduction

features:
  - icon: ⚙️
    title: 自研注入引擎
    details: 自研声明式注入 DSL 与 Mixin 类合并。
  - icon: 🧩
    title: 统一 Mod API
    details: 面向高层游戏语义编程：函数式事件注册、生命周期入口、内容声明 DSL。事件载荷与扩展直接就是游戏自己的 `net.minecraft.*` 类型，没有包装层；个别句柄保留 `platform` 逃生舱。
  - icon: 📝
    title: 声明式内容
    details: 几行 Kotlin 或一个 TOML 内容包（`.oml` 归档）即可声明方块、物品与配方，在注册表冻结点材料化为原生内容，走 vanilla 自己的校验与数据包路径。
  - icon: 🖥️
    title: 双端支持
    details: 客户端与专用服务端各有独立的钩子与初始化路径，用一个 oml.side 开关选边。同一份 mod 源码不改动即可双端运行。
  - icon: 🚀
    title: Java 27
    details: 全线运行在最新 Java 运行时上，享受现代 JIT 与 GC。
