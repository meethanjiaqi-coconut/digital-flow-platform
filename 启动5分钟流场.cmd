@echo off
chcp 65001 >nul
title 钱塘江 5 分钟数字流场
cd /d "%~dp0"
if not exist "output\flowfield-5min-verified\package.json" (
    echo 未找到5分钟流场转换包，请参照 docs\handover\5分钟流场效果验收说明.md 准备数据。
    pause
    exit /b 1
)
powershell -NoProfile -Command "try { $r = Invoke-RestMethod 'http://127.0.0.1:5175/flow-field/api/v1/scenarios/latest/manifest' -TimeoutSec 2; if ($r.data.sourceRunId -eq 'RST-WUV-20261025-5MIN') { exit 0 } } catch {}; exit 1"
if not errorlevel 1 (
    start "" "http://127.0.0.1:5175/#/"
    exit /b 0
)
cd /d "%~dp0tdesign"
if not exist "node_modules\vite\bin\vite.js" (
    echo 请先在 tdesign 目录运行 npm.cmd ci 安装项目依赖。
    pause
    exit /b 1
)
call npm.cmd run dev:demo -- --host 127.0.0.1 --port 5175 --strictPort --open
pause
