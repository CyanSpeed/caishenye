<template>
  <n-config-provider :theme="currentTheme" :theme-overrides="themeOverrides" :locale="zhCN" :date-locale="dateZhCN">
    <n-message-provider>
      <n-dialog-provider>
      <n-layout class="app-layout" has-sider>
        <n-layout-sider
          v-model:collapsed="collapsed"
          bordered
          show-trigger
          collapse-mode="width"
          :collapsed-width="64"
          :width="240"
          :native-scrollbar="false"
          class="sidebar-container"
        >
          <div class="sidebar-brand">
            <div class="brand-icon">财</div>
            <Transition name="brand-fade">
              <span v-show="!collapsed" :collapsed="collapsed" class="brand-text">财神爷</span>
            </Transition>
          </div>

          <n-menu
            inverted
            :value="currentRoute"
            :options="menuOptions"
            :collapsed="collapsed"
            :collapsed-width="64"
            :collapsed-icon-size="20"
            @update:value="handleMenuClick"
          />

          <div class="sidebar-spacer" />
          <div class="sidebar-footer">
            <n-button text @click="isDark = !isDark">
              <template #icon>
                <Sunny v-if="isDark" :size="18" />
                <Moon v-else :size="18" />
              </template>
            </n-button>
            <n-button text @click="router.push('/settings')">
              <template #icon>
                <Settings :size="18" />
              </template>
            </n-button>
          </div>
        </n-layout-sider>

        <n-layout-content class="main-content">
          <router-view v-slot="{ Component }">
            <Transition name="page-fade" mode="out-in">
              <component :is="Component" />
            </Transition>
          </router-view>
        </n-layout-content>
      </n-layout>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, h, watchEffect, defineComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { darkTheme, NIcon, zhCN, dateZhCN } from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import {
  DashboardOutlined, AccountBookOutlined,
  WalletOutlined, StockOutlined, GiftOutlined, FileTextOutlined,
} from '@vicons/antd'

const router = useRouter()
const route = useRoute()
const collapsed = ref(false)
const isDark = ref(false)

const currentRoute = computed(() => route.path)

// ---- Inline SVG icon components ----
function makeIcon(paths: () => any[]) {
  return defineComponent({
    props: { size: { type: Number, default: 18 } },
    setup(p: { size: number }) {
      return () => h('svg', {
        viewBox: '0 0 24 24', width: p.size, height: p.size,
        fill: 'none', stroke: 'currentColor', 'stroke-width': '2',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      }, paths())
    },
  })
}
const Sunny = makeIcon(() => [
  h('circle', { cx: '12', cy: '12', r: '5' }),
  h('line', { x1: '12', y1: '1', x2: '12', y2: '3' }),
  h('line', { x1: '12', y1: '21', x2: '12', y2: '23' }),
  h('line', { x1: '4.22', y1: '4.22', x2: '5.64', y2: '5.64' }),
  h('line', { x1: '18.36', y1: '18.36', x2: '19.78', y2: '19.78' }),
  h('line', { x1: '1', y1: '12', x2: '3', y2: '12' }),
  h('line', { x1: '21', y1: '12', x2: '23', y2: '12' }),
  h('line', { x1: '4.22', y1: '19.78', x2: '5.64', y2: '18.36' }),
  h('line', { x1: '18.36', y1: '5.64', x2: '19.78', y2: '4.22' }),
])
const Moon = makeIcon(() => [
  h('path', { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' }),
])
const ChevronLeft = makeIcon(() => [
  h('polyline', { points: '15 18 9 12 15 6' }),
])
const ChevronRight = makeIcon(() => [
  h('polyline', { points: '9 18 15 12 9 6' }),
])
const Settings = makeIcon(() => [
  h('circle', { cx: '12', cy: '12', r: '3' }),
  h('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' }),
])

function renderIcon(icon: any) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

const menuOptions: MenuOption[] = [
  { label: '仪表盘', key: '/', icon: renderIcon(DashboardOutlined) },
  { label: '账户管理', key: '/accounts', icon: renderIcon(WalletOutlined) },
  { label: '交易记账', key: '/transaction', icon: renderIcon(AccountBookOutlined) },
  { label: '投资分析', key: '/investment', icon: renderIcon(StockOutlined) },
  { label: '实物资产', key: '/physical-assets', icon: renderIcon(GiftOutlined) },
  { label: '财务报告', key: '/report', icon: renderIcon(FileTextOutlined) },
]

function handleMenuClick(key: string) {
  router.push(key)
}

// ---- Theme ----
const currentTheme = computed(() => isDark.value ? darkTheme : null)

const themeOverrides = computed(() => {
  if (isDark.value) {
    return {
      common: {
        primaryColor: '#60A5FA',
        primaryColorHover: '#93C5FD',
        bodyColor: '#0D1117',
        cardColor: 'rgba(255,255,255,0.05)',
        modalColor: '#161B22',
        popoverColor: '#161B22',
        borderColor: 'rgba(255,255,255,0.08)',
      },
      Layout: {
        siderColor: '#161B22',
        siderBorderColor: 'transparent',
      },
      Menu: {
        itemTextColorInverted: '#8B949E',
        itemTextColorHoverInverted: '#E6EDF3',
        itemTextColorActiveInverted: '#60A5FA',
        itemTextColorChildActiveInverted: '#60A5FA',
        itemColorActiveInverted: 'rgba(96,165,250,0.15)',
        itemColorHoverInverted: 'rgba(255,255,255,0.05)',
        itemIconColorInverted: '#8B949E',
        itemIconColorHoverInverted: '#E6EDF3',
        itemIconColorActiveInverted: '#60A5FA',
        arrowColorChildActiveInverted: '#60A5FA',
        borderRadius: '12px',
      },
    }
  }
  return {
    common: {
      primaryColor: '#60A5FA',
      primaryColorHover: '#3B82F6',
      bodyColor: '#F0F2F5',
      cardColor: '#FFFFFF',
      modalColor: '#FFFFFF',
      popoverColor: '#FFFFFF',
      borderColor: 'transparent',
    },
    Layout: {
      siderColor: '#FFFFFF',
      siderBorderColor: 'transparent',
    },
    Menu: {
      itemTextColorInverted: '#6B7280',
      itemTextColorHoverInverted: '#1F2937',
      itemTextColorActiveInverted: '#3B82F6',
      itemTextColorChildActiveInverted: '#3B82F6',
      itemColorActiveInverted: 'rgba(59,130,246,0.1)',
      itemColorHoverInverted: 'rgba(0,0,0,0.04)',
      itemIconColorInverted: '#6B7280',
      itemIconColorHoverInverted: '#1F2937',
      itemIconColorActiveInverted: '#3B82F6',
      arrowColorChildActiveInverted: '#3B82F6',
      borderRadius: '12px',
    },
  }
})

watchEffect(() => {
  document.documentElement.classList.toggle('theme-dark', isDark.value)
  document.documentElement.classList.toggle('theme-light', !isDark.value)
})
</script>

<style>
/* ===== CSS Variables ===== */
html {
  --bg-body: #F0F2F5;
  --bg-card: #FFFFFF;
  --bg-card-hover: #FFFFFF;
  --border-card: transparent;
  --border-card-hover: transparent;
  --border-subtle: rgba(0, 0, 0, 0.04);
  --text-primary: #1F2937;
  --text-secondary: #6B7280;
  --text-muted: #9CA3AF;
  --shadow-card: 0 4px 20px rgba(0, 0, 0, 0.03);
  --shadow-card-hover: 0 8px 30px rgba(0, 0, 0, 0.06);
  --scrollbar-thumb: rgba(0,0,0,0.12);
  --scrollbar-thumb-hover: rgba(0,0,0,0.20);
  --footer-text: #6B7280;
  --accent-green: #10B981;
  --accent-red: #F87171;
  --accent-blue: #60A5FA;
  --accent-purple: #A78BFA;
  --accent-yellow: #FBBF24;

  /* 默认：绿涨红跌（国际惯例） */
  --color-profit: #10B981;
  --color-loss: #EF4444;
  --color-profit-rgb: 16, 185, 129;
  --color-loss-rgb: 239, 68, 68;
  --color-profit-bg: #F0FDF4;
  --color-loss-bg: #FEF2F2;
}

/* 红涨绿跌（中国惯例）：红=盈利，绿=亏损 */
html[data-color-mode="cn"] {
  --color-profit: #EF4444;
  --color-loss: #10B981;
  --color-profit-rgb: 239, 68, 68;
  --color-loss-rgb: 16, 185, 129;
  --color-profit-bg: #FEF2F2;
  --color-loss-bg: #F0FDF4;
  --accent-green: #EF4444;
  --accent-red: #10B981;
}

/* 绿涨红跌（国际惯例）：绿=盈利，红=亏损 */
html[data-color-mode="west"] {
  --color-profit: #10B981;
  --color-loss: #EF4444;
  --color-profit-rgb: 16, 185, 129;
  --color-loss-rgb: 239, 68, 68;
  --color-profit-bg: #F0FDF4;
  --color-loss-bg: #FEF2F2;
  --accent-green: #10B981;
  --accent-red: #F87171;
}

/* 语义化颜色类 */
.text-profit { color: var(--color-profit) !important; }
.text-loss { color: var(--color-loss) !important; }
html.theme-dark {
  --bg-body: #0D1117;
  --bg-card: rgba(255, 255, 255, 0.05);
  --bg-card-hover: rgba(255, 255, 255, 0.08);
  --border-card: transparent;
  --border-card-hover: transparent;
  --border-subtle: rgba(255, 255, 255, 0.06);
  --text-primary: #E6EDF3;
  --text-secondary: #8B949E;
  --text-muted: #6E7681;
  --shadow-card: 0 4px 20px rgba(0, 0, 0, 0.2);
  --shadow-card-hover: 0 8px 30px rgba(0, 0, 0, 0.3);
  --scrollbar-thumb: rgba(255,255,255,0.08);
  --scrollbar-thumb-hover: rgba(255,255,255,0.15);
  --footer-text: #8B949E;
  --accent-green: #34D399;
  --accent-red: #F87171;
  --accent-blue: #60A5FA;
  --accent-purple: #A78BFA;
  --accent-yellow: #FBBF24;
}

html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--bg-body);
  font-family: 'Inter', -apple-system, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
  font-size: 15px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: background-color 0.3s ease, color 0.3s ease;
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }

/* Naive UI sider flex column — ensures footer sticks to bottom */
.app-layout {
  height: 100vh !important;
}

.app-layout .n-layout-sider {
  height: 100vh !important;
}

.app-layout .n-layout-sider .n-scrollbar,
.app-layout .n-layout-sider .n-scrollbar-container,
.app-layout .n-layout-sider .n-scrollbar-content {
  height: 100% !important;
}

.app-layout .n-layout-sider .n-scrollbar-content {
  display: flex !important;
  flex-direction: column !important;
}

.sidebar-container {
  height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
}

/* Shared glass card */
.glass-card {
  background: var(--bg-card);
  border: none;
  border-radius: 20px;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-card);
}
.glass-card:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-2px);
}
</style>

<style scoped>
.app-layout { height: 100vh; }

.sidebar-brand {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border-bottom: 1px solid var(--border-subtle);
  padding: 0 20px;
  flex-shrink: 0;
}
.brand-icon {
  width: 38px; height: 38px;
  border-radius: 12px;
  background: linear-gradient(135deg, #60A5FA, #A78BFA);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 700; color: #fff;
  flex-shrink: 0;
}
.brand-text {
  font-size: 20px; font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap; letter-spacing: 1px;
}
.sidebar-spacer { flex: 1; }
.sidebar-footer {
  padding: 16px;
  display: flex; justify-content: center; gap: 8px;
  border-top: 1px solid var(--border-subtle);
  color: var(--footer-text);
  flex-shrink: 0;
  margin-top: auto;
}

.main-content {
  background: var(--bg-body);
  overflow-y: auto;
  padding: clamp(12px, 1.5vw, 24px);
  flex: 1;
  min-width: 0;
  height: 100vh;
}

.page-fade-enter-active, .page-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.page-fade-enter-from { opacity: 0; transform: translateY(8px); }
.page-fade-leave-to { opacity: 0; transform: translateY(-8px); }
.brand-fade-enter-active, .brand-fade-leave-active { transition: opacity 0.2s ease; }
.brand-fade-enter-from, .brand-fade-leave-to { opacity: 0; }
</style>
