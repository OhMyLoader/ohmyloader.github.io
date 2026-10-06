import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'OhMyLoader',
  description: 'A modern Minecraft mod loader',
  cleanUrls: true,
  lastUpdated: true,
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/' },
          { text: 'Guide', link: '/guide/introduction' },
          { text: 'API', link: '/api/events' },
          { text: 'Download', link: '/guide/download' },
        ],
        sidebar: {
          '/guide/': [
            {
              text: 'Guide',
              items: [
                { text: 'Introduction', link: '/guide/introduction' },
                { text: 'Download & Install', link: '/guide/download' },
                { text: 'Your First Mod', link: '/guide/first-mod' },
              ],
            },
          ],
          '/api/': [
            {
              text: 'API Reference',
              items: [
                { text: 'Mod Entry & Events', link: '/api/events' },
                { text: 'World, Player & Entities', link: '/api/world' },
                { text: 'Tick Scheduler', link: '/api/scheduler' },
                { text: 'Content Registration', link: '/api/content' },
                { text: 'Slash Commands', link: '/api/command' },
                { text: 'Mod Config', link: '/api/config' },
                { text: 'Injection DSL & Mixin', link: '/api/injection' },
                { text: 'Custom Network Payloads', link: '/api/network' },
                { text: 'Client APIs', link: '/api/client' },
              ],
            },
          ],
        },
        outline: [2, 3],
        footer: {
          message: 'Released under the AGPL-3.0 license.',
          copyright: 'Copyright © 2026 OhMyLoader',
        },
      },
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      themeConfig: {
        nav: [
          { text: '首页', link: '/zh/' },
          { text: '指南', link: '/zh/guide/introduction' },
          { text: 'API', link: '/zh/api/events' },
          { text: '下载', link: '/zh/guide/download' },
        ],
        sidebar: {
          '/zh/guide/': [
            {
              text: '指南',
              items: [
                { text: '项目介绍', link: '/zh/guide/introduction' },
                { text: '下载与安装', link: '/zh/guide/download' },
                { text: '第一个 mod', link: '/zh/guide/first-mod' },
              ],
            },
          ],
          '/zh/api/': [
            {
              text: 'API 参考',
              items: [
                { text: 'mod 入口与事件系统', link: '/zh/api/events' },
                { text: '世界、玩家与实体 API', link: '/zh/api/world' },
                { text: '主线程调度器', link: '/zh/api/scheduler' },
                { text: '内容注册', link: '/zh/api/content' },
                { text: '斜杠命令', link: '/zh/api/command' },
                { text: 'mod 配置', link: '/zh/api/config' },
                { text: '注入 DSL 与 Mixin', link: '/zh/api/injection' },
                { text: '自定义网络载荷', link: '/zh/api/network' },
                { text: '客户端 API', link: '/zh/api/client' },
              ],
            },
          ],
        },
        outline: [2, 3],
        footer: {
          message: '基于 AGPL-3.0 许可证发布',
          copyright: 'Copyright © 2026 OhMyLoader',
        },
      },
    },
  },
  themeConfig: {
    socialLinks: [{ icon: 'github', link: 'https://github.com/OhMyLoader' }],
    search: {
      provider: 'local',
      options: {
        locales: {
          zh: {
            translations: {
              button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
              modal: {
                noResultsText: '没有找到结果',
                resetButtonTitle: '清除查询条件',
                footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
              },
            },
          },
        },
      },
    },
    editLink: {
      pattern: 'https://github.com/OhMyLoader/ohmyloader.github.io/edit/main/:path',
    },
  },
})
