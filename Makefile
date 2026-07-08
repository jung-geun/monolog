.PHONY: setup dev run

NOTION_TOKEN :=
NOTION_DATASOURCE_ID :=
REVALIDATE_SECRET :=
setup:
	docker build . -t morethan-log ; \
	docker run -it --rm -v $(PWD):/app morethan-log /bin/bash -c "yarn install" ; \
	echo NOTION_TOKEN=$(NOTION_TOKEN) > .env.local ; \
	echo NOTION_DATASOURCE_ID=$(NOTION_DATASOURCE_ID) >> .env.local ; \
	echo REVALIDATE_SECRET=$(REVALIDATE_SECRET) >> .env.local
dev:
	docker run -it --rm -v $(PWD):/app -p 8001:3000 morethan-log /bin/bash -c "yarn run dev"

run:
	docker run -it --rm -v $(PWD):/app morethan-log /bin/bash

