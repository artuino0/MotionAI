import './sin-eval.js';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './componentes/App.vue';
import './estilos.css';
import '../compartido/api.js';

createApp(App).use(createPinia()).mount('#app');
