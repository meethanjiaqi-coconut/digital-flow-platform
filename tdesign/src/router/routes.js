const frameIn = [
    {
        path: '/',
        redirect: {
            name: 'index'
        },
        component: () => import('@/layout/layout.vue'),
        children: [
            {
                path: '/',
                name: 'index',
                component: () => import('@/views/index.vue'),
                children: [
                    {
                        path: '',
                        name: 'flow-field',
                        component: () => import('@/views/flow-field.vue')
                    },
                    {
                        path: '/test',
                        name: 'test',
                        component: () => import('@/views/test.vue')
                    }
                ]
            },
            {
                path: '/pages/:id',
                name: 'IframePageView',
                component: () => import('@/views/iframe-page-view.vue')
            }
        ]
    }
]

const frameOut = []

const errorPage = []

export default [...frameIn, ...frameOut, ...errorPage]
