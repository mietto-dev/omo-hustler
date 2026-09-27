# QA image for the OpenCode QA skills.
# Layered ON TOP of the devcontainer dev image (omo-dev) so the dev and QA
# environments share one base, plus the latest released OpenCode CLI
# and the QA toolchain (sqlite3, jq, curl, rsync). Build order (omo-dev first,
# then omo-qa) is handled by script/agent/qa-docker.sh.
FROM omo-dev

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends sqlite3 jq curl rsync ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Latest released OpenCode. Pin by passing OMO_OPENCODE_VERSION.
ARG OMO_OPENCODE_VERSION=latest
RUN npm install -g "opencode-ai@${OMO_OPENCODE_VERSION}" \
  && opencode --version

COPY .devcontainer/qa-entrypoint.sh /usr/local/bin/qa-entrypoint.sh
RUN chmod +x /usr/local/bin/qa-entrypoint.sh

USER node
ENTRYPOINT ["/usr/local/bin/qa-entrypoint.sh"]
