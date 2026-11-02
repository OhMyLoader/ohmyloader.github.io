---
layout: home

hero:
  name: OhMyLoader
  text: 面向 Minecraft Java Edition 26.x 的模组加载器
  tagline: 自研字节码注入引擎 · 统一 mod API · 声明式内容 · 客户端与专用服务端
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
    title: 注入引擎
    details: 声明式注入 DSL 与 Mixin 类合并；每条规则在启动期校验。
  - icon: 🧩
    title: 统一 mod API
    details: 函数式事件注册、生命周期入口与内容声明 DSL。事件载荷与扩展直接使用游戏自己的 `net.minecraft.*` 类型，没有包装层；个别句柄保留 `platform` 逃生舱。
  - icon: 📝
    title: 声明式内容
    details: 用 Kotlin 或 TOML 内容包（`.oml` 归档）声明方块、物品与配方；在注册表冻结点材料化为原生内容，并走游戏自己的校验与数据包路径。
  - icon: 🖥️
    title: 双端支持
    details: 客户端与专用服务端有独立的钩子与初始化路径，用 `oml.side` 选边。同一份 mod 源码无需改动即可双端运行。
  - icon: 🚀
    title: Java 27
    details: 全线运行在 Java 27 上。
