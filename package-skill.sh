#!/bin/sh
# Package the skill for upload to Claude.ai / Cowork (Settings -> Capabilities -> Skills).
# Writes dist/ux-audit.zip containing a ux-audit/ folder with SKILL.md at its root.
# Only what the skill needs at run time is included: SKILL.md, references/,
# assets/, scripts/ (without node_modules). Evals, README, CHANGELOG stay in the repo.
set -eu
cd "$(dirname "$0")"
name=$(sed -n 's/^name: *//p' SKILL.md | head -1)
version=$(sed -n 's/.*Skill Version: \([0-9.]*\).*/\1/p' SKILL.md | head -1)
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/$name" dist
cp SKILL.md "$stage/$name/"
cp -R references assets "$stage/$name/"
mkdir -p "$stage/$name/scripts"
for f in scripts/*.js scripts/package.json scripts/package-lock.json; do cp "$f" "$stage/$name/scripts/"; done
find "$stage" -name .DS_Store -delete
rm -f "dist/$name.zip"
(cd "$stage" && zip -qr "$OLDPWD/dist/$name.zip" "$name")
echo "Wrote dist/$name.zip ($name $version, $(unzip -l "dist/$name.zip" | tail -1 | awk '{print $2}') files)"
