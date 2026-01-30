# Production1 - OpenSUSE with network tools
FROM opensuse/tumbleweed

RUN zypper refresh && \
    zypper install -y \
        openssh-clients \
        iputils \
        nmap \
        tcpdump \
        curl \
        wget \
        net-tools \
        iproute2 \
        bind-utils \
        netcat-openbsd && \
    zypper clean -a

CMD ["sleep", "infinity"]
