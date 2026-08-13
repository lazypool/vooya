import postcss from "postcss";
import { generatedScopeId } from "./codegen.js";
export function compileVooStyle(component) {
    if (!component.style)
        return "";
    const root = postcss.parse(component.style.content, { from: component.id });
    if (!component.style.scoped)
        return root.toString();
    const scope = `[data-voo-scope="${generatedScopeId(component)}"]`;
    root.walkRules((rule) => {
        if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name))
            return;
        rule.selectors = rule.selectors.map((selector) => {
            if (selector.includes(":host"))
                return selector.replaceAll(":host", scope);
            return `${scope} ${selector}`;
        });
    });
    return root.toString();
}
