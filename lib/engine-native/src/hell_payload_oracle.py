"""Hell Payload Oracle — Golden Hash reference generator.

Produces canonical JSON + SHA-256 hashes for complex nested payloads.
The C++ serializer MUST produce byte-identical output to pass conformance.
"""
import json
import hashlib
import sys


def canonical_sort(obj):
    if isinstance(obj, dict):
        return {k: canonical_sort(v) for k, v in sorted(obj.items())}
    if isinstance(obj, list):
        return [canonical_sort(item) for item in obj]
    return obj


def compute_golden_hash(payload: dict) -> tuple[str, str]:
    sorted_payload = canonical_sort(payload)
    canonical = json.dumps(sorted_payload, separators=(",", ":"), ensure_ascii=False)
    hash_hex = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return canonical, hash_hex


HELL_PAYLOADS = {
    "flat_simple": {
        "amount": 50000.0,
        "user_id": "alpha-001",
        "vehicle_id": 1,
    },
    "nested_deep": {
        "vehicle": {
            "id": 1,
            "name": "Lexus RX300",
            "year": 2024,
            "price": 52000.0,
            "color": "silver",
            "features": ["AWD", "sunroof", "leather"],
            "dimensions": {
                "length": 4890.5,
                "width": 1895.0,
                "height": 1690.0,
            },
        },
        "bid": {
            "amount": 48500.0,
            "user_id": "alpha-001",
            "state_version": 3,
            "payload_hash": None,
        },
        "metadata": {
            "timestamp": 1700000000,
            "source": "native-client",
            "version": "5.0.0",
        },
    },
    "null_heavy": {
        "a": None,
        "b": {"c": None, "d": [None, 1, None]},
        "e": [],
    },
    "float_edge_cases": {
        "whole": 1.0,
        "negative": -42.0,
        "fractional": 3.14159,
        "large": 999999999.0,
        "small": 0.001,
        "zero": 0.0,
    },
    "unicode_stress": {
        "name": "Lexus\u00ae RX300\u2122",
        "emoji": "\U0001f697",
        "cjk": "\u8c4a\u7530",
        "accents": "\u00e9\u00e0\u00fc\u00f1",
    },
    "key_sort_adversarial": {
        "zebra": 1,
        "alpha": 2,
        "Beta": 3,
        "alpha2": 4,
        "ALPHA": 5,
        "nested": {
            "z": {"b": 2, "a": 1},
            "a": {"y": 2, "x": 1},
        },
    },
    "array_of_objects": {
        "bids": [
            {"amount": 50000.0, "user_id": "user-a"},
            {"amount": 55000.0, "user_id": "user-b"},
            {"amount": 60000.0, "user_id": "user-c"},
        ],
    },
    "integer_types": {
        "small_int": 1,
        "big_int": 2147483647,
        "negative": -1,
        "zero": 0,
    },
    "empty_structures": {
        "empty_obj": {},
        "empty_arr": [],
        "empty_str": "",
    },
    "boolean_and_mixed": {
        "active": True,
        "deleted": False,
        "count": 0,
        "label": "test",
        "value": None,
    },
}


def generate_all_golden_hashes() -> dict[str, dict[str, str]]:
    results = {}
    for name, payload in HELL_PAYLOADS.items():
        canonical, hash_hex = compute_golden_hash(payload)
        results[name] = {"canonical": canonical, "hash": hash_hex}
    return results


if __name__ == "__main__":
    results = generate_all_golden_hashes()
    for name, data in results.items():
        print(f"\n=== {name} ===")
        print(f"  CANONICAL: {data['canonical']}")
        print(f"  HASH:      {data['hash']}")

    if "--json" in sys.argv:
        print("\n" + json.dumps(results, indent=2))
