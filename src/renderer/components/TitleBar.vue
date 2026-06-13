<template>
  <div class="title-bar">
    <!-- 左侧拖拽区域 -->
    <div class="title-bar-drag">
      <span class="title-bar-app">财神爷</span>
    </div>

    <!-- 右侧窗口控制按钮 -->
    <div class="title-bar-controls">
      <button class="ctrl-btn ctrl-btn--minimize" title="最小化" @click="handleMinimize">
        <svg viewBox="0 0 12 12" width="12" height="12">
          <rect x="1" y="5.5" width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button class="ctrl-btn ctrl-btn--maximize" :title="isMax ? '还原' : '最大化'" @click="handleMaximize">
        <svg v-if="isMax" viewBox="0 0 12 12" width="12" height="12">
          <rect x="2.5" y="0.5" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1" />
          <rect x="0.5" y="3.5" width="8" height="8" rx="1" fill="var(--bg-card)" stroke="currentColor" stroke-width="1" />
        </svg>
        <svg v-else viewBox="0 0 12 12" width="12" height="12">
          <rect x="1" y="1" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </button>
      <button class="ctrl-btn ctrl-btn--close" title="关闭" @click="handleClose">
        <svg viewBox="0 0 12 12" width="12" height="12">
          <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isMax = ref(false)

onMounted(async () => {
  // 查询当前最大化状态
  try {
    isMax.value = await window.electronAPI.isMaximized()
  } catch { /* ignore */ }

  // 监听最大化/还原事件
  window.electronAPI.onMaximizedChange((maximized: boolean) => {
    isMax.value = maximized
  })
})

onUnmounted(() => {
  window.electronAPI.removeMaximizedListener()
})

function handleMinimize() {
  window.electronAPI.minimizeWindow()
}
function handleMaximize() {
  window.electronAPI.maximizeWindow()
}
function handleClose() {
  window.electronAPI.closeWindow()
}
</script>

<style scoped>
.title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  flex-shrink: 0;
  /* 可拖拽区域 */
  -webkit-app-region: drag;
  user-select: none;
  background: var(--bg-body);
  border-bottom: 1px solid var(--border-subtle);
  padding-left: 12px;
}

.title-bar-drag {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
}

.title-bar-app {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.5px;
}

.title-bar-controls {
  display: flex;
  height: 100%;
  /* 按钮区域不可拖拽 */
  -webkit-app-region: no-drag;
}

.ctrl-btn {
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.ctrl-btn:hover {
  background: var(--bg-card-hover);
  color: var(--text-primary);
}

.ctrl-btn--minimize:hover {
  background: rgba(0, 0, 0, 0.05);
}

.ctrl-btn--close:hover {
  background: #E81123;
  color: #fff;
}

html.theme-dark .ctrl-btn--close:hover {
  background: #E81123;
  color: #fff;
}
html.theme-dark .ctrl-btn--minimize:hover {
  background: rgba(255, 255, 255, 0.08);
}
</style>
