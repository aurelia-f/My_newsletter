// ============================================================
//  Entry point of the Vue client (the course: "main.js content")
// ============================================================
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './assets/style.css';

createApp(App).use(router).mount('#app');
