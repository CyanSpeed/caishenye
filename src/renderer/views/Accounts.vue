<template>
  <div class="accounts-page">
    <div class="page-header">
      <h2 class="page-title">账户管理</h2>
      <div class="summary-pills">
        <div class="pill pill--asset">
          <span class="pill-label">总资产</span>
          <span class="pill-value">{{ currencyPlain(totalAssets) }}</span>
        </div>
        <div class="pill pill--liability">
          <span class="pill-label">总负债</span>
          <span class="pill-value">{{ currencyPlain(totalLiabilities) }}</span>
        </div>
        <div class="pill" :class="netWorth.isNegative() ? 'pill--liability' : 'pill--asset'">
          <span class="pill-label">净资产</span>
          <span class="pill-value">{{ currencyPlain(netWorth) }}</span>
        </div>
      </div>
    </div>

    <div class="tabs-row">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.emoji }} {{ tab.label }}
        <span class="tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <TransitionGroup name="card-grid" tag="div" class="account-grid">
      <div
        v-for="account in filteredAccounts"
        :key="account.id"
        class="glass-card account-card"
        :class="{ 'card--expanded': expandedId === account.id }"
        @click="expandedId = expandedId === account.id ? null : account.id"
      >
        <div class="card-top">
          <div class="account-icon" :class="'icon--' + account.type">
            <component :is="accountIcon(account.sub_type)" :size="20" />
          </div>
          <div class="account-info">
            <div class="account-name">{{ account.name }}</div>
            <div class="account-type">{{ subTypeLabel(account.sub_type) }}</div>
          </div>
          <div class="account-balance" :class="account.type === 'asset' ? 'text-green' : 'text-red'">
            {{ account.type === 'liability' ? '-' : '' }}{{ currencyPlain(account.balance) }}
          </div>
        </div>

        <Transition name="expand">
          <div v-if="expandedId === account.id" class="card-detail">
            <div class="detail-row">
              <span class="detail-label">类型</span>
              <span class="detail-value">{{ account.type === 'asset' ? '资产' : '负债' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">子类型</span>
              <span class="detail-value">{{ subTypeLabel(account.sub_type) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">币种</span>
              <span class="detail-value">{{ account.currency }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">状态</span>
              <span class="detail-value">
                <span class="status-dot" :class="account.is_active ? 'dot--active' : 'dot--inactive'" />
                {{ account.is_active ? '启用' : '停用' }}
              </span>
            </div>
            <div v-if="account.sub_type === 'investment' && investmentReturn(account.id)" class="detail-row">
              <span class="detail-label">投资收益率</span>
              <span class="detail-value" :class="investmentReturn(account.id)! >= 0 ? 'text-green' : 'text-red'">
                {{ investmentReturn(account.id)! >= 0 ? '+' : '' }}{{ (investmentReturn(account.id)! * 100).toFixed(2) }}%
              </span>
            </div>
            <div v-if="account.sub_type === 'credit'" class="detail-row hint">
              还款日：每月{{ account.id === 11 ? '10' : '20' }}日
            </div>
            <div v-if="account.sub_type === 'loan'" class="detail-row hint">
              剩余本金：{{ currencyPlain(account.balance) }}
            </div>
          </div>
        </Transition>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFinance } from '../composables/useFinance'
import { useFormatter } from '../composables/useFormatter'
import {
  BankOutlined, CreditCardOutlined, HomeOutlined,
  MoneyCollectOutlined, StockOutlined, WalletOutlined,
} from '@vicons/antd'

const {
  assetAccounts, liabilityAccounts, totalAssets, totalLiabilities,
  netWorth, investmentPerformance,
} = useFinance()
const { currencyPlain } = useFormatter()

const activeTab = ref<'all' | 'asset' | 'liability'>('all')
const expandedId = ref<number | null>(null)

const tabs = computed(() => [
  { key: 'all' as const, label: '全部', emoji: '🏦', count: assetAccounts.value.length + liabilityAccounts.value.length },
  { key: 'asset' as const, label: '资产', emoji: '💰', count: assetAccounts.value.length },
  { key: 'liability' as const, label: '负债', emoji: '💳', count: liabilityAccounts.value.length },
])

const filteredAccounts = computed(() => {
  if (activeTab.value === 'asset') return assetAccounts.value
  if (activeTab.value === 'liability') return liabilityAccounts.value
  return [...assetAccounts.value, ...liabilityAccounts.value]
})

function accountIcon(subType: string) {
  const map: Record<string, any> = {
    cash: MoneyCollectOutlined,
    bank: BankOutlined,
    investment: StockOutlined,
    loan: HomeOutlined,
    credit: CreditCardOutlined,
  }
  return map[subType] || WalletOutlined
}

function subTypeLabel(subType: string) {
  const map: Record<string, string> = {
    cash: '现金', bank: '银行卡', investment: '投资', loan: '贷款', credit: '信用卡',
  }
  return map[subType] || subType
}

function investmentReturn(accountId: number): number | null {
  const perf = investmentPerformance.value.find(p => p.account.id === accountId)
  if (!perf || perf.costBasis.eq(0)) return null
  return perf.returnRate.toNumber()
}
</script>

<style scoped>
.accounts-page { padding: 28px 32px; max-width: 1400px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
.page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--text-primary); }

.summary-pills { display: flex; gap: 12px; }
.pill {
  display: flex; flex-direction: column; align-items: flex-end;
  background: var(--bg-card);
  border: 1px solid var(--border-card);
  border-radius: 12px; padding: 10px 16px; min-width: 140px;
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
}
.pill--asset { border-left: 3px solid #36B37E; }
.pill--liability { border-left: 3px solid #FF5630; }
.pill-label { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.pill-value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 2px; color: var(--text-primary); }

.tabs-row { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.tab-btn {
  display: flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: 10px;
  border: 1px solid var(--border-card);
  background: var(--bg-card); color: var(--text-secondary); font-size: 14px;
  cursor: pointer; transition: all 0.2s ease; white-space: nowrap;
}
.tab-btn:hover { border-color: var(--border-card-hover); color: var(--text-primary); }
.tab-btn.active { background: rgba(76,154,255,0.10); border-color: rgba(76,154,255,0.30); color: #4C9AFF; }
.tab-count { background: var(--border-subtle); border-radius: 6px; padding: 1px 7px; font-size: 12px; color: var(--text-muted); }
.tab-btn.active .tab-count { background: rgba(76,154,255,0.2); color: #4C9AFF; }

.card-grid-enter-active { transition: all 0.35s ease; }
.card-grid-leave-active { transition: all 0.25s ease; position: absolute; }
.card-grid-enter-from { opacity: 0; transform: scale(0.92); }
.card-grid-leave-to { opacity: 0; transform: scale(0.92); }
.card-grid-move { transition: transform 0.3s ease; }

.account-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.glass-card.account-card { padding: 16px 20px; cursor: pointer; transition: all 0.25s ease; }
.glass-card.account-card:hover { transform: translateY(-2px); }
.card-top { display: flex; align-items: center; gap: 12px; }
.account-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.icon--asset { background: rgba(54,179,126,0.12); color: #36B37E; }
.icon--liability { background: rgba(255,86,48,0.12); color: #FF5630; }
.account-info { flex: 1; min-width: 0; }
.account-name { font-size: 16px; font-weight: 600; color: var(--text-primary); }
.account-type { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.account-balance { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }

.card-detail { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px; }
.detail-row { display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
.detail-label { color: var(--text-muted); }
.detail-value { color: var(--text-primary); display: flex; align-items: center; gap: 6px; }
.detail-row.hint { color: var(--text-muted); font-style: italic; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; }
.dot--active { background: #36B37E; box-shadow: 0 0 6px rgba(54,179,126,0.5); }
.dot--inactive { background: var(--text-muted); }

.text-green { color: #36B37E; }
.text-red { color: #FF5630; }

.expand-enter-active, .expand-leave-active { transition: all 0.3s ease; }
.expand-enter-from, .expand-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
