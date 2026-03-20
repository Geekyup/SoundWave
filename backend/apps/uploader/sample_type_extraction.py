import re


SAMPLE_TYPE_TOKEN_PATTERNS = (
    ('hi_hat', (('hi', 'hat'), ('hihat',), ('hh',))),
    ('clap', (('clap',),)),
    ('kick', (('kick',),)),
    ('snare', (('snare',),)),
    ('tom', (('tom',),)),
    ('perc', (('perc',), ('percussion',))),
    ('bass', (('bass',), ('808',))),
)


def _find_subsequence(tokens, pattern):
    max_start = len(tokens) - len(pattern) + 1
    if max_start < 1:
        return None

    for start in range(max_start):
        if tuple(tokens[start:start + len(pattern)]) == tuple(pattern):
            return start
    return None


def detect_sample_type_and_clean_name(raw_name, fallback_sample_type):
    """
    Extract sample type from file name and remove detected token(s) from title.

    Example:
      "Aurum Clap" -> ("Aurum", "clap")
    """
    original = (raw_name or '').strip()
    if not original:
        return 'untitled', fallback_sample_type

    # Highest-priority rule: any "808" in file name means Bass.
    if re.search(r'808', original, flags=re.IGNORECASE):
        name_without_808 = re.sub(r'(?i)808', ' ', original)
        name_without_808 = re.sub(r'[_-]+', ' ', name_without_808)
        name_without_808 = re.sub(r'\s+', ' ', name_without_808).strip()
        cleaned = name_without_808 or original
        return cleaned[:200], 'bass'

    tokens = re.findall(r"[A-Za-z0-9]+", original)
    if not tokens:
        return original[:200], fallback_sample_type

    lowered_tokens = [token.lower() for token in tokens]

    for sample_type, patterns in SAMPLE_TYPE_TOKEN_PATTERNS:
        for pattern in patterns:
            match_start = _find_subsequence(lowered_tokens, pattern)
            if match_start is None:
                continue

            match_end = match_start + len(pattern)
            remaining_tokens = [
                token for index, token in enumerate(tokens)
                if index < match_start or index >= match_end
            ]
            cleaned_name = ' '.join(remaining_tokens).strip()
            if not cleaned_name:
                cleaned_name = original
            return cleaned_name[:200], sample_type

    fallback_name = re.sub(r'[_-]+', ' ', original)
    fallback_name = re.sub(r'\s+', ' ', fallback_name).strip()
    return (fallback_name[:200] or 'untitled'), fallback_sample_type
