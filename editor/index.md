---
layout: false
---

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { render } from 'solid-js/web'
import App from './src/App'
import './src/styles.css'
import 'uno.css'

// The editor is a Solid application mounted into this VitePress page (layout: false renders
// the raw page: no theme chrome, full viewport). The mount is client-side only — Solid owns
// the subtree, Vue never touches it; disposing on unmount keeps navigation clean.
const el = ref<HTMLElement | null>(null)
let dispose: (() => void) | undefined

onMounted(() => {
  dispose = render(App, el.value!)
})
onUnmounted(() => dispose?.())
</script>

<div ref="el" class="editor-mount" />
