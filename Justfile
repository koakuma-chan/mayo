dev:
    bunx --bun astro dev

check:
    bunx --bun astro check

fmt:
    dprint fmt

sqlite:
    sqlite3 .data/db.sqlite

mk-inv:
    sqlite3 .data/db.sqlite "insert into invites ('id') values ('e31b60be-fc69-4900-8eee-b65be3d8d923');"
