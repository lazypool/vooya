import { useEffect, useRef } from "react";

export interface CounterHandle {
  update_initial(initial: number): void;
  dispose(): void;
}

export interface CounterBindings {
  mount_counter(host: Element, initial: number): CounterHandle;
}

export type CounterBindingsLoader = () => Promise<CounterBindings>;

export interface VoyaCounterProps {
  initial: number;
  onChange?: (value: number) => void;
  className?: string;
}

/**
 * React owns the host element while the loaded Voya component owns its subtree.
 */
export function defineVoyaCounter(loadBindings: CounterBindingsLoader) {
  return function VoyaCounter({ initial, onChange, className }: VoyaCounterProps) {
    const host = useRef<HTMLDivElement>(null);
    const handle = useRef<CounterHandle>();
    const initialRef = useRef(initial);
    const onChangeRef = useRef(onChange);

    initialRef.current = initial;
    onChangeRef.current = onChange;

    useEffect(() => {
      let active = true;
      const element = host.current;
      if (!element) return undefined;

      const receiveChange = (event: Event) => {
        const value = (event as CustomEvent<unknown>).detail;
        if (typeof value === "number") onChangeRef.current?.(value);
      };
      element.addEventListener("voya-change", receiveChange);
      void loadBindings().then((bindings) => {
        if (active) handle.current = bindings.mount_counter(element, initialRef.current);
      });

      return () => {
        active = false;
        element.removeEventListener("voya-change", receiveChange);
        handle.current?.dispose();
        handle.current = undefined;
      };
    }, [loadBindings]);

    useEffect(() => {
      handle.current?.update_initial(initial);
    }, [initial]);

    return <div ref={host} className={className} data-voya-host="" />;
  };
}
