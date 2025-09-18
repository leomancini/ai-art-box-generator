#!/bin/bash

INPUT_DIR="."
OUTPUT_DIR="./resized"
WIDTH=1024
HEIGHT=600

# create output dir if missing
mkdir -p "$OUTPUT_DIR"

for img in "$INPUT_DIR"/*.{jpg,jpeg,png,gif}; do
  [ -e "$img" ] || continue

  filename=$(basename "$img")   # just the file name with extension
  out="$OUTPUT_DIR/$filename"   # output path inside new dir

  echo "Processing $img -> $out"

  magick "$img" -resize ${WIDTH}x${HEIGHT}^ -gravity center -extent ${WIDTH}x${HEIGHT} "$out"
done
