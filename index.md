---
layout: home

hero:
  name: OhMyLoader
  text: A Minecraft mod loader for Java Edition 26.x
  tagline: Custom bytecode injection engine · unified mod API · declarative content · client and dedicated server
  actions:
    - theme: brand
      text: Download the Installer
      link: /guide/download
    - theme: alt
      text: Your First Mod
      link: /guide/first-mod
    - theme: alt
      text: Introduction
      link: /guide/introduction

features:
  - icon: ⚙️
    title: Injection engine
    details: A declarative injection DSL with Mixin class merging. Every rule is checked at startup.
  - icon: 🧩
    title: Unified mod API
    details: Lambda-based event registration, lifecycle entry points, and a content declaration DSL. Event payloads and extensions are the game's own `net.minecraft.*` types, with no wrapper layer; a few handles keep a `platform` escape hatch.
  - icon: 📝
    title: Declarative content
    details: Declare blocks, items, and recipes in Kotlin or a TOML content pack (an `.oml` archive). They are materialized into native content at the registry freeze point and use the game's own validation and data pack paths.
  - icon: 🖥️
    title: Both sides
    details: The client and dedicated server have separate hooks and init paths, selected with `oml.side`. One mod source base runs on both unchanged.
  - icon: 🚀
    title: Java 27
    details: The full stack runs on Java 27.
