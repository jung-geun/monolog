.PHONY: config up down restart ps logs

config:
	docker compose config --quiet

up:
	docker compose up -d --build --wait --remove-orphans

down:
	docker compose down

restart:
	docker compose up -d --build --wait --remove-orphans --force-recreate

ps:
	docker compose ps

logs:
	docker compose logs -f blog redis qdrant
