FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

COPY awaybrew/pyproject.toml awaybrew/uv.lock ./awaybrew/
COPY utils/ ./utils/

WORKDIR /app/awaybrew
RUN uv sync --frozen --no-dev

COPY awaybrew/ ./awaybrew/

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
