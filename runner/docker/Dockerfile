FROM node:20-alpine

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
