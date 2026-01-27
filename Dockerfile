# NeuVector Demo Web Application Dockerfile
FROM opensuse/leap:15.6

# Install Python, pip, curl and kubectl
RUN zypper refresh && \
    zypper install -y python311 python311-pip curl && \
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && \
    rm kubectl && \
    zypper clean -a

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip3.11 install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN groupadd -g 1000 appuser && \
    useradd -m -u 1000 -g appuser appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8080

# Run the application
CMD ["python3.11", "run.py"]
