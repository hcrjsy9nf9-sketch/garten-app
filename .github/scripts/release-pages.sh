#!/usr/bin/env bash
# Drop GitHub Pages builds that still block a new deployment.
# A build can stay "in progress" inside Pages after Actions has already
# marked the deployment failed. Cancel that build, and close any
# deployment record that is still open.
set -u

owner="${GITHUB_REPOSITORY%%/*}"
repo="${GITHUB_REPOSITORY#*/}"

release_once() {
  local id sha state
  while read -r id sha; do
    [ -n "${id}" ] || continue
    state="$(gh api "repos/${owner}/${repo}/deployments/${id}/statuses" --jq '.[0].state // "unknown"')"
    echo "deployment ${id} ${sha:0:7} ${state}"
    if [ "${state}" = "success" ]; then
      continue
    fi
    echo "cancel pages build ${sha}"
    gh api --method POST "repos/${owner}/${repo}/pages/deployments/${sha}/cancel" \
      || echo "cancel not accepted for ${sha:0:7}"
    case "${state}" in
      in_progress|queued|pending|waiting)
        echo "mark ${id} inactive"
        gh api --method POST "repos/${owner}/${repo}/deployments/${id}/statuses" \
          -f state=inactive \
          -f environment=github-pages \
          -f description="Released so the next Pages deploy can start" \
          || echo "could not mark ${id} inactive"
        ;;
    esac
  done < <(gh api "repos/${owner}/${repo}/deployments?environment=github-pages&per_page=15" --jq '.[] | "\(.id) \(.sha)"')
}

open_count() {
  local n
  n="$(
    gh api "repos/${owner}/${repo}/deployments?environment=github-pages&per_page=15" --jq '.[] | "\(.id)"' | while read -r id; do
      [ -n "${id}" ] || continue
      gh api "repos/${owner}/${repo}/deployments/${id}/statuses" --jq '.[0].state // "unknown"'
    done | grep -c -E '^(in_progress|queued|pending|waiting)$' || true
  )"
  echo "${n:-0}"
}

release_once
sleep 5

if [ "${1:-}" = "--wait" ]; then
  echo "waiting until no Pages deployment is still open (at most 10 minutes)"
  i=0
  while [ "${i}" -lt 20 ]; do
    open="$(open_count | tail -n 1)"
    echo "open deployment records: ${open}"
    if [ "${open}" = "0" ]; then
      sleep 15
      release_once
      break
    fi
    sleep 30
    release_once
    i=$((i + 1))
  done
fi
