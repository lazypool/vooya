import init, { mount_counter } from "../../packages/core/dist/voya_core.js";

await init();

const host = document.querySelector("#host");
const eventLog = document.querySelector("#event-log");
let counter = mount_counter(host, 1);

host.addEventListener("voya-change", (event) => {
  eventLog.textContent = `Voya emitted count: ${event.detail}`;
});

document.querySelector("#update").addEventListener("click", () => {
  counter?.update_initial(10);
});

document.querySelector("#dispose").addEventListener("click", () => {
  counter?.dispose();
  counter = undefined;
});
