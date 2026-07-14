export const withInstall = (main, extra) => {
    main.install = app => {
        for (const comp of [main, ...Object.values(extra != null ? extra : {})]) {
            console.log(comp.name, comp)
            app.component(comp.name, comp)
        }
    }
    if (extra) {
        for (const [key, comp] of Object.entries(extra)) {
            main[key] = comp
        }
    }
    return main
}

export const withInstallFunction = (fn, name) => {
    fn.install = app => {
        fn._context = app._context
        app.config.globalProperties[name] = fn
    }
    return fn
}
export const withInstallDirective = (directive, name) => {
    directive.install = app => {
        app.directive(name, directive)
    }
    return directive
}
