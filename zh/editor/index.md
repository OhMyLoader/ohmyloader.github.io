---
layout: page
title: 内容包编辑器
---

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { mountEditor } from '../../editor/src/mount'
import '../../editor/src/styles.css'
import 'uno.css'

// Locale twin of editor/index.md: the navbar language switcher needs a zh target for the
// editor page. Both locales mount the same Solid application — the editor's own header
// carries its internal EN/中文 switch, so the wrapper page stays identical.
const el = ref<HTMLElement | null>(null)
let dispose: (() => void) | undefined

onMounted(() => {
  dispose = mountEditor(el.value!)
})
onUnmounted(() => dispose?.())
</script>

<div ref="el" class="editor-mount" />
