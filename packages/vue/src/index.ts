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

export interface DataGridHandle {
  update_filter(query: string): void;
  toggle_sort(): void;
  scroll_to(row: number): void;
  dispose(): void;
}

export interface DataGridBindings {
  mount_data_grid(host: Element, rows: number): DataGridHandle;
}

export type DataGridBindingsLoader = () => Promise<DataGridBindings>;

export interface TaskListHandle {
  dispose(): void;
}

export interface TaskListBindings {
  mount_task_list(host: Element): TaskListHandle;
}

export type TaskListBindingsLoader = () => Promise<TaskListBindings>;

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

export function defineVoyaDataGrid(loadBindings: DataGridBindingsLoader) {
  return defineComponent({
    name: "VoyaDataGrid",
    inheritAttrs: false,
    props: {
      rows: {
        type: Number as PropType<number>,
        default: 100_000,
      },
    },
    setup(props, { attrs }) {
      const host = ref<Element>();
      let mounted = true;
      let handle: DataGridHandle | undefined;

      onMounted(async () => {
        const bindings = await loadBindings();
        if (!mounted || !host.value) return;
        handle = bindings.mount_data_grid(host.value, props.rows);
      });

      onBeforeUnmount(() => {
        mounted = false;
        handle?.dispose();
        handle = undefined;
      });

      return () => h("div", { ...attrs, ref: host, "data-voya-host": "" });
    },
  });
}

export function defineVoyaTaskList(loadBindings: TaskListBindingsLoader) {
  return defineComponent({
    name: "VoyaTaskList",
    inheritAttrs: false,
    setup(_, { attrs }) {
      const host = ref<Element>();
      let mounted = true;
      let handle: TaskListHandle | undefined;

      onMounted(async () => {
        const bindings = await loadBindings();
        if (!mounted || !host.value) return;
        handle = bindings.mount_task_list(host.value);
      });

      onBeforeUnmount(() => {
        mounted = false;
        handle?.dispose();
        handle = undefined;
      });

      return () => h("div", { ...attrs, ref: host, "data-voya-host": "" });
    },
  });
}
