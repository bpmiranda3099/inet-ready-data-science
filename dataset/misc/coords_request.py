COORDS_QUERY = """
[out:json];
area["ISO3166-2"="PH-CAV"];
(
    node(area)[place~"city|town"];
);
out body;
"""

def get_coords_query() -> str:
    return COORDS_QUERY
