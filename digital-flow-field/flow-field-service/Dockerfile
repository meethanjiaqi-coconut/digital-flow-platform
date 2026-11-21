# 基础镜像使用 openjdk
FROM java:8
# 作者
LABEL maintainer="model-devlop"
# VOLUME 指定了临时文件目录为/tmp。
# 其效果是在主机 /var/lib/docker 目录下创建了一个临时文件，并链接到容器的/tmp
ENV TZ="Asia/Shanghai"
WORKDIR /app
COPY *.jar sgxt-flow-field.jar

COPY ./entrypoint.sh /opt/entrypoint.sh
RUN chmod +x /opt/entrypoint.sh

EXPOSE 8793
CMD java -Dfile.encoding=utf-8 -jar sgxt-flow-field.jar
