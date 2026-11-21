#!/bin/sh
echo "Time file content:"
cat /opt/time.txt
echo "===================="

if [ $# -eq 0 ]; then
  echo "必须指定要运行的 JAR 文件"
  exit 1
fi

exec java -Dfile.encoding=UTF-8 \
    -Xms512m -Xmx2g -XX:MaxDirectMemorySize=2g \
    -XX:+UseG1GC -XX:+UnlockExperimentalVMOptions -XX:+UseStringDeduplication \
    -Dio.netty.leakDetection.level=disabled \
    -jar "$@"