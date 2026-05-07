# MufYard Backend - Production Dockerfile
FROM python:3.11

# Set working directory
WORKDIR /app

# Install system dependencies (Full image has most, but we ensure essentials)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directories (Railway uses Volumes for persistence, but we ensure folders exist)
RUN mkdir -p Mevzuat Raporlar uploads data

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Expose port
EXPOSE 8000

# Start application using uvicorn
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
