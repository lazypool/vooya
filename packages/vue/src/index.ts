import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";

export interface VooyaMountError {
  stage: "load" | "mount";
  cause: unknown;
}

export interface VooyaComponentDefinition {
  abiVersion: number;
  name: string;
  scopeId?: string;
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

export interface VooyaComponentHandle {
  dispose(): void;
  [method: string]: unknown;
}

export interface VooyaComponentBindings {
  mount(host: Element, ...props: unknown[]): VooyaComponentHandle;
}

export type VooyaComponentBindingsLoader = () => Promise<VooyaComponentBindings>;

export function defineVooyaComponent(
  definition: VooyaComponentDefinition,
  loadBindings: VooyaComponentBindingsLoader,
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
    ["error", (error: VooyaMountError) => error instanceof Object],
  ]);

  return defineComponent({
    name: definition.name.startsWith("Vooya") ? definition.name : `Vooya${definition.name}`,
    inheritAttrs: false,
    props: componentProps,
    emits: componentEvents,
    setup(props, { attrs, emit }) {
      const host = ref<Element>();
      let mounted = true;
      let handle: VooyaComponentHandle | undefined;

      const listeners = definition.events.map((event) => {
        const receive = (browserEvent: Event) => {
          const detail = (browserEvent as CustomEvent<unknown>).detail;
          if (event.parameters.length > 1 && Array.isArray(detail)) emit(event.name, ...detail);
          else if (event.parameters.length === 0) emit(event.name);
          else emit(event.name, detail);
        };
        return { name: `vooya-${event.name}`, receive };
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
      });

      onUnmounted(() => {
        handle?.dispose();
        handle = undefined;
      });

      return () =>
        h("div", {
          ...attrs,
          ref: host,
          "data-vooya-host": "",
          ...(definition.scopeId ? { "data-voo-scope": definition.scopeId } : {}),
        });
    },
  });
}
