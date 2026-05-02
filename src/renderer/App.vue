<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-layout class="app-layout">
        <n-layout-sider bordered collapse-mode="width" :collapsed-width="64" :width="200">
          <div class="logo">财神爷</div>
          <n-menu
            :value="currentRoute"
            :options="menuOptions"
            @update:value="handleMenuClick"
          />
        </n-layout-sider>
        <n-layout-content>
          <router-view />
        </n-layout-content>
      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NIcon } from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import { DashboardOutlined, WalletOutlined } from '@vicons/antd'

const router = useRouter()
const route = useRoute()

const currentRoute = computed(() => route.path)

const menuOptions: MenuOption[] = [
  {
    label: '仪表盘',
    key: '/',
    icon: () => h(NIcon, null, { default: () => h(DashboardOutlined) }),
  },
  {
    label: '账户管理',
    key: '/accounts',
    icon: () => h(NIcon, null, { default: () => h(WalletOutlined) }),
  },
]

function handleMenuClick(key: string) {
  router.push(key)
}

const themeOverrides = {
  common: {
    primaryColor: '#4C9AFF',
    primaryColorHover: '#6CB0FF',
  },
}
</script>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app-layout {
  height: 100vh;
}

.logo {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: var(--n-text-color);
  border-bottom: 1px solid var(--n-border-color);
}
</style>
