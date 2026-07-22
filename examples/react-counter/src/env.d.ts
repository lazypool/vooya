declare module "*.voya" {
  import type { ComponentType } from "react";

  const component: ComponentType<{
    initial: number;
    onChange?: (value: number) => void;
    className?: string;
  }>;
  export default component;
}
