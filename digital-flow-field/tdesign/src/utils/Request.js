import axios from 'axios'

const request = axios.create({
    baseURL: '',
    withCredentials: true
})

// request.interceptors.request.use(config => {
//     config.headers.Cookie = document.cookie
//     return config
// })

/**
 * 全局get请求
 * @param url
 * @param params
 * @returns {Promise<unknown>}
 * @constructor
 */
export function RequestGet(url, params = {}) {
    return new Promise((resolve, reject) => {
        request
            .get(url, {
                params
            })
            .then(response => {
                resolve(response.data)
            })
            .catch(error => {
                reject(error)
            })
    })
}

/**
 * 全局post请求
 * @param url
 * @param params
 * @param config
 * @returns {Promise<unknown>}
 * @constructor
 */
export function RequestPost(url, params, config = {}) {
    return new Promise((resolve, reject) => {
        request
            .post(url, params, config)
            .then(response => {
                resolve(response.data)
            })
            .catch(error => {
                reject(error)
            })
    })
}

export function RequestAll(requests) {
    return new Promise((resolve, reject) => {
        axios
            .all(requests)
            .then(results => {
                resolve(results)
            })
            .catch(error => {
                reject(error)
            })
    })
}
