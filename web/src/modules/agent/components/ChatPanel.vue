<template>
  <div class="flex flex-col h-full bg-gray-50 relative">
    <!-- Header -->
    <div class="flex-shrink-0 z-10 bg-white border-b border-gray-200">
      <!-- Home Mode Header -->
      <div v-if="mode === 'home'" class="flex flex-col">
        <!-- Top Bar -->
        <div class="h-14 flex items-center justify-between px-4">
          <div class="flex items-center space-x-2">
            <div
              class="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-sm"
            >
              <i class="fa-solid fa-robot"></i>
            </div>
            <h1 class="text-lg font-bold text-gray-800">Azure AI</h1>
          </div>
          <div class="flex items-center space-x-3">
            <!-- Top right actions removed as per user request for cleaner UI -->
          </div>
        </div>

        <!-- Search & Filter Bar -->
        <div class="px-4 pb-3">
          <div class="relative group">
            <div
              class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
            >
              <i
                class="fa-solid fa-magnifying-glass text-gray-400 text-xs group-focus-within:text-green-500 transition-colors"
              ></i>
            </div>
            <input
              v-model="searchQuery"
              type="text"
              class="block w-full pl-9 pr-20 py-2 bg-gray-100 border-none rounded-xl text-sm placeholder-gray-400 focus:ring-2 focus:ring-green-500/20 focus:bg-white transition-all"
              placeholder="搜索会话..."
            />
            <div class="absolute inset-y-0 right-1.5 flex items-center">
              <button
                @click="onlyAi = !onlyAi"
                class="flex items-center px-2 py-1 rounded-lg text-[10px] font-bold transition-all border select-none"
                :class="
                  onlyAi
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'
                "
              >
                <i class="fa-solid fa-robot mr-1"></i>
                AI
              </button>
              <div class="relative ml-2">
                <button
                  @click="isCreateMenuOpen = !isCreateMenuOpen"
                  class="flex items-center px-2 py-1 rounded-lg text-[10px] font-bold transition-all border select-none bg-white text-gray-400 border-gray-100 hover:border-gray-300"
                >
                  <i class="fa-solid fa-plus"></i>
                </button>
                <div
                  v-if="isCreateMenuOpen"
                  class="absolute right-0 top-full mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-xl py-2 z-50"
                >
                  <button
                    @click="
                      createThreadOfType('group');
                      isCreateMenuOpen = false;
                    "
                    class="w-full text-left px-4 py-1.5 hover:bg-gray-50 text-sm"
                  >
                    新建群聊
                  </button>
                  <button
                    @click="
                      createThreadOfType('dm');
                      isCreateMenuOpen = false;
                    "
                    class="w-full text-left px-4 py-1.5 hover:bg-gray-50 text-sm"
                  >
                    新建私聊
                  </button>
                  <button
                    @click="
                      createThreadOfType('assistant');
                      isCreateMenuOpen = false;
                    "
                    class="w-full text-left px-4 py-1.5 hover:bg-gray-50 text-sm"
                  >
                    新建助手
                  </button>
                  <button
                    @click="
                      createThreadOfType('system');
                      isCreateMenuOpen = false;
                    "
                    class="w-full text-left px-4 py-1.5 hover:bg-gray-50 text-sm"
                  >
                    系统通知
                  </button>
                  <button
                    @click="
                      createThreadOfType('todo');
                      isCreateMenuOpen = false;
                    "
                    class="w-full text-left px-4 py-1.5 hover:bg-gray-50 text-sm"
                  >
                    待办通知
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat Mode Header -->
      <div v-else class="h-16 flex items-center justify-between px-4 relative">
        <div class="flex items-center space-x-3 overflow-hidden">
          <button
            @click="mode = 'home'"
            class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors flex-shrink-0"
          >
            <i class="fa-solid fa-arrow-left"></i>
          </button>

          <div class="flex flex-col min-w-0">
            <div class="flex items-center space-x-2">
              <h2 class="text-base font-bold text-gray-800 truncate">
                {{ currentSessionTitle || '未命名对话' }}
              </h2>
              <i
                v-if="isTitleLoading"
                class="fas fa-spinner fa-spin text-gray-400 text-xs"
              ></i>
            </div>
          </div>
        </div>

        <!-- Chat Settings -->
        <div class="relative">
          <button
            @click="isChatSettingsOpen = !isChatSettingsOpen"
            class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
            title="聊天设置"
          >
            <i class="fa-solid fa-ellipsis"></i>
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="isChatSettingsOpen"
            class="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl py-2 z-50 animate-fade-in"
          >
            <div class="px-4 py-2 border-b border-gray-100 mb-2">
              <span class="text-xs font-bold text-gray-400 uppercase"
                >聊天设置</span
              >
            </div>

            <div class="px-4 space-y-2">
              <label class="text-xs text-gray-500">标题</label>
              <input
                v-model="settingsTitle"
                class="w-full px-3 py-1.5 border rounded-md text-sm"
                placeholder="未命名对话"
              />

              <label class="text-xs text-gray-500">类型</label>
              <select
                v-model="settingsType"
                class="w-full px-3 py-1.5 border rounded-md text-sm"
              >
                <option value="assistant">助手</option>
                <option value="system">系统</option>
                <option value="todo">待办</option>
                <option value="group">群聊</option>
                <option value="dm">私聊</option>
              </select>

              <label class="flex items-center space-x-2 text-sm">
                <input type="checkbox" v-model="settingsAi" />
                <span>AI参与</span>
              </label>

              <label class="text-xs text-gray-500">成员（逗号分隔）</label>
              <input
                v-model="settingsMembersText"
                class="w-full px-3 py-1.5 border rounded-md text-sm"
                placeholder="如：张三, 李四"
              />

              <div class="flex items-center justify-between pt-2">
                <button
                  @click="
                    () => {
                      const t = allThreads.find(
                        (t) => t.id === currentSessionId,
                      );
                      if (t) togglePin(t);
                    }
                  "
                  class="px-3 py-1.5 text-sm rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center space-x-1"
                >
                  <i class="fa-solid fa-thumbtack"></i>
                  <span>{{
                    allThreads.find((t) => t.id === currentSessionId)?.isPinned
                      ? '取消置顶'
                      : '置顶会话'
                  }}</span>
                </button>
                <div class="space-x-2">
                  <button
                    @click="applyThreadSettings"
                    class="px-3 py-1.5 text-sm rounded-md bg-green-500 hover:bg-green-600 text-white"
                  >
                    保存
                  </button>
                  <button
                    @click="
                      () => {
                        const t = allThreads.find(
                          (t) => t.id === currentSessionId,
                        );
                        if (t) deleteThread(t);
                      }
                    "
                    class="px-3 py-1.5 text-sm rounded-md bg-red-500 hover:bg-red-600 text-white"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
          <!-- Backdrop to close -->
          <div
            v-if="isChatSettingsOpen"
            class="fixed inset-0 z-40"
            @click="isChatSettingsOpen = false"
          ></div>
        </div>
      </div>
    </div>

    <!-- Main Area -->
    <div
      class="flex-1 overflow-y-auto p-2 custom-scrollbar relative"
      ref="chatContainer"
    >
      <!-- Home: Thread List -->
      <div v-if="mode === 'home'" class="h-full">
        <!-- Chat Tab -->
        <div v-if="activeTab === 'chat'" class="flex flex-col">
          <div
            v-if="displayThreads.length === 0"
            class="flex flex-col items-center justify-center py-10 space-y-4"
          >
            <div
              class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center"
            >
              <i class="fa-solid fa-comments text-2xl text-gray-300"></i>
            </div>
            <p class="text-sm text-gray-500">
              {{ t('chat.emptyThreads') }}
            </p>
          </div>
          <!-- Combined List -->
          <div
            v-for="thread in displayThreads"
            :key="thread.id"
            class="relative overflow-hidden border-b border-gray-100 cursor-pointer group select-none"
            @mousedown="handleTouchStart($event)"
            @touchstart="handleTouchStart($event)"
            @mouseup="handleTouchEnd($event, thread)"
            @touchend="handleTouchEnd($event, thread)"
            @mouseleave="
              swipedThreadId === thread.id ? null : (swipedThreadId = null)
            "
          >
            <!-- Background Actions (Slide Menu) -->
            <div class="absolute inset-y-0 right-0 flex">
              <button
                @click.stop="togglePin(thread)"
                class="w-[70px] h-full bg-gray-200 hover:bg-gray-300 text-gray-700 flex flex-col items-center justify-center transition-colors"
              >
                <i class="fa-solid fa-thumbtack mb-1"></i>
                <span class="text-xs font-medium">{{
                  thread.isPinned ? '取消' : '置顶'
                }}</span>
              </button>
              <button
                v-if="thread.threadType !== 'assistant'"
                @click.stop="deleteThread(thread)"
                class="w-[70px] h-full bg-red-500 hover:bg-red-600 text-white flex flex-col items-center justify-center transition-colors"
              >
                <i class="fa-solid fa-trash mb-1"></i>
                <span class="text-xs font-medium">删除</span>
              </button>
            </div>

            <!-- Foreground Content (Swipeable) -->
            <div
              class="relative bg-white flex items-center px-4 py-3 transition-transform duration-300 ease-out transform"
              :class="{
                'bg-gray-50': thread.isPinned,
                '-translate-x-[140px]': swipedThreadId === thread.id,
              }"
              @click="handleItemClick(thread)"
            >
              <!-- Avatar -->
              <div class="relative mr-3 flex-shrink-0">
                <!-- Group Avatar Grid -->
                <div
                  v-if="
                    thread.threadType === 'group' &&
                    thread.members &&
                    thread.members.length > 0
                  "
                  class="w-10 h-10 rounded-lg bg-gray-200 p-0.5 grid gap-0.5 overflow-hidden"
                  :class="{
                    'grid-cols-2':
                      thread.members.length >= 2 && thread.members.length <= 4,
                    'grid-cols-3': thread.members.length > 4,
                  }"
                >
                  <div
                    v-for="(member, idx) in thread.members.slice(0, 9)"
                    :key="idx"
                    class="bg-gray-300 flex items-center justify-center text-[6px] font-bold text-gray-600 rounded-sm overflow-hidden"
                    :class="{
                      'col-span-2 row-span-2': thread.members.length === 1,
                    }"
                  >
                    <!-- Assuming member is just a name/char for now, can be img if URL -->
                    <img
                      v-if="member.startsWith('http')"
                      :src="member"
                      class="w-full h-full object-cover"
                    />
                    <span v-else>{{ member.slice(0, 1) }}</span>
                  </div>
                </div>

                <!-- Single Avatar -->
                <div
                  v-else
                  class="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg"
                  :class="getAvatarClass(thread)"
                >
                  <i class="fa-solid" :class="threadIcon(thread)"></i>
                </div>
                <!-- Pinned Badge -->
                <div
                  v-if="thread.isPinned"
                  class="absolute -top-1 -right-1 bg-gray-200 text-gray-600 text-[8px] px-1 rounded-full border border-white"
                >
                  <i class="fa-solid fa-thumbtack"></i>
                </div>
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0 text-left">
                <!-- Title & Time -->
                <div class="flex justify-between items-baseline mb-0.5">
                  <span class="font-bold text-gray-800 text-sm truncate pr-2">{{
                    thread.threadType === 'assistant'
                      ? t('chat.assistantTitle')
                      : thread.title || threadLabel(thread)
                  }}</span>
                  <span class="text-[10px] text-gray-400 flex-shrink-0">{{
                    formatDate(thread.updatedAt)
                  }}</span>
                </div>

                <!-- Last Message / Status -->
                <div class="flex items-center justify-between">
                  <div class="text-xs text-gray-500 truncate flex-1 pr-2">
                    <span
                      v-if="thread.workflowStatus === 'running'"
                      class="text-blue-600"
                    >
                      [{{ t('chat.statusRunning') }}]
                      {{ thread.lastMessage || t('chat.processing') }}
                    </span>
                    <span
                      v-else-if="thread.workflowStatus === 'error'"
                      class="text-red-600"
                    >
                      [{{ t('chat.statusError') }}]
                      {{ thread.lastMessage || t('chat.errorOccurred') }}
                    </span>
                    <span v-else>
                      {{ thread.lastMessage || t('chat.noMessages') }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Contacts Tab -->
        <div
          v-else-if="activeTab === 'contacts'"
          class="flex flex-col h-full bg-white relative overflow-hidden"
        >
          <!-- Search Bar -->
          <div
            class="px-4 py-2 bg-gray-50 border-b border-gray-100 flex-shrink-0"
          >
            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <input
                  v-model="contactSearchQuery"
                  type="text"
                  :placeholder="t('contacts.search')"
                  class="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 transition-colors"
                />
                <i
                  class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs"
                ></i>
              </div>
              <button
                class="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-900 text-white hover:bg-gray-800"
                @click="showIdentityManager = true"
              >
                管理
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto custom-scrollbar">
            <!-- Accordion List -->
            <div
              v-for="group in contactGroups"
              :key="group.id"
              class="border-b border-gray-50"
            >
              <!-- Group Header -->
              <div
                class="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 select-none"
                @click="toggleCategory(group.id)"
              >
                <div class="flex items-center space-x-2 text-gray-700">
                  <i
                    class="fa-solid fa-chevron-right text-[10px] text-gray-400 transition-transform duration-200"
                    :class="{
                      'rotate-90': expandedCategories.includes(group.id),
                    }"
                  ></i>
                  <span class="text-sm font-medium">{{ group.name }}</span>
                </div>
                <div class="text-xs text-gray-400" v-if="group.count > 0">
                  {{ group.count }}
                </div>
              </div>

              <!-- Group Items -->
              <div
                v-if="expandedCategories.includes(group.id)"
                class="bg-white"
              >
                <div
                  v-for="t in group.items"
                  :key="t.id"
                  class="flex items-center px-4 py-2 pl-10 hover:bg-gray-50 cursor-pointer relative group"
                  @click="enterThread(t)"
                >
                  <!-- Avatar (Small) -->
                  <div
                    class="relative flex-shrink-0 mr-3"
                    @click.stop="openProfile(t)"
                  >
                    <!-- Group Avatar Grid -->
                    <div
                      v-if="
                        t.threadType === 'group' &&
                        t.members &&
                        t.members.length > 0
                      "
                      class="w-8 h-8 rounded bg-gray-200 p-0.5 grid gap-0.5 overflow-hidden"
                      :class="{
                        'grid-cols-2':
                          t.members.length >= 2 && t.members.length <= 4,
                        'grid-cols-3': t.members.length > 4,
                      }"
                    >
                      <div
                        v-for="(member, idx) in t.members.slice(0, 9)"
                        :key="idx"
                        class="bg-gray-300 flex items-center justify-center text-[5px] font-bold text-gray-600 rounded-sm overflow-hidden"
                        :class="{
                          'col-span-2 row-span-2': t.members.length === 1,
                        }"
                      >
                        <img
                          v-if="member.startsWith('http')"
                          :src="member"
                          class="w-full h-full object-cover"
                        />
                        <span v-else>{{ member.slice(0, 1) }}</span>
                      </div>
                    </div>
                    <!-- Single Icon -->
                    <div
                      v-else
                      class="w-8 h-8 rounded flex items-center justify-center text-white text-sm"
                      :class="getAvatarClass(t)"
                    >
                      <i class="fa-solid" :class="threadIcon(t)"></i>
                    </div>
                  </div>

                  <!-- Content -->
                  <div class="flex-1 min-w-0">
                    <div class="text-gray-800 text-sm truncate">
                      {{ t.title || threadLabel(t) }}
                    </div>
                  </div>
                </div>
                <div v-if="group.items.length === 0" class="pl-10 py-3">
                  <div class="flex items-center gap-2 text-xs text-gray-400">
                    <i class="fa-regular fa-circle-xmark"></i>
                    <span>{{ t('contacts.emptyGroup') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Profile Overlay -->
          <div
            v-if="showProfile && currentProfile"
            class="absolute inset-0 bg-white z-20 flex flex-col animate-fade-in-right"
          >
            <div class="px-4 py-3 border-b border-gray-100 flex items-center">
              <button
                @click="closeProfile"
                class="mr-3 text-gray-500 hover:text-gray-700"
              >
                <i class="fa-solid fa-arrow-left"></i>
              </button>
              <span class="font-bold text-gray-800">{{
                t('contacts.profile')
              }}</span>
            </div>
            <div
              class="p-6 flex flex-col items-center flex-1 overflow-y-auto custom-scrollbar"
            >
              <!-- Large Avatar -->
              <div class="w-24 h-24 mb-4">
                <!-- Reuse Avatar Logic (Simplified for single large view) -->
                <div
                  v-if="
                    currentProfile.threadType === 'group' &&
                    currentProfile.members &&
                    currentProfile.members.length > 0
                  "
                  class="w-full h-full rounded-xl bg-gray-200 p-1 grid gap-0.5 overflow-hidden"
                  :class="{
                    'grid-cols-2':
                      currentProfile.members.length >= 2 &&
                      currentProfile.members.length <= 4,
                    'grid-cols-3': currentProfile.members.length > 4,
                  }"
                >
                  <div
                    v-for="(member, idx) in currentProfile.members.slice(0, 9)"
                    :key="idx"
                    class="bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600 rounded-sm overflow-hidden"
                    :class="{
                      'col-span-2 row-span-2':
                        currentProfile.members.length === 1,
                    }"
                  >
                    <img
                      v-if="member.startsWith('http')"
                      :src="member"
                      class="w-full h-full object-cover"
                    />
                    <span v-else>{{ member.slice(0, 1) }}</span>
                  </div>
                </div>
                <div
                  v-else
                  class="w-full h-full rounded-xl flex items-center justify-center text-white text-4xl"
                  :class="getAvatarClass(currentProfile)"
                >
                  <i class="fa-solid" :class="threadIcon(currentProfile)"></i>
                </div>
              </div>

              <h2 class="text-xl font-bold text-gray-900 mb-1 text-center">
                {{ currentProfile.title || threadLabel(currentProfile) }}
              </h2>
              <p class="text-gray-500 text-sm mb-6">
                ID: {{ currentProfile.id }}
              </p>

              <div class="w-full space-y-3">
                <button
                  @click="
                    enterThread(currentProfile!);
                    closeProfile();
                  "
                  class="w-full py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center"
                >
                  <i class="fa-solid fa-comment mr-2"></i>
                  {{ t('contacts.sendMessage') }}
                </button>
                <div
                  v-if="currentProfile.threadType === 'group'"
                  class="w-full mt-2 space-y-3"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-bold text-gray-700">
                      {{ t('contacts.memberManagement') }}
                    </span>
                  </div>
                  <div class="space-y-2">
                    <div
                      v-for="(member, idx) in currentProfile.members || []"
                      :key="idx"
                      class="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2"
                    >
                      <div class="flex items-center gap-2">
                        <div
                          class="w-6 h-6 rounded bg-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-700"
                        >
                          <span>{{ member.slice(0, 1) }}</span>
                        </div>
                        <span class="text-sm text-gray-700">{{ member }}</span>
                      </div>
                      <button
                        @click="removeMemberFromCurrentThread(member)"
                        class="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600"
                      >
                        {{ t('contacts.removeMember') }}
                      </button>
                    </div>
                    <div class="flex items-center gap-2">
                      <input
                        v-model="newMemberName"
                        type="text"
                        :placeholder="t('contacts.inputMemberPlaceholder')"
                        class="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                      <button
                        @click="addMemberToCurrentThread()"
                        class="text-xs px-3 py-2 rounded bg-green-500 text-white hover:bg-green-600"
                      >
                        {{ t('contacts.addMember') }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Additional Info (Mock) -->
              <div class="w-full mt-8 border-t border-gray-100 pt-6">
                <div class="flex justify-between py-3 border-b border-gray-50">
                  <span class="text-gray-500 text-sm">备注</span>
                  <span class="text-gray-800 text-sm">无</span>
                </div>
                <div class="flex justify-between py-3 border-b border-gray-50">
                  <span class="text-gray-500 text-sm">来源</span>
                  <span class="text-gray-800 text-sm">搜索添加</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Daily Tab -->
        <div
          v-else-if="activeTab === 'daily'"
          class="flex-1 overflow-y-auto custom-scrollbar bg-white relative"
        >
          <!-- Loading State -->
          <div
            v-if="loadingDaily"
            class="flex flex-col items-center justify-center py-10"
          >
            <div
              class="w-8 h-8 border-4 border-green-100 border-t-green-500 rounded-full animate-spin"
            ></div>
            <span class="text-xs text-gray-400 mt-2">加载中...</span>
          </div>

          <!-- Empty State -->
          <div
            v-else-if="dailyReports.length === 0"
            class="flex flex-col items-center justify-center py-10 space-y-4"
          >
            <div
              class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center"
            >
              <i class="fa-solid fa-calendar-xmark text-2xl text-gray-300"></i>
            </div>
            <p class="text-sm text-gray-500">暂无日报记录</p>
          </div>

          <!-- Timeline List -->
          <div v-else class="px-4 py-4 space-y-8">
            <div
              v-for="(report, index) in dailyReports"
              :key="report.group.id"
              class="flex flex-col w-full"
            >
              <!-- Date Header (Above Card) -->
              <div class="flex items-center mb-3 px-1">
                <div class="w-2.5 h-2.5 rounded-full bg-green-500 mr-3"></div>
                <span class="text-lg font-bold text-gray-800 mr-2">{{
                  formatDateSimple(report.group.createdAt)
                }}</span>
                <span class="text-sm text-gray-400 font-medium">{{
                  getWeekDay(report.group.createdAt)
                }}</span>
              </div>

              <!-- Report Content Card -->
              <div
                class="space-y-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                <!-- Chat Summary -->
                <div class="space-y-2">
                  <h4
                    class="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center"
                  >
                    <i class="fa-solid fa-comment-dots mr-2"></i
                    >{{ t('modal.chatSummary') || '对话摘要' }}
                  </h4>
                  <div
                    class="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm text-gray-600 leading-relaxed"
                  >
                    {{ report.report.summary || '暂无对话记录' }}
                  </div>
                </div>

                <!-- Pending Tasks -->
                <div class="space-y-2">
                  <h4
                    class="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center"
                  >
                    <i class="fa-solid fa-list-check mr-2"></i
                    >{{ t('modal.pendingTasks') || '待办事项' }}
                  </h4>
                  <div class="space-y-2">
                    <div
                      v-if="report.report.todos.length === 0"
                      class="text-sm text-gray-400 italic pl-4"
                    >
                      暂无待办
                    </div>
                    <div
                      v-for="todo in report.report.todos"
                      :key="todo.id"
                      class="flex items-center bg-white border border-gray-100 p-3 rounded-lg shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
                      @click="toggleTodoStatus(todo)"
                    >
                      <!-- Checkbox visualization matching DatePickerModal style -->
                      <div
                        class="w-4 h-4 rounded border-2 mr-3 flex items-center justify-center transition-colors"
                        :class="
                          todo.completed
                            ? 'bg-green-500 border-green-500'
                            : 'border-gray-300'
                        "
                      >
                        <i
                          v-if="todo.completed"
                          class="fa-solid fa-check text-white text-[10px]"
                        ></i>
                      </div>
                      <span
                        class="text-sm text-gray-700"
                        :class="{
                          'line-through text-gray-400': todo.completed,
                        }"
                        >{{ todo.title }}</span
                      >
                    </div>
                  </div>
                </div>

                <!-- Plugin Activity -->
                <div class="space-y-2">
                  <h4
                    class="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center"
                  >
                    <i class="fa-solid fa-plug mr-2"></i
                    >{{ t('modal.pluginActivity') || '插件活动' }}
                  </h4>
                  <div class="space-y-2">
                    <div
                      v-if="report.report.plugins.length === 0"
                      class="text-sm text-gray-400 italic pl-4"
                    >
                      暂无活动
                    </div>
                    <div
                      v-for="plugin in report.report.plugins"
                      :key="plugin.id"
                      class="flex items-center justify-between bg-white border border-gray-100 p-3 rounded-lg hover:shadow-sm transition-shadow"
                    >
                      <div class="flex items-center">
                        <div
                          class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mr-3 text-blue-500"
                        >
                          <i class="fa-solid" :class="`fa-${plugin.icon}`"></i>
                        </div>
                        <span class="text-sm font-medium text-gray-700">{{
                          plugin.name
                        }}</span>
                      </div>
                      <span
                        class="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-500"
                        >{{ plugin.count }}</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat: Messages -->
      <!-- History Loading State -->
      <div
        v-if="mode === 'chat' && isLoadingHistory"
        class="flex flex-col items-center justify-center h-full space-y-4"
      >
        <div
          class="w-10 h-10 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin"
        ></div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="mode === 'chat' && isHistoryEmpty"
        class="flex flex-col items-center justify-center h-full space-y-6 text-center animate-fade-in-up"
      >
        <div
          class="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center relative"
        >
          <div
            class="absolute inset-0 bg-blue-100/50 rounded-full animate-ping"
            style="animation-duration: 3s"
          ></div>
          <i
            class="fa-solid fa-earth-americas text-4xl text-blue-500 relative z-10"
          ></i>
        </div>
        <div class="space-y-2 max-w-xs mx-auto">
          <p class="text-gray-500 font-medium">{{ t('chat.emptyState') }}</p>
        </div>
      </div>

      <!-- Message List -->
      <div v-else-if="mode === 'chat'" class="animate-fade-in">
        <template v-for="(msg, index) in currentMessages" :key="msg.id">
          <!-- Message Bubble -->
          <div
            class="flex flex-col mb-6 px-2 group/message w-full"
            :class="msg.role === ChatRole.User ? 'items-end' : 'items-start'"
          >
            <!-- Sender Info -->
            <div
              class="flex items-center gap-2 mb-1.5 px-1 opacity-80 select-none"
              :class="
                msg.role === ChatRole.User ? 'flex-row-reverse' : 'flex-row'
              "
            >
              <div
                class="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                :class="
                  msg.role === ChatRole.User
                    ? 'bg-gray-800 text-white'
                    : 'bg-blue-100 text-blue-600'
                "
              >
                <i
                  class="fa-solid"
                  :class="msg.role === ChatRole.User ? 'fa-user' : 'fa-robot'"
                ></i>
              </div>
              <span class="text-xs text-gray-500 font-medium">
                {{ msg.role === ChatRole.User ? 'You' : 'Assistant' }}
              </span>
            </div>

            <!-- Bubble Content -->
            <div
              class="rounded-2xl px-4 py-2.5 shadow-sm text-sm relative group transition-all overflow-hidden break-words max-w-full"
              :class="
                msg.role === ChatRole.User
                  ? 'bg-black text-white'
                  : 'bg-white border border-gray-200 text-gray-800 w-full'
              "
            >
              <!-- Tool Call Display -->
              <div
                v-if="msg.tool_calls && msg.tool_calls.length > 0"
                class="mb-3 space-y-2"
              >
                <div
                  v-for="tool in msg.tool_calls"
                  :key="tool.id"
                  class="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-mono text-gray-600 overflow-x-auto"
                >
                  <div class="flex items-center justify-between mb-1">
                    <span class="font-bold text-blue-600 flex items-center">
                      <i class="fa-solid fa-wrench mr-1"></i> {{ tool.name }}
                    </span>
                    <span
                      class="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold"
                      :class="{
                        'bg-yellow-100 text-yellow-600':
                          tool.status === ToolCallStatus.Calling,
                        'bg-green-100 text-green-600':
                          tool.status === ToolCallStatus.Completed,
                        'bg-red-100 text-red-600':
                          tool.status === ToolCallStatus.Failed,
                      }"
                    >
                      {{ tool.status }}
                    </span>
                  </div>
                  <div class="truncate opacity-75">{{ tool.arguments }}</div>
                  <div
                    v-if="tool.result"
                    class="mt-1 text-[11px] text-green-700 whitespace-pre-wrap"
                  >
                    {{ tool.result }}
                  </div>
                </div>
              </div>

              <!-- Markdown Content -->
              <div
                v-if="msg.role === ChatRole.Assistant"
                class="markdown-body prose prose-sm max-w-none overflow-x-auto"
                v-html="renderMarkdown(msg.content)"
              ></div>
              <p v-else class="leading-relaxed whitespace-pre-wrap">
                {{ msg.content }}
              </p>
            </div>
          </div>
        </template>
      </div>

      <!-- Loading Indicator (Fixed Position) -->
      <div
        v-if="mode === 'chat' && isProcessing"
        class="fixed bottom-24 left-6 z-20"
      >
        <div
          class="bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-sm flex items-center space-x-2"
        >
          <div
            class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
            style="animation-delay: 0ms"
          ></div>
          <div
            class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
            style="animation-delay: 150ms"
          ></div>
          <div
            class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
            style="animation-delay: 300ms"
          ></div>
          <span class="text-xs text-gray-400 ml-2">{{
            t('chat.processing')
          }}</span>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div
      v-if="mode === 'chat'"
      class="p-4 bg-white border-t border-gray-200 flex-shrink-0 z-20"
    >
      <div class="max-w-4xl mx-auto">
        <InputArea
          :placeholder="t('chat.inputPlaceholder')"
          :disabled="isProcessing"
          :mentions="
            currentThread?.threadType === 'group' ? mentionCandidates : []
          "
          @send="onInputSend"
        />
        <div class="text-center mt-2">
          <p class="text-[10px] text-gray-400">
            {{ t('chat.footerDisclaimer') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Bottom Tab Bar -->
    <div
      v-if="mode === 'home'"
      class="flex-shrink-0 bg-white border-t border-gray-200 flex items-center justify-around h-14 pb-2"
    >
      <button
        @click="activeTab = 'chat'"
        class="flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors"
        :class="
          activeTab === 'chat'
            ? 'text-green-600'
            : 'text-gray-400 hover:text-gray-600'
        "
      >
        <div class="relative">
          <i class="fa-solid fa-message text-lg"></i>
          <span
            v-if="unreadCount > 0"
            class="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] px-1 rounded-full min-w-[16px] h-[16px] flex items-center justify-center leading-none"
          >
            {{ unreadDisplay }}
          </span>
        </div>
        <span class="text-[10px] font-medium">{{ t('tabs.chat') }}</span>
      </button>

      <button
        @click="activeTab = 'contacts'"
        class="flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors"
        :class="
          activeTab === 'contacts'
            ? 'text-green-600'
            : 'text-gray-400 hover:text-gray-600'
        "
      >
        <i class="fa-solid fa-address-book text-lg"></i>
        <span class="text-[10px] font-medium">{{ t('tabs.contacts') }}</span>
      </button>

      <button
        @click="activeTab = 'daily'"
        class="flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors"
        :class="
          activeTab === 'daily'
            ? 'text-green-600'
            : 'text-gray-400 hover:text-gray-600'
        "
      >
        <i class="fa-solid fa-file-lines text-lg"></i>
        <span class="text-[10px] font-medium">{{ t('tabs.daily') }}</span>
      </button>
    </div>

    <!-- Date Picker Modal Removed -->

    <!-- Workflow Monitor Modal -->
    <WorkflowMonitorModal
      v-if="showWorkflowMonitor"
      :visible="showWorkflowMonitor"
      @close="showWorkflowMonitor = false"
    />
    <!-- Identity Manager Modal -->
    <IdentityManager
      v-if="showIdentityManager"
      @close="showIdentityManager = false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Panel Component
 * @description Main chat interface with tool call display and streaming AI responses.
 * @keywords-cn 聊天面板, 消息列表, 工具调用, 流式
 * @keywords-en chat-panel, message-list, tool-calls, streaming
 */
import { ref, onMounted, nextTick, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useAgentStore } from '../store/agent.store';
import { agentService } from '../services/agent.service';
import {
  agentSocketService,
  type AgentStreamCallbacks,
} from '../services/agent.socket.service';
import {
  ChatRole,
  ToolCallStatus,
  WorkflowGraphStatus,
} from '../enums/agent.enums';
import type {
  ChatMessage,
  WorkflowStep,
  ToolCall,
  ActiveWorkflowCard,
  ThreadListItem,
  GroupListItem,
  DailyTodo,
  Attachment,
} from '../types/agent.types';
import { useI18n } from '../composables/useI18n';
import WorkflowMonitorModal from './WorkflowMonitorModal.vue';
import InputArea from './chat/InputArea.vue';
import IdentityManager from '../../identity/components/IdentityManager.vue';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { useUIStore } from '../store/ui.store';
import { usePanelStore } from '../store/panel.store';

const props = defineProps<{
  class?: string;
}>();

const { t } = useI18n();
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return (
          '<pre class="hljs"><code>' +
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
          '</code></pre>'
        );
      } catch (__) {}
    }
    return (
      '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>'
    );
  },
});

const renderMarkdown = (content: string) => {
  return md.render(content);
};

const steps = ref<WorkflowStep[]>([]);
const activeWorkflows = ref<ActiveWorkflowCard[]>([]);
const history = ref<Record<string, ChatMessage[]>>({});
const inputMessage = ref('');
const isProcessing = ref(false);
const isLoadingHistory = ref(false);
const isTitleLoading = ref<boolean>(false);
const currentAssistantMessageId = ref<string | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const chatContainer = ref<HTMLElement | null>(null);
const showWorkflowMonitor = ref(false);
const showIdentityManager = ref(false);

interface DailyReportGroup {
  group: GroupListItem;
  report: import('../types/agent.types').DailyReportContent;
}

const dailyReports = ref<DailyReportGroup[]>([]);
const loadingDaily = ref(false);

const loadDailyReports = async () => {
  if (loadingDaily.value) return;
  loadingDaily.value = true;
  try {
    const groups = await agentService.getGroupList();
    const reports: DailyReportGroup[] = [];

    for (const group of groups) {
      const summaryRes = await agentService.getGroupSummaries(group.id);
      reports.push({
        group,
        report: summaryRes.report,
      });
    }

    // Sort by date desc
    reports.sort(
      (a, b) =>
        new Date(b.group.createdAt).getTime() -
        new Date(a.group.createdAt).getTime(),
    );
    dailyReports.value = reports;
  } catch (e) {
    console.error('Failed to load daily reports', e);
  } finally {
    loadingDaily.value = false;
  }
};

// Toggle todo completed state within daily report list
const toggleTodoStatus = (todo: DailyTodo) => {
  // flip completed flag
  const current = Boolean(todo.completed);
  todo.completed = !current;
};

const panelStore = usePanelStore();
const {
  mode,
  activeTab,
  onlyAi,
  searchQuery,
  contactSearchQuery,
  expandedCategories,
} = storeToRefs(panelStore);

watch(activeTab, (val) => {
  loadByTab(val);
});
const allThreads = ref<ThreadListItem[]>([]);
const allContacts = ref<ThreadListItem[]>([]);
const aiAgentItems = ref<ThreadListItem[]>([]);

const store = useAgentStore();
const {
  selectedDate: currentDateStr,
  chatClientId,
  currentSessionId,
  currentSessionTitle,
  threadReadAt,
} = storeToRefs(store);

// File attachment state
const fileInput = ref<HTMLInputElement | null>(null);
const attachedFiles = ref<{ file: File; preview: string }[]>([]);

// Voice recording state
const isRecording = ref(false);

const isHistoryEmpty = computed(() => {
  return Object.keys(history.value).length === 0;
});

const currentMessages = computed(() => {
  return history.value[currentDateStr.value] || [];
});

const unreadCount = computed(() => {
  const reads = threadReadAt.value || {};
  const threads = allThreads.value.filter(
    (t) => t.threadType !== 'assistant' && t.threadType !== 'system',
  );
  let c = 0;
  for (const t of threads) {
    const last = reads[t.id];
    if (!last) {
      c += 1;
      continue;
    }
    if (new Date(t.updatedAt).getTime() > new Date(last).getTime()) {
      c += 1;
    }
  }
  return c;
});

const unreadDisplay = computed(() => {
  const c = unreadCount.value;
  return c > 99 ? '99+' : String(c);
});

const loadData = async () => {
  steps.value = await agentService.getWorkflowSteps();
  try {
    activeWorkflows.value = await agentService.getActiveWorkflows(
      currentDateStr.value,
    );
  } catch (error) {
    // keep empty on failure
  }

  if (currentSessionId.value) {
    isLoadingHistory.value = true;
    try {
      const messages = await agentService.getGroupHistory(
        currentSessionId.value,
      );
      history.value = {
        [currentDateStr.value]: messages,
      };
      nextTick(() => {
        scrollToBottom();
      });
    } catch (error) {
      console.error('Failed to load session history on mount:', error);
    } finally {
      isLoadingHistory.value = false;
    }
  } else {
    history.value = {};
  }
};

const refreshActiveWorkflows = async () => {
  try {
    activeWorkflows.value = await agentService.getActiveWorkflows(
      currentDateStr.value,
    );
  } catch (error) {
    // ignore
  }
};

const loadByTab = (tab: 'chat' | 'contacts' | 'daily') => {
  if (tab === 'chat') {
    loadThreads();
    // Load candidates for mentions
    loadContacts();
    loadAiAgents();
  } else if (tab === 'contacts') {
    loadContacts();
    loadAiAgents();
  } else if (tab === 'daily') {
    loadDailyReports();
  }
};

onMounted(() => {
  loadData();
  loadByTab(activeTab.value);
});

watch(onlyAi, () => {
  loadThreads();
});

watch(searchQuery, () => {
  loadThreads();
});

const adjustHeight = () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
    textareaRef.value.style.height = textareaRef.value.scrollHeight + 'px';
  }
};

const handleEnter = (e: KeyboardEvent) => {
  if (!e.shiftKey) {
    sendMessage();
  }
};

const onInputSend = (payload: { text: string; attachments: Attachment[] }) => {
  inputMessage.value = payload.text;
  attachedFiles.value = payload.attachments.map((a) => ({
    file: a.file,
    preview: a.preview,
  }));
  sendMessage();
};

const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
};

const upsertToolCall = (
  message: ChatMessage,
  data: {
    id?: string;
    name?: string;
    argsText?: string;
    resultText?: string;
    status?: ToolCall['status'];
  },
) => {
  const toolId = data.id ?? data.name ?? `tool_${Date.now()}`;
  if (!message.tool_calls) {
    message.tool_calls = [];
  }
  let target = message.tool_calls.find((t) => t.id === toolId);
  if (!target) {
    target = {
      id: toolId,
      name: data.name ?? 'tool',
      arguments: data.argsText ?? '',
      status: data.status ?? ToolCallStatus.Calling,
    };
    message.tool_calls.push(target);
  }
  if (data.argsText !== undefined) {
    target.arguments = data.argsText;
  }
  if (data.resultText !== undefined) {
    target.result = data.resultText;
  }
  if (data.status) {
    target.status = data.status;
  }
};

const sendMessage = async () => {
  if (
    (!inputMessage.value.trim() && attachedFiles.value.length === 0) ||
    isProcessing.value
  )
    return;

  const extractMentions = (text: string): string[] => {
    const out: string[] = [];
    const push = (s?: string) => {
      const v = (s || '').trim();
      if (v) out.push(v);
    };
    const patterns: RegExp[] = [
      /@\"([^\"]+?)\"/g,
      /@\'([^\']+?)\'/g,
      /@(?:「|《)(.+?)(?:」|》)/g,
      /@([\u4e00-\u9fa5A-Za-z0-9_\-]+)/g,
    ];
    for (const re of patterns) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        push(m[1]);
      }
    }
    return Array.from(new Set(out.map((s) => s.toLowerCase())));
  };
  let targetThreadId: string | null = null;
  let targetThreadIds: string[] = [];
  const mentions = extractMentions(inputMessage.value);
  if (!currentSessionId.value && mentions.length) {
    const candidates = allThreads.value.filter((t) => {
      const title = (t.title || '').toLowerCase();
      return mentions.some((m) => title.includes(m));
    });
    const sorted = candidates
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        const ta = new Date(a.updatedAt).getTime();
        const tb = new Date(b.updatedAt).getTime();
        return tb - ta;
      })
      .sort((a, b) => {
        const pa =
          a.threadType === 'assistant' || a.threadType === 'dm' ? 0 : 1;
        const pb =
          b.threadType === 'assistant' || b.threadType === 'dm' ? 0 : 1;
        return pa - pb;
      });
    if (sorted.length) {
      const pick = sorted[0];
      targetThreadId = pick.id;
      targetThreadIds = sorted.map((t) => t.id);
      store.setCurrentSession(pick.id, pick.title || '');
      mode.value = 'chat';
      if (sorted.length > 1) {
        const ui = useUIStore();
        const names = sorted
          .slice(0, 3)
          .map((t) => t.title || t.id)
          .join(', ');
        ui.showToast(`命中多个会话：${names}；将依次路由至相关会话`, 'info');
      }
    }
  }

  const today = currentDateStr.value;
  const now = Date.now();

  const attachmentsMd = attachedFiles.value
    .map((f, i) => `![attachment-${i + 1}](${f.preview})`)
    .join('\n\n');
  const combinedContent = attachmentsMd
    ? `${inputMessage.value}\n\n${attachmentsMd}`
    : inputMessage.value;
  const userMsg: ChatMessage = {
    id: now.toString(),
    role: ChatRole.User,
    content: combinedContent,
    timestamp: now,
  };

  if (!history.value[today]) {
    history.value[today] = [];
  }
  history.value[today].push(userMsg);

  const assistantMsg: ChatMessage = {
    id: `${now}_assistant`,
    role: ChatRole.Assistant,
    content: '',
    timestamp: now + 1,
    tool_calls: [],
  };
  history.value[today].push(assistantMsg);
  currentAssistantMessageId.value = assistantMsg.id;

  inputMessage.value = '';
  attachedFiles.value = [];
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
  }

  isProcessing.value = true;
  // If starting a new session, show loading state for title
  if (!currentSessionId.value) {
    isTitleLoading.value = true;
  }
  scrollToBottom();

  const callbacks: AgentStreamCallbacks = {
    onToken: (text, sessionId) => {
      if (sessionId && !currentSessionId.value) {
        currentSessionId.value = sessionId;
      }
      const messages = history.value[today] || [];
      const target = messages.find(
        (m) => m.id === currentAssistantMessageId.value,
      );
      if (!target) return;
      target.content += text;
      scrollToBottom();
    },
    onToolStart: (data, sessionId) => {
      if (sessionId && !currentSessionId.value) {
        currentSessionId.value = sessionId;
      }
      const messages = history.value[today] || [];
      const target = messages.find(
        (m) => m.id === currentAssistantMessageId.value,
      );
      if (!target) return;
      let argsText = '';
      if (data.input !== undefined) {
        try {
          argsText = JSON.stringify(data.input, null, 2);
        } catch (e) {
          argsText = String(data.input);
        }
      }
      upsertToolCall(target, {
        id: data.id,
        name: data.name,
        argsText,
        status: ToolCallStatus.Calling,
      });
    },
    onToolChunk: (data, sessionId) => {
      if (sessionId && !currentSessionId.value) {
        currentSessionId.value = sessionId;
      }
      const messages = history.value[today] || [];
      const target = messages.find(
        (m) => m.id === currentAssistantMessageId.value,
      );
      if (!target) return;
      if (data.args === undefined) return;
      let argsText = '';
      try {
        argsText = JSON.stringify(data.args, null, 2);
      } catch (e) {
        argsText = String(data.args);
      }
      upsertToolCall(target, {
        id: data.id,
        name: data.name,
        argsText,
        status: ToolCallStatus.Calling,
      });
    },
    onToolEnd: (data, sessionId) => {
      if (sessionId && !currentSessionId.value) {
        currentSessionId.value = sessionId;
      }
      const messages = history.value[today] || [];
      const target = messages.find(
        (m) => m.id === currentAssistantMessageId.value,
      );
      if (!target) return;
      let resultText = '';
      if (data.output !== undefined) {
        try {
          resultText = JSON.stringify(data.output, null, 2);
        } catch (e) {
          resultText = String(data.output);
        }
      }
      upsertToolCall(target, {
        id: data.id,
        name: data.name,
        resultText,
        status: ToolCallStatus.Completed,
      });
    },
    onDone: (sessionId) => {
      if (sessionId && !currentSessionId.value) {
        currentSessionId.value = sessionId;
      }
      isProcessing.value = false;
      refreshActiveWorkflows();
      scrollToBottom();
    },
    onError: (error, sessionId) => {
      if (sessionId && !currentSessionId.value) {
        currentSessionId.value = sessionId;
      }
      isProcessing.value = false;

      const uiStore = useUIStore();
      uiStore.showToast(`Chat Error: ${error}`, 'error');

      const errorMsg: ChatMessage = {
        id: `error_${Date.now()}`,
        role: ChatRole.Assistant,
        content: `Error: ${error}`,
        timestamp: Date.now(),
      };
      if (!history.value[today]) {
        history.value[today] = [];
      }
      history.value[today].push(errorMsg);
      scrollToBottom();
    },
    onSessionGroup: (data, sessionId) => {
      if (data.sessionGroupId) {
        currentSessionId.value = data.sessionGroupId;
        refreshActiveWorkflows();
      }
    },
    onSessionGroupTitle: (data, sessionId) => {
      // Update title if it belongs to current session group
      if (data.sessionGroupId === currentSessionId.value) {
        currentSessionTitle.value = data.title;
        isTitleLoading.value = false;
      }
    },
  };

  const threadIds = currentSessionId.value
    ? [currentSessionId.value]
    : targetThreadIds.length
      ? targetThreadIds
      : targetThreadId
        ? [targetThreadId]
        : [];
  if (threadIds.length > 0) {
    const runNext = (index: number) => {
      const seqCallbacks: AgentStreamCallbacks = {
        onToken: callbacks.onToken,
        onReasoning: callbacks.onReasoning,
        onToolStart: callbacks.onToolStart,
        onToolChunk: callbacks.onToolChunk,
        onToolEnd: callbacks.onToolEnd,
        onSessionGroup: callbacks.onSessionGroup,
        onSessionGroupTitle: callbacks.onSessionGroupTitle,
        onDone: (sessionId?: string) => {
          callbacks.onDone?.(sessionId);
          if (index + 1 < threadIds.length) {
            isProcessing.value = true;
            runNext(index + 1);
          }
        },
        onError: (error: string, sessionId?: string) => {
          callbacks.onError?.(error, sessionId);
          if (index + 1 < threadIds.length) {
            isProcessing.value = true;
            runNext(index + 1);
          }
        },
      };
      agentSocketService.startThreadChat(
        {
          threadId: threadIds[index],
          message: userMsg.content,
          stream: true,
        },
        seqCallbacks,
      );
    };
    runNext(0);
  } else {
    agentSocketService.startChat(
      {
        message: userMsg.content,
        sessionId: currentSessionId.value,
        chatClientId: chatClientId.value,
        stream: true,
        threadType: 'group',
      },
      callbacks,
    );
  }
};

// File Attachment Logic
const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    Array.from(input.files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          attachedFiles.value.push({
            file,
            preview: e.target?.result as string,
          });
        };
        reader.readAsDataURL(file);
      }
    });
  }
  // Reset input so same file can be selected again
  input.value = '';
};

const removeAttachment = (index: number) => {
  attachedFiles.value.splice(index, 1);
};

const handlePaste = (event: ClipboardEvent) => {
  const items = event.clipboardData?.items;
  if (items) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            attachedFiles.value.push({
              file,
              preview: e.target?.result as string,
            });
          };
          reader.readAsDataURL(file);
          event.preventDefault(); // Prevent pasting the file name
        }
      }
    }
  }
};

// Voice Logic
const toggleRecording = () => {
  isRecording.value = !isRecording.value;
  if (isRecording.value) {
    // Simulate voice input start
    setTimeout(() => {
      if (isRecording.value) {
        inputMessage.value = 'Hello, how are you today?';
        adjustHeight();
        isRecording.value = false;
      }
    }, 3000);
  }
};

const loadThreads = async () => {
  try {
    const params: { ai?: boolean; q?: string } = {};
    if (onlyAi.value) params.ai = true;
    const q = (searchQuery.value || '').trim();
    if (q) params.q = q;
    const list = await agentService.getThreadList(params);
    allThreads.value = list || [];
  } catch (e) {
    allThreads.value = [];
  }
};

const loadContacts = async () => {
  try {
    const list = await agentService.getContacts();
    allContacts.value = list || [];
  } catch (e) {
    allContacts.value = [];
  }
};

const loadAiAgents = async () => {
  try {
    const agents = await agentService.getAgents();
    const items: ThreadListItem[] = (agents || []).map((a) => ({
      id: `agent:${a.id}`,
      title: a.nickname,
      chatClientId: null,
      threadType: 'assistant',
      isPinned: false,
      isAiInvolved: true,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));
    aiAgentItems.value = items;
  } catch (e) {
    aiAgentItems.value = [];
  }
};

const showProfile = ref(false);
const currentProfile = ref<ThreadListItem | null>(null);

const { toggleCategory } = panelStore;

const contactGroups = computed(() => {
  const q = contactSearchQuery.value.toLowerCase();
  const filterFn = (t: ThreadListItem) =>
    !q || (t.title || '').toLowerCase().includes(q);

  const assistants = aiAgentItems.value.filter(filterFn);
  const groups = allThreads.value
    .filter((t) => t.threadType === 'group')
    .filter(filterFn);
  const contacts = allContacts.value.filter(filterFn);

  return [
    {
      id: 'ai-agents',
      name: t('contacts.aiAgents'),
      count: assistants.length,
      items: assistants,
    },
    {
      id: 'group-chats',
      name: t('contacts.groupChats'),
      count: groups.length,
      items: groups,
    },
    {
      id: 'contacts',
      name: t('contacts.allContacts'),
      count: contacts.length,
      items: contacts,
    },
  ];
});

const mentionCandidates = computed(() => {
  const markKind = (kind: 'agent' | 'contact') => (x: ThreadListItem) => ({
    kind,
    item: x,
  });
  const agents = aiAgentItems.value.map(markKind('agent'));
  const contacts = allContacts.value.map(markKind('contact'));
  const combined = [...agents, ...contacts];
  combined.sort((a, b) => {
    const sa = a.kind === 'agent' ? 0 : 1;
    const sb = b.kind === 'agent' ? 0 : 1;
    if (sa !== sb) return sa - sb;
    const ta = (a.item.title || '').toLowerCase();
    const tb = (b.item.title || '').toLowerCase();
    return ta.localeCompare(tb);
  });
  return combined.map(({ item }) => ({
    id: item.id,
    title: item.title,
    chatClientId: item.chatClientId,
    threadType: item.threadType,
    isPinned: item.isPinned,
    isAiInvolved: item.isAiInvolved,
    workflowStatus: item.workflowStatus,
    lastMessage: item.lastMessage,
    members: item.members,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
});

const currentThread = computed(() => {
  return allThreads.value.find((t) => t.id === currentSessionId.value);
});

const openProfile = (t: ThreadListItem) => {
  currentProfile.value = t;
  showProfile.value = true;
};

const closeProfile = () => {
  showProfile.value = false;
  currentProfile.value = null;
};

const newMemberName = ref<string>('');

const refreshCurrentProfile = () => {
  if (!currentProfile.value) return;
  const updated = allThreads.value.find(
    (x) => x.id === currentProfile.value!.id,
  );
  if (updated) currentProfile.value = updated;
};

const addMemberToCurrentThread = async () => {
  const profile = currentProfile.value;
  const name = (newMemberName.value || '').trim();
  if (!profile || !name || profile.threadType !== 'group') return;
  const existing = profile.members || [];
  if (existing.includes(name)) {
    const ui = useUIStore();
    ui.showToast('成员已存在', 'info');
    return;
  }
  const participants = [...existing, name].map((n) => ({ id: n, name: n }));
  try {
    await agentService.updateThread(profile.id, { participants });
    await loadThreads();
    refreshCurrentProfile();
    newMemberName.value = '';
    const ui = useUIStore();
    ui.showToast('成员已添加', 'success');
  } catch (e) {
    const ui = useUIStore();
    ui.showToast('添加成员失败', 'error');
  }
};

const removeMemberFromCurrentThread = async (member: string) => {
  const profile = currentProfile.value;
  if (!profile || profile.threadType !== 'group') return;
  const existing = profile.members || [];
  const next = existing.filter((m) => m !== member);
  const participants = next.map((n) => ({ id: n, name: n }));
  try {
    await agentService.updateThread(profile.id, { participants });
    await loadThreads();
    refreshCurrentProfile();
    const ui = useUIStore();
    ui.showToast('成员已移除', 'success');
  } catch (e) {
    const ui = useUIStore();
    ui.showToast('移除成员失败', 'error');
  }
};

const displayThreads = computed(() => {
  let threads = allThreads.value;
  if (onlyAi.value) {
    threads = threads.filter((t) => t.isAiInvolved);
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    threads = threads.filter((t) => (t.title || '').toLowerCase().includes(q));
  }

  const assistantThreads = threads.filter((t) => t.threadType === 'assistant');
  const systemThreads = threads.filter((t) => t.threadType === 'system');
  const pinned = threads.filter(
    (t) =>
      t.isPinned && t.threadType !== 'assistant' && t.threadType !== 'system',
  );
  const others = threads.filter(
    (t) =>
      !t.isPinned && t.threadType !== 'assistant' && t.threadType !== 'system',
  );

  pinned.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  others.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const nowIso = new Date().toISOString();
  const azureItem: ThreadListItem =
    assistantThreads.length > 0
      ? { ...assistantThreads[0], isPinned: true }
      : {
          id: 'fixed:assistant',
          title: t('chat.assistantTitle'),
          chatClientId: null,
          threadType: 'assistant',
          isPinned: true,
          isAiInvolved: true,
          lastMessage: t('chat.emptyState'),
          createdAt: nowIso,
          updatedAt: nowIso,
        };

  const systemItem: ThreadListItem =
    systemThreads.length > 0
      ? { ...systemThreads[0], isPinned: true }
      : {
          id: 'fixed:system',
          title: t('chat.systemNotification'),
          chatClientId: null,
          threadType: 'system',
          isPinned: true,
          isAiInvolved: false,
          lastMessage: '',
          createdAt: nowIso,
          updatedAt: nowIso,
        };

  const workflowItem: ThreadListItem = {
    id: 'fixed:workflow',
    title: t('chat.workflowAssistant'),
    threadType: 'system',
    isPinned: true,
    isAiInvolved: false,
    lastMessage:
      activeWorkflows.value.length > 0
        ? t('chat.activeWorkflows', { count: activeWorkflows.value.length })
        : t('chat.noActiveWorkflows'),
    createdAt: nowIso,
    updatedAt: nowIso,
    chatClientId: null,
    workflowStatus: activeWorkflows.value.length > 0 ? 'running' : 'idle',
  };

  return [azureItem, workflowItem, systemItem, ...pinned, ...others];
});

const isChatSettingsOpen = ref(false);
const isCreateMenuOpen = ref(false);
const settingsTitle = ref<string>('');
const settingsType = ref<'assistant' | 'system' | 'todo' | 'group' | 'dm'>(
  'group',
);
const settingsAi = ref<boolean>(false);
const settingsMembersText = ref<string>('');

// Swipe Logic State
const swipedThreadId = ref<string | null>(null);
const startX = ref(0);
const startY = ref(0);
const isSwiping = ref(false);
const justSwiped = ref(false); // Flag to prevent click after swipe

const handleTouchStart = (e: MouseEvent | TouchEvent) => {
  const touch = 'touches' in e ? e.touches[0] : e;
  startX.value = touch.clientX;
  startY.value = touch.clientY;
  isSwiping.value = true;
};

const handleTouchEnd = (e: MouseEvent | TouchEvent, thread: ThreadListItem) => {
  if (!isSwiping.value) return;

  const touch = 'changedTouches' in e ? e.changedTouches[0] : (e as MouseEvent);
  const diffX = touch.clientX - startX.value;
  const diffY = touch.clientY - startY.value;

  // Check if horizontal swipe (X diff > Y diff and X diff > threshold)
  // Threshold 30px
  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
    justSwiped.value = true;
    setTimeout(() => {
      justSwiped.value = false;
    }, 300);

    if (diffX < 0) {
      // Swipe Left -> Open
      swipedThreadId.value = thread.id;
    } else {
      // Swipe Right -> Close
      if (swipedThreadId.value === thread.id) {
        swipedThreadId.value = null;
      }
    }
  }
  isSwiping.value = false;
};

const handleItemClick = (thread: ThreadListItem) => {
  if (justSwiped.value) {
    justSwiped.value = false;
    return;
  }

  if (swipedThreadId.value === thread.id) {
    // If swiped open, close it on click
    swipedThreadId.value = null;
  } else if (swipedThreadId.value !== null) {
    // If another is open, close it
    swipedThreadId.value = null;
  } else {
    if (thread.id === 'workflow_monitor' || thread.id === 'fixed:workflow') {
      showWorkflowMonitor.value = true;
    } else if (thread.id.startsWith('agent:')) {
      enterThread(thread);
    } else {
      enterThread(thread);
    }
  }
};

const togglePin = async (t: ThreadListItem) => {
  if (
    t.id.startsWith('fixed:') ||
    t.threadType === 'assistant' ||
    t.threadType === 'system'
  ) {
    return;
  }
  t.isPinned = !t.isPinned;
  try {
    await agentService.updateThread(t.id, { isPinned: t.isPinned });
    await loadThreads();
  } finally {
    isChatSettingsOpen.value = false;
    swipedThreadId.value = null;
  }
};

const deleteThread = async (t: ThreadListItem) => {
  if (
    t.id.startsWith('fixed:') ||
    t.threadType === 'assistant' ||
    t.threadType === 'system'
  ) {
    return;
  }
  if (confirm('确定要删除该对话吗？')) {
    try {
      await agentService.deleteGroup(t.id);
      await loadThreads();
      if (currentSessionId.value === t.id) {
        mode.value = 'home';
        currentSessionId.value = undefined;
      }
    } finally {
      if (swipedThreadId.value === t.id) {
        swipedThreadId.value = null;
      }
    }
  }
};

watch(isChatSettingsOpen, (val) => {
  if (!val) return;
  const t = allThreads.value.find((x) => x.id === currentSessionId.value);
  settingsTitle.value = t?.title ?? '';
  settingsType.value = t?.threadType ?? 'group';
  settingsAi.value = !!t?.isAiInvolved;
  const members = t?.members ?? [];
  settingsMembersText.value = members.join(',');
});

const applyThreadSettings = async () => {
  const id = currentSessionId.value;
  if (!id) return;
  const participants = settingsMembersText.value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((name) => ({ id: name, name }));
  await agentService.updateThread(id, {
    title: settingsTitle.value || null,
    threadType: settingsType.value,
    isAiInvolved: settingsAi.value,
    participants,
  });
  await loadThreads();
  isChatSettingsOpen.value = false;
};

const createThreadOfType = async (
  type: 'assistant' | 'system' | 'todo' | 'group' | 'dm',
) => {
  const res = await agentService.createThread({
    title: null,
    chatClientId: chatClientId.value,
    threadType: type,
    isAiInvolved: type === 'assistant',
  });
  await loadThreads();
  store.setCurrentSession(res.id, '');
  mode.value = 'chat';
  isTitleLoading.value = true;
  const messages = await agentService.getGroupHistory(res.id);
  history.value = { [currentDateStr.value]: messages };
};

const createNewThread = async () => {
  const res = await agentService.createThread({
    chatClientId: chatClientId.value,
    threadType: 'group',
    isAiInvolved: false,
  });
  await loadThreads();
  store.setCurrentSession(res.id, '');
  mode.value = 'chat';
  isTitleLoading.value = true;
  const messages = await agentService.getGroupHistory(res.id);
  history.value = { [currentDateStr.value]: messages };
};

const enterThread = async (t: ThreadListItem) => {
  if (t.id.startsWith('contact:')) {
    const principalId = t.id.substring('contact:'.length);
    const created = await agentService.startDmForPrincipal({
      id: principalId,
      displayName: t.title || principalId,
    });
    await loadThreads();
    store.setCurrentSession(created.id, t.title ?? '');
    mode.value = 'chat';
    isTitleLoading.value = true;
    const messages = await agentService.getGroupHistory(created.id);
    history.value = { [currentDateStr.value]: messages };
    store.markThreadRead(created.id, new Date().toISOString());
  } else if (t.id === 'fixed:assistant') {
    const existing = allThreads.value.find((x) => x.threadType === 'assistant');
    if (existing) {
      store.setCurrentSession(existing.id, existing.title ?? '');
      mode.value = 'chat';
      isTitleLoading.value = false;
      isLoadingHistory.value = true;
      try {
        const messages = await agentService.getGroupHistory(existing.id);
        history.value = { [currentDateStr.value]: messages };
        nextTick(() => {
          scrollToBottom();
        });
      } finally {
        isLoadingHistory.value = false;
      }
    } else {
      const created = await agentService.createThread({
        threadType: 'assistant',
        isPinned: true,
      });
      await loadThreads();
      store.setCurrentSession(created.id, t.title ?? '');
      mode.value = 'chat';
      isTitleLoading.value = true;
      const messages = await agentService.getGroupHistory(created.id);
      history.value = { [currentDateStr.value]: messages };
    }
  } else if (t.id === 'fixed:system') {
    const existing = allThreads.value.find((x) => x.threadType === 'system');
    if (existing) {
      store.setCurrentSession(existing.id, existing.title ?? '');
      mode.value = 'chat';
      isTitleLoading.value = false;
      isLoadingHistory.value = true;
      try {
        const messages = await agentService.getGroupHistory(existing.id);
        history.value = { [currentDateStr.value]: messages };
        nextTick(() => {
          scrollToBottom();
        });
      } finally {
        isLoadingHistory.value = false;
      }
    } else {
      const created = await agentService.createThread({
        threadType: 'system',
        isPinned: true,
      });
      await loadThreads();
      store.setCurrentSession(created.id, t.title ?? '');
      mode.value = 'chat';
      isTitleLoading.value = true;
      const messages = await agentService.getGroupHistory(created.id);
      history.value = { [currentDateStr.value]: messages };
    }
  } else if (t.id.startsWith('agent:')) {
    const created = await agentService.createThread({
      title: t.title || null,
      chatClientId: chatClientId.value,
      threadType: 'group',
      isPinned: false,
      isAiInvolved: true,
    });
    await loadThreads();
    store.setCurrentSession(created.id, t.title ?? '');
    mode.value = 'chat';
    isTitleLoading.value = true;
    const messages = await agentService.getGroupHistory(created.id);
    history.value = { [currentDateStr.value]: messages };
    store.markThreadRead(created.id, new Date().toISOString());
  } else {
    store.setCurrentSession(t.id, t.title ?? '');
    mode.value = 'chat';
    isTitleLoading.value = false;
    isLoadingHistory.value = true;
    try {
      const messages = await agentService.getGroupHistory(t.id);
      history.value = { [currentDateStr.value]: messages };
      nextTick(() => {
        scrollToBottom();
      });
    } finally {
      isLoadingHistory.value = false;
    }
    store.markThreadRead(t.id, new Date().toISOString());
  }
};

const threadIcon = (t: ThreadListItem) => {
  if (t.id === 'workflow_monitor' || t.id === 'fixed:workflow')
    return 'fa-gears';
  if (t.threadType === 'assistant') return 'fa-robot';
  if (t.threadType === 'system') return 'fa-bell';
  if (t.threadType === 'todo') return 'fa-list-check';
  if (t.threadType === 'dm') return 'fa-user';
  return 'fa-users';
};

const getAvatarClass = (t: ThreadListItem) => {
  if (t.id === 'workflow_monitor' || t.id === 'fixed:workflow')
    return 'bg-blue-100 text-blue-600';
  switch (t.threadType) {
    case 'assistant':
      return 'bg-blue-500';
    case 'system':
      return 'bg-orange-500';
    case 'group':
      return 'bg-green-500';
    case 'dm':
      return 'bg-indigo-500';
    case 'todo':
      return 'bg-purple-500';
    default:
      return 'bg-gray-400';
  }
};

const threadLabel = (t: ThreadListItem) => {
  if (t.threadType === 'assistant') return 'AI 助手';
  if (t.threadType === 'system') return '系统通知';
  if (t.threadType === 'todo') return '待办通知';
  if (t.threadType === 'dm') return '私聊';
  return '群聊';
};

const formatDate = (s: string) => {
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
};

const formatDateSimple = (s: string) => {
  const d = new Date(s);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}月${day}日`;
};

const getWeekDay = (s: string) => {
  const d = new Date(s);
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days[d.getDay()];
};

const formatTime = (s: string) => {
  const d = new Date(s);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #e5e7eb;
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #d1d5db;
}

.markdown-body :deep(p) {
  margin-bottom: 0.5em;
}
.markdown-body :deep(pre) {
  background-color: #0d1117;
  padding: 1em;
  border-radius: 0.5em;
  overflow-x: auto;
  color: #c9d1d9;
}
.markdown-body :deep(code) {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
  font-size: 0.85em;
}

@keyframes voice-wave {
  0%,
  100% {
    height: 40%;
  }
  50% {
    height: 100%;
  }
}
.animate-voice-wave {
  animation: voice-wave 0.5s ease-in-out infinite;
}

@keyframes fade-in-right {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
.animate-fade-in-right {
  animation: fade-in-right 0.3s ease-out;
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in-up {
  animation: fade-in-up 0.3s ease-out forwards;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.animate-fade-in {
  animation: fade-in 0.5s ease-in-out forwards;
}
</style>
