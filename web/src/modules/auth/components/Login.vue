<template>
  <div
    class="min-h-screen flex items-center justify-center bg-gray-50 overflow-hidden relative font-sans"
  >
    <!-- Background: Waterfall Parallelograms -->
    <div
      class="absolute inset-0 z-0 overflow-hidden flex gap-6 transform -skew-x-12 scale-110 -ml-20"
    >
      <!-- Column 1 -->
      <div class="flex-1 flex flex-col gap-6 -mt-20 opacity-40">
        <div
          class="h-64 bg-gray-200 rounded-2xl bg-cover bg-center transition-all duration-700"
          style="
            background-image: url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=800&auto=format&fit=crop');
          "
        ></div>
        <div
          class="h-96 bg-gray-200 rounded-2xl bg-cover bg-center transition-all duration-700"
          style="
            background-image: url('https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=800&auto=format&fit=crop');
          "
        ></div>
        <div
          class="h-64 bg-gray-200 rounded-2xl bg-cover bg-center transition-all duration-700"
          style="
            background-image: url('https://images.unsplash.com/photo-1449824913929-2b3a641cc530?q=80&w=800&auto=format&fit=crop');
          "
        ></div>
      </div>
      <!-- Column 2 (Offset) -->
      <div class="flex-1 flex flex-col gap-6 -mt-40 opacity-50">
        <div
          class="h-80 bg-gray-200 rounded-2xl bg-cover bg-center transition-all duration-700"
          style="
            background-image: url('https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=800&auto=format&fit=crop');
          "
        ></div>
        <div
          class="h-72 bg-gray-200 rounded-2xl bg-cover bg-center transition-all duration-700"
          style="
            background-image: url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=800&auto=format&fit=crop');
          "
        ></div>
        <div
          class="h-96 bg-gray-200 rounded-2xl bg-cover bg-center transition-all duration-700"
          style="
            background-image: url('https://images.unsplash.com/photo-1511818966892-d7d671e672a2?q=80&w=800&auto=format&fit=crop');
          "
        ></div>
      </div>
      <!-- Column 3 -->
      <div class="flex-1 flex flex-col gap-6 -mt-10 opacity-30 md:flex">
        <div
          class="h-56 bg-gray-200 rounded-2xl bg-cover bg-center transition-all duration-700"
          style="
            background-image: url('https://images.unsplash.com/photo-1493246507139-91e8fad9978e?q=80&w=800&auto=format&fit=crop');
          "
        ></div>
        <div
          class="h-80 bg-gray-200 rounded-2xl bg-cover bg-center transition-all duration-700"
          style="
            background-image: url('https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=800&auto=format&fit=crop');
          "
        ></div>
        <div
          class="h-64 bg-gray-200 rounded-2xl bg-cover bg-center transition-all duration-700"
          style="
            background-image: url('https://images.unsplash.com/photo-1504681869696-d97721183f4b?q=80&w=800&auto=format&fit=crop');
          "
        ></div>
      </div>
      <!-- Column 4 -->
      <div class="flex-1 flex flex-col gap-6 -mt-32 opacity-20 lg:flex">
        <div
          class="h-96 bg-gray-200 rounded-2xl bg-cover bg-center transition-all duration-700"
          style="
            background-image: url('https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=800&auto=format&fit=crop');
          "
        ></div>
        <div
          class="h-64 bg-gray-200 rounded-2xl bg-cover bg-center transition-all duration-700"
          style="
            background-image: url('https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?q=80&w=800&auto=format&fit=crop');
          "
        ></div>
      </div>
    </div>

    <!-- Overlay Gradient -->
    <div
      class="absolute inset-0 z-0 bg-gradient-to-b from-white/80 via-white/60 to-white/90 backdrop-blur-[2px]"
    ></div>

    <!-- Language Switcher -->
    <div class="absolute top-6 right-6 z-20">
      <button
        @click="showLanguageModal = true"
        class="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border border-gray-200 shadow-sm hover:shadow-md transition-all text-sm font-medium text-gray-700 hover:text-black"
      >
        <i class="fa-solid fa-globe"></i>
        <span>{{ currentLocale === 'en' ? 'English' : '中文' }}</span>
      </button>
    </div>

    <!-- Login Card -->
    <div
      :class="[
        'relative z-10 w-full max-w-[440px] animate__animated',
        isExiting ? 'animate__fadeOutDown' : 'animate__fadeInUp animate__fast',
      ]"
    >
      <div
        class="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white p-10 md:p-12"
      >
        <div class="mb-10 text-center">
          <h1
            :class="[
              'text-2xl font-light text-gray-900 tracking-tight animate__animated',
              isExiting
                ? 'animate__fadeOutUp'
                : 'animate__fadeInDown animate__delay-1s',
            ]"
          >
            {{ t.welcome }}
          </h1>
          <div class="h-0.5 w-10 bg-black mx-auto mt-6 rounded-full"></div>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-6">
          <div
            :class="[
              'animate__animated group',
              isExiting
                ? 'animate__fadeOutLeft'
                : 'animate__fadeInLeft animate__delay-1s',
            ]"
          >
            <label
              class="block text-xs uppercase tracking-wider font-bold text-gray-400 mb-2 ml-1 transition-colors group-focus-within:text-black"
            >
              {{ t.account }}
            </label>
            <div class="relative">
              <input
                :value="form.account"
                type="text"
                required
                autocomplete="username"
                class="w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900 placeholder-gray-400 focus:border-black focus:ring-1 focus:ring-black focus:outline-none transition-all duration-300"
                :placeholder="t.accountPlaceholder"
                @input="handleAccountInput"
              />
            </div>
          </div>

          <div
            :class="[
              'animate__animated group',
              isExiting
                ? 'animate__fadeOutRight'
                : 'animate__fadeInRight animate__delay-1s',
            ]"
          >
            <label
              class="block text-xs uppercase tracking-wider font-bold text-gray-400 mb-2 ml-1 transition-colors group-focus-within:text-black"
            >
              {{ t.password }}
            </label>
            <div class="relative">
              <input
                :value="form.password"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="current-password"
                class="w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900 placeholder-gray-400 focus:border-black focus:ring-1 focus:ring-black focus:outline-none transition-all duration-300 pr-10"
                :placeholder="t.passwordPlaceholder"
                @input="handlePasswordInput"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-3.5 text-gray-400 hover:text-black focus:outline-none transition-colors"
              >
                <i
                  :class="
                    showPassword
                      ? 'fa-regular fa-eye-slash'
                      : 'fa-regular fa-eye'
                  "
                ></i>
              </button>
            </div>
          </div>

          <div
            v-if="error"
            class="text-red-600 text-sm text-center animate__animated animate__shakeX bg-red-50 py-2 rounded-lg"
          >
            {{ error }}
          </div>

          <div class="pt-2">
            <button
              type="submit"
              :disabled="loading"
              :class="[
                'w-full py-4 bg-black text-white text-lg font-medium rounded-xl hover:bg-gray-800 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-xl animate__animated flex justify-center items-center gap-3',
                isExiting
                  ? 'animate__fadeOutDown'
                  : 'animate__fadeInUp animate__delay-2s',
              ]"
            >
              <span
                v-if="loading"
                class="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"
              ></span>
              <span>{{ loading ? t.signingIn : t.signIn }}</span>
              <i v-if="!loading" class="fa-solid fa-arrow-right text-sm"></i>
            </button>
          </div>

          <!-- Social Login -->
          <div
            :class="[
              'pt-6 animate__animated',
              isExiting
                ? 'animate__fadeOutDown'
                : 'animate__fadeInUp animate__delay-2s',
            ]"
          >
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-200"></div>
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-white/80 backdrop-blur-xl text-gray-500">
                  {{ t.otherLogin }}
                </span>
              </div>
            </div>

            <div class="mt-6 flex justify-center gap-6">
              <button
                type="button"
                class="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 hover:border-gray-300 transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md group"
                title="Google"
              >
                <i
                  class="fa-brands fa-google text-gray-600 group-hover:text-red-500 text-xl"
                ></i>
              </button>
              <button
                type="button"
                class="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 hover:border-gray-300 transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md group"
                title="WeChat"
              >
                <i
                  class="fa-brands fa-weixin text-gray-600 group-hover:text-green-500 text-xl"
                ></i>
              </button>
              <button
                type="button"
                class="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 hover:border-gray-300 transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md group"
                title="GitHub"
              >
                <i
                  class="fa-brands fa-github text-gray-600 group-hover:text-black text-xl"
                ></i>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <LanguageModal
      v-if="showLanguageModal"
      :current-locale="currentLocale"
      @confirm="handleLanguageConfirm"
      @close="showLanguageModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useAuthStore } from '../store/auth.store';
import { loginTranslations } from '../i18n/login';
import 'animate.css';
import { useI18n } from '../../agent/composables/useI18n';
import LanguageModal from '../../agent/components/LanguageModal.vue';

const authStore = useAuthStore();
const { currentLocale, setLocale } = useI18n();
const loading = ref(false);
const error = ref('');
const showPassword = ref(false);
const showLanguageModal = ref(false);
const isExiting = ref(false);

const t = computed(() => loginTranslations[currentLocale.value]);

function handleLanguageConfirm(locale: string) {
  setLocale(locale as 'en' | 'cn');
  showLanguageModal.value = false;
}

const form = reactive({
  account: '',
  password: '',
});

function handleAccountInput(event: Event) {
  const target = event.target;
  if (target instanceof HTMLInputElement) {
    form.account = target.value;
  }
}

function handlePasswordInput(event: Event) {
  const target = event.target;
  if (target instanceof HTMLInputElement) {
    form.password = target.value;
  }
}

async function handleLogin() {
  if (!form.account || !form.password) return;

  loading.value = true;
  error.value = '';

  try {
    const isEmail = form.account.includes('@');
    const payload = {
      password: form.password,
      [isEmail ? 'email' : 'phone']: form.account,
    };

    await authStore.login(payload);

    // Success feedback
    const btn = document.querySelector('button[type="submit"]');
    if (btn) {
      btn.innerHTML = `<span class="text-white">${t.value.success}</span>`;
    }

    // Trigger exit animation
    isExiting.value = true;

    try {
      localStorage.removeItem('agent');
      localStorage.removeItem('agent_panel');
    } catch {}

    setTimeout(() => {
      window.location.replace('/');
    }, 800);
  } catch (e: any) {
    console.error(e);
    error.value = t.value.error;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
/* Custom minimalist input styles */
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 30px #f9fafb inset !important;
  -webkit-text-fill-color: black !important;
  transition: background-color 5000s ease-in-out 0s;
}

/* For focus state inside the component if needed */
input:focus:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 30px white inset !important;
}
</style>
