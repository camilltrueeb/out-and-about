#!/bin/bash
# Finds images in static/images/ that are not referenced in any content file.

IMAGES_DIR="static/images"
CONTENT_DIR="content"

echo "Scanning for orphaned images..."
echo ""

orphans=()
for img in "$IMAGES_DIR"/*; do
  filename=$(basename "$img")
  if ! grep -qr "$filename" "$CONTENT_DIR"; then
    orphans+=("$img")
  fi
done

if [ ${#orphans[@]} -eq 0 ]; then
  echo "No orphaned images found."
  exit 0
fi

echo "Orphaned images (not referenced in any content file):"
for img in "${orphans[@]}"; do
  size=$(du -sh "$img" | cut -f1)
  echo "  [$size] $img"
done

echo ""
read -p "Delete all ${#orphans[@]} orphaned image(s)? [y/N] " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
  for img in "${orphans[@]}"; do
    rm "$img"
    echo "Deleted: $img"
  done
  echo ""
  echo "Done. Run 'git add -A && git commit -m \"Remove orphaned images\"' to commit."
else
  echo "Aborted — no files deleted."
fi
