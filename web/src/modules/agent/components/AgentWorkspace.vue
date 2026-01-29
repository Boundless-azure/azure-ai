<template>
  <div class="flex h-screen w-full bg-white overflow-hidden relative">
    <ToastContainer />
    <!-- Left Area -->
    <!-- Mobile: Full Width, hidden if showing right panel -->
    <!-- Tablet: 1/3 Width -->
    <!-- Desktop: 1/4 Width -->
    <div
      class="flex flex-shrink-0 bg-gray-900 h-full transition-all duration-300 absolute md:relative z-20"
      :class="[
        showLeftPanel ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        'w-full md:w-[450px]',
      ]"
    >
      <!-- Mobile Sidebar Toggle (Visible when Left Panel is active) -->
      <button
        v-if="showLeftPanel"
        @click="isMobileSidebarOpen = true"
        class="md:hidden absolute top-3 left-3 z-30 w-9 h-9 bg-white/10 backdrop-blur-md rounded-lg border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors shadow-sm"
      >
        <i class="fa-solid fa-bars"></i>
      </button>

      <!-- Mobile Sidebar Backdrop -->
      <div
        v-if="isMobileSidebarOpen"
        class="md:hidden absolute inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity"
        @click="isMobileSidebarOpen = false"
      ></div>

      <!-- Left Sidebar (Responsive Wrapper) -->
      <div
        class="h-full flex-shrink-0 transition-transform duration-300 z-50 absolute md:relative"
        :class="[
          isMobileSidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full md:translate-x-0',
          isMobileSidebarOpen
            ? 'w-[280px] bg-gray-900 shadow-2xl'
            : ['chat', 'more'].includes(activeView)
              ? 'w-auto'
              : 'w-full',
        ]"
      >
        <Sidebar
          :activeView="activeView"
          :isExpanded="
            isMobileSidebarOpen || !['chat', 'more'].includes(activeView)
          "
          @change="handleSidebarChange"
        />
      </div>

      <!-- Panel Container (Chat or More) -->
      <div
        class="flex-1 h-full min-w-0 flex flex-col bg-gray-900 overflow-hidden relative"
      >
        <Transition name="fade" mode="out-in">
          <KeepAlive>
            <ChatPanel
              v-if="activeView === 'chat'"
              key="chat"
              class="w-full h-full"
            />
            <MorePanel
              v-else-if="activeView === 'more'"
              key="more"
              class="w-full h-full"
              @change="handleSidebarChange"
            />
          </KeepAlive>
        </Transition>
      </div>
    </div>

    <!-- Right Big Panel -->
    <!-- Mobile: Full Width, visible if NOT showing left panel -->
    <!-- Tablet/Desktop: Flex-1 (Remaining Width) -->
    <div
      class="bg-white h-full transition-all duration-300 absolute md:relative z-10 flex-1 min-w-0"
      :class="[
        !showLeftPanel ? 'translate-x-0' : 'translate-x-full md:translate-x-0',
        'w-full md:w-auto',
      ]"
    >
      <!-- Mobile Menu Toggle (Visible only on mobile when Right Panel is active) -->
      <button
        v-if="!showLeftPanel"
        @click="toggleMobileView"
        class="md:hidden absolute top-4 left-4 z-50 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:text-black"
      >
        <i class="fa-solid fa-bars"></i>
      </button>

      <RightPanel :activeView="activeView" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Agent Workspace
 * @description Main layout with dynamic left panel sizing and mobile responsiveness.
 * @keywords-cn 代理工作区, 动态布局, 侧边栏切换, 移动端适配
 * @keywords-en agent-workspace, dynamic-layout, sidebar-toggle, mobile-responsive
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import Sidebar from './Sidebar.vue';
import ChatPanel from './ChatPanel.vue';
import MorePanel from './MorePanel.vue';
import RightPanel from './RightPanel.vue';
import ToastContainer from './ToastContainer.vue';
import { useAgentSessionStore } from '../store/session.store';

// Initialize Pinia
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
setActivePinia(pinia);

const activeView = ref('chat');

// Mobile view state: true = show Left Panel (Chat/Menu), false = show Right Panel (Workspace)
const showLeftPanel = ref(true);
// Mobile Sidebar state (toggle visibility of the Sidebar icons strip)
const isMobileSidebarOpen = ref(false);

const handleSidebarChange = (view: string) => {
  activeView.value = view;
  // Close mobile sidebar on selection
  if (window.innerWidth < 768) {
    isMobileSidebarOpen.value = false;
  }

  // On mobile, if switching to a non-chat/non-more view, show the right panel
  if (!['chat', 'more'].includes(view)) {
    // Check if screen is mobile (simplified check, relies on CSS hiding but state helps logic)
    if (window.innerWidth < 768) {
      showLeftPanel.value = false;
    }
  } else {
    showLeftPanel.value = true;
  }
};

const toggleMobileView = () => {
  showLeftPanel.value = !showLeftPanel.value;
  // If opening left panel and current view has no left content (like dashboard), open the sidebar menu
  if (showLeftPanel.value && !['chat', 'more'].includes(activeView.value)) {
    isMobileSidebarOpen.value = true;
  }
};

// Optional: Watch activeView to ensure correct panel visibility on resize or external changes
watch(activeView, (newView) => {
  if (window.innerWidth < 768) {
    if (['chat', 'more'].includes(newView)) {
      showLeftPanel.value = true;
    } else {
      showLeftPanel.value = false;
    }
  }
});

const getPrincipalId = (): string | undefined => {
  try {
    const principalRaw = localStorage.getItem('principal');
    if (principalRaw) {
      const parsed = JSON.parse(principalRaw) as { id?: string };
      const pid = typeof parsed.id === 'string' ? parsed.id.trim() : '';
      if (pid) return pid;
    }
    const legacy = localStorage.getItem('identity.currentPrincipalId');
    const id = (legacy || '').trim();
    return id || undefined;
  } catch {
    return undefined;
  }
};

onMounted(() => {
  const sessionStore = useAgentSessionStore();
  sessionStore.connectRealtime();
});

onUnmounted(() => {
  const sessionStore = useAgentSessionStore();
  sessionStore.disconnectRealtime();
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
