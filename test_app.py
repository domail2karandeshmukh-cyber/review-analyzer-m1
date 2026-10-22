from app import normalize_review, classify_review

# Test 1: Uppercase text
assert classify_review("GOOD product") == "positive"

# Test 2: Extra spaces
assert normalize_review("  Good   product  ") == "good product"

# Test 3: Unknown review
assert classify_review("Average product") == "unknown"

print("All 3 tests passed!")
