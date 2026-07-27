import { createElement, useEffect, useRef } from "react";

export interface VoyaMountError {
  stage: "load" | "mount";
  cause: unknown;
}

export interface VoyaComponentDefinition {
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

export interface VoyaComponentHandle {
  dispose(): void;
  [method: string]: unknown;
}

export interface VoyaComponentBindings {
  mount(host: Element, ...props: unknown[]): VoyaComponentHandle;
}

export type VoyaComponentBindingsLoader = () => Promise<VoyaComponentBindings>;

type RuntimeProps = Record<string, unknown> & {
  className?: string;
  onError?: (error: VoyaMountError) => void;
};

export function defineVoyaComponent(
  definition: VoyaComponentDefinition,
  loadBindings: VoyaComponentBindingsLoader,
) {
  return function VoyaComponent(componentProps: RuntimeProps) {
    const host = useRef<HTMLDivElement>(null);
    const handle = useRef<VoyaComponentHandle | undefined>(undefined);
    const props = useRef(componentProps);
    const previousProps = useRef<Record<string, unknown> | undefined>(undefined);
    props.current = componentProps;

    useEffect(() => {
      let active = true;
      const element = host.current;
      if (!element) return undefined;

      const listeners = definition.events.map((event) => {
        const receive = (browserEvent: Event) => {
          const callback = props.current[reactEventName(event.name)];
          if (typeof callback !== "function") return;
          const detail = (browserEvent as CustomEvent<unknown>).detail;
          if (event.parameters.length > 1 && Array.isArray(detail)) callback(...detail);
          else if (event.parameters.length === 0) callback();
          else callback(detail);
        };
        element.addEventListener(`voya-${event.name}`, receive);
        return { name: `voya-${event.name}`, receive };
      });

      void loadBindings()
        .then((bindings) => {
          if (!active) return;
          try {
            handle.current = bindings.mount(
              element,
              ...definition.props.map((prop) => props.current[prop.name]),
            );
          } catch (cause) {
            props.current.onError?.({ stage: "mount", cause });
          }
        })
        .catch((cause) => props.current.onError?.({ stage: "load", cause }));

      return () => {
        active = false;
        for (const listener of listeners) {
          element.removeEventListener(listener.name, listener.receive);
        }
        handle.current?.dispose();
        handle.current = undefined;
      };
    }, [loadBindings]);

    useEffect(() => {
      const previous = previousProps.current;
      if (previous) {
        for (const prop of definition.props) {
          const value = componentProps[prop.name];
          if (Object.is(previous[prop.name], value)) continue;
          const update = handle.current?.[`update_${prop.name}`];
          if (typeof update === "function") update.call(handle.current, value);
        }
      }
      previousProps.current = Object.fromEntries(
        definition.props.map((prop) => [prop.name, componentProps[prop.name]]),
      );
    });

    return createElement("div", {
      ref: host,
      className: componentProps.className,
      "data-voya-host": "",
      ...(definition.scopeId ? { "data-voo-scope": definition.scopeId } : {}),
    });
  };
}

function reactEventName(name: string) {
  const pascal = name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join("");
  return `on${pascal}`;
}
