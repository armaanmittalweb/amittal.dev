"""Reports Modal's spend to the Switchboard every 6 hours, from inside Modal.

Modal has no HTTP API for billing that a Worker could call, and asking a runtime for its health would
wake it and spend the credits being measured. So this small function reads the workspace's billing
with the credentials every Modal container already has and posts it to api.amittal.dev.

    modal secret create switchboard INTERNAL_KEY=<the Switchboard's INTERNAL_KEY>
    modal deploy modal/meter.py          # from Portfolio/switchboard
    modal run modal/meter.py             # report once, now

Each run takes a few seconds of the smallest container: well under a cent a month.
"""

import modal

app = modal.App("switchboard-meter")
image = modal.Image.debian_slim(python_version="3.12").pip_install("modal==1.6.0")

URL = "https://api.amittal.dev/internal/modal"


@app.function(image=image, schedule=modal.Cron("7 */6 * * *"), timeout=120, secrets=[modal.Secret.from_name("switchboard")])
def report() -> dict:
    import datetime as dt
    import json
    import os
    import urllib.request
    from collections import defaultdict

    workspace = modal.Workspace.from_context()
    summary = workspace.billing.summary()
    # Hourly, up to the last full hour: a daily report leaves out the day that is not over yet.
    end = dt.datetime.now(dt.timezone.utc).replace(minute=0, second=0, microsecond=0)
    apps: dict[str, float] = defaultdict(float)
    if end > summary.start:
        for item in workspace.billing.report(start=summary.start, end=end, resolution="h"):
            apps[item.description or item.object_id] += float(item.cost)

    body = {
        "cycleStart": summary.start.date().isoformat(),
        "metered": round(float(summary.metered_cost), 4),
        "billed": round(float(summary.billed_cost), 4),
        "apps": {name: round(cost, 4) for name, cost in sorted(apps.items())},
    }
    req = urllib.request.Request(URL, json.dumps(body).encode(), method="POST",
                                 headers={"content-type": "application/json", "x-internal-key": os.environ["INTERNAL_KEY"],
                                          "user-agent": "switchboard-meter"})
    with urllib.request.urlopen(req, timeout=30) as res:
        print("reported", res.status, body)
    return body


@app.local_entrypoint()
def main():
    print(report.remote())
