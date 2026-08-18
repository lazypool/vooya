---
vooya-compiler: "patch:feat"
vooya-core: "patch:feat"
vooya-build-core: "patch:feat"
vooya-vite: "patch:feat"
vooya-vue: "patch:feat"
vooya-react: "patch:feat"
vooya-rspack: "patch:feat"
vooya-webpack: "patch:feat"
---

Move generated application state into a disposable `.vooya/` workspace and
mirror component declarations under `.vooya/types` instead of writing them
beside source `.voo` files.
