export const SPEED_COLOR_STOPS = ['#12345f', '#1e6fd9', '#00c8ff', '#7df3ff', '#ffffff']
export const LEVEL_COLOR_STOPS = ['#1035aa', '#00c7ff', '#7dffb0', '#ffe85c', '#ff5c3d']

export function toLinearGradient(colors) {
    return `linear-gradient(to right, ${colors.join(', ')})`
}
