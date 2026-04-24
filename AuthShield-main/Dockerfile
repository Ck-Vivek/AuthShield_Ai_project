FROM python:3.11-slim

WORKDIR /app

COPY backend_demo/backend/requirements.txt /app/backend_demo/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend_demo/backend/requirements.txt

COPY . /app

RUN chmod +x /app/start.sh

EXPOSE 8000 3000

CMD ["/app/start.sh"]
