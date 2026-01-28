# Web1 - Nginx with network tools
FROM nginx:alpine

RUN apk add --no-cache \
    openssh-client \
    iputils \
    nmap \
    tcpdump \
    curl \
    wget \
    net-tools \
    bind-tools

CMD ["nginx", "-g", "daemon off;"]
