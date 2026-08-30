"""Evidence connectors.

Demo mode uses a privacy-safe incident bundle. Live mode reads Google Ads with
GAQL and a governed Looker query. Credentials are read only from environment
variables and are never written to agent state or model prompts.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "incident-pl0047.json"


def _demo_bundle() -> dict[str, Any]:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def _google_ads_rows() -> list[dict[str, Any]]:
    from google.ads.googleads.client import GoogleAdsClient

    config = {
        "developer_token": os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"],
        "client_id": os.environ["GOOGLE_ADS_CLIENT_ID"],
        "client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"],
        "refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"],
        "use_proto_plus": True,
    }
    login_customer_id = os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID")
    if login_customer_id:
        config["login_customer_id"] = login_customer_id

    client = GoogleAdsClient.load_from_dict(config)
    service = client.get_service("GoogleAdsService")
    query = """
      SELECT
        segments.date,
        segments.device,
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date DURING LAST_14_DAYS
      ORDER BY segments.date
    """
    rows = service.search_stream(
        customer_id=os.environ["GOOGLE_ADS_CUSTOMER_ID"],
        query=query,
    )
    output: list[dict[str, Any]] = []
    for batch in rows:
        for row in batch.results:
            output.append(
                {
                    "date": str(row.segments.date),
                    "device": str(row.segments.device),
                    "campaign_id": str(row.campaign.id),
                    "campaign_name": row.campaign.name,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "cost": row.metrics.cost_micros / 1_000_000,
                    "conversions": row.metrics.conversions,
                    "conversion_value": row.metrics.conversions_value,
                }
            )
    return output


def _looker_rows() -> list[dict[str, Any]]:
    import looker_sdk

    sdk = looker_sdk.init40()
    query_id = os.environ["LOOKER_QUERY_ID"]
    result = sdk.run_query(query_id=query_id, result_format="json")
    return json.loads(result)


def load_business_evidence(incident_id: str = "PL-0047") -> dict[str, Any]:
    """Load the read-only evidence bundle for a business incident.

    Returns source-labelled quantitative and qualitative observations. In demo
    mode the data is synthetic. In live mode Google Ads and Looker are queried
    with credentials scoped outside the model context.
    """

    if os.getenv("PROOFLOOP_DEMO_MODE", "true").lower() == "true":
        bundle = _demo_bundle()
        bundle["incident_id"] = incident_id
        return bundle

    return {
        "incident_id": incident_id,
        "mode": "live",
        "google_ads": _google_ads_rows(),
        "looker": _looker_rows(),
        "release_log": [],
        "customer_voice": [],
        "data_contract": {
            "join_keys": ["date", "campaign_id", "device", "landing_page"],
            "note": "Correlations are not treated as verified causes.",
        },
    }
