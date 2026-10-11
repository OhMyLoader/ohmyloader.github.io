---
layout: home

hero:
  name: OhMyLoader
  text: A modern Minecraft mod loader
  tagline: Self-developed bytecode injection engine · unified Mod API · declarative content registration · client & dedicated server
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
    title: Self-developed injection engine
    details: A self-developed declarative injection DSL with Mixin class merging.
  - icon: 🧩
    title: Unified Mod API
    details: Program against high-level game semantics — functional event registration, lifecycle entry points, a content declaration DSL. Event payloads and extensions are the game's own `net.minecraft.*` types, no wrapper layer in between; a few handles keep a `platform` escape hatch.
  - icon: 📝
    title: Declarative content
    details: Declare blocks, items and recipes with a few lines of Kotlin or a TOML content pack (an `.oml` archive). They are materialized into native content at the registry freeze point and flow through vanilla's own validation and datapack paths.
  - icon: 🖥️
    title: Both sides
    details: The client and the dedicated server have separate hooks and init paths, selected with a single oml.side flag. One mod source base runs on both, unchanged.
  - icon: 🚀
    title: Java 27
    details: The whole stack runs on the latest Java runtime with a modern JIT and GC.
