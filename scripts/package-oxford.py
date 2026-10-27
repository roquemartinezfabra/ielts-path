"""Package the supplied, already-converted vocabulary. Never include learner state.

Usage: python scripts/package-oxford.py path/to/cards.json
The generated files are committed; builds do not need the private input file.
"""
from pathlib import Path
import collections, hashlib, json, re, sys

ROOT = Path(__file__).resolve().parents[1]
VERSION = '2026-10-27-v1'
FIELDS = ('id', 'deck', 'category', 'mode', 'prompt', 'answer', 'explanation',
          'example', 'ipa', 'lemma', 'skillId', 'sourceUrl', 'source')
LEVELS = ('A1', 'A2', 'B1', 'B2', 'C1')

def main():
    source = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
    cards, levels = [], collections.Counter()
    for entry in source:
        if entry.get('category') != 'vocabulary':
            continue
        origin = re.search(r'ID de origen: ((?:Oxford|US)(?:3000|5000)_[^\s]+)', entry['source'])
        level = re.search(r'Nivel::(A1|A2|B1|B2|C1)\b', entry['source'])
        if not origin or not level:
            raise ValueError('Vocabulary outside the supplied Oxford collection')
        card = {field: entry[field] for field in FIELDS}
        # Preserve identity and learning content; only remove private file provenance.
        card['source'] = 'Oxford 3000/5000 · ID de origen: ' + origin[1] + '\n' + entry['source'].split('\n', 1)[1].strip()
        assert card['mode'] == 'recognition' and card['example'] and card['lemma']
        cards.append((LEVELS.index(level[1]), card['lemma'].casefold(), origin[1], card))
        levels[level[1]] += 1
    cards = [row[3] for row in sorted(cards, key=lambda row: row[:3])]
    assert len(cards) == 5535 and len({card['id'] for card in cards}) == 5535
    folder = ROOT / 'public' / 'decks' / 'oxford-5000' / VERSION
    folder.mkdir(parents=True, exist_ok=True)
    parts = []
    for offset in range(0, len(cards), 200):
        chunk = cards[offset:offset + 200]
        filename = f'part-{len(parts):03d}.json'
        data = (json.dumps(chunk, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
        (folder / filename).write_bytes(data)
        parts.append({'file': filename, 'count': len(chunk), 'sha256': hashlib.sha256(data).hexdigest()})
    manifest = {'id': 'oxford-5000', 'version': VERSION, 'title': 'Oxford 3000 + Oxford 5000',
                'total': len(cards), 'levels': dict(sorted(levels.items())), 'parts': parts}
    (ROOT / 'app/data/oxford-catalog.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Packaged {len(cards)} vocabulary cards in {len(parts)} parts; levels: {dict(levels)}. No schedules, reviews or private grammar included.')

if __name__ == '__main__':
    main()
