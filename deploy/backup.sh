#!/bin/sh
# Nightly backup of orders, menu and photos.
# Cron (as the foodfairy user): 15 3 * * * /srv/food-fairy/deploy/backup.sh
# Copy /srv/food-fairy-backups off the server too (rsync/rclone to another box).
set -eu
APP=/srv/food-fairy
OUT=/srv/food-fairy-backups
STAMP=$(date +%Y-%m-%d)
mkdir -p "$OUT"
# VACUUM INTO gives a consistent snapshot even while the site is running (WAL mode).
node -e "new (require('node:sqlite').DatabaseSync)('$APP/data/foodfairy.sqlite').exec(\"VACUUM INTO '$OUT/foodfairy-$STAMP.sqlite'\")"
tar -czf "$OUT/media-$STAMP.tar.gz" -C "$APP/data" media
find "$OUT" -type f -mtime +30 -delete
