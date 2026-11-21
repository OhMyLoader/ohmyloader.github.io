---
layout: page
---

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { mountEditor } from './src/mount'
import './src/styles.css'
import 'uno.css'

// The editor is a Solid application mounted into this VitePress page (layout: page keeps the
// theme navbar and footer around the full-viewport app). The mount is client-side only —
// Solid owns the subtree, Vue never touches it; disposing on unmount keeps navigation clean.
const el = ref<HTMLElement | null>(null)
let dispose: (() => void) | undefined

onMounted(() => {
  dispose = mountEditor(el.value!)
})
onUnmounted(() => dispose?.())
</script>

<div ref="el" class="editor-mount" />
