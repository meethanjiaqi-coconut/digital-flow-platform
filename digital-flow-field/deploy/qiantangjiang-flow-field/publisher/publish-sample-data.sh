#!/usr/bin/env sh
set -eu

: "${FLOW_PUBLISH_TOKEN:?请先设置 FLOW_PUBLISH_TOKEN，值必须与服务端一致}"

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PYTHON_BIN=${PYTHON_BIN:-python3}

"$PYTHON_BIN" "$SCRIPT_DIR/preprocess_flowfield.py" validate \
  --package "$SCRIPT_DIR/sample-package"

"$PYTHON_BIN" "$SCRIPT_DIR/preprocess_flowfield.py" publish \
  --package "$SCRIPT_DIR/sample-package" \
  --server "${1:?用法: publish-sample-data.sh http://服务地址:8793/flow-field}" \
  --workers 4 \
  --retries 5

