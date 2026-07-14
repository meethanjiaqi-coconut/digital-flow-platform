;(function ($) {
    $.APIS = {
        SYSTEM: {
            MENU: `${SYSTEM_CONFIG.SERVER.LOCAL}data/menu.json`
        },
        // 根据自己需要修改
        MANAGER: {
            FILE_MANAGER: `${SYSTEM_CONFIG.SERVER.DEFAULT}manager/filemanager`,
            FILE_UPLOAD: `${SYSTEM_CONFIG.SERVER.DEFAULT}manager/fileupload`
        }
    }
})(window)
