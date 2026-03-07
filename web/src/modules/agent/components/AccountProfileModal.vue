<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div
      class="absolute inset-0 bg-black/30 backdrop-blur-sm"
      @click="$emit('close')"
    ></div>
    <div
      class="relative bg-white rounded-2xl shadow-xl w-[520px] max-w-[95vw] border border-gray-200 flex flex-col max-h-[85vh]"
    >
      <div
        class="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
      >
        <div>
          <h3 class="text-lg font-bold text-gray-900">账户信息</h3>
          <p class="text-sm text-gray-500">编辑个人资料与登录密码</p>
        </div>
        <button class="text-gray-400 hover:text-gray-700" @click="$emit('close')">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <div class="flex items-center gap-4">
          <div
            class="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center"
          >
            <img
              v-if="form.avatarUrl"
              :src="resolveResourceUrl(form.avatarUrl)"
              class="w-full h-full object-cover"
            />
            <span v-else class="text-sm font-semibold text-gray-600">
              {{ initials }}
            </span>
          </div>
          <div>
            <button
              class="px-3 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
              @click="showAvatarModal = true"
            >
              更换头像
            </button>
            <div v-if="uploading" class="text-xs text-gray-500 mt-1">
              上传中 {{ progress.percent }}%
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >显示名称</label
            >
            <input
              v-model="form.displayName"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="请输入名称"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >邮箱</label
            >
            <input
              v-model="form.email"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >手机号</label
            >
            <input
              v-model="form.phone"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="请输入手机号"
            />
          </div>
        </div>

        <div class="pt-2 border-t border-gray-100">
          <h4 class="text-sm font-semibold text-gray-700 mb-3">修改密码</h4>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >当前密码</label
              >
              <input
                v-model="passwordForm.currentPassword"
                type="password"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                placeholder="请输入当前密码"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >新密码</label
              >
              <input
                v-model="passwordForm.nextPassword"
                type="password"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                placeholder="至少 6 位"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >确认新密码</label
              >
              <input
                v-model="passwordForm.confirmPassword"
                type="password"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                placeholder="再次输入新密码"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
        <button
          class="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          @click="$emit('close')"
        >
          取消
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
          @click="saveProfile"
          :disabled="saving"
        >
          保存资料
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          @click="changePassword"
          :disabled="saving"
        >
          更新密码
        </button>
      </div>
    </div>
  </div>

    <SquareAvatarCropModal
      v-if="showAvatarModal"
      @close="showAvatarModal = false"
      @confirm="onAvatarConfirm"
    />
  </Teleport>
</template>

<script setup lang="ts">
/**
 * @title Account Profile Modal
 * @description 登录用户资料与密码编辑弹窗。
 * @keywords-cn 用户资料, 密码修改, 账户设置
 * @keywords-en account-profile, password-change, account-settings
 */
import { computed, reactive, ref } from 'vue';
import { useAuthStore } from '../../auth/store/auth.store';
import { usePrincipals } from '../../identity/hooks/usePrincipals';
import { useUIStore } from '../store/ui.store';
import {
  SquareAvatarCropModal,
  useResourceUpload,
} from '../../resource/resource.module';
import { resolveResourceUrl } from '../../../utils/http';
import { authService } from '../../auth/services/auth.service';

defineEmits<{
  (e: 'close'): void;
}>();

const authStore = useAuthStore();
const ui = useUIStore();
const { updateUser } = usePrincipals();
const { uploading, progress, upload: uploadResource } = useResourceUpload();

const form = reactive({
  displayName: authStore.principal?.displayName || '',
  email: authStore.principal?.email || '',
  phone: authStore.principal?.phone || '',
  avatarUrl: authStore.principal?.avatarUrl || null,
});

const passwordForm = reactive({
  currentPassword: '',
  nextPassword: '',
  confirmPassword: '',
});

const saving = ref(false);
const showAvatarModal = ref(false);

const initials = computed(() => {
  const name = form.displayName?.trim() || 'U';
  return name.slice(0, 2).toUpperCase();
});

async function onAvatarConfirm(file: File) {
  try {
    const res = await uploadResource(file);
    form.avatarUrl = res.data.path;
    showAvatarModal.value = false;
  } catch (e) {
    console.error(e);
    ui.showToast('头像上传失败', 'error');
  }
}

async function saveProfile() {
  const principalId = authStore.principal?.id?.trim();
  if (!principalId) {
    ui.showToast('未找到登录信息', 'error');
    return;
  }
  try {
    saving.value = true;
    await updateUser(principalId, {
      displayName: form.displayName,
      email: form.email,
      phone: form.phone || null,
      avatarUrl: form.avatarUrl,
    });
    authStore.updatePrincipal({
      displayName: form.displayName,
      email: form.email,
      phone: form.phone || null,
      avatarUrl: form.avatarUrl,
    });
    ui.showToast('资料已更新', 'success');
  } catch (e) {
    console.error(e);
    ui.showToast('资料更新失败', 'error');
  } finally {
    saving.value = false;
  }
}

async function changePassword() {
  const current = passwordForm.currentPassword.trim();
  const next = passwordForm.nextPassword.trim();
  const confirm = passwordForm.confirmPassword.trim();
  if (!current || !next) {
    ui.showToast('请输入完整密码信息', 'error');
    return;
  }
  if (next.length < 6) {
    ui.showToast('新密码至少 6 位', 'error');
    return;
  }
  if (next !== confirm) {
    ui.showToast('两次密码输入不一致', 'error');
    return;
  }
  try {
    saving.value = true;
    await authService.changePassword({
      currentPassword: current,
      nextPassword: next,
    });
    passwordForm.currentPassword = '';
    passwordForm.nextPassword = '';
    passwordForm.confirmPassword = '';
    ui.showToast('密码已更新', 'success');
  } catch (e) {
    console.error(e);
    ui.showToast('密码更新失败', 'error');
  } finally {
    saving.value = false;
  }
}
</script>
