export const fullExtent = [101.82530878613342, 28.10462232558261, 122.91905878613342, 33.48792310683261]
export function full2Extent(map, extent) {
    const view = map.getView()
    let full = fullExtent
    if (extent) {
        full = extent
    }
    const resolution = view.getResolutionForExtent(full)
    const zoom = view.getZoomForResolution(resolution)
    view.setResolution(resolution)
    view.fit(full, {
        constrainResolution: true,
        nearest: true
    })
    view.setZoom(zoom)
}

export function fullScreen(type) {
    const html = document.documentElement
    if (document.fullscreenElement || type) {
        if (document.exitFullscreen) {
            document.exitFullscreen()
        } else if (document.webkitCancelFullScreen) {
            document.webkitCancelFullScreen()
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen()
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen()
        }
    } else if (html.requestFullscreen) {
        html.requestFullscreen()
    } else if (html.webkitRequestFullScreen) {
        html.webkitRequestFullScreen()
    } else if (html.mozRequestFullScreen) {
        html.mozRequestFullScreen()
    } else if (html.msRequestFullscreen) {
        html.msRequestFullscreen()
    }
}
