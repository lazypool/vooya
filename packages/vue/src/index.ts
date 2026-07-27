import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

export interface VoyaMountError {
  stage: "load" | "mount";
  cause: unknown;
}

export interface VoyaComponentDefinition {
  name: string;
  props: Array<{
    name: string;
    type: "number" | "boolean" | "string";
    required: boolean;
    defaultValue?: unknown;
  }>;
  events: Array<{
    name: string;
    parameters: string[];
  }>;
}

export interface VoyaComponentHandle {
  dispose(): void;
  [method: string]: unknown;
}

export interface VoyaComponentBindings {
  mount(host: Element, ...props: unknown[]): VoyaComponentHandle;
}

export type VoyaComponentBindingsLoader = () => Promise<VoyaComponentBindings>;

export function defineVoyaComponent(
  definition: VoyaComponentDefinition,
  loadBindings: VoyaComponentBindingsLoader,
) {
  const constructors = { number: Number, boolean: Boolean, string: String };
  const componentProps = Object.fromEntries(
    definition.props.map((prop) => [
      prop.name,
      {
        type: constructors[prop.type],
        required: prop.required,
        ...(Object.hasOwn(prop, "defaultValue") ? { default: prop.defaultValue } : {}),
      },
    ]),
  );
  const componentEvents = Object.fromEntries([
    ...definition.events.map((event) => [event.name, () => true] as const),
    ["error", (error: VoyaMountError) => error instanceof Object],
  ]);

  return defineComponent({
    name: definition.name.startsWith("Voya") ? definition.name : `Voya${definition.name}`,
    inheritAttrs: false,
    props: componentProps,
    emits: componentEvents,
    setup(props, { attrs, emit }) {
      const host = ref<Element>();
      let mounted = true;
      let handle: VoyaComponentHandle | undefined;

      const listeners = definition.events.map((event) => {
        const receive = (browserEvent: Event) => {
          const detail = (browserEvent as CustomEvent<unknown>).detail;
          if (event.parameters.length > 1 && Array.isArray(detail)) emit(event.name, ...detail);
          else if (event.parameters.length === 0) emit(event.name);
          else emit(event.name, detail);
        };
        return { name: `voya-${event.name}`, receive };
      });

      onMounted(async () => {
        try {
          const bindings = await loadBindings();
          if (!mounted || !host.value) return;

          for (const listener of listeners) {
            host.value.addEventListener(listener.name, listener.receive);
          }
          try {
            const values = props as Record<string, unknown>;
            handle = bindings.mount(
              host.value,
              ...definition.props.map((prop) => values[prop.name]),
            );
          } catch (cause) {
            for (const listener of listeners) {
              host.value.removeEventListener(listener.name, listener.receive);
            }
            emit("error", { stage: "mount", cause });
          }
        } catch (cause) {
          emit("error", { stage: "load", cause });
        }
      });

      for (const prop of definition.props) {
        watch(
          () => (props as Record<string, unknown>)[prop.name],
          (value) => {
            const update = handle?.[`update_${prop.name}`];
            if (typeof update === "function") update.call(handle, value);
          },
        );
      }

      onBeforeUnmount(() => {
        mounted = false;
        for (const listener of listeners) {
          host.value?.removeEventListener(listener.name, listener.receive);
        }
        handle?.dispose();
        handle = undefined;
      });

      return () => h("div", { ...attrs, ref: host, "data-voya-host": "" });
    },
  });
}
