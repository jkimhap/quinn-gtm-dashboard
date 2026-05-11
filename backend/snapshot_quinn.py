"""
Fetches Quinn product adoption metrics via the Quinn MCP HTTP API
and upserts them into the quinn_orgs table.

Requires env var: QUINN_API_TOKEN  (service token from api.lunapark.com)
"""

import json
import os
import sys

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import db

QUINN_API_TOKEN = os.getenv("QUINN_API_TOKEN", "")
QUINN_MCP_URL = "https://api.lunapark.com/api/v1/mcp"

# Exclude demo / internal sandbox orgs
DEMO_PRODUCTS = {"Luna Park Demo", "Try Luna Park", "Slack Review"}


def call_mcp_tool(tool_name: str, arguments: dict) -> dict:
    """
    Call a Quinn MCP tool via Streamable HTTP JSON-RPC.
    Handles both plain JSON and SSE (text/event-stream) responses.
    """
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    if QUINN_API_TOKEN:
        headers["Authorization"] = f"Bearer {QUINN_API_TOKEN}"

    payload = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments},
        "id": 1,
    }

    resp = requests.post(QUINN_MCP_URL, json=payload, headers=headers, timeout=90)
    resp.raise_for_status()

    ct = resp.headers.get("Content-Type", "")

    # SSE response: read event stream lines
    if "text/event-stream" in ct:
        for line in resp.text.splitlines():
            line = line.strip()
            if line.startswith("data:"):
                data_str = line[5:].strip()
                if data_str and data_str != "[DONE]":
                    try:
                        chunk = json.loads(data_str)
                        content = (
                            chunk.get("result", {}).get("content", [])
                            or chunk.get("content", [])
                        )
                        for item in content:
                            if item.get("type") == "text":
                                return json.loads(item["text"])
                    except Exception:
                        continue
        return {}

    # Plain JSON response
    data = resp.json()
    if "error" in data:
        raise Exception(f"MCP error: {data['error']}")

    content = data.get("result", {}).get("content", [])
    for item in content:
        if item.get("type") == "text":
            return json.loads(item["text"])
    return {}


def run():
    if not QUINN_API_TOKEN:
        print("[snapshot_quinn] QUINN_API_TOKEN not set — skipping Quinn snapshot.")
        with db.tx() as conn:
            db.set_snapshot_meta(
                conn, "quinn", "skipped", 0,
                "QUINN_API_TOKEN not configured. Set this env var on Render."
            )
        return

    print("[snapshot_quinn] Fetching adoption metrics from Quinn API…")

    try:
        result = call_mcp_tool("analytics_get_adoption_metrics", {"tab": "all-customers"})
        orgs_raw = result.get("orgs", [])
        if isinstance(orgs_raw, str):
            orgs_raw = json.loads(orgs_raw)

        # Filter out demo / internal orgs
        orgs = [o for o in orgs_raw if o.get("productName") not in DEMO_PRODUCTS]
        print(f"[snapshot_quinn] Received {len(orgs_raw)} orgs, keeping {len(orgs)} real customers")

        with db.tx() as conn:
            for o in orgs:
                db.upsert_quinn_org(conn, {
                    "org_id":              o["orgId"],
                    "org_name":            o["orgName"],
                    "product_name":        o.get("productName", ""),
                    "org_created_at":      o.get("orgCreatedAt", ""),
                    "courses_created":     o.get("coursesCreated", 0) or 0,
                    "white_glove_courses": o.get("whiteGloveCourses", 0) or 0,
                    "progressions":        o.get("progressions", 0) or 0,
                    "total_members":       o.get("totalMembers", 0) or 0,
                    "unique_learners":     o.get("uniqueLearners", 0) or 0,
                    "content_creators":    o.get("contentCreators", 0) or 0,
                    "dau":                 o.get("dau", 0) or 0,
                    "wau":                 o.get("wau", 0) or 0,
                    "mau":                 o.get("mau", 0) or 0,
                    "hris_connected":      1 if o.get("hrisConnected") else 0,
                    "assignments_made":    o.get("assignmentsMade", 0) or 0,
                    "courses_assigned":    o.get("coursesAssigned", 0) or 0,
                    "courses_started":     o.get("coursesStarted", 0) or 0,
                    "courses_completed":   o.get("coursesCompleted", 0) or 0,
                    "stacks_created":      o.get("stacksCreated", 0) or 0,
                    "groups_created":      o.get("groupsCreated", 0) or 0,
                    "language_count":      o.get("languageCount", 0) or 0,
                    "has_api_key":         1 if o.get("hasApiKey") else 0,
                    "knowledge_base_files": o.get("knowledgeBaseFiles", 0) or 0,
                    "media_library_files":  o.get("mediaLibraryFiles", 0) or 0,
                    "features":            json.dumps(o.get("features") or []),
                })
            db.set_snapshot_meta(conn, "quinn", "ok", len(orgs))

        print(f"[snapshot_quinn] Done. Upserted {len(orgs)} orgs.")

    except Exception as e:
        print(f"[snapshot_quinn] Error: {e}", file=sys.stderr)
        with db.tx() as conn:
            db.set_snapshot_meta(conn, "quinn", "error", 0, str(e))
        sys.exit(1)


if __name__ == "__main__":
    run()
