"""Load portfolio.json and network.json into Supabase for the demo investor."""
import json
import uuid

from common import ROOT, env, supabase_admin

SEED = ROOT / "data" / "seed"
NAMESPACE = uuid.UUID("6f1c2b8e-3d4a-4c5b-9e7f-0a1b2c3d4e5f")


def stable_id(owner: str, local_id: str) -> str:
    """Same person always gets the same database id, even after re-loading."""
    return str(uuid.uuid5(NAMESPACE, f"{owner}:{local_id}"))


def main() -> None:
    sb = supabase_admin()
    owner = env("DEMO_OWNER_ID")

    portfolio = json.loads((SEED / "portfolio.json").read_text(encoding="utf-8"))
    network = json.loads((SEED / "network.json").read_text(encoding="utf-8"))

    # 1) Companies (public data)
    all_companies = portfolio["portfolio"] + portfolio["research"]
    sb.table("companies").upsert([
        {k: c[k] for k in ("symbol", "name", "sector", "size", "bse_code")} for c in all_companies
    ]).execute()

    # 2) This investor's lists
    holdings = [{"owner_id": owner, "symbol": c["symbol"], "list": "portfolio"} for c in portfolio["portfolio"]]
    holdings += [{"owner_id": owner, "symbol": c["symbol"], "list": "research"} for c in portfolio["research"]]
    sb.table("holdings").delete().eq("owner_id", owner).execute()
    sb.table("holdings").insert(holdings).execute()

    # 3) People + careers (private). Wipe and reload; deleting persons also deletes their stints.
    sb.table("persons").delete().eq("owner_id", owner).execute()
    everyone = [{**network["self"], "kind": "self"}] + [{**p, "kind": "contact"} for p in network["contacts"]]

    persons, stints = [], []
    for p in everyone:
        person_id = stable_id(owner, p["id"])
        persons.append({
            "id": person_id,
            "owner_id": owner,
            "full_name": p["name"],
            "headline": p.get("headline"),
            "city": p.get("city"),
            "kind": p["kind"],
            "relationship": p.get("relationship"),
            "closeness": p.get("closeness"),
            "last_contacted": p.get("last_contacted"),
            "expertise": p.get("expertise", []),
            "source": "synthetic",
        })
        for kind, org, symbol, title, start, end in p["career"]:
            stints.append({
                "owner_id": owner, "person_id": person_id, "org_name": org, "symbol": symbol,
                "kind": kind, "title": title, "start_year": start, "end_year": end,
            })

    sb.table("persons").insert(persons).execute()
    sb.table("stints").insert(stints).execute()

    print(f"Loaded {len(all_companies)} companies, {len(holdings)} holdings, "
          f"{len(persons)} people, {len(stints)} career entries.")


if __name__ == "__main__":
    main()