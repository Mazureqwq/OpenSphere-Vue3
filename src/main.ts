import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "ol/ol.css";
import "./styles.css";
import "./styles/tokens.css";
import "./styles/element-plus-overrides.css";
import "./styles/workbench.css";
import App from "./App.vue";
import router from "./router";
import { registerBuiltInPlugins } from "./plugins";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus);
registerBuiltInPlugins();
app.mount("#app");
