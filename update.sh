#!/bin/sh
mkdir input
sh ./jar.sh
sh ./vmi.sh
npm install --omit=dev
node index.js

RUN_FROM_GITHUB_ACTION="${RUN_FROM_GITHUB_ACTION:-false}"
if [ "$RUN_FROM_GITHUB_ACTION" = "true" ]; then
  if [[ `git status --porcelain` ]]; then
      NOW=$(date "+%Y-%m-%d-%H-%M-%S")
      git checkout -b update-${NOW}
      git add .
      git commit -m "data update"
      git push --set-upstream origin update-${NOW}
      gh pr create -f -b "Data update ${NOW}"
      gh pr merge --auto --squash
  fi
fi
