import re


# You can extend this list with new patterns over time.
# Each pattern must include named group "bpm".
BPM_EXTRACTION_INSTRUCTIONS = [
    {
        'id': 'number_before_bpm',
        'description': 'Extract BPM when number is before bpm token.',
        'pattern': r'(?i)\b(?P<bpm>\d{2,3})[\s\-_]*bpm\b',
        'examples': [
            '(starter) nt 136 bpm Bm @dopechef',
            'Miss 132 bpm c#minor @dopechef',
            'Zero 140 bpm e minor @dopechef',
        ],
    },
    {
        'id': 'bpm_before_number',
        'description': 'Extract BPM when bpm token is before number.',
        'pattern': r'(?i)\bbpm[\s\-_]*(?P<bpm>\d{2,3})\b',
        'examples': [
            'bpm_140_trap_loop',
            'BPM-95 dark loop',
        ],
    },
]


def extract_bpm_from_filename(file_stem: str):
    if not file_stem:
        return None

    normalized = file_stem.replace('.', ' ')
    for instruction in BPM_EXTRACTION_INSTRUCTIONS:
        match = re.search(instruction['pattern'], normalized)
        if not match:
            continue
        bpm_value = int(match.group('bpm'))
        if 40 <= bpm_value <= 300:
            return bpm_value
    return None


BPM_STRIP_PATTERNS = [
    r'(?i)\b\d{2,3}[\s\-_]*bpm\b',
    r'(?i)\bbpm[\s\-_]*\d{2,3}\b',
]


def strip_bpm_from_name(name: str) -> str:
    """
    Remove BPM fragments from a loop name.
    Example:
      "(starter) nt 136 bpm Bm @dopechef" -> "(starter) nt Bm @dopechef"
    """
    if not name:
        return name

    cleaned = name
    for pattern in BPM_STRIP_PATTERNS:
        cleaned = re.sub(pattern, ' ', cleaned)

    cleaned = re.sub(r'\s+', ' ', cleaned).strip(' _-')
    return cleaned
