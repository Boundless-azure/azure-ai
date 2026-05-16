FROM node:20-alpine

# Runner 时区固定 UTC :: 设计约束, 见 src/modules/data-touchpoint/module.md 和 SaaS 端 LOCAL_CHAPTER_RUNNER_HOOK_LM
# 跨地域 runner 部署内部时间观一致, 数据可跨 runner 比对; 用户视角的本地时间必须显式调 saas.app.timeZone.* 转换
ENV TZ=UTC
RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/UTC /etc/localtime \
    && echo "UTC" > /etc/timezone \
    && apk del tzdata

# 安装 FRP
RUN apk add --no-cache curl ca-certificates \
    && curl -sSL https://github.com/fatedier/frp/releases/download/v0.61.1/frp_0.61.1_linux_amd64.tar.gz -o /tmp/frp.tar.gz \
    && tar -xzf /tmp/frp.tar.gz -C /opt \
    && mv /opt/frp_0.61.1_linux_amd64 /opt/frp \
    && rm /tmp/frp.tar.gz \
    && ln -s /opt/frp/frpc /usr/local/bin/frpc \
    && ln -s /opt/frp/frps /usr/local/bin/frps

WORKDIR /app
COPY package.json ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build

EXPOSE 4310 7000 80 443

CMD ["node", "dist/main.js"]
