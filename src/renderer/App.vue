<template>
  <n-config-provider :theme="currentTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-layout class="app-layout" has-sider>
        <n-layout-sider
          bordered
          show-trigger
          collapse-mode="width"
          :collapsed-width="64"
          :width="240"
          :native-scrollbar="false"
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
            <!-- <n-button text @click="collapsed = !collapsed">
              <template #icon>
                <ChevronLeft v-if="!collapsed" :size="18" />
                <ChevronRight v-else :size="18" />
              </template>
            </n-button> -->
            <n-button text @click="isDark = !isDark">
              <template #icon>
                <Sunny v-if="isDark" :size="18" />
                <Moon v-else :size="18" />
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
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, h, watchEffect, defineComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { darkTheme, NIcon } from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import {
  DashboardOutlined, AccountBookOutlined,
  WalletOutlined, StockOutlined, GiftOutlined,
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

function renderIcon(icon: any) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

const menuOptions: MenuOption[] = [
  { label: '仪表盘', key: '/', icon: renderIcon(DashboardOutlined) },
  { label: '账户管理', key: '/accounts', icon: renderIcon(WalletOutlined) },
  { label: '交易记账', key: '/transaction', icon: renderIcon(AccountBookOutlined) },
  { label: '投资分析', key: '/investment', icon: renderIcon(StockOutlined) },
  { label: '实物资产', key: '/physical-assets', icon: renderIcon(GiftOutlined) },
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
        primaryColor: '#4C9AFF',
        primaryColorHover: '#6CB0FF',
        bodyColor: '#0D1117',
        cardColor: 'rgba(255,255,255,0.03)',
        modalColor: '#161B22',
        popoverColor: '#161B22',
        borderColor: 'rgba(255,255,255,0.08)',
      },
      Layout: {
        siderColor: '#161B22',
        siderBorderColor: 'rgba(255,255,255,0.06)',
      },
      Menu: {
        itemTextColorInverted: '#8B949E',
        itemTextColorHoverInverted: '#E6EDF3',
        itemTextColorActiveInverted: '#4C9AFF',
        itemTextColorChildActiveInverted: '#4C9AFF',
        itemColorActiveInverted: 'rgba(76,154,255,0.10)',
        itemColorHoverInverted: 'rgba(255,255,255,0.04)',
        itemIconColorInverted: '#8B949E',
        itemIconColorHoverInverted: '#E6EDF3',
        itemIconColorActiveInverted: '#4C9AFF',
        arrowColorChildActiveInverted: '#4C9AFF',
      },
    }
  }
  return {
    common: {
      primaryColor: '#4C9AFF',
      primaryColorHover: '#3B8AE8',
      bodyColor: '#F0F2F5',
      cardColor: '#FFFFFF',
      modalColor: '#FFFFFF',
      popoverColor: '#FFFFFF',
      borderColor: '#D0D7DE',
    },
    Layout: {
      siderColor: '#FFFFFF',
      siderBorderColor: '#D0D7DE',
    },
    Menu: {
      itemTextColorInverted: '#57606A',
      itemTextColorHoverInverted: '#1F2328',
      itemTextColorActiveInverted: '#4C9AFF',
      itemTextColorChildActiveInverted: '#4C9AFF',
      itemColorActiveInverted: 'rgba(76,154,255,0.08)',
      itemColorHoverInverted: 'rgba(0,0,0,0.04)',
      itemIconColorInverted: '#57606A',
      itemIconColorHoverInverted: '#1F2328',
      itemIconColorActiveInverted: '#4C9AFF',
      arrowColorChildActiveInverted: '#4C9AFF',
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
  --bg-card: rgba(255, 255, 255, 0.78);
  --bg-card-hover: rgba(255, 255, 255, 0.95);
  --border-card: rgba(0, 0, 0, 0.06);
  --border-card-hover: rgba(0, 0, 0, 0.12);
  --border-subtle: rgba(0, 0, 0, 0.04);
  --text-primary: #1F2328;
  --text-secondary: #656D76;
  --text-muted: #8B949E;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.04);
  --shadow-card-hover: 0 6px 28px rgba(0,0,0,0.08);
  --scrollbar-thumb: rgba(0,0,0,0.12);
  --scrollbar-thumb-hover: rgba(0,0,0,0.20);
  --footer-text: #57606A;
}
html.theme-dark {
  --bg-body: #0D1117;
  --bg-card: rgba(255, 255, 255, 0.03);
  --bg-card-hover: rgba(255, 255, 255, 0.05);
  --border-card: rgba(255, 255, 255, 0.06);
  --border-card-hover: rgba(255, 255, 255, 0.12);
  --border-subtle: rgba(255, 255, 255, 0.04);
  --text-primary: #E6EDF3;
  --text-secondary: #8B949E;
  --text-muted: #6E7681;
  --shadow-card: none;
  --shadow-card-hover: 0 4px 32px rgba(0,0,0,0.3);
  --scrollbar-thumb: rgba(255,255,255,0.08);
  --scrollbar-thumb-hover: rgba(255,255,255,0.15);
  --footer-text: #8B949E;
}

html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--bg-body);
  font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
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
.n-layout-sider {
  display: flex !important;
  flex-direction: column !important;
}

/* Shared glass card */
.glass-card {
  background: var(--bg-card);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-card);
  border-radius: 16px;
  transition: border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
  box-shadow: var(--shadow-card);
}
.glass-card:hover {
  border-color: var(--border-card-hover);
  box-shadow: var(--shadow-card-hover);
  background: var(--bg-card-hover);
}
</style>

<style scoped>
.app-layout { height: 100vh; }

.sidebar-brand {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-bottom: 1px solid var(--border-card);
  padding: 0 16px;
  flex-shrink: 0;
}
.brand-icon {
  width: 34px; height: 34px;
  border-radius: 9px;
  background: linear-gradient(135deg, #4C9AFF, #6554C0);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 700; color: #fff;
  flex-shrink: 0;
}
.brand-text {
  font-size: 18px; font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap; letter-spacing: 1px;
}
.sidebar-spacer { flex: 1; }
.sidebar-footer {
  padding: 10px 12px;
  display: flex; justify-content: center; gap: 4px;
  border-top: 1px solid var(--border-card);
  color: var(--footer-text);
  flex-shrink: 0;
  margin-top: auto;
}

.main-content {
  background: var(--bg-body);
  overflow-y: auto;
}

.page-fade-enter-active, .page-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.page-fade-enter-from { opacity: 0; transform: translateY(8px); }
.page-fade-leave-to { opacity: 0; transform: translateY(-8px); }
.brand-fade-enter-active, .brand-fade-leave-active { transition: opacity 0.2s ease; }
.brand-fade-enter-from, .brand-fade-leave-to { opacity: 0; }
</style>
