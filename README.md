# Open Dibs independent health monitor

Hourly GitHub-hosted checks of a data-free Cloudflare scheduler health endpoint. One issue is opened/reopened on failure and closed after verified recovery. Optional notification relay carries only opaque acknowledgement tokens and generic notices. No provider names, people, credentials, balances, captures or deadlines are published here.

GitHub scheduling may be delayed or dropped. GitHub outage, account suspension, disabled workflows or notification settings can also prevent alerts. Email delivery depends on the recipient's GitHub settings and is not established by issue creation. This monitor adds an independent failure domain; it is not an uptime guarantee.

Uses standard hosted runners in a public repository: $0 under GitHub's documented public-repository Actions policy. No artifacts or caches are uploaded. Runtime is pinned; actions are pinned to commits. Source and runbook are maintained in Open Dibs.
