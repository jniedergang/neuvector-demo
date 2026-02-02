# Web1 - Nginx with network tools and SSH server
FROM nginx:alpine

RUN apk add --no-cache \
    openssh \
    openssh-server \
    iputils \
    nmap \
    tcpdump \
    curl \
    wget \
    net-tools \
    bind-tools \
    && ssh-keygen -A \
    && echo "root:demo123" | chpasswd \
    && sed -i 's/#PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config \
    && sed -i 's/#PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config

# Start script for both nginx and sshd
RUN echo -e '#!/bin/sh\n/usr/sbin/sshd\nexec nginx -g "daemon off;"' > /start.sh \
    && chmod +x /start.sh

CMD ["/start.sh"]
