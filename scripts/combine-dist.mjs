// Combines the editor's built artifact into the VitePress dist: the site serves at /, the
// editor at /editor/ (the editor's vite base). One Pages artifact, two applications.
import { cpSync, mkdirSync } from 'node:fs'

mkdirSync('.vitepress/dist/editor', { recursive: true })
cpSync('editor/dist', '.vitepress/dist/editor', { recursive: true })
console.log('combined: editor/dist -> .vitepress/dist/editor')
