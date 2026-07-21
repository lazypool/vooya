import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
} from "vue";

export interface CounterHandle {
  update_initial(initial: number): void;
  dispose(): void;
}

export interface CounterBindings {
  mount_counter(host: Element, initial: number): CounterHandle;
}

export type CounterBindingsLoader = () => Promise<CounterBindings>;

/**
 * Adapts the first Voya WASM runtime spike to Vue's component contract.
 * Vue owns the host element; Voya owns everything mounted beneath it.
 */
export function defineVoyaCounter(loadBindings: CounterBindingsLoader) {
  return defineComponent({
    name: "VoyaCounter",
    inheritAttrs: false,
    props: {
      initial: {
        type: Number as PropType<number>,
        required: true,
      },
    },
    emits: {
      change: (value: number) => typeof value === "number",
    },
    setup(props, { attrs, emit }) {
      const host = ref<Element>();
      let mounted = true;
      let handle: CounterHandle | undefined;

      const onChange = (event: Event) => {
        const value = (event as CustomEvent<unknown>).detail;
        if (typeof value === "number") emit("change", value);
      };

      onMounted(async () => {
        const bindings = await loadBindings();
        if (!mounted || !host.value) return;

        host.value.addEventListener("voya-change", onChange);
        handle = bindings.mount_counter(host.value, props.initial);
      });

      watch(
        () => props.initial,
        (value) => handle?.update_initial(value),
      );

      onBeforeUnmount(() => {
        mounted = false;
        host.value?.removeEventListener("voya-change", onChange);
        handle?.dispose();
        handle = undefined;
      });

      return () => h("div", { ...attrs, ref: host, "data-voya-host": "" });
    },
  });
}
