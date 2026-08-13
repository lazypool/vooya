export interface VooProp {
  name: string;
  rustType: string;
  required: boolean;
  defaultValue?: string;
}

export interface VooEventParameter {
  name: string;
  rustType: string;
}

export interface VooEvent {
  name: string;
  parameters: VooEventParameter[];
}

export interface VooStyle {
  content: string;
  scoped: boolean;
  startLine?: number;
}

export interface SourceComponent {
  format: "source";
  id?: string;
  name: string;
  props: VooProp[];
  events: VooEvent[];
  rust: { content: string; startLine: number };
  style?: VooStyle;
}

export interface ManifestComponent {
  format: "manifest";
  id?: string;
  name: string;
  runtime: string;
  exportName: string;
  adapters: Record<string, string>;
  props: Array<{ name: string; type: string; required: boolean }>;
  events: Array<{ name: string; type: string }>;
}

export type ParsedComponent = SourceComponent | ManifestComponent;

export interface CodegenComponent {
  id?: string;
  name: string;
  props: VooProp[];
  events: VooEvent[];
  rust: { content: string; startLine?: number };
  style?: VooStyle;
}
